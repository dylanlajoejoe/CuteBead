const BOARD_SIZES = [52, 78, 104, 208];
const PALETTE_SIZES = [72, 96, 144, 221];
const MERGE_LEVELS = [
  { label: '低', value: 'low', description: '保留更多细节' },
  { label: '中', value: 'medium', description: '推荐默认' },
  { label: '高', value: 'high', description: '减少更多杂色' },
];

module.exports = {
  BOARD_SIZES,
  PALETTE_SIZES,
  MERGE_LEVELS,
};
