export const coloringDetails = [
  {
    id: 'simple',
    label: 'Less intricate',
    description: 'Large spaces and a few easy details.',
    instruction:
      'Use very simple compositions, a few large closed shapes, minimal interior details, broad outlines, and spacious backgrounds. Avoid tiny regions and repeated patterns.',
  },
  {
    id: 'balanced',
    label: 'A little detail',
    description: 'A comfortable mix of big and small spaces.',
    instruction:
      'Use moderate detail with a balanced mix of medium and large closed shapes, a few decorative details, and an uncluttered background.',
  },
  {
    id: 'intricate',
    label: 'More intricate',
    description: 'Extra detail with clear, comfortable coloring spaces.',
    instruction:
      'Add extra detail through a limited number of well-spaced decorative shapes inside a clear main subject. Use medium-sized enclosed coloring spaces with only a few smaller accents. Keep the background sparse and leave generous breathing room. Avoid dense repeating patterns, overlapping motifs, tangles, tiny slivers, micro-details, crosshatching, and texture strokes. More intricate means more thoughtfully placed colorable shapes, never a busier or crowded page.',
  },
] as const;
export function coloringInstruction(detail: string) {
  const option = coloringDetails.find((option) => option.id === detail);
  if (!option) throw new Error('Please choose one of the detail levels shown.');
  return `Create a black and white coloring book page with solid, continuous, uniform black outlines and fully closed shapes on a pure white background. Every boundary between adjacent coloring spaces must be unbroken and meet cleanly at its endpoints, with no gaps, dashed lines, sketchy strokes, faint lines, or disconnected decorative marks. Use bold outlines approximately 4–6 pixels wide at 1024px resolution and keep coloring spaces at least 12 pixels across wherever possible. Each shape must have a spacious white interior suitable for tap-to-fill coloring. No gray shading, gradients, color, text, or large solid black areas. Keep a clear visual hierarchy and a sparse background. Prioritize reliable, comfortable coloring over decorative complexity even if the subject asks for many details. Follow the creator’s subject. Detail level: ${option.label}. ${option.instruction}`;
}
export type ColoringPage = {
  id: string;
  title: string;
  outline: string;
  colors: string;
  updatedAt: string;
};
// Normalize AI line art after resizing. Close only tiny raster gaps, then
// reinforce boundaries by one pixel so tap-to-fill does not leak through them.
// This does not reconstruct intentionally open or missing contours.
export function prepareLineArt(
  rgba: Uint8ClampedArray,
  width: number,
  height: number,
) {
  const ink = new Uint8Array(width * height);
  for (let i = 0; i < ink.length; i++) {
    const alpha = rgba[i * 4 + 3] / 255;
    const luminance =
      (rgba[i * 4] * 0.299 +
        rgba[i * 4 + 1] * 0.587 +
        rgba[i * 4 + 2] * 0.114) *
        alpha +
      255 * (1 - alpha);
    ink[i] = luminance < 220 ? 1 : 0;
  }
  function morph(source: Uint8Array, dilate: boolean) {
    const result = new Uint8Array(source.length);
    for (let y = 0; y < height; y++)
      for (let x = 0; x < width; x++) {
        let value = dilate ? 0 : 1;
        for (let dy = -1; dy <= 1; dy++)
          for (let dx = -1; dx <= 1; dx++) {
            const nx = x + dx,
              ny = y + dy;
            // Extend edge pixels rather than wrapping across rows or trimming borders.
            const sample =
              source[
                Math.max(0, Math.min(height - 1, ny)) * width +
                  Math.max(0, Math.min(width - 1, nx))
              ];
            value = dilate ? Math.max(value, sample) : Math.min(value, sample);
          }
        result[y * width + x] = value;
      }
    return result;
  }
  const closed = morph(morph(ink, true), false);
  const output = new Uint8ClampedArray(rgba.length).fill(255);
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      const i = y * width + x;
      const boundary =
        closed[i] ||
        (x > 0 && closed[i - 1]) ||
        (x < width - 1 && closed[i + 1]) ||
        (y > 0 && closed[i - width]) ||
        (y < height - 1 && closed[i + width]);
      output[i * 4] =
        output[i * 4 + 1] =
        output[i * 4 + 2] =
          boundary ? 0 : 255;
    }
  return output;
}
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
