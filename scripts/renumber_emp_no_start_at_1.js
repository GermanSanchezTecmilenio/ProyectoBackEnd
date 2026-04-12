/* eslint-disable no-console */

const mysql = require("mysql2/promise");

function getEnv(name, fallback) {
  const v = process.env[name];
  return v && String(v).trim().length ? String(v).trim() : fallback;
}

async function main() {
  const host = getEnv("DB_HOST", "localhost");
  const user = getEnv("DB_USER", "root");
  const password = getEnv("DB_PASSWORD", "1234");
  const database = getEnv("DB_NAME", "employees");

  const offset = 1000000;

  console.log("[CONFIG]", { host, user, database, offset });

  const conn = await mysql.createConnection({
    host,
    user,
    password,
    database
  });

  const [beforeRows] = await conn.query(
    "SELECT MIN(emp_no) min_emp, MAX(emp_no) max_emp, COUNT(*) total FROM employees"
  );
  const before = beforeRows[0];

  if (before.min_emp === 1) {
    console.log("[SKIP] employees.emp_no ya inicia en 1");
    await conn.end();
    return;
  }

  console.log("[BEFORE]", before);

  const [fkRows] = await conn.query("SELECT @@FOREIGN_KEY_CHECKS fk");
  const oldFk = fkRows[0]?.fk ? 1 : 0;

  try {
    console.log("[1/8] Ensuring incidencias_rrhh");
    await conn.query(
      "CREATE TABLE IF NOT EXISTS incidencias_rrhh (" +
        "id_incidencia INT NOT NULL AUTO_INCREMENT," +
        "emp_no INT NOT NULL," +
        "tipo VARCHAR(50) NOT NULL," +
        "fecha DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP," +
        "descripcion VARCHAR(255) NOT NULL," +
        "estatus ENUM('abierta','cerrada') NOT NULL DEFAULT 'abierta'," +
        "PRIMARY KEY (id_incidencia)," +
        "INDEX idx_incidencias_emp_no (emp_no)," +
        "INDEX idx_incidencias_fecha (fecha)" +
        ") ENGINE=InnoDB DEFAULT CHARSET=utf8mb4"
    );

    console.log("[2/8] Building mapping emp_no_map_sgrh");
    await conn.query("DROP TABLE IF EXISTS emp_no_map_sgrh");
    await conn.query(
      "CREATE TABLE emp_no_map_sgrh (" +
        "old_emp_no INT NOT NULL," +
        "new_emp_no INT NOT NULL," +
        "PRIMARY KEY (old_emp_no)," +
        "UNIQUE KEY uq_emp_no_map_sgrh_new (new_emp_no)" +
        ") ENGINE=InnoDB"
    );

    await conn.query("SET @rn := 0");
    await conn.query(
      "INSERT INTO emp_no_map_sgrh (old_emp_no, new_emp_no) " +
        "SELECT emp_no, (@rn := @rn + 1) AS new_emp_no " +
        "FROM employees ORDER BY emp_no"
    );

    console.log("[3/8] Disabling FK checks");
    await conn.query("SET FOREIGN_KEY_CHECKS = 0");

    console.log("[4/8] Phase 1 (offset update)");
    await conn.query(
      `UPDATE employees e JOIN emp_no_map_sgrh m ON e.emp_no = m.old_emp_no SET e.emp_no = m.new_emp_no + ${offset}`
    );
    await conn.query(
      `UPDATE dept_emp de JOIN emp_no_map_sgrh m ON de.emp_no = m.old_emp_no SET de.emp_no = m.new_emp_no + ${offset}`
    );
    await conn.query(
      `UPDATE dept_manager dm JOIN emp_no_map_sgrh m ON dm.emp_no = m.old_emp_no SET dm.emp_no = m.new_emp_no + ${offset}`
    );
    await conn.query(
      `UPDATE titles t JOIN emp_no_map_sgrh m ON t.emp_no = m.old_emp_no SET t.emp_no = m.new_emp_no + ${offset}`
    );
    await conn.query(
      `UPDATE salaries s JOIN emp_no_map_sgrh m ON s.emp_no = m.old_emp_no SET s.emp_no = m.new_emp_no + ${offset}`
    );
    await conn.query(
      `UPDATE incidencias_rrhh i JOIN emp_no_map_sgrh m ON i.emp_no = m.old_emp_no SET i.emp_no = m.new_emp_no + ${offset}`
    );

    console.log("[5/8] Phase 2 (remove offset)");
    await conn.query(`UPDATE employees SET emp_no = emp_no - ${offset}`);
    await conn.query(`UPDATE dept_emp SET emp_no = emp_no - ${offset}`);
    await conn.query(`UPDATE dept_manager SET emp_no = emp_no - ${offset}`);
    await conn.query(`UPDATE titles SET emp_no = emp_no - ${offset}`);
    await conn.query(`UPDATE salaries SET emp_no = emp_no - ${offset}`);
    await conn.query(`UPDATE incidencias_rrhh SET emp_no = emp_no - ${offset}`);

    console.log("[6/8] Restoring FK checks");
    await conn.query(`SET FOREIGN_KEY_CHECKS = ${oldFk}`);

    console.log("[7/8] Checks");
    const [afterRows] = await conn.query(
      "SELECT MIN(emp_no) min_emp, MAX(emp_no) max_emp, COUNT(*) total FROM employees"
    );
    console.log("[AFTER]", afterRows[0]);

    const [missDeptEmp] = await conn.query(
      "SELECT COUNT(*) missing FROM dept_emp de LEFT JOIN employees e ON e.emp_no = de.emp_no WHERE e.emp_no IS NULL"
    );
    const [missSalaries] = await conn.query(
      "SELECT COUNT(*) missing FROM salaries s LEFT JOIN employees e ON e.emp_no = s.emp_no WHERE e.emp_no IS NULL"
    );
    const [missTitles] = await conn.query(
      "SELECT COUNT(*) missing FROM titles t LEFT JOIN employees e ON e.emp_no = t.emp_no WHERE e.emp_no IS NULL"
    );

    console.log("[MISSING]", {
      dept_emp: missDeptEmp[0].missing,
      salaries: missSalaries[0].missing,
      titles: missTitles[0].missing
    });

    console.log("[8/8] Done");
  } finally {
    try {
      await conn.query(`SET FOREIGN_KEY_CHECKS = ${oldFk}`);
    } catch {
      // ignore
    }
    await conn.end();
  }
}

main().catch((err) => {
  console.error("[ERROR]", err?.code || err?.message || err);
  process.exit(1);
});

