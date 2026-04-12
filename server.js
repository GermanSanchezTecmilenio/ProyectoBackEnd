try {
  // Optional: loads DB config from .env (requires "dotenv" dependency)
  // eslint-disable-next-line global-require
  require("dotenv").config();
} catch {
  // ignore when dotenv isn't installed
}

const express = require("express");
const mysql = require("mysql2/promise");
const path = require("path");

// Defaults integrados (pueden ser sobre-escritos por variables de entorno o .env)
const DEFAULT_PORT = 3000;
const DEFAULT_DB_HOST = "localhost";
const DEFAULT_DB_USER = "root";
const DEFAULT_DB_PASSWORD = "1234";
const DEFAULT_DB_NAME = "employees";

const app = express();
const PORT = Number(process.env.PORT) || DEFAULT_PORT;
if (!Number.isInteger(PORT) || PORT <= 0 || PORT > 65535) {
  throw new Error(`[CONFIG] PORT inválido: ${process.env.PORT}`);
}

app.use(express.json({ limit: "1mb" }));

/* CORS (dev/local) */
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS");
  res.header("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.sendStatus(204);
  next();
});

app.use(express.static(path.join(__dirname, "public")));

/* DB */
const DB_HOST = (process.env.DB_HOST || DEFAULT_DB_HOST).trim();
const DB_USER = (process.env.DB_USER || DEFAULT_DB_USER).trim();
const DB_PASSWORD =
  process.env.DB_PASSWORD && process.env.DB_PASSWORD.length > 0
    ? process.env.DB_PASSWORD
    : DEFAULT_DB_PASSWORD;
const DB_NAME = (process.env.DB_NAME || DEFAULT_DB_NAME).trim();

if (!DB_HOST) throw new Error("[CONFIG] DB_HOST vacío");
if (!DB_USER) throw new Error("[CONFIG] DB_USER vacío");
if (!DB_NAME) throw new Error("[CONFIG] DB_NAME vacío");

const pool = mysql.createPool({
  host: DB_HOST,
  user: DB_USER,
  password: DB_PASSWORD,
  database: DB_NAME,
  waitForConnections: true,
  connectionLimit: Number(process.env.DB_CONNECTION_LIMIT) || 10
});

async function ensureIncidenciasTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS incidencias_rrhh (
      id_incidencia INT NOT NULL AUTO_INCREMENT,
      emp_no INT NOT NULL,
      tipo VARCHAR(50) NOT NULL,
      fecha DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      descripcion VARCHAR(255) NOT NULL,
      estatus ENUM('abierta', 'pendiente', 'cerrada') NOT NULL DEFAULT 'abierta',
      PRIMARY KEY (id_incidencia),
      INDEX idx_incidencias_emp_no (emp_no),
      INDEX idx_incidencias_fecha (fecha)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  // Si ya existía, asegurar que el ENUM incluya "pendiente".
  try {
    await pool.query(`
      ALTER TABLE incidencias_rrhh
      MODIFY COLUMN estatus ENUM('abierta', 'pendiente', 'cerrada') NOT NULL DEFAULT 'abierta';
    `);
  } catch (err) {
    console.warn(
      "[DB] No se pudo actualizar incidencias_rrhh.estatus para incluir 'pendiente':",
      err?.message || err
    );
  }
}

async function ensureAumentosSalarioTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS aumentos_salario_etapas (
      id_plan INT NOT NULL AUTO_INCREMENT,
      emp_no INT NOT NULL,
      etapas_total INT NOT NULL,
      etapas_aplicadas INT NOT NULL DEFAULT 0,
      porcentaje DECIMAL(5,2) NOT NULL,
      estatus ENUM('activo', 'completado', 'cancelado') NOT NULL DEFAULT 'activo',
      creado_en DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      actualizado_en DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id_plan),
      INDEX idx_aumentos_emp_no (emp_no),
      INDEX idx_aumentos_estatus (estatus),
      INDEX idx_aumentos_creado_en (creado_en)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);
}

// Test de conexión (no detiene el servidor; solo muestra un log útil)
pool
  .getConnection()
  .then((conn) => conn.release())
  .then(() => console.log(`[DB] Conectado a ${DB_HOST}/${DB_NAME} como ${DB_USER}`))
  .then(() => ensureIncidenciasTable())
  .then(() => console.log("[DB] Tabla incidencias_rrhh lista"))
  .then(() => ensureAumentosSalarioTable())
  .then(() => console.log("[DB] Tabla aumentos_salario_etapas lista"))
  .catch((err) => {
    if (err?.code === "ER_ACCESS_DENIED_ERROR") {
      console.error(
        `[DB] Acceso denegado (${DB_USER}@${DB_HOST}). Revisa DB_USER/DB_PASSWORD y privilegios.`
      );
      return;
    }
    console.error("[DB] Error de conexión:", err?.message || err);
  });

function isValidEmpNo(value) {
  const n = Number(value);
  return Number.isInteger(n) && n > 0;
}

function isValidDeptNo(value) {
  return typeof value === "string" && /^d\d{3}$/.test(value);
}

function parseLimit(value, fallback) {
  const n = Number(value);
  if (!Number.isInteger(n) || n <= 0) return fallback;
  return Math.min(n, 200);
}

function parseOffset(value, fallback) {
  const n = Number(value);
  if (!Number.isInteger(n) || n < 0) return fallback;
  return Math.min(n, 100000);
}

function toDateOnlyString(value) {
  if (!value) return "";
  if (typeof value === "string") return value.slice(0, 10);
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value).slice(0, 10);
}

function todayDateOnly() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function isValidDateOnly(value) {
  if (typeof value !== "string") return false;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const dt = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(dt.getTime())) return false;
  return dt.toISOString().slice(0, 10) === value;
}

