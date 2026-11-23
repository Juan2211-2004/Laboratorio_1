// Pruebas unitarias de las reglas de validación (sin base de datos ni servidor).
const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const { validateActivity, isUuid, TYPES } = require("../src/validation");

const valid = () => ({
  title: "Entrega ER",
  type: "Proyecto",
  subjectId: 2,
  due: "2026-11-24T14:00:00.000Z",
  description: "Diagrama y script"
});

describe("validateActivity: datos correctos", () => {
  test("acepta una actividad completa y la normaliza", () => {
    const { value, error } = validateActivity(valid());
    assert.equal(error, undefined);
    assert.deepEqual(value, {
      title: "Entrega ER",
      type: "Proyecto",
      description: "Diagrama y script",
      subjectId: 2,
      due: "2026-11-24T14:00:00.000Z"
    });
  });

  test("recorta espacios en título y descripción", () => {
    const { value } = validateActivity({ ...valid(), title: "  Quiz  ", description: "  nota  " });
    assert.equal(value.title, "Quiz");
    assert.equal(value.description, "nota");
  });

  test("la descripción es opcional", () => {
    const { value } = validateActivity({ ...valid(), description: undefined });
    assert.equal(value.description, "");
  });

  test("acepta subjectId enviado como texto numérico", () => {
    assert.equal(validateActivity({ ...valid(), subjectId: "3" }).value.subjectId, 3);
  });

  test("convierte la fecha a ISO 8601 en UTC", () => {
    const { value } = validateActivity({ ...valid(), due: "2026-11-24T09:00:00-05:00" });
    assert.equal(value.due, "2026-11-24T14:00:00.000Z");
  });

  test("acepta los cuatro tipos permitidos", () => {
    for (const type of TYPES) {
      assert.equal(validateActivity({ ...valid(), type }).error, undefined, type);
    }
  });

  test("acepta los límites exactos de longitud", () => {
    assert.equal(validateActivity({ ...valid(), title: "a".repeat(100) }).error, undefined);
    assert.equal(validateActivity({ ...valid(), description: "a".repeat(500) }).error, undefined);
  });
});

describe("validateActivity: datos inválidos", () => {
  const cases = [
    ["título vacío", { title: "" }, /obligatorio/],
    ["título solo con espacios", { title: "   " }, /obligatorio/],
    ["título de 101 caracteres", { title: "a".repeat(101) }, /100 caracteres/],
    ["tipo desconocido", { type: "Examen" }, /tipo/],
    ["tipo con otra capitalización", { type: "tarea" }, /tipo/],
    ["sin materia", { subjectId: undefined }, /materia/],
    ["materia cero", { subjectId: 0 }, /materia/],
    ["materia negativa", { subjectId: -1 }, /materia/],
    ["materia decimal", { subjectId: 1.5 }, /materia/],
    ["materia no numérica", { subjectId: "abc" }, /materia/],
    ["sin fecha", { due: undefined }, /fecha/],
    ["fecha vacía", { due: "" }, /fecha/],
    ["fecha nula", { due: null }, /fecha/],
    ["fecha numérica", { due: 0 }, /fecha/],
    ["fecha imposible", { due: "2026-13-45T99:00" }, /fecha/],
    ["descripción de 501 caracteres", { description: "a".repeat(501) }, /500 caracteres/]
  ];

  for (const [name, change, message] of cases) {
    test(`rechaza ${name}`, () => {
      const result = validateActivity({ ...valid(), ...change });
      assert.equal(result.value, undefined);
      assert.match(result.error, message);
    });
  }

  test("rechaza un cuerpo vacío o ausente", () => {
    assert.match(validateActivity({}).error, /obligatorio/);
    assert.match(validateActivity(undefined).error, /obligatorio/);
    assert.match(validateActivity(null).error, /obligatorio/);
  });
});

describe("isUuid", () => {
  test("acepta UUID válidos en minúsculas y mayúsculas", () => {
    assert.equal(isUuid("67262b92-d7e6-46c0-aed2-e6affff3abbd"), true);
    assert.equal(isUuid("67262B92-D7E6-46C0-AED2-E6AFFFF3ABBD"), true);
  });

  test("rechaza valores que no son UUID", () => {
    for (const value of ["", "123", "not-a-uuid", "67262b92-d7e6-46c0-aed2-e6affff3abb", "' OR 1=1 --", null, undefined, 42]) {
      assert.equal(isUuid(value), false, String(value));
    }
  });
});
