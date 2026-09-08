# 🚛 Sistema Multi-tenant de Liquidación de Pagos para Empresas de Transporte y Asociaciones

Sistema integral de liquidación de fletes para empresas de transporte terrestre de carga líquida e hidrocarburos (YPFB / Ley 843 Art. 4). Diseñado con arquitectura **Multi-Tenant** basada en esquemas dedicados por empresa en PostgreSQL.

---

## 🏗️ Arquitectura del Proyecto

- **Frontend:** Next.js 15 (React 19, TypeScript, Tailwind CSS, Lucide Icons, Framer Motion, SweetAlert2).
- **Backend:** FastAPI (Python), SQLAlchemy 2, Pydantic v2, ReportLab (PDF), OpenPyXL (Excel).
- **Base de Datos:** PostgreSQL 15 con aislamiento Multi-Tenant (`schema_translate_map={"tenant": schema_name}`).
- **Contenedores:** Docker & Docker Compose.

---

## 🔌 Configuración de Puertos

| Servicio | Puerto Host | Descripción |
| :--- | :--- | :--- |
| **Frontend Next.js** | `3001` | Interfaz de usuario web |
| **Backend FastAPI** | `8001` | API RESTful y Swagger en `/api/docs` |
| **PostgreSQL** | `5455` | Base de datos `db_transporte_liquidacion` |
| **pgAdmin 4** | `5055` | Administrador visual de base de datos |

---

## 🔑 Credenciales por Defecto (Seed Data)

- **Administrador:**
  - Usuario: `admin`
  - Contraseña: `admin123`
- **Operador / Usuario:**
  - Usuario: `usuario`
  - Contraseña: `user123`

---

## 🚀 Despliegue y Ejecución Local

### Requisitos Previos
- Docker y Docker Compose
- Node.js 18+ y npm
- Python 3.11+

### 1. Iniciar Base de Datos con Docker
```bash
docker-compose up -d db
```

### 2. Configurar y Ejecutar el Backend
```bash
cd backend
python -m venv venv

# En Windows:
.\venv\Scripts\activate
# En Linux/Mac:
source venv/bin/activate

pip install -r requirements.txt
python seed_data.py
uvicorn main:app --host 0.0.0.0 --port 8001 --reload
```

### 3. Configurar y Ejecutar el Frontend
```bash
cd frontend
npm install
npm run build
npm run start # O npm run dev para desarrollo
```

---

## 📄 Características Principales
- **Gestión de Asociaciones y Empresas:** CRUD completo de asociaciones, afiliación o empresas independientes (sin asociación).
- **Aprovisionamiento Automático:** Cada nueva empresa cuenta con su propio esquema aislado en PostgreSQL.
- **Calculadora en Vivo de Mermas:** Tolerancias técnicas automáticas para Diésel (0.15%), Gasolina (0.25%) e Insumos y Aditivos (0.20%).
- **Liquidaciones Exactas:** Reproducción 100% fidedigna de las 3 páginas de planilla oficial (Consolidado General de Asociación, Detalle de Fletes por Placa y Resumen de Descuentos).
- **Exportación en 1 Clic:** Descarga de reportes en Excel multihoja (.xlsx) y PDF de alta definición con firmas de auditoría.