/* ================= EMPLOYEES ================= */

// Listar y buscar empleados (filtros: ?q=, ?dept_no=, ?gender=, ?hire_from=YYYY-MM-DD, ?hire_to=YYYY-MM-DD, ?active=1|0)
app.get("/api/employees", async (req, res, next) => {
  try {
    const q = String(req.query.q || "").trim();
    const deptNo = String(req.query.dept_no || "").trim();
    const gender = String(req.query.gender || "").trim().toUpperCase();
    const hireFrom = String(req.query.hire_from || "").trim();
    const hireTo = String(req.query.hire_to || "").trim();
    const activeParam = String(req.query.active || "").trim().toLowerCase();

    const limit = parseLimit(req.query.limit, 50);
    const offset = parseOffset(req.query.offset, 0);
    const sortBy = String(req.query.sort_by || "emp_no").trim();
    const sortDirRaw = String(req.query.sort_dir || "asc")
      .trim()
      .toLowerCase();

    if (deptNo && !isValidDeptNo(deptNo)) {
      return res.status(400).json({ mensaje: "dept_no inválido (ej: d001)" });
    }
    if (gender && !["M", "F"].includes(gender)) {
      return res.status(400).json({ mensaje: "gender inválido (M/F)" });
    }
    if (hireFrom && !/^\d{4}-\d{2}-\d{2}$/.test(hireFrom)) {
      return res.status(400).json({ mensaje: "hire_from inválido (YYYY-MM-DD)" });
    }
    if (hireTo && !/^\d{4}-\d{2}-\d{2}$/.test(hireTo)) {
      return res.status(400).json({ mensaje: "hire_to inválido (YYYY-MM-DD)" });
    }
    if (activeParam && !["1", "0", "true", "false"].includes(activeParam)) {
      return res.status(400).json({ mensaje: "active inválido (1/0)" });
    }
    if (sortDirRaw && !["asc", "desc"].includes(sortDirRaw)) {
      return res.status(400).json({ mensaje: "sort_dir inválido (asc/desc)" });
    }

    const sortMap = {
      status: "CASE WHEN de.emp_no IS NULL THEN 0 ELSE 1 END",
      emp_no: "e.emp_no",
      first_name: "e.first_name",
      last_name: "e.last_name",
      gender: "e.gender",
      hire_date: "e.hire_date",
      dept_no: "d.dept_no",
      dept_name: "d.dept_name"
    };
    const sortExpr = sortMap[sortBy];
    if (!sortExpr) return res.status(400).json({ mensaje: "sort_by inválido" });
    const sortDir = sortDirRaw === "desc" ? "DESC" : "ASC";
    const orderBySql = `ORDER BY ${sortExpr} ${sortDir}, e.emp_no ASC`;

    const where = [];
    const params = [];

    if (q) {
      if (/^\d+$/.test(q)) {
        where.push("e.emp_no = ?");
        params.push(Number(q));
      } else {
        where.push("(e.first_name LIKE ? OR e.last_name LIKE ?)");
        params.push(`%${q}%`, `%${q}%`);
      }
    }

    if (deptNo) {
      where.push("de.dept_no = ?");
      params.push(deptNo);
    }

    if (gender) {
      where.push("e.gender = ?");
      params.push(gender);
    }

    if (hireFrom) {
      where.push("e.hire_date >= ?");
      params.push(hireFrom);
    }

    if (hireTo) {
      where.push("e.hire_date <= ?");
      params.push(hireTo);
    }

    if (activeParam === "1" || activeParam === "true") where.push("de.emp_no IS NOT NULL");
    if (activeParam === "0" || activeParam === "false") where.push("de.emp_no IS NULL");

    const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

    const [[totalRow]] = await pool.query(
      `
      SELECT COUNT(DISTINCT e.emp_no) total
      FROM employees e
      LEFT JOIN dept_emp de
        ON e.emp_no = de.emp_no AND de.to_date = '9999-01-01'
      LEFT JOIN departments d
        ON de.dept_no = d.dept_no
      ${whereSql}
      `,
      params
    );

    const [rows] = await pool.query(
      `
      SELECT
        e.emp_no,
        e.first_name,
        e.last_name,
        e.gender,
        e.hire_date,
        d.dept_no,
        d.dept_name,
        CASE WHEN de.emp_no IS NULL THEN 0 ELSE 1 END AS is_active
      FROM employees e
      LEFT JOIN dept_emp de
        ON e.emp_no = de.emp_no AND de.to_date = '9999-01-01'
      LEFT JOIN departments d
        ON de.dept_no = d.dept_no
      ${whereSql}
      ${orderBySql}
      LIMIT ? OFFSET ?
      `,
      [...params, limit, offset]
    );

    res.json({ total: totalRow.total, limit, offset, count: rows.length, rows });
  } catch (err) {
    next(err);
  }
});

// Detalle empleado
app.get("/api/employees/:id", async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!isValidEmpNo(id)) return res.status(400).json({ mensaje: "ID inválido" });

    const [rows] = await pool.query(
      `
      SELECT
        e.emp_no,
        e.birth_date,
        e.first_name,
        e.last_name,
        e.gender,
        e.hire_date,
        d.dept_no,
        d.dept_name
      FROM employees e
      LEFT JOIN dept_emp de
        ON e.emp_no = de.emp_no AND de.to_date = '9999-01-01'
      LEFT JOIN departments d
        ON de.dept_no = d.dept_no
      WHERE e.emp_no = ?
      `,
      [id]
    );

    if (!rows.length) return res.status(404).json({ mensaje: "Empleado no encontrado" });
    res.json(rows[0]);
  } catch (err) {
    next(err);
  }
});

