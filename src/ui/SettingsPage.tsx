import {
  ClipboardPaste,
  Download,
  ExternalLink,
  FolderOpen,
  HardDrive,
  Info,
  Keyboard,
  Monitor,
  Moon,
  RefreshCcw,
  ShieldCheck,
  Sun,
  Trash2
} from 'lucide-react';
import type { Translator } from '../i18n';
import { listProviders } from '../providers/registry';
import {
  DEFAULT_COUNT_OPTIONS,
  DEFAULT_QUALITY_OPTIONS,
  DEFAULT_REFERENCE_ROLE_OPTIONS,
  DEFAULT_SIZE_OPTIONS,
  FILE_NAMING_RULE_OPTIONS,
  GENERATOR_ACCENT_OPTIONS,
  getRecommendedGlobalAccent,
  IMAGE_PROMPT_REVERSE_DETAIL_OPTIONS,
  IMAGE_PROMPT_REVERSE_LANGUAGE_OPTIONS,
  IMAGE_PROMPT_REVERSE_PROTOCOL_OPTIONS,
  LANGUAGE_OPTIONS,
  OUTPUT_FORMAT_OPTIONS,
  PRIMARY_ACCENT_OPTIONS,
  PROMPT_HISTORY_LIMIT_OPTIONS,
  PROMPT_POLISH_ENGINE_OPTIONS,
  PROMPT_POLISH_LANGUAGE_OPTIONS,
  PROMPT_POLISH_PROTOCOL_OPTIONS,
  PROMPT_POLISH_STRENGTH_OPTIONS,
  promptPolishConfigId,
  REFRESH_INTERVAL_OPTIONS,
  STARTUP_PAGE_OPTIONS,
  type AppPage,
  type AppSettings,
  type GenerationDefaults,
  type HomeModuleSettings,
  type ImagePromptReverseSettings,
  type PromptHistorySettings,
  type PromptPolishSettings
} from '../services/appSettings';
import type { StorageSettings } from '../services/desktopApi';
import { getPolishModesForEngine, resolvePolishMode } from '../services/promptAssist';
import { OFFICIAL_OPENAI_BASE_URL } from '../services/providerConfig';
import { StudioSelect } from './StudioSelect';

