const flashEl = document.getElementById("flash");
const dateEl = document.getElementById("currentDate");
const weatherEl = document.getElementById("weather");

const tabs = Array.from(document.querySelectorAll(".tab"));
const views = Array.from(document.querySelectorAll(".view"));

const dashboardMetricsEl = document.getElementById("dashboardMetrics");
const dashEmpByDeptEl = document.getElementById("dashEmpByDept");
const dashHeadcountEl = document.getElementById("dashHeadcount");
const dashTurnoverEl = document.getElementById("dashTurnover");
const dashEmpByTitleEl = document.getElementById("dashEmpByTitle");
const dashAvgSalaryByDeptEl = document.getElementById("dashAvgSalaryByDept");
const dashIncidentsRecentEl = document.getElementById("dashIncidentsRecent");
const dashExportBtn = document.getElementById("dashExport");
const dashboardMainEl = document.getElementById("dashboardMain");
const dashboardDetailEl = document.getElementById("dashboardDetail");
const dashDetailBackBtn = document.getElementById("dashDetailBack");
const dashDetailTitleEl = document.getElementById("dashDetailTitle");
const dashDetailSubtitleEl = document.getElementById("dashDetailSubtitle");
const dashDetailContentEl = document.getElementById("dashDetailContent");

const employeeSearchForm = document.getElementById("employeeSearchForm");
const employeeQueryEl = document.getElementById("employeeQuery");
const employeeDeptEl = document.getElementById("employeeDept");
const employeeGenderEl = document.getElementById("employeeGender");
const employeeHireFromEl = document.getElementById("employeeHireFrom");
const employeeHireToEl = document.getElementById("employeeHireTo");
const employeeClearBtn = document.getElementById("employeeClear");
const employeesMetaEl = document.getElementById("employeesMeta");
const employeesItemsEl = document.getElementById("employeesItems");
const empPrevBtn = document.getElementById("empPrev");
const empNextBtn = document.getElementById("empNext");
const empToggleFiltersBtn = document.getElementById("empToggleFilters");
const empExportBtn = document.getElementById("empExport");
const employeesListEl = document.getElementById("employeesList");
const employeeDetailEl = document.getElementById("employeeDetail");

const deptSearchForm = document.getElementById("deptSearchForm");
const deptQueryEl = document.getElementById("deptQuery");
const deptClearBtn = document.getElementById("deptClear");
const deptExportBtn = document.getElementById("deptExport");
const departmentsListEl = document.getElementById("departmentsList");
const departmentDashboardEl = document.getElementById("departmentDashboard");
const departmentDetailEl = document.getElementById("departmentDetail");

const incidenciaForm = document.getElementById("incidenciaForm");
const empNoEl = document.getElementById("emp_no");
const empFullNameEl = document.getElementById("emp_full_name");
const tipoEl = document.getElementById("tipo");
const descripcionEl = document.getElementById("descripcion");
const estatusEl = document.getElementById("estatus");
const incCancelBtn = document.getElementById("incCancel");
const incidenciasListEl = document.getElementById("incidenciasList");
const incExportBtn = document.getElementById("incExport");

let editingIncidenciaId = null;
let dashboardLastData = null;
let departmentsLastRows = [];
let departmentEmployeesLast = { deptNo: "", deptName: "", total: 0, offset: 0, limit: 0, rows: [] };
let selectedDeptNo = "";
let selectedDeptName = "";
let selectedDeptResumen = null;
let deptEmployeesOffset = 0;
const DEPT_EMP_LIMIT = 50;
let deptEmployeesSortState = { key: "emp_no", dir: "asc" };
let incidenciasLastRows = [];

let empFullNameLookupTimer = null;
let empFullNameLookupToken = 0;

function setEmployeeFullName(value) {
  if (!empFullNameEl) return;
  empFullNameEl.value = String(value || "");
}

function clearEmployeeFullName() {
  setEmployeeFullName("");
  if (empNoEl) empNoEl.setCustomValidity("");
}

async function lookupEmployeeFullName(empNo, { reportValidity = false } = {}) {
  if (!empNoEl) return;
  const id = Number(empNo);
  if (!Number.isInteger(id) || id <= 0) {
    clearEmployeeFullName();
    return;
  }

  const token = ++empFullNameLookupToken;
  empNoEl.setCustomValidity("");
  setEmployeeFullName("Buscando...");

  try {
    const emp = await fetchJson(`/api/employees/${encodeURIComponent(id)}`);
    if (token !== empFullNameLookupToken) return;
    const name = `${emp?.first_name || ""} ${emp?.last_name || ""}`.trim();
    setEmployeeFullName(name);
    empNoEl.setCustomValidity(name ? "" : "Empleado no encontrado");
  } catch (err) {
    if (token !== empFullNameLookupToken) return;
    setEmployeeFullName("");
    const msg = String(err?.message || "").toLowerCase();
    if (msg.includes("no encontrado") || msg.includes("invalido") || msg.includes("inválido")) {
      empNoEl.setCustomValidity("Empleado no encontrado");
    } else {
      empNoEl.setCustomValidity("");
    }
  } finally {
    if (reportValidity) empNoEl.reportValidity();
  }
}

function scheduleEmployeeFullNameLookup() {
  if (!empNoEl) return;
  clearTimeout(empFullNameLookupTimer);

  const id = Number(empNoEl.value);
  if (!Number.isInteger(id) || id <= 0) {
    clearEmployeeFullName();
    return;
  }

  empFullNameLookupTimer = setTimeout(() => {
    lookupEmployeeFullName(id);
  }, 250);
}

function setupStickyTabsOffset() {
  const topbar = document.querySelector(".topbar");
  if (!topbar) return;

  const apply = () => {
    const h = Math.ceil(topbar.getBoundingClientRect().height || 0);
    document.documentElement.style.setProperty("--topbar-height", `${h}px`);
  };

  apply();

  if (typeof ResizeObserver !== "undefined") {
    const ro = new ResizeObserver(apply);
    ro.observe(topbar);
  } else {
    window.addEventListener("resize", apply);
  }
}

function clearDynamicTipoOptions() {
  tipoEl.querySelectorAll("option[data-dynamic='true']").forEach((opt) => opt.remove());
}

function ensureTipoOption(value) {
  const v = String(value || "").trim();
  if (!v) return;
  if (Array.from(tipoEl.options).some((opt) => opt.value === v)) return;
  const opt = document.createElement("option");
  opt.value = v;
  opt.textContent = `${v} (Actual)`;
  opt.dataset.dynamic = "true";
  tipoEl.appendChild(opt);
}

function setFlash(message) {
  if (!message) {
    flashEl.hidden = true;
    flashEl.textContent = "";
    return;
  }
  flashEl.hidden = false;
  flashEl.textContent = message;
}

async function fetchJson(url, options = {}) {
  const res = await fetch(url, options);
  const contentType = res.headers.get("content-type") || "";
  const isJson = contentType.includes("application/json");
  const data = isJson ? await res.json() : await res.text();
  if (!res.ok) {
    const msg = isJson ? data?.mensaje || JSON.stringify(data) : String(data);
    throw new Error(msg || "Error");
  }
  return data;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

const DEPT_NAME_ES = new Map([
  ["Customer Service", "Atención al Cliente"],
  ["Development", "Desarrollo"],
  ["Finance", "Finanzas"],
  ["Human Resources", "Recursos Humanos"],
  ["Marketing", "Mercadotecnia"],
  ["Production", "Producción"],
  ["Quality Management", "Gestión de Calidad"],
  ["Research", "Investigación"],
  ["Sales", "Ventas"]
]);

function translateDeptName(value) {
  const key = String(value || "").trim();
  if (!key) return "";
  return DEPT_NAME_ES.get(key) || key;
}

const JOB_TITLE_ES = new Map([
  ["Senior Staff", "Personal Senior"],
  ["Staff", "Personal"],
  ["Senior Engineer", "Ingeniero Senior"],
  ["Engineer", "Ingeniero"],
  ["Technique Leader", "Líder Técnico"],
  ["Assistant Engineer", "Ingeniero Asistente"],
  ["Manager", "Gerente"]
]);

function translateJobTitle(value) {
  const key = String(value || "").trim();
  if (!key) return "";
  return JOB_TITLE_ES.get(key) || key;
}

function showView(viewId) {
  views.forEach((v) => (v.hidden = v.id !== viewId));
  tabs.forEach((t) => t.classList.toggle("is-active", t.dataset.view === viewId));
  setFlash("");
  if (viewId !== "dashboardView") closeDashboardDetail();

  if (empExportBtn) empExportBtn.hidden = viewId !== "employeesView";
  if (deptExportBtn) deptExportBtn.hidden = viewId !== "departmentsView";
  if (incExportBtn) incExportBtn.hidden = viewId !== "incidenciasView";
  if (dashExportBtn) dashExportBtn.hidden = viewId !== "dashboardView";
}

function formatDate(value) {
  try {
    return new Date(value).toLocaleDateString("es-MX", { dateStyle: "medium" });
  } catch {
    return String(value || "");
  }
}

function dateOnly(value) {
  if (!value) return "";
  if (value instanceof Date) {
    const y = value.getFullYear();
    const m = String(value.getMonth() + 1).padStart(2, "0");
    const d = String(value.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
  return String(value).slice(0, 10);
}

function formatToDateActual(value) {
  return dateOnly(value) === "9999-01-01" ? "Actual" : formatDate(value);
}

function formatInt(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "-";
  return new Intl.NumberFormat("es-MX", { maximumFractionDigits: 0 }).format(n);
}

function formatMoney(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "-";
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    maximumFractionDigits: 0
  }).format(n);
}

function formatPct(value, digits = 2) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "-";
  return `${new Intl.NumberFormat("es-MX", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits
  }).format(n)}%`;
}

async function openDepartmentDashboard(deptNo, deptName) {
  const safeDeptNo = String(deptNo || "").trim();
  if (!safeDeptNo) return;

  showView("departmentsView");

  try {
    await Promise.all([loadDepartments(), selectDepartment(safeDeptNo, deptName)]);
  } catch (err) {
    setFlash(String(err?.message || err));
  }
}

function closeDashboardDetail() {
  if (!dashboardMainEl || !dashboardDetailEl) return;
  dashboardDetailEl.hidden = true;
  dashboardMainEl.hidden = false;
  if (dashDetailTitleEl) dashDetailTitleEl.textContent = "";
  if (dashDetailSubtitleEl) dashDetailSubtitleEl.textContent = "";
  if (dashDetailContentEl) dashDetailContentEl.innerHTML = "";
}

function wireDashboardDetailActions(containerEl) {
  if (!containerEl) return;

  containerEl.querySelectorAll("button[data-dept-no]").forEach((btn) => {
    btn.addEventListener("click", () => {
      openDepartmentDashboard(btn.dataset.deptNo, btn.dataset.deptName);
    });
  });

  containerEl.querySelectorAll("button[data-nav-view]").forEach((btn) => {
    btn.addEventListener("click", () => {
      navigateToView(btn.dataset.navView);
    });
  });
}

