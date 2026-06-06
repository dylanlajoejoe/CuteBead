const { loadPalette, sortMard } = require('./palette');

const mergeThresholds = {
  low: 7,
  medium: 12,
  high: 18,
};

const oklabCache = new Map();

function srgbChannelToLinear(channel) {
  const normalized = channel / 255;
  return normalized <= 0.04045 ? normalized / 12.92 : Math.pow((normalized + 0.055) / 1.055, 2.4);
}

function rgbToOklab(rgb) {
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

function getOklab(rgb) {
  const key = `${rgb.r},${rgb.g},${rgb.b}`;
  const cached = oklabCache.get(key);
  if (cached) return cached;
  const value = rgbToOklab(rgb);
  oklabCache.set(key, value);
  return value;
}

function colorDistance(a, b) {
  const c1 = getOklab(a);
  const c2 = getOklab(b);
  const dl = c1.l - c2.l;
  const da = c1.a - c2.a;
  const db = c1.b - c2.b;
  return Math.sqrt(dl * dl + da * da + db * db) * 100;
}

function findClosestColor(rgb, palette) {
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

function getLuminance(rgb) {
  return 0.2126 * rgb.r + 0.7152 * rgb.g + 0.0722 * rgb.b;
}

function blendRgb(base, detail, detailWeight) {
  const weight = Math.max(0, Math.min(1, detailWeight));
  const baseWeight = 1 - weight;
  return {
    r: Math.round(base.r * baseWeight + detail.r * weight),
    g: Math.round(base.g * baseWeight + detail.g * weight),
    b: Math.round(base.b * baseWeight + detail.b * weight),
  };
}

function getRepresentativeColor(imageData, startX, startY, width, height) {
  const data = imageData.data;
  const totals = { r: 0, g: 0, b: 0 };
  let opaqueCount = 0;
  let darkest = { r: 255, g: 255, b: 255 };
  let darkestLuminance = Infinity;

  for (let y = startY; y < startY + height; y += 1) {
    for (let x = startX; x < startX + width; x += 1) {
      const index = (y * imageData.width + x) * 4;
      if (data[index + 3] < 128) continue;
      const pixel = { r: data[index], g: data[index + 1], b: data[index + 2] };
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
      const pixel = { r: data[index], g: data[index + 1], b: data[index + 2] };
      if (getLuminance(pixel) < averageLuminance - 50) {
        darkDetailCount += 1;
      }
    }
  }

  const darkRatio = darkDetailCount / opaqueCount;
  const hasStrongDarkDetail = darkRatio >= 0.06 && darkRatio <= 0.38 && darkestLuminance < averageLuminance - 60;
  if (!hasStrongDarkDetail) return average;

  const detailWeight = Math.min(0.58, 0.28 + darkRatio * 0.9);
  return blendRgb(average, darkest, detailWeight);
}

function createColorCounts(pattern) {
  const counts = new Map();
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

function mergeByFrequency(pattern, palette, threshold) {
  const counts = createColorCounts(pattern);
  const byMard = new Map(palette.map((color) => [color.mard, color]));
  const replaced = new Map();
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

function generatePatternFromImageData(imageData, options) {
  const palette = loadPalette(options.paletteSize);
  const boardSize = options.boardSize;
  const sourceWidth = imageData.width;
  const sourceHeight = imageData.height;
  const scalePercent = Math.max(10, Math.min(100, options.scalePercent));
  const maxPatternSize = Math.max(1, Math.round(boardSize * (scalePercent / 100)));
  const aspectRatio = sourceWidth / sourceHeight;
  const patternWidth = aspectRatio >= 1 ? maxPatternSize : Math.max(1, Math.round(maxPatternSize * aspectRatio));
  const patternHeight = aspectRatio >= 1 ? Math.max(1, Math.round(maxPatternSize / aspectRatio)) : maxPatternSize;
  const offsetX = Math.floor((boardSize - patternWidth) / 2);
  const offsetY = Math.floor((boardSize - patternHeight) / 2);
  const cellWidth = sourceWidth / patternWidth;
  const cellHeight = sourceHeight / patternHeight;

  const cells = [];
  for (let row = 0; row < patternHeight; row += 1) {
    const line = [];
    for (let col = 0; col < patternWidth; col += 1) {
      const startX = Math.floor(col * cellWidth);
      const startY = Math.floor(row * cellHeight);
      const endX = Math.min(sourceWidth, Math.ceil((col + 1) * cellWidth));
      const endY = Math.min(sourceHeight, Math.ceil((row + 1) * cellHeight));
      const representative = getRepresentativeColor(imageData, startX, startY, Math.max(1, endX - startX), Math.max(1, endY - startY));
      const closest = findClosestColor(representative, palette);
      line.push({ row, col, hex: closest.hex, mard: closest.mard, rgb: closest.rgb });
    }
    cells.push(line);
  }

  const initialPattern = {
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

module.exports = {
  createColorCounts,
  generatePatternFromImageData,
};
