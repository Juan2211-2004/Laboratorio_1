\set ON_ERROR_STOP 1
PREPARE ins_user(text,text,text) AS INSERT INTO users (email, name, password_hash) VALUES ($1, $2, $3) ON CONFLICT (email) DO NOTHING;
EXECUTE ins_user('estudiante@academichub.com','Estudiante','scrypt$aa$bb');
EXECUTE ins_user('estudiante@academichub.com','Estudiante','scrypt$aa$bb');
PREPARE login(text) AS SELECT id, email, name, password_hash FROM users WHERE email = $1;
EXECUTE login('estudiante@academichub.com');
PREPARE subj_exists(int) AS SELECT 1 FROM subjects WHERE id = $1;
EXECUTE subj_exists(2);
PREPARE ins_act AS INSERT INTO activities (user_id, subject_id, title, type, description, due) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id;
EXECUTE ins_act(1, 2, 'Entrega ER', 'Evaluación', '', '2026-11-24T14:00:00.000Z');
PREPARE sel(int) AS SELECT a.id, a.title, a.type, a.description, a.due, a.completed, a.completed_at AS "completedAt", a.created_at AS "createdAt", a.subject_id AS "subjectId", s.name AS subject FROM activities a JOIN subjects s ON s.id = a.subject_id WHERE a.user_id = $1 ORDER BY a.due ASC;
EXECUTE sel(1);
PREPARE upd AS UPDATE activities SET subject_id = $1, title = $2, type = $3, description = $4, due = $5, updated_at = NOW() WHERE id = $6 AND user_id = $7;
PREPARE comp AS UPDATE activities SET completed = $1, completed_at = CASE WHEN $1 THEN NOW() ELSE NULL END, updated_at = NOW() WHERE id = $2 AND user_id = $3;
SELECT id AS aid FROM activities LIMIT 1 \gset
EXECUTE upd(3, 'Editada', 'Proyecto', 'desc', '2026-12-01T10:00:00Z', :'aid', 1);
EXECUTE comp(true, :'aid', 1);
EXECUTE sel(1);
EXECUTE comp(false, :'aid', 1);
EXECUTE comp(true, :'aid', 999);
PREPARE del AS DELETE FROM activities WHERE id = $1 AND user_id = $2;
EXECUTE del(:'aid', 1);
EXECUTE sel(1);