async function openDashboardDetail(metricKey) {
  if (!dashboardMainEl || !dashboardDetailEl || !dashDetailContentEl || !dashDetailTitleEl) return;

  const key = String(metricKey || "").trim();
  if (!key) return;

  try {
    const data = dashboardLastData || (await fetchJson("/api/dashboard/resumen"));
    dashboardLastData = data;

    const meta =
      {
        employees: {
          title: "Total de empleados",
          subtitle: "Detalle por departamento, puesto y crecimiento de plantilla."
        },
        departments: {
          title: "Departamentos",
          subtitle: "Detalle y acceso rápido al dashboard de cada departamento."
        },
        managers: { title: "Gerentes", subtitle: "Distribución de gerentes activos por departamento." },
        payroll: { title: "Costo mensual de nómina", subtitle: "Estimado con salarios vigentes (monto anual / 12)." },
        avg_salary: { title: "Salario promedio", subtitle: "Comparativo de salario promedio por departamento." },
        headcount: { title: "Ingresos por año", subtitle: "Contrataciones y plantilla acumulada por año." },
        turnover: { title: "Rotación", subtitle: "Porcentaje de rotación de personal por año." },
        incidents: { title: "Incidencias de RRHH", subtitle: "Detalle de incidencias del mes a la fecha." }
      }[key] || { title: "Detalle", subtitle: "" };

    dashDetailTitleEl.textContent = meta.title;
    if (dashDetailSubtitleEl) dashDetailSubtitleEl.textContent = meta.subtitle;

    dashboardMainEl.hidden = true;
    dashboardDetailEl.hidden = false;

    dashDetailContentEl.innerHTML = await renderDashboardDetail(key, data);

    wireDeptChartNavigation(dashDetailContentEl);
    wireDashboardDetailActions(dashDetailContentEl);

    window.scrollTo({ top: 0, behavior: "smooth" });
  } catch (err) {
    setFlash(String(err?.message || err));
  }
}

async function ensureIncidenciasRows() {
  if (Array.isArray(incidenciasLastRows) && incidenciasLastRows.length) return incidenciasLastRows;
  const rows = await fetchJson("/api/incidencias");
  incidenciasLastRows = rows || [];
  return incidenciasLastRows;
}

function renderDeptLinkCell(r, valueKey = "dept_name") {
  const deptNo = String(r?.dept_no || "").trim();
  const deptName = translateDeptName(String(r?.[valueKey] || r?.dept_name || "").trim());
  if (!deptNo) return escapeHtml(deptName || "-");
  return `<button type="button" class="link" data-dept-no="${escapeHtml(deptNo)}" data-dept-name="${escapeHtml(
    deptName
  )}">${escapeHtml(deptName || "-")}</button>`;
}

function renderDashboardDetailEmployees(data) {
  const byDept = Array.isArray(data?.empleadosPorDepartamento) ? data.empleadosPorDepartamento : [];
  const byTitle = Array.isArray(data?.empleadosPorTitulo) ? data.empleadosPorTitulo : [];

  const deptChart = renderVerticalBarChart({
    title: "Empleados por departamento",
    meta: "Clic para ver detalle",
    rows: byDept,
    labelFn: (r) => translateDeptName(r.dept_name),
    valueFn: (r) => r.total,
    valueFormatter: (v) => formatInt(v),
    itemDataFn: (r) => ({ deptNo: r.dept_no, deptName: translateDeptName(r.dept_name) }),
    itemClassFn: () => "is-clickable"
  });

  const deptTable = renderTable({
    columns: [
      { label: "Departamento", html: (r) => renderDeptLinkCell(r) },
      { label: "Empleados", value: (r) => formatInt(r.total) }
    ],
    rows: byDept
  });

  return `
    <div class="detail-actions">
      <button type="button" class="primary" data-nav-view="employeesView">Abrir Empleados</button>
      <button type="button" class="ghost" data-nav-view="departmentsView">Abrir Departamentos</button>
    </div>

    <div class="dash-grid">
      <div class="card span-2">${deptChart}</div>
      <div class="card span-2">${renderLineChart({
        title: "Crecimiento de plantilla en el tiempo",
        rows: data.headcountPorAnio || [],
        xFn: (r) => r.year,
        yFn: (r) => r.total,
        yFormatter: (v) => formatInt(v)
      })}</div>
      <div class="card span-2">${renderHorizontalBarChart({
        title: "Empleados por puesto",
        rows: byTitle,
        labelFn: (r) => translateJobTitle(r.title),
        valueFn: (r) => r.total,
        valueFormatter: (v) => formatInt(v)
      })}</div>
      <div class="card span-2">
        <div class="chart-header"><h3 class="chart-title">Departamentos (tabla)</h3></div>
        ${deptTable}
      </div>
    </div>
  `;
}

function renderDashboardDetailHeadcount(data) {
  const rows = Array.isArray(data?.headcountPorAnio) ? data.headcountPorAnio : [];
  if (!rows.length) return `<div class="muted">Sin datos.</div>`;

  const chart = renderLineChart({
    title: "Crecimiento de plantilla en el tiempo",
    rows,
    xFn: (r) => r.year,
    yFn: (r) => r.total,
    yFormatter: (v) => formatInt(v),
    height: 280
  });

  const table = renderTable({
    columns: [
      { label: "Año", value: (r) => r.year },
      { label: "Ingresos", value: (r) => formatInt(r.hires) },
      { label: "Total", value: (r) => formatInt(r.total) }
    ],
    className: "table-center",
    rows: [...rows].reverse()
  });

  return `
    <div class="dash-grid">
      <div class="card span-4">${chart}</div>
      <div class="card span-4">
        <div class="chart-header"><h3 class="chart-title">Detalle</h3></div>
        ${table}
      </div>
    </div>
  `;
}

function renderDashboardDetailDepartments(data) {
  const byDept = Array.isArray(data?.empleadosPorDepartamento) ? data.empleadosPorDepartamento : [];

  const deptChart = renderVerticalBarChart({
    title: "Empleados por departamento",
    meta: "Clic para ver detalle",
    rows: byDept,
    labelFn: (r) => translateDeptName(r.dept_name),
    valueFn: (r) => r.total,
    valueFormatter: (v) => formatInt(v),
    itemDataFn: (r) => ({ deptNo: r.dept_no, deptName: translateDeptName(r.dept_name) }),
    itemClassFn: () => "is-clickable"
  });

  const deptTable = renderTable({
    columns: [
      { label: "Departamento", html: (r) => renderDeptLinkCell(r) },
      { label: "Empleados", value: (r) => formatInt(r.total) }
    ],
    rows: byDept
  });

  return `
    <div class="detail-actions">
      <button type="button" class="primary" data-nav-view="departmentsView">Abrir Departamentos</button>
    </div>
    <div class="dash-grid">
      <div class="card span-2">${deptChart}</div>
      <div class="card span-2">
        <div class="chart-header"><h3 class="chart-title">Listado de departamentos</h3></div>
        ${deptTable}
      </div>
    </div>
  `;
}

function renderDashboardDetailManagers(data) {
  const rows = Array.isArray(data?.gerentesPorDepartamento) ? data.gerentesPorDepartamento : [];
  const sorted = [...rows].sort((a, b) => {
    const va = Number(a?.total) || 0;
    const vb = Number(b?.total) || 0;
    if (vb !== va) return vb - va;
    return translateDeptName(a?.dept_name || "").localeCompare(translateDeptName(b?.dept_name || ""));
  });

  const chart = renderVerticalBarChart({
    title: "Gerentes por departamento",
    meta: "Clic para ver detalle",
    rows: sorted,
    labelFn: (r) => translateDeptName(r.dept_name),
    valueFn: (r) => r.total,
    valueFormatter: (v) => formatInt(v),
    itemDataFn: (r) => ({ deptNo: r.dept_no, deptName: translateDeptName(r.dept_name) }),
    itemClassFn: () => "is-clickable"
  });

  const table = renderTable({
    columns: [
      { label: "Departamento", html: (r) => renderDeptLinkCell(r) },
      { label: "Gerentes", value: (r) => formatInt(r.total) }
    ],
    rows: sorted
  });

  return `
    <div class="detail-actions">
      <button type="button" class="primary" data-nav-view="departmentsView">Abrir Departamentos</button>
    </div>
    <div class="dash-grid">
      <div class="card span-2">${chart}</div>
      <div class="card span-2">
        <div class="chart-header"><h3 class="chart-title">Detalle (tabla)</h3></div>
        ${table}
      </div>
    </div>
  `;
}

function renderDashboardDetailPayroll(data) {
  const byDept = Array.isArray(data?.empleadosPorDepartamento) ? data.empleadosPorDepartamento : [];
  const bySalary = Array.isArray(data?.salarioPromedioPorDepartamento) ? data.salarioPromedioPorDepartamento : [];

  const counts = new Map(byDept.map((r) => [String(r.dept_no || "").trim(), Number(r.total) || 0]));

  const rows = bySalary
    .map((r) => {
      const deptNo = String(r.dept_no || "").trim();
      const total = counts.get(deptNo) || 0;
      const avg = Number(r.avg_salary) || 0;
      const monthly = total && avg ? (avg * total) / 12 : 0;
      return {
        dept_no: deptNo,
        dept_name: translateDeptName(String(r.dept_name || "")),
        total,
        avg_salary: avg,
        monthly_cost: monthly
      };
    })
    .sort((a, b) => b.monthly_cost - a.monthly_cost);

  const top = rows.slice(0, 8).map((r) => ({ ...r, total: r.monthly_cost }));

  const chart = renderVerticalBarChart({
    title: "Costo mensual estimado (Top 8)",
    meta: "Clic para ver detalle",
    rows: top,
    labelFn: (r) => translateDeptName(r.dept_name),
    valueFn: (r) => r.total,
    valueFormatter: (v) => formatMoney(v),
    itemDataFn: (r) => ({ deptNo: r.dept_no, deptName: translateDeptName(r.dept_name) }),
    itemClassFn: () => "is-clickable"
  });

  const table = renderTable({
    columns: [
      { label: "Departamento", html: (r) => renderDeptLinkCell(r) },
      { label: "Empleados", value: (r) => formatInt(r.total) },
      { label: "Salario promedio", value: (r) => formatMoney(r.avg_salary) },
      { label: "Costo mensual", value: (r) => formatMoney(r.monthly_cost) }
    ],
    rows
  });

  return `
    <div class="detail-actions">
      <button type="button" class="ghost" data-nav-view="departmentsView">Ver por departamento</button>
    </div>

    <div class="dash-grid">
      <div class="card span-2">
        <div class="chart-header"><h3 class="chart-title">Resumen</h3></div>
        <div class="mini-metrics">
          ${renderMiniMetric({ value: formatMoney(data?.costoNominaMensual), label: "Costo mensual" })}
          ${renderMiniMetric({ value: formatMoney(Number(data?.costoNominaMensual || 0) * 12), label: "Costo anual" })}
          ${renderMiniMetric({ value: formatMoney(data?.salarioPromedio), label: "Salario promedio" })}
          ${renderMiniMetric({ value: formatInt(data?.totalEmpleados), label: "Empleados" })}
        </div>
        <div class="muted" style="margin-top:8px">
          Estimado por departamento: <b>salario promedio</b> × <b>empleados</b> / 12.
        </div>
      </div>
      <div class="card span-2">${chart}</div>
      <div class="card span-4">
        <div class="chart-header"><h3 class="chart-title">Nómina estimada por departamento</h3></div>
        ${table}
      </div>
    </div>
  `;
}

