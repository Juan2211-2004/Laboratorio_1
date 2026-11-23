# 🎓 AcademicHub

*[Read in English](README.en.md)*

Plataforma para organizar tareas, evaluaciones, exposiciones y proyectos por materia.

| Capa | Tecnología | Carpeta |
|---|---|---|
| Frontend | HTML, CSS, JavaScript servido con Nginx | `frontend/`, `nginx/` |
| Backend | Node.js 22 + Express (API REST con JWT) | `backend/` |
| Base de datos | PostgreSQL 16 | `db/init.sql` |

```
Navegador ──► Nginx (puerto 8080) ──► /api/* ──► Backend Express (3000) ──► PostgreSQL (5432)
```

## Cómo ejecutarlo

Requisito: tener instalado [Docker Desktop](https://www.docker.com/products/docker-desktop/).

```bash
cp .env.example .env      # en Windows (PowerShell): copy .env.example .env
docker compose up --build
```

Abre **http://localhost:8080** e inicia sesión con el usuario definido en `.env`
(por defecto `estudiante@academichub.com` / `Academic123`).

Comandos útiles:

```bash
docker compose down          # detener los contenedores
docker compose down -v       # detener y BORRAR la base de datos (vuelve a ejecutar init.sql)
docker compose logs -f backend
docker compose exec db psql -U academichub -d academichub   # consola SQL
```

> `db/init.sql` solo se ejecuta cuando el volumen de la base de datos está vacío.
> Si cambias el esquema, usa `docker compose down -v` para recrearlo.

## Pruebas

96 pruebas automatizadas en 4 niveles (unitarias, base de datos, API y navegador), que corren en GitHub Actions en cada push. Detalle y comandos en [`tests/README.md`](tests/README.md).

```bash
cd backend && npm test        # unitarias, sin Docker ni npm install
```

## API REST

Todas las rutas, excepto `login` y `health`, requieren la cabecera `Authorization: Bearer <token>`.

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/api/health` | Estado del servidor y de la base de datos |
| POST | `/api/auth/login` | `{ email, password }` → `{ token, user }` |
| GET | `/api/auth/me` | Usuario de la sesión |
| GET | `/api/subjects` | Lista de materias |
| GET | `/api/activities` | Actividades del usuario |
| POST | `/api/activities` | Crear: `{ title, type, subjectId, due, description }` |
| PUT | `/api/activities/:id` | Editar (mismos campos) |
| PATCH | `/api/activities/:id/complete` | `{ completed: true \| false }` |
| DELETE | `/api/activities/:id` | Eliminar |

`type` debe ser `Tarea`, `Evaluación`, `Exposición` o `Proyecto`. `due` va en formato ISO 8601.

## Modelo de datos

- **users**: `id`, `email` (único), `name`, `password_hash` (scrypt, nunca texto plano)
- **subjects**: `id`, `name`, `color`, `icon`, `description`
- **activities**: `id` (UUID), `user_id` → users, `subject_id` → subjects, `title`, `type`, `description`, `due`, `completed`, `completed_at`

Cada usuario solo puede ver y modificar sus propias actividades.

## Seguridad

- Las contraseñas se guardan cifradas con scrypt y la sesión usa tokens JWT firmados.
- Secretos y contraseñas viven en `.env`, que **no** se sube a GitHub.
- PostgreSQL solo se publica en `127.0.0.1`, no en la red.
