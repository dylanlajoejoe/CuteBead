import type { ColorCount, PatternData } from '../types';
import { sortMard } from './palette';

interface DrawOptions {
  cellSize: number;
  includeStats?: boolean;
  showLabels?: boolean;
}

function getContrastColor(hex: string): string {
  const normalized = hex.replace('#', '');
  const r = parseInt(normalized.slice(0, 2), 16);
  const g = parseInt(normalized.slice(2, 4), 16);
  const b = parseInt(normalized.slice(4, 6), 16);
  const luma = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  return luma > 0.55 ? '#2F2A25' : '#FFFFFF';
}

export function drawPattern(canvas: HTMLCanvasElement, pattern: PatternData, colorCounts: ColorCount[], options: DrawOptions): void {
  const statsWidth = options.includeStats ? 260 : 0;
  const padding = options.includeStats ? 24 : 0;
  const width = pattern.boardWidth * options.cellSize;
  const height = pattern.boardHeight * options.cellSize;
  canvas.width = width + statsWidth + padding;
  canvas.height = Math.max(height, options.includeStats ? 120 + colorCounts.length * 28 : height);

  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  pattern.cells.forEach((row) => {
    row.forEach((cell) => {
      const boardX = (cell.col + pattern.offsetX) * options.cellSize;
      const boardY = (cell.row + pattern.offsetY) * options.cellSize;
      ctx.fillStyle = cell.hex;
      ctx.fillRect(boardX, boardY, options.cellSize, options.cellSize);

      if (options.showLabels !== false && options.cellSize >= 12) {
        ctx.fillStyle = getContrastColor(cell.hex);
        ctx.font = `${Math.max(6, Math.floor(options.cellSize * 0.34))}px Arial, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(cell.mard, boardX + options.cellSize / 2, boardY + options.cellSize / 2);
      }
    });
  });

  drawGrid(ctx, pattern, options.cellSize);

  if (options.includeStats) {
    drawStats(ctx, pattern.boardWidth * options.cellSize + padding, 24, colorCounts);
  }
}

function drawGrid(ctx: CanvasRenderingContext2D, pattern: PatternData, cellSize: number): void {
  for (let col = 0; col <= pattern.boardWidth; col += 1) {
    const x = col * cellSize;
    if (col % 10 === 0) {
      ctx.setLineDash([]);
      ctx.strokeStyle = '#111111';
      ctx.lineWidth = 2;
    } else if (col % 5 === 0) {
      ctx.setLineDash([4, 4]);
      ctx.strokeStyle = 'rgba(47, 42, 37, 0.38)';
      ctx.lineWidth = 0.75;
    } else {
      ctx.setLineDash([]);
      ctx.strokeStyle = 'rgba(47, 42, 37, 0.22)';
      ctx.lineWidth = 0.5;
    }
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, pattern.boardHeight * cellSize);
    ctx.stroke();
  }

  for (let row = 0; row <= pattern.boardHeight; row += 1) {
    const y = row * cellSize;
    if (row % 10 === 0) {
      ctx.setLineDash([]);
      ctx.strokeStyle = '#111111';
      ctx.lineWidth = 2;
    } else if (row % 5 === 0) {
      ctx.setLineDash([4, 4]);
      ctx.strokeStyle = 'rgba(47, 42, 37, 0.38)';
      ctx.lineWidth = 0.75;
    } else {
      ctx.setLineDash([]);
      ctx.strokeStyle = 'rgba(47, 42, 37, 0.22)';
      ctx.lineWidth = 0.5;
    }
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(pattern.boardWidth * cellSize, y);
    ctx.stroke();
  }
  ctx.setLineDash([]);
}

function drawStats(ctx: CanvasRenderingContext2D, x: number, y: number, colorCounts: ColorCount[]): void {
  ctx.fillStyle = '#2F2A25';
  ctx.font = 'bold 18px Arial, sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText('颜色统计', x, y);

  const sorted = [...colorCounts].sort((a, b) => sortMard(a.mard, b.mard));
  ctx.font = '14px Arial, sans-serif';
  sorted.forEach((item, index) => {
    const rowY = y + 34 + index * 28;
    ctx.fillStyle = item.hex;
    ctx.fillRect(x, rowY, 18, 18);
    ctx.strokeStyle = '#E8D8C8';
    ctx.strokeRect(x, rowY, 18, 18);
    ctx.fillStyle = '#2F2A25';
    ctx.fillText(`${item.mard}  x ${item.count}`, x + 28, rowY + 1);
  });
}

export function exportPatternPng(pattern: PatternData, colorCounts: ColorCount[], fileName: string): void {
  const canvas = document.createElement('canvas');
  const cellSize = Math.max(18, Math.min(32, Math.floor(1200 / Math.max(pattern.boardWidth, pattern.boardHeight))));
  drawPattern(canvas, pattern, colorCounts, { cellSize, includeStats: true });
  const link = document.createElement('a');
  link.download = fileName;
  link.href = canvas.toDataURL('image/png');
  link.click();
}
