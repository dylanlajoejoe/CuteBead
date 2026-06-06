# 接口规范文档

## 1. 说明

第一版不做后端接口，所有功能都在浏览器端完成。

这里的“接口”指前端模块之间的数据结构和调用约定。

## 2. 色卡配置

色卡文件位置：

- `src/app/colorSystemMapping72.json`
- `src/app/colorSystemMapping96.json`
- `src/app/colorSystemMapping144.json`
- `src/app/colorSystemMapping221.json`

色卡格式：

```ts
Record<string, ColorSystemItem>
```

示例：

```json
{
  "#FEFF8B": { "MARD": "A03", "COCO": "E05", "漫漫": "B2", "盼盼": "28", "咪小窝": "28" }
}
```

第一版只使用 `MARD`。

## 3. 类型定义

### PaletteSize

```ts
type PaletteSize = 72 | 96 | 144 | 221;
```

### PaletteColor

```ts
interface PaletteColor {
  hex: string;
  mard: string;
  rgb: {
    r: number;
    g: number;
    b: number;
  };
}
```

### PatternCell

```ts
interface PatternCell {
  row: number;
  col: number;
  hex: string;
  mard: string;
}
```

### PatternData

```ts
interface PatternData {
  width: number;
  height: number;
  cells: PatternCell[][];
}
```

### ColorCount

```ts
interface ColorCount {
  hex: string;
  mard: string;
  count: number;
}
```

### GenerateOptions

```ts
interface GenerateOptions {
  paletteSize: PaletteSize;
  width: number;
  height: number;
  mergeLevel: 'low' | 'medium' | 'high';
}
```

### GenerateResult

```ts
interface GenerateResult {
  pattern: PatternData;
  colorCounts: ColorCount[];
  totalBeadCount: number;
}
```

## 4. 模块接口

### loadPalette

用途：根据用户选择加载色卡。

```ts
function loadPalette(size: PaletteSize): PaletteColor[];
```

### generatePattern

用途：从图片生成拼豆图纸。

```ts
async function generatePattern(
  image: HTMLImageElement,
  options: GenerateOptions
): Promise<GenerateResult>;
```

### renderPattern

用途：把图纸绘制到 Canvas。

```ts
function renderPattern(
  canvas: HTMLCanvasElement,
  pattern: PatternData,
  options: RenderOptions
): void;
```

### exportPatternPng

用途：导出 PNG。

```ts
function exportPatternPng(
  pattern: PatternData,
  colorCounts: ColorCount[]
): void;
```

## 5. RenderOptions

```ts
interface RenderOptions {
  showColorCode: boolean;
  showBoardGuide: boolean;
  cellSize: number;
}
```

第一版默认：

- `showColorCode: true`
- `showBoardGuide: true`
- `cellSize` 根据图纸尺寸自动计算

## 6. 错误规则

需要处理：

- 未上传图片。
- 图片读取失败。
- 宽高非法。
- 宽高超过 `100x100`。
- 色卡加载失败。
- Canvas 导出失败。
