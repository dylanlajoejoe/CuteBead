import type { ColorCount, GenerateOptions, GenerateResult, PaletteColor, PatternCell, PatternData, RgbColor } from '../types';
import { loadPalette, sortMard } from './palette';

const mergeThresholds = {
  low: 7,
  medium: 12,
  high: 18,
};

interface OklabColor {
  l: number;
  a: number;
  b: number;
}

function srgbChannelToLinear(channel: number): number {
  const normalized = channel / 255;
  return normalized <= 0.04045 ? normalized / 12.92 : Math.pow((normalized + 0.055) / 1.055, 2.4);
}

function rgbToOklab(rgb: RgbColor): OklabColor {
  const r = srgbChannelToLinear(rgb.r);
  const g = srgbChannelToLinear(rgb.g);
  const b = srgbChannelToLinear(rgb.b);
  const l = 0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b;
  const m = 0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b;
  const s = 0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b;
  const lRoot = Math.cbrt(l);
  const mRoot = Math.cbrt(m);
  const sRoot = Math.cbrt(s);
  return {
    l: 0.2104542553 * lRoot + 0.793617785 * mRoot - 0.0040720468 * sRoot,
    a: 1.9779984951 * lRoot - 2.428592205 * mRoot + 0.4505937099 * sRoot,
    b: 0.0259040371 * lRoot + 0.7827717662 * mRoot - 0.808675766 * sRoot,
  };
}

const oklabCache = new Map<string, OklabColor>();

function getOklab(rgb: RgbColor): OklabColor {
  const key = `${rgb.r},${rgb.g},${rgb.b}`;
  const cached = oklabCache.get(key);
  if (cached) return cached;
  const value = rgbToOklab(rgb);
  oklabCache.set(key, value);
  return value;
}

function colorDistance(a: RgbColor, b: RgbColor): number {
  const c1 = getOklab(a);
  const c2 = getOklab(b);
  const dl = c1.l - c2.l;
  const da = c1.a - c2.a;
  const db = c1.b - c2.b;
  return Math.sqrt(dl * dl + da * da + db * db) * 100;
}

function findClosestColor(rgb: RgbColor, palette: PaletteColor[]): PaletteColor {
  let closest = palette[0];
  let minDistance = Infinity;
  for (const color of palette) {
    const distance = colorDistance(rgb, color.rgb);
    if (distance < minDistance) {
      minDistance = distance;
      closest = color;
    }
  }
  return closest;
}

function getDominantColor(imageData: ImageData, startX: number, startY: number, width: number, height: number): RgbColor {
  const counts = new Map<string, number>();
  const data = imageData.data;
  let bestKey = '255,255,255';
  let bestCount = 0;

  for (let y = startY; y < startY + height; y += 1) {
    for (let x = startX; x < startX + width; x += 1) {
      const index = (y * imageData.width + x) * 4;
      if (data[index + 3] < 128) continue;
      const key = `${data[index]},${data[index + 1]},${data[index + 2]}`;
      const nextCount = (counts.get(key) ?? 0) + 1;
      counts.set(key, nextCount);
      if (nextCount > bestCount) {
        bestCount = nextCount;
        bestKey = key;
      }
    }
  }

  const [r, g, b] = bestKey.split(',').map(Number);
  return { r, g, b };
}

function createColorCounts(pattern: PatternData): ColorCount[] {
  const counts = new Map<string, ColorCount>();
  pattern.cells.flat().forEach((cell) => {
    const existing = counts.get(cell.mard);
    if (existing) {
      existing.count += 1;
      return;
    }
    counts.set(cell.mard, { hex: cell.hex, mard: cell.mard, count: 1 });
  });
  return [...counts.values()].sort((a, b) => sortMard(a.mard, b.mard));
}

function mergeByFrequency(pattern: PatternData, palette: PaletteColor[], threshold: number): PatternData {
  const counts = createColorCounts(pattern);
  const byMard = new Map(palette.map((color) => [color.mard, color]));
  const replaced = new Map<string, PaletteColor>();
  const sorted = counts.sort((a, b) => b.count - a.count);

  for (let i = 0; i < sorted.length; i += 1) {
    const current = byMard.get(sorted[i].mard);
    if (!current || replaced.has(current.mard)) continue;
    for (let j = i + 1; j < sorted.length; j += 1) {
      const lower = byMard.get(sorted[j].mard);
      if (!lower || replaced.has(lower.mard)) continue;
      if (colorDistance(current.rgb, lower.rgb) < threshold) {
        replaced.set(lower.mard, current);
      }
    }
  }

  if (replaced.size === 0) return pattern;

  return {
    ...pattern,
    cells: pattern.cells.map((row) => row.map((cell) => {
      const target = replaced.get(cell.mard);
      if (!target) return cell;
      return { ...cell, hex: target.hex, mard: target.mard, rgb: target.rgb };
    })),
  };
}

export async function loadImageFromFile(file: File): Promise<HTMLImageElement> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('图片读取失败'));
    reader.readAsDataURL(file);
  });

  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('图片加载失败'));
    image.src = dataUrl;
  });
}

export async function generatePattern(image: HTMLImageElement, options: GenerateOptions): Promise<GenerateResult> {
  if (options.width < 1 || options.height < 1 || options.width > 100 || options.height > 100) {
    throw new Error('图纸尺寸必须在 1 到 100 之间');
  }

  const palette = loadPalette(options.paletteSize);
  const sourceCanvas = document.createElement('canvas');
  const sourceCtx = sourceCanvas.getContext('2d');
  if (!sourceCtx) throw new Error('无法创建 Canvas');

  sourceCanvas.width = image.naturalWidth || image.width;
  sourceCanvas.height = image.naturalHeight || image.height;
  sourceCtx.drawImage(image, 0, 0, sourceCanvas.width, sourceCanvas.height);

  const imageData = sourceCtx.getImageData(0, 0, sourceCanvas.width, sourceCanvas.height);
  const cellWidth = sourceCanvas.width / options.width;
  const cellHeight = sourceCanvas.height / options.height;

  const cells: PatternCell[][] = [];
  for (let row = 0; row < options.height; row += 1) {
    const line: PatternCell[] = [];
    for (let col = 0; col < options.width; col += 1) {
      const startX = Math.floor(col * cellWidth);
      const startY = Math.floor(row * cellHeight);
      const endX = Math.min(sourceCanvas.width, Math.ceil((col + 1) * cellWidth));
      const endY = Math.min(sourceCanvas.height, Math.ceil((row + 1) * cellHeight));
      const dominant = getDominantColor(imageData, startX, startY, Math.max(1, endX - startX), Math.max(1, endY - startY));
      const closest = findClosestColor(dominant, palette);
      line.push({ row, col, hex: closest.hex, mard: closest.mard, rgb: closest.rgb });
    }
    cells.push(line);
  }

  const initialPattern: PatternData = { width: options.width, height: options.height, cells };
  const pattern = mergeByFrequency(initialPattern, palette, mergeThresholds[options.mergeLevel]);
  const colorCounts = createColorCounts(pattern);

  return {
    pattern,
    colorCounts,
    totalBeadCount: options.width * options.height,
  };
}
