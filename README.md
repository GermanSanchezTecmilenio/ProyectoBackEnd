# SGRH-Employees (Local)

Sistema local de Gestion de Recursos Humanos basado en la base `employees` de MySQL, con backend REST (Node.js + Express) y frontend web (HTML/CSS/JS).

Incluye:

- Consultas de empleados (listado/busqueda/detalle)
- Consultas de departamentos (listado/filtro y empleados por departamento)
- Historial de titulos y salarios por empleado
- Modulo de aumento salarial por etapas (sobre `salaries`)
- Modulo de ascensos / promociones (sobre `titles`)
- CRUD de incidencias RRHH en tabla adicional `incidencias_rrhh`
- Widget visible de fecha actual y temperatura (Weather API)

## Requisitos

- Node.js
- MySQL local con la base `employees` importada

## Estructura del proyecto

- `server.js` Backend Express + API REST
- `public/` Frontend (se sirve con Express)
- `sql/` Scripts SQL (tabla adicional)

## Configuracion

Variables de entorno (opcional):

- `PORT` (default: `3000`)
- `DB_HOST` (default: `localhost`)
- `DB_USER` (default: `root`)
- `DB_PASSWORD` (default: `1234`)
- `DB_NAME` (default: `employees`)

### Opcion A: usar `.env` (recomendado)

1. Copia `.env.example` a `.env`
2. Ajusta valores segun tu MySQL local

Nota: `.env` esta en `.gitignore`.

### Opcion B: variables de entorno (PowerShell)

- `$env:DB_USER='root'`
- `$env:DB_PASSWORD='1234'`
- `$env:DB_NAME='employees'`
- `npm start`

## Tabla adicional (incidencias)

Ejecuta el script:

- `sql/create_incidencias_rrhh.sql`

Nota: el backend tambien intenta crear la tabla automaticamente al iniciar (si el usuario MySQL tiene permisos).

## Tabla adicional (aumentos por etapas)

Ejecuta el script:

- `sql/create_aumentos_salario_etapas.sql`

Nota: el backend tambien intenta crear la tabla automaticamente al iniciar (si el usuario MySQL tiene permisos).

## (Opcional) Renumerar emp_no para iniciar en 1

La base `employees` de ejemplo suele traer `emp_no` iniciando en `10001`. Si necesitas que inicie en `1` y sincronizar
las tablas relacionadas (dept_emp, dept_manager, titles, salaries e incidencias), ejecuta:

- `sql/renumber_emp_no_start_at_1.sql`

Advertencia: esto modifica datos del sample dataset y puede tardar varios minutos. Haz backup antes de correrlo.

## Ejecutar

1. Instalar dependencias:
   - `npm i`
2. Levantar el servidor:
   - `npm start`
3. Abrir en el navegador:
   - `http://localhost:3000`

## Endpoints principales

- `GET /api/employees?q=...` (busqueda por emp_no o nombre)
- `GET /api/employees/:id`
- `GET /api/employees/:id/historial`
- `GET /api/employees/:id/incidencias`
- `GET /api/employees/:id/salary-plan`
- `POST /api/employees/:id/salary-plan` (crear plan)
- `POST /api/employees/:id/salary-plan/apply-next` (aplicar etapa)
- `POST /api/employees/:id/salary-plan/cancel`
- `POST /api/employees/:id/titles/promote` (ascenso)

- `GET /api/departments?q=...`
- `GET /api/departments/:dept_no/employees`

- `GET /api/titles` (catálogo de títulos)
- `GET /api/incidencias`
- `POST /api/incidencias`
- `PUT /api/incidencias/:id`
- `DELETE /api/incidencias/:id`

- `GET /api/dashboard/resumen`
- `GET /api/weather?city=...`
- `GET /api/health`

## Validacion rapida (manual)

Con el servidor corriendo:

- `http://localhost:3000/api/health`
- `http://localhost:3000/api/dashboard/resumen`
- `http://localhost:3000/api/employees?q=10001` (o `q=1` si renumeraste a 1)
- `http://localhost:3000/api/employees/10001/historial` (o `/1/historial` si renumeraste a 1)
