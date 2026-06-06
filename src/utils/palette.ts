import colorMapping72 from '../app/colorSystemMapping72.json';
import colorMapping96 from '../app/colorSystemMapping96.json';
import colorMapping144 from '../app/colorSystemMapping144.json';
import colorMapping221 from '../app/colorSystemMapping221.json';
import type { PaletteColor, PaletteSize, RgbColor } from '../types';

interface ColorSystemItem {
  MARD: string;
  COCO: string;
  '漫漫': string;
  '盼盼': string;
  '咪小窝': string;
}

type RawPalette = Record<string, ColorSystemItem>;

const paletteMap: Record<PaletteSize, RawPalette> = {
  72: colorMapping72,
  96: colorMapping96,
  144: colorMapping144,
  221: colorMapping221,
};

export function hexToRgb(hex: string): RgbColor {
  const normalized = hex.replace('#', '');
  return {
    r: parseInt(normalized.slice(0, 2), 16),
    g: parseInt(normalized.slice(2, 4), 16),
    b: parseInt(normalized.slice(4, 6), 16),
  };
}

export function loadPalette(size: PaletteSize): PaletteColor[] {
  return Object.entries(paletteMap[size]).map(([hex, item]) => ({
    hex: hex.toUpperCase(),
    mard: item.MARD,
    rgb: hexToRgb(hex),
  }));
}

export function sortMard(a: string, b: string): number {
  const matchA = a.match(/^([A-Z]+)(\d+)$/);
  const matchB = b.match(/^([A-Z]+)(\d+)$/);
  if (!matchA || !matchB) return a.localeCompare(b);
  if (matchA[1] !== matchB[1]) return matchA[1].localeCompare(matchB[1]);
  return Number(matchA[2]) - Number(matchB[2]);
}