// Historial de títulos y salarios
app.get("/api/employees/:id/historial", async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!isValidEmpNo(id)) return res.status(400).json({ mensaje: "ID inválido" });

    const [titles] = await pool.query(
      "SELECT title, from_date, to_date FROM titles WHERE emp_no = ? ORDER BY from_date DESC",
      [id]
    );

    const [salaries] = await pool.query(
      "SELECT salary, from_date, to_date FROM salaries WHERE emp_no = ? ORDER BY from_date DESC",
      [id]
    );

    res.json({ emp_no: id, titles, salaries });
  } catch (err) {
    next(err);
  }
});

/* ================= TITLES (CATÁLOGO) ================= */

app.get("/api/titles", async (_req, res, next) => {
  try {
    const [rows] = await pool.query("SELECT DISTINCT title FROM titles ORDER BY title");
    res.json(rows.map((r) => r.title));
  } catch (err) {
    next(err);
  }
});

/* ================= AUMENTO SALARIAL POR ETAPAS ================= */

// Ver plan activo del empleado
app.get("/api/employees/:id/salary-plan", async (req, res, next) => {
  try {
    const empNo = Number(req.params.id);
    if (!isValidEmpNo(empNo)) return res.status(400).json({ mensaje: "ID inválido" });

    const [rows] = await pool.query(
      `
      SELECT id_plan, emp_no, etapas_total, etapas_aplicadas, porcentaje, estatus, creado_en, actualizado_en
      FROM aumentos_salario_etapas
      WHERE emp_no = ?
        AND estatus = 'activo'
      ORDER BY creado_en DESC
      LIMIT 1
      `,
      [empNo]
    );

    if (!rows.length) return res.status(404).json({ mensaje: "No hay plan activo" });
    res.json(rows[0]);
  } catch (err) {
    next(err);
  }
});

// Crear plan por etapas
app.post("/api/employees/:id/salary-plan", async (req, res, next) => {
  try {
    const empNo = Number(req.params.id);
    if (!isValidEmpNo(empNo)) return res.status(400).json({ mensaje: "ID inválido" });

    const etapasTotal = Number(req.body.etapas_total ?? req.body.etapas ?? req.body.stages);
    const porcentaje = Number(req.body.porcentaje ?? req.body.percent);

    if (!Number.isInteger(etapasTotal) || etapasTotal < 1 || etapasTotal > 12) {
      return res.status(400).json({ mensaje: "etapas_total inválido (1-12)" });
    }
    if (!Number.isFinite(porcentaje) || porcentaje <= 0 || porcentaje > 100) {
      return res.status(400).json({ mensaje: "porcentaje inválido (>0 y <=100)" });
    }

    const [empRows] = await pool.query("SELECT 1 ok FROM employees WHERE emp_no = ? LIMIT 1", [empNo]);
    if (!empRows.length) return res.status(404).json({ mensaje: "Empleado no encontrado" });

    const [existing] = await pool.query(
      "SELECT 1 ok FROM aumentos_salario_etapas WHERE emp_no = ? AND estatus = 'activo' LIMIT 1",
      [empNo]
    );
    if (existing.length) {
      return res.status(409).json({ mensaje: "Ya existe un plan activo para este empleado" });
    }

    const [result] = await pool.query(
      `
      INSERT INTO aumentos_salario_etapas (emp_no, etapas_total, porcentaje, estatus)
      VALUES (?, ?, ?, 'activo')
      `,
      [empNo, etapasTotal, porcentaje]
    );

    res.status(201).json({
      mensaje: "Plan de aumento creado",
      id_plan: result.insertId,
      emp_no: empNo,
      etapas_total: etapasTotal,
      porcentaje
    });
  } catch (err) {
    next(err);
  }
});

