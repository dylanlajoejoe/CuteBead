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

interface RunningRgbTotal {
  r: number;
  g: number;
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

function getLuminance(rgb: RgbColor): number {
  return 0.2126 * rgb.r + 0.7152 * rgb.g + 0.0722 * rgb.b;
}

function blendRgb(base: RgbColor, detail: RgbColor, detailWeight: number): RgbColor {
  const weight = Math.max(0, Math.min(1, detailWeight));
  const baseWeight = 1 - weight;
  return {
    r: Math.round(base.r * baseWeight + detail.r * weight),
    g: Math.round(base.g * baseWeight + detail.g * weight),
    b: Math.round(base.b * baseWeight + detail.b * weight),
  };
}

function stretchContrast(rgb: RgbColor, amount: number): RgbColor {
  const factor = 1 + Math.max(0, amount);
  const stretch = (channel: number) => Math.max(0, Math.min(255, Math.round((channel - 128) * factor + 128)));
  return {
    r: stretch(rgb.r),
    g: stretch(rgb.g),
    b: stretch(rgb.b),
  };
}

function rgbToHsl(rgb: RgbColor): { h: number; s: number; l: number } {
  const r = rgb.r / 255;
  const g = rgb.g / 255;
  const b = rgb.b / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;

  if (max === min) {
    return { h: 0, s: 0, l };
  }

  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = 0;

  switch (max) {
    case r:
      h = (g - b) / d + (g < b ? 6 : 0);
      break;
    case g:
      h = (b - r) / d + 2;
      break;
    default:
      h = (r - g) / d + 4;
      break;
  }

  return { h: h / 6, s, l };
}

function hueToRgb(p: number, q: number, t: number): number {
  let value = t;
  if (value < 0) value += 1;
  if (value > 1) value -= 1;
  if (value < 1 / 6) return p + (q - p) * 6 * value;
  if (value < 1 / 2) return q;
  if (value < 2 / 3) return p + (q - p) * (2 / 3 - value) * 6;
  return p;
}

function hslToRgb(hsl: { h: number; s: number; l: number }): RgbColor {
  const { h, s, l } = hsl;
  if (s === 0) {
    const gray = Math.round(l * 255);
    return { r: gray, g: gray, b: gray };
  }

  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  return {
    r: Math.round(hueToRgb(p, q, h + 1 / 3) * 255),
    g: Math.round(hueToRgb(p, q, h) * 255),
    b: Math.round(hueToRgb(p, q, h - 1 / 3) * 255),
  };
}

function isNearNeutral(rgb: RgbColor): boolean {
  return Math.max(rgb.r, rgb.g, rgb.b) - Math.min(rgb.r, rgb.g, rgb.b) <= 24;
}

function forceHighContrast(rgb: RgbColor): RgbColor {
  const luminance = getLuminance(rgb);
  if (!isNearNeutral(rgb)) return rgb;
  if (luminance <= 78) return { r: 0, g: 0, b: 0 };
  if (luminance >= 222) return { r: 255, g: 255, b: 255 };
  if (luminance <= 118) return stretchContrast(rgb, 0.7);
  if (luminance >= 182) return stretchContrast(rgb, 0.55);
  return stretchContrast(rgb, 0.35);
}

function boostColorPurity(rgb: RgbColor): RgbColor {
  if (isNearNeutral(rgb)) return forceHighContrast(rgb);

  const hsl = rgbToHsl(rgb);
  const boosted = {
    h: hsl.h,
    s: Math.min(1, hsl.s * 1.28 + 0.08),
    l: Math.max(0, Math.min(1, hsl.l < 0.5 ? hsl.l * 0.96 : hsl.l * 1.02)),
  };

  return stretchContrast(hslToRgb(boosted), 0.18);
}

function getRepresentativeColor(imageData: ImageData, startX: number, startY: number, width: number, height: number): RgbColor {
  const data = imageData.data;
  const totals: RunningRgbTotal = { r: 0, g: 0, b: 0 };
  let opaqueCount = 0;
  let darkest: RgbColor = { r: 255, g: 255, b: 255 };
  let darkestLuminance = Infinity;

  for (let y = startY; y < startY + height; y += 1) {
    for (let x = startX; x < startX + width; x += 1) {
      const index = (y * imageData.width + x) * 4;
      if (data[index + 3] < 128) continue;
      const pixel = {
        r: data[index],
        g: data[index + 1],
        b: data[index + 2],
      };
      totals.r += pixel.r;
      totals.g += pixel.g;
      totals.b += pixel.b;
      opaqueCount += 1;

      const luminance = getLuminance(pixel);
      if (luminance < darkestLuminance) {
        darkest = pixel;
        darkestLuminance = luminance;
      }
    }
  }

  if (opaqueCount === 0) return { r: 255, g: 255, b: 255 };

  const average = {
    r: Math.round(totals.r / opaqueCount),
    g: Math.round(totals.g / opaqueCount),
    b: Math.round(totals.b / opaqueCount),
  };
  const averageLuminance = getLuminance(average);

  let darkDetailCount = 0;
  for (let y = startY; y < startY + height; y += 1) {
    for (let x = startX; x < startX + width; x += 1) {
      const index = (y * imageData.width + x) * 4;
      if (data[index + 3] < 128) continue;
      const pixel = {
        r: data[index],
        g: data[index + 1],
        b: data[index + 2],
      };
      if (getLuminance(pixel) < averageLuminance - 50) {
        darkDetailCount += 1;
      }
    }
  }

  const darkRatio = darkDetailCount / opaqueCount;
  const hasStrongDarkDetail = darkRatio >= 0.06 && darkRatio <= 0.38 && darkestLuminance < averageLuminance - 60;
  if (!hasStrongDarkDetail) return boostColorPurity(average);

  const detailWeight = Math.min(0.58, 0.28 + darkRatio * 0.9);
  return boostColorPurity(blendRgb(average, darkest, detailWeight));
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
  const palette = loadPalette(options.paletteSize);
  const boardSize = options.boardSize;
  const sourceCanvas = document.createElement('canvas');
  const sourceCtx = sourceCanvas.getContext('2d');
  if (!sourceCtx) throw new Error('无法创建 Canvas');

  sourceCanvas.width = image.naturalWidth || image.width;
  sourceCanvas.height = image.naturalHeight || image.height;
  sourceCtx.drawImage(image, 0, 0, sourceCanvas.width, sourceCanvas.height);

  const scalePercent = Math.max(10, Math.min(100, options.scalePercent));
  const maxPatternSize = Math.max(1, Math.round(boardSize * (scalePercent / 100)));
  const aspectRatio = sourceCanvas.width / sourceCanvas.height;
  const patternWidth = aspectRatio >= 1 ? maxPatternSize : Math.max(1, Math.round(maxPatternSize * aspectRatio));
  const patternHeight = aspectRatio >= 1 ? Math.max(1, Math.round(maxPatternSize / aspectRatio)) : maxPatternSize;
  const offsetX = Math.floor((boardSize - patternWidth) / 2);
  const offsetY = Math.floor((boardSize - patternHeight) / 2);

  const imageData = sourceCtx.getImageData(0, 0, sourceCanvas.width, sourceCanvas.height);
  const cellWidth = sourceCanvas.width / patternWidth;
  const cellHeight = sourceCanvas.height / patternHeight;

  const cells: PatternCell[][] = [];
  for (let row = 0; row < patternHeight; row += 1) {
    const line: PatternCell[] = [];
    for (let col = 0; col < patternWidth; col += 1) {
      const startX = Math.floor(col * cellWidth);
      const startY = Math.floor(row * cellHeight);
      const endX = Math.min(sourceCanvas.width, Math.ceil((col + 1) * cellWidth));
      const endY = Math.min(sourceCanvas.height, Math.ceil((row + 1) * cellHeight));
      const representative = getRepresentativeColor(imageData, startX, startY, Math.max(1, endX - startX), Math.max(1, endY - startY));
      const closest = findClosestColor(representative, palette);
      line.push({ row, col, hex: closest.hex, mard: closest.mard, rgb: closest.rgb });
    }
    cells.push(line);
  }

  const initialPattern: PatternData = {
    width: patternWidth,
    height: patternHeight,
    boardWidth: boardSize,
    boardHeight: boardSize,
    offsetX,
    offsetY,
    cells,
  };
  const pattern = mergeByFrequency(initialPattern, palette, mergeThresholds[options.mergeLevel]);
  const colorCounts = createColorCounts(pattern);

  return {
    pattern,
    colorCounts,
    totalBeadCount: pattern.width * pattern.height,
  };
}
