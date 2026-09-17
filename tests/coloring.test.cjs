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
const { fillRegion, photoOutline, prepareLineArt, coloringInstruction } =
  exportsObj;
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

test('AI outline cleanup closes a tiny gap in a faint boundary and prevents fill leaking', () => {
  const width = 24,
    height = 24,
    input = new Uint8ClampedArray(width * height * 4).fill(255);
  const ink = (x, y) => {
    const i = (y * width + x) * 4;
    input[i] = input[i + 1] = input[i + 2] = 200;
  };
  for (let x = 4; x <= 19; x++) {
    ink(x, 4);
    ink(x, 19);
  }
  for (let y = 4; y <= 19; y++) {
    ink(4, y);
    ink(19, y);
  }
  for (const x of [10, 11]) {
    const i = (4 * width + x) * 4;
    input[i] = input[i + 1] = input[i + 2] = 255;
  }
  const outline = prepareLineArt(input, width, height),
    colors = new Uint8ClampedArray(input.length).fill(255);
  assert.equal(outline[(4 * width + 10) * 4], 0);
  assert.equal(outline[(12 * width + 12) * 4], 255);
  fillRegion(outline, colors, width, height, 12, 12, '#ff0000');
  assert.equal(colors[(12 * width + 12) * 4 + 1], 0);
  assert.equal(colors[(2 * width + 12) * 4 + 1], 255);
  assert.equal(colors[(12 * width + 22) * 4 + 1], 255);
});
test('outline cleanup keeps blank and transparent backgrounds white and does not wrap across rows', () => {
  const blank = new Uint8ClampedArray(10 * 10 * 4).fill(255);
  assert.deepEqual(prepareLineArt(blank, 10, 10), blank);
  const transparent = new Uint8ClampedArray(blank.length);
  assert.deepEqual(prepareLineArt(transparent, 10, 10), blank);
  for (let y = 0; y < 10; y++)
    for (let c = 0; c < 3; c++) blank[(y * 10 + 9) * 4 + c] = 0;
  const outline = prepareLineArt(blank, 10, 10);
  assert.equal(outline[5 * 10 * 4], 255);
  assert.equal(outline[(5 * 10 + 9) * 4], 0);
});
test('every detail level prioritizes solid boundaries and intricate pages limit visual density', () => {
  for (const detail of ['simple', 'balanced', 'intricate']) {
    const prompt = coloringInstruction(detail);
    assert.match(prompt, /solid, continuous, uniform black outlines/);
    assert.match(prompt, /no gaps/);
    assert.match(prompt, /at least 12 pixels/);
  }
  assert.match(coloringInstruction('intricate'), /Keep the background sparse/);
  assert.match(
    coloringInstruction('intricate'),
    /Avoid dense repeating patterns/,
  );
});
