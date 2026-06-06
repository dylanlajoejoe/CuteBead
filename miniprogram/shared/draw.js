const { sortMard } = require('./palette');

function getContrastColor(hex) {
  const normalized = hex.replace('#', '');
  const r = parseInt(normalized.slice(0, 2), 16);
  const g = parseInt(normalized.slice(2, 4), 16);
  const b = parseInt(normalized.slice(4, 6), 16);
  const luma = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  return luma > 0.55 ? '#2F2A25' : '#FFFFFF';
}

function drawGrid(ctx, pattern, cellSize) {
  for (let col = 0; col <= pattern.boardWidth; col += 1) {
    const x = col * cellSize;
    if (col % 10 === 0) {
      ctx.setLineDash([]);
      ctx.setStrokeStyle('#111111');
      ctx.setLineWidth(2);
    } else if (col % 5 === 0) {
      ctx.setLineDash([4, 4]);
      ctx.setStrokeStyle('rgba(47, 42, 37, 0.38)');
      ctx.setLineWidth(0.75);
    } else {
      ctx.setLineDash([]);
      ctx.setStrokeStyle('rgba(47, 42, 37, 0.22)');
      ctx.setLineWidth(0.5);
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
      ctx.setStrokeStyle('#111111');
      ctx.setLineWidth(2);
    } else if (row % 5 === 0) {
      ctx.setLineDash([4, 4]);
      ctx.setStrokeStyle('rgba(47, 42, 37, 0.38)');
      ctx.setLineWidth(0.75);
    } else {
      ctx.setLineDash([]);
      ctx.setStrokeStyle('rgba(47, 42, 37, 0.22)');
      ctx.setLineWidth(0.5);
    }
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(pattern.boardWidth * cellSize, y);
    ctx.stroke();
  }
  ctx.setLineDash([]);
}

function drawStats(ctx, x, y, colorCounts) {
  ctx.setFillStyle('#2F2A25');
  ctx.setFontSize(18);
  ctx.fillText('颜色统计', x, y);

  const sorted = [...colorCounts].sort((a, b) => sortMard(a.mard, b.mard));
  ctx.setFontSize(14);
  sorted.forEach((item, index) => {
    const rowY = y + 34 + index * 28;
    ctx.setFillStyle(item.hex);
    ctx.fillRect(x, rowY, 18, 18);
    ctx.setStrokeStyle('#E8D8C8');
    ctx.strokeRect(x, rowY, 18, 18);
    ctx.setFillStyle('#2F2A25');
    ctx.fillText(`${item.mard} x ${item.count}`, x + 28, rowY + 14);
  });
}

function drawPattern(ctx, pattern, colorCounts, options) {
  const statsWidth = options.includeStats ? 260 : 0;
  const padding = options.includeStats ? 24 : 0;
  const width = pattern.boardWidth * options.cellSize;
  const height = pattern.boardHeight * options.cellSize;
  const canvasWidth = width + statsWidth + padding;
  const canvasHeight = Math.max(height, options.includeStats ? 120 + colorCounts.length * 28 : height);

  ctx.clearRect(0, 0, canvasWidth, canvasHeight);
  ctx.setFillStyle('#FFFFFF');
  ctx.fillRect(0, 0, canvasWidth, canvasHeight);

  pattern.cells.forEach((row) => {
    row.forEach((cell) => {
      const boardX = (cell.col + pattern.offsetX) * options.cellSize;
      const boardY = (cell.row + pattern.offsetY) * options.cellSize;
      ctx.setFillStyle(cell.hex);
      ctx.fillRect(boardX, boardY, options.cellSize, options.cellSize);

      if (options.showLabels !== false && options.cellSize >= 12) {
        ctx.setFillStyle(getContrastColor(cell.hex));
        ctx.setFontSize(Math.max(6, Math.floor(options.cellSize * 0.34)));
        ctx.setTextAlign('center');
        ctx.setTextBaseline('middle');
        ctx.fillText(cell.mard, boardX + options.cellSize / 2, boardY + options.cellSize / 2);
      }
    });
  });

  drawGrid(ctx, pattern, options.cellSize);
  if (options.includeStats) {
    drawStats(ctx, width + padding, 24, colorCounts);
  }
  return { width: canvasWidth, height: canvasHeight };
}

module.exports = {
  drawPattern,
};
