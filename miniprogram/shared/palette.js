const palette72 = require('../assets/palettes/colorSystemMapping72.json');
const palette96 = require('../assets/palettes/colorSystemMapping96.json');
const palette144 = require('../assets/palettes/colorSystemMapping144.json');
const palette221 = require('../assets/palettes/colorSystemMapping221.json');

const paletteMap = {
  72: palette72,
  96: palette96,
  144: palette144,
  221: palette221,
};

function hexToRgb(hex) {
  const normalized = hex.replace('#', '');
  return {
    r: parseInt(normalized.slice(0, 2), 16),
    g: parseInt(normalized.slice(2, 4), 16),
    b: parseInt(normalized.slice(4, 6), 16),
  };
}

function loadPalette(size) {
  return Object.entries(paletteMap[size]).map(([hex, item]) => ({
    hex: hex.toUpperCase(),
    mard: item.MARD,
    rgb: hexToRgb(hex),
  }));
}

function sortMard(a, b) {
  const matchA = a.match(/^([A-Z]+)(\d+)$/);
  const matchB = b.match(/^([A-Z]+)(\d+)$/);
  if (!matchA || !matchB) return a.localeCompare(b);
  if (matchA[1] !== matchB[1]) return matchA[1].localeCompare(matchB[1]);
  return Number(matchA[2]) - Number(matchB[2]);
}

module.exports = {
  hexToRgb,
  loadPalette,
  sortMard,
};
