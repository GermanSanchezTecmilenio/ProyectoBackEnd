module.exports = {
  openapi: "3.0.3",
  info: {
    title: "SGRH-Employees API",
    version: "1.0.0",
    description:
      "API REST para el Sistema de Gestión de Recursos Humanos (MySQL `employees`)."
  },
  servers: [{ url: "http://localhost:3000" }],
  tags: [
    { name: "Docs" },
    { name: "Employees" },
    { name: "Departments" },
    { name: "Dashboard" },
    { name: "Incidencias" },
    { name: "Weather" },
    { name: "Health" }
  ],
  paths: {
    "/api-docs.json": {
      get: {
        tags: ["Docs"],
        summary: "OpenAPI spec (Swagger) en JSON",
        responses: {
          200: {
            description: "OpenAPI spec",
            content: {
              "application/json": {
                schema: { type: "object" }
              }
            }
          }
        }
      }
    },
    "/api/health": {
      get: {
        tags: ["Health"],
        summary: "Health check",
        responses: {
          200: {
            description: "OK",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/HealthResponse" }
              }
            }
          }
        }
      }
    },
    "/api/employees": {
      get: {
        tags: ["Employees"],
        summary: "Listar/buscar empleados",
        parameters: [
          { name: "q", in: "query", schema: { type: "string" } },
          { name: "dept_no", in: "query", schema: { type: "string", pattern: "^d\\d{3}$" } },
          { name: "gender", in: "query", schema: { type: "string", enum: ["M", "F"] } },
          { name: "hire_from", in: "query", schema: { type: "string", format: "date" } },
          { name: "hire_to", in: "query", schema: { type: "string", format: "date" } },
          { name: "active", in: "query", schema: { type: "string", enum: ["1", "0", "true", "false"] } },
          { $ref: "#/components/parameters/LimitParam" },
          { $ref: "#/components/parameters/OffsetParam" },
          {
            name: "sort_by",
            in: "query",
            schema: {
              type: "string",
              enum: ["status", "emp_no", "first_name", "last_name", "gender", "hire_date", "dept_no", "dept_name"],
              default: "emp_no"
            }
          },
          { name: "sort_dir", in: "query", schema: { type: "string", enum: ["asc", "desc"], default: "asc" } }
        ],
        responses: {
          200: {
            description: "Listado paginado de empleados",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/EmployeesListResponse" }
              }
            }
          },
          400: { description: "Parámetros inválidos", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
          500: { description: "Error interno", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } }
        }
      }
    },
    "/api/employees/{id}": {
      get: {
        tags: ["Employees"],
        summary: "Detalle de empleado",
        parameters: [{ $ref: "#/components/parameters/EmpIdParam" }],
        responses: {
          200: { description: "Empleado", content: { "application/json": { schema: { $ref: "#/components/schemas/EmployeeDetail" } } } },
          400: { description: "ID inválido", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
          404: { description: "Empleado no encontrado", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } }
        }
      }
    },
    "/api/employees/{id}/historial": {
      get: {
        tags: ["Employees"],
        summary: "Historial de títulos y salarios",
        parameters: [{ $ref: "#/components/parameters/EmpIdParam" }],
        responses: {
          200: { description: "Historial", content: { "application/json": { schema: { $ref: "#/components/schemas/EmployeeHistorialResponse" } } } },
          400: { description: "ID inválido", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } }
        }
      }
    },
    "/api/employees/{id}/incidencias": {
      get: {
        tags: ["Incidencias"],
        summary: "Incidencias por empleado",
        parameters: [{ $ref: "#/components/parameters/EmpIdParam" }],
        responses: {
          200: {
            description: "Lista de incidencias",
            content: { "application/json": { schema: { type: "array", items: { $ref: "#/components/schemas/Incidencia" } } } }
          },
          400: { description: "ID inválido", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } }
        }
      }
    },
    "/api/titles": {
      get: {
        tags: ["Employees"],
        summary: "Catálogo de títulos",
        responses: {
          200: { description: "Lista", content: { "application/json": { schema: { type: "array", items: { type: "string" } } } } }
        }
      }
    },
    "/api/employees/{id}/salary-plan": {
      get: {
        tags: ["Employees"],
        summary: "Ver plan salarial activo",
        parameters: [{ $ref: "#/components/parameters/EmpIdParam" }],
        responses: {
          200: { description: "Plan", content: { "application/json": { schema: { $ref: "#/components/schemas/SalaryPlan" } } } },
          400: { description: "ID inválido", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
          404: { description: "Sin plan activo", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } }
        }
      },
      post: {
        tags: ["Employees"],
        summary: "Crear plan salarial por etapas",
        parameters: [{ $ref: "#/components/parameters/EmpIdParam" }],
        requestBody: {
          required: true,
          content: { "application/json": { schema: { $ref: "#/components/schemas/SalaryPlanCreateRequest" } } }
        },
        responses: {
          201: { description: "Creado", content: { "application/json": { schema: { $ref: "#/components/schemas/SalaryPlanCreateResponse" } } } },
          400: { description: "Datos inválidos", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
          404: { description: "Empleado no encontrado", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
          409: { description: "Ya existe plan activo", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } }
        }
      }
    },
    "/api/employees/{id}/salary-plan/apply-next": {
      post: {
        tags: ["Employees"],
        summary: "Aplicar siguiente etapa del plan salarial",
        parameters: [{ $ref: "#/components/parameters/EmpIdParam" }],
        responses: {
          201: {
            description: "Etapa aplicada",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/SalaryPlanApplyResponse" }
              }
            }
          },
          400: { description: "Datos inválidos", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
          404: { description: "No encontrado", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
          409: { description: "Conflicto", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } }
        }
      }
    },
    "/api/employees/{id}/salary-plan/cancel": {
      post: {
        tags: ["Employees"],
        summary: "Cancelar plan salarial activo",
        parameters: [{ $ref: "#/components/parameters/EmpIdParam" }],
        responses: {
          200: { description: "Cancelado", content: { "application/json": { schema: { $ref: "#/components/schemas/MessageResponse" } } } },
          400: { description: "ID inválido", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
          404: { description: "No hay plan activo", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } }
        }
      }
    },
    "/api/employees/{id}/titles/promote": {
      post: {
        tags: ["Employees"],
        summary: "Registrar ascenso (título)",
        parameters: [{ $ref: "#/components/parameters/EmpIdParam" }],
        requestBody: {
          required: true,
          content: { "application/json": { schema: { $ref: "#/components/schemas/PromoteTitleRequest" } } }
        },
        responses: {
          201: { description: "Ascenso registrado", content: { "application/json": { schema: { $ref: "#/components/schemas/PromoteTitleResponse" } } } },
          400: { description: "Datos inválidos", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
          404: { description: "No encontrado", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
          409: { description: "Conflicto", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } }
        }
      }
    },
    "/api/departments": {
      get: {
        tags: ["Departments"],
        summary: "Listar departamentos (filtro opcional)",
        parameters: [{ name: "q", in: "query", schema: { type: "string" } }],
        responses: {
          200: { description: "Lista", content: { "application/json": { schema: { type: "array", items: { $ref: "#/components/schemas/DepartmentListItem" } } } } }
        }
      }
    },
    "/api/departments/{dept_no}/employees": {
      get: {
        tags: ["Departments"],
        summary: "Empleados por departamento",
        parameters: [
          { $ref: "#/components/parameters/DeptNoParam" },
          { $ref: "#/components/parameters/LimitParam" },
          { $ref: "#/components/parameters/OffsetParam" }
        ],
        responses: {
          200: {
            description: "Resultado",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/DepartmentEmployeesResponse" }
              }
            }
          },
          400: { description: "dept_no inválido", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
          404: { description: "Departamento no encontrado", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } }
        }
      }
    },
    "/api/departments/{dept_no}/resumen": {
      get: {
        tags: ["Departments"],
        summary: "Resumen del departamento",
        parameters: [{ $ref: "#/components/parameters/DeptNoParam" }],
        responses: {
          200: {
            description: "Resumen",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/DepartmentResumenResponse" }
              }
            }
          },
          400: { description: "dept_no inválido", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
          404: { description: "Departamento no encontrado", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } }
        }
      }
    },
    "/api/dashboard/resumen": {
      get: {
        tags: ["Dashboard"],
        summary: "Resumen dashboard",
        responses: {
          200: {
            description: "Resumen",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/DashboardResumenResponse" }
              }
            }
          }
        }
      }
    },
    "/api/incidencias": {
      get: {
        tags: ["Incidencias"],
        summary: "Listar incidencias",
        responses: {
          200: { description: "Lista", content: { "application/json": { schema: { type: "array", items: { type: "object" } } } } }
        }
      },
      post: {
        tags: ["Incidencias"],
        summary: "Crear incidencia",
        requestBody: {
          required: true,
          content: { "application/json": { schema: { $ref: "#/components/schemas/IncidenciaCreateRequest" } } }
        },
        responses: {
          201: { description: "Creada", content: { "application/json": { schema: { $ref: "#/components/schemas/IncidenciaCreateResponse" } } } },
          400: { description: "Datos inválidos", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } }
        }
      }
    },
    "/api/incidencias/{id}": {
      put: {
        tags: ["Incidencias"],
        summary: "Actualizar incidencia",
        parameters: [{ $ref: "#/components/parameters/IncidenciaIdParam" }],
        requestBody: {
          required: true,
          content: { "application/json": { schema: { $ref: "#/components/schemas/IncidenciaUpdateRequest" } } }
        },
        responses: {
          200: { description: "OK", content: { "application/json": { schema: { $ref: "#/components/schemas/MessageResponse" } } } },
          400: { description: "Datos inválidos", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
          404: { description: "No encontrada", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } }
        }
      },
      delete: {
        tags: ["Incidencias"],
        summary: "Eliminar incidencia",
        parameters: [{ $ref: "#/components/parameters/IncidenciaIdParam" }],
        responses: {
          200: { description: "OK", content: { "application/json": { schema: { $ref: "#/components/schemas/MessageResponse" } } } },
          400: { description: "ID inválido", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
          404: { description: "No encontrada", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } }
        }
      }
    },
    "/api/weather": {
      get: {
        tags: ["Weather"],
        summary: "Temperatura actual por ciudad (Open-Meteo)",
        parameters: [{ name: "city", in: "query", schema: { type: "string", default: "Mexico City" } }],
        responses: {
          200: { description: "Clima", content: { "application/json": { schema: { $ref: "#/components/schemas/WeatherResponse" } } } },
          400: { description: "city requerida", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
          404: { description: "Ciudad no encontrada", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
          502: { description: "Error consultando proveedor externo", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } }
        }
      }
    }
  },
  components: {
    parameters: {
      EmpIdParam: {
        name: "id",
        in: "path",
        required: true,
        schema: { type: "integer", minimum: 1 },
        description: "Número de empleado (emp_no)."
      },
      DeptNoParam: {
        name: "dept_no",
        in: "path",
        required: true,
        schema: { type: "string", pattern: "^d\\d{3}$" },
        description: "Código de departamento (ej: d001)."
      },
      IncidenciaIdParam: {
        name: "id",
        in: "path",
        required: true,
        schema: { type: "integer", minimum: 1 },
        description: "ID de incidencia (id_incidencia)."
      },
      LimitParam: {
        name: "limit",
        in: "query",
        required: false,
        schema: { type: "integer", minimum: 1, maximum: 200, default: 50 }
      },
      OffsetParam: {
        name: "offset",
        in: "query",
        required: false,
        schema: { type: "integer", minimum: 0, maximum: 100000, default: 0 }
      }
    },
    schemas: {
      ErrorResponse: {
        type: "object",
        properties: {
          mensaje: { type: "string" },
          detalle: { type: "string" }
        },
        required: ["mensaje"]
      },
      MessageResponse: {
        type: "object",
        properties: { mensaje: { type: "string" } },
        required: ["mensaje"]
      },
      HealthResponse: {
        type: "object",
        properties: { ok: { type: "boolean" } },
        required: ["ok"]
      },
      EmployeesListResponse: {
        type: "object",
        properties: {
          total: { type: "integer" },
          limit: { type: "integer" },
          offset: { type: "integer" },
          count: { type: "integer" },
          rows: { type: "array", items: { $ref: "#/components/schemas/EmployeeListItem" } }
        },
        required: ["total", "limit", "offset", "count", "rows"]
      },
      EmployeeListItem: {
        type: "object",
        properties: {
          emp_no: { type: "integer" },
          first_name: { type: "string" },
          last_name: { type: "string" },
          gender: { type: "string", enum: ["M", "F"] },
          hire_date: { type: "string", format: "date" },
          dept_no: { type: "string", nullable: true },
          dept_name: { type: "string", nullable: true },
          is_active: { type: "integer", enum: [0, 1] }
        },
        required: ["emp_no", "first_name", "last_name", "gender", "hire_date", "is_active"]
      },
      EmployeeDetail: {
        type: "object",
        properties: {
          emp_no: { type: "integer" },
          birth_date: { type: "string", format: "date" },
          first_name: { type: "string" },
          last_name: { type: "string" },
          gender: { type: "string" },
          hire_date: { type: "string", format: "date" },
          dept_no: { type: "string" },
          dept_name: { type: "string" }
        },
        required: ["emp_no", "birth_date", "first_name", "last_name", "gender", "hire_date"]
      },
      EmployeeHistorialResponse: {
        type: "object",
        properties: {
          emp_no: { type: "integer" },
          titles: { type: "array", items: { type: "object" } },
          salaries: { type: "array", items: { type: "object" } }
        },
        required: ["emp_no", "titles", "salaries"]
      },
      SalaryPlan: {
        type: "object",
        properties: {
          id_plan: { type: "integer" },
          emp_no: { type: "integer" },
          etapas_total: { type: "integer" },
          etapas_aplicadas: { type: "integer" },
          porcentaje: { type: "number" },
          estatus: { type: "string" }
        },
        required: ["id_plan", "emp_no", "etapas_total", "etapas_aplicadas", "porcentaje", "estatus"]
      },
      SalaryPlanCreateRequest: {
        type: "object",
        properties: {
          etapas_total: { type: "integer", minimum: 1, maximum: 12 },
          porcentaje: { type: "number", exclusiveMinimum: 0, maximum: 100 }
        },
        required: ["etapas_total", "porcentaje"]
      },
      SalaryPlanCreateResponse: {
        type: "object",
        properties: {
          mensaje: { type: "string" },
          id_plan: { type: "integer" },
          emp_no: { type: "integer" },
          etapas_total: { type: "integer" },
          porcentaje: { type: "number" }
        },
        required: ["mensaje", "id_plan", "emp_no", "etapas_total", "porcentaje"]
      },
      SalaryPlanApplyResponse: {
        type: "object",
        properties: {
          mensaje: { type: "string" },
          emp_no: { type: "integer" },
          etapas_total: { type: "integer" },
          etapas_aplicadas: { type: "integer" },
          porcentaje: { type: "number" },
          salary_anterior: { type: "integer" },
          salary_nuevo: { type: "integer" }
        },
        required: ["mensaje"]
      },
      PromoteTitleRequest: {
        type: "object",
        properties: {
          title: { type: "string", minLength: 2, maxLength: 50 },
          from_date: { type: "string", format: "date" }
        },
        required: ["title"]
      },
      PromoteTitleResponse: {
        type: "object",
        properties: {
          mensaje: { type: "string" },
          emp_no: { type: "integer" },
          title: { type: "string" },
          from_date: { type: "string", format: "date" }
        },
        required: ["mensaje", "emp_no", "title", "from_date"]
      },
      Incidencia: {
        type: "object",
        properties: {
          id_incidencia: { type: "integer" },
          emp_no: { type: "integer" },
          tipo: { type: "string" },
          fecha: { type: "string" },
          descripcion: { type: "string" },
          estatus: { type: "string" }
        }
      },
      IncidenciaCreateRequest: {
        type: "object",
        properties: {
          emp_no: { type: "integer", minimum: 1 },
          tipo: { type: "string", minLength: 3 },
          descripcion: { type: "string", minLength: 10 },
          estatus: { type: "string", enum: ["abierta", "pendiente", "cerrada"], default: "abierta" }
        },
        required: ["emp_no", "tipo", "descripcion"]
      },
      IncidenciaUpdateRequest: {
        type: "object",
        properties: {
          emp_no: { type: "integer", minimum: 1 },
          tipo: { type: "string", minLength: 3 },
          descripcion: { type: "string", minLength: 10 },
          estatus: { type: "string", enum: ["abierta", "pendiente", "cerrada"] }
        },
        required: ["emp_no", "tipo", "descripcion", "estatus"]
      },
      IncidenciaCreateResponse: {
        type: "object",
        properties: { mensaje: { type: "string" }, id_incidencia: { type: "integer" } },
        required: ["mensaje", "id_incidencia"]
      },
      DepartmentListItem: {
        type: "object",
        properties: { dept_no: { type: "string" }, dept_name: { type: "string" }, current_employees: { type: "integer" } },
        required: ["dept_no", "dept_name", "current_employees"]
      },
      DepartmentEmployeesResponse: {
        type: "object",
        properties: {
          dept_no: { type: "string" },
          dept_name: { type: "string" },
          total: { type: "integer" },
          offset: { type: "integer" },
          limit: { type: "integer" },
          rows: { type: "array", items: { $ref: "#/components/schemas/DepartmentEmployeeItem" } }
        },
        required: ["dept_no", "dept_name", "total", "offset", "limit", "rows"]
      },
      DepartmentEmployeeItem: {
        type: "object",
        properties: {
          emp_no: { type: "integer" },
          first_name: { type: "string" },
          last_name: { type: "string" },
          hire_date: { type: "string", format: "date" },
          current_title: { type: "string", nullable: true },
          current_salary: { type: "integer", nullable: true }
        },
        required: ["emp_no", "first_name", "last_name", "hire_date"]
      },
      DepartmentResumenResponse: {
        type: "object",
        properties: {
          dept_no: { type: "string" },
          dept_name: { type: "string" },
          totalEmpleados: { type: "integer" },
          totalGerentes: { type: "integer" },
          gerentes: { type: "array", items: { type: "object" } },
          salarioPromedio: { type: "number" },
          costoNominaMensual: { type: "number" },
          incidenciasMesATD: { type: "integer" },
          puestos: { type: "array", items: { type: "object" } },
          incidenciasRecientes: { type: "array", items: { type: "object" } }
        },
        required: ["dept_no", "dept_name", "totalEmpleados", "totalGerentes"]
      },
      DashboardResumenResponse: {
        type: "object",
        properties: {
          totalEmpleados: { type: "integer" },
          totalDepartamentos: { type: "integer" },
          totalGerentes: { type: "integer" },
          costoNominaMensual: { type: "number" },
          salarioPromedio: { type: "number" },
          incidenciasMesATD: { type: "integer" },
          empleadosPorDepartamento: { type: "array", items: { type: "object" } },
          headcountPorAnio: { type: "array", items: { type: "object" } },
          rotacionPorAnio: { type: "array", items: { type: "object" } },
          empleadosPorTitulo: { type: "array", items: { type: "object" } },
          gerentesPorDepartamento: { type: "array", items: { type: "object" } },
          salarioPromedioPorDepartamento: { type: "array", items: { type: "object" } },
          incidenciasRecientes: { type: "array", items: { type: "object" } }
        },
        required: ["totalEmpleados", "totalDepartamentos", "totalGerentes"]
      },
      WeatherResponse: {
        type: "object",
        properties: {
          city: { type: "string" },
          country: { type: "string" },
          temperature_c: { type: "number" },
          observed_at: { type: "string" }
        },
        required: ["city", "country", "temperature_c", "observed_at"]
      }
    }
  }
};