function renderDashboardDetailTurnover(data) {
  const rows = Array.isArray(data?.rotacionPorAnio) ? data.rotacionPorAnio : [];
  if (!rows.length) return `<div class="muted">Sin datos.</div>`;

  const chart = renderLineChart({
    title: "Rotación de personal (%) por año",
    rows,
    xFn: (r) => r.year,
    yFn: (r) => r.turnover_pct,
    yFormatter: (v) => formatPct(v, 2),
    height: 260
  });

  const table = renderTable({
    columns: [
      { label: "Año", value: (r) => r.year },
      { label: "Bajas", value: (r) => formatInt(r.separations) },
      { label: "Headcount promedio", value: (r) => formatInt(r.headcount_avg) },
      { label: "% Rotación", value: (r) => formatPct(r.turnover_pct, 2) }
    ],
    className: "table-center",
    rows: [...rows].reverse()
  });

  return `
    <div class="dash-grid">
      <div class="card span-4">${chart}</div>
      <div class="card span-4">
        <div class="chart-header"><h3 class="chart-title">Detalle</h3></div>
        ${table}
      </div>
    </div>
  `;
}

function renderDashboardDetailAvgSalary(data) {
  const rows = Array.isArray(data?.salarioPromedioPorDepartamento) ? data.salarioPromedioPorDepartamento : [];
  const sorted = [...rows].sort((a, b) => {
    const va = Number(a?.avg_salary) || 0;
    const vb = Number(b?.avg_salary) || 0;
    if (vb !== va) return vb - va;
    return translateDeptName(a?.dept_name || "").localeCompare(translateDeptName(b?.dept_name || ""));
  });

  const chart = renderVerticalBarChart({
    title: "Salario por departamento",
    meta: "Clic para ver detalle",
    rows: sorted,
    labelFn: (r) => translateDeptName(r.dept_name),
    valueFn: (r) => r.avg_salary,
    valueFormatter: (v) => formatMoney(v),
    barClass: "is-salary",
    itemDataFn: (r) => ({ deptNo: r.dept_no, deptName: translateDeptName(r.dept_name) }),
    itemClassFn: () => "is-clickable"
  });

  const table = renderTable({
    columns: [
      { label: "Departamento", html: (r) => renderDeptLinkCell(r) },
      { label: "Promedio", value: (r) => formatMoney(r.avg_salary) }
    ],
    rows: sorted
  });

  return `
    <div class="detail-actions">
      <button type="button" class="ghost" data-nav-view="departmentsView">Ver por departamento</button>
    </div>
    <div class="dash-grid">
      <div class="card span-2">${chart}</div>
      <div class="card span-2">
        <div class="chart-header"><h3 class="chart-title">Detalle (tabla)</h3></div>
        ${table}
      </div>
    </div>
  `;
}

async function renderDashboardDetailIncidents() {
  const rows = await ensureIncidenciasRows();
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 1);

  const mtd = (Array.isArray(rows) ? rows : [])
    .filter((r) => {
      const d = new Date(r.fecha);
      if (Number.isNaN(d.getTime())) return false;
      return d >= start && d < end;
    })
    .sort((a, b) => new Date(b.fecha) - new Date(a.fecha));

  const statusCounts = mtd.reduce((acc, r) => {
    const k = String(r.estatus || "-").toLowerCase();
    acc[k] = (acc[k] || 0) + 1;
    return acc;
  }, {});

  const tipoCounts = mtd.reduce((acc, r) => {
    const k = String(r.tipo || "-");
    acc[k] = (acc[k] || 0) + 1;
    return acc;
  }, {});

  const tipoRows = Object.entries(tipoCounts)
    .map(([tipo, total]) => ({ tipo, total }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 10);

  const table = renderTable({
    columns: [
      { label: "ID", value: (r) => r.id_incidencia },
      { label: "No. de Empleado", value: (r) => r.emp_no },
      { label: "Empleado", value: (r) => `${r.first_name || ""} ${r.last_name || ""}`.trim() || "-" },
      { label: "Departamento", value: (r) => translateDeptName(r.dept_name) || "-" },
      { label: "Tipo", value: (r) => r.tipo },
      { label: "Fecha", value: (r) => formatDate(r.fecha) },
      { label: "Estatus", value: (r) => r.estatus },
      { label: "Descripción", value: (r) => r.descripcion }
    ],
    rows: mtd
  });

  return `
    <div class="detail-actions">
      <button type="button" class="primary" data-nav-view="incidenciasView">Abrir Incidencias</button>
    </div>

    <div class="dash-grid">
      <div class="card span-2">
        <div class="chart-header"><h3 class="chart-title">Resumen</h3></div>
        <div class="mini-metrics">
          ${renderMiniMetric({ value: formatInt(mtd.length), label: "Incidencias (MTD)" })}
          ${renderMiniMetric({ value: formatInt(statusCounts.abierta || 0), label: "Abiertas" })}
          ${renderMiniMetric({ value: formatInt(statusCounts.pendiente || 0), label: "Pendientes" })}
          ${renderMiniMetric({ value: formatInt(statusCounts.cerrada || 0), label: "Cerradas" })}
        </div>
      </div>
      <div class="card span-2">
        ${renderHorizontalBarChart({
          title: "Incidencias por tipo (Top 10)",
          rows: tipoRows,
          labelFn: (r) => r.tipo,
          valueFn: (r) => r.total,
          valueFormatter: (v) => formatInt(v)
        })}
      </div>
      <div class="card span-4">
        <div class="chart-header"><h3 class="chart-title">Detalle (Mes a la fecha)</h3></div>
        ${table}
      </div>
    </div>
  `;
}

async function renderDashboardDetail(key, data) {
  if (key === "employees") return renderDashboardDetailEmployees(data);
  if (key === "headcount") return renderDashboardDetailHeadcount(data);
  if (key === "departments") return renderDashboardDetailDepartments(data);
  if (key === "managers") return renderDashboardDetailManagers(data);
  if (key === "payroll") return renderDashboardDetailPayroll(data);
  if (key === "turnover") return renderDashboardDetailTurnover(data);
  if (key === "avg_salary") return renderDashboardDetailAvgSalary(data);
  if (key === "incidents") return await renderDashboardDetailIncidents(data);
  return `<div class="muted">Sin detalle.</div>`;
}

async function loadViewData(viewId) {
  if (viewId === "dashboardView") await loadDashboard();
  if (viewId === "employeesView") await loadEmployees({ offset: 0 });
  if (viewId === "departmentsView") await loadDepartments();
  if (viewId === "incidenciasView") await loadIncidencias();
}

async function navigateToView(viewId) {
  const id = String(viewId || "").trim();
  if (!id) return;
  showView(id);
  try {
    await loadViewData(id);
  } catch (err) {
    setFlash(String(err?.message || err));
  }
}

function wireDeptChartNavigation(containerEl) {
  if (!containerEl) return;

  containerEl.querySelectorAll(".vbar-item.is-clickable[data-dept-no]").forEach((item) => {
    const deptNo = item.dataset.deptNo;
    const deptName = item.dataset.deptName;

    item.addEventListener("click", () => {
      openDepartmentDashboard(deptNo, deptName);
    });

    item.addEventListener("keydown", (e) => {
      if (e.key !== "Enter" && e.key !== " ") return;
      e.preventDefault();
      openDepartmentDashboard(deptNo, deptName);
    });
  });
}

async function loadWeather() {
  try {
    const city = "Mexico City";
    const data = await fetchJson(`/api/weather?city=${encodeURIComponent(city)}`);
    if (typeof data.temperature_c !== "number") {
      weatherEl.textContent = "Clima: --";
      return;
    }
    weatherEl.textContent = `Clima: ${data.temperature_c}°C (${data.city})`;
  } catch {
    weatherEl.textContent = "Clima: --";
  }
}

function renderTable({ columns, rows, actions, className = "" }) {
  if (!rows.length) return `<div class="muted">Sin resultados.</div>`;

  const head = columns
    .map((c) => {
      if (typeof c.headerHtml === "function") return `<th>${c.headerHtml()}</th>`;
      if (typeof c.headerHtml === "string") return `<th>${c.headerHtml}</th>`;
      return `<th>${escapeHtml(c.label)}</th>`;
    })
    .join("");
  const actionHead = actions?.length ? `<th>Acciones</th>` : "";

  const body = rows
    .map((r) => {
      const tds = columns
        .map((c) => {
          if (typeof c.html === "function") return `<td>${c.html(r)}</td>`;
          return `<td>${escapeHtml(c.value(r) ?? "")}</td>`;
        })
        .join("");

      let actionCell = "";
      if (actions?.length) {
        const buttons = actions
          .map((a) => `<button class="btn ${a.kind || ""}" data-action="${a.name}" data-id="${escapeHtml(a.id(r))}">${escapeHtml(a.label)}</button>`)
          .join(" ");
        actionCell = `<td>${buttons}</td>`;
      }

      return `<tr>${tds}${actionCell}</tr>`;
    })
    .join("");

  const extraClass = String(className || "").trim();
  const cls = extraClass ? `table ${extraClass}` : "table";
  return `<table class="${escapeHtml(cls)}"><thead><tr>${head}${actionHead}</tr></thead><tbody>${body}</tbody></table>`;
}

function renderSortHeaderButton({ key, label, state }) {
  const activeKey = state?.key;
  const activeDir = state?.dir === "asc" ? "asc" : "desc";
  const isActive = String(activeKey) === String(key);
  const indicator = isActive ? (activeDir === "asc" ? "▲" : "▼") : "";
  const aria = isActive
    ? `${label}: orden ${activeDir === "asc" ? "ascendente" : "descendente"}`
    : `${label}: sin ordenar`;

  const indicatorHtml = indicator
    ? ` <span class="th-sort-ind">${escapeHtml(indicator)}</span>`
    : "";

  return `<button type="button" class="th-sort ${isActive ? "is-active" : ""}" data-sort-key="${escapeHtml(
    key
  )}" aria-label="${escapeHtml(aria)}">${escapeHtml(label)}${indicatorHtml}</button>`;
}

function compareNullable(a, b, type) {
  const aNil = a === null || a === undefined || a === "";
  const bNil = b === null || b === undefined || b === "";
  if (aNil && bNil) return 0;
  if (aNil) return 1;
  if (bNil) return -1;

  if (type === "number") return Number(a) - Number(b);
  return String(a).localeCompare(String(b), "es", { sensitivity: "base" });
}

