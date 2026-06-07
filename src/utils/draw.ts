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
  const padding = options.includeStats ? 24 : 0;
  const width = pattern.boardWidth * options.cellSize;
  const height = pattern.boardHeight * options.cellSize;
  const statsHeight = options.includeStats ? getStatsHeight(width, colorCounts.length, padding) : 0;
  canvas.width = width;
  canvas.height = height + statsHeight;

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
    drawStats(ctx, 0, height, width, colorCounts, padding);
  }
}

function getStatsHeight(width: number, itemCount: number, padding: number): number {
  const cardWidth = 132;
  const gap = 12;
  const columns = Math.max(1, Math.floor((width - padding * 2 + gap) / (cardWidth + gap)));
  const rows = Math.ceil(itemCount / columns);
  const titleHeight = 44;
  const cardHeight = 58;
  return padding + titleHeight + rows * cardHeight + Math.max(0, rows - 1) * gap + padding;
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

function drawStats(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, colorCounts: ColorCount[], padding: number): void {
  const cardWidth = 132;
  const cardHeight = 58;
  const gap = 12;
  const startX = x + padding;
  const startY = y + padding;
  const columns = Math.max(1, Math.floor((width - padding * 2 + gap) / (cardWidth + gap)));

  ctx.fillStyle = '#F7F3ED';
  ctx.fillRect(x, y, width, getStatsHeight(width, colorCounts.length, padding));
  ctx.fillStyle = '#2F2A25';
  ctx.font = 'bold 18px Arial, sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText('拼豆统计', startX, startY);

  const sorted = [...colorCounts].sort((a, b) => sortMard(a.mard, b.mard));
  sorted.forEach((item, index) => {
    const column = index % columns;
    const row = Math.floor(index / columns);
    const cardX = startX + column * (cardWidth + gap);
    const cardY = startY + 34 + row * (cardHeight + gap);

    ctx.fillStyle = '#FFFFFF';
    ctx.shadowColor = 'rgba(47, 42, 37, 0.08)';
    ctx.shadowBlur = 8;
    ctx.shadowOffsetY = 2;
    roundRect(ctx, cardX, cardY, cardWidth, cardHeight, 14);
    ctx.fill();
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;

    ctx.fillStyle = item.hex;
    ctx.beginPath();
    ctx.arc(cardX + 20, cardY + cardHeight / 2, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(47, 42, 37, 0.14)';
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.fillStyle = '#2F2A25';
    ctx.font = 'bold 14px Arial, sans-serif';
    ctx.fillText(item.mard, cardX + 36, cardY + 13);
    ctx.font = '12px Arial, sans-serif';
    ctx.fillStyle = '#776B60';
    ctx.fillText(`x ${item.count}`, cardX + 36, cardY + 32);
  });
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number): void {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + width - r, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + r);
  ctx.lineTo(x + width, y + height - r);
  ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
  ctx.lineTo(x + r, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
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
