import { ChangeEvent, DragEvent, useEffect, useRef, useState } from 'react';
import type { BoardSize, GenerateResult, MergeLevel, PaletteSize } from './types';
import { exportPatternPng, drawPattern } from './utils/draw';
import { generatePattern, loadImageFromFile } from './utils/pattern';

const paletteSizes: PaletteSize[] = [72, 96, 144, 221];
const boardSizes: BoardSize[] = [52, 78, 104, 156, 208];
const mergeLevels: { label: string; value: MergeLevel }[] = [
  { label: '高', value: 'low' },
  { label: '中', value: 'medium' },
  { label: '低', value: 'high' },
];

interface UploadedImage {
  file: File;
  image: HTMLImageElement;
  previewUrl: string;
}

function App() {
  const [uploadedImage, setUploadedImage] = useState<UploadedImage | null>(null);
  const [boardSize, setBoardSize] = useState<BoardSize>(104);
  const [paletteSize, setPaletteSize] = useState<PaletteSize>(72);
  const [scalePercent, setScalePercent] = useState(80);
  const [mergeLevel, setMergeLevel] = useState<MergeLevel>('medium');
  const [result, setResult] = useState<GenerateResult | null>(null);
  const [error, setError] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const canvasWrapRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!result || !canvasRef.current || !canvasWrapRef.current) return;

    const redraw = () => {
      if (!canvasRef.current || !canvasWrapRef.current) return;
      const wrap = canvasWrapRef.current;
      const availableWidth = Math.max(240, wrap.clientWidth - 36);
      const availableHeight = Math.max(240, wrap.clientHeight - 36);
      const cellSize = Math.max(
        3,
        Math.floor(Math.min(availableWidth / result.pattern.boardWidth, availableHeight / result.pattern.boardHeight)),
      );
      drawPattern(canvasRef.current, result.pattern, result.colorCounts, { cellSize, includeStats: false, showLabels: false });
    };

    redraw();
    window.addEventListener('resize', redraw);
    return () => window.removeEventListener('resize', redraw);
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

  async function handleGenerate() {
    if (!uploadedImage) {
      setError('请先上传图片。');
      return;
    }

    setError('');
    setIsGenerating(true);
    try {
      const nextResult = await generatePattern(uploadedImage.image, { boardSize, paletteSize, mergeLevel, scalePercent });
      setResult(nextResult);
    } catch (err) {
      setError(err instanceof Error ? err.message : '生成失败');
    } finally {
      setIsGenerating(false);
    }
  }

  function handleExport() {
    if (!result) return;
    exportPatternPng(result.pattern, result.colorCounts, `cutebead-pattern-${result.pattern.boardWidth}x${result.pattern.boardHeight}-${paletteSize}.png`);
  }

  return (
    <main className="app-shell">
      <section className="hero-card">
        <div>
          <p className="eyebrow">CuteBead</p>
          <h1>把图片变成清新的拼豆图纸</h1>
          <p className="hero-copy">选择色卡、底板尺寸和图案大小，一键生成保持原图比例的拼豆板图纸。</p>
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

          <section className="panel settings-panel">
            <div className="panel-heading">
              <span className="step-dot">2</span>
              <div>
                <h2>设置参数</h2>
                <p>选择色卡、底板和图案大小</p>
              </div>
            </div>

            <div className="field-group">
              <label>拼豆底板</label>
              <div className="segmented-grid">
                {boardSizes.map((size) => (
                  <button key={size} className={boardSize === size ? 'active' : ''} onClick={() => setBoardSize(size)} type="button">{size}</button>
                ))}
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

            <div className="field-group">
              <div className="range-label-row">
                <label htmlFor="scalePercent">图案大小</label>
                <strong>{scalePercent}%</strong>
              </div>
              <input
                id="scalePercent"
                className="range-input"
                type="range"
                min="10"
                max="100"
                step="5"
                value={scalePercent}
                onChange={(event) => setScalePercent(Number(event.target.value))}
              />
              <p className="field-hint">控制图片占底板的最大比例，不改变图片原始比例。</p>
            </div>

            <div className="field-group">
              <label>细节保留</label>
              <div className="merge-list">
                {mergeLevels.map((level) => (
                  <button key={level.value} className={mergeLevel === level.value ? 'merge-active' : ''} onClick={() => setMergeLevel(level.value)} type="button">
                    <strong>{level.label}</strong>
                  </button>
                ))}
              </div>
            </div>

            <button className="primary-button" disabled={!uploadedImage || isGenerating} onClick={handleGenerate} type="button">
              {isGenerating ? '生成中...' : '生成图纸'}
            </button>
            {error && <p className="error-message">{error}</p>}
          </section>
        </aside>

        <section className="preview-stack">
          <section className="preview-meta panel stats-panel">
            <div className="panel-heading">
              <span className="step-dot">3</span>
              <div>
                <h2>导出图片</h2>
                <p>生成后导出 PNG 图纸</p>
              </div>
            </div>

            {result ? (
              <>
                <p className="export-copy">当前图纸已生成，可以直接导出 PNG 图片。</p>
                <button className="secondary-button" onClick={handleExport} type="button">导出 PNG</button>
              </>
            ) : (
              <p className="empty-copy">生成图纸后，这里会显示导出按钮。</p>
            )}
          </section>

          <section className="preview-panel panel">
            <div className="panel-heading preview-heading">
              <div>
                <h2>图纸预览</h2>
              </div>
            </div>
            <div className="canvas-wrap" ref={canvasWrapRef}>
              {result ? <canvas ref={canvasRef} /> : <div className="preview-empty">上传图片并生成后，会在这里显示图纸。</div>}
            </div>
          </section>
        </section>
      </section>
    </main>
  );
}

export default App;
