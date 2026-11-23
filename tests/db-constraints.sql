-- ============================================
-- PRUEBAS DE LA BASE DE DATOS (PostgreSQL 16)
-- Verifican que el esquema de db/init.sql rechaza datos inválidos por sí mismo,
-- aunque llegaran sin pasar por la API. Todo corre en una transacción que se
-- deshace al final: la base de datos queda igual que antes.
--
-- Ejecutar:  psql -v ON_ERROR_STOP=1 -U academichub -d academichub -f tests/db-constraints.sql
-- Con Docker: docker compose exec -T db psql -v ON_ERROR_STOP=1 -U academichub -d academichub < tests/db-constraints.sql
-- ============================================
\set QUIET on
\o /dev/null
BEGIN;

-- Ejecuta una sentencia que DEBE fallar con el código SQLSTATE indicado.
CREATE FUNCTION pg_temp.expect_error(name text, stmt text, expected_state text) RETURNS void AS $$
BEGIN
  BEGIN
    EXECUTE stmt;
  EXCEPTION WHEN OTHERS THEN
    IF SQLSTATE = expected_state THEN
      RAISE NOTICE 'OK    %', name;
      RETURN;
    END IF;
    RAISE EXCEPTION 'FALLA %: se esperaba SQLSTATE % y llegó % (%)', name, expected_state, SQLSTATE, SQLERRM;
  END;
  RAISE EXCEPTION 'FALLA %: la sentencia debió fallar y se ejecutó', name;
END $$ LANGUAGE plpgsql;

-- Comprueba una condición booleana.
CREATE FUNCTION pg_temp.expect_true(name text, condition boolean) RETURNS void AS $$
BEGIN
  IF condition IS TRUE THEN
    RAISE NOTICE 'OK    %', name;
  ELSE
    RAISE EXCEPTION 'FALLA %', name;
  END IF;
END $$ LANGUAGE plpgsql;

-- Datos de apoyo (se deshacen con el ROLLBACK final)
INSERT INTO users (id, email, password_hash) VALUES (900001, 'prueba-bd@ejemplo.com', 'scrypt$aa$bb');
INSERT INTO subjects (id, name) VALUES (900001, 'Materia de prueba');

-- ---------- Esquema y datos iniciales ----------
SELECT pg_temp.expect_true('existen las 6 materias iniciales',
  (SELECT count(*) FROM subjects WHERE name IN ('Programación','Bases de datos','Redes','Ingeniería de software','Matemáticas','Otras')) = 6);
SELECT pg_temp.expect_true('existe el índice idx_activities_user_due',
  EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_activities_user_due'));

-- ---------- Valores por defecto ----------
INSERT INTO activities (user_id, subject_id, title, type, due)
VALUES (900001, 900001, 'Con valores por defecto', 'Tarea', NOW() + interval '1 day');
SELECT pg_temp.expect_true('id UUID generado, completed=false, descripción vacía y fechas de control',
  (SELECT id IS NOT NULL AND completed = false AND description = '' AND completed_at IS NULL
          AND created_at IS NOT NULL AND updated_at IS NOT NULL
   FROM activities WHERE title = 'Con valores por defecto'));

-- ---------- Restricciones CHECK y de tipo ----------
SELECT pg_temp.expect_error('CHECK rechaza un tipo no permitido',
  $q$INSERT INTO activities (user_id, subject_id, title, type, due) VALUES (900001, 900001, 'x', 'Examen', NOW())$q$, '23514');
SELECT pg_temp.expect_error('CHECK rechaza un título vacío',
  $q$INSERT INTO activities (user_id, subject_id, title, type, due) VALUES (900001, 900001, '', 'Tarea', NOW())$q$, '23514');
SELECT pg_temp.expect_error('CHECK rechaza un título de solo espacios',
  $q$INSERT INTO activities (user_id, subject_id, title, type, due) VALUES (900001, 900001, '    ', 'Tarea', NOW())$q$, '23514');
SELECT pg_temp.expect_error('VARCHAR(100) rechaza un título de 101 caracteres',
  $q$INSERT INTO activities (user_id, subject_id, title, type, due) VALUES (900001, 900001, repeat('a', 101), 'Tarea', NOW())$q$, '22001');
SELECT pg_temp.expect_error('VARCHAR(500) rechaza una descripción de 501 caracteres',
  $q$INSERT INTO activities (user_id, subject_id, title, type, description, due) VALUES (900001, 900001, 'x', 'Tarea', repeat('a', 501), NOW())$q$, '22001');

-- ---------- NOT NULL ----------
SELECT pg_temp.expect_error('NOT NULL exige fecha de entrega',
  $q$INSERT INTO activities (user_id, subject_id, title, type) VALUES (900001, 900001, 'x', 'Tarea')$q$, '23502');
SELECT pg_temp.expect_error('NOT NULL exige el hash de la contraseña',
  $q$INSERT INTO users (email) VALUES ('sin-clave@ejemplo.com')$q$, '23502');

-- ---------- UNIQUE ----------
SELECT pg_temp.expect_error('UNIQUE impide repetir el correo de un usuario',
  $q$INSERT INTO users (email, password_hash) VALUES ('prueba-bd@ejemplo.com', 'x')$q$, '23505');
SELECT pg_temp.expect_error('UNIQUE impide repetir el nombre de una materia',
  $q$INSERT INTO subjects (name) VALUES ('Redes')$q$, '23505');

-- ---------- Llaves foráneas ----------
SELECT pg_temp.expect_error('FK rechaza un usuario inexistente',
  $q$INSERT INTO activities (user_id, subject_id, title, type, due) VALUES (-1, 900001, 'x', 'Tarea', NOW())$q$, '23503');
SELECT pg_temp.expect_error('FK rechaza una materia inexistente',
  $q$INSERT INTO activities (user_id, subject_id, title, type, due) VALUES (900001, -1, 'x', 'Tarea', NOW())$q$, '23503');
SELECT pg_temp.expect_error('ON DELETE RESTRICT impide borrar una materia con actividades',
  $q$DELETE FROM subjects WHERE id = 900001$q$, '23503');

-- ON DELETE CASCADE: borrar el usuario borra sus actividades.
DELETE FROM users WHERE id = 900001;
SELECT pg_temp.expect_true('ON DELETE CASCADE borra las actividades del usuario eliminado',
  NOT EXISTS (SELECT 1 FROM activities WHERE user_id = 900001));
DELETE FROM subjects WHERE id = 900001;
SELECT pg_temp.expect_true('sin actividades, la materia ya se puede borrar',
  NOT EXISTS (SELECT 1 FROM subjects WHERE id = 900001));

-- ---------- Zona horaria ----------
SELECT pg_temp.expect_true('TIMESTAMPTZ conserva el instante exacto (09:30 Bogotá = 14:30 UTC)',
  ('2026-12-01T09:30:00-05:00'::timestamptz AT TIME ZONE 'UTC') = '2026-12-01 14:30:00'::timestamp);

\echo 'Todas las pruebas de la base de datos pasaron.'
ROLLBACK;
