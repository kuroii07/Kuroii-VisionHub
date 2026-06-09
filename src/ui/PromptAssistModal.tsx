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
  applyPromptStyle,
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
import { useToastMessage } from './toast';

interface PromptAssistModalProps {
  mode: PromptAssistMode;
  prompt: string;
  results: GenerationRecord[];
  promptHistorySettings: PromptHistorySettings;
  promptPolishSettings: PromptPolishSettings;
  onClose: () => void;
  onApplyPrompt: (prompt: string, placement: 'replace' | 'append') => void;
  onDeleteRecord?: (recordId: string) => Promise<void>;
}

type ReuseModeFilter = 'all' | 'text-to-image' | 'image-to-image' | 'with-references';
type ReuseStatusFilter = 'all' | GenerationRecord['status'];
type ReuseSortMode = 'newest' | 'oldest' | 'prompt-long' | 'prompt-short';

export function PromptAssistModal(props: PromptAssistModalProps) {
  function resolveInitialPolishConfigId() {
    const currentConfigId = promptPolishConfigId(props.promptPolishSettings.displayName, props.promptPolishSettings.baseUrl);
    const exactConfig = props.promptPolishSettings.savedConfigs.find((config) => config.id === currentConfigId);
    return exactConfig?.id ?? props.promptPolishSettings.savedConfigs[0]?.id ?? '__current__';
  }

  const [selectedTemplateId, setSelectedTemplateId] = useState(INSPIRATION_TEMPLATES[0].id);
  const [templateFilter, setTemplateFilter] = useState<'all' | InspirationTemplateGroup>('all');
  const [templateValues, setTemplateValues] = useState<Record<string, string>>({});
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
  const [selectedPromptStyleId, setSelectedPromptStyleId] = useState('auto');
  const [polishMessage, setPolishMessage] = useState('');
  const [isPolishing, setIsPolishing] = useState(false);
  useToastMessage(copiedMessage, setCopiedMessage);
  useToastMessage(polishMessage, setPolishMessage);

  const selectedTemplate =
    INSPIRATION_TEMPLATES.find((template) => template.id === selectedTemplateId) ?? INSPIRATION_TEMPLATES[0];
  const filteredTemplates = useMemo(
    () => templateFilter === 'all'
      ? INSPIRATION_TEMPLATES
      : INSPIRATION_TEMPLATES.filter((template) => template.group === templateFilter),
    [templateFilter]
  );
  const inspirationPrompt = renderInspirationPrompt(selectedTemplate, templateValues);
  const localPolishedPrompt = polishPrompt(editableSourcePrompt, polishMode, selectedPromptStyleId);
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
      const nextLocalPrompt = polishPrompt(editableSourcePrompt, polishMode, selectedPromptStyleId);
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
        prompt: applyPromptStyle(editableSourcePrompt.trim() || '一个清晰明确的画面主体', selectedPromptStyleId),
        modeId: polishMode,
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
        const fallbackPrompt = polishPrompt(editableSourcePrompt, polishMode, selectedPromptStyleId);
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
    const ok = window.confirm('确定删除这条复用记录吗？这只会从 VisionHub 软件记录中移除，不会删除磁盘上的图片文件。');
    if (!ok) return;
    try {
      await props.onDeleteRecord(record.id);
      setCopiedMessage('已删除软件记录，磁盘图片未删除');
    } catch (error) {
      setCopiedMessage(error instanceof Error ? error.message : String(error));
    }
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

  const title =
    props.mode === 'inspiration' ? '模板灵感' : props.mode === 'polish' ? '提示词润色' : '复用记录';

  return (
    <div className="promptAssistBackdrop" onClick={props.onClose}>
      <section className="promptAssistWindow" onClick={(event) => event.stopPropagation()}>
        <header className="promptAssistHeader">
          <div>
            <span>{title}</span>
            <strong>{props.mode === 'inspiration' ? '选择模板并回填到创作台' : props.mode === 'polish' ? '本地或模型结构化重写后回填提示词' : '从历史记录里找回好用的 Prompt'}</strong>
          </div>
          <button className="promptAssistClose" onClick={props.onClose} aria-label="关闭" title="关闭">
            <X size={18} />
          </button>
        </header>

        {props.mode === 'inspiration' ? (
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

        {props.mode === 'polish' ? (
          <PolishPanel
            sourcePrompt={editableSourcePrompt}
            polishMode={polishMode}
            polishModes={availablePolishModes}
            promptStyleId={selectedPromptStyleId}
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
              setSelectedPromptStyleId(styleId);
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

        {props.mode === 'reuse' ? (
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
