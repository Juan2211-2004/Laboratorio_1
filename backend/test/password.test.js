// Pruebas unitarias del cifrado de contraseñas (scrypt).
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { hashPassword, verifyPassword } = require("../src/password");

test("el hash tiene el formato scrypt$<sal>$<hash> y no contiene la contraseña", async () => {
  const stored = await hashPassword("Academic123");
  assert.match(stored, /^scrypt\$[0-9a-f]{32}\$[0-9a-f]{128}$/);
  assert.equal(stored.includes("Academic123"), false);
});

test("verifica la contraseña correcta", async () => {
  const stored = await hashPassword("Academic123");
  assert.equal(await verifyPassword("Academic123", stored), true);
});

test("rechaza una contraseña incorrecta o con otra capitalización", async () => {
  const stored = await hashPassword("Academic123");
  assert.equal(await verifyPassword("academic123", stored), false);
  assert.equal(await verifyPassword("", stored), false);
});

test("dos hashes de la misma contraseña son distintos (sal aleatoria)", async () => {
  const a = await hashPassword("Academic123");
  const b = await hashPassword("Academic123");
  assert.notEqual(a, b);
  assert.equal(await verifyPassword("Academic123", a), true);
  assert.equal(await verifyPassword("Academic123", b), true);
});

test("un hash guardado mal formado nunca valida", async () => {
  for (const stored of ["", "texto-plano", "bcrypt$aa$bb", "scrypt$solo-sal", null, undefined]) {
    assert.equal(await verifyPassword("Academic123", stored), false, String(stored));
  }
});

test("admite contraseñas con caracteres especiales y acentos", async () => {
  const stored = await hashPassword("Contraseña_ñ@2026!");
  assert.equal(await verifyPassword("Contraseña_ñ@2026!", stored), true);
});