// Aplicar siguiente etapa (crea un nuevo registro en salaries y actualiza el plan)
app.post("/api/employees/:id/salary-plan/apply-next", async (req, res, next) => {
  let conn;
  try {
    const empNo = Number(req.params.id);
    if (!isValidEmpNo(empNo)) return res.status(400).json({ mensaje: "ID inválido" });

    conn = await pool.getConnection();
    await conn.beginTransaction();

    const [planRows] = await conn.query(
      `
      SELECT id_plan, etapas_total, etapas_aplicadas, porcentaje
      FROM aumentos_salario_etapas
      WHERE emp_no = ?
        AND estatus = 'activo'
      ORDER BY creado_en DESC
      LIMIT 1
      FOR UPDATE
      `,
      [empNo]
    );

    if (!planRows.length) {
      await conn.rollback();
      return res.status(404).json({ mensaje: "No hay un plan activo para este empleado" });
    }

    const plan = planRows[0];
    const etapasTotal = Number(plan.etapas_total);
    const etapasAplicadas = Number(plan.etapas_aplicadas);
    const porcentaje = Number(plan.porcentaje);

    if (etapasAplicadas >= etapasTotal) {
      await conn.query("UPDATE aumentos_salario_etapas SET estatus = 'completado' WHERE id_plan = ?", [
        plan.id_plan
      ]);
      await conn.commit();
      return res.json({ mensaje: "El plan ya estaba completado" });
    }

    const today = todayDateOnly();

    const [salaryRows] = await conn.query(
      `
      SELECT salary, from_date
      FROM salaries
      WHERE emp_no = ?
        AND to_date = '9999-01-01'
      ORDER BY from_date DESC
      LIMIT 1
      FOR UPDATE
      `,
      [empNo]
    );

    if (!salaryRows.length) {
      await conn.rollback();
      return res.status(404).json({ mensaje: "No se encontró salario actual para el empleado" });
    }

    const currentSalary = Number(salaryRows[0].salary);
    const currentFrom = toDateOnlyString(salaryRows[0].from_date);
    if (currentFrom === today) {
      await conn.rollback();
      return res.status(409).json({
        mensaje: "Ya existe un cambio salarial con fecha de hoy. Intenta otro día."
      });
    }

    const newSalary = Math.round(currentSalary * (1 + porcentaje / 100));
    if (!Number.isFinite(newSalary) || newSalary <= currentSalary) {
      await conn.rollback();
      return res.status(400).json({ mensaje: "No se pudo calcular el nuevo salario" });
    }

    const [existsToday] = await conn.query(
      "SELECT 1 ok FROM salaries WHERE emp_no = ? AND from_date = ? LIMIT 1 FOR UPDATE",
      [empNo, today]
    );
    if (existsToday.length) {
      await conn.rollback();
      return res.status(409).json({
        mensaje: "Ya existe un registro de salario con la fecha de hoy. Intenta otro día."
      });
    }

    await conn.query("UPDATE salaries SET to_date = ? WHERE emp_no = ? AND to_date = '9999-01-01'", [
      today,
      empNo
    ]);

    await conn.query(
      "INSERT INTO salaries (emp_no, salary, from_date, to_date) VALUES (?, ?, ?, '9999-01-01')",
      [empNo, newSalary, today]
    );

    const nextAplicadas = etapasAplicadas + 1;
    const done = nextAplicadas >= etapasTotal;
    await conn.query(
      "UPDATE aumentos_salario_etapas SET etapas_aplicadas = ?, estatus = ? WHERE id_plan = ?",
      [nextAplicadas, done ? "completado" : "activo", plan.id_plan]
    );

    await conn.commit();
    res.status(201).json({
      mensaje: done ? "Etapa aplicada. Plan completado." : "Etapa aplicada.",
      emp_no: empNo,
      etapas_total: etapasTotal,
      etapas_aplicadas: nextAplicadas,
      porcentaje,
      salary_anterior: currentSalary,
      salary_nuevo: newSalary
    });
  } catch (err) {
    try {
      if (conn) await conn.rollback();
    } catch {
      // ignore rollback errors
    }
    next(err);
  } finally {
    if (conn) conn.release();
  }
});

// Cancelar plan activo
app.post("/api/employees/:id/salary-plan/cancel", async (req, res, next) => {
  try {
    const empNo = Number(req.params.id);
    if (!isValidEmpNo(empNo)) return res.status(400).json({ mensaje: "ID inválido" });

    const [result] = await pool.query(
      "UPDATE aumentos_salario_etapas SET estatus = 'cancelado' WHERE emp_no = ? AND estatus = 'activo'",
      [empNo]
    );

    if (result.affectedRows === 0) return res.status(404).json({ mensaje: "No hay plan activo para cancelar" });
    res.json({ mensaje: "Plan cancelado" });
  } catch (err) {
    next(err);
  }
});

/* ================= ASCENSOS (PROMOCIÓN) ================= */

app.post("/api/employees/:id/titles/promote", async (req, res, next) => {
  let conn;
  try {
    const empNo = Number(req.params.id);
    if (!isValidEmpNo(empNo)) return res.status(400).json({ mensaje: "ID inválido" });

    const title = String(req.body.title ?? req.body.titulo ?? "").trim();
    const fromDateRaw = req.body.from_date ?? req.body.fecha;
    const fromDate = String(fromDateRaw || todayDateOnly()).trim();

    if (title.length < 2) return res.status(400).json({ mensaje: "title demasiado corto" });
    if (title.length > 50) return res.status(400).json({ mensaje: "title demasiado largo (max 50)" });
    if (!isValidDateOnly(fromDate)) {
      return res.status(400).json({ mensaje: "from_date inválido (YYYY-MM-DD)" });
    }

    conn = await pool.getConnection();
    await conn.beginTransaction();

    const [empRows] = await conn.query("SELECT 1 ok FROM employees WHERE emp_no = ? LIMIT 1", [empNo]);
    if (!empRows.length) {
      await conn.rollback();
      return res.status(404).json({ mensaje: "Empleado no encontrado" });
    }

    const [currentRows] = await conn.query(
      `
      SELECT title, from_date
      FROM titles
      WHERE emp_no = ?
        AND to_date = '9999-01-01'
      ORDER BY from_date DESC
      LIMIT 1
      FOR UPDATE
      `,
      [empNo]
    );

    if (!currentRows.length) {
      await conn.rollback();
      return res.status(404).json({ mensaje: "No se encontró título actual para el empleado" });
    }

    const currentTitle = String(currentRows[0].title || "").trim();
    const currentFrom = toDateOnlyString(currentRows[0].from_date);
    if (fromDate <= currentFrom) {
      await conn.rollback();
      return res.status(400).json({ mensaje: `from_date debe ser mayor a ${currentFrom}` });
    }
    if (title === currentTitle) {
      await conn.rollback();
      return res.status(400).json({ mensaje: "El nuevo título debe ser distinto al actual" });
    }

    const [existsFrom] = await conn.query(
      "SELECT 1 ok FROM titles WHERE emp_no = ? AND from_date = ? LIMIT 1 FOR UPDATE",
      [empNo, fromDate]
    );
    if (existsFrom.length) {
      await conn.rollback();
      return res.status(409).json({ mensaje: "Ya existe un registro de título con esa fecha" });
    }

    await conn.query("UPDATE titles SET to_date = ? WHERE emp_no = ? AND to_date = '9999-01-01'", [
      fromDate,
      empNo
    ]);

    await conn.query(
      "INSERT INTO titles (emp_no, title, from_date, to_date) VALUES (?, ?, ?, '9999-01-01')",
      [empNo, title, fromDate]
    );

    await conn.commit();
    res.status(201).json({
      mensaje: "Ascenso registrado",
      emp_no: empNo,
      title,
      from_date: fromDate
    });
  } catch (err) {
    try {
      if (conn) await conn.rollback();
    } catch {
      // ignore rollback errors
    }
    next(err);
  } finally {
    if (conn) conn.release();
  }
});

