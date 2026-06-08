import { Copy, History, Wand2, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import type { GenerationRecord } from '../domain/providerTypes';
import { PROMPT_POLISH_SECRET_ID, type PromptHistorySettings, type PromptPolishSettings } from '../services/appSettings';
import { polishPromptWithProvider } from '../services/desktopApi';
import { parseExtraHeaders } from '../services/providerConfig';
import {
  INSPIRATION_TEMPLATES,
  POLISH_MODES,
  getDefaultPolishMode,
  getPolishModesForEngine,
  polishPrompt,
  renderInspirationPrompt,
  resolvePolishMode,
  type InspirationTemplate,
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
}

export function PromptAssistModal(props: PromptAssistModalProps) {
  function resolveInitialPolishConfigId() {
    const selectedModelId = props.promptPolishSettings.modelId.trim();
    const matchedConfig = props.promptPolishSettings.savedConfigs.find(
      (config) => config.modelId === selectedModelId || config.modelOptions.includes(selectedModelId)
    );
    return matchedConfig?.id ?? props.promptPolishSettings.savedConfigs[0]?.id ?? '__current__';
  }

  const [selectedTemplateId, setSelectedTemplateId] = useState(INSPIRATION_TEMPLATES[0].id);
  const [templateValues, setTemplateValues] = useState<Record<string, string>>({});
  const [polishMode, setPolishMode] = useState(() =>
    resolvePolishMode(
      props.promptHistorySettings.defaultPolishMode || getDefaultPolishMode(props.promptPolishSettings.engine),
      props.promptPolishSettings.engine
    ).id
  );
  const [reuseQuery, setReuseQuery] = useState('');
  const [copiedMessage, setCopiedMessage] = useState('');
  const [modelPolishedPrompt, setModelPolishedPrompt] = useState('');
  const [selectedPolishConfigId, setSelectedPolishConfigId] = useState(resolveInitialPolishConfigId);
  const [selectedPolishModelId, setSelectedPolishModelId] = useState(props.promptPolishSettings.modelId.trim());
  const [polishMessage, setPolishMessage] = useState('');
  const [isPolishing, setIsPolishing] = useState(false);
  useToastMessage(copiedMessage, setCopiedMessage);
  useToastMessage(polishMessage, setPolishMessage);

  const selectedTemplate =
    INSPIRATION_TEMPLATES.find((template) => template.id === selectedTemplateId) ?? INSPIRATION_TEMPLATES[0];
  const inspirationPrompt = renderInspirationPrompt(selectedTemplate, templateValues);
  const localPolishedPrompt = polishPrompt(props.prompt, polishMode);
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
    setSelectedPolishConfigId(nextConfigId);
    setSelectedPolishModelId(props.promptPolishSettings.modelId.trim());
    setModelPolishedPrompt('');
  }, [props.promptPolishSettings.engine, props.promptPolishSettings.modelId, props.promptPolishSettings.savedConfigs]);

  useEffect(() => {
    const resolvedMode = resolvePolishMode(polishMode, props.promptPolishSettings.engine);
    if (resolvedMode.id !== polishMode) {
      setPolishMode(resolvedMode.id);
      setModelPolishedPrompt('');
    }
  }, [polishMode, props.promptPolishSettings.engine]);
  const normalizedQuery = reuseQuery.trim().toLowerCase();
  const promptRecords = useMemo(() => {
    const seen = new Set<string>();
    if (!props.promptHistorySettings.enabled) return [];

    return props.results
      .filter((record) => record.prompt.trim())
      .filter((record) => props.promptHistorySettings.includeFailed || record.status !== 'failed')
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
      .slice(0, props.promptHistorySettings.maxItems);
  }, [normalizedQuery, props.promptHistorySettings, props.results]);

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
        prompt: props.prompt.trim() || '一个清晰明确的画面主体',
        modeId: polishMode,
        settings: { ...effectivePolishSettings, modelId: polishModelId },
        baseUrl: polishBaseUrl,
        extraHeaders: parseExtraHeaders(effectivePolishSettings.extraHeadersJson),
        secretId: PROMPT_POLISH_SECRET_ID
      });
      setModelPolishedPrompt(result.polishedPrompt);
      setPolishMessage(`模型润色完成：${result.modelId}`);
    } catch (error) {
      setModelPolishedPrompt('');
      const message = error instanceof Error ? error.message : String(error);
      setPolishMessage(
        props.promptPolishSettings.fallbackToLocal
          ? `模型润色失败，已回退本地规则：${message}`
          : `模型润色失败：${message}`
      );
    } finally {
      setIsPolishing(false);
    }
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
          <button className="promptAssistClose" onClick={props.onClose} aria-label="关闭">
            <X size={18} />
          </button>
        </header>

        {props.mode === 'inspiration' ? (
          <InspirationPanel
            selectedTemplate={selectedTemplate}
            values={templateValues}
            prompt={inspirationPrompt}
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
            sourcePrompt={props.prompt}
            polishMode={polishMode}
            polishModes={availablePolishModes}
            resultPrompt={polishedPrompt}
            engine={props.promptPolishSettings.engine}
            configId={selectedPolishConfigId}
            configOptions={polishConfigOptions.map((config) => ({ value: config.id, label: config.displayName }))}
            polishModelId={polishModelId}
            polishModelOptions={polishModelOptions}
            polishReady={polishReady}
            isPolishing={isPolishing}
            polishMessage={polishMessage}
            onModeChange={setPolishMode}
            onConfigChange={(configId) => {
              const nextConfig = polishConfigOptions.find((config) => config.id === configId);
              setSelectedPolishConfigId(configId);
              setSelectedPolishModelId((nextConfig?.modelId ?? '').trim());
              setModelPolishedPrompt('');
            }}
            onModelChange={(modelId) => {
              setSelectedPolishModelId(modelId);
              setModelPolishedPrompt('');
            }}
            onRunModelPolish={runModelPolish}
            onApplyPrompt={props.onApplyPrompt}
            onCopy={copyText}
          />
        ) : null}

        {props.mode === 'reuse' ? (
          <ReusePanel
            query={reuseQuery}
            records={promptRecords}
            showThumbnails={props.promptHistorySettings.showThumbnails}
            historyEnabled={props.promptHistorySettings.enabled}
            onQueryChange={setReuseQuery}
            onApplyPrompt={props.onApplyPrompt}
            onCopy={copyText}
          />
        ) : null}

      </section>
    </div>
  );
}

