-- ============================================
-- ACADEMICHUB - ESQUEMA DE BASE DE DATOS (PostgreSQL)
-- Se ejecuta automáticamente la primera vez que arranca el contenedor "db".
-- ============================================

CREATE EXTENSION IF NOT EXISTS pgcrypto; -- para gen_random_uuid()

-- Usuarios. La contraseña se guarda como hash (scrypt), nunca en texto plano.
CREATE TABLE IF NOT EXISTS users (
  id            SERIAL PRIMARY KEY,
  email         VARCHAR(255) NOT NULL UNIQUE,
  name          VARCHAR(100) NOT NULL DEFAULT 'Estudiante',
  password_hash TEXT         NOT NULL,
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- Materias (catálogo común para todos los usuarios).
CREATE TABLE IF NOT EXISTS subjects (
  id          SERIAL PRIMARY KEY,
  name        VARCHAR(100) NOT NULL UNIQUE,
  color       VARCHAR(20)  NOT NULL DEFAULT 'blue',
  icon        VARCHAR(10)  NOT NULL DEFAULT '📚',
  description TEXT         NOT NULL DEFAULT ''
);

-- Actividades: cada una pertenece a un usuario y a una materia.
CREATE TABLE IF NOT EXISTS activities (
  id           UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      INTEGER      NOT NULL REFERENCES users(id)    ON DELETE CASCADE,
  subject_id   INTEGER      NOT NULL REFERENCES subjects(id) ON DELETE RESTRICT,
  title        VARCHAR(100) NOT NULL CHECK (char_length(trim(title)) > 0),
  type         VARCHAR(20)  NOT NULL CHECK (type IN ('Tarea', 'Evaluación', 'Exposición', 'Proyecto')),
  description  VARCHAR(500) NOT NULL DEFAULT '',
  due          TIMESTAMPTZ  NOT NULL,
  completed    BOOLEAN      NOT NULL DEFAULT FALSE,
  completed_at TIMESTAMPTZ,
  created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_activities_user_due ON activities (user_id, due);

-- Materias iniciales.
INSERT INTO subjects (name, color, icon, description) VALUES
  ('Programación',           'blue',   '💻', 'Desarrollo de software y lógica de programación.'),
  ('Bases de datos',         'purple', '🗄️', 'Modelado, consultas y gestión de datos.'),
  ('Redes',                  'green',  '🌐', 'Infraestructura, conectividad y protocolos.'),
  ('Ingeniería de software', 'orange', '🧩', 'Análisis, diseño y calidad de software.'),
  ('Matemáticas',            'pink',   '📐', 'Conceptos matemáticos aplicados.'),
  ('Otras',                  'blue',   '📚', 'Actividades de otras asignaturas.')
ON CONFLICT (name) DO NOTHING;

-- El usuario de demostración NO se crea aquí: lo crea el backend al arrancar
-- a partir de DEMO_EMAIL y DEMO_PASSWORD (archivo .env), ya con la contraseña cifrada.
