// Cifrado de contraseñas con scrypt (incluido en Node, sin dependencias nativas).
// Formato guardado: scrypt$<sal en hex>$<hash en hex>
const crypto = require("crypto");
const { promisify } = require("util");

const scrypt = promisify(crypto.scrypt);
const KEY_LENGTH = 64;

async function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = await scrypt(password, salt, KEY_LENGTH);
  return `scrypt$${salt}$${hash.toString("hex")}`;
}

async function verifyPassword(password, stored) {
  const [algorithm, salt, hashHex] = String(stored).split("$");
  if (algorithm !== "scrypt" || !salt || !hashHex) return false;
  const expected = Buffer.from(hashHex, "hex");
  const actual = await scrypt(password, salt, expected.length);
  // Comparación en tiempo constante para no filtrar información.
  return crypto.timingSafeEqual(expected, actual);
}

module.exports = { hashPassword, verifyPassword };
