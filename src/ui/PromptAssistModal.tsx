import { Copy, History, Wand2, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import type { GenerationRecord } from '../domain/providerTypes';
import type { PromptHistorySettings, PromptPolishSettings } from '../services/appSettings';
import { polishPromptWithProvider } from '../services/desktopApi';
import { loadProviderConfig, parseExtraHeaders } from '../services/providerConfig';
import {
  INSPIRATION_TEMPLATES,
  POLISH_MODES,
  polishPrompt,
  renderInspirationPrompt,
  type InspirationTemplate,
  type PromptAssistMode
} from '../services/promptAssist';
import { StudioSelect } from './StudioSelect';

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
  const [selectedTemplateId, setSelectedTemplateId] = useState(INSPIRATION_TEMPLATES[0].id);
  const [templateValues, setTemplateValues] = useState<Record<string, string>>({});
  const [polishMode, setPolishMode] = useState(props.promptHistorySettings.defaultPolishMode || POLISH_MODES[0].id);
  const [reuseQuery, setReuseQuery] = useState('');
  const [copiedMessage, setCopiedMessage] = useState('');
  const [modelPolishedPrompt, setModelPolishedPrompt] = useState('');
  const [polishMessage, setPolishMessage] = useState('');
  const [isPolishing, setIsPolishing] = useState(false);

  const selectedTemplate =
    INSPIRATION_TEMPLATES.find((template) => template.id === selectedTemplateId) ?? INSPIRATION_TEMPLATES[0];
  const inspirationPrompt = renderInspirationPrompt(selectedTemplate, templateValues);
  const localPolishedPrompt = polishPrompt(props.prompt, polishMode);
  const polishedPrompt = modelPolishedPrompt || localPolishedPrompt;
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
    if (props.promptPolishSettings.engine !== 'provider') {
      setPolishMessage('当前偏好设置使用本地规则润色；如需模型润色，请到「偏好设置」切换润色引擎。');
      return;
    }

    if (!['openai-gpt-image', 'custom-http-provider'].includes(props.promptPolishSettings.providerId)) {
      setPolishMessage('当前版本的模型润色先支持 GPT Image 和 OpenAI 兼容中转；已显示本地规则润色结果。');
      return;
    }

    setIsPolishing(true);
    setPolishMessage('');
    try {
      const providerConfig = loadProviderConfig(props.promptPolishSettings.providerId);
      const result = await polishPromptWithProvider({
        providerId: props.promptPolishSettings.providerId,
        modelId: props.promptPolishSettings.modelId || providerConfig.modelId,
        prompt: props.prompt.trim() || '一个清晰明确的画面主体',
        modeId: polishMode,
        settings: props.promptPolishSettings,
        baseUrl: providerConfig.baseUrl,
        extraHeaders: parseExtraHeaders(providerConfig.extraHeadersJson)
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
    props.mode === 'inspiration' ? '灵感库' : props.mode === 'polish' ? '提示词润色' : '复用记录';

  return (
    <div className="promptAssistBackdrop" onClick={props.onClose}>
      <section className="promptAssistWindow" onClick={(event) => event.stopPropagation()}>
        <header className="promptAssistHeader">
          <div>
            <span>{title}</span>
            <strong>{props.mode === 'inspiration' ? '选择模板并填写关键词' : props.mode === 'polish' ? '把简单提示词扩写得更完整' : '从历史记录里找回好用的 Prompt'}</strong>
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
            resultPrompt={polishedPrompt}
            engine={props.promptPolishSettings.engine}
            isPolishing={isPolishing}
            polishMessage={polishMessage}
            onModeChange={setPolishMode}
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

        {copiedMessage ? <p className="promptAssistMessage">{copiedMessage}</p> : null}
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
  resultPrompt: string;
  engine: PromptPolishSettings['engine'];
  isPolishing: boolean;
  polishMessage: string;
  onModeChange: (mode: string) => void;
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
          options={POLISH_MODES.map((mode) => ({ value: mode.id, label: mode.label }))}
        />
        <small>{POLISH_MODES.find((mode) => mode.id === props.polishMode)?.description}</small>
      </div>
      <div className="polishEngineBar">
        <div>
          <strong>{props.engine === 'provider' ? '模型润色已启用' : '本地规则润色'}</strong>
          <small>{props.engine === 'provider' ? '点击后会调用偏好设置中选择的文本模型。' : '不消耗 API 额度，适合离线快速补全。'}</small>
        </div>
        <button onClick={props.onRunModelPolish} disabled={props.isPolishing || props.engine !== 'provider'}>
          <Wand2 size={13} /> {props.isPolishing ? '润色中…' : '开始模型润色'}
        </button>
      </div>
      <div className="polishCompareGrid">
        <PromptPreview title="原提示词" prompt={props.sourcePrompt || '当前提示词为空，将使用默认主体进行润色。'} />
        <PromptPreview title="润色结果" prompt={props.resultPrompt} />
      </div>
      {props.polishMessage ? <p className="promptAssistMessage inline">{props.polishMessage}</p> : null}
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
          placeholder="搜索 Prompt / Provider / 模型"
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
  return (
    <div className="promptPreviewBox">
      <strong>{props.title ?? 'Prompt 预览'}</strong>
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
        <Wand2 size={13} /> 应用
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