// Incidencias por empleado
app.get("/api/employees/:id/incidencias", async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!isValidEmpNo(id)) return res.status(400).json({ mensaje: "ID inválido" });

    const [rows] = await pool.query(
      "SELECT * FROM incidencias_rrhh WHERE emp_no = ? ORDER BY fecha DESC",
      [id]
    );

    res.json(rows);
  } catch (err) {
    next(err);
  }
});

/* ================= DEPARTMENTS ================= */

// Listar y filtrar departamentos (?q=)
app.get("/api/departments", async (req, res, next) => {
  try {
    const q = String(req.query.q || "").trim();

    if (q) {
      const [rows] = await pool.query(
        `
        SELECT d.dept_no, d.dept_name, COUNT(de.emp_no) current_employees
        FROM departments d
        LEFT JOIN dept_emp de
          ON d.dept_no = de.dept_no
          AND de.to_date = '9999-01-01'
        WHERE d.dept_no = ? OR d.dept_name LIKE ?
        GROUP BY d.dept_no, d.dept_name
        ORDER BY d.dept_name
        `,
        [q, `%${q}%`]
      );
      return res.json(rows);
    }

    const [rows] = await pool.query(`
      SELECT d.dept_no, d.dept_name, COUNT(de.emp_no) current_employees
      FROM departments d
      LEFT JOIN dept_emp de
        ON d.dept_no = de.dept_no
        AND de.to_date = '9999-01-01'
      GROUP BY d.dept_no, d.dept_name
      ORDER BY d.dept_name
    `);
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

// Empleados por departamento (asignación actual)
app.get("/api/departments/:dept_no/employees", async (req, res, next) => {
  try {
    const deptNo = String(req.params.dept_no);
    if (!isValidDeptNo(deptNo)) return res.status(400).json({ mensaje: "dept_no inválido (ej: d001)" });

    const limit = parseLimit(req.query.limit, 50);
    const offset = parseOffset(req.query.offset, 0);

    const [[dept]] = await pool.query("SELECT dept_name FROM departments WHERE dept_no = ? LIMIT 1", [deptNo]);
    if (!dept) return res.status(404).json({ mensaje: "Departamento no encontrado" });

    const [[agg]] = await pool.query(
      "SELECT COUNT(*) total FROM dept_emp WHERE dept_no = ? AND to_date = '9999-01-01'",
      [deptNo]
    );
    const total = Number(agg?.total) || 0;

    const [rows] = await pool.query(
      `
      SELECT
        e.emp_no,
        e.first_name,
        e.last_name,
        e.hire_date,
        (
          SELECT t.title
          FROM titles t
          WHERE t.emp_no = e.emp_no
          ORDER BY
            t.from_date DESC
          LIMIT 1
        ) AS current_title,
        (
          SELECT s.salary
          FROM salaries s
          WHERE s.emp_no = e.emp_no
          ORDER BY
            CASE WHEN s.from_date <= CURDATE() AND s.to_date > CURDATE() THEN 0 ELSE 1 END,
            ABS(DATEDIFF(s.to_date, CURDATE())) ASC,
            s.to_date DESC
          LIMIT 1
        ) AS current_salary
      FROM dept_emp de
      JOIN employees e ON e.emp_no = de.emp_no
      WHERE de.dept_no = ?
        AND de.to_date = '9999-01-01'
      ORDER BY e.emp_no
      LIMIT ? OFFSET ?
      `,
      [deptNo, limit, offset]
    );

    res.json({ dept_no: deptNo, dept_name: dept.dept_name, total, offset, limit, rows });
  } catch (err) {
    next(err);
  }
});

app.get("/api/departments/:dept_no/resumen", async (req, res, next) => {
  try {
    const deptNo = String(req.params.dept_no);
    if (!isValidDeptNo(deptNo)) return res.status(400).json({ mensaje: "dept_no inválido (ej: d001)" });

    const [[dept]] = await pool.query("SELECT dept_name FROM departments WHERE dept_no = ? LIMIT 1", [deptNo]);
    if (!dept) return res.status(404).json({ mensaje: "Departamento no encontrado" });

    const [[empAgg]] = await pool.query(
      "SELECT COUNT(*) total FROM dept_emp WHERE dept_no = ? AND to_date = '9999-01-01'",
      [deptNo]
    );
    const totalEmpleados = Number(empAgg?.total) || 0;

    let gerentes = [];
    try {
      const [rows] = await pool.query(
        `
        SELECT e.emp_no, e.first_name, e.last_name
        FROM dept_manager dm
        JOIN employees e ON e.emp_no = dm.emp_no
        WHERE dm.dept_no = ?
          AND dm.to_date = '9999-01-01'
        ORDER BY e.emp_no
        `,
        [deptNo]
      );
      gerentes = rows || [];
    } catch {
      gerentes = [];
    }

    let costoNominaMensual = 0;
    let salarioPromedio = 0;
    try {
      const [[agg]] = await pool.query(
        `
        SELECT SUM(s.salary) sum_salary, AVG(s.salary) avg_salary
        FROM dept_emp de
        JOIN salaries s
          ON s.emp_no = de.emp_no
          AND s.to_date = '9999-01-01'
        WHERE de.dept_no = ?
          AND de.to_date = '9999-01-01'
        `,
        [deptNo]
      );
      const sumSalary = Number(agg?.sum_salary) || 0;
      costoNominaMensual = sumSalary ? sumSalary / 12 : 0;
      salarioPromedio = Number(agg?.avg_salary) || 0;
    } catch {
      costoNominaMensual = 0;
      salarioPromedio = 0;
    }

    let incidenciasMesATD = 0;
    try {
      const [[mtd]] = await pool.query(
        `
        SELECT COUNT(*) total
        FROM incidencias_rrhh i
        JOIN dept_emp de
          ON de.emp_no = i.emp_no
          AND de.to_date = '9999-01-01'
          AND de.dept_no = ?
        WHERE i.fecha >= DATE_FORMAT(CURDATE(), '%Y-%m-01')
          AND i.fecha < DATE_ADD(DATE_FORMAT(CURDATE(), '%Y-%m-01'), INTERVAL 1 MONTH)
        `,
        [deptNo]
      );
      incidenciasMesATD = Number(mtd?.total) || 0;
    } catch {
      incidenciasMesATD = 0;
    }

    let incidenciasRecientes = [];
    try {
      const [rows] = await pool.query(
        `
        SELECT i.*, e.first_name, e.last_name
        FROM incidencias_rrhh i
        LEFT JOIN employees e ON e.emp_no = i.emp_no
        JOIN dept_emp de
          ON de.emp_no = i.emp_no
          AND de.to_date = '9999-01-01'
          AND de.dept_no = ?
        ORDER BY i.fecha DESC
        LIMIT 10
        `,
        [deptNo]
      );
      incidenciasRecientes = rows || [];
    } catch {
      incidenciasRecientes = [];
    }

    let puestos = [];
    try {
      const [rows] = await pool.query(
        `
        SELECT t.title, COUNT(*) total
        FROM titles t
        JOIN dept_emp de
          ON de.emp_no = t.emp_no
          AND de.to_date = '9999-01-01'
        WHERE t.to_date = '9999-01-01'
          AND de.dept_no = ?
        GROUP BY t.title
        ORDER BY total DESC, t.title
        LIMIT 10
        `,
        [deptNo]
      );
      puestos = rows || [];
    } catch {
      puestos = [];
    }

    res.json({
      dept_no: deptNo,
      dept_name: dept.dept_name,
      totalEmpleados,
      totalGerentes: gerentes.length,
      gerentes,
      salarioPromedio,
      costoNominaMensual,
      incidenciasMesATD,
      puestos,
      incidenciasRecientes
    });
  } catch (err) {
    next(err);
  }
});

/* ================= DASHBOARD ================= */

app.get("/api/dashboard/resumen", async (_req, res, next) => {
  try {
    const [[totalEmp]] = await pool.query("SELECT COUNT(*) total FROM employees");
    const [[totalDepts]] = await pool.query("SELECT COUNT(*) total FROM departments");

    let totalGerentes = 0;
    try {
      const [[mgr]] = await pool.query(
        "SELECT COUNT(DISTINCT emp_no) total FROM dept_manager WHERE to_date = '9999-01-01'"
      );
      totalGerentes = Number(mgr?.total) || 0;
    } catch {
      totalGerentes = 0;
    }

    let costoNominaMensual = 0;
    let salarioPromedio = 0;
    try {
      const [[agg]] = await pool.query(
        "SELECT SUM(salary) sum_salary, AVG(salary) avg_salary FROM salaries WHERE to_date = '9999-01-01'"
      );
      const sumSalary = Number(agg?.sum_salary) || 0;
      costoNominaMensual = sumSalary ? sumSalary / 12 : 0;
      salarioPromedio = Number(agg?.avg_salary) || 0;
    } catch {
      costoNominaMensual = 0;
      salarioPromedio = 0;
    }

    let incidenciasMesATD = 0;
    try {
      const [[mtd]] = await pool.query(
        `
        SELECT COUNT(*) total
        FROM incidencias_rrhh
        WHERE fecha >= DATE_FORMAT(CURDATE(), '%Y-%m-01')
          AND fecha < DATE_ADD(DATE_FORMAT(CURDATE(), '%Y-%m-01'), INTERVAL 1 MONTH)
        `
      );
      incidenciasMesATD = Number(mtd?.total) || 0;
    } catch {
      incidenciasMesATD = 0;
    }

    const [porDepto] = await pool.query(`
      SELECT d.dept_no, d.dept_name, COUNT(*) total
      FROM departments d
      JOIN dept_emp de ON d.dept_no = de.dept_no
      WHERE de.to_date = '9999-01-01'
      GROUP BY d.dept_no, d.dept_name
      ORDER BY d.dept_name
    `);

    let headcountPorAnio = [];
    try {
      const [hires] = await pool.query(`
        SELECT YEAR(hire_date) year, COUNT(*) hires
        FROM employees
        GROUP BY YEAR(hire_date)
        ORDER BY YEAR(hire_date)
      `);

      let cumulative = 0;
      headcountPorAnio = (hires || []).map((r) => {
        const hired = Number(r.hires) || 0;
        cumulative += hired;
        return { year: Number(r.year), hires: hired, total: cumulative };
      });
    } catch {
      headcountPorAnio = [];
    }

    let rotacionPorAnio = [];
    try {
      const [seps] = await pool.query(`
        SELECT YEAR(x.last_to_date) year, COUNT(*) separations
        FROM (
          SELECT emp_no, MAX(to_date) last_to_date
          FROM dept_emp
          GROUP BY emp_no
        ) x
        LEFT JOIN dept_emp cur
          ON cur.emp_no = x.emp_no
          AND cur.to_date = '9999-01-01'
        WHERE cur.emp_no IS NULL
          AND x.last_to_date IS NOT NULL
        GROUP BY YEAR(x.last_to_date)
        ORDER BY YEAR(x.last_to_date)
      `);

      const sepMap = new Map((seps || []).map((r) => [Number(r.year), Number(r.separations) || 0]));

      const yearsFromHires = (headcountPorAnio || []).map((r) => Number(r.year)).filter((y) => Number.isFinite(y));
      const yearsFromSeps = (seps || []).map((r) => Number(r.year)).filter((y) => Number.isFinite(y));
      const allYears = [...yearsFromHires, ...yearsFromSeps];

      const minYear = allYears.length ? Math.min(...allYears) : null;
      const maxYear = allYears.length ? Math.max(...allYears) : null;

      const headcountEndMap = new Map();
      if (minYear && maxYear) {
        for (let y = minYear; y <= maxYear; y += 1) {
          const endDate = `${y}-12-31`;
          const [[row]] = await pool.query(
            `
            SELECT COUNT(DISTINCT emp_no) total
            FROM dept_emp
            WHERE from_date <= ?
              AND to_date > ?
            `,
            [endDate, endDate]
          );
          headcountEndMap.set(y, Number(row?.total) || 0);
        }
      }

      rotacionPorAnio =
        minYear && maxYear
          ? Array.from({ length: maxYear - minYear + 1 }, (_, idx) => minYear + idx).map((year) => {
              const separations = sepMap.get(year) || 0;
              const end = headcountEndMap.get(year) || 0;
              const prevEnd = headcountEndMap.get(year - 1) || 0;
              const avg = prevEnd && end ? (prevEnd + end) / 2 : end || prevEnd || 0;
              const turnoverPct = avg ? (separations / avg) * 100 : 0;
              return {
                year,
                separations,
                headcount_avg: Number(avg.toFixed(2)),
                turnover_pct: Number(turnoverPct.toFixed(2))
              };
            })
          : [];
    } catch {
      rotacionPorAnio = [];
    }

    let empleadosPorTitulo = [];
    try {
      const [rows] = await pool.query(`
        SELECT title, COUNT(*) total
        FROM titles
        WHERE to_date = '9999-01-01'
        GROUP BY title
        ORDER BY total DESC, title
        LIMIT 10
      `);
      empleadosPorTitulo = rows || [];
    } catch {
      empleadosPorTitulo = [];
    }

    let gerentesPorDepartamento = [];
    try {
      const [rows] = await pool.query(`
        SELECT d.dept_no, d.dept_name, COUNT(DISTINCT dm.emp_no) total
        FROM departments d
        LEFT JOIN dept_manager dm
          ON d.dept_no = dm.dept_no
          AND dm.to_date = '9999-01-01'
        GROUP BY d.dept_no, d.dept_name
        ORDER BY total DESC, d.dept_name
      `);
      gerentesPorDepartamento = rows || [];
    } catch {
      gerentesPorDepartamento = [];
    }

    let salarioPromedioPorDepartamento = [];
    try {
      const [rows] = await pool.query(`
        SELECT d.dept_no, d.dept_name, AVG(s.salary) avg_salary
        FROM departments d
        JOIN dept_emp de
          ON d.dept_no = de.dept_no
          AND de.to_date = '9999-01-01'
        JOIN salaries s
          ON s.emp_no = de.emp_no
          AND s.to_date = '9999-01-01'
        GROUP BY d.dept_no, d.dept_name
        ORDER BY avg_salary DESC, d.dept_name
      `);
      salarioPromedioPorDepartamento = rows || [];
    } catch {
      salarioPromedioPorDepartamento = [];
    }

    let incidenciasRecientes = [];
    try {
      const [rows] = await pool.query(`
        SELECT
          i.*,
          e.first_name,
          e.last_name,
          d.dept_name
        FROM incidencias_rrhh i
        LEFT JOIN employees e ON e.emp_no = i.emp_no
        LEFT JOIN dept_emp de
          ON de.emp_no = i.emp_no
          AND de.to_date = '9999-01-01'
        LEFT JOIN departments d
          ON d.dept_no = de.dept_no
        ORDER BY i.fecha DESC
        LIMIT 5
      `);
      incidenciasRecientes = rows;
    } catch (_err) {
      incidenciasRecientes = [];
    }

    res.json({
      totalEmpleados: totalEmp.total,
      totalDepartamentos: totalDepts.total,
      totalGerentes,
      costoNominaMensual,
      salarioPromedio,
      incidenciasMesATD,
      empleadosPorDepartamento: porDepto,
      headcountPorAnio,
      rotacionPorAnio,
      empleadosPorTitulo,
      gerentesPorDepartamento,
      salarioPromedioPorDepartamento,
      incidenciasRecientes
    });
  } catch (err) {
    next(err);
  }
});

/* ================= INCIDENCIAS RRHH ================= */

// Listar
app.get("/api/incidencias", async (_req, res, next) => {
  try {
    const [rows] = await pool.query(`
      SELECT
        i.*,
        e.first_name,
        e.last_name,
        d.dept_name
      FROM incidencias_rrhh i
      LEFT JOIN employees e ON e.emp_no = i.emp_no
      LEFT JOIN dept_emp de
        ON de.emp_no = i.emp_no
        AND de.to_date = '9999-01-01'
      LEFT JOIN departments d
        ON d.dept_no = de.dept_no
      ORDER BY i.fecha DESC
    `);
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

// Crear
app.post("/api/incidencias", async (req, res, next) => {
  try {
    const empNo = Number(req.body.emp_no);
    const tipo = String(req.body.tipo || "").trim();
    const descripcion = String(req.body.descripcion || "").trim();
    const estatus = String(req.body.estatus || "abierta").trim();

    if (!isValidEmpNo(empNo)) return res.status(400).json({ mensaje: "emp_no inválido" });
    if (tipo.length < 3) return res.status(400).json({ mensaje: "tipo demasiado corto" });
    if (descripcion.length < 10) return res.status(400).json({ mensaje: "descripción demasiado corta" });
    if (!["abierta", "pendiente", "cerrada"].includes(estatus)) return res.status(400).json({ mensaje: "estatus inválido" });

    const [empRows] = await pool.query("SELECT 1 ok FROM employees WHERE emp_no = ? LIMIT 1", [empNo]);
    if (!empRows.length) return res.status(400).json({ mensaje: "emp_no no existe en employees" });

    const [result] = await pool.query(
      `
      INSERT INTO incidencias_rrhh (emp_no, tipo, fecha, descripcion, estatus)
      VALUES (?, ?, NOW(), ?, ?)
      `,
      [empNo, tipo, descripcion, estatus]
    );

    res.status(201).json({ mensaje: "Incidencia creada", id_incidencia: result.insertId });
  } catch (err) {
    next(err);
  }
});

// Editar
app.put("/api/incidencias/:id", async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ mensaje: "id inválido" });

    const empNo = Number(req.body.emp_no);
    const tipo = String(req.body.tipo || "").trim();
    const descripcion = String(req.body.descripcion || "").trim();
    const estatus = String(req.body.estatus || "").trim();

    if (!isValidEmpNo(empNo)) return res.status(400).json({ mensaje: "emp_no inválido" });
    if (tipo.length < 3) return res.status(400).json({ mensaje: "tipo demasiado corto" });
    if (descripcion.length < 10) return res.status(400).json({ mensaje: "descripción demasiado corta" });
    if (!["abierta", "pendiente", "cerrada"].includes(estatus)) return res.status(400).json({ mensaje: "estatus inválido" });

    const [empRows] = await pool.query("SELECT 1 ok FROM employees WHERE emp_no = ? LIMIT 1", [empNo]);
    if (!empRows.length) return res.status(400).json({ mensaje: "emp_no no existe en employees" });

    const [result] = await pool.query(
      `
      UPDATE incidencias_rrhh
      SET emp_no = ?, tipo = ?, descripcion = ?, estatus = ?
      WHERE id_incidencia = ?
      `,
      [empNo, tipo, descripcion, estatus, id]
    );

    if (result.affectedRows === 0) return res.status(404).json({ mensaje: "Incidencia no encontrada" });
    res.json({ mensaje: "Incidencia actualizada" });
  } catch (err) {
    next(err);
  }
});

// Eliminar
app.delete("/api/incidencias/:id", async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ mensaje: "id inválido" });

    const [result] = await pool.query("DELETE FROM incidencias_rrhh WHERE id_incidencia = ?", [id]);
    if (result.affectedRows === 0) return res.status(404).json({ mensaje: "Incidencia no encontrada" });

    res.json({ mensaje: "Incidencia eliminada" });
  } catch (err) {
    next(err);
  }
});