function sortRows(rows, columns, state) {
  const safeRows = Array.isArray(rows) ? rows : [];
  const safeColumns = Array.isArray(columns) ? columns : [];
  if (!safeColumns.length) return [...safeRows];

  const activeKey = state?.key;
  const activeDir = state?.dir === "asc" ? "asc" : "desc";
  const column = safeColumns.find((c) => c.key === activeKey) || safeColumns[0];
  const dir = activeDir === "asc" ? 1 : -1;

  return [...safeRows].sort((ra, rb) => {
    const va = column.get(ra);
    const vb = column.get(rb);
    return dir * compareNullable(va, vb, column.type);
  });
}

function renderSortTabs(container, columns, state, onChange) {
  if (!container) return;
  const safeColumns = Array.isArray(columns) ? columns : [];
  if (!safeColumns.length) {
    container.innerHTML = "";
    return;
  }

  const activeKey = state?.key;
  const activeDir = state?.dir === "asc" ? "asc" : "desc";

  container.innerHTML = safeColumns
    .flatMap((c) => {
      const ascActive = activeKey === c.key && activeDir === "asc";
      const descActive = activeKey === c.key && activeDir === "desc";

      return [
        `<button type="button" class="sorttab ${ascActive ? "is-active" : ""}" data-key="${escapeHtml(c.key)}" data-dir="asc" aria-pressed="${ascActive}">${escapeHtml(c.label)} ↑</button>`,
        `<button type="button" class="sorttab ${descActive ? "is-active" : ""}" data-key="${escapeHtml(c.key)}" data-dir="desc" aria-pressed="${descActive}">${escapeHtml(c.label)} ↓</button>`
      ];
    })
    .join("");

  container.querySelectorAll("button[data-key][data-dir]").forEach((btn) => {
    btn.addEventListener("click", () => {
      state.key = btn.dataset.key;
      state.dir = btn.dataset.dir;
      if (typeof onChange === "function") onChange();
    });
  });
}

function renderMetricCard({ value, label, note, metric }) {
  const noteHtml = note ? `<div class="metric-note">${escapeHtml(note)}</div>` : "";
  const metricKey = String(metric || "").trim();
  if (!metricKey) {
    return `
      <div class="card metric">
        <div class="metric-value">${escapeHtml(value)}</div>
        <div class="metric-label">${escapeHtml(label)}</div>
        ${noteHtml}
      </div>
    `;
  }

  return `
    <button type="button" class="card metric metric-btn" data-metric="${escapeHtml(metricKey)}" title="Ver detalle">
      <div class="metric-value">${escapeHtml(value)}</div>
      <div class="metric-label">${escapeHtml(label)}</div>
      ${noteHtml}
    </button>
  `;
}

function renderMiniMetric({ value, label, note }) {
  const noteHtml = note ? `<div class="mini-metric-note">${escapeHtml(note)}</div>` : "";
  return `
    <div class="mini-metric">
      <div class="mini-metric-value">${escapeHtml(value)}</div>
      <div class="mini-metric-label">${escapeHtml(label)}</div>
      ${noteHtml}
    </div>
  `;
}

function wireDashboardCardDetail(cardEl, metricKey, ariaLabel) {
  if (!cardEl) return;
  const key = String(metricKey || "").trim();
  if (!key) return;
  if (cardEl.dataset.wiredDetail === key) return;
  cardEl.dataset.wiredDetail = key;

  cardEl.classList.add("is-clickable");
  cardEl.tabIndex = 0;
  cardEl.setAttribute("role", "button");
  if (ariaLabel) cardEl.setAttribute("aria-label", String(ariaLabel));

  const open = () => openDashboardDetail(key);
  cardEl.addEventListener("click", open);
  cardEl.addEventListener("keydown", (e) => {
    if (e.key !== "Enter" && e.key !== " ") return;
    e.preventDefault();
    open();
  });
}

function toKebabCase(value) {
  return String(value || "")
    .replaceAll("_", "-")
    .replace(/([a-z])([A-Z])/g, "$1-$2")
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "");
}

function renderDataAttributes(data) {
  if (!data || typeof data !== "object") return "";

  return Object.entries(data)
    .filter(([, v]) => v !== undefined && v !== null && String(v).length > 0)
    .map(([k, v]) => {
      const key = toKebabCase(k);
      if (!key) return "";
      return `data-${escapeHtml(key)}="${escapeHtml(v)}"`;
    })
    .filter(Boolean)
    .join(" ");
}

function renderVerticalBarChart({
  title,
  meta,
  rows,
  labelFn,
  valueFn,
  valueFormatter,
  barClass = "",
  itemDataFn,
  itemClassFn
}) {
  const safeRows = Array.isArray(rows) ? rows : [];
  if (!safeRows.length) {
    const metaHtml = meta ? `<div class="chart-meta">${escapeHtml(meta)}</div>` : "";
    return `
      <div class="chart-header"><h3 class="chart-title">${escapeHtml(title)}</h3>${metaHtml}</div>
      <div class="muted">Sin datos.</div>
    `;
  }

  const values = safeRows.map((r) => Number(valueFn(r)) || 0);
  const max = Math.max(...values, 1);

  const items = safeRows.slice(0, 12).map((r) => {
    const label = String(labelFn(r) ?? "");
    const val = Number(valueFn(r)) || 0;
    const pct = Math.max(2, Math.round((val / max) * 100));
    const tip = `${label}: ${valueFormatter ? valueFormatter(val) : String(val)}`;
    const extraClass = itemClassFn ? String(itemClassFn(r) || "").trim() : "";
    const classes = ["vbar-item", extraClass].filter(Boolean).join(" ");
    const barClasses = ["vbar", barClass].filter(Boolean).join(" ");
    const dataAttrs = itemDataFn ? renderDataAttributes(itemDataFn(r)) : "";
    const interactiveAttrs = extraClass.includes("is-clickable") ? `role="button" tabindex="0"` : "";
    return `
      <div class="${escapeHtml(classes)}" ${dataAttrs} ${interactiveAttrs} title="${escapeHtml(tip)}">
        <div class="vbar-area">
          <div class="${escapeHtml(barClasses)}" style="height:${pct}%"></div>
        </div>
        <div class="vbar-label">${escapeHtml(label)}</div>
      </div>
    `;
  });

  const metaHtml = meta ? `<div class="chart-meta">${escapeHtml(meta)}</div>` : "";
  return `
    <div class="chart-header"><h3 class="chart-title">${escapeHtml(title)}</h3>${metaHtml}</div>
    <div class="vchart">${items.join("")}</div>
  `;
}

function renderHorizontalBarChart({ title, rows, labelFn, valueFn, valueFormatter, titleAlign = "left" }) {
  const safeRows = Array.isArray(rows) ? rows : [];
  if (!safeRows.length) {
    const titleClass = titleAlign === "center" ? "chart-title text-center" : "chart-title";
    return `
      <div class="chart-header"><h3 class="${escapeHtml(titleClass)}">${escapeHtml(title)}</h3></div>
      <div class="muted">Sin datos.</div>
    `;
  }

  const values = safeRows.map((r) => Number(valueFn(r)) || 0);
  const max = Math.max(...values, 1);

  const items = safeRows.slice(0, 10).map((r) => {
    const label = String(labelFn(r) ?? "");
    const val = Number(valueFn(r)) || 0;
    const pct = Math.max(2, Math.round((val / max) * 100));
    return `
      <div class="hbar-row" title="${escapeHtml(`${label}: ${valueFormatter ? valueFormatter(val) : val}`)}">
        <div class="hbar-label">${escapeHtml(label)}</div>
        <div class="hbar-track"><div class="hbar-fill" style="width:${pct}%"></div></div>
        <div class="hbar-value">${escapeHtml(valueFormatter ? valueFormatter(val) : String(val))}</div>
      </div>
    `;
  });

  const titleClass = titleAlign === "center" ? "chart-title text-center" : "chart-title";
  return `
    <div class="chart-header"><h3 class="${escapeHtml(titleClass)}">${escapeHtml(title)}</h3></div>
    <div class="hchart">${items.join("")}</div>
  `;
}

function renderLineChart({ title, rows, xFn, yFn, yFormatter, height = 320 }) {
  const safeRows = Array.isArray(rows) ? rows : [];
  if (safeRows.length < 2) {
    return `
      <div class="chart-header"><h3 class="chart-title">${escapeHtml(title)}</h3></div>
      <div class="muted">Sin datos.</div>
    `;
  }

  const xs = safeRows.map((r) => Number(xFn(r)));
  const ys = safeRows.map((r) => Number(yFn(r)) || 0);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = 0;
  const maxY = Math.max(...ys, 1);

  const W = 1000;
  const H = Math.max(220, Number(height) || 320);
  const padL = 40;
  const padR = 16;
  const padT = 16;
  const padB = 36;

  const spanX = Math.max(1, maxX - minX);
  const spanY = Math.max(1, maxY - minY);

  function sx(x) {
    return padL + ((x - minX) / spanX) * (W - padL - padR);
  }
  function sy(y) {
    return padT + (1 - (y - minY) / spanY) * (H - padT - padB);
  }

  const points = safeRows
    .map((r) => {
      const x = Number(xFn(r));
      const y = Number(yFn(r)) || 0;
      return `${sx(x).toFixed(1)},${sy(y).toFixed(1)}`;
    })
    .join(" ");

  const ticks = [minX, Math.round((minX + maxX) / 2), maxX].filter((v, idx, arr) => arr.indexOf(v) === idx);
  const tickLabels = ticks.map((t) => `<span>${escapeHtml(t)}</span>`).join("");

  const lastY = ys[ys.length - 1];
  const lastText = yFormatter ? yFormatter(lastY) : String(lastY);

  return `
    <div class="chart-header">
      <h3 class="chart-title">${escapeHtml(title)}</h3>
      <div class="muted">Actual: <b>${escapeHtml(lastText)}</b></div>
    </div>
    <div class="linechart">
      <svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${escapeHtml(title)}">
        <polyline class="linechart-grid" points="${padL},${sy(maxY)} ${W - padR},${sy(maxY)}" />
        <polyline class="linechart-grid" points="${padL},${sy(maxY * 0.75)} ${W - padR},${sy(maxY * 0.75)}" />
        <polyline class="linechart-grid" points="${padL},${sy(maxY * 0.5)} ${W - padR},${sy(maxY * 0.5)}" />
        <polyline class="linechart-grid" points="${padL},${sy(maxY * 0.25)} ${W - padR},${sy(maxY * 0.25)}" />
        <polyline class="linechart-grid" points="${padL},${sy(0)} ${W - padR},${sy(0)}" />
        <polyline class="linechart-line" points="${points}" />
      </svg>
      <div class="linechart-axis">${tickLabels}</div>
    </div>
  `;
}