export function SettingsPage(props: {
  appVersion: string;
  appSettings: AppSettings;
  t: Translator;
  providers: ReturnType<typeof listProviders>;
  desktopRuntime: boolean;
  storageSettings: StorageSettings | null;
  systemTheme: 'dark' | 'light';
  promptPolishDraft: PromptPolishSettings;
  promptPolishSecretDraft: string;
  promptPolishSecretAvailable: boolean;
  isSavingPromptPolishSecret: boolean;
  isRefreshingPromptPolishModels: boolean;
  imageReverseDraft: ImagePromptReverseSettings;
  imageReverseSecretDraft: string;
  imageReverseSecretAvailable: boolean;
  isSavingImageReverseSecret: boolean;
  isRefreshingImageReverseModels: boolean;
  onSettingsChange: (patch: Partial<AppSettings>) => void;
  onPromptPolishDraftChange: (patch: Partial<PromptPolishSettings>) => void;
  onSavePromptPolishConfig: () => void;
  onRefreshPromptPolishModels: () => void;
  onPromptPolishSecretDraftChange: (value: string) => void;
  onSavePromptPolishSecret: () => void;
  onImageReverseDraftChange: (patch: Partial<ImagePromptReverseSettings>) => void;
  onSaveImageReverseConfig: () => void;
  onRefreshImageReverseModels: () => void;
  onImageReverseSecretDraftChange: (value: string) => void;
  onSaveImageReverseSecret: () => void;
  onSelectLibraryPath: () => void;
  onResetLibraryPath: () => void;
  onOpenLibraryDirectory: () => void;
  onSelectInspirationPath: () => void;
  onResetInspirationPath: () => void;
  onOpenInspirationDirectory: () => void;
  onOpenAppDataDirectory: () => void;
  onOpenBackupsDirectory: () => void;
  onExportSettingsBackup: () => void;
  onExportMigrationGuide: () => void;
  onOpenSystemInfo: () => void;
  onOpenShortcuts: () => void;
  onOpenReleasePage: () => void;
}) {
  const settings = props.appSettings;
  const generationDefaults = settings.generationDefaults;
  const promptHistory = settings.promptHistory;
  const savePreferences = settings.savePreferences;
  const homeModules = settings.homeModules;
  const promptPolish = props.promptPolishDraft;
  const imageReverse = props.imageReverseDraft;
  const promptPolishDefaultMode = resolvePolishMode(promptHistory.defaultPolishMode, promptPolish.engine);
  const promptPolishModeOptions = getPolishModesForEngine(promptPolish.engine);
  const defaultProvider = props.providers.find((provider) => provider.id === generationDefaults.defaultProviderId) ?? props.providers[0];
  const defaultModelOptions = defaultProvider.models.map((model) => ({ value: model.id, label: model.label || model.id }));
  const selectedDefaultModel = defaultModelOptions.some((option) => option.value === generationDefaults.defaultModelId)
    ? generationDefaults.defaultModelId
    : defaultModelOptions[0]?.value ?? generationDefaults.defaultModelId;
  const translatedStartupPageOptions = STARTUP_PAGE_OPTIONS.map((option) => ({
    value: option.value,
    label: props.t(`settings.startup.${option.value}` as Parameters<Translator>[0])
  }));
  const translatedReferenceRoleOptions = DEFAULT_REFERENCE_ROLE_OPTIONS.map((option) => ({
    value: option.value,
    label: props.t(`settings.role.${option.value}` as Parameters<Translator>[0])
  }));
  const translatedSizeOptions = DEFAULT_SIZE_OPTIONS.map((option) => ({
    value: option.value,
    label: props.t(
      ({
        '1024x1024': 'settings.size.square',
        '1280x720': 'settings.size.landscape',
        '720x1280': 'settings.size.portrait',
        '1024x1536': 'settings.size.poster',
        '1536x1024': 'settings.size.banner'
      } as Record<string, Parameters<Translator>[0]>)[option.value] ?? 'settings.size.square'
    )
  }));
  const translatedCountOptions = DEFAULT_COUNT_OPTIONS.map((option) => ({
    value: String(option.value),
    label: props.t('settings.countImages', { count: option.value })
  }));
  const translatedQualityOptions = DEFAULT_QUALITY_OPTIONS.map((option) => ({
    value: option.value,
    label: props.t(`settings.quality.${option.value}` as Parameters<Translator>[0])
  }));
  const translatedPromptHistoryLimitOptions = PROMPT_HISTORY_LIMIT_OPTIONS.map((option) => ({
    value: String(option.value),
    label: props.t('settings.historyLimitItems', { count: option.value })
  }));
  const translatedPromptPolishModeOptions = promptPolishModeOptions.map((mode) => ({
    value: mode.id,
    label: props.t(`settings.polishMode.${mode.scope}.${mode.id}` as Parameters<Translator>[0])
  }));
  const translatedPromptPolishEngineOptions = PROMPT_POLISH_ENGINE_OPTIONS.map((option) => ({
    value: option.value,
    label: props.t(`settings.polishEngine.${option.value}` as Parameters<Translator>[0])
  }));
  const translatedPromptPolishLanguageOptions = PROMPT_POLISH_LANGUAGE_OPTIONS.map((option) => ({
    value: option.value,
    label: props.t(`settings.polishLanguage.${option.value}` as Parameters<Translator>[0])
  }));
  const translatedPromptPolishStrengthOptions = PROMPT_POLISH_STRENGTH_OPTIONS.map((option) => ({
    value: option.value,
    label: props.t(`settings.polishStrength.${option.value}` as Parameters<Translator>[0])
  }));
  const translatedPromptPolishProtocolOptions = PROMPT_POLISH_PROTOCOL_OPTIONS.map((option) => ({
    value: option.value,
    label: props.t(`settings.polishProtocol.${option.value}` as Parameters<Translator>[0])
  }));
  const translatedFileNamingRuleOptions = FILE_NAMING_RULE_OPTIONS.map((option) => ({
    value: option.value,
    label: props.t(`settings.fileNaming.${option.value}` as Parameters<Translator>[0])
  }));
  const translatedRefreshIntervalOptions = REFRESH_INTERVAL_OPTIONS.map((option) => ({
    value: option.value,
    label: option.value < 60
      ? props.t('settings.refreshSeconds', { count: option.value })
      : props.t('settings.refreshMinutes', { count: option.value / 60 })
  }));
  const translatedImageReverseProtocolOptions = IMAGE_PROMPT_REVERSE_PROTOCOL_OPTIONS.map((option) => ({
    value: option.value,
    label: props.t(`settings.imageReverseProtocol.${option.value}` as Parameters<Translator>[0])
  }));
  const translatedImageReverseDetailOptions = IMAGE_PROMPT_REVERSE_DETAIL_OPTIONS.map((option) => ({
    value: option.value,
    label: props.t(`settings.imageReverseDetail.${option.value}` as Parameters<Translator>[0])
  }));
  const translatedImageReverseLanguageOptions = IMAGE_PROMPT_REVERSE_LANGUAGE_OPTIONS.map((option) => ({
    value: option.value,
    label: props.t(`settings.imageReverseLanguage.${option.value}` as Parameters<Translator>[0])
  }));

  function updateGenerationDefaults(patch: Partial<GenerationDefaults>) {
    props.onSettingsChange({ generationDefaults: { ...generationDefaults, ...patch } });
  }

  function updatePromptHistory(patch: Partial<PromptHistorySettings>) {
    props.onSettingsChange({ promptHistory: { ...promptHistory, ...patch } });
  }

  function updateSavePreferences(patch: Partial<AppSettings['savePreferences']>) {
    props.onSettingsChange({ savePreferences: { ...savePreferences, ...patch } });
  }

  function updateHomeModules(patch: Partial<HomeModuleSettings>) {
    props.onSettingsChange({ homeModules: { ...homeModules, ...patch } });
  }

  function updatePromptPolish(patch: Partial<PromptPolishSettings>, options?: { commit?: boolean }) {
    const nextPromptPolish = { ...promptPolish, ...patch };
    props.onPromptPolishDraftChange(patch);
    if (options?.commit) {
      props.onSettingsChange({ promptPolish: nextPromptPolish });
    }
  }

  function updateImageReverse(patch: Partial<ImagePromptReverseSettings>, options?: { commit?: boolean }) {
    const nextImageReverse = { ...imageReverse, ...patch };
    props.onImageReverseDraftChange(patch);
    if (options?.commit) {
      props.onSettingsChange({ imagePromptReverse: nextImageReverse });
    }
  }

  function deletePromptPolishConfig(configId: string) {
    const nextConfigs = promptPolish.savedConfigs.filter((config) => config.id !== configId);
    const currentConfigId = promptPolishConfigId(promptPolish.displayName, promptPolish.baseUrl);
    const nextActive = configId === currentConfigId ? nextConfigs[0] : null;
    const nextPromptPolish: PromptPolishSettings = {
      ...promptPolish,
      ...(nextActive
        ? {
            displayName: nextActive.displayName,
            baseUrl: nextActive.baseUrl,
            modelId: nextActive.modelId,
            modelOptions: nextActive.modelOptions,
            extraHeadersJson: nextActive.extraHeadersJson,
            protocol: nextActive.protocol
          }
        : {}),
      ...(configId === currentConfigId && !nextActive
        ? {
            displayName: props.t('settings.promptPolishConfigPlaceholder'),
            baseUrl: '',
            modelId: '',
            modelOptions: [],
            extraHeadersJson: '{}',
            protocol: 'chat-completions' as const
          }
        : {}),
      savedConfigs: nextConfigs
    };
    props.onPromptPolishDraftChange(nextPromptPolish);
    props.onSettingsChange({ promptPolish: nextPromptPolish });
  }

  function updateDefaultProvider(providerId: string) {
    const provider = props.providers.find((item) => item.id === providerId) ?? props.providers[0];
    updateGenerationDefaults({
      defaultProviderId: provider.id,
      defaultModelId: provider.models[0]?.id ?? generationDefaults.defaultModelId
    });
  }

  return (
    <section className="systemSettingsPage">
      <header className="systemSettingsHeader">
        <div>
          <p className="eyebrow">Preferences</p>
          <h1>{props.t('settings.title')}</h1>
          <span>{props.t('settings.subtitle')}</span>
        </div>
        <div className="settingsHeaderActions">
          <button type="button" data-tooltip={props.t('settings.systemInfo')} aria-label={props.t('settings.systemInfo')} onClick={props.onOpenSystemInfo}>
            <Info size={16} />
          </button>
          <button type="button" data-tooltip={props.t('settings.shortcuts')} aria-label={props.t('settings.shortcuts')} onClick={props.onOpenShortcuts}>
            <Keyboard size={16} />
          </button>
        </div>
      </header>

      <div className="settingsSectionLabel">{props.t('settings.appearance')}</div>
      <article className="settingsGroupCard">
        <div className="settingsListRow">
          <div className="settingsRowMain">
            <strong>{props.t('settings.theme')}</strong>
          </div>
          <div className="segmentedControl themeSegment">
            <button className={settings.themeMode === 'light' ? 'active' : ''} onClick={() => props.onSettingsChange({ themeMode: 'light' })}>
              <Sun size={14} /> {props.t('settings.themeLight')}
            </button>
            <button className={settings.themeMode === 'dark' ? 'active' : ''} onClick={() => props.onSettingsChange({ themeMode: 'dark' })}>
              <Moon size={14} /> {props.t('settings.themeDark')}
            </button>
            <button className={settings.themeMode === 'system' ? 'active' : ''} onClick={() => props.onSettingsChange({ themeMode: 'system' })}>
              <Monitor size={14} /> {props.t('settings.themeSystem')}
            </button>
          </div>
        </div>

        <div className="settingsListRow">
          <div className="settingsRowMain">
            <strong>{props.t('settings.language')}</strong>
            <small>{props.t('settings.languageHint')}</small>
          </div>
          <div className="segmentedControl compactSegment">
            {LANGUAGE_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                className={settings.language === option.value ? 'active' : ''}
                onClick={() => props.onSettingsChange({ language: option.value })}
              >
                {option.shortLabel}
              </button>
            ))}
          </div>
        </div>

        <div className="settingsListRow">
          <div className="settingsRowMain">
            <strong>{props.t('settings.primaryColor')}</strong>
            <small>{props.t('settings.primaryColorHint')}</small>
          </div>
          <div className="colorDotRow">
            {PRIMARY_ACCENT_OPTIONS.map((option) => (
              <button
                key={option.value}
                className={`colorDot ${settings.primaryAccent === option.value ? 'active' : ''}`}
                style={{ background: option.value }}
                title={option.label}
                aria-label={`${props.t('settings.primaryColor')}: ${option.label}`}
                onClick={() => props.onSettingsChange({
                  primaryAccent: option.value,
                  generatorAccent: getRecommendedGlobalAccent(option.value)
                })}
              />
            ))}
          </div>
        </div>

        <div className="settingsListRow">
          <div className="settingsRowMain">
            <strong>{props.t('settings.globalAccent')}</strong>
            <small>{props.t('settings.globalAccentHint')}</small>
          </div>
          <div className="colorDotRow">
            {GENERATOR_ACCENT_OPTIONS.map((option) => (
              <button
                key={option.value}
                className={`colorDot ${settings.generatorAccent === option.value ? 'active' : ''}`}
                style={{ background: option.value }}
                title={option.label}
                aria-label={`${props.t('settings.globalAccent')}: ${option.label}`}
                onClick={() => props.onSettingsChange({ generatorAccent: option.value })}
              />
            ))}
          </div>
        </div>
      </article>

      <div className="settingsSectionLabel">{props.t('settings.interfaceHome')}</div>
      <article className="settingsGroupCard">
        <div className="settingsListRow">
          <div className="settingsRowMain">
            <strong>{props.t('settings.startupPage')}</strong>
            <small>{props.t('settings.startupPageHint')}</small>
          </div>
          <div className="settingsControlSlim">
            <StudioSelect
              value={settings.startupPage}
              onChange={(value) => props.onSettingsChange({ startupPage: value as AppPage })}
              options={translatedStartupPageOptions}
            />
          </div>
        </div>

        <div className="settingsListRow">
          <div className="settingsRowMain">
            <strong>{props.t('settings.sidebarDefault')}</strong>
            <small>{props.t('settings.sidebarDefaultHint')}</small>
          </div>
          <div className="segmentedControl compactSegment">
            <button className={!settings.sidebarCollapsed ? 'active' : ''} onClick={() => props.onSettingsChange({ sidebarCollapsed: false })}>
              {props.t('settings.sidebarExpanded')}
            </button>
            <button className={settings.sidebarCollapsed ? 'active' : ''} onClick={() => props.onSettingsChange({ sidebarCollapsed: true })}>
              {props.t('settings.sidebarCollapsed')}
            </button>
          </div>
        </div>

        <div className="settingsListRow">
          <div className="settingsRowMain">
            <strong>{props.t('settings.interfaceDensity')}</strong>
            <small>{props.t('settings.interfaceDensityHint')}</small>
          </div>
          <button
            className={settings.compactMode ? 'settingsTogglePill active' : 'settingsTogglePill'}
            type="button"
            onClick={() => props.onSettingsChange({ compactMode: !settings.compactMode })}
          >
            {settings.compactMode ? props.t('settings.compactMode') : props.t('settings.standardMode')}
          </button>
        </div>

        <div className="settingsListRow settingsTallRow">
          <div className="settingsRowMain">
            <strong>{props.t('settings.homeModules')}</strong>
            <small>{props.t('settings.homeModulesHint')}</small>
          </div>
          <div className="settingsBooleanGrid homeModuleGrid">
            <button className={homeModules.resume ? 'active' : ''} onClick={() => updateHomeModules({ resume: !homeModules.resume })}>{props.t('settings.home.resume')}</button>
            <button className={homeModules.attention ? 'active' : ''} onClick={() => updateHomeModules({ attention: !homeModules.attention })}>{props.t('settings.home.attention')}</button>
            <button className={homeModules.materials ? 'active' : ''} onClick={() => updateHomeModules({ materials: !homeModules.materials })}>{props.t('settings.home.materials')}</button>
            <button className={homeModules.quickActions ? 'active' : ''} onClick={() => updateHomeModules({ quickActions: !homeModules.quickActions })}>{props.t('settings.home.quickActions')}</button>
          </div>
        </div>
      </article>

      <div className="settingsSectionLabel">{props.t('settings.generationDefaults')}</div>
      <article className="settingsGroupCard">
        <div className="settingsListRow">
          <div className="settingsRowMain">
            <strong>{props.t('settings.defaultMode')}</strong>
            <small>{props.t('settings.defaultModeHint')}</small>
          </div>
          <div className="segmentedControl compactSegment">
            <button className={generationDefaults.defaultMode === 'text' ? 'active' : ''} onClick={() => updateGenerationDefaults({ defaultMode: 'text' })}>
              {props.t('settings.modeTextToImage')}
            </button>
            <button className={generationDefaults.defaultMode === 'image' ? 'active' : ''} onClick={() => updateGenerationDefaults({ defaultMode: 'image' })}>
              {props.t('settings.modeImageToImage')}
            </button>
          </div>
        </div>

        <div className="settingsListRow">
          <div className="settingsRowMain">
            <strong>{props.t('settings.defaultReferenceRole')}</strong>
            <small>{props.t('settings.defaultReferenceRoleHint')}</small>
          </div>
          <div className="settingsControlSlim">
            <StudioSelect
              value={generationDefaults.defaultReferenceRole}
              onChange={(value) => updateGenerationDefaults({ defaultReferenceRole: value as GenerationDefaults['defaultReferenceRole'] })}
              options={translatedReferenceRoleOptions}
            />
          </div>
        </div>

        <div className="settingsListRow settingsTallRow">
          <div className="settingsRowMain">
            <strong>{props.t('settings.defaultProviderModel')}</strong>
            <small>{props.t('settings.defaultProviderModelHint')}</small>
          </div>
          <div className="settingsInlineGrid">
            <StudioSelect
              value={generationDefaults.defaultProviderId}
              onChange={updateDefaultProvider}
              options={props.providers.map((provider) => ({ value: provider.id, label: provider.name }))}
            />
            <StudioSelect
              value={selectedDefaultModel}
              onChange={(value) => updateGenerationDefaults({ defaultModelId: value })}
              options={defaultModelOptions}
            />
          </div>
        </div>

        <div className="settingsListRow settingsTallRow">
          <div className="settingsRowMain">
            <strong>{props.t('settings.defaultImageParams')}</strong>
            <small>{props.t('settings.defaultImageParamsHint')}</small>
          </div>
          <div className="settingsInlineGrid triple">
            <StudioSelect
              value={generationDefaults.defaultSize}
              onChange={(value) => updateGenerationDefaults({ defaultSize: value })}
              options={translatedSizeOptions}
            />
            <StudioSelect
              value={String(generationDefaults.defaultCount)}
              onChange={(value) => updateGenerationDefaults({ defaultCount: Number(value) })}
              options={translatedCountOptions}
            />
            <StudioSelect
              value={generationDefaults.defaultQuality}
              onChange={(value) => updateGenerationDefaults({ defaultQuality: value })}
              options={translatedQualityOptions}
            />
          </div>
        </div>

        <div className="settingsListRow settingsTallRow">
          <div className="settingsRowMain">
            <strong>{props.t('settings.outputFormat')}</strong>
            <small>{props.t('settings.outputFormatHint')}</small>
          </div>
          <div className="settingsInlineGrid">
            <StudioSelect
              value={generationDefaults.outputFormat}
              onChange={(value) => updateGenerationDefaults({ outputFormat: value as GenerationDefaults['outputFormat'] })}
              options={OUTPUT_FORMAT_OPTIONS}
            />
          </div>
        </div>
      </article>

      <div className="settingsSectionLabel">{props.t('settings.promptHistory')}</div>
      <article className="settingsGroupCard">
        <div className="settingsListRow settingsTallRow">
          <div className="settingsRowMain">
            <strong>{props.t('settings.reuseHistoryPolicy')}</strong>
            <small>{props.t('settings.reuseHistoryPolicyHint')}</small>
          </div>
          <div className="settingsBooleanGrid">
            <button className={promptHistory.enabled ? 'active' : ''} onClick={() => updatePromptHistory({ enabled: !promptHistory.enabled })}>{props.t('settings.history.save')}</button>
            <button className={promptHistory.dedupe ? 'active' : ''} onClick={() => updatePromptHistory({ dedupe: !promptHistory.dedupe })}>{props.t('settings.history.dedupe')}</button>
            <button className={promptHistory.includeFailed ? 'active' : ''} onClick={() => updatePromptHistory({ includeFailed: !promptHistory.includeFailed })}>{props.t('settings.history.includeFailed')}</button>
            <button className={promptHistory.showThumbnails ? 'active' : ''} onClick={() => updatePromptHistory({ showThumbnails: !promptHistory.showThumbnails })}>{props.t('settings.history.thumbnails')}</button>
          </div>
        </div>

        <div className="settingsListRow">
          <div className="settingsRowMain">
            <strong>{props.t('settings.historyLimit')}</strong>
            <small>{props.t('settings.historyLimitHint')}</small>
          </div>
          <div className="settingsControlSlim">
            <StudioSelect
              value={String(promptHistory.maxItems)}
              onChange={(value) => updatePromptHistory({ maxItems: Number(value) })}
              options={translatedPromptHistoryLimitOptions}
            />
          </div>
        </div>

        <div className="settingsListRow">
          <div className="settingsRowMain">
            <strong>{props.t('settings.defaultPolishMode')}</strong>
            <small>{props.t('settings.defaultPolishModeHint')}</small>
          </div>
          <div className="settingsControlSlim">
            <StudioSelect
              value={promptPolishDefaultMode.id}
              onChange={(value) => updatePromptHistory({ defaultPolishMode: value })}
              options={translatedPromptPolishModeOptions}
            />
          </div>
        </div>

        <p className="settingsNotice compact">{props.t('settings.promptHistoryNotice')}</p>
      </article>

      <div className="settingsSectionLabel">{props.t('settings.promptTools')}</div>
      <article className="settingsGroupCard promptToolsGroup">
        <div className="promptToolsHero">
          <div>
            <strong>{props.t('settings.promptToolsTitle')}</strong>
            <small>{props.t('settings.promptToolsHint')}</small>
          </div>
          <div className="promptToolBadges" aria-label={props.t('settings.promptToolsCredentialsAria')}>
            <span>prompt-polish:default</span>
            <span>image-reverse:default</span>
          </div>
        </div>

        <section className="promptToolCard" aria-labelledby="prompt-polish-tool-title">
          <div className="promptToolCardHeader">
            <div>
              <strong id="prompt-polish-tool-title">{props.t('settings.promptPolishTitle')}</strong>
              <small>{props.t('settings.promptPolishHint')}</small>
            </div>
            <span>{props.t('settings.promptPolishChannel')}</span>
          </div>

        <div className="settingsListRow settingsTallRow">
          <div className="settingsRowMain">
            <strong>{props.t('settings.promptPolishEngine')}</strong>
            <small>{props.t('settings.promptPolishEngineHint')}</small>
          </div>
          <div className="settingsInlineGrid promptPolishEngineControls">
            <button
              className={promptPolish.fallbackToLocal ? 'settingsTogglePill active' : 'settingsTogglePill'}
              onClick={() => updatePromptPolish({ fallbackToLocal: !promptPolish.fallbackToLocal }, { commit: true })}
            >
              {props.t('settings.promptPolishFallback')}
            </button>
            <StudioSelect
              value={promptPolish.engine}
              onChange={(value) => updatePromptPolish({ engine: value as PromptPolishSettings['engine'] }, { commit: true })}
              options={translatedPromptPolishEngineOptions}
            />
          </div>
        </div>

        <div className="settingsConfigBlock">
          <div className="promptPolishConfigHeader">
            <div className="settingsRowMain promptPolishIntro">
              <strong>{props.t('settings.promptPolishProviderProfile')}</strong>
              <small>{props.t('settings.promptPolishProviderProfileHint')}</small>
            </div>
            <div className="promptPolishHeaderTools">
              <div className="settingsPresetRow">
                <button
                  type="button"
                  className={promptPolish.displayName === props.t('settings.promptPolishPreset.deepseek') ? 'active' : ''}
                  onClick={() => updatePromptPolish({
                    displayName: props.t('settings.promptPolishPreset.deepseek'),
                    baseUrl: 'https://api.deepseek.com',
                    modelId: '',
                    modelOptions: [],
                    protocol: 'chat-completions'
                  })}
                >
                  DeepSeek
                </button>
                <button
                  type="button"
                  className={promptPolish.displayName === props.t('settings.promptPolishPreset.aggregatorText') ? 'active' : ''}
                  onClick={() => updatePromptPolish({
                    displayName: props.t('settings.promptPolishPreset.aggregatorText'),
                    baseUrl: '',
                    modelId: '',
                    modelOptions: [],
                    protocol: 'chat-completions'
                  })}
                >
                  {props.t('settings.presetAggregator')}
                </button>
                <button
                  type="button"
                  className={promptPolish.displayName === props.t('settings.promptPolishPreset.openaiText') ? 'active' : ''}
                  onClick={() => updatePromptPolish({
                    displayName: props.t('settings.promptPolishPreset.openaiText'),
                    baseUrl: OFFICIAL_OPENAI_BASE_URL,
                    modelId: '',
                    modelOptions: [],
                    protocol: 'chat-completions'
                  })}
                >
                  OpenAI {props.t('settings.official')}
                </button>
              </div>
              <div className="settingsStatusPills compact">
                <span className={promptPolish.baseUrl.trim() ? 'ready' : ''}>Base URL</span>
                <span className={promptPolish.modelId.trim() ? 'ready' : ''}>{props.t('settings.modelId')}</span>
                <span className={props.promptPolishSecretAvailable ? 'ready' : ''}>API Key</span>
              </div>
            </div>
          </div>
          <div className="settingsConfigGrid">
            <label>
              {props.t('settings.configName')}
              <input
                value={promptPolish.displayName}
                placeholder={props.t('settings.promptPolishConfigPlaceholder')}
                onChange={(event) => updatePromptPolish({ displayName: event.target.value })}
              />
            </label>
            <label>
              Base URL
              <input
                value={promptPolish.baseUrl}
                placeholder={props.t('settings.exampleBaseUrl')}
                onChange={(event) => updatePromptPolish({ baseUrl: event.target.value })}
              />
            </label>
            <label>
              {props.t('settings.modelSelectManual')}
              <div className="settingsModelSelectRow">
                <input
                  value={promptPolish.modelId}
                  list="prompt-polish-model-options"
                  placeholder={promptPolish.modelOptions.length > 0 ? props.t('settings.promptPolishModelPlaceholderWithOptions') : props.t('settings.promptPolishModelPlaceholderEmpty')}
                  onChange={(event) => updatePromptPolish({ modelId: event.target.value })}
                />
                <datalist id="prompt-polish-model-options">
                  {promptPolish.modelOptions.map((modelId) => <option key={modelId} value={modelId} />)}
                </datalist>
                <button type="button" onClick={props.onRefreshPromptPolishModels} disabled={props.isRefreshingPromptPolishModels}>
                  {props.isRefreshingPromptPolishModels ? props.t('settings.refreshing') : props.t('settings.refresh')}
                </button>
              </div>
              <small>{props.t('settings.refreshModelsHint')}</small>
            </label>
            <label>
              API Key
              <div className="settingsSecretInputRow">
                <input
                  type="password"
                  value={props.promptPolishSecretDraft}
                  placeholder={props.promptPolishSecretAvailable ? props.t('settings.secretSavedReplace') : props.t('settings.promptPolishSecretPlaceholder')}
                  onChange={(event) => props.onPromptPolishSecretDraftChange(event.target.value)}
                />
                <button type="button" onClick={props.onSavePromptPolishSecret} disabled={props.isSavingPromptPolishSecret}>
                  {props.isSavingPromptPolishSecret ? props.t('settings.saving') : props.t('settings.save')}
                </button>
              </div>
              <small>{props.promptPolishSecretAvailable ? props.t('settings.promptPolishSecretReady') : props.t('settings.promptPolishSecretMissing')}</small>
            </label>
            <details className="settingsAdvancedBox settingsWideField">
              <summary>
                <span>{props.t('settings.advancedHeaders')}</span>
                <small>{props.t('settings.keepDefaultObject')}</small>
              </summary>
              <p>{props.t('settings.promptPolishHeadersHint')} <code>{'{"X-Provider":"visionhub"}'}</code></p>
              <textarea
                rows={3}
                value={promptPolish.extraHeadersJson}
                placeholder='{"X-Provider": "visionhub"}'
                onChange={(event) => updatePromptPolish({ extraHeadersJson: event.target.value })}
              />
            </details>
            <div className="settingsConfigActions settingsWideField">
              <button type="button" className="rowActionButton" onClick={props.onSavePromptPolishConfig}>
                <ShieldCheck size={14} /> {props.t('settings.savePolishConfig')}
              </button>
              <small>{props.t('settings.saveConfigNoKeyHint')}</small>
            </div>
            <div className="promptPolishConfigInstances settingsWideField">
              <strong>{props.t('settings.savedConfigInstances')}</strong>
              {promptPolish.savedConfigs.length === 0 ? (
                <p>{props.t('settings.savedConfigInstancesEmpty')}</p>
              ) : (
                <div>
                  {promptPolish.savedConfigs.map((config) => (
                    <article key={config.id} className={config.id === promptPolishConfigId(promptPolish.displayName, promptPolish.baseUrl) ? 'active' : ''}>
                      <button
                        type="button"
                        onClick={() => updatePromptPolish({
                          displayName: config.displayName,
                          baseUrl: config.baseUrl,
                          modelId: config.modelId,
                          modelOptions: config.modelOptions,
                          extraHeadersJson: config.extraHeadersJson,
                          protocol: config.protocol
                        })}
                      >
                        <span>{config.displayName}</span>
                        <small>{config.modelId || props.t('settings.unsetModel')} · {config.baseUrl || props.t('settings.unsetBaseUrl')}</small>
                      </button>
                      <button type="button" className="promptPolishConfigDelete" data-tooltip={props.t('settings.deleteConfigInstance')} aria-label={props.t('settings.deleteConfigInstanceNamed', { name: config.displayName })} onClick={() => deletePromptPolishConfig(config.id)}>
                        <Trash2 size={13} />
                      </button>
                    </article>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="settingsListRow settingsTallRow">
          <div className="settingsRowMain">
            <strong>{props.t('settings.languageStrengthProtocol')}</strong>
            <small>{props.t('settings.languageStrengthProtocolHint')}</small>
          </div>
          <div className="settingsInlineGrid triple">
            <StudioSelect
              value={promptPolish.language}
              onChange={(value) => updatePromptPolish({ language: value as PromptPolishSettings['language'] })}
              options={translatedPromptPolishLanguageOptions}
            />
            <StudioSelect
              value={promptPolish.strength}
              onChange={(value) => updatePromptPolish({ strength: value as PromptPolishSettings['strength'] })}
              options={translatedPromptPolishStrengthOptions}
            />
            <StudioSelect
              value={promptPolish.protocol}
              onChange={(value) => updatePromptPolish({ protocol: value as PromptPolishSettings['protocol'] })}
              options={translatedPromptPolishProtocolOptions}
            />
          </div>
        </div>

        <p className="settingsNotice">{props.t('settings.promptPolishNotice')}</p>
        </section>

        <section className="promptToolCard" aria-labelledby="image-reverse-tool-title">
          <div className="promptToolCardHeader">
            <div>
              <strong id="image-reverse-tool-title">{props.t('settings.imageReverseTitle')}</strong>
              <small>{props.t('settings.imageReverseHint')}</small>
            </div>
            <span>{props.t('settings.imageReverseChannel')}</span>
          </div>

        <div className="settingsConfigBlock imageReverseConfigBlock">
          <div className="promptPolishConfigHeader">
            <div className="settingsRowMain promptPolishIntro">
              <strong>{props.t('settings.imageReverseProviderProfile')}</strong>
              <small>{props.t('settings.imageReverseProviderProfileHint')}</small>
            </div>
            <div className="promptPolishHeaderTools">
              <div className="settingsPresetRow">
                <button type="button" className={imageReverse.displayName === '\u805a\u5408\u7ad9\u56fe\u7247\u53cd\u63a8' ? 'active' : ''} onClick={() => updateImageReverse({ displayName: '\u805a\u5408\u7ad9\u56fe\u7247\u53cd\u63a8', baseUrl: '', modelId: '', modelOptions: [], protocol: 'chat-completions' })}>{props.t('settings.presetAggregator')}</button>
                <button type="button" className={imageReverse.displayName === 'OpenAI \u5b98\u65b9\u56fe\u7247\u53cd\u63a8' ? 'active' : ''} onClick={() => updateImageReverse({ displayName: 'OpenAI \u5b98\u65b9\u56fe\u7247\u53cd\u63a8', baseUrl: OFFICIAL_OPENAI_BASE_URL, modelId: '', modelOptions: [], protocol: 'responses' })}>OpenAI {props.t('settings.official')}</button>
                <button type="button" className={imageReverse.displayName === 'Gemini \u56fe\u7247\u53cd\u63a8' ? 'active' : ''} onClick={() => updateImageReverse({ displayName: 'Gemini \u56fe\u7247\u53cd\u63a8', baseUrl: 'https://generativelanguage.googleapis.com', modelId: '', modelOptions: [], protocol: 'gemini-generate-content' })}>Gemini</button>
              </div>
              <div className="settingsStatusPills compact">
                <span className={imageReverse.baseUrl.trim() ? 'ready' : ''}>Base URL</span>
                <span className={imageReverse.modelId.trim() ? 'ready' : ''}>{props.t('settings.modelId')}</span>
                <span className={props.imageReverseSecretAvailable ? 'ready' : ''}>API Key</span>
              </div>
            </div>
          </div>
          <div className="settingsConfigGrid">
            <label>
              {props.t('settings.configName')}
              <input value={imageReverse.displayName} placeholder={props.t('settings.imageReverseConfigPlaceholder')} onChange={(event) => updateImageReverse({ displayName: event.target.value })} />
            </label>
            <label>
              Base URL
              <input value={imageReverse.baseUrl} placeholder={props.t('settings.exampleBaseUrl')} onChange={(event) => updateImageReverse({ baseUrl: event.target.value })} />
            </label>
            <label>
              {props.t('settings.modelSelectManual')}
              <div className="settingsModelSelectRow">
                <input value={imageReverse.modelId} list="image-reverse-model-options" placeholder={imageReverse.modelOptions.length > 0 ? props.t('settings.imageReverseModelPlaceholderWithOptions') : props.t('settings.imageReverseModelPlaceholderEmpty')} onChange={(event) => updateImageReverse({ modelId: event.target.value })} />
                <datalist id="image-reverse-model-options">
                  {imageReverse.modelOptions.map((modelId) => <option key={modelId} value={modelId} />)}
                </datalist>
                <button type="button" onClick={props.onRefreshImageReverseModels} disabled={props.isRefreshingImageReverseModels}>{props.isRefreshingImageReverseModels ? props.t('settings.refreshing') : props.t('settings.refresh')}</button>
              </div>
              <small>{props.t('settings.imageReverseModelHint')}</small>
            </label>
            <label>
              API Key
              <div className="settingsSecretInputRow">
                <input type="password" value={props.imageReverseSecretDraft} placeholder={props.imageReverseSecretAvailable ? props.t('settings.secretSavedReplace') : props.t('settings.imageReverseSecretPlaceholder')} onChange={(event) => props.onImageReverseSecretDraftChange(event.target.value)} />
                <button type="button" onClick={props.onSaveImageReverseSecret} disabled={props.isSavingImageReverseSecret}>{props.isSavingImageReverseSecret ? props.t('settings.saving') : props.t('settings.save')}</button>
              </div>
              <small>{props.imageReverseSecretAvailable ? props.t('settings.imageReverseSecretReady') : props.t('settings.imageReverseSecretMissing')}</small>
            </label>
            <div className="settingsListRow settingsTallRow settingsWideField embeddedSettingsRow">
              <div className="settingsRowMain">
                <strong>{props.t('settings.imageReverseProtocolLanguageDetail')}</strong>
                <small>{props.t('settings.imageReverseProtocolLanguageDetailHint')}</small>
              </div>
              <div className="settingsInlineGrid triple">
                <StudioSelect value={imageReverse.protocol} onChange={(value) => updateImageReverse({ protocol: value as ImagePromptReverseSettings['protocol'] })} options={translatedImageReverseProtocolOptions} />
                <StudioSelect value={imageReverse.detail} onChange={(value) => updateImageReverse({ detail: value as ImagePromptReverseSettings['detail'] })} options={translatedImageReverseDetailOptions} />
                <StudioSelect value={imageReverse.language} onChange={(value) => updateImageReverse({ language: value as ImagePromptReverseSettings['language'] })} options={translatedImageReverseLanguageOptions} />
              </div>
            </div>
            <details className="settingsAdvancedBox settingsWideField">
              <summary><span>{props.t('settings.advancedHeaders')}</span><small>{props.t('settings.keepDefaultObject')}</small></summary>
              <p>{props.t('settings.imageReverseHeadersHint')}</p>
              <textarea rows={3} value={imageReverse.extraHeadersJson} placeholder='{"X-Provider": "visionhub"}' onChange={(event) => updateImageReverse({ extraHeadersJson: event.target.value })} />
            </details>
            <div className="settingsConfigActions settingsWideField">
              <button type="button" className="rowActionButton" onClick={props.onSaveImageReverseConfig}><ShieldCheck size={14} /> {props.t('settings.saveImageReverseConfig')}</button>
              <small>{props.t('settings.saveConfigNoKeyHint')}</small>
            </div>
          </div>
        </div>

        <p className="settingsNotice">{props.t('settings.imageReverseNotice')}</p>
        </section>
      </article>

      <div className="settingsSectionLabel">{props.t('settings.savePreferences')}</div>
      <article className="settingsGroupCard">
        <div className="settingsListRow">
          <div className="settingsRowMain">
            <strong>{props.t('settings.fileNamingRule')}</strong>
            <small>{props.t('settings.fileNamingRuleHint')}</small>
          </div>
          <div className="settingsControlSlim">
            <StudioSelect
              value={savePreferences.fileNamingRule}
              onChange={(value) => updateSavePreferences({ fileNamingRule: value as AppSettings['savePreferences']['fileNamingRule'] })}
              options={translatedFileNamingRuleOptions}
            />
          </div>
        </div>
        <div className="settingsListRow settingsTallRow">
          <div className="settingsRowMain">
            <strong>{props.t('settings.groupingPolicy')}</strong>
            <small>{props.t('settings.groupingPolicyHint')}</small>
          </div>
          <div className="settingsBooleanGrid compactTwo">
            <button className={savePreferences.groupByDate ? 'active' : ''} onClick={() => updateSavePreferences({ groupByDate: !savePreferences.groupByDate })}>{props.t('settings.groupByDate')}</button>
            <button className={savePreferences.groupByProject ? 'active' : ''} onClick={() => updateSavePreferences({ groupByProject: !savePreferences.groupByProject })}>{props.t('settings.groupByProject')}</button>
          </div>
        </div>
      </article>

      <div className="settingsSectionLabel">{props.t('settings.dataCache')}</div>
      <article className="settingsGroupCard">
        <div className="settingsListRow">
          <div className="settingsRowMain">
            <strong>{props.t('settings.refreshRate')}</strong>
            <small>{props.t('settings.refreshRateHint')}</small>
          </div>
          <div className="segmentedControl compactSegment">
            {REFRESH_INTERVAL_OPTIONS.map((option) => (
              <button
                key={option.value}
                className={settings.refreshIntervalSeconds === option.value ? 'active' : ''}
                onClick={() => props.onSettingsChange({ refreshIntervalSeconds: option.value })}
              >
                {translatedRefreshIntervalOptions.find((item) => item.value === option.value)?.label ?? option.label}
              </button>
            ))}
          </div>
        </div>

        <div className="settingsListRow">
          <div className="settingsRowMain">
            <strong>{props.t('settings.libraryDirectory')}</strong>
            <small>
              {props.storageSettings
                ? props.t('settings.currentPath', { path: props.storageSettings.resolved_library_dir })
                : props.desktopRuntime
                  ? props.t('settings.loadingLibraryPath')
                  : props.t('settings.desktopCustomLibraryPath')}
            </small>
            {props.storageSettings ? (
              <small className="settingsPathMeta">
                {props.t('settings.defaultPath', { path: props.storageSettings.default_library_dir })}
              </small>
            ) : null}
          </div>
          <div className="settingsPathActions">
            <button className="rowActionButton" disabled={!props.desktopRuntime} onClick={props.onSelectLibraryPath}>
              <FolderOpen size={15} /> {props.t('settings.selectPath')}
            </button>
            <button className="rowActionButton" disabled={!props.desktopRuntime} onClick={props.onOpenLibraryDirectory}>
              <HardDrive size={15} /> {props.t('settings.open')}
            </button>
            <button className="rowActionButton subtle" disabled={!props.desktopRuntime} onClick={props.onResetLibraryPath}>
              <RefreshCcw size={15} /> {props.t('settings.defaultDirectory')}
            </button>
          </div>
        </div>

        <div className="settingsListRow settingsTallRow">
          <div className="settingsRowMain">
            <strong>{props.t('settings.inspirationDirectory')}</strong>
            <small>
              {props.storageSettings
                ? props.t('settings.currentPath', { path: props.storageSettings.resolved_inspiration_dir })
                : props.desktopRuntime
                  ? props.t('settings.loadingInspirationPath')
                  : props.t('settings.desktopCustomInspirationPath')}
            </small>
            {props.storageSettings ? (
              <small className="settingsPathMeta">
                {props.t('settings.defaultPath', { path: props.storageSettings.default_inspiration_dir })}
              </small>
            ) : null}
          </div>
          <div className="settingsPathActions">
            <button className="rowActionButton" disabled={!props.desktopRuntime} onClick={props.onSelectInspirationPath}>
              <FolderOpen size={15} /> {props.t('settings.selectPath')}
            </button>
            <button className="rowActionButton" disabled={!props.desktopRuntime} onClick={props.onOpenInspirationDirectory}>
              <HardDrive size={15} /> {props.t('settings.open')}
            </button>
            <button className="rowActionButton subtle" disabled={!props.desktopRuntime} onClick={props.onResetInspirationPath}>
              <RefreshCcw size={15} /> {props.t('settings.defaultDirectory')}
            </button>
          </div>
        </div>

        <div className="settingsListRow">
          <div className="settingsRowMain">
            <strong>{props.t('settings.appDataDirectory')}</strong>
            <small>{props.t('settings.appDataDirectoryHint')}</small>
          </div>
          <div className="settingsPathActions">
            <button className="rowActionButton" disabled={!props.desktopRuntime} onClick={props.onOpenAppDataDirectory}>
              <FolderOpen size={15} /> {props.t('settings.openDataDirectory')}
            </button>
            <button className="rowActionButton" disabled={!props.desktopRuntime} onClick={props.onOpenBackupsDirectory}>
              <HardDrive size={15} /> {props.t('settings.openBackupsDirectory')}
            </button>
          </div>
        </div>

        <div className="settingsListRow">
          <div className="settingsRowMain">
            <strong>{props.t('settings.backupMigration')}</strong>
            <small>{props.t('settings.backupMigrationHint')}</small>
          </div>
          <div className="settingsPathActions">
            <button className="rowActionButton" disabled={!props.desktopRuntime} onClick={props.onExportSettingsBackup}>
              <Download size={15} /> {props.t('settings.exportSettings')}
            </button>
            <button className="rowActionButton" disabled={!props.desktopRuntime} onClick={props.onExportMigrationGuide}>
              <ClipboardPaste size={15} /> {props.t('settings.exportMigrationGuide')}
            </button>
          </div>
        </div>
      </article>

      <div className="settingsSectionLabel">{props.t('settings.softwareUpdate')}</div>
      <article className="settingsGroupCard">
        <div className="settingsListRow versionSettingsRow">
          <div className="settingsRowMain">
            <strong>{props.t('settings.version')}</strong>
          </div>
          <span className="settingsValue">{props.appVersion}</span>
        </div>
        <div className="settingsListRow">
          <div className="settingsRowMain">
            <strong>{props.t('settings.softwareUpdate')}</strong>
            <small>{props.t('settings.softwareUpdateHint')}</small>
          </div>
          <button className="rowActionButton" type="button" onClick={props.onOpenReleasePage}>
            <ExternalLink size={15} /> {props.t('settings.viewReleases')}
          </button>
        </div>
      </article>
    </section>
  );
}
