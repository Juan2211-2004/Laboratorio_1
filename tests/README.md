# Pruebas de AcademicHub

Cuatro niveles, de lo más rápido y aislado a lo más completo. Ninguno necesita librerías de pruebas externas: todos usan el runner `node:test` que trae Node 22, `psql` o Playwright.

| Nivel | Archivo | Qué verifica | Pruebas |
|---|---|---|---|
| Unitarias | `backend/test/validation.test.js` | Reglas de validación de actividades e ids (límites, tipos, fechas, UUID) | 26 |
| Unitarias | `backend/test/password.test.js` | Cifrado scrypt: formato, sal aleatoria, verificación, hashes corruptos | 6 |
| Base de datos | `tests/db-constraints.sql` | `CHECK`, `NOT NULL`, `UNIQUE`, llaves foráneas, `CASCADE`, `RESTRICT`, índice, zona horaria | 18 |
| Integración API | `tests/api.test.js` | Contrato HTTP de punta a punta: login, JWT, CRUD, códigos 400/401/404/413, inyección, aislamiento entre usuarios | 29 |
| Navegador (E2E) | `tests/e2e.js` | Flujo real en Chromium: login, crear, editar, completar, eliminar, "Vencida" sin recargar, persistencia | 17 |

**Total: 96 pruebas.**

## Ejecutarlas

```bash
# 1. Unitarias (sin Docker, sin npm install)
cd backend && npm test && cd ..

# 2. Levantar el sistema completo
cp .env.example .env
docker compose up -d --build --wait

# 3. Base de datos (corre en una transacción que se deshace: no deja datos)
docker compose exec -T db psql -v ON_ERROR_STOP=1 -U academichub -d academichub < tests/db-constraints.sql

# 4. API (JWT_SECRET habilita las pruebas de token vencido y de aislamiento)
JWT_SECRET=<el de tu .env> node --test tests/api.test.js

# 5. Navegador
npm install --no-save playwright && npx playwright install chromium
E2E_URL=http://localhost:8080 node tests/e2e.js
```

## Sin Docker

`tests/mock-api.js` es un doble del backend con el mismo contrato: usa el mismo módulo de validación del backend y firma tokens JWT reales. Sirve para correr las pruebas de API y E2E sin base de datos:

```bash
JWT_SECRET=mock-secret node tests/mock-api.js frontend 8099 &
API_URL=http://localhost:8099 JWT_SECRET=mock-secret node --test tests/api.test.js
node tests/e2e.js
```

## Integración continua

`.github/workflows/ci.yml` corre todo en GitHub Actions en cada push: primero las unitarias y luego, con `docker compose`, las de base de datos, API y navegador contra el sistema real. Si algo falla, el job muestra los logs de los contenedores.

## Errores que encontraron estas pruebas

| Prueba | Error | Corrección |
|---|---|---|
| `validation.test.js` → "rechaza fecha nula" | `due: null` o `due: 0` se aceptaban y guardaban como 1 de enero de 1970 | La fecha solo se acepta como texto no vacío |
| `api.test.js` → "cuerpo de más de 20 KB" | Una petición demasiado grande respondía 500 | Ahora responde `413` con un mensaje claro |
| Revisión de `e2e.js` | El script terminaba con código 0 aunque fallara un chequeo, y "Datos persisten" siempre pasaba | Sale con código 1 ante cualquier fallo y compara los datos antes y después de recargar |