async function loadDashboard() {
  closeDashboardDetail();
  const data = await fetchJson("/api/dashboard/resumen");
  dashboardLastData = data;

  const rotacionRows = Array.isArray(data.rotacionPorAnio) ? data.rotacionPorAnio : [];
  const rotacionLast = rotacionRows.length ? rotacionRows[rotacionRows.length - 1] : null;

  dashboardMetricsEl.innerHTML = [
    renderMetricCard({ metric: "employees", value: formatInt(data.totalEmpleados), label: "Total de empleados" }),
    renderMetricCard({
      metric: "payroll",
      value: formatMoney(data.costoNominaMensual),
      label: "Costo mensual de nómina"
    }),
    renderMetricCard({ metric: "avg_salary", value: formatMoney(data.salarioPromedio), label: "Salario promedio" }),
    renderMetricCard({
      metric: "turnover",
      value: rotacionLast ? formatPct(rotacionLast.turnover_pct, 2) : "-",
      label: "Rotación",
      note: rotacionLast?.year ? `Año ${rotacionLast.year}` : ""
    }),
    renderMetricCard({
      metric: "incidents",
      value: formatInt(data.incidenciasMesATD),
      label: "Incidencias de RRHH",
      note: "(Mes a la fecha)"
    })
  ].join("");

  dashboardMetricsEl.querySelectorAll("button.metric-btn[data-metric]").forEach((btn) => {
    btn.addEventListener("click", () => openDashboardDetail(btn.dataset.metric));
  });

  dashEmpByDeptEl.innerHTML = renderVerticalBarChart({
    title: "Empleados por departamento",
    meta: "Clic para ver detalle",
    rows: data.empleadosPorDepartamento || [],
    labelFn: (r) => translateDeptName(r.dept_name),
    valueFn: (r) => r.total,
    valueFormatter: (v) => formatInt(v),
    itemDataFn: (r) => ({ deptNo: r.dept_no, deptName: translateDeptName(r.dept_name) }),
    itemClassFn: () => "is-clickable"
  });
  wireDeptChartNavigation(dashEmpByDeptEl);

  dashHeadcountEl.innerHTML = renderLineChart({
    title: "Crecimiento de plantilla en el tiempo",
    rows: data.headcountPorAnio || [],
    xFn: (r) => r.year,
    yFn: (r) => r.total,
    yFormatter: (v) => formatInt(v)
  });
  wireDashboardCardDetail(dashHeadcountEl, "headcount", "Ver detalle de ingresos por año");

  if (dashTurnoverEl) {
    if (!rotacionRows.length) {
      dashTurnoverEl.innerHTML = `
        <div class="chart-header"><h3 class="chart-title">Rotación de personal (%) por año</h3></div>
        <div class="muted">Sin datos.</div>
      `;
    } else {
      const lastYears = rotacionRows.slice(-6).reverse();
      dashTurnoverEl.innerHTML = `
        ${renderLineChart({
          title: "Rotación de personal (%) por año",
          rows: rotacionRows,
          xFn: (r) => r.year,
          yFn: (r) => r.turnover_pct,
          yFormatter: (v) => formatPct(v, 2),
          height: 240
        })}
        <div style="height:10px"></div>
        ${renderTable({
          columns: [
            { label: "Año", value: (r) => r.year },
            { label: "Bajas", value: (r) => formatInt(r.separations) },
            { label: "% Rotación", value: (r) => formatPct(r.turnover_pct, 2) }
          ],
          className: "table-center",
          rows: lastYears
        })}
      `;
    }
  }

  dashEmpByTitleEl.innerHTML = renderHorizontalBarChart({
    title: "Empleados por puesto",
    rows: data.empleadosPorTitulo || [],
    labelFn: (r) => translateJobTitle(r.title),
    valueFn: (r) => r.total,
    valueFormatter: (v) => formatInt(v)
  });

  dashAvgSalaryByDeptEl.innerHTML = renderVerticalBarChart({
    title: "Salario por departamento",
    meta: "Clic para ver detalle",
    rows: data.salarioPromedioPorDepartamento || [],
    labelFn: (r) => translateDeptName(r.dept_name),
    valueFn: (r) => r.avg_salary,
    valueFormatter: (v) => formatMoney(v),
    barClass: "is-salary",
    itemDataFn: (r) => ({ deptNo: r.dept_no, deptName: translateDeptName(r.dept_name) }),
    itemClassFn: () => "is-clickable"
  });
  wireDeptChartNavigation(dashAvgSalaryByDeptEl);

  dashIncidentsRecentEl.innerHTML = `
    <div class="chart-header"><h3 class="chart-title">Incidencias recientes</h3></div>
    ${renderTable({
      columns: [
        {
          label: "Empleado",
          html: (r) => {
            const name = `${r.first_name || ""} ${r.last_name || ""}`.trim() || "-";
            return `<div style="font-weight:600">#${escapeHtml(r.emp_no)}</div><div class="muted">${escapeHtml(name)}</div>`;
          }
        },
        { label: "Departamento", value: (r) => translateDeptName(r.dept_name) || "-" },
        { label: "Tipo", value: (r) => r.tipo },
        { label: "Fecha", value: (r) => formatDate(r.fecha) },
        { label: "Estatus", value: (r) => r.estatus }
      ],
      rows: data.incidenciasRecientes || []
    })}
  `;
}

const EMP_LIMIT = 50;
let employeeOffset = 0;
let employeeTotal = 0;
let employeeLastRows = [];
let employeeSortState = { key: "emp_no", dir: "asc" };

async function ensureEmployeeDeptOptions() {
  if (employeeDeptEl.options.length > 0) return;

  const rows = await fetchJson("/api/departments");
  employeeDeptEl.innerHTML = [
    `<option value="">Todos</option>`,
    ...rows.map(
      (d) => `<option value="${escapeHtml(d.dept_no)}">${escapeHtml(translateDeptName(d.dept_name))}</option>`
    )
  ].join("");
}

function getEmployeeFilters() {
  const q = employeeQueryEl.value.trim();
  const dept_no = employeeDeptEl.value;
  const gender = employeeGenderEl.value;
  const hire_from = employeeHireFromEl.value;
  const hire_to = employeeHireToEl.value;

  return { q, dept_no, gender, hire_from, hire_to };
}

function updateEmployeesMeta({ total, offset, limit, count }) {
  const from = total === 0 ? 0 : offset + 1;
  const to = total === 0 ? 0 : Math.min(offset + count, total);

  employeesMetaEl.textContent = total ? `Total: ${formatInt(total)}` : "";
  employeesItemsEl.textContent = total ? `${from}-${to} de ${total}` : "Sin resultados";

  empPrevBtn.disabled = offset <= 0;
  empNextBtn.disabled = offset + limit >= total;
}

function downloadCsv(filename, rows) {
  if (!rows.length) return;

  const header = Object.keys(rows[0]);
  const csv = [
    header.join(","),
    ...rows.map((r) =>
      header
        .map((h) => {
          const v = r[h] ?? "";
          const s = String(v).replaceAll('"', '""');
          return `"${s}"`;
        })
        .join(",")
    )
  ].join("\n");

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function renderExcelTable(rows) {
  if (!rows.length) return `<div>Sin datos</div>`;

  const headers = Object.keys(rows[0]);
  const thead = `<thead><tr>${headers.map((h) => `<th>${escapeHtml(h)}</th>`).join("")}</tr></thead>`;
  const tbody = `<tbody>${rows
    .map((r) => `<tr>${headers.map((h) => `<td>${escapeHtml(r[h] ?? "")}</td>`).join("")}</tr>`)
    .join("")}</tbody>`;

  return `<table>${thead}${tbody}</table>`;
}

function downloadExcel(filename, sections) {
  const safeFilename = String(filename || "export.xls").toLowerCase().endsWith(".xls")
    ? String(filename || "export.xls")
    : `${String(filename || "export")}.xls`;

  const safeSections = Array.isArray(sections) ? sections : [];
  const content = safeSections
    .map((s) => {
      const title = s?.title ? `<h3>${escapeHtml(s.title)}</h3>` : "";
      const rows = Array.isArray(s?.rows) ? s.rows : [];
      return `${title}${renderExcelTable(rows)}`;
    })
    .join("<br/>");

  if (!content) return;

  const html = `
    <!doctype html>
    <html lang="es">
      <head>
        <meta charset="UTF-8" />
        <style>
          body { font-family: Segoe UI, Arial, sans-serif; font-size: 12px; }
          table { border-collapse: collapse; width: 100%; }
          th, td { border: 1px solid #999; padding: 4px 6px; vertical-align: top; }
          th { background: #f2f2f2; font-weight: 700; }
          h3 { margin: 8px 0 6px; }
        </style>
      </head>
      <body>${content}</body>
    </html>
  `.trim();

  const blob = new Blob([`\ufeff${html}`], { type: "application/vnd.ms-excel;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = safeFilename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

async function loadEmployees({ offset = 0 } = {}) {
  await ensureEmployeeDeptOptions();

  const filters = getEmployeeFilters();
  const params = new URLSearchParams();
  if (filters.q) params.set("q", filters.q);
  if (filters.dept_no) params.set("dept_no", filters.dept_no);
  if (filters.gender) params.set("gender", filters.gender);
  if (filters.hire_from) params.set("hire_from", filters.hire_from);
  if (filters.hire_to) params.set("hire_to", filters.hire_to);
  if (employeeSortState?.key) params.set("sort_by", employeeSortState.key);
  if (employeeSortState?.dir) params.set("sort_dir", employeeSortState.dir);
  params.set("limit", String(EMP_LIMIT));
  params.set("offset", String(offset));

  const data = await fetchJson(`/api/employees?${params.toString()}`);
  const rows = data.rows || [];

  employeeOffset = data.offset ?? offset;
  employeeTotal = data.total ?? rows.length;
  employeeLastRows = rows;

  employeesListEl.innerHTML = renderTable({
    columns: [
      {
        headerHtml: renderSortHeaderButton({ key: "status", label: "Estado", state: employeeSortState }),
        html: (r) => {
          const active = Number(r.is_active) === 1;
          return `<span class="status-dot ${active ? "is-active" : "is-inactive"}" title="${active ? "Activo" : "Inactivo"}"></span>`;
        }
      },
      {
        headerHtml: renderSortHeaderButton({ key: "emp_no", label: "No. empleado", state: employeeSortState }),
        html: (r) =>
          `<button type="button" class="link" data-emp="${escapeHtml(r.emp_no)}">${escapeHtml(r.emp_no)}</button>`
      },
      {
        headerHtml: renderSortHeaderButton({ key: "first_name", label: "Nombre", state: employeeSortState }),
        value: (r) => r.first_name
      },
      {
        headerHtml: renderSortHeaderButton({ key: "last_name", label: "Apellido", state: employeeSortState }),
        value: (r) => r.last_name
      },
      {
        headerHtml: renderSortHeaderButton({ key: "gender", label: "Género", state: employeeSortState }),
        value: (r) => r.gender
      },
      {
        headerHtml: renderSortHeaderButton({ key: "hire_date", label: "Fecha ingreso", state: employeeSortState }),
        value: (r) => formatDate(r.hire_date)
      },
      {
        headerHtml: renderSortHeaderButton({ key: "dept_name", label: "Nombre depto", state: employeeSortState }),
        value: (r) => translateDeptName(r.dept_name) || "-"
      }
    ],
    rows
  });

  employeesListEl.querySelectorAll("button.th-sort[data-sort-key]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const key = String(btn.dataset.sortKey || "").trim();
      if (!key) return;

      if (employeeSortState.key === key) {
        employeeSortState.dir = employeeSortState.dir === "asc" ? "desc" : "asc";
      } else {
        employeeSortState.key = key;
        employeeSortState.dir = "asc";
      }

      try {
        await loadEmployees({ offset: 0 });
      } catch (err) {
        setFlash(String(err?.message || err));
      }
    });
  });

  const tbody = employeesListEl.querySelector("table.table tbody");
  if (tbody) {
    tbody.querySelectorAll("tr").forEach((tr) => {
      const btn = tr.querySelector("button[data-emp]");
      const emp = btn?.dataset?.emp;
      if (!emp) return;
      tr.dataset.emp = emp;
      tr.classList.add("is-clickable");
    });

    tbody.addEventListener("click", async (e) => {
      const tr = e.target.closest("tr[data-emp]");
      const emp = tr?.dataset?.emp;
      if (!tr || !emp) return;

      try {
        await loadEmployeeDetail(emp);
        tbody.querySelectorAll("tr").forEach((r) => r.classList.remove("is-selected"));
        tr.classList.add("is-selected");
      } catch (err) {
        setFlash(String(err?.message || err));
      }
    });
  }

  updateEmployeesMeta({ total: employeeTotal, offset: employeeOffset, limit: EMP_LIMIT, count: rows.length });
}

async function loadEmployeeDetail(empNo) {
  const [emp, hist] = await Promise.all([
    fetchJson(`/api/employees/${encodeURIComponent(empNo)}`),
    fetchJson(`/api/employees/${encodeURIComponent(empNo)}/historial`)
  ]);

  const titles = Array.isArray(hist.titles) ? hist.titles : [];
  const salaries = Array.isArray(hist.salaries) ? hist.salaries : [];
  const currentTitleRow = titles.find((t) => dateOnly(t.to_date) === "9999-01-01") || titles[0];
  const currentSalaryRow = salaries.find((s) => dateOnly(s.to_date) === "9999-01-01") || salaries[0];
  const currentTitle = currentTitleRow?.title || "-";
  const currentSalary = currentSalaryRow?.salary ?? "-";

  employeeDetailEl.innerHTML = `
    <div style="display:flex;gap:10px;flex-wrap:wrap;align-items:center">
      <div class="widget"><b>No. empleado:</b> ${escapeHtml(emp.emp_no)}</div>
      <div class="widget"><b>Nombre:</b> ${escapeHtml(emp.first_name)} ${escapeHtml(emp.last_name)}</div>
      <div class="widget"><b>Departamento:</b> ${escapeHtml(translateDeptName(emp.dept_name) || "-")}</div>
      <div class="widget"><b>Ingreso:</b> ${escapeHtml(formatDate(emp.hire_date))}</div>
      <div class="widget"><b>Puesto:</b> ${escapeHtml(currentTitle)}</div>
      <div class="widget"><b>Salario:</b> ${escapeHtml(currentSalary)}</div>
    </div>

    <div style="height:10px"></div>
    <h4 style="margin:0 0 8px">Promociones</h4>
    <div id="titlesTable"></div>

    <div style="height:10px"></div>
    <h4 style="margin:0 0 8px">Ajuste Salarial</h4>
    <div id="salariesTable"></div>
  `;

  const titlesTableEl = employeeDetailEl.querySelector("#titlesTable");
  const salariesTableEl = employeeDetailEl.querySelector("#salariesTable");

  const titlesSortColumns = [
    { key: "title", type: "string", get: (r) => r.title },
    { key: "from_date", type: "date", get: (r) => dateOnly(r.from_date) },
    { key: "to_date", type: "date", get: (r) => dateOnly(r.to_date) }
  ];
  const salariesSortColumns = [
    { key: "salary", type: "number", get: (r) => Number(r.salary) },
    { key: "from_date", type: "date", get: (r) => dateOnly(r.from_date) },
    { key: "to_date", type: "date", get: (r) => dateOnly(r.to_date) }
  ];

  const titlesSortState = { key: "from_date", dir: "desc" };
  const salariesSortState = { key: "from_date", dir: "desc" };

  function wireSortableHeaders(container, state, onRender) {
    container.querySelectorAll("button.th-sort[data-sort-key]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const key = String(btn.dataset.sortKey || "").trim();
        if (!key) return;

        if (state.key === key) state.dir = state.dir === "asc" ? "desc" : "asc";
        else {
          state.key = key;
          state.dir = "asc";
        }
        onRender();
      });
    });
  }

  function renderTitlesTable() {
    const rows = sortRows(titles, titlesSortColumns, titlesSortState);
    titlesTableEl.innerHTML = renderTable({
      columns: [
        {
          headerHtml: renderSortHeaderButton({ key: "title", label: "Puesto", state: titlesSortState }),
          value: (r) => r.title
        },
        {
          headerHtml: renderSortHeaderButton({ key: "from_date", label: "Desde", state: titlesSortState }),
          value: (r) => formatDate(r.from_date)
        },
        {
          headerHtml: renderSortHeaderButton({ key: "to_date", label: "Hasta", state: titlesSortState }),
          value: (r) => formatToDateActual(r.to_date)
        }
      ],
      rows
    });

    wireSortableHeaders(titlesTableEl, titlesSortState, renderTitlesTable);
  }

  function renderSalariesTable() {
    const rows = sortRows(salaries, salariesSortColumns, salariesSortState);
    salariesTableEl.innerHTML = renderTable({
      columns: [
        {
          headerHtml: renderSortHeaderButton({ key: "salary", label: "Salario", state: salariesSortState }),
          value: (r) => r.salary
        },
        {
          headerHtml: renderSortHeaderButton({ key: "from_date", label: "Desde", state: salariesSortState }),
          value: (r) => formatDate(r.from_date)
        },
        {
          headerHtml: renderSortHeaderButton({ key: "to_date", label: "Hasta", state: salariesSortState }),
          value: (r) => formatToDateActual(r.to_date)
        }
      ],
      rows
    });

    wireSortableHeaders(salariesTableEl, salariesSortState, renderSalariesTable);
  }

  renderTitlesTable();
  renderSalariesTable();
}

async function loadDepartments(query = "") {
  const q = String(query || "").trim();
  const rows = await fetchJson(q ? `/api/departments?q=${encodeURIComponent(q)}` : "/api/departments");
  departmentsLastRows = rows || [];

  departmentsListEl.innerHTML = renderTable({
    columns: [
      {
        label: "Departamento",
        html: (r) => {
          const deptNo = String(r.dept_no || "");
          const deptName = translateDeptName(String(r.dept_name || ""));
          const isSelected = deptNo && deptNo === selectedDeptNo;
          return `
            <button
              type="button"
              class="dept-open ${isSelected ? "is-selected" : ""}"
              data-dept="${escapeHtml(deptNo)}"
              data-dept-name="${escapeHtml(deptName)}"
            >
              ${escapeHtml(deptName)}
            </button>
          `;
        }
      },
      { label: "Empleados", value: (r) => formatInt(r.current_employees) }
    ],
    rows
  });

  departmentsListEl.querySelectorAll("button.dept-open[data-dept]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      await selectDepartment(btn.dataset.dept, btn.dataset.deptName);
    });
  });

  highlightSelectedDepartment();
}

function highlightSelectedDepartment() {
  departmentsListEl.querySelectorAll("tr").forEach((tr) => tr.classList.remove("is-selected"));

  if (!selectedDeptNo) return;

  departmentsListEl.querySelectorAll("button.dept-open[data-dept]").forEach((btn) => {
    const isSelected = btn.dataset.dept === selectedDeptNo;
    btn.classList.toggle("is-selected", isSelected);
    const tr = btn.closest("tr");
    if (tr) tr.classList.toggle("is-selected", isSelected);
  });
}

async function selectDepartment(deptNo, deptName) {
  const safeDeptNo = String(deptNo || "").trim();
  if (!safeDeptNo) return;

  selectedDeptNo = safeDeptNo;
  selectedDeptName = translateDeptName(String(deptName || "").trim());
  deptEmployeesOffset = 0;

  highlightSelectedDepartment();
  await loadDepartmentDashboard();
}

function renderDeptEmployeesTable(rows) {
  const safeRows = Array.isArray(rows) ? rows : [];
  const sortColumns = [
    { key: "emp_no", type: "number", get: (r) => Number(r.emp_no) },
    {
      key: "employee",
      type: "string",
      get: (r) => `${String(r.last_name || "").trim()} ${String(r.first_name || "").trim()}`.trim()
    },
    { key: "current_title", type: "string", get: (r) => translateJobTitle(r.current_title) },
    { key: "hire_date", type: "string", get: (r) => dateOnly(r.hire_date) },
    { key: "current_salary", type: "number", get: (r) => Number(r.current_salary) }
  ];
  const sortedRows = sortRows(safeRows, sortColumns, deptEmployeesSortState);

  return renderTable({
    columns: [
      {
        headerHtml: renderSortHeaderButton({ key: "emp_no", label: "No. de Empleado", state: deptEmployeesSortState }),
        value: (r) => r.emp_no
      },
      {
        headerHtml: renderSortHeaderButton({ key: "employee", label: "Empleado", state: deptEmployeesSortState }),
        value: (r) => `${r.first_name} ${r.last_name}`.trim()
      },
      {
        headerHtml: renderSortHeaderButton({ key: "current_title", label: "Puesto", state: deptEmployeesSortState }),
        value: (r) => translateJobTitle(r.current_title) || "-"
      },
      {
        headerHtml: renderSortHeaderButton({
          key: "hire_date",
          label: "Fecha de Ingreso",
          state: deptEmployeesSortState
        }),
        value: (r) => formatDate(r.hire_date)
      },
      {
        headerHtml: renderSortHeaderButton({
          key: "current_salary",
          label: "Salario actual",
          state: deptEmployeesSortState
        }),
        value: (r) => formatMoney(r.current_salary)
      }
    ],
    rows: sortedRows
  });
}

function wireDeptEmployeesSort(containerEl, rows) {
  if (!containerEl) return;
  const sourceRows = Array.isArray(rows) ? rows : [];
  containerEl.querySelectorAll("button.th-sort[data-sort-key]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const key = String(btn.dataset.sortKey || "").trim();
      if (!key) return;

      if (deptEmployeesSortState.key === key) {
        deptEmployeesSortState.dir = deptEmployeesSortState.dir === "asc" ? "desc" : "asc";
      } else {
        deptEmployeesSortState.key = key;
        deptEmployeesSortState.dir = "asc";
      }

      containerEl.innerHTML = renderDeptEmployeesTable(sourceRows);
      wireDeptEmployeesSort(containerEl, sourceRows);
    });
  });
}

function updateDeptEmployeesMeta({ total, offset, limit, count }) {
  const metaEl = departmentDetailEl?.querySelector("#deptEmployeesMeta");
  const prevBtn = departmentDetailEl?.querySelector("#deptEmpPrev");
  const nextBtn = departmentDetailEl?.querySelector("#deptEmpNext");

  if (!metaEl || !prevBtn || !nextBtn) return;

  const from = total === 0 ? 0 : offset + 1;
  const to = total === 0 ? 0 : Math.min(offset + count, total);

  metaEl.textContent = total ? `${from}-${to} de ${total} empleados` : "Sin resultados";
  prevBtn.disabled = offset <= 0;
  nextBtn.disabled = offset + limit >= total;
}

async function loadDepartmentDashboard() {
  if (!selectedDeptNo) {
    if (departmentDashboardEl) {
      departmentDashboardEl.innerHTML = `<div class="muted">Selecciona un departamento.</div>`;
    }
    if (departmentDetailEl) {
      departmentDetailEl.innerHTML = `<div class="muted">Selecciona un departamento.</div>`;
    }
    return;
  }

  if (departmentDashboardEl) {
    departmentDashboardEl.innerHTML = `<div class="muted">Cargando información del departamento…</div>`;
  }
  if (departmentDetailEl) {
    departmentDetailEl.innerHTML = `<div class="muted">Cargando detalle del departamento…</div>`;
  }

  try {
    const [resumen, empData] = await Promise.all([
      fetchJson(`/api/departments/${encodeURIComponent(selectedDeptNo)}/resumen`),
      fetchJson(
        `/api/departments/${encodeURIComponent(selectedDeptNo)}/employees?limit=${encodeURIComponent(
          DEPT_EMP_LIMIT
        )}&offset=${encodeURIComponent(deptEmployeesOffset)}`
      )
    ]);

    selectedDeptResumen = resumen;
    selectedDeptName = translateDeptName(String(resumen?.dept_name || selectedDeptName || "").trim());

    departmentEmployeesLast = {
      deptNo: selectedDeptNo,
      deptName: selectedDeptName,
      total: Number(empData?.total) || 0,
      offset: Number(empData?.offset) || 0,
      limit: Number(empData?.limit) || DEPT_EMP_LIMIT,
      rows: Array.isArray(empData?.rows) ? empData.rows : []
    };

    const mgrNames = Array.isArray(resumen?.gerentes)
      ? resumen.gerentes
          .map((g) => `${String(g.first_name || "").trim()} ${String(g.last_name || "").trim()}`.trim())
          .filter(Boolean)
          .join(", ")
      : "";

    const puestosChart = renderHorizontalBarChart({
      title: "Puestos",
      titleAlign: "center",
      rows: resumen?.puestos || [],
      labelFn: (r) => translateJobTitle(r.title),
      valueFn: (r) => r.total,
      valueFormatter: (v) => formatInt(v)
    });

    const incidenciasHtml = renderTable({
      columns: [
        { label: "ID", value: (r) => r.id_incidencia },
        { label: "No. de Empleado", value: (r) => r.emp_no },
        { label: "Empleado", value: (r) => `${r.first_name || ""} ${r.last_name || ""}`.trim() || "-" },
        { label: "Tipo", value: (r) => r.tipo },
        { label: "Fecha", value: (r) => formatDate(r.fecha) },
        { label: "Estatus", value: (r) => r.estatus }
      ],
      rows: resumen?.incidenciasRecientes || []
    });

    if (departmentDashboardEl) {
      departmentDashboardEl.innerHTML = `
        <div class="dept-dashboard">
          <div>
            <div class="dept-name">${escapeHtml(selectedDeptName || "-")}</div>
            <div class="muted dept-sub">
              ${escapeHtml(formatInt(resumen?.totalEmpleados))} empleados &bull; ${escapeHtml(formatInt(resumen?.totalGerentes))} gerentes
            </div>
            ${mgrNames ? `<div class="muted dept-sub">Gerente(s): ${escapeHtml(mgrNames)}</div>` : ""}
          </div>

          <div class="mini-metrics">
            ${renderMiniMetric({ value: formatInt(resumen?.totalEmpleados), label: "Empleados" })}
            ${renderMiniMetric({ value: formatInt(resumen?.totalGerentes), label: "Gerentes" })}
            ${renderMiniMetric({ value: formatMoney(resumen?.salarioPromedio), label: "Salario promedio" })}
            ${renderMiniMetric({
              value: formatInt(resumen?.incidenciasMesATD),
              label: "Incidencias",
              note: "(Mes a la fecha)"
            })}
          </div>

          ${puestosChart}
        </div>
      `;
    }

    if (departmentDetailEl) {
      departmentDetailEl.innerHTML = `
        <div class="dept-detail-sections">
          <div class="dept-detail-section">
            <div class="table-toolbar">
              <div id="deptEmployeesMeta" class="muted"></div>
              <div class="pager">
                <button id="deptEmpPrev" type="button" class="ghost">Anterior</button>
                <button id="deptEmpNext" type="button" class="ghost">Siguiente</button>
              </div>
            </div>
            <div id="deptEmployeesTable">${renderDeptEmployeesTable(empData?.rows || [])}</div>
          </div>

          <div class="dept-detail-section">
            <div class="chart-header"><h3 class="chart-title">Incidencias recientes</h3></div>
            <div id="deptIncidentsTable">${incidenciasHtml}</div>
          </div>
        </div>
      `;
    }

    updateDeptEmployeesMeta({
      total: departmentEmployeesLast.total,
      offset: departmentEmployeesLast.offset,
      limit: departmentEmployeesLast.limit,
      count: departmentEmployeesLast.rows.length
    });

    const prevBtn = departmentDetailEl?.querySelector("#deptEmpPrev");
    const nextBtn = departmentDetailEl?.querySelector("#deptEmpNext");

    prevBtn?.addEventListener("click", async () => {
      deptEmployeesOffset = Math.max(0, deptEmployeesOffset - DEPT_EMP_LIMIT);
      await loadDepartmentEmployeesPage();
    });

    nextBtn?.addEventListener("click", async () => {
      deptEmployeesOffset = deptEmployeesOffset + DEPT_EMP_LIMIT;
      await loadDepartmentEmployeesPage();
    });

    const deptEmployeesTableEl = departmentDetailEl?.querySelector("#deptEmployeesTable");
    wireDeptEmployeesSort(deptEmployeesTableEl, departmentEmployeesLast.rows);
  } catch (err) {
    const errorHtml = `<div class="muted">Error: ${escapeHtml(String(err?.message || err))}</div>`;
    if (departmentDashboardEl) departmentDashboardEl.innerHTML = errorHtml;
    if (departmentDetailEl) departmentDetailEl.innerHTML = errorHtml;
  }
}

async function loadDepartmentEmployeesPage() {
  if (!selectedDeptNo) return;

  try {
    const tableEl = departmentDetailEl?.querySelector("#deptEmployeesTable");
    const metaEl = departmentDetailEl?.querySelector("#deptEmployeesMeta");
    if (tableEl) tableEl.innerHTML = `<div class="muted">Cargando…</div>`;
    if (metaEl) metaEl.textContent = "Cargando…";

    const empData = await fetchJson(
      `/api/departments/${encodeURIComponent(selectedDeptNo)}/employees?limit=${encodeURIComponent(
        DEPT_EMP_LIMIT
      )}&offset=${encodeURIComponent(deptEmployeesOffset)}`
    );

    departmentEmployeesLast = {
      deptNo: selectedDeptNo,
      deptName: selectedDeptName,
      total: Number(empData?.total) || 0,
      offset: Number(empData?.offset) || 0,
      limit: Number(empData?.limit) || DEPT_EMP_LIMIT,
      rows: Array.isArray(empData?.rows) ? empData.rows : []
    };

    if (tableEl) tableEl.innerHTML = renderDeptEmployeesTable(departmentEmployeesLast.rows);
    wireDeptEmployeesSort(tableEl, departmentEmployeesLast.rows);

    updateDeptEmployeesMeta({
      total: departmentEmployeesLast.total,
      offset: departmentEmployeesLast.offset,
      limit: departmentEmployeesLast.limit,
      count: departmentEmployeesLast.rows.length
    });
  } catch (err) {
    setFlash(String(err?.message || err));
  }
}

function validateIncidencia(payload) {
  if (!payload.emp_no || payload.emp_no <= 0) throw new Error("emp_no inválido");
  if (!payload.tipo || payload.tipo.trim().length < 3) throw new Error("tipo demasiado corto");
  if (!payload.descripcion || payload.descripcion.trim().length < 10) throw new Error("descripción demasiado corta");
  if (!["abierta", "pendiente", "cerrada"].includes(payload.estatus)) throw new Error("estatus inválido");
}

async function loadIncidencias() {
  const rows = await fetchJson("/api/incidencias");
  incidenciasLastRows = rows || [];

  incidenciasListEl.innerHTML = renderTable({
    columns: [
      { label: "ID", value: (r) => r.id_incidencia },
      { label: "No. de Empleado", value: (r) => r.emp_no },
      { label: "Empleado", value: (r) => `${r.first_name || ""} ${r.last_name || ""}`.trim() || "-" },
      { label: "Departamento", value: (r) => translateDeptName(r.dept_name) || "-" },
      { label: "Tipo", value: (r) => r.tipo },
      { label: "Fecha", value: (r) => formatDate(r.fecha) },
      { label: "Estatus", value: (r) => r.estatus },
      { label: "Descripción", value: (r) => r.descripcion }
    ],
    rows,
    actions: [
      { name: "edit", label: "Editar", id: (r) => r.id_incidencia },
      { name: "delete", label: "Eliminar", kind: "danger", id: (r) => r.id_incidencia }
    ]
  });

  incidenciasListEl.querySelectorAll("button[data-action]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const action = btn.dataset.action;
      const id = Number(btn.dataset.id);
      if (!id) return;

      if (action === "edit") {
        const row = rows.find((r) => r.id_incidencia === id);
        if (!row) return;
        editingIncidenciaId = id;
        empNoEl.value = row.emp_no;
        const rowName = `${row.first_name || ""} ${row.last_name || ""}`.trim();
        if (rowName) {
          setEmployeeFullName(rowName);
          empNoEl.setCustomValidity("");
        } else {
          lookupEmployeeFullName(row.emp_no);
        }
        ensureTipoOption(row.tipo);
        tipoEl.value = row.tipo;
        descripcionEl.value = row.descripcion;
        estatusEl.value = row.estatus;
        incCancelBtn.hidden = false;
        setFlash(`Editando incidencia #${id}`);
        showView("incidenciasView");
      }

      if (action === "delete") {
        if (!confirm(`¿Eliminar incidencia #${id}?`)) return;
        await fetchJson(`/api/incidencias/${encodeURIComponent(id)}`, { method: "DELETE" });
        await loadIncidencias();
        setFlash("Incidencia eliminada.");
      }
    });
  });
}

