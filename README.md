# 🚛 Sistema Multi-tenant de Liquidación de Pagos para Empresas de Transporte y Asociaciones

Sistema integral de liquidación de fletes para empresas de transporte terrestre de carga líquida e hidrocarburos (YPFB / Ley 843 Art. 4). Diseñado con arquitectura **Multi-Tenant** basada en esquemas dedicados por empresa en PostgreSQL.

---

## 🏗️ Arquitectura en Contenedores Docker

El proyecto está 100% dockerizado y se ejecuta con un único comando:

- **Frontend:** Next.js 15 (React 19, TypeScript, Tailwind CSS, Lucide Icons, Framer Motion) en contenedor `transporte_frontend`.
- **Backend:** FastAPI (Python 3.11), SQLAlchemy 2, Pydantic v2, ReportLab, OpenPyXL en contenedor `transporte_backend`.
- **Base de Datos:** PostgreSQL 15 en contenedor `transporte_db`.
- **Gestión Visual:** pgAdmin 4 en contenedor `transporte_pgadmin`.

---

## 🔌 Puertos y Enlaces de Red

Los puertos han sido configurados para evitar conflictos con otros proyectos (como 8000, 8080, 5454, 3000):

| Servicio | Puerto Host | Acceso Local | Acceso en Red Local (Servidor) |
| :--- | :--- | :--- | :--- |
| **Frontend Web** | `3001` | [http://localhost:3001](http://localhost:3001) | `http://Rengifo_Ltda:3001` o `http://192.168.0.24:3001` |
| **Backend API** | `8001` | [http://localhost:8001](http://localhost:8001) | `http://Rengifo_Ltda:8001/api/docs` |
| **PostgreSQL** | `5455` | `localhost:5455` | `Rengifo_Ltda:5455` (Base de datos: `db_transporte_liquidacion`) |
| **pgAdmin 4** | `5055` | [http://localhost:5055](http://localhost:5055) | `http://Rengifo_Ltda:5055` |

---

## 🔑 Credenciales de Acceso

- **Administrador:**
  - Usuario: `admin`
  - Contraseña: `admin123`
- **Operador / Usuario:**
  - Usuario: `usuario`
  - Contraseña: `user123`
- **pgAdmin:**
  - Email: `admin@transporte.com`
  - Contraseña: `transporte_seguro_2026`

---

## 🚀 Despliegue con un Solo Comando (Docker)

Para iniciar todo el sistema (Base de Datos + Backend + Frontend + pgAdmin):

```bash
docker compose up -d
```

Para detener los servicios:
```bash
docker compose down
```

Para ver el estado de los contenedores:
```bash
docker compose ps
```

Para ver los registros en tiempo real:
```bash
docker compose logs -f
```

---

## 📄 Características Principales
- **Despliegue Autónomo:** El backend realiza automáticamente el sembrado inicial de datos (`seed_data.py`) al encender el contenedor.
- **Acceso Multidispositivo:** Funciona en la máquina local (`localhost`), a través del nombre de equipo (`Rengifo_Ltda`) y por la IP de red local (`192.168.0.24`) desde cualquier celular, tablet o laptop en la misma red Wi-Fi/LAN.
- **Multi-Tenant:** Aprovisionamiento automático de esquemas PostgreSQL independientes por empresa.
- **Cálculo de Mermas en Tiempo Real:** Tolerancias técnicas oficiales para Diésel (0.15%), Gasolina (0.25%) e Insumos y Aditivos (0.20%).
- **Planillas Oficiales del PDF:** Reproducción exacta de la Página 1 (Consolidado General de Asociación), Página 2 (Fletes por Camión) y Página 3 (Resumen de Descuentos).
- **Exportación:** Generación instantánea de planillas en Excel (.xlsx multihoja) y PDF de alta calidad con firmas de auditoría.