/* ================= WEATHER (no-key) ================= */

app.get("/api/weather", async (req, res, next) => {
  try {
    const city = String(req.query.city || "Mexico City").trim();
    if (!city) return res.status(400).json({ mensaje: "city requerida" });

    const geoUrl = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1&language=es&format=json`;
    const geoRes = await fetch(geoUrl);
    if (!geoRes.ok) return res.status(502).json({ mensaje: "Error consultando geocoding" });

    const geo = await geoRes.json();
    const place = geo?.results?.[0];
    if (!place) return res.status(404).json({ mensaje: "Ciudad no encontrada" });

    const { latitude, longitude, name, country } = place;

    const wUrl = `https://api.open-meteo.com/v1/forecast?latitude=${encodeURIComponent(latitude)}&longitude=${encodeURIComponent(longitude)}&current=temperature_2m&timezone=auto`;
    const wRes = await fetch(wUrl);
    if (!wRes.ok) return res.status(502).json({ mensaje: "Error consultando clima" });

    const w = await wRes.json();
    const temp = w?.current?.temperature_2m;
    const time = w?.current?.time;

    res.json({
      city: name,
      country,
      temperature_c: temp,
      observed_at: time
    });
  } catch (err) {
    next(err);
  }
});

app.get("/api/health", (_req, res) => res.json({ ok: true }));

