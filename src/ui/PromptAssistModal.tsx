import { Copy, History, Star, Trash2, Wand2, X } from 'lucide-react';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import type { GenerationRecord } from '../domain/providerTypes';
import { PROMPT_POLISH_SECRET_ID, promptPolishConfigId, type PromptHistorySettings, type PromptPolishSettings } from '../services/appSettings';
import { polishPromptWithProvider } from '../services/desktopApi';
import { readStorageValue, writeStorageValue } from '../services/safeStorage';
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
import type { Translator } from '../i18n';
import type { ConfirmDialogRequest } from './confirmDialog';
import { useToastMessage } from './toast';

interface PromptAssistModalProps {
  t: Translator;
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
type ReuseFavoriteFilter = 'all' | 'favorite';
type ReuseSortMode = 'newest' | 'oldest' | 'prompt-long' | 'prompt-short';

type ComposerFieldId = 'subject' | 'scene' | 'style' | 'camera' | 'lighting' | 'material' | 'color' | 'constraints' | 'negative';
type ComposerValues = Record<ComposerFieldId, string>;

const COMPOSER_FIELDS: Array<{ id: ComposerFieldId; multiline?: boolean }> = [
  { id: 'subject' },
  { id: 'scene' },
  { id: 'style' },
  { id: 'camera' },
  { id: 'lighting' },
  { id: 'material' },
  { id: 'color' },
  { id: 'constraints', multiline: true },
  { id: 'negative', multiline: true }
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

const PROMPT_REUSE_FAVORITES_KEY = 'visionhub.promptReuseFavorites.v1';

function loadPromptReuseFavoriteIds() {
  try {
    const raw = readStorageValue(PROMPT_REUSE_FAVORITES_KEY);
    if (!raw) return new Set<string>();
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return new Set<string>();
    return new Set(parsed.filter((value): value is string => typeof value === 'string' && value.trim().length > 0));
  } catch {
    return new Set<string>();
  }
}

function savePromptReuseFavoriteIds(ids: Set<string>) {
  writeStorageValue(PROMPT_REUSE_FAVORITES_KEY, JSON.stringify(Array.from(ids)));
}

const COMPOSER_PRESETS: Array<{ id: string; title: string; description: string; values: Partial<ComposerValues> }> = [
  {
    id: 'cinematic-character',
    title: 'Cinematic character',
    description: 'For portraits, character cards, and mood images.',
    values: { style: 'Cinematic realism, restrained emotion, premium image quality', camera: '85mm portrait lens, medium close-up, clear subject emphasis', lighting: 'Soft rim light with layered background depth', constraints: 'Clear facial features, stable composition, rich details, no text or watermark' }
  },
  {
    id: 'premium-product',
    title: 'Premium product image',
    description: 'For e-commerce hero images, product launches, and commercial posters.',
    values: { scene: 'Minimal commercial display stage with a clean background', style: 'Premium commercial photography with brand-ad quality', camera: 'Centered composition with the product as the visual focus', lighting: 'Studio softbox lighting with refined edge highlights', constraints: 'Crisp product edges, realistic materials, no extra text or logo' }
  },
  {
    id: 'game-asset',
    title: 'Game asset',
    description: 'For props, skill icons, character equipment, and reward cards.',
    values: { style: 'Game art concept style, strong silhouette, readable at small sizes', camera: 'Centered display, simple background, complete subject', lighting: 'Clear highlights and energy glow', material: 'Distinct material boundaries and recognizable structure', constraints: 'Reusable for game UI, no complex background, no text' }
  },
  {
    id: 'social-cover',
    title: 'Social cover',
    description: 'For Xiaohongshu, Bilibili, short-video thumbnails, and tutorial covers.',
    values: { style: 'Highly recognizable social-cover style with strong contrast and clear information', camera: 'Enlarged subject, reserved title area, click-attracting composition', color: 'High-contrast main color that stands out in mobile feeds', constraints: 'Subject visible at a glance, clear reserved text area, uncluttered image' }
  }
];

function i18nKey(key: string) {
  return key as Parameters<Translator>[0];
}

function composerFieldLabel(fieldId: ComposerFieldId, t: Translator) {
  return t(i18nKey(`assist.composer.field.${fieldId}.label`));
}

function composerFieldPlaceholder(fieldId: ComposerFieldId, t: Translator) {
  return t(i18nKey(`assist.composer.field.${fieldId}.placeholder`));
}

function composerPresetTitle(presetId: string, fallback: string, t: Translator) {
  const key = i18nKey(`assist.composer.preset.${presetId}.title`);
  const translated = t(key);
  return translated === key ? fallback : translated;
}

function composerPresetDescription(presetId: string, fallback: string, t: Translator) {
  const key = i18nKey(`assist.composer.preset.${presetId}.description`);
  const translated = t(key);
  return translated === key ? fallback : translated;
}

function composerPresetValues(preset: typeof COMPOSER_PRESETS[number], t: Translator) {
  const translatedValues: Partial<ComposerValues> = {};
  (Object.keys(preset.values) as ComposerFieldId[]).forEach((fieldId) => {
    const fallback = preset.values[fieldId];
    if (!fallback) return;
    const key = i18nKey(`assist.composer.preset.${preset.id}.value.${fieldId}`);
    const translated = t(key);
    translatedValues[fieldId] = translated === key ? fallback : translated;
  });
  return translatedValues;
}

function inspirationFilterLabel(filter: { id: 'all' | InspirationTemplateGroup; label: string }, t: Translator) {
  const key = i18nKey(`assist.inspiration.filter.${filter.id}`);
  const translated = t(key);
  return translated === key ? filter.label : translated;
}

function polishModeLabel(mode: { id: string; label: string; scope: 'local' | 'provider' }, t: Translator) {
  const key = i18nKey(`assist.polish.mode.${mode.scope}.${mode.id}.label`);
  const translated = t(key);
  return translated === key ? mode.label : translated;
}

function polishModeDescription(mode: { id: string; description: string; scope: 'local' | 'provider' }, t: Translator) {
  const key = i18nKey(`assist.polish.mode.${mode.scope}.${mode.id}.description`);
  const translated = t(key);
  return translated === key ? mode.description : translated;
}

function promptStyleLabel(style: { id: string; label: string }, t: Translator) {
  const key = i18nKey(`assist.polish.style.${style.id}.label`);
  const translated = t(key);
  return translated === key ? style.label : translated;
}

function promptStyleDescription(style: { id: string; description: string }, t: Translator) {
  const key = i18nKey(`assist.polish.style.${style.id}.description`);
  const translated = t(key);
  return translated === key ? style.description : translated;
}

function buildComposerPrompt(values: ComposerValues, t: Translator) {
  const scene = values.scene.trim();
  const parts = [
    values.subject.trim(),
    scene ? t('assist.composer.scenePrefix', { scene }) : '',
    values.style.trim(),
    values.camera.trim(),
    values.lighting.trim(),
    values.material.trim(),
    values.color.trim(),
    values.constraints.trim()
  ].filter(Boolean);
  const positivePrompt = parts.join(t('assist.composer.separator'));
  const negativePrompt = values.negative.trim();
  if (positivePrompt && negativePrompt) return `${positivePrompt}
${t('assist.composer.negativePrefix', { prompt: negativePrompt })}`;
  if (negativePrompt) return t('assist.composer.negativePrefix', { prompt: negativePrompt });
  return positivePrompt;
}

export function PromptAssistModal(props: PromptAssistModalProps) {
  const t = props.t;
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
  const [reuseFavoriteFilter, setReuseFavoriteFilter] = useState<ReuseFavoriteFilter>('all');
  const [reuseSortMode, setReuseSortMode] = useState<ReuseSortMode>('newest');
  const [reuseFavoriteIds, setReuseFavoriteIds] = useState<Set<string>>(() => loadPromptReuseFavoriteIds());
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
  const composerPrompt = useMemo(() => buildComposerPrompt(composerValues, t), [composerValues, t]);
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
  const favoriteReuseCount = useMemo(
    () => reusableSourceRecords.filter((record) => reuseFavoriteIds.has(record.id)).length,
    [reusableSourceRecords, reuseFavoriteIds]
  );

  const promptRecords = useMemo(() => {
    const seen = new Set<string>();
    if (!props.promptHistorySettings.enabled) return [];

    const records = reusableSourceRecords
      .filter((record) => props.promptHistorySettings.includeFailed || record.status !== 'failed')
      .filter((record) => reuseProviderFilter === 'all' || (record.providerName ?? record.providerId) === reuseProviderFilter)
      .filter((record) => reuseModelFilter === 'all' || record.modelId === reuseModelFilter)
      .filter((record) => reuseStatusFilter === 'all' || record.status === reuseStatusFilter)
      .filter((record) => reuseFavoriteFilter === 'all' || reuseFavoriteIds.has(record.id))
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
    reuseFavoriteFilter,
    reuseFavoriteIds,
    reuseSortMode
  ]);

  async function copyText(value: string) {
    try {
      await navigator.clipboard?.writeText(value);
      setCopiedMessage(t('assist.copy.ok'));
    } catch {
      setCopiedMessage(t('assist.copy.failed'));
    }
  }

  async function runModelPolish() {
    if (!modelPolishEnabled) {
      setModelPolishedPrompt('');
      const nextLocalPrompt = polishPrompt(editableSourcePrompt, polishMode, props.promptStyleId);
      setEditableResultPrompt(nextLocalPrompt);
      setLastAutoPolishedPrompt(nextLocalPrompt);
      setIsResultManuallyEdited(false);
      setPolishMessage(t('assist.polish.localMessage'));
      return;
    }
    if (!polishBaseUrl) {
      setPolishMessage(t('assist.polish.needBaseUrl'));
      return;
    }
    if (!polishModelId) {
      setPolishMessage(t('assist.polish.needModel'));
      return;
    }

    setIsPolishing(true);
    setPolishMessage('');
    try {
      const result = await polishPromptWithProvider({
        providerId: 'prompt-polish',
        modelId: polishModelId,
        prompt: editableSourcePrompt.trim() || t('assist.polish.defaultSubject'),
        modeId: polishMode,
        styleId: props.promptStyleId,
        settings: { ...effectivePolishSettings, modelId: polishModelId },
        baseUrl: polishBaseUrl,
        extraHeaders: parseExtraHeaders(effectivePolishSettings.extraHeadersJson),
        secretId: PROMPT_POLISH_SECRET_ID
      });
      setModelPolishedPrompt(result.polishedPrompt);
      setIsResultManuallyEdited(false);
      setPolishMessage(t('assist.polish.done', { model: result.modelId }));
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
          ? t('assist.polish.failedFallback', { message })
          : t('assist.polish.failed', { message })
      );
    } finally {
      setIsPolishing(false);
    }
  }

  async function deleteReuseRecord(record: GenerationRecord) {
    if (!props.onDeleteRecord) {
      setCopiedMessage(t('assist.reuse.deleteUnsupported'));
      return;
    }
    props.onRequestConfirm({
      title: t('assist.reuse.deleteTitle'),
      message: t('assist.reuse.deleteMessage'),
      confirmLabel: t('assist.reuse.deleteConfirm'),
      tone: 'danger',
      onConfirm: async () => {
        await props.onDeleteRecord?.(record.id);
        setReuseFavoriteIds((current) => {
          if (!current.has(record.id)) return current;
          const next = new Set(current);
          next.delete(record.id);
          savePromptReuseFavoriteIds(next);
          return next;
        });
        setCopiedMessage(t('assist.reuse.deleted'));
      }
    });
  }

  function toggleReuseFavorite(record: GenerationRecord) {
    setReuseFavoriteIds((current) => {
      const next = new Set(current);
      const willFavorite = !next.has(record.id);
      if (willFavorite) next.add(record.id);
      else next.delete(record.id);
      savePromptReuseFavoriteIds(next);
      setCopiedMessage(willFavorite ? t('assist.reuse.favoriteOn') : t('assist.reuse.favoriteOff'));
      return next;
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
    setPolishMessage(t('assist.polish.resetDone'));
  }

  function swapPolishPrompts() {
    const nextSource = editableResultPrompt.trim() ? editableResultPrompt : polishedPrompt;
    setEditableSourcePrompt(nextSource);
    setEditableResultPrompt(editableSourcePrompt);
    setModelPolishedPrompt('');
    setIsResultManuallyEdited(true);
    setPolishMessage(t('assist.polish.swapDone'));
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
    setComposerValues((current) => ({ ...current, ...composerPresetValues(preset, t) }));
  }

  function useCurrentPromptAsComposerSubject() {
    const prompt = props.prompt.trim();
    if (!prompt) {
      setCopiedMessage(t('assist.reuse.emptyCurrent'));
      return;
    }
    setComposerValues((current) => ({ ...current, subject: prompt }));
  }

  function clearComposerValues() {
    setComposerValues(EMPTY_COMPOSER_VALUES);
  }

  const title =
    activeMode === 'composer' ? t('assist.title.composer') : activeMode === 'inspiration' ? t('assist.title.inspiration') : activeMode === 'polish' ? t('assist.title.polish') : t('assist.title.reuse');
  const subtitle =
    activeMode === 'composer'
      ? t('assist.subtitle.composer')
      : activeMode === 'inspiration'
        ? t('assist.subtitle.inspiration')
        : activeMode === 'polish'
          ? t('assist.subtitle.polish')
          : t('assist.subtitle.reuse');

  return (
    <div className="promptAssistBackdrop" onClick={props.onClose}>
      <section className="promptAssistWindow" onClick={(event) => event.stopPropagation()}>
        <header className="promptAssistHeader">
          <div>
            <span>{title}</span>
            <strong>{subtitle}</strong>
          </div>
          <button className="promptAssistClose" onClick={props.onClose} aria-label={t('assist.close')} title={t('assist.close')}>
            <X size={18} />
          </button>
        </header>

        {activeMode === 'inspiration' ? (
          <InspirationPanel
            t={t}
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
            t={t}
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
            t={t}
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
            t={t}
            query={reuseQuery}
            records={promptRecords}
            totalRecords={reusableSourceRecords.length}
            providerFilter={reuseProviderFilter}
            modelFilter={reuseModelFilter}
            modeFilter={reuseModeFilter}
            statusFilter={reuseStatusFilter}
            favoriteFilter={reuseFavoriteFilter}
            sortMode={reuseSortMode}
            favoriteCount={favoriteReuseCount}
            providerOptions={reuseProviderOptions}
            modelOptions={reuseModelOptions}
            showThumbnails={props.promptHistorySettings.showThumbnails}
            historyEnabled={props.promptHistorySettings.enabled}
            isRecordFavorite={(recordId) => reuseFavoriteIds.has(recordId)}
            onQueryChange={setReuseQuery}
            onProviderFilterChange={setReuseProviderFilter}
            onModelFilterChange={setReuseModelFilter}
            onModeFilterChange={setReuseModeFilter}
            onStatusFilterChange={setReuseStatusFilter}
            onFavoriteFilterChange={setReuseFavoriteFilter}
            onSortModeChange={setReuseSortMode}
            onResetFilters={() => {
              setReuseQuery('');
              setReuseProviderFilter('all');
              setReuseModelFilter('all');
              setReuseModeFilter('all');
              setReuseStatusFilter('all');
              setReuseFavoriteFilter('all');
              setReuseSortMode('newest');
            }}
            onApplyPrompt={props.onApplyPrompt}
            onCopy={copyText}
            onToggleFavorite={toggleReuseFavorite}
            onDeleteRecord={deleteReuseRecord}
          />
        ) : null}


      </section>
    </div>
  );
}

function ComposerPanel(props: {
  t: Translator;
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
      <aside className="composerPresetList" aria-label={props.t('assist.composer.presetsAria')}>
        <div className="assistTemplateCount">
          <strong>{props.presets.length}</strong>
          <span>{props.t('assist.composer.presetCount')}</span>
        </div>
        {props.presets.map((preset) => (
          <button type="button" className="composerPresetCard" key={preset.id} onClick={() => props.onApplyPreset(preset.id)}>
            <strong>{composerPresetTitle(preset.id, preset.title, props.t)}</strong>
            <small>{composerPresetDescription(preset.id, preset.description, props.t)}</small>
          </button>
        ))}
        <div className="composerPresetHint">
          <strong>{props.t('assist.composer.safeHintTitle')}</strong>
          <small>{props.t('assist.composer.safeHint')}</small>
        </div>
      </aside>

      <div className="assistDetailPanel composerDetailPanel">
        <div className="assistTemplateSummary composerSummary">
          <div>
            <span>V1</span>
            <strong>{props.t('assist.composer.summaryTitle')}</strong>
          </div>
          <p>{props.t('assist.composer.summaryHint')}</p>
        </div>
        <div className="composerFieldGrid">
          {COMPOSER_FIELDS.map((field) => (
            <label className={field.multiline ? 'composerField composerFieldWide' : 'composerField'} key={field.id}>
              <span>{composerFieldLabel(field.id, props.t)}</span>
              {field.multiline ? (
                <textarea
                  value={props.values[field.id]}
                  placeholder={composerFieldPlaceholder(field.id, props.t)}
                  rows={3}
                  onChange={(event) => props.onValueChange(field.id, event.target.value)}
                />
              ) : (
                <input
                  value={props.values[field.id]}
                  placeholder={composerFieldPlaceholder(field.id, props.t)}
                  onChange={(event) => props.onValueChange(field.id, event.target.value)}
                />
              )}
            </label>
          ))}
        </div>
        <PromptPreview t={props.t} title={props.t('assist.composer.resultTitle')} prompt={props.prompt} />
        <AssistActions
          t={props.t}
          prompt={props.prompt}
          onApplyPrompt={props.onApplyPrompt}
          onCopy={props.onCopy}
          extraActions={(
            <>
              <button type="button" onClick={props.onUseCurrentPrompt} disabled={!hasCurrentPrompt} title={props.t('assist.composer.useCurrentTitle')}>
                {props.t('assist.composer.useCurrent')}
              </button>
              <button type="button" onClick={props.onClear}>
                {props.t('assist.composer.clear')}
              </button>
            </>
          )}
        />
      </div>
    </div>
  );
}

function InspirationPanel(props: {
  t: Translator;
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
        <div className="assistTemplateFilters" aria-label={props.t('assist.inspiration.filtersAria')}>
          {INSPIRATION_TEMPLATE_FILTERS.map((filter) => (
            <button
              type="button"
              key={filter.id}
              className={filter.id === props.templateFilter ? 'active' : ''}
              onClick={() => props.onTemplateFilterChange(filter.id)}
              aria-pressed={filter.id === props.templateFilter}
              title={props.t('assist.inspiration.filterTitle', { filter: inspirationFilterLabel(filter, props.t) })}
            >
              {inspirationFilterLabel(filter, props.t)}
            </button>
          ))}
        </div>

        <div className="assistTemplateCount">
          <strong>{props.templates.length}</strong>
          <span>{props.t('assist.inspiration.templateCount')}</span>
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
        <PromptPreview t={props.t} prompt={props.prompt} />
        <AssistActions t={props.t} prompt={props.prompt} onApplyPrompt={props.onApplyPrompt} onCopy={props.onCopy} />
      </div>
    </div>
  );
}

function PolishPanel(props: {
  t: Translator;
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
          options={props.polishModes.map((mode) => ({ value: mode.id, label: polishModeLabel(mode, props.t), description: polishModeDescription(mode, props.t) }))}
        />
        <StudioSelect
          value={props.promptStyleId}
          onChange={props.onStyleChange}
          placeholder={props.t('assist.polish.stylePlaceholder')}
          options={PROMPT_STYLE_PRESETS.map((style) => ({ value: style.id, label: promptStyleLabel(style, props.t), description: promptStyleDescription(style, props.t) }))}
        />
        <small>{props.polishModes.find((mode) => mode.id === props.polishMode) ? polishModeDescription(props.polishModes.find((mode) => mode.id === props.polishMode)!, props.t) : ''}</small>
      </div>
      <div className="polishEngineBar">
        <div>
          <strong>{props.engine === 'provider' ? props.t('assist.polish.providerOn') : props.t('assist.polish.localOn')}</strong>
          <small>{props.engine === 'provider' ? props.t('assist.polish.providerHint') : props.t('assist.polish.localHint')}</small>
        </div>
        <div className="polishModelPicker">
          <StudioSelect
            className={`polishConfigSelect noSelectCheck ${props.engine === 'local' ? 'mutedSelect' : ''}`}
            value={props.configId}
            onChange={props.onConfigChange}
            placeholder={props.t('assist.polish.configPlaceholder')}
            options={props.configOptions}
            disabled={props.engine === 'local'}
          />
          {props.engine === 'provider' ? (
            <StudioSelect
              className="polishModelSelect noSelectCheck"
              value={props.polishModelId}
              onChange={props.onModelChange}
              placeholder={props.t('assist.polish.modelPlaceholder')}
              options={props.polishModelOptions.map((modelId) => ({ value: modelId, label: modelId }))}
            />
          ) : (
            <span className="polishModelTag active">{props.t('assist.polish.localTag')}</span>
          )}
        </div>
        <button className="polishRunButton" onClick={props.onRunModelPolish} disabled={props.isPolishing || (props.engine === 'provider' && !props.polishReady)}>
          <Wand2 size={13} /> {props.engine === 'provider' ? (props.isPolishing ? props.t('assist.polish.running') : props.t('assist.polish.runModel')) : props.t('assist.polish.runLocal')}
        </button>
      </div>
      {props.engine === 'provider' && !props.polishReady ? (
        <p className="polishConfigHint">{props.t('assist.polish.configHint')}</p>
      ) : null}
      <div className="polishCompareGrid">
        <PromptEditorBox
          t={props.t}
          title={props.t('assist.polish.sourceTitle')}
          value={props.sourcePrompt}
          placeholder={props.t('assist.polish.sourcePlaceholder')}
          onChange={props.onSourcePromptChange}
        />
        <PromptEditorBox
          t={props.t}
          title={props.t('assist.polish.resultTitle')}
          value={props.resultPrompt}
          placeholder={props.t('assist.polish.resultPlaceholder')}
          onChange={props.onResultPromptChange}
        />
      </div>
      <AssistActions
        t={props.t}
        prompt={props.resultPrompt}
        onApplyPrompt={props.onApplyPrompt}
        onCopy={props.onCopy}
        extraActions={(
          <>
            <button type="button" onClick={props.onResetSourcePrompt} title={props.t('assist.polish.resetTitle')}>
              {props.t('assist.polish.reset')}
            </button>
            <button type="button" onClick={props.onSwapPrompts} title={props.t('assist.polish.swapTitle')}>
              {props.t('assist.polish.swap')}
            </button>
          </>
        )}
      />
    </div>
  );
}

function ReusePanel(props: {
  t: Translator;
  query: string;
  records: GenerationRecord[];
  totalRecords: number;
  providerFilter: string;
  modelFilter: string;
  modeFilter: ReuseModeFilter;
  statusFilter: ReuseStatusFilter;
  favoriteFilter: ReuseFavoriteFilter;
  sortMode: ReuseSortMode;
  favoriteCount: number;
  providerOptions: string[];
  modelOptions: string[];
  showThumbnails: boolean;
  historyEnabled: boolean;
  isRecordFavorite: (recordId: string) => boolean;
  onQueryChange: (query: string) => void;
  onProviderFilterChange: (value: string) => void;
  onModelFilterChange: (value: string) => void;
  onModeFilterChange: (value: ReuseModeFilter) => void;
  onStatusFilterChange: (value: ReuseStatusFilter) => void;
  onFavoriteFilterChange: (value: ReuseFavoriteFilter) => void;
  onSortModeChange: (value: ReuseSortMode) => void;
  onResetFilters: () => void;
  onApplyPrompt: (prompt: string, placement: 'replace' | 'append') => void;
  onCopy: (prompt: string) => void;
  onToggleFavorite: (record: GenerationRecord) => void;
  onDeleteRecord: (record: GenerationRecord) => void | Promise<void>;
}) {
  const hasActiveFilters =
    props.query.trim() ||
    props.providerFilter !== 'all' ||
    props.modelFilter !== 'all' ||
    props.modeFilter !== 'all' ||
    props.statusFilter !== 'all' ||
    props.favoriteFilter !== 'all' ||
    props.sortMode !== 'newest';
  return (
    <div className="promptAssistBody singleColumn">
      <div className="reuseSummaryBar">
        <span>
          {props.t('assist.reuse.summary', { shown: props.records.length, total: props.totalRecords })}
          <small>{props.t('assist.reuse.favoriteCount', { count: props.favoriteCount })}</small>
        </span>
        <div className="reuseQuickActions" aria-label={props.t('assist.reuse.quickAria')}>
          <button
            type="button"
            className={props.favoriteFilter === 'favorite' ? 'active' : ''}
            onClick={() => props.onFavoriteFilterChange(props.favoriteFilter === 'favorite' ? 'all' : 'favorite')}
            title={props.favoriteFilter === 'favorite' ? props.t('assist.reuse.showAll') : props.t('assist.reuse.onlyFavoriteTitle')}
            aria-pressed={props.favoriteFilter === 'favorite'}
          >
            <Star size={13} fill={props.favoriteFilter === 'favorite' ? 'currentColor' : 'none'} /> {props.t('assist.reuse.onlyFavorite')}
          </button>
          <button
            type="button"
            className={props.statusFilter === 'succeeded' ? 'active' : ''}
            onClick={() => props.onStatusFilterChange(props.statusFilter === 'succeeded' ? 'all' : 'succeeded')}
            title={props.statusFilter === 'succeeded' ? props.t('assist.reuse.showAllStatus') : props.t('assist.reuse.onlySucceededTitle')}
            aria-pressed={props.statusFilter === 'succeeded'}
          >
            {props.t('assist.reuse.onlySucceeded')}
          </button>
          <button type="button" onClick={props.onResetFilters} disabled={!hasActiveFilters}>
            {props.t('assist.reuse.resetFilters')}
          </button>
        </div>
      </div>
      <div className="reuseFilterPanel">
        <label className="reuseSearch">
          {props.t('assist.reuse.searchLabel')}
          <input
            value={props.query}
            placeholder={props.t('assist.reuse.searchPlaceholder')}
            onChange={(event) => props.onQueryChange(event.target.value)}
          />
        </label>
        <label>
          {props.t('assist.reuse.provider')}
          <select value={props.providerFilter} onChange={(event) => props.onProviderFilterChange(event.target.value)}>
            <option value="all">{props.t('assist.reuse.allProviders')}</option>
            {props.providerOptions.map((provider) => (
              <option key={provider} value={provider}>{provider}</option>
            ))}
          </select>
        </label>
        <label>
          {props.t('assist.reuse.model')}
          <select value={props.modelFilter} onChange={(event) => props.onModelFilterChange(event.target.value)}>
            <option value="all">{props.t('assist.reuse.allModels')}</option>
            {props.modelOptions.map((model) => (
              <option key={model} value={model}>{model}</option>
            ))}
          </select>
        </label>
        <label>
          {props.t('assist.reuse.type')}
          <select value={props.modeFilter} onChange={(event) => props.onModeFilterChange(event.target.value as ReuseModeFilter)}>
            <option value="all">{props.t('assist.reuse.allTypes')}</option>
            <option value="text-to-image">{props.t('assist.reuse.textToImage')}</option>
            <option value="image-to-image">{props.t('assist.reuse.imageToImage')}</option>
            <option value="with-references">{props.t('assist.reuse.withReferences')}</option>
          </select>
        </label>
        <label>
          {props.t('assist.reuse.status')}
          <select value={props.statusFilter} onChange={(event) => props.onStatusFilterChange(event.target.value as ReuseStatusFilter)}>
            <option value="all">{props.t('assist.reuse.allStatuses')}</option>
            <option value="succeeded">{props.t('assist.reuse.statusSucceeded')}</option>
            <option value="failed">{props.t('assist.reuse.statusFailed')}</option>
            <option value="running">{props.t('assist.reuse.statusRunning')}</option>
            <option value="queued">{props.t('assist.reuse.statusQueued')}</option>
            <option value="cancelled">{props.t('assist.reuse.statusCancelled')}</option>
          </select>
        </label>
        <label>
          {props.t('assist.reuse.sort')}
          <select value={props.sortMode} onChange={(event) => props.onSortModeChange(event.target.value as ReuseSortMode)}>
            <option value="newest">{props.t('assist.reuse.sortNewest')}</option>
            <option value="oldest">{props.t('assist.reuse.sortOldest')}</option>
            <option value="prompt-long">{props.t('assist.reuse.sortLong')}</option>
            <option value="prompt-short">{props.t('assist.reuse.sortShort')}</option>
          </select>
        </label>
      </div>
      <div className="reuseRecordList">
        {props.records.length === 0 ? (
          <div className="assistEmpty">
            <History size={30} />
            <strong>{props.t('assist.reuse.emptyTitle')}</strong>
            <small>{props.historyEnabled ? props.t('assist.reuse.emptyHintEnabled') : props.t('assist.reuse.emptyHintDisabled')}</small>
          </div>
        ) : (
          props.records.map((record) => {
            const isFavorite = props.isRecordFavorite(record.id);
            return (
              <article className={`reuseRecordCard ${isFavorite ? 'favorite' : ''}`} key={record.id}>
                {props.showThumbnails && record.imageUrls[0] ? <img src={record.imageUrls[0]} alt={record.prompt} /> : <div className="reuseNoImage">Prompt</div>}
                <div>
                  <div className="reuseRecordHeader">
                    <div>
                      <strong>{record.providerName ?? record.providerId}</strong>
                      <small>
                        {record.modelId} · {formatGenerationMode(record, props.t)} · {record.status === 'succeeded' ? props.t('assist.reuse.statusSucceeded') : record.status} · {formatTime(record.createdAt)}
                      </small>
                    </div>
                    <button
                      className={`iconMiniButton reuseFavoriteButton ${isFavorite ? 'active' : ''}`}
                      type="button"
                      onClick={() => props.onToggleFavorite(record)}
                      title={isFavorite ? props.t('assist.reuse.favoriteRemove') : props.t('assist.reuse.favoriteAdd')}
                      aria-label={isFavorite ? props.t('assist.reuse.favoriteRemove') : props.t('assist.reuse.favoriteAdd')}
                      aria-pressed={isFavorite}
                    >
                      <Star size={13} fill={isFavorite ? 'currentColor' : 'none'} />
                    </button>
                  </div>
                  <p>{record.prompt}</p>
                  <div className="assistActionRow">
                    <button type="button" onClick={() => props.onApplyPrompt(record.prompt, 'replace')}>
                      <Wand2 size={13} /> {props.t('assist.reuse.use')}
                    </button>
                    <button type="button" onClick={() => props.onApplyPrompt(record.prompt, 'append')}>{props.t('assist.actions.append')}</button>
                    <button type="button" onClick={() => props.onCopy(record.prompt)}>
                      <Copy size={13} /> {props.t('assist.actions.copy')}
                    </button>
                    <button
                      className="dangerText"
                      type="button"
                      onClick={() => void props.onDeleteRecord(record)}
                      title={props.t('assist.reuse.deleteSoftTitle')}
                    >
                      <Trash2 size={13} /> {props.t('assist.reuse.delete')}
                    </button>
                  </div>
                </div>
              </article>
            );
          })
        )}
      </div>
    </div>
  );
}

function PromptPreview(props: { t: Translator; title?: string; prompt: string }) {
  const length = props.prompt.trim().length;
  return (
    <div className="promptPreviewBox">
      <strong>
        {props.title ?? props.t('assist.preview.title')}
        <span>{props.t('assist.preview.length', { count: length })}</span>
      </strong>
      <p>{props.prompt}</p>
    </div>
  );
}

function PromptEditorBox(props: {
  t: Translator;
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
        <small>{props.t('assist.preview.length', { count: length })}</small>
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
  t: Translator;
  prompt: string;
  onApplyPrompt: (prompt: string, placement: 'replace' | 'append') => void;
  onCopy: (prompt: string) => void;
  extraActions?: ReactNode;
}) {
  const canUsePrompt = props.prompt.trim().length > 0;
  return (
    <div className="assistActionRow">
      <button disabled={!canUsePrompt} onClick={() => props.onApplyPrompt(props.prompt, 'replace')}>
        <Wand2 size={13} /> {props.t('assist.actions.apply')}
      </button>
      <button disabled={!canUsePrompt} onClick={() => props.onApplyPrompt(props.prompt, 'append')}>{props.t('assist.actions.append')}</button>
      <button disabled={!canUsePrompt} onClick={() => props.onCopy(props.prompt)}>
        <Copy size={13} /> {props.t('assist.actions.copy')}
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

function formatGenerationMode(record: GenerationRecord, t: Translator) {
  if ((record.referenceImages?.length ?? 0) > 0) return t('assist.reuse.withReferenceCount', { count: record.referenceImages?.length ?? 0 });
  return (record.generationMode ?? 'text-to-image') === 'image-to-image' ? t('assist.reuse.imageToImage') : t('assist.reuse.textToImage');
}

function uniqueRecordOptions(records: GenerationRecord[], selector: (record: GenerationRecord) => string | undefined) {
  return Array.from(new Set(records.map((record) => selector(record)?.trim()).filter((value): value is string => Boolean(value))))
    .sort((left, right) => left.localeCompare(right, 'zh-CN'));
}
