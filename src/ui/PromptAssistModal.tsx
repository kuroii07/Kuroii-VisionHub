import { Copy, History, Trash2, Wand2, X } from 'lucide-react';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import type { GenerationRecord } from '../domain/providerTypes';
import { PROMPT_POLISH_SECRET_ID, promptPolishConfigId, type PromptHistorySettings, type PromptPolishSettings } from '../services/appSettings';
import { polishPromptWithProvider } from '../services/desktopApi';
import { parseExtraHeaders } from '../services/providerConfig';
import {
  INSPIRATION_TEMPLATES,
  INSPIRATION_TEMPLATE_FILTERS,
  POLISH_MODES,
  PROMPT_STYLE_PRESETS,
  getDefaultPolishMode,
  getPolishModesForEngine,
  polishPrompt,
  renderInspirationPrompt,
  resolvePolishMode,
  type InspirationTemplate,
  type InspirationTemplateGroup,
  type PromptAssistMode
} from '../services/promptAssist';
import { StudioSelect } from './StudioSelect';
import type { ConfirmDialogRequest } from './confirmDialog';
import { useToastMessage } from './toast';

interface PromptAssistModalProps {
  mode: PromptAssistMode;
  prompt: string;
  results: GenerationRecord[];
  promptHistorySettings: PromptHistorySettings;
  promptPolishSettings: PromptPolishSettings;
  promptStyleId: string;
  onPromptStyleChange: (styleId: string) => void;
  onClose: () => void;
  onApplyPrompt: (prompt: string, placement: 'replace' | 'append') => void;
  onDeleteRecord?: (recordId: string) => Promise<void>;
  onRequestConfirm: (request: ConfirmDialogRequest) => void;
}

type ReuseModeFilter = 'all' | 'text-to-image' | 'image-to-image' | 'with-references';
type ReuseStatusFilter = 'all' | GenerationRecord['status'];
type ReuseSortMode = 'newest' | 'oldest' | 'prompt-long' | 'prompt-short';

type ComposerFieldId = 'subject' | 'scene' | 'style' | 'camera' | 'lighting' | 'material' | 'color' | 'constraints' | 'negative';
type ComposerValues = Record<ComposerFieldId, string>;

const COMPOSER_FIELDS: Array<{ id: ComposerFieldId; label: string; placeholder: string; multiline?: boolean }> = [
  { id: 'subject', label: '主体', placeholder: '例如：雨夜露营的机械猫、新品耳机、红衣少女' },
  { id: 'scene', label: '场景', placeholder: '例如：霓虹街头、极简展台、森林遗迹' },
  { id: 'style', label: '风格', placeholder: '例如：电影感写实、精修二次元、高级商业海报' },
  { id: 'camera', label: '镜头 / 构图', placeholder: '例如：低机位仰拍、居中对称、85mm 人像镜头' },
  { id: 'lighting', label: '光影', placeholder: '例如：柔和轮廓光、蓝紫霓虹光、棚拍柔光' },
  { id: 'material', label: '材质 / 细节', placeholder: '例如：磨砂金属、透明玻璃、潮湿石板地面' },
  { id: 'color', label: '色彩', placeholder: '例如：黑金配色、低饱和蓝灰、高对比酸性色' },
  { id: 'constraints', label: '约束 / 质量', placeholder: '例如：主体清晰，无文字水印，构图干净，高清', multiline: true },
  { id: 'negative', label: '负面约束', placeholder: '例如：不要多余手指、不要 logo、不要错乱文字', multiline: true }
];

const EMPTY_COMPOSER_VALUES: ComposerValues = {
  subject: '',
  scene: '',
  style: '',
  camera: '',
  lighting: '',
  material: '',
  color: '',
  constraints: '',
  negative: ''
};

const COMPOSER_PRESETS: Array<{ id: string; title: string; description: string; values: Partial<ComposerValues> }> = [
  {
    id: 'cinematic-character',
    title: '电影感角色',
    description: '适合人像、角色卡和氛围图。',
    values: { style: '电影感写实，情绪克制，画面高级', camera: '85mm 人像镜头，中近景，主体突出', lighting: '柔和轮廓光，背景有层次', constraints: '五官清晰，构图稳定，细节丰富，无文字水印' }
  },
  {
    id: 'premium-product',
    title: '高级产品图',
    description: '适合电商主图、新品发布和商业海报。',
    values: { scene: '极简商业展台，干净背景', style: '高级商业摄影，品牌广告质感', camera: '居中构图，产品占据视觉主体', lighting: '棚拍柔光，精致边缘高光', constraints: '产品边缘清晰，材质真实，无多余文字和 logo' }
  },
  {
    id: 'game-asset',
    title: '游戏资产',
    description: '适合道具、技能图标、角色装备和奖励卡。',
    values: { style: '游戏美术设定，轮廓强，小尺寸可读', camera: '居中展示，背景简洁，主体完整', lighting: '明确高光和能量辉光', material: '材质边界清晰，结构易识别', constraints: '适合游戏 UI 复用，不要复杂背景，不要文字' }
  },
  {
    id: 'social-cover',
    title: '社媒封面',
    description: '适合小红书、B 站、短视频缩略图和教程封面。',
    values: { style: '高识别、强对比、信息清晰的社媒封面风格', camera: '主体放大，留出标题区，构图有点击吸引力', color: '高对比主色，移动端信息流里醒目', constraints: '主体一眼可见，文字区清楚预留，画面不拥挤' }
  }
];