function resetIncidenciaForm() {
  editingIncidenciaId = null;
  incidenciaForm.reset();
  clearDynamicTipoOptions();
  incCancelBtn.hidden = true;
  clearEmployeeFullName();
}

tabs.forEach((t) =>
  t.addEventListener("click", async () => {
    const viewId = t.dataset.view;
    showView(viewId);

    try {
      await loadViewData(viewId);
    } catch (err) {
      setFlash(String(err?.message || err));
    }
  })
);

employeeSearchForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  try {
    await loadEmployees({ offset: 0 });
  } catch (err) {
    setFlash(String(err?.message || err));
  }
});

empPrevBtn.addEventListener("click", async () => {
  try {
    await loadEmployees({ offset: Math.max(0, employeeOffset - EMP_LIMIT) });
  } catch (err) {
    setFlash(String(err?.message || err));
  }
});

empNextBtn.addEventListener("click", async () => {
  try {
    await loadEmployees({ offset: employeeOffset + EMP_LIMIT });
  } catch (err) {
    setFlash(String(err?.message || err));
  }
});

if (empToggleFiltersBtn) {
  empToggleFiltersBtn.addEventListener("click", () => {
    employeeSearchForm.hidden = !employeeSearchForm.hidden;
    empToggleFiltersBtn.textContent = employeeSearchForm.hidden ? "Mostrar filtros" : "Ocultar filtros";
  });
}