function InspirationPanel(props: {
  selectedTemplate: InspirationTemplate;
  values: Record<string, string>;
  prompt: string;
  onSelectTemplate: (templateId: string) => void;
  onValueChange: (key: string, value: string) => void;
  onApplyPrompt: (prompt: string, placement: 'replace' | 'append') => void;
  onCopy: (prompt: string) => void;
}) {
  return (
    <div className="promptAssistBody twoColumn">
      <aside className="assistTemplateList">
        {INSPIRATION_TEMPLATES.map((template) => (
          <button
            key={template.id}
            className={template.id === props.selectedTemplate.id ? 'active' : ''}
            onClick={() => props.onSelectTemplate(template.id)}
          >
            <span>{template.category}</span>
            <strong>{template.title}</strong>
            <small>{template.description}</small>
          </button>
        ))}
      </aside>

      <div className="assistDetailPanel">
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
  onConfigChange: (configId: string) => void;
  onModelChange: (modelId: string) => void;
  onRunModelPolish: () => void;
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
        <small>{props.polishModes.find((mode) => mode.id === props.polishMode)?.description}</small>
      </div>
      <div className="polishEngineBar">
        <div>
          <strong>{props.engine === 'provider' ? '模型结构化重写已启用' : '本地结构化重写已启用'}</strong>
          <small>{props.engine === 'provider' ? '可切换偏好设置里保存的文本模型。' : '当前按本地规则生成结构化预览，不会调用模型。'}</small>
        </div>
        <div className="polishModelPicker">
          <StudioSelect
            className="polishConfigSelect noSelectCheck"
            value={props.configId}
            onChange={props.onConfigChange}
            placeholder="润色配置"
            options={props.configOptions}
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
            <span className="polishModelTag">本地规则</span>
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
        <PromptPreview title="原提示词" prompt={props.sourcePrompt || '当前提示词为空，将使用默认主体进行润色。'} />
        <PromptPreview title="润色结果" prompt={props.resultPrompt} />
      </div>
      <AssistActions prompt={props.resultPrompt} onApplyPrompt={props.onApplyPrompt} onCopy={props.onCopy} />
    </div>
  );
}

function ReusePanel(props: {
  query: string;
  records: GenerationRecord[];
  showThumbnails: boolean;
  historyEnabled: boolean;
  onQueryChange: (query: string) => void;
  onApplyPrompt: (prompt: string, placement: 'replace' | 'append') => void;
  onCopy: (prompt: string) => void;
}) {
  return (
    <div className="promptAssistBody singleColumn">
      <label className="reuseSearch">
        搜索记录
        <input
          value={props.query}
          placeholder="搜索 Prompt / 平台 / 模型"
          onChange={(event) => props.onQueryChange(event.target.value)}
        />
      </label>
      <div className="reuseRecordList">
        {props.records.length === 0 ? (
          <div className="assistEmpty">
            <History size={30} />
            <strong>暂无可复用记录</strong>
          </div>
        ) : (
          props.records.map((record) => (
            <article className="reuseRecordCard" key={record.id}>
              {props.showThumbnails && record.imageUrls[0] ? <img src={record.imageUrls[0]} alt={record.prompt} /> : <div className="reuseNoImage">Prompt</div>}
              <div>
                <strong>{record.providerName ?? record.providerId}</strong>
                <small>{record.modelId} · {formatTime(record.createdAt)}</small>
                <p>{record.prompt}</p>
                <div className="assistActionRow">
                  <button onClick={() => props.onApplyPrompt(record.prompt, 'replace')}>
                    <Wand2 size={13} /> 复用
                  </button>
                  <button onClick={() => props.onApplyPrompt(record.prompt, 'append')}>追加</button>
                  <button onClick={() => props.onCopy(record.prompt)}>
                    <Copy size={13} /> 复制
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

function AssistActions(props: {
  prompt: string;
  onApplyPrompt: (prompt: string, placement: 'replace' | 'append') => void;
  onCopy: (prompt: string) => void;
}) {
  return (
    <div className="assistActionRow">
      <button onClick={() => props.onApplyPrompt(props.prompt, 'replace')}>
        <Wand2 size={13} /> 回填
      </button>
      <button onClick={() => props.onApplyPrompt(props.prompt, 'append')}>追加</button>
      <button onClick={() => props.onCopy(props.prompt)}>
        <Copy size={13} /> 复制
      </button>
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
