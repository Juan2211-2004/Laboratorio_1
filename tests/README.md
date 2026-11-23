# Pruebas

| Archivo | Qué prueba |
|---|---|
| `e2e.js` | 17 comprobaciones del frontend en un navegador real (Playwright): login, crear, editar, completar, eliminar, actualización automática de "Vencida", cierre de sesión |
| `mock-api.js` | API simulada con el mismo contrato que el backend, para probar el frontend sin Docker |
| `consultas.sql` | Ejecuta todas las consultas del backend contra PostgreSQL (después de `db/init.sql`) |

## Ejecutar

```bash
npm install -g playwright && npx playwright install chromium
node tests/mock-api.js frontend 8099      # en una terminal
node tests/e2e.js                          # en otra terminal

docker compose exec -T db psql -U academichub -d academichub < tests/consultas.sql
```