empExportBtn.addEventListener("click", () => {
  const rows = (employeeLastRows || []).map((r) => ({
    Estado: Number(r.is_active) === 1 ? "Activo" : "Inactivo",
    "No. de Empleado": r.emp_no,
    Nombre: r.first_name,
    Apellido: r.last_name,
    Género: r.gender,
    "Fecha ingreso": formatDate(r.hire_date),
    Departamento: translateDeptName(r.dept_name) || "-"
  }));

  downloadExcel("empleados.xls", [{ title: "Empleados", rows }]);
});

dashExportBtn.addEventListener("click", async () => {
  try {
    const data = dashboardLastData || (await fetchJson("/api/dashboard/resumen"));
    dashboardLastData = data;

    const resumen = [
      { Métrica: "Total de empleados", Valor: data.totalEmpleados ?? "" },
      { Métrica: "Total de departamentos", Valor: data.totalDepartamentos ?? "" },
      { Métrica: "Total de gerentes", Valor: data.totalGerentes ?? "" },
      { Métrica: "Costo nómina mensual", Valor: data.costoNominaMensual ?? "" },
      { Métrica: "Salario promedio", Valor: data.salarioPromedio ?? "" },
      { Métrica: "Incidencias (Mes a la fecha)", Valor: data.incidenciasMesATD ?? "" }
    ];

    const sections = [
      { title: "Resumen", rows: resumen },
      {
        title: "Empleados por departamento",
        rows: (data.empleadosPorDepartamento || []).map((r) => ({
          Departamento: translateDeptName(r.dept_name),
          Total: r.total
        }))
      },
      {
        title: "Rotación de personal por año",
        rows: (data.rotacionPorAnio || []).map((r) => ({
          Año: r.year,
          Bajas: r.separations,
          "Headcount promedio": r.headcount_avg,
          "% Rotación": r.turnover_pct
        }))
      },
      {
        title: "Headcount por año",
        rows: (data.headcountPorAnio || []).map((r) => ({ Año: r.year, Contrataciones: r.hires, Total: r.total }))
      },
      {
        title: "Empleados por puesto",
        rows: (data.empleadosPorTitulo || []).map((r) => ({ Puesto: translateJobTitle(r.title), Total: r.total }))
      },
      {
        title: "Gerentes por departamento",
        rows: (data.gerentesPorDepartamento || []).map((r) => ({
          Departamento: translateDeptName(r.dept_name),
          Gerentes: r.total
        }))
      },
      {
        title: "Salario por departamento",
        rows: (data.salarioPromedioPorDepartamento || []).map((r) => ({
          Departamento: translateDeptName(r.dept_name),
          Promedio: r.avg_salary
        }))
      },
      {
        title: "Incidencias recientes",
        rows: (data.incidenciasRecientes || []).map((r) => ({
          ID: r.id_incidencia,
          "No. de Empleado": r.emp_no,
          Empleado: `${r.first_name || ""} ${r.last_name || ""}`.trim() || "-",
          Departamento: translateDeptName(r.dept_name) || "-",
          Tipo: r.tipo,
          Fecha: formatDate(r.fecha),
          Estatus: r.estatus
        }))
      }
    ];

    downloadExcel("dashboard_rh.xls", sections);
  } catch (err) {
    setFlash(String(err?.message || err));
  }
});

