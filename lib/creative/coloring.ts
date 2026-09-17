export type ColoringPage = {
  id: string;
  title: string;
  outline: string;
  colors: string;
  updatedAt: string;
};
export function photoOutline(
  rgba: Uint8ClampedArray,
  width: number,
  height: number,
  threshold = 28,
) {
  const gray = new Float32Array(width * height);
  for (let i = 0; i < gray.length; i++)
    gray[i] =
      rgba[i * 4] * 0.299 + rgba[i * 4 + 1] * 0.587 + rgba[i * 4 + 2] * 0.114;
  const output = new Uint8ClampedArray(rgba.length).fill(255);
  for (let y = 1; y < height - 1; y++)
    for (let x = 1; x < width - 1; x++) {
      const i = y * width + x;
      const gx =
        -gray[i - width - 1] +
        gray[i - width + 1] -
        2 * gray[i - 1] +
        2 * gray[i + 1] -
        gray[i + width - 1] +
        gray[i + width + 1];
      const gy =
        -gray[i - width - 1] -
        2 * gray[i - width] -
        gray[i - width + 1] +
        gray[i + width - 1] +
        2 * gray[i + width] +
        gray[i + width + 1];
      const value = Math.hypot(gx, gy) > threshold * 4 ? 0 : 255;
      output[i * 4] = output[i * 4 + 1] = output[i * 4 + 2] = value;
    }
  return output;
}
// Boundaries come from the original outline, so a region can be recolored freely.
export function fillRegion(
  outline: Uint8ClampedArray,
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
  x: number,
  y: number,
  color: string,
) {
  if (x < 0 || y < 0 || x >= width || y >= height) return;
  const start = y * width + x;
  if (outline[start * 4] < 128) return;
  const rgb = [1, 3, 5].map((i) => parseInt(color.slice(i, i + 2), 16));
  const visited = new Uint8Array(width * height),
    stack = [start];
  visited[start] = 1;
  while (stack.length) {
    const i = stack.pop()!;
    if (outline[i * 4] < 128) continue;
    for (let c = 0; c < 3; c++) pixels[i * 4 + c] = rgb[c];
    pixels[i * 4 + 3] = 255;
    const px = i % width,
      py = Math.floor(i / width);
    for (const n of [
      px > 0 ? i - 1 : -1,
      px < width - 1 ? i + 1 : -1,
      py > 0 ? i - width : -1,
      py < height - 1 ? i + width : -1,
    ])
      if (n >= 0 && !visited[n]) {
        visited[n] = 1;
        stack.push(n);
      }
  }
}
