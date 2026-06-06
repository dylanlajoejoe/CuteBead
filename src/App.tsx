import { ChangeEvent, DragEvent, useEffect, useRef, useState } from 'react';
import type { GenerateResult, MergeLevel, PaletteSize } from './types';
import { exportPatternPng, drawPattern } from './utils/draw';
import { generatePattern, loadImageFromFile } from './utils/pattern';

const paletteSizes: PaletteSize[] = [72, 96, 144, 221];
const mergeLevels: { label: string; value: MergeLevel; description: string }[] = [
  { label: '低', value: 'low', description: '保留更多细节' },
  { label: '中', value: 'medium', description: '推荐默认' },
  { label: '高', value: 'high', description: '减少更多杂色' },
];

interface UploadedImage {
  file: File;
  image: HTMLImageElement;
  previewUrl: string;
}

function App() {
  const [uploadedImage, setUploadedImage] = useState<UploadedImage | null>(null);
  const [paletteSize, setPaletteSize] = useState<PaletteSize>(72);
  const [width, setWidth] = useState(40);
  const [height, setHeight] = useState(40);
  const [mergeLevel, setMergeLevel] = useState<MergeLevel>('medium');
  const [result, setResult] = useState<GenerateResult | null>(null);
  const [error, setError] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (!result || !canvasRef.current) return;
    const cellSize = Math.max(18, Math.min(28, Math.floor(760 / Math.max(result.pattern.width, result.pattern.height))));
    drawPattern(canvasRef.current, result.pattern, result.colorCounts, { cellSize, includeStats: false });
  }, [result]);

  async function handleFile(file: File) {
    setError('');
    if (!file.type.startsWith('image/')) {
      setError('请上传 PNG、JPG 或 WEBP 图片。');
      return;
    }

    try {
      const image = await loadImageFromFile(file);
      setUploadedImage({ file, image, previewUrl: image.src });
      setResult(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : '图片读取失败');
    }
  }

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (file) void handleFile(file);
    event.target.value = '';
  }

  function handleDrop(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    const file = event.dataTransfer.files?.[0];
    if (file) void handleFile(file);
  }

  function updateDimension(type: 'width' | 'height', value: string) {
    const parsed = Number(value);
    const safeValue = Number.isFinite(parsed) ? Math.max(1, Math.min(100, parsed)) : 1;
    if (type === 'width') setWidth(safeValue);
    if (type === 'height') setHeight(safeValue);
  }

  async function handleGenerate() {
    if (!uploadedImage) {
      setError('请先上传图片。');
      return;
    }

    setError('');
    setIsGenerating(true);
    try {
      const nextResult = await generatePattern(uploadedImage.image, { paletteSize, width, height, mergeLevel });
      setResult(nextResult);
    } catch (err) {
      setError(err instanceof Error ? err.message : '生成失败');
    } finally {
      setIsGenerating(false);
    }
  }

  function handleExport() {
    if (!result) return;
    exportPatternPng(result.pattern, result.colorCounts, `cutebead-pattern-${width}x${height}-${paletteSize}.png`);
  }

  return (
    <main className="app-shell">
      <section className="hero-card">
        <div>
          <p className="eyebrow">CuteBead</p>
          <h1>把图片变成清新的拼豆图纸</h1>
          <p className="hero-copy">选择色卡、设置尺寸，一键生成带色号和底板辅助线的拼豆图纸。</p>
        </div>
        <div className="bead-badge" aria-hidden="true">
          {['#8FD694', '#FFB86B', '#FF8FAB', '#CDE8FF', '#FBED56', '#95D3C2', '#FEC0DF', '#FFFFFF', '#35E352'].map((color) => (
            <span key={color} style={{ backgroundColor: color }} />
          ))}
        </div>
      </section>

      <section className="workspace-grid">
        <aside className="control-stack">
          <section className="panel upload-panel">
            <div className="panel-heading">
              <span className="step-dot">1</span>
              <div>
                <h2>上传图片</h2>
                <p>支持 PNG、JPG、WEBP</p>
              </div>
            </div>

            <label className="upload-dropzone" onDragOver={(event) => event.preventDefault()} onDrop={handleDrop}>
              <input type="file" accept="image/png,image/jpeg,image/webp" onChange={handleFileChange} />
              {uploadedImage ? (
                <img src={uploadedImage.previewUrl} alt="上传的原图预览" />
              ) : (
                <span>点击或拖拽图片到这里</span>
              )}
            </label>
          </section>

          <section className="panel">
            <div className="panel-heading">
              <span className="step-dot">2</span>
              <div>
                <h2>设置参数</h2>
                <p>第一版最大 100x100</p>
              </div>
            </div>

            <div className="field-group">
              <label>色卡颜色数</label>
              <div className="segmented-grid">
                {paletteSizes.map((size) => (
                  <button key={size} className={paletteSize === size ? 'active' : ''} onClick={() => setPaletteSize(size)} type="button">
                    {size}色
                  </button>
                ))}
              </div>
            </div>

            <div className="dimension-row">
              <div className="field-group">
                <label htmlFor="pattern-width">宽度</label>
                <input id="pattern-width" type="number" min="1" max="100" value={width} onChange={(event) => updateDimension('width', event.target.value)} />
              </div>
              <div className="field-group">
                <label htmlFor="pattern-height">高度</label>
                <input id="pattern-height" type="number" min="1" max="100" value={height} onChange={(event) => updateDimension('height', event.target.value)} />
              </div>
            </div>

            <div className="field-group">
              <label>合并强度</label>
              <div className="merge-list">
                {mergeLevels.map((level) => (
                  <button key={level.value} className={mergeLevel === level.value ? 'merge-active' : ''} onClick={() => setMergeLevel(level.value)} type="button">
                    <strong>{level.label}</strong>
                    <span>{level.description}</span>
                  </button>
                ))}
              </div>
            </div>

            <button className="primary-button" disabled={!uploadedImage || isGenerating} onClick={handleGenerate} type="button">
              {isGenerating ? '生成中...' : '生成图纸'}
            </button>
            {error && <p className="error-message">{error}</p>}
          </section>

          <section className="panel stats-panel">
            <div className="panel-heading">
              <span className="step-dot">3</span>
              <div>
                <h2>统计导出</h2>
                <p>查看用量并下载 PNG</p>
              </div>
            </div>

            {result ? (
              <>
                <div className="stats-summary">
                  <div><strong>{result.pattern.width}x{result.pattern.height}</strong><span>图纸尺寸</span></div>
                  <div><strong>{result.totalBeadCount}</strong><span>总豆数</span></div>
                  <div><strong>{result.colorCounts.length}</strong><span>颜色数</span></div>
                </div>
                <div className="color-count-list">
                  {result.colorCounts.map((item) => (
                    <div className="color-count-item" key={item.mard}>
                      <span className="color-swatch" style={{ backgroundColor: item.hex }} />
                      <strong>{item.mard}</strong>
                      <span>{item.count} 颗</span>
                    </div>
                  ))}
                </div>
                <button className="secondary-button" onClick={handleExport} type="button">导出 PNG</button>
              </>
            ) : (
              <p className="empty-copy">生成图纸后，这里会显示颜色用量和导出按钮。</p>
            )}
          </section>
        </aside>

        <section className="preview-panel panel">
          <div className="panel-heading preview-heading">
            <div>
              <h2>图纸预览</h2>
              <p>每 5 格虚线，每 10 格黑色实线</p>
            </div>
          </div>
          <div className="canvas-wrap">
            {result ? <canvas ref={canvasRef} /> : <div className="preview-empty">上传图片并生成后，会在这里显示图纸。</div>}
          </div>
        </section>
      </section>
    </main>
  );
}

export default App;