deptExportBtn.addEventListener("click", async () => {
  try {
    if (!departmentsLastRows.length) await loadDepartments(deptQueryEl.value.trim());

    const sections = [
      {
        title: "Departamentos",
        rows: (departmentsLastRows || []).map((r) => ({
          "Dept No": r.dept_no,
          Departamento: translateDeptName(r.dept_name),
          Empleados: r.current_employees
        }))
      }
    ];

    if (departmentEmployeesLast?.deptNo && (departmentEmployeesLast?.rows || []).length) {
      sections.push({
        title: `Empleados del departamento ${departmentEmployeesLast.deptNo} — ${departmentEmployeesLast.deptName || ""}`.trim(),
        rows: (departmentEmployeesLast.rows || []).map((r) => ({
          "No. de Empleado": r.emp_no,
          Nombre: r.first_name,
          Apellido: r.last_name,
          Ingreso: formatDate(r.hire_date)
        }))
      });
    }

    if (selectedDeptResumen?.dept_no && selectedDeptResumen.dept_no === departmentEmployeesLast?.deptNo) {
      const mgrNames = Array.isArray(selectedDeptResumen?.gerentes)
        ? selectedDeptResumen.gerentes
            .map((g) => `${String(g.first_name || "").trim()} ${String(g.last_name || "").trim()}`.trim())
            .filter(Boolean)
            .join(", ")
        : "";

      sections.push({
        title: `Resumen — ${selectedDeptResumen.dept_no} — ${translateDeptName(selectedDeptResumen.dept_name)}`,
        rows: [
          { Métrica: "Empleados", Valor: selectedDeptResumen.totalEmpleados ?? "" },
          { Métrica: "Gerentes", Valor: selectedDeptResumen.totalGerentes ?? "" },
          { Métrica: "Gerentes (nombres)", Valor: mgrNames || "-" },
          { Métrica: "Salario promedio", Valor: selectedDeptResumen.salarioPromedio ?? "" },
          { Métrica: "Nómina mensual", Valor: selectedDeptResumen.costoNominaMensual ?? "" },
          { Métrica: "Incidencias (Mes a la fecha)", Valor: selectedDeptResumen.incidenciasMesATD ?? "" }
        ]
      });

      if (Array.isArray(selectedDeptResumen?.puestos) && selectedDeptResumen.puestos.length) {
        sections.push({
          title: `Puestos — ${selectedDeptResumen.dept_no}`,
          rows: selectedDeptResumen.puestos.map((r) => ({ Puesto: translateJobTitle(r.title), Total: r.total }))
        });
      }

      if (Array.isArray(selectedDeptResumen?.incidenciasRecientes) && selectedDeptResumen.incidenciasRecientes.length) {
        sections.push({
          title: `Incidencias recientes — ${selectedDeptResumen.dept_no}`,
          rows: selectedDeptResumen.incidenciasRecientes.map((r) => ({
            ID: r.id_incidencia,
            "No. de Empleado": r.emp_no,
            Empleado: `${r.first_name || ""} ${r.last_name || ""}`.trim() || "-",
            Tipo: r.tipo,
            Fecha: formatDate(r.fecha),
            Estatus: r.estatus,
            Descripción: r.descripcion
          }))
        });
      }
    }

    downloadExcel("departamentos.xls", sections);
  } catch (err) {
    setFlash(String(err?.message || err));
  }
});

incExportBtn.addEventListener("click", async () => {
  try {
    if (!incidenciasLastRows.length) await loadIncidencias();

    const rows = (incidenciasLastRows || []).map((r) => ({
      ID: r.id_incidencia,
      "No. de Empleado": r.emp_no,
      Empleado: `${r.first_name || ""} ${r.last_name || ""}`.trim() || "-",
      Departamento: translateDeptName(r.dept_name) || "-",
      Tipo: r.tipo,
      Fecha: formatDate(r.fecha),
      Estatus: r.estatus,
      Descripción: r.descripcion
    }));

    downloadExcel("incidencias_rrhh.xls", [{ title: "Incidencias", rows }]);
  } catch (err) {
    setFlash(String(err?.message || err));
  }
});

deptSearchForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  try {
    await loadDepartments(deptQueryEl.value.trim());
  } catch (err) {
    setFlash(String(err?.message || err));
  }
});

let deptSearchTimer = null;
deptQueryEl.addEventListener("input", () => {
  clearTimeout(deptSearchTimer);
  deptSearchTimer = setTimeout(async () => {
    try {
      await loadDepartments(deptQueryEl.value.trim());
    } catch (err) {
      setFlash(String(err?.message || err));
    }
  }, 250);
});

employeeClearBtn.addEventListener("click", async () => {
  employeeQueryEl.value = "";
  employeeDeptEl.value = "";
  employeeGenderEl.value = "";
  employeeHireFromEl.value = "";
  employeeHireToEl.value = "";
  employeeDetailEl.innerHTML = `<div class="muted">Selecciona un empleado para ver su detalle.</div>`;
  await loadEmployees({ offset: 0 });
});

deptClearBtn.addEventListener("click", async () => {
  deptQueryEl.value = "";
  await loadDepartments("");
});

incidenciaForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  try {
    const payload = {
      emp_no: Number(empNoEl.value),
      tipo: tipoEl.value.trim(),
      descripcion: descripcionEl.value.trim(),
      estatus: estatusEl.value
    };

    validateIncidencia(payload);

    if (editingIncidenciaId) {
      await fetchJson(`/api/incidencias/${encodeURIComponent(editingIncidenciaId)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      setFlash("Incidencia actualizada.");
    } else {
      await fetchJson("/api/incidencias", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      setFlash("Incidencia creada.");
    }

    resetIncidenciaForm();
    await loadIncidencias();
  } catch (err) {
    setFlash(String(err?.message || err));
  }
});

incCancelBtn.addEventListener("click", () => {
  resetIncidenciaForm();
  setFlash("");
});

if (empNoEl) {
  empNoEl.addEventListener("input", scheduleEmployeeFullNameLookup);
  empNoEl.addEventListener("change", () => lookupEmployeeFullName(empNoEl.value, { reportValidity: true }));
  empNoEl.addEventListener("blur", () => lookupEmployeeFullName(empNoEl.value, { reportValidity: true }));
}

// Init
setupStickyTabsOffset();
dateEl.textContent = new Date().toLocaleDateString("es-MX", { dateStyle: "full" });
loadWeather();
if (dashDetailBackBtn) {
  dashDetailBackBtn.addEventListener("click", () => {
    closeDashboardDetail();
    window.scrollTo({ top: 0, behavior: "smooth" });
  });
}
showView("employeesView");
loadEmployees({ offset: 0 }).catch((err) => setFlash(String(err?.message || err)));