function buildComposerPrompt(values: ComposerValues) {
  const parts = [
    values.subject.trim(),
    values.scene.trim() ? `位于${values.scene.trim()}` : '',
    values.style.trim(),
    values.camera.trim(),
    values.lighting.trim(),
    values.material.trim(),
    values.color.trim(),
    values.constraints.trim()
  ].filter(Boolean);
  const positivePrompt = parts.join('，');
  const negativePrompt = values.negative.trim();
  if (positivePrompt && negativePrompt) return `${positivePrompt}\n负面约束：${negativePrompt}`;
  if (negativePrompt) return `负面约束：${negativePrompt}`;
  return positivePrompt;
}

export function PromptAssistModal(props: PromptAssistModalProps) {
  function resolveInitialPolishConfigId() {
    const currentConfigId = promptPolishConfigId(props.promptPolishSettings.displayName, props.promptPolishSettings.baseUrl);
    const exactConfig = props.promptPolishSettings.savedConfigs.find((config) => config.id === currentConfigId);
    return exactConfig?.id ?? props.promptPolishSettings.savedConfigs[0]?.id ?? '__current__';
  }

  const [activeMode, setActiveMode] = useState<PromptAssistMode | 'composer'>(props.mode);
  const [selectedTemplateId, setSelectedTemplateId] = useState(INSPIRATION_TEMPLATES[0].id);
  const [templateFilter, setTemplateFilter] = useState<'all' | InspirationTemplateGroup>('all');
  const [templateValues, setTemplateValues] = useState<Record<string, string>>({});
  const [composerValues, setComposerValues] = useState<ComposerValues>(EMPTY_COMPOSER_VALUES);
  const [polishMode, setPolishMode] = useState(() =>
    resolvePolishMode(
      props.promptHistorySettings.defaultPolishMode || getDefaultPolishMode(props.promptPolishSettings.engine),
      props.promptPolishSettings.engine
    ).id
  );
  const [reuseQuery, setReuseQuery] = useState('');
  const [reuseProviderFilter, setReuseProviderFilter] = useState('all');
  const [reuseModelFilter, setReuseModelFilter] = useState('all');
  const [reuseModeFilter, setReuseModeFilter] = useState<ReuseModeFilter>('all');
  const [reuseStatusFilter, setReuseStatusFilter] = useState<ReuseStatusFilter>('all');
  const [reuseSortMode, setReuseSortMode] = useState<ReuseSortMode>('newest');
  const [copiedMessage, setCopiedMessage] = useState('');
  const [editableSourcePrompt, setEditableSourcePrompt] = useState(props.prompt);
  const [editableResultPrompt, setEditableResultPrompt] = useState('');
  const [lastAutoPolishedPrompt, setLastAutoPolishedPrompt] = useState('');
  const [isResultManuallyEdited, setIsResultManuallyEdited] = useState(false);
  const [modelPolishedPrompt, setModelPolishedPrompt] = useState('');
  const [selectedPolishConfigId, setSelectedPolishConfigId] = useState(resolveInitialPolishConfigId);
  const [selectedPolishModelId, setSelectedPolishModelId] = useState(props.promptPolishSettings.modelId.trim());
  const [polishMessage, setPolishMessage] = useState('');
  const [isPolishing, setIsPolishing] = useState(false);
  useToastMessage(copiedMessage, setCopiedMessage);
  useToastMessage(polishMessage, setPolishMessage);

  const selectedTemplate =
    INSPIRATION_TEMPLATES.find((template) => template.id === selectedTemplateId) ?? INSPIRATION_TEMPLATES[0];
  const composerPrompt = useMemo(() => buildComposerPrompt(composerValues), [composerValues]);
  const filteredTemplates = useMemo(
    () => templateFilter === 'all'
      ? INSPIRATION_TEMPLATES
      : INSPIRATION_TEMPLATES.filter((template) => template.group === templateFilter),
    [templateFilter]
  );
  const inspirationPrompt = renderInspirationPrompt(selectedTemplate, templateValues);
  const localPolishedPrompt = polishPrompt(editableSourcePrompt, polishMode, props.promptStyleId);
  const polishedPrompt = modelPolishedPrompt || localPolishedPrompt;
  const polishConfigOptions = useMemo(() => {
    const configs = props.promptPolishSettings.savedConfigs.length > 0
      ? props.promptPolishSettings.savedConfigs
      : [{
          id: '__current__',
          displayName: props.promptPolishSettings.displayName,
          baseUrl: props.promptPolishSettings.baseUrl,
          modelId: props.promptPolishSettings.modelId,
          modelOptions: props.promptPolishSettings.modelOptions,
          extraHeadersJson: props.promptPolishSettings.extraHeadersJson,
          protocol: props.promptPolishSettings.protocol
        }];
    return configs;
  }, [props.promptPolishSettings]);
  const selectedPolishConfig = polishConfigOptions.find((config) => config.id === selectedPolishConfigId) ?? polishConfigOptions[0];
  const effectivePolishSettings = {
    ...props.promptPolishSettings,
    displayName: selectedPolishConfig?.displayName ?? props.promptPolishSettings.displayName,
    baseUrl: selectedPolishConfig?.baseUrl ?? props.promptPolishSettings.baseUrl,
    modelId: selectedPolishConfig?.modelId ?? props.promptPolishSettings.modelId,
    modelOptions: selectedPolishConfig?.modelOptions ?? props.promptPolishSettings.modelOptions,
    extraHeadersJson: selectedPolishConfig?.extraHeadersJson ?? props.promptPolishSettings.extraHeadersJson,
    protocol: selectedPolishConfig?.protocol ?? props.promptPolishSettings.protocol
  };
  const polishBaseUrl = effectivePolishSettings.baseUrl.trim();
  const polishModelOptions = useMemo(
    () => Array.from(new Set([effectivePolishSettings.modelId, ...effectivePolishSettings.modelOptions].filter((item) => item.trim()).map((item) => item.trim()))),
    [effectivePolishSettings.modelId, effectivePolishSettings.modelOptions]
  );
  const polishModelId = selectedPolishModelId.trim() || effectivePolishSettings.modelId.trim();
  const modelPolishEnabled = props.promptPolishSettings.engine === 'provider';
  const polishReady = modelPolishEnabled && Boolean(polishBaseUrl && polishModelId);
  const availablePolishModes = useMemo(
    () => getPolishModesForEngine(props.promptPolishSettings.engine),
    [props.promptPolishSettings.engine]
  );

  useEffect(() => {
    setActiveMode(props.mode);
  }, [props.mode]);

  useEffect(() => {
    const nextConfigId = resolveInitialPolishConfigId();
    const nextConfig = polishConfigOptions.find((config) => config.id === nextConfigId);
    setSelectedPolishConfigId(nextConfigId);
    setSelectedPolishModelId((nextConfig?.modelId ?? props.promptPolishSettings.modelId).trim());
    setModelPolishedPrompt('');
    setIsResultManuallyEdited(false);
  }, [props.promptPolishSettings.engine, props.promptPolishSettings.displayName, props.promptPolishSettings.baseUrl, props.promptPolishSettings.modelId, props.promptPolishSettings.savedConfigs]);

  useEffect(() => {
    const resolvedMode = resolvePolishMode(polishMode, props.promptPolishSettings.engine);
    if (resolvedMode.id !== polishMode) {
      setPolishMode(resolvedMode.id);
      setModelPolishedPrompt('');
      setIsResultManuallyEdited(false);
    }
  }, [polishMode, props.promptPolishSettings.engine]);

  useEffect(() => {
    setEditableSourcePrompt(props.prompt);
    setModelPolishedPrompt('');
    setIsResultManuallyEdited(false);
  }, [props.prompt]);

  useEffect(() => {
    setEditableResultPrompt((current) => {
      if (isResultManuallyEdited && current !== lastAutoPolishedPrompt) return current;
      return polishedPrompt;
    });
    setLastAutoPolishedPrompt(polishedPrompt);
  }, [isResultManuallyEdited, lastAutoPolishedPrompt, polishedPrompt]);

  useEffect(() => {
    if (filteredTemplates.some((template) => template.id === selectedTemplateId)) return;
    setSelectedTemplateId(filteredTemplates[0]?.id ?? INSPIRATION_TEMPLATES[0].id);
    setTemplateValues({});
  }, [filteredTemplates, selectedTemplateId]);

  const normalizedQuery = reuseQuery.trim().toLowerCase();
  const reusableSourceRecords = useMemo(
    () => props.results.filter((record) => record.prompt.trim()),
    [props.results]
  );
  const reuseProviderOptions = useMemo(
    () => uniqueRecordOptions(reusableSourceRecords, (record) => record.providerName ?? record.providerId),
    [reusableSourceRecords]
  );
  const reuseModelOptions = useMemo(
    () => uniqueRecordOptions(reusableSourceRecords, (record) => record.modelId),
    [reusableSourceRecords]
  );
  const promptRecords = useMemo(() => {
    const seen = new Set<string>();
    if (!props.promptHistorySettings.enabled) return [];

    const records = reusableSourceRecords
      .filter((record) => props.promptHistorySettings.includeFailed || record.status !== 'failed')
      .filter((record) => reuseProviderFilter === 'all' || (record.providerName ?? record.providerId) === reuseProviderFilter)
      .filter((record) => reuseModelFilter === 'all' || record.modelId === reuseModelFilter)
      .filter((record) => reuseStatusFilter === 'all' || record.status === reuseStatusFilter)
      .filter((record) => {
        if (reuseModeFilter === 'all') return true;
        if (reuseModeFilter === 'with-references') return (record.referenceImages?.length ?? 0) > 0;
        return (record.generationMode ?? 'text-to-image') === reuseModeFilter;
      })
      .filter((record) => {
        if (!props.promptHistorySettings.dedupe) return true;
        const key = record.prompt.trim();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .filter((record) => {
        if (!normalizedQuery) return true;
        return [record.prompt, record.providerName, record.providerId, record.modelId]
          .join(' ')
          .toLowerCase()
          .includes(normalizedQuery);
      })
      .sort((left, right) => {
        if (reuseSortMode === 'oldest') return recordTimeMs(left.createdAt) - recordTimeMs(right.createdAt);
        if (reuseSortMode === 'prompt-long') return right.prompt.trim().length - left.prompt.trim().length;
        if (reuseSortMode === 'prompt-short') return left.prompt.trim().length - right.prompt.trim().length;
        return recordTimeMs(right.createdAt) - recordTimeMs(left.createdAt);
      });

    return records.slice(0, props.promptHistorySettings.maxItems);
  }, [
    normalizedQuery,
    props.promptHistorySettings,
    reusableSourceRecords,
    reuseProviderFilter,
    reuseModelFilter,
    reuseModeFilter,
    reuseStatusFilter,
    reuseSortMode
  ]);

  async function copyText(value: string) {
    try {
      await navigator.clipboard?.writeText(value);
      setCopiedMessage('已复制');
    } catch {
      setCopiedMessage('复制失败，请手动选中文本复制');
    }
  }

  async function runModelPolish() {
    if (!modelPolishEnabled) {
      setModelPolishedPrompt('');
      const nextLocalPrompt = polishPrompt(editableSourcePrompt, polishMode, props.promptStyleId);
      setEditableResultPrompt(nextLocalPrompt);
      setLastAutoPolishedPrompt(nextLocalPrompt);
      setIsResultManuallyEdited(false);
      setPolishMessage('当前使用本地规则润色，未调用模型。');
      return;
    }
    if (!polishBaseUrl) {
      setPolishMessage('请先到偏好设置填写提示词润色专用 Base URL。');
      return;
    }
    if (!polishModelId) {
      setPolishMessage('请先到偏好设置填写提示词润色专用模型 ID。');
      return;
    }

    setIsPolishing(true);
    setPolishMessage('');
    try {
      const result = await polishPromptWithProvider({
        providerId: 'prompt-polish',
        modelId: polishModelId,
        prompt: editableSourcePrompt.trim() || '一个清晰明确的画面主体',
        modeId: polishMode,
        styleId: props.promptStyleId,
        settings: { ...effectivePolishSettings, modelId: polishModelId },
        baseUrl: polishBaseUrl,
        extraHeaders: parseExtraHeaders(effectivePolishSettings.extraHeadersJson),
        secretId: PROMPT_POLISH_SECRET_ID
      });
      setModelPolishedPrompt(result.polishedPrompt);
      setIsResultManuallyEdited(false);
      setPolishMessage(`模型润色完成：${result.modelId}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (props.promptPolishSettings.fallbackToLocal && !isResultManuallyEdited) {
        const fallbackPrompt = polishPrompt(editableSourcePrompt, polishMode, props.promptStyleId);
        setModelPolishedPrompt('');
        setEditableResultPrompt(fallbackPrompt);
        setLastAutoPolishedPrompt(fallbackPrompt);
      }
      setPolishMessage(
        props.promptPolishSettings.fallbackToLocal
          ? `模型润色失败，已回退本地规则：${message}`
          : `模型润色失败：${message}`
      );
    } finally {
      setIsPolishing(false);
    }
  }

  async function deleteReuseRecord(record: GenerationRecord) {
    if (!props.onDeleteRecord) {
      setCopiedMessage('当前环境暂不支持删除记录');
      return;
    }
    props.onRequestConfirm({
      title: '删除复用记录',
      message: '这条记录只会从 VisionHub 软件记录中移除，不会删除磁盘上的图片文件。',
      confirmLabel: '删除记录',
      tone: 'danger',
      onConfirm: async () => {
        await props.onDeleteRecord?.(record.id);
        setCopiedMessage('已删除软件记录，磁盘图片未删除');
      }
    });
  }

  function handleSourcePromptChange(nextPrompt: string) {
    setEditableSourcePrompt(nextPrompt);
    setModelPolishedPrompt('');
  }

  function handleResultPromptChange(nextPrompt: string) {
    setEditableResultPrompt(nextPrompt);
    setIsResultManuallyEdited(true);
  }

  function resetPolishSourcePrompt() {
    setEditableSourcePrompt(props.prompt);
    setModelPolishedPrompt('');
    setIsResultManuallyEdited(false);
    setPolishMessage('已恢复为当前创作台提示词。');
  }

  function swapPolishPrompts() {
    const nextSource = editableResultPrompt.trim() ? editableResultPrompt : polishedPrompt;
    setEditableSourcePrompt(nextSource);
    setEditableResultPrompt(editableSourcePrompt);
    setModelPolishedPrompt('');
    setIsResultManuallyEdited(true);
    setPolishMessage('已交换原提示词和润色结果。');
  }

  function changeTemplateFilter(filter: 'all' | InspirationTemplateGroup) {
    if (filter === templateFilter) return;
    const nextTemplates = filter === 'all'
      ? INSPIRATION_TEMPLATES
      : INSPIRATION_TEMPLATES.filter((template) => template.group === filter);
    setTemplateFilter(filter);
    setSelectedTemplateId(nextTemplates[0]?.id ?? INSPIRATION_TEMPLATES[0].id);
    setTemplateValues({});
  }

  function updateComposerValue(fieldId: ComposerFieldId, value: string) {
    setComposerValues((current) => ({ ...current, [fieldId]: value }));
  }

  function applyComposerPreset(presetId: string) {
    const preset = COMPOSER_PRESETS.find((item) => item.id === presetId);
    if (!preset) return;
    setComposerValues((current) => ({ ...current, ...preset.values }));
  }

  function useCurrentPromptAsComposerSubject() {
    const prompt = props.prompt.trim();
    if (!prompt) {
      setCopiedMessage('当前创作台 Prompt 为空。');
      return;
    }
    setComposerValues((current) => ({ ...current, subject: prompt }));
  }

  function clearComposerValues() {
    setComposerValues(EMPTY_COMPOSER_VALUES);
  }

  const title =
    activeMode === 'composer' ? 'Prompt 组合器' : activeMode === 'inspiration' ? '模板灵感' : activeMode === 'polish' ? '提示词润色' : '复用记录';
  const subtitle =
    activeMode === 'composer'
      ? '按主体、场景、风格、镜头和约束组合完整 Prompt'
      : activeMode === 'inspiration'
        ? '选择模板并回填到创作台'
        : activeMode === 'polish'
          ? '本地或模型结构化重写后回填提示词'
          : '从历史记录里找回好用的 Prompt';

  return (
    <div className="promptAssistBackdrop" onClick={props.onClose}>
      <section className="promptAssistWindow" onClick={(event) => event.stopPropagation()}>
        <header className="promptAssistHeader">
          <div>
            <span>{title}</span>
            <strong>{subtitle}</strong>
          </div>
          <button className="promptAssistClose" onClick={props.onClose} aria-label="关闭" title="关闭">
            <X size={18} />
          </button>
        </header>

        {activeMode === 'inspiration' ? (
          <InspirationPanel
            selectedTemplate={selectedTemplate}
            templates={filteredTemplates}
            templateFilter={templateFilter}
            values={templateValues}
            prompt={inspirationPrompt}
            onTemplateFilterChange={changeTemplateFilter}
            onSelectTemplate={(templateId) => {
              setSelectedTemplateId(templateId);
              setTemplateValues({});
            }}
            onValueChange={(key, value) => setTemplateValues((current) => ({ ...current, [key]: value }))}
            onApplyPrompt={props.onApplyPrompt}
            onCopy={copyText}
          />
        ) : null}

        {activeMode === 'composer' ? (
          <ComposerPanel
            values={composerValues}
            prompt={composerPrompt}
            presets={COMPOSER_PRESETS}
            currentPrompt={props.prompt}
            onValueChange={updateComposerValue}
            onApplyPreset={applyComposerPreset}
            onUseCurrentPrompt={useCurrentPromptAsComposerSubject}
            onClear={clearComposerValues}
            onApplyPrompt={props.onApplyPrompt}
            onCopy={copyText}
          />
        ) : null}

        {activeMode === 'polish' ? (
          <PolishPanel
            sourcePrompt={editableSourcePrompt}
            polishMode={polishMode}
            polishModes={availablePolishModes}
            promptStyleId={props.promptStyleId}
            resultPrompt={editableResultPrompt}
            engine={props.promptPolishSettings.engine}
            configId={selectedPolishConfigId}
            configOptions={polishConfigOptions.map((config) => ({ value: config.id, label: config.displayName }))}
            polishModelId={polishModelId}
            polishModelOptions={polishModelOptions}
            polishReady={polishReady}
            isPolishing={isPolishing}
            polishMessage={polishMessage}
            onModeChange={(modeId) => {
              setPolishMode(modeId);
              setModelPolishedPrompt('');
              setIsResultManuallyEdited(false);
            }}
            onStyleChange={(styleId) => {
              props.onPromptStyleChange(styleId);
              setModelPolishedPrompt('');
              setIsResultManuallyEdited(false);
            }}
            onConfigChange={(configId) => {
              const nextConfig = polishConfigOptions.find((config) => config.id === configId);
              setSelectedPolishConfigId(configId);
              setSelectedPolishModelId((nextConfig?.modelId ?? '').trim());
              setModelPolishedPrompt('');
              setIsResultManuallyEdited(false);
            }}
            onModelChange={(modelId) => {
              setSelectedPolishModelId(modelId);
              setModelPolishedPrompt('');
              setIsResultManuallyEdited(false);
            }}
            onSourcePromptChange={handleSourcePromptChange}
            onResultPromptChange={handleResultPromptChange}
            onRunModelPolish={runModelPolish}
            onResetSourcePrompt={resetPolishSourcePrompt}
            onSwapPrompts={swapPolishPrompts}
            onApplyPrompt={props.onApplyPrompt}
            onCopy={copyText}
          />
        ) : null}

        {activeMode === 'reuse' ? (
          <ReusePanel
            query={reuseQuery}
            records={promptRecords}
            totalRecords={reusableSourceRecords.length}
            providerFilter={reuseProviderFilter}
            modelFilter={reuseModelFilter}
            modeFilter={reuseModeFilter}
            statusFilter={reuseStatusFilter}
            sortMode={reuseSortMode}
            providerOptions={reuseProviderOptions}
            modelOptions={reuseModelOptions}
            showThumbnails={props.promptHistorySettings.showThumbnails}
            historyEnabled={props.promptHistorySettings.enabled}
            onQueryChange={setReuseQuery}
            onProviderFilterChange={setReuseProviderFilter}
            onModelFilterChange={setReuseModelFilter}
            onModeFilterChange={setReuseModeFilter}
            onStatusFilterChange={setReuseStatusFilter}
            onSortModeChange={setReuseSortMode}
            onResetFilters={() => {
              setReuseQuery('');
              setReuseProviderFilter('all');
              setReuseModelFilter('all');
              setReuseModeFilter('all');
              setReuseStatusFilter('all');
              setReuseSortMode('newest');
            }}
            onApplyPrompt={props.onApplyPrompt}
            onCopy={copyText}
            onDeleteRecord={deleteReuseRecord}
          />
        ) : null}


      </section>
    </div>
  );
}

function ComposerPanel(props: {
  values: ComposerValues;
  prompt: string;
  presets: typeof COMPOSER_PRESETS;
  currentPrompt: string;
  onValueChange: (fieldId: ComposerFieldId, value: string) => void;
  onApplyPreset: (presetId: string) => void;
  onUseCurrentPrompt: () => void;
  onClear: () => void;
  onApplyPrompt: (prompt: string, placement: 'replace' | 'append') => void;
  onCopy: (prompt: string) => void;
}) {
  const hasCurrentPrompt = props.currentPrompt.trim().length > 0;
  return (
    <div className="promptAssistBody twoColumn composerBody">
      <aside className="composerPresetList" aria-label="Prompt 组合器预设">
        <div className="assistTemplateCount">
          <strong>{props.presets.length}</strong>
          <span>个组合预设</span>
        </div>
        {props.presets.map((preset) => (
          <button type="button" className="composerPresetCard" key={preset.id} onClick={() => props.onApplyPreset(preset.id)}>
            <strong>{preset.title}</strong>
            <small>{preset.description}</small>
          </button>
        ))}
        <div className="composerPresetHint">
          <strong>不改主界面</strong>
          <small>组合器只在弹窗内工作，回填后才会影响当前 Prompt。</small>
        </div>
      </aside>

      <div className="assistDetailPanel composerDetailPanel">
        <div className="assistTemplateSummary composerSummary">
          <div>
            <span>V1</span>
            <strong>从片段组合完整 Prompt</strong>
          </div>
          <p>先填主体，再按需补风格、镜头、光影和约束；不会自动覆盖创作台内容。</p>
        </div>
        <div className="composerFieldGrid">
          {COMPOSER_FIELDS.map((field) => (
            <label className={field.multiline ? 'composerField composerFieldWide' : 'composerField'} key={field.id}>
              <span>{field.label}</span>
              {field.multiline ? (
                <textarea
                  value={props.values[field.id]}
                  placeholder={field.placeholder}
                  rows={3}
                  onChange={(event) => props.onValueChange(field.id, event.target.value)}
                />
              ) : (
                <input
                  value={props.values[field.id]}
                  placeholder={field.placeholder}
                  onChange={(event) => props.onValueChange(field.id, event.target.value)}
                />
              )}
            </label>
          ))}
        </div>
        <PromptPreview title="组合结果" prompt={props.prompt} />
        <AssistActions
          prompt={props.prompt}
          onApplyPrompt={props.onApplyPrompt}
          onCopy={props.onCopy}
          extraActions={(
            <>
              <button type="button" onClick={props.onUseCurrentPrompt} disabled={!hasCurrentPrompt} title="将当前创作台 Prompt 放入主体栏">
                带入当前
              </button>
              <button type="button" onClick={props.onClear}>
                清空组合
              </button>
            </>
          )}
        />
      </div>
    </div>
  );
}

function InspirationPanel(props: {
  selectedTemplate: InspirationTemplate;
  templates: InspirationTemplate[];
  templateFilter: 'all' | InspirationTemplateGroup;
  values: Record<string, string>;
  prompt: string;
  onTemplateFilterChange: (filter: 'all' | InspirationTemplateGroup) => void;
  onSelectTemplate: (templateId: string) => void;
  onValueChange: (key: string, value: string) => void;
  onApplyPrompt: (prompt: string, placement: 'replace' | 'append') => void;
  onCopy: (prompt: string) => void;
}) {
  return (
    <div className="promptAssistBody twoColumn">
      <aside className="assistTemplateList">
        <div className="assistTemplateFilters" aria-label="模板用途筛选">
          {INSPIRATION_TEMPLATE_FILTERS.map((filter) => (
            <button
              type="button"
              key={filter.id}
              className={filter.id === props.templateFilter ? 'active' : ''}
              onClick={() => props.onTemplateFilterChange(filter.id)}
              aria-pressed={filter.id === props.templateFilter}
              title={`筛选：${filter.label}`}
            >
              {filter.label}
            </button>
          ))}
        </div>

        <div className="assistTemplateCount">
          <strong>{props.templates.length}</strong>
          <span>个模板</span>
        </div>

        {props.templates.map((template) => (
          <button
            type="button"
            key={template.id}
            className={`assistTemplateCard ${template.id === props.selectedTemplate.id ? 'active' : ''}`}
            onClick={() => props.onSelectTemplate(template.id)}
            aria-pressed={template.id === props.selectedTemplate.id}
            title={template.bestFor}
          >
            <span>{template.category}</span>
            <strong>{template.title}</strong>
            <small>{template.description}</small>
          </button>
        ))}
      </aside>

      <div className="assistDetailPanel">
        <div className="assistTemplateSummary">
          <div>
            <span>{props.selectedTemplate.category}</span>
            <strong>{props.selectedTemplate.title}</strong>
          </div>
          <p>{props.selectedTemplate.bestFor}</p>
        </div>
        <div className="assistFieldGrid">
          {props.selectedTemplate.fields.map((field) => (
            <label key={field.id}>
              {field.label}
              <input
                value={props.values[field.id] ?? ''}
                placeholder={field.placeholder}
                onChange={(event) => props.onValueChange(field.id, event.target.value)}
              />
            </label>
          ))}
        </div>
        <PromptPreview prompt={props.prompt} />
        <AssistActions prompt={props.prompt} onApplyPrompt={props.onApplyPrompt} onCopy={props.onCopy} />
      </div>
    </div>
  );
}

function PolishPanel(props: {
  sourcePrompt: string;
  polishMode: string;
  polishModes: typeof POLISH_MODES;
  promptStyleId: string;
  resultPrompt: string;
  engine: PromptPolishSettings['engine'];
  configId: string;
  configOptions: Array<{ value: string; label: string }>;
  polishModelId: string;
  polishModelOptions: string[];
  polishReady: boolean;
  isPolishing: boolean;
  polishMessage: string;
  onModeChange: (mode: string) => void;
  onStyleChange: (styleId: string) => void;
  onConfigChange: (configId: string) => void;
  onModelChange: (modelId: string) => void;
  onSourcePromptChange: (prompt: string) => void;
  onResultPromptChange: (prompt: string) => void;
  onRunModelPolish: () => void;
  onResetSourcePrompt: () => void;
  onSwapPrompts: () => void;
  onApplyPrompt: (prompt: string, placement: 'replace' | 'append') => void;
  onCopy: (prompt: string) => void;
}) {
  return (
    <div className="promptAssistBody singleColumn">
      <div className="polishModeRow">
        <StudioSelect
          value={props.polishMode}
          onChange={props.onModeChange}
          options={props.polishModes.map((mode) => ({ value: mode.id, label: mode.label, description: mode.description }))}
        />
        <StudioSelect
          value={props.promptStyleId}
          onChange={props.onStyleChange}
          placeholder="画风/风格"
          options={PROMPT_STYLE_PRESETS.map((style) => ({ value: style.id, label: style.label, description: style.description }))}
        />
        <small>{props.polishModes.find((mode) => mode.id === props.polishMode)?.description}</small>
      </div>
      <div className="polishEngineBar">
        <div>
          <strong>{props.engine === 'provider' ? '模型结构化重写已启用' : '本地结构化重写已启用'}</strong>
          <small>{props.engine === 'provider' ? '可切换偏好设置里保存的文本模型。' : '当前按本地规则生成结构化预览，不会调用模型。'}</small>
        </div>
        <div className="polishModelPicker">
          <StudioSelect
            className={`polishConfigSelect noSelectCheck ${props.engine === 'local' ? 'mutedSelect' : ''}`}
            value={props.configId}
            onChange={props.onConfigChange}
            placeholder="润色配置"
            options={props.configOptions}
            disabled={props.engine === 'local'}
          />
          {props.engine === 'provider' ? (
            <StudioSelect
              className="polishModelSelect noSelectCheck"
              value={props.polishModelId}
              onChange={props.onModelChange}
              placeholder="选择润色模型"
              options={props.polishModelOptions.map((modelId) => ({ value: modelId, label: modelId }))}
            />
          ) : (
            <span className="polishModelTag active">本地规则</span>
          )}
        </div>
        <button className="polishRunButton" onClick={props.onRunModelPolish} disabled={props.isPolishing || (props.engine === 'provider' && !props.polishReady)}>
          <Wand2 size={13} /> {props.engine === 'provider' ? (props.isPolishing ? '重写中…' : '开始模型重写') : '应用本地重写'}
        </button>
      </div>
      {props.engine === 'provider' && !props.polishReady ? (
        <p className="polishConfigHint">请先到偏好设置填写润色专用 Base URL、模型 ID，并保存润色专用 API Key。</p>
      ) : null}
      <div className="polishCompareGrid">
        <PromptEditorBox
          title="原提示词"
          value={props.sourcePrompt}
          placeholder="输入或修改要润色的原始提示词。为空时会使用默认主体进行润色。"
          onChange={props.onSourcePromptChange}
        />
        <PromptEditorBox
          title="润色结果"
          value={props.resultPrompt}
          placeholder="润色结果会显示在这里，也可以直接手动修改后回填。"
          onChange={props.onResultPromptChange}
        />
      </div>
      <AssistActions
        prompt={props.resultPrompt}
        onApplyPrompt={props.onApplyPrompt}
        onCopy={props.onCopy}
        extraActions={(
          <>
            <button type="button" onClick={props.onResetSourcePrompt} title="恢复为打开弹窗时的创作台提示词">
              恢复原文
            </button>
            <button type="button" onClick={props.onSwapPrompts} title="把润色结果放到左侧继续二次润色">
              交换左右
            </button>
          </>
        )}
      />
    </div>
  );
}

function ReusePanel(props: {
  query: string;
  records: GenerationRecord[];
  totalRecords: number;
  providerFilter: string;
  modelFilter: string;
  modeFilter: ReuseModeFilter;
  statusFilter: ReuseStatusFilter;
  sortMode: ReuseSortMode;
  providerOptions: string[];
  modelOptions: string[];
  showThumbnails: boolean;
  historyEnabled: boolean;
  onQueryChange: (query: string) => void;
  onProviderFilterChange: (value: string) => void;
  onModelFilterChange: (value: string) => void;
  onModeFilterChange: (value: ReuseModeFilter) => void;
  onStatusFilterChange: (value: ReuseStatusFilter) => void;
  onSortModeChange: (value: ReuseSortMode) => void;
  onResetFilters: () => void;
  onApplyPrompt: (prompt: string, placement: 'replace' | 'append') => void;
  onCopy: (prompt: string) => void;
  onDeleteRecord: (record: GenerationRecord) => void | Promise<void>;
}) {
  const hasActiveFilters =
    props.query.trim() ||
    props.providerFilter !== 'all' ||
    props.modelFilter !== 'all' ||
    props.modeFilter !== 'all' ||
    props.statusFilter !== 'all' ||
    props.sortMode !== 'newest';
  return (
    <div className="promptAssistBody singleColumn">
      <div className="reuseSummaryBar">
        <span>
          已筛出 <strong>{props.records.length}</strong> 条 / 共 <strong>{props.totalRecords}</strong> 条
        </span>
        <button type="button" onClick={props.onResetFilters} disabled={!hasActiveFilters}>
          重置筛选
        </button>
      </div>
      <div className="reuseFilterPanel">
        <label className="reuseSearch">
          搜索记录
          <input
            value={props.query}
            placeholder="搜索 Prompt / 平台 / 模型"
            onChange={(event) => props.onQueryChange(event.target.value)}
          />
        </label>
        <label>
          平台
          <select value={props.providerFilter} onChange={(event) => props.onProviderFilterChange(event.target.value)}>
            <option value="all">全部平台</option>
            {props.providerOptions.map((provider) => (
              <option key={provider} value={provider}>{provider}</option>
            ))}
          </select>
        </label>
        <label>
          模型
          <select value={props.modelFilter} onChange={(event) => props.onModelFilterChange(event.target.value)}>
            <option value="all">全部模型</option>
            {props.modelOptions.map((model) => (
              <option key={model} value={model}>{model}</option>
            ))}
          </select>
        </label>
        <label>
          类型
          <select value={props.modeFilter} onChange={(event) => props.onModeFilterChange(event.target.value as ReuseModeFilter)}>
            <option value="all">全部类型</option>
            <option value="text-to-image">文生图</option>
            <option value="image-to-image">图生图</option>
            <option value="with-references">有参考图</option>
          </select>
        </label>
        <label>
          状态
          <select value={props.statusFilter} onChange={(event) => props.onStatusFilterChange(event.target.value as ReuseStatusFilter)}>
            <option value="all">全部状态</option>
            <option value="succeeded">成功</option>
            <option value="failed">失败</option>
            <option value="running">运行中</option>
            <option value="queued">排队中</option>
            <option value="cancelled">已取消</option>
          </select>
        </label>
        <label>
          排序
          <select value={props.sortMode} onChange={(event) => props.onSortModeChange(event.target.value as ReuseSortMode)}>
            <option value="newest">最近生成</option>
            <option value="oldest">最早生成</option>
            <option value="prompt-long">Prompt 最长</option>
            <option value="prompt-short">Prompt 最短</option>
          </select>
        </label>
      </div>
      <div className="reuseRecordList">
        {props.records.length === 0 ? (
          <div className="assistEmpty">
            <History size={30} />
            <strong>暂无可复用记录</strong>
            <small>{props.historyEnabled ? '可以调整筛选条件，或生成新图片后再复用。' : '当前偏好设置已关闭 Prompt 历史。'}</small>
          </div>
        ) : (
          props.records.map((record) => (
            <article className="reuseRecordCard" key={record.id}>
              {props.showThumbnails && record.imageUrls[0] ? <img src={record.imageUrls[0]} alt={record.prompt} /> : <div className="reuseNoImage">Prompt</div>}
              <div>
                <strong>{record.providerName ?? record.providerId}</strong>
                <small>
                  {record.modelId} · {formatGenerationMode(record)} · {record.status === 'succeeded' ? '成功' : record.status} · {formatTime(record.createdAt)}
                </small>
                <p>{record.prompt}</p>
                <div className="assistActionRow">
                  <button type="button" onClick={() => props.onApplyPrompt(record.prompt, 'replace')}>
                    <Wand2 size={13} /> 复用
                  </button>
                  <button type="button" onClick={() => props.onApplyPrompt(record.prompt, 'append')}>追加</button>
                  <button type="button" onClick={() => props.onCopy(record.prompt)}>
                    <Copy size={13} /> 复制
                  </button>
                  <button
                    className="dangerText"
                    type="button"
                    onClick={() => void props.onDeleteRecord(record)}
                    title="只删除软件记录，不删除磁盘图片"
                  >
                    <Trash2 size={13} /> 删除记录
                  </button>
                </div>
              </div>
            </article>
          ))
        )}
      </div>
    </div>
  );
}

function PromptPreview(props: { title?: string; prompt: string }) {
  const length = props.prompt.trim().length;
  return (
    <div className="promptPreviewBox">
      <strong>
        {props.title ?? 'Prompt 预览'}
        <span>{length} 字符</span>
      </strong>
      <p>{props.prompt}</p>
    </div>
  );
}

function PromptEditorBox(props: {
  title: string;
  value: string;
  placeholder: string;
  onChange: (value: string) => void;
}) {
  const length = props.value.trim().length;
  return (
    <label className="promptEditorBox">
      <span>
        <strong>{props.title}</strong>
        <small>{length} 字符</small>
      </span>
      <textarea
        value={props.value}
        placeholder={props.placeholder}
        onChange={(event) => props.onChange(event.target.value)}
      />
    </label>
  );
}

function AssistActions(props: {
  prompt: string;
  onApplyPrompt: (prompt: string, placement: 'replace' | 'append') => void;
  onCopy: (prompt: string) => void;
  extraActions?: ReactNode;
}) {
  const canUsePrompt = props.prompt.trim().length > 0;
  return (
    <div className="assistActionRow">
      <button disabled={!canUsePrompt} onClick={() => props.onApplyPrompt(props.prompt, 'replace')}>
        <Wand2 size={13} /> 回填
      </button>
      <button disabled={!canUsePrompt} onClick={() => props.onApplyPrompt(props.prompt, 'append')}>追加</button>
      <button disabled={!canUsePrompt} onClick={() => props.onCopy(props.prompt)}>
        <Copy size={13} /> 复制
      </button>
      {props.extraActions}
    </div>
  );
}

function formatTime(value: string) {
  const numeric = Number(value);
  const date = Number.isFinite(numeric) && numeric > 0 ? new Date(numeric) : new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function recordTimeMs(value: string) {
  const numeric = Number(value);
  const date = Number.isFinite(numeric) && numeric > 0 ? new Date(numeric) : new Date(value);
  const time = date.getTime();
  return Number.isNaN(time) ? 0 : time;
}

function formatGenerationMode(record: GenerationRecord) {
  if ((record.referenceImages?.length ?? 0) > 0) return `有参考图 ${record.referenceImages?.length}`;
  return (record.generationMode ?? 'text-to-image') === 'image-to-image' ? '图生图' : '文生图';
}

function uniqueRecordOptions(records: GenerationRecord[], selector: (record: GenerationRecord) => string | undefined) {
  return Array.from(new Set(records.map((record) => selector(record)?.trim()).filter((value): value is string => Boolean(value))))
    .sort((left, right) => left.localeCompare(right, 'zh-CN'));
}
