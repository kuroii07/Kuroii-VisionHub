import {
  ChevronDown,
  Clock3,
  ImagePlus,
  Maximize2,
  PanelRight,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Trash2,
  Upload,
  XCircle
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { ClipboardEvent, DragEvent } from 'react';
import { listProviders } from '../providers/registry';
import type {
  DefaultGenerationMode,
  OutputFormat,
  PromptHistorySettings,
  PromptPolishSettings,
  ReviewMode
} from '../services/appSettings';
import type { GenerationMode, ReferenceImage } from '../domain/providerTypes';
import type { PromptAssistMode } from '../services/promptAssist';
import type { OpenAICompatibleConfig } from '../services/providerConfig';
import { useStudioStore } from '../store/useStudioStore';
import { PromptAssistModal } from './PromptAssistModal';
import { StudioSelect } from './StudioSelect';

type SizeOption = {
  value: string;
  ratio: string;
  desc: string;
  badge: string;
  experimental?: boolean;
};

const SIZE_OPTIONS: SizeOption[] = [
  { value: '1024x1024', ratio: '1:1', desc: 'AI 绘图标准正方形', badge: '1K' },
  { value: '1280x1280', ratio: '1:1', desc: '高清头像 / 商品主图', badge: '2K' },
  { value: '1536x1536', ratio: '1:1', desc: '艺术插画头像 / 专辑封面', badge: '2K' },
  { value: '2048x2048', ratio: '1:1', desc: '极致高清正方形素材', badge: '4K', experimental: true },

  { value: '1280x720', ratio: '16:9', desc: '720P 标清宽屏', badge: '1K' },
  { value: '1536x864', ratio: '16:9', desc: '常见网页 / 大屏配图', badge: '2K' },
  { value: '2048x1152', ratio: '16:9', desc: '高清横屏壁纸', badge: '2K' },
  { value: '2560x1440', ratio: '16:9', desc: '2K 极清画质，标准上限', badge: '2K' },
  { value: '3840x2160', ratio: '16:9', desc: '4K 顶级画质，极限图像', badge: '4K', experimental: true },

  { value: '720x1280', ratio: '9:16', desc: '手机短视频封面 / 故事', badge: '1K' },
  { value: '864x1536', ratio: '9:16', desc: '移动端高清竖屏', badge: '2K' },
  { value: '1152x2048', ratio: '9:16', desc: '手机超清壁纸', badge: '2K' },
  { value: '1440x2560', ratio: '9:16', desc: '2K 手机屏 / 全面屏', badge: '2K' },
  { value: '2160x3840', ratio: '9:16', desc: '4K 竖屏极限', badge: '4K', experimental: true },

  { value: '1792x768', ratio: '21:9', desc: '电影感宽画幅 / 横版 Banner', badge: '2K' },
  { value: '2240x960', ratio: '21:9', desc: '带鱼屏游戏壁纸 / 宽景概念图', badge: '2K' },
  { value: '2576x1104', ratio: '21:9', desc: '极宽超清场景设计', badge: '2K' },
  { value: '3136x1344', ratio: '21:9', desc: '实验性电影级巨幕', badge: '4K', experimental: true },

  { value: '1024x768', ratio: '4:3', desc: '经典平板 / iPad 基础画幅', badge: '1K' },
  { value: '1280x960', ratio: '4:3', desc: '传统演示文档 / 幻灯片', badge: '2K' },
  { value: '2048x1536', ratio: '4:3', desc: '视网膜屏高清画幅', badge: '2K' },
  { value: '2688x2016', ratio: '4:3', desc: '高画质经典插画', badge: '4K', experimental: true },

  { value: '768x1024', ratio: '3:4', desc: '电子书 / 常规竖直排版', badge: '1K' },
  { value: '960x1280', ratio: '3:4', desc: '电商主图 / 详情页首选', badge: '2K' },
  { value: '1536x2048', ratio: '3:4', desc: '高清平板竖屏海报', badge: '2K' },
  { value: '2016x2688', ratio: '3:4', desc: '艺术海报 / 精细出版', badge: '4K', experimental: true },

  { value: '1152x768', ratio: '3:2', desc: '横向摄影 / 基础画幅', badge: '1K' },
  { value: '1536x1024', ratio: '3:2', desc: '横版封面 / 场景图', badge: '2K' },
  { value: '2304x1536', ratio: '3:2', desc: '高清横版摄影比例', badge: '2K' },
  { value: '3072x2048', ratio: '3:2', desc: '4K 横版实验尺寸', badge: '4K', experimental: true },

  { value: '768x1152', ratio: '2:3', desc: '竖版海报 / 基础画幅', badge: '1K' },
  { value: '1024x1536', ratio: '2:3', desc: '竖版角色图 / 海报', badge: '2K' },
  { value: '1536x2304', ratio: '2:3', desc: '高清竖版人像海报', badge: '2K' },
  { value: '2048x3072', ratio: '2:3', desc: '4K 竖版实验尺寸', badge: '4K', experimental: true },

  { value: '1280x1024', ratio: '5:4', desc: '传统显示器 / 产品图', badge: '1K' },
  { value: '1600x1280', ratio: '5:4', desc: '高清产品展示画幅', badge: '2K' },
  { value: '2560x2048', ratio: '5:4', desc: '高精细产品海报', badge: '2K' },
  { value: '3200x2560', ratio: '5:4', desc: '4K 产品图实验尺寸', badge: '4K', experimental: true },

  { value: '1024x1280', ratio: '4:5', desc: '社媒帖子 / 竖版构图', badge: '1K' },
  { value: '1280x1600', ratio: '4:5', desc: '小红书 / 电商竖图', badge: '2K' },
  { value: '2048x2560', ratio: '4:5', desc: '高清竖版商业海报', badge: '2K' },
  { value: '2560x3200', ratio: '4:5', desc: '4K 竖版实验尺寸', badge: '4K', experimental: true }
];

const RATIO_OPTIONS = [
  { label: '1:1', size: '1024x1024', w: 18, h: 18 },
  { label: '16:9', size: '1280x720', w: 24, h: 14 },
  { label: '9:16', size: '720x1280', w: 12, h: 24 },
  { label: '21:9', size: '1792x768', w: 28, h: 12 },
  { label: '4:3', size: '1024x768', w: 22, h: 16 },
  { label: '3:4', size: '768x1024', w: 16, h: 22 },
  { label: '3:2', size: '1152x768', w: 22, h: 15 },
  { label: '2:3', size: '768x1152', w: 15, h: 22 },
  { label: '5:4', size: '1280x1024', w: 22, h: 18 },
  { label: '4:5', size: '1024x1280', w: 18, h: 22 }
];

function parseSize(size: string) {
  const match = /^(\d+)x(\d+)$/.exec(size.trim());
  if (!match) return [1024, 1024] as const;
  return [Number(match[1]), Number(match[2])] as const;
}

function gcd(a: number, b: number): number {
  return b === 0 ? a : gcd(b, a % b);
}

function ratioFromSize(size: string) {
  const known = SIZE_OPTIONS.find((item) => item.value === size);
  if (known) return known.ratio;
  const [width, height] = parseSize(size);
  const divisor = gcd(width, height);
  return `${Math.round(width / divisor)}:${Math.round(height / divisor)}`;
}

function normalizeDimension(value: number) {
  if (!Number.isFinite(value)) return 1024;
  return Math.max(64, Math.min(4096, Math.round(value)));
}

function generationTimeMs(createdAt: string) {
  const numeric = Number(createdAt);
  if (Number.isFinite(numeric) && numeric > 0) return numeric;
  const parsed = new Date(createdAt).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
}

export function ModernGeneratePage(props: {
  providers: ReturnType<typeof listProviders>;
  selectedProvider: ReturnType<typeof listProviders>[number];
  selectedProviderId: string;
  supportsOpenAICompatible: boolean;
  isRealProviderReady: boolean;
  providerConfig: OpenAICompatibleConfig;
  selectedModelId: string;
  prompt: string;
  count: number;
  size: string;
  quality: string;
  isGenerating: boolean;
  isHistoryLoaded: boolean;
  results: ReturnType<typeof useStudioStore.getState>['results'];
  defaultMode: DefaultGenerationMode;
  defaultOutputFormat: OutputFormat;
  defaultReviewMode: ReviewMode;
  promptHistorySettings: PromptHistorySettings;
  promptPolishSettings: PromptPolishSettings;
  sessionStartedAtMs: number;
  onProviderChange: (providerId: string) => void;
  onModelChange: (modelId: string) => void;
  onPromptChange: (prompt: string) => void;
  onCountChange: (count: number) => void;
  onSizeChange: (size: string) => void;
  onQualityChange: (quality: string) => void;
  onGenerate: (options?: { mode?: GenerationMode; references?: ReferenceImage[]; metadata?: Record<string, unknown> }) => void;
  onPreview: (imageUrl: string) => void;
  referenceImages: ReferenceImage[];
  onReferenceImagesChange: (references: ReferenceImage[]) => void;
}) {
  const [mode, setMode] = useState<DefaultGenerationMode>(props.defaultMode);
  const [outputFormat, setOutputFormat] = useState<OutputFormat>(props.defaultOutputFormat);
  const [compression, setCompression] = useState('');
  const [reviewMode, setReviewMode] = useState<ReviewMode>(props.defaultReviewMode);
  const [referenceStrength, setReferenceStrength] = useState('auto');
  const [preserveComposition, setPreserveComposition] = useState(true);
  const [styleTransfer, setStyleTransfer] = useState(false);
  const [customWidth, setCustomWidth] = useState(() => parseSize(props.size)[0]);
  const [customHeight, setCustomHeight] = useState(() => parseSize(props.size)[1]);
  const [assistMode, setAssistMode] = useState<PromptAssistMode | null>(null);
  const [isReferenceDragActive, setIsReferenceDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const promptInputRef = useRef<HTMLTextAreaElement | null>(null);
  const modelOptions = props.supportsOpenAICompatible
    ? props.providerConfig.modelOptions.length > 0
      ? props.providerConfig.modelOptions
      : [props.providerConfig.modelId]
    : props.selectedProvider.models.map((model) => model.id);
  const modelValue = props.supportsOpenAICompatible ? props.providerConfig.modelId : props.selectedModelId;
  const selectedRatio = ratioFromSize(props.size);
  const selectedSize = SIZE_OPTIONS.find((item) => item.value === props.size);
  const currentRatioSizes = useMemo(() => SIZE_OPTIONS.filter((item) => item.ratio === selectedRatio), [selectedRatio]);
  const sessionResults = useMemo(
    () => props.results.filter((result) => generationTimeMs(result.createdAt) >= props.sessionStartedAtMs),
    [props.results, props.sessionStartedAtMs]
  );
  const latestImage = sessionResults.find((result) => result.imageUrls[0]);
  const failedLatest = sessionResults.find((result) => result.status === 'failed');
  const imageToImageStatus = props.selectedProvider.capabilities.imageToImage;
  const multiReferenceStatus = props.selectedProvider.capabilities.multiReferenceImage;
  const advancedImageTuningEnabled = ['supported', 'partial'].includes(imageToImageStatus);
  const multiReferenceAllowed = ['supported', 'partial'].includes(multiReferenceStatus);
  const canAttemptImageToImage = !['unsupported', 'unknown'].includes(imageToImageStatus);
  const promptLength = props.prompt.trim().length;
  const promptWidthState =
    promptLength === 0 ? 'promptEmpty' : promptLength < 24 ? 'promptShort' : promptLength < 60 ? 'promptMedium' : 'promptLong';

  useEffect(() => {
    setMode(props.defaultMode);
  }, [props.defaultMode]);

  useEffect(() => {
    setOutputFormat(props.defaultOutputFormat);
  }, [props.defaultOutputFormat]);

  useEffect(() => {
    setReviewMode(props.defaultReviewMode);
  }, [props.defaultReviewMode]);

  useEffect(() => {
    if (props.referenceImages.length > 0) {
      setMode('image');
    }
  }, [props.referenceImages.length]);

  function applyCustomSize() {
    const width = normalizeDimension(customWidth);
    const height = normalizeDimension(customHeight);
    setCustomWidth(width);
    setCustomHeight(height);
    props.onSizeChange(`${width}x${height}`);
  }

  function applyAssistedPrompt(nextPrompt: string, placement: 'replace' | 'append') {
    const trimmed = nextPrompt.trim();
    if (!trimmed) return;
    props.onPromptChange(placement === 'append' && props.prompt.trim() ? `${props.prompt.trim()}\n\n${trimmed}` : trimmed);
    setAssistMode(null);
  }

  function updateReferences(nextReferences: ReferenceImage[]) {
    props.onReferenceImagesChange(nextReferences.slice(0, 4));
  }

  async function addReferenceFiles(files: FileList | File[] | null, source: Extract<ReferenceImage['source'], 'upload' | 'clipboard' | 'drag-drop'> = 'upload') {
    if (!files?.length || props.isGenerating) return;
    const slots = Math.max(0, 4 - props.referenceImages.length);
    if (slots === 0) return;
    const selectedFiles = Array.from(files)
      .filter((file) => file.type.startsWith('image/'))
      .slice(0, slots);
    if (selectedFiles.length === 0) return;
    const references = await Promise.all(selectedFiles.map((file) => fileToReferenceImage(file, source)));
    updateReferences([...props.referenceImages, ...references]);
    setMode('image');
  }

  function removeReference(referenceId: string) {
    updateReferences(props.referenceImages.filter((reference) => reference.id !== referenceId));
  }

  function clearReferences() {
    updateReferences([]);
  }

  function hasImageTransfer(dataTransfer: DataTransfer) {
    const items = Array.from(dataTransfer.items ?? []);
    if (items.length === 0) return Array.from(dataTransfer.files ?? []).some((file) => file.type.startsWith('image/'));
    return items.some((item) => item.kind === 'file' && (item.type.startsWith('image/') || item.type === ''));
  }

  function handleReferenceDrag(event: DragEvent<HTMLDivElement>) {
    if (props.isGenerating || props.referenceImages.length >= 4 || !hasImageTransfer(event.dataTransfer)) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = 'copy';
    setIsReferenceDragActive(true);
  }

  function handleReferenceDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setIsReferenceDragActive(false);
    void addReferenceFiles(event.dataTransfer.files, 'drag-drop');
  }

  function handleReferencePaste(event: ClipboardEvent<HTMLDivElement>) {
    if (props.isGenerating || props.referenceImages.length >= 4) return;
    const files = Array.from(event.clipboardData.items)
      .map((item) => (item.kind === 'file' ? item.getAsFile() : null))
      .filter((file): file is File => Boolean(file && file.type.startsWith('image/')));
    if (files.length === 0) return;
    event.preventDefault();
    void addReferenceFiles(files, 'clipboard');
  }

  function useLatestImageAsReference() {
    if (!latestImage?.imageUrls[0]) return;
    const imageUrl = latestImage.imageUrls[0];
    const nextReference: ReferenceImage = {
      id: `generated-${latestImage.id}-${Date.now()}`,
      name: '最近生成图',
      mimeType: imageUrl.startsWith('data:image/jpeg') ? 'image/jpeg' : imageUrl.startsWith('data:image/webp') ? 'image/webp' : 'image/png',
      dataUrl: imageUrl.startsWith('data:image/') ? imageUrl : undefined,
      localPath: latestImage.localImagePaths?.[0],
      previewUrl: imageUrl,
      source: 'generated-result',
      sourceGenerationId: latestImage.id
    };
    updateReferences([nextReference, ...props.referenceImages.filter((reference) => reference.sourceGenerationId !== latestImage.id)]);
    setMode('image');
  }

  useEffect(() => {
    function focusPrompt() {
      promptInputRef.current?.focus();
      promptInputRef.current?.select();
    }
    function addReference() {
      if (props.isGenerating || props.referenceImages.length >= 4) return;
      setMode('image');
      window.setTimeout(() => fileInputRef.current?.click(), 0);
    }
    function clearReferenceShortcut() {
      if (props.isGenerating) return;
      clearReferences();
    }
    function switchToImageMode() {
      setMode('image');
    }
    function switchToTextMode() {
      setMode('text');
    }
    window.addEventListener('visionhub:generate-focus-prompt', focusPrompt);
    window.addEventListener('visionhub:generate-add-reference', addReference);
    window.addEventListener('visionhub:generate-clear-references', clearReferenceShortcut);
    window.addEventListener('visionhub:generate-mode-image', switchToImageMode);
    window.addEventListener('visionhub:generate-mode-text', switchToTextMode);
    return () => {
      window.removeEventListener('visionhub:generate-focus-prompt', focusPrompt);
      window.removeEventListener('visionhub:generate-add-reference', addReference);
      window.removeEventListener('visionhub:generate-clear-references', clearReferenceShortcut);
      window.removeEventListener('visionhub:generate-mode-image', switchToImageMode);
      window.removeEventListener('visionhub:generate-mode-text', switchToTextMode);
    };
  }, [props.referenceImages, props.isGenerating]);

  useEffect(() => {
    window.addEventListener('visionhub:generate-submit', runGenerate);
    return () => window.removeEventListener('visionhub:generate-submit', runGenerate);
  });

  function runGenerate() {
    if (mode === 'image') {
      props.onGenerate({
        mode: 'image-to-image',
        references: props.referenceImages,
        metadata: {
          imageToImageTuning: {
            referenceStrength,
            preserveComposition,
            styleTransfer,
            capabilityStatus: imageToImageStatus,
            multiReferenceStatus
          }
        }
      });
      return;
    }
    props.onGenerate({ mode: 'text-to-image', references: [] });
  }

  return (
    <div className="generatorStudio" onPaste={handleReferencePaste}>
      <section className={`canvasPane ${mode === 'image' ? 'withReferenceRow' : 'textOnlyRow'}`}>
        <header className="generatorTopbar">
          <div className="workspaceTitleBlock">
            <span className="tealLabel">AI 创作工作台</span>
            <div className="workspaceTitleLine">
              <strong>{props.isGenerating ? '渲染进行中' : latestImage ? '最近画面' : '准备生成'}</strong>
              <small>{props.selectedProvider.name} · {modelValue}</small>
            </div>
          </div>
          <div className="quickToolbar">
            <button className={`modeToggle ${mode === 'text' ? 'active' : ''}`} onClick={() => setMode('text')}>
              <Sparkles size={15} /> 文生图
            </button>
            <button className={`modeToggle ${mode === 'image' ? 'active' : ''}`} onClick={() => setMode('image')}>
              <Upload size={15} /> 图生图
            </button>
            <span>{selectedRatio}</span>
            <span>{props.size}</span>
            <span>{outputFormat}</span>
            <span className="sessionCount">
              <Clock3 size={13} /> {sessionResults.length}
            </span>
          </div>
        </header>

        <div className="previewStage">
          {latestImage?.imageUrls[0] ? (
            <>
              <button className="latestPreview" onClick={() => props.onPreview(latestImage.imageUrls[0])}>
                <img src={latestImage.imageUrls[0]} alt={latestImage.prompt} />
                <span className="previewAction">
                  <Maximize2 size={15} /> 预览
                </span>
              </button>
              <button className="useAsReferenceButton" type="button" onClick={useLatestImageAsReference} disabled={props.isGenerating}>
                <ImagePlus size={15} /> 作为参考
              </button>
            </>
          ) : (
            <div className="previewEmpty">
              <div className="emptyIcon">
                <Sparkles size={25} />
              </div>
              <h2>还没有图片</h2>
              <p>在底部填写提示词，右侧确认参数后开始生成。</p>
              {props.isGenerating ? (
                <div className="generationOverlay inlineGenerationOverlay">
                  <span>
                    <Sparkles size={16} /> 正在生成画面
                  </span>
                  <small>任务已发送到当前模型，请稍候…</small>
                </div>
              ) : null}
            </div>
          )}
          {failedLatest && !latestImage ? <div className="previewError">上一轮失败：{failedLatest.error}</div> : null}
          {props.isGenerating && latestImage?.imageUrls[0] ? (
            <div className="generationOverlay">
              <span>
                <Sparkles size={16} /> 正在生成画面
              </span>
              <small>任务已发送到当前模型，请稍候…</small>
            </div>
          ) : null}
        </div>

        {mode === 'image' ? (
          <div
            className={`referenceDock ${isReferenceDragActive ? 'isDragActive' : ''}`}
            onDragEnter={handleReferenceDrag}
            onDragOver={handleReferenceDrag}
            onDragLeave={() => setIsReferenceDragActive(false)}
            onDrop={handleReferenceDrop}
          >
            <div className="referenceInfo">
              <strong>参考图</strong>
              <span>{props.referenceImages.length}/4</span>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              multiple
              hidden
              onChange={(event) => {
                void addReferenceFiles(event.target.files, 'upload');
                event.currentTarget.value = '';
              }}
            />
            <button
              className="referenceAdd"
              type="button"
              disabled={props.isGenerating || props.referenceImages.length >= 4}
              onClick={() => fileInputRef.current?.click()}
            >
              <ImagePlus size={17} /> 加入参考
            </button>
            {props.referenceImages.length > 0 ? (
              <>
                <button
                  className="referenceClear"
                  type="button"
                  title="清空全部参考图"
                  disabled={props.isGenerating}
                  onClick={clearReferences}
                >
                  <XCircle size={15} /> 清空
                </button>
                <div className="referenceStrip">
                  {props.referenceImages.map((reference) => (
                    <article className="referenceTile" key={reference.id}>
                      <button type="button" className="referenceThumb" onClick={() => reference.previewUrl && props.onPreview(reference.previewUrl)}>
                        {reference.previewUrl ? <img src={reference.previewUrl} alt={reference.name ?? '参考图'} /> : <ImagePlus size={18} />}
                      </button>
                      <button className="referenceRemove" type="button" title="移除参考图" disabled={props.isGenerating} onClick={() => removeReference(reference.id)}>
                        <Trash2 size={13} />
                      </button>
                    </article>
                  ))}
                </div>
              </>
            ) : (
              <p>添加本地图片，或拖拽/粘贴图片作为参考。</p>
            )}
          </div>
        ) : null}

        <div className={`promptDock ${promptWidthState}`}>
          <div className="promptHeaderRow">
            <div>
              <strong>提示词</strong>
              <span>{promptLength} 字符</span>
            </div>
            <div className="promptActions" aria-label="提示词辅助功能">
              <button type="button" className="chipButton" title="打开灵感库" onClick={() => setAssistMode('inspiration')}>
                灵感库
              </button>
              <button type="button" className="chipButton" title="润色当前提示词" onClick={() => setAssistMode('polish')}>
                提示词润色
              </button>
              <button type="button" className="chipButton" title="复用历史提示词" onClick={() => setAssistMode('reuse')}>
                复用记录
              </button>
            </div>
          </div>
          <div className="promptInputRow">
            <textarea
              ref={promptInputRef}
              className="bottomPromptInput"
              value={props.prompt}
              onChange={(event) => props.onPromptChange(event.target.value)}
              placeholder={mode === 'image' ? '描述你希望基于参考图改变什么，例如风格、构图、材质或细节' : '描述画面的主体、风格、光线、构图等，越具体效果越好'}
            />
          </div>
          <div className="promptControlRow">
            <label>
              精度
              <StudioSelect
                value={props.quality}
                onChange={props.onQualityChange}
                options={[
                  { value: 'auto', label: '自动' },
                  { value: 'low', label: '低' },
                  { value: 'medium', label: '中' },
                  { value: 'standard', label: '标准' },
                  { value: 'high', label: '高' }
                ]}
              />
            </label>
            <label>
              格式
              <StudioSelect
                value={outputFormat}
                onChange={(value) => setOutputFormat(value as OutputFormat)}
                options={[
                  { value: 'PNG', label: 'PNG' },
                  { value: 'JPEG', label: 'JPEG' },
                  { value: 'WebP', label: 'WebP' }
                ]}
              />
            </label>
            <label>
              压缩率
              <input value={compression} placeholder="自动 / 0-100" onChange={(event) => setCompression(event.target.value)} />
            </label>
            <label>
              审核
              <StudioSelect
                value={reviewMode}
                onChange={(value) => setReviewMode(value as ReviewMode)}
                options={[
                  { value: 'auto', label: '自动' },
                  { value: 'strict', label: '严格' },
                  { value: 'relaxed', label: '宽松' }
                ]}
              />
            </label>
            <label>
              数量
              <input type="number" min={1} max={4} value={props.count} onChange={(event) => props.onCountChange(Number(event.target.value))} />
            </label>
            <div className="generateStack">
              <button
                className="primaryGenerate"
                onClick={runGenerate}
                disabled={props.isGenerating || !props.prompt.trim() || (mode === 'image' && (!props.referenceImages.length || !canAttemptImageToImage))}
              >
                <Sparkles size={17} /> {props.isGenerating ? '生成中…' : mode === 'image' ? '启动参考生成' : '启动生成'}
              </button>
              {mode === 'image' && !canAttemptImageToImage ? <small className="generateHint">当前平台暂不支持图生图</small> : null}
              {mode === 'image' && canAttemptImageToImage && !props.referenceImages.length ? <small className="generateHint">请先添加参考图</small> : null}
            </div>
          </div>
        </div>
      </section>

      <aside className="parameterRail">
        <section className="railCard providerRailCard">
          <label>
            平台
            <StudioSelect
              value={props.selectedProviderId}
              onChange={props.onProviderChange}
              options={props.providers.map((provider) => ({ value: provider.id, label: provider.name }))}
            />
          </label>
          <label>
            模型
            <StudioSelect
              value={modelValue}
              onChange={props.onModelChange}
              options={modelOptions.map((modelId) => ({ value: modelId, label: modelId }))}
            />
          </label>
          <div className={`connectionState ${props.isRealProviderReady ? 'ready' : ''}`}>
            <ShieldCheck size={14} /> {props.isRealProviderReady ? '真实通道已就绪' : '未配置密钥时使用演示模式'}
          </div>
        </section>

        <section className="railCard">
          <div className="railTitle">
            <PanelRight size={15} /> 画面比例
          </div>
          <div className="ratioGrid">
            {RATIO_OPTIONS.map((ratio) => (
              <button
                key={ratio.label}
                className={selectedRatio === ratio.label ? 'active' : ''}
                onClick={() => props.onSizeChange(ratio.size)}
              >
                <span style={{ width: ratio.w, height: ratio.h }} />
                {ratio.label}
              </button>
            ))}
          </div>
          <p className="railHint">先选画面比例，再在下方选择该比例对应的输出尺寸。</p>
        </section>

        <section className="railCard">
          <div className="railTitle">
            <SlidersHorizontal size={15} /> 输出尺寸
          </div>
          <div className="resolutionList">
            {currentRatioSizes.map((item) => (
              <button key={item.value} className={props.size === item.value ? 'active' : ''} onClick={() => props.onSizeChange(item.value)}>
                <div>
                  <strong>{item.value}</strong>
                  <small>{item.desc}</small>
                  {item.experimental ? <em>实验性</em> : null}
                </div>
                <span>{item.badge}</span>
              </button>
            ))}
            {selectedSize ? null : (
              <button className="active customSizeCurrent" onClick={() => undefined}>
                <div>
                  <strong>{props.size}</strong>
                  <small>当前自定义尺寸，将原样传给生成接口</small>
                </div>
                <span>自定义</span>
              </button>
            )}
          </div>
          <div className="customSizeBox">
            <strong>自定义尺寸</strong>
            <div>
              <input value={customWidth} type="number" min={64} max={4096} onChange={(event) => setCustomWidth(Number(event.target.value))} />
              <span>×</span>
              <input value={customHeight} type="number" min={64} max={4096} onChange={(event) => setCustomHeight(Number(event.target.value))} />
              <button onClick={applyCustomSize}>应用</button>
            </div>
            <small>建议 64–4096，具体是否支持取决于当前 Provider / 中转模型。</small>
          </div>
        </section>

        {mode === 'image' ? (
          <section className="railCard imageTuningCard">
            <div className="railTitle">
              <SlidersHorizontal size={15} /> 图生图参数
            </div>
            <div className={`capabilityNotice ${advancedImageTuningEnabled ? 'ready' : 'blocked'}`}>
              <strong>{advancedImageTuningEnabled ? '当前 Provider 可尝试图生图参数' : '当前 Provider 未声明图生图参数能力'}</strong>
              <span>图生图：{statusLabel(imageToImageStatus)} ? 多参考：{statusLabel(multiReferenceStatus)}</span>
            </div>
            <label>
              参考强度
              <StudioSelect
                value={referenceStrength}
                onChange={setReferenceStrength}
                options={[
                  { value: 'auto', label: '自动' },
                  { value: 'low', label: '低：只借鉴少量特征' },
                  { value: 'medium', label: '中：平衡参考与改写' },
                  { value: 'high', label: '高：更贴近参考图' }
                ]}
              />
            </label>
            <label className="tuningCheck">
              <input
                type="checkbox"
                checked={preserveComposition}
                disabled={!advancedImageTuningEnabled}
                onChange={(event) => setPreserveComposition(event.target.checked)}
              />
              <span>尽量保留构图</span>
            </label>
            <label className="tuningCheck">
              <input
                type="checkbox"
                checked={styleTransfer}
                disabled={!advancedImageTuningEnabled}
                onChange={(event) => setStyleTransfer(event.target.checked)}
              />
              <span>偏向风格迁移</span>
            </label>
            <small>{multiReferenceAllowed ? '会随生成请求记录为 Provider 参数偏好；真实生效取决于当前接口协议。' : '该 Provider 未声明多参考能力，建议只放 1 张参考图。'}</small>
          </section>
        ) : null}

        <section className="railCard collapsedRail">
          <div>
            <ChevronDown size={16} /> 高级参数
          </div>
          <small>Seed、负面提示词、风格锁定、成本策略等会收纳到这里。</small>
        </section>
      </aside>
      {assistMode ? (
        <PromptAssistModal
          mode={assistMode}
          prompt={props.prompt}
          results={props.results}
          promptHistorySettings={props.promptHistorySettings}
          promptPolishSettings={props.promptPolishSettings}
          onClose={() => setAssistMode(null)}
          onApplyPrompt={applyAssistedPrompt}
        />
      ) : null}
    </div>
  );
}


function statusLabel(status: ReturnType<typeof listProviders>[number]['capabilities']['imageToImage']) {
  const labels: Record<string, string> = {
    supported: '支持',
    partial: '部分支持',
    planned: '规划中',
    unknown: '待确认',
    unsupported: '不支持'
  };
  return labels[status] ?? status;
}

function fileToReferenceImage(file: File, source: Extract<ReferenceImage['source'], 'upload' | 'clipboard' | 'drag-drop'> = 'upload'): Promise<ReferenceImage> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = typeof reader.result === 'string' ? reader.result : '';
      resolve({
        id: `${source}-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        name: file.name || (source === 'clipboard' ? '剪贴板图片' : '参考图'),
        mimeType: file.type || 'image/png',
        dataUrl,
        previewUrl: dataUrl,
        source
      });
    };
    reader.onerror = () => reject(reader.error ?? new Error('无法读取参考图。'));
    reader.readAsDataURL(file);
  });
}


