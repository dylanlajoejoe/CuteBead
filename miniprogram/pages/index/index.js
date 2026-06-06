const { BOARD_SIZES, PALETTE_SIZES, MERGE_LEVELS } = require('../../shared/types');
const { generatePatternFromImageData } = require('../../shared/pattern');
const { drawPattern } = require('../../shared/draw');

Page({
  data: {
    boardSizes: BOARD_SIZES,
    paletteSizes: PALETTE_SIZES,
    mergeLevels: MERGE_LEVELS,
    boardSize: 104,
    paletteSize: 72,
    mergeLevel: 'medium',
    scalePercent: 80,
    imagePath: '',
    previewImagePath: '',
    isGenerating: false,
    error: '',
    result: null,
    exportImagePath: '',
    previewCanvasSize: 640,
    previewViewportSize: 640,
  },

  onReady() {
    const { windowWidth } = wx.getWindowInfo();
    const viewport = Math.max(300, Math.min(windowWidth - 40, 720));
    this.setData({ previewViewportSize: viewport, previewCanvasSize: viewport * 2 });
  },

  onChooseImage() {
    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      sizeType: ['compressed'],
      sourceType: ['album'],
      success: (res) => {
        const file = res.tempFiles && res.tempFiles[0];
        if (!file || !file.tempFilePath) {
          this.setData({ error: '图片读取失败' });
          return;
        }
        this.setData({
          imagePath: file.tempFilePath,
          previewImagePath: file.tempFilePath,
          result: null,
          exportImagePath: '',
          error: '',
        });
      },
      fail: () => {
        this.setData({ error: '未选择图片' });
      },
    });
  },

  onBoardSizeChange(event) {
    this.setData({ boardSize: Number(event.currentTarget.dataset.value) });
  },

  onPaletteSizeChange(event) {
    this.setData({ paletteSize: Number(event.currentTarget.dataset.value) });
  },

  onMergeLevelChange(event) {
    this.setData({ mergeLevel: event.currentTarget.dataset.value });
  },

  onScaleChange(event) {
    this.setData({ scalePercent: Number(event.detail.value) });
  },

  async onGenerate() {
    if (!this.data.imagePath || this.data.isGenerating) {
      this.setData({ error: '请先上传图片' });
      return;
    }

    this.setData({ isGenerating: true, error: '' });
    try {
      const imageData = await this.readImageData(this.data.imagePath);
      const result = generatePatternFromImageData(imageData, {
        boardSize: this.data.boardSize,
        paletteSize: this.data.paletteSize,
        mergeLevel: this.data.mergeLevel,
        scalePercent: this.data.scalePercent,
      });
      this.setData({ result });
      await this.drawPreview(result);
      await this.renderExportImage(result);
    } catch (error) {
      this.setData({ error: error && error.message ? error.message : '生成失败' });
    } finally {
      this.setData({ isGenerating: false });
    }
  },

  async onSaveImage() {
    if (!this.data.exportImagePath) {
      this.setData({ error: '请先生成图纸' });
      return;
    }

    try {
      await this.saveImageToAlbum(this.data.exportImagePath);
      wx.showToast({ title: '已保存到相册', icon: 'success' });
    } catch (error) {
      this.setData({ error: '保存失败，请检查相册权限' });
    }
  },

  readImageData(filePath) {
    return new Promise((resolve, reject) => {
      wx.getImageInfo({
        src: filePath,
        success: ({ width, height }) => {
          const canvas = wx.createOffscreenCanvas({ type: '2d', width, height });
          const ctx = canvas.getContext('2d');
          const image = canvas.createImage();
          image.onload = () => {
            ctx.drawImage(image, 0, 0, width, height);
            try {
              const imageData = ctx.getImageData(0, 0, width, height);
              resolve(imageData);
            } catch (error) {
              reject(new Error('无法读取图片像素'));
            }
          };
          image.onerror = () => reject(new Error('图片加载失败'));
          image.src = filePath;
        },
        fail: () => reject(new Error('图片信息读取失败')),
      });
    });
  },

  drawPreview(result) {
    return new Promise((resolve, reject) => {
      wx.nextTick(() => {
        const query = wx.createSelectorQuery();
        query.select('#previewCanvas').fields({ node: true, size: true }).exec((res) => {
          const target = res && res[0];
          if (!target || !target.node) {
            reject(new Error('预览画布初始化失败'));
            return;
          }

          const canvas = target.node;
          const ctx = canvas.getContext('2d');
          const dpr = wx.getWindowInfo().pixelRatio || 2;
          const viewportSize = this.data.previewViewportSize;
          canvas.width = viewportSize * dpr;
          canvas.height = viewportSize * dpr;
          ctx.scale(dpr, dpr);
          const cellSize = Math.max(2, Math.floor(viewportSize / result.pattern.boardWidth));
          drawPattern(ctx, result.pattern, result.colorCounts, {
            cellSize,
            includeStats: false,
            showLabels: cellSize >= 12,
          });
          resolve();
        });
      });
    });
  },

  renderExportImage(result) {
    return new Promise((resolve, reject) => {
      const cellSize = Math.max(14, Math.min(24, Math.floor(1400 / result.pattern.boardWidth)));
      const canvasWidth = result.pattern.boardWidth * cellSize + 284;
      const canvasHeight = Math.max(result.pattern.boardHeight * cellSize, 120 + result.colorCounts.length * 28);
      const canvas = wx.createOffscreenCanvas({ type: '2d', width: canvasWidth, height: canvasHeight });
      const ctx = canvas.getContext('2d');
      drawPattern(ctx, result.pattern, result.colorCounts, {
        cellSize,
        includeStats: true,
        showLabels: cellSize >= 12,
      });

      wx.canvasToTempFilePath({
        canvas,
        width: canvasWidth,
        height: canvasHeight,
        destWidth: canvasWidth,
        destHeight: canvasHeight,
        fileType: 'png',
        success: ({ tempFilePath }) => {
          this.setData({ exportImagePath: tempFilePath });
          resolve(tempFilePath);
        },
        fail: () => reject(new Error('导出图片失败')),
      });
    });
  },

  saveImageToAlbum(filePath) {
    return new Promise((resolve, reject) => {
      wx.saveImageToPhotosAlbum({
        filePath,
        success: resolve,
        fail: reject,
      });
    });
  },
});
