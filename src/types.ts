export type PaletteSize = 72 | 96 | 144 | 221;
export type MergeLevel = 'low' | 'medium' | 'high';

export interface RgbColor {
  r: number;
  g: number;
  b: number;
}

export interface PaletteColor {
  hex: string;
  mard: string;
  rgb: RgbColor;
}

export interface PatternCell {
  row: number;
  col: number;
  hex: string;
  mard: string;
  rgb: RgbColor;
}

export interface PatternData {
  width: number;
  height: number;
  cells: PatternCell[][];
}

export interface ColorCount {
  hex: string;
  mard: string;
  count: number;
}

export interface GenerateOptions {
  paletteSize: PaletteSize;
  width: number;
  height: number;
  mergeLevel: MergeLevel;
}

export interface GenerateResult {
  pattern: PatternData;
  colorCounts: ColorCount[];
  totalBeadCount: number;
}
