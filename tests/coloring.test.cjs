/* oxlint-disable typescript/no-require-imports -- Matches the Node CommonJS test runner. */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const exportsObj = {};
vm.runInNewContext(
  ts.transpileModule(fs.readFileSync('lib/creative/coloring.ts', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText,
  { exports: exportsObj, Uint8ClampedArray, Uint8Array, Float32Array, Math },
);
const { fillRegion, photoOutline } = exportsObj;
test('fill respects outline boundaries and allows changing an existing color', () => {
  const outline = new Uint8ClampedArray(5 * 5 * 4).fill(255),
    pixels = outline.slice();
  for (let y = 0; y < 5; y++) outline[(y * 5 + 2) * 4] = 0;
  fillRegion(outline, pixels, 5, 5, 0, 0, '#ff0000');
  assert.equal(pixels[0], 255);
  assert.equal(pixels[1], 0);
  assert.equal(pixels[(4 * 5 + 1) * 4 + 1], 0);
  assert.equal(pixels[3 * 4 + 1], 255);
  fillRegion(outline, pixels, 5, 5, 0, 0, '#0000ff');
  assert.deepEqual(Array.from(pixels.slice(0, 4)), [0, 0, 255, 255]);
  assert.equal(pixels[3 * 4 + 1], 255);
  const previous = pixels.slice();
  fillRegion(outline, pixels, 5, 5, 2, 0, '#00ff00');
  assert.deepEqual(pixels, previous);
});
test('photo conversion produces opaque black and white outlines', () => {
  const photo = new Uint8ClampedArray(8 * 8 * 4).fill(255);
  for (let y = 0; y < 8; y++)
    for (let x = 0; x < 4; x++)
      for (let c = 0; c < 3; c++) photo[(y * 8 + x) * 4 + c] = 0;
  const result = photoOutline(photo, 8, 8);
  assert.equal(result[(3 * 8 + 3) * 4], 0);
  assert.equal(result[(3 * 8 + 6) * 4], 255);
  for (let i = 0; i < result.length; i += 4) {
    assert.ok(result[i] === 0 || result[i] === 255);
    assert.equal(result[i + 3], 255);
  }
});