app.use((err, _req, res, _next) => {
  console.error(err);
  if (err?.code === "ER_ACCESS_DENIED_ERROR") {
    return res.status(500).json({
      mensaje: "No se pudo conectar a MySQL (acceso denegado).",
      detalle:
        "Configura DB_USER/DB_PASSWORD (por ejemplo en un archivo .env o variables de entorno) y verifica privilegios."
    });
  }
  if (err?.code === "ER_NO_SUCH_TABLE" && String(err?.sqlMessage || "").includes("incidencias_rrhh")) {
    return res.status(500).json({
      mensaje: "La tabla incidencias_rrhh no existe.",
      detalle:
        "Ejecuta el script sql/create_incidencias_rrhh.sql o reinicia el servidor (se intenta crear automaticamente si hay permisos)."
    });
  }
  if (err?.code === "ER_NO_SUCH_TABLE" && String(err?.sqlMessage || "").includes("aumentos_salario_etapas")) {
    return res.status(500).json({
      mensaje: "La tabla aumentos_salario_etapas no existe.",
      detalle:
        "Ejecuta el script sql/create_aumentos_salario_etapas.sql o reinicia el servidor (se intenta crear automaticamente si hay permisos)."
    });
  }
  res.status(500).json({ mensaje: "Error interno", detalle: err?.message });
});

app.listen(PORT, () => {
  console.log(`Servidor activo en http://localhost:${PORT}`);
});
