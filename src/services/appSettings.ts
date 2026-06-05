import { readStorageValue, writeStorageValue } from './safeStorage';

export type AppPage = 'generate' | 'free' | 'library' | 'inspiration' | 'templates' | 'providers' | 'settings';
export type ThemeMode = 'dark' | 'light' | 'system';
export type DefaultGenerationMode = 'text' | 'image';
export type OutputFormat = 'PNG' | 'JPEG' | 'WebP';
export type ReviewMode = 'auto' | 'strict' | 'relaxed';
export type PromptPolishEngine = 'local' | 'provider';
export type PromptPolishLanguage = 'zh' | 'en' | 'bilingual';
export type PromptPolishProtocol = 'chat-completions' | 'responses';
export type PromptPolishStrength = 'concise' | 'detailed' | 'professional' | 'cinematic' | 'commercial';

export interface ColorOption {
  value: string;
  label: string;
  companionAccent?: string;
}

export interface GenerationDefaults {
  defaultMode: DefaultGenerationMode;
  defaultProviderId: string;
  defaultModelId: string;
  defaultSize: string;
  defaultCount: number;
  defaultQuality: string;
  outputFormat: OutputFormat;
  reviewMode: ReviewMode;
}

export interface PromptHistorySettings {
  enabled: boolean;
  maxItems: number;
  dedupe: boolean;
  includeFailed: boolean;
  showThumbnails: boolean;
  defaultPolishMode: string;
}

export interface PromptPolishSettings {
  engine: PromptPolishEngine;
  providerId: string;
  modelId: string;
  language: PromptPolishLanguage;
  strength: PromptPolishStrength;
  protocol: PromptPolishProtocol;
  fallbackToLocal: boolean;
}

export interface AppSettings {
  themeMode: ThemeMode;
  startupPage: AppPage;
  sidebarCollapsed: boolean;
  primaryAccent: string;
  generatorAccent: string;
  refreshIntervalSeconds: number;
  generationDefaults: GenerationDefaults;
  promptHistory: PromptHistorySettings;
  promptPolish: PromptPolishSettings;
}

export const PRIMARY_ACCENT_OPTIONS: ColorOption[] = [
  { value: '#2563eb', label: '蓝色', companionAccent: '#0ea5e9' },
  { value: '#16a34a', label: '绿色', companionAccent: '#10b981' },
  { value: '#ea580c', label: '橙色', companionAccent: '#f59e0b' },
  { value: '#7c3aed', label: '紫色', companionAccent: '#8b5cf6' },
  { value: '#475569', label: '灰蓝', companionAccent: '#64748b' }
];

export const GENERATOR_ACCENT_OPTIONS: ColorOption[] = [
  { value: '#0ea5e9', label: '天空蓝' },
  { value: '#10b981', label: '薄荷绿' },
  { value: '#f59e0b', label: '暖琥珀' },
  { value: '#8b5cf6', label: '柔紫色' },
  { value: '#64748b', label: '冷灰蓝' }
];

export function getRecommendedGlobalAccent(primaryAccent: string): string {
  return (
    PRIMARY_ACCENT_OPTIONS.find((option) => option.value === primaryAccent)?.companionAccent ??
    GENERATOR_ACCENT_OPTIONS[0].value
  );
}

const LEGACY_COLOR_MIGRATIONS: Record<string, string> = {
  '#3b82f6': '#2563eb',
  '#22c55e': '#16a34a',
  '#f97316': '#ea580c',
  '#64748b': '#475569',
  '#34d399': '#10b981',
  '#38bdf8': '#0ea5e9',
  '#facc15': '#f59e0b',
  '#fb7185': '#8b5cf6',
  '#a78bfa': '#8b5cf6'
};

export const REFRESH_INTERVAL_OPTIONS = [
  { value: 30, label: '30 秒' },
  { value: 60, label: '1 分钟' },
  { value: 180, label: '3 分钟' },
  { value: 300, label: '5 分钟' }
];

export const STARTUP_PAGE_OPTIONS: Array<{ value: AppPage; label: string }> = [
  { value: 'generate', label: 'AI 创作' },
  { value: 'free', label: '免费平台' },
  { value: 'library', label: '作品画廊' },
  { value: 'inspiration', label: '灵感中心' },
  { value: 'templates', label: '提示词库' },
  { value: 'providers', label: '平台接入' },
  { value: 'settings', label: '偏好设置' }
];

export const DEFAULT_SIZE_OPTIONS = [
  { value: '1024x1024', label: '1024×1024 正方形' },
  { value: '1280x720', label: '1280×720 横屏' },
  { value: '720x1280', label: '720×1280 竖屏' },
  { value: '1024x1536', label: '1024×1536 海报' },
  { value: '1536x1024', label: '1536×1024 横幅' }
];

export const DEFAULT_COUNT_OPTIONS = [
  { value: 1, label: '1 张' },
  { value: 2, label: '2 张' },
  { value: 3, label: '3 张' },
  { value: 4, label: '4 张' }
];

export const DEFAULT_QUALITY_OPTIONS = [
  { value: 'auto', label: '自动' },
  { value: 'low', label: '低' },
  { value: 'medium', label: '中' },
  { value: 'standard', label: '标准' },
  { value: 'high', label: '高' }
];

export const OUTPUT_FORMAT_OPTIONS: Array<{ value: OutputFormat; label: string }> = [
  { value: 'PNG', label: 'PNG' },
  { value: 'JPEG', label: 'JPEG' },
  { value: 'WebP', label: 'WebP' }
];

export const REVIEW_MODE_OPTIONS: Array<{ value: ReviewMode; label: string }> = [
  { value: 'auto', label: '自动' },
  { value: 'strict', label: '严格' },
  { value: 'relaxed', label: '宽松' }
];

export const PROMPT_HISTORY_LIMIT_OPTIONS = [
  { value: 50, label: '50 条' },
  { value: 100, label: '100 条' },
  { value: 300, label: '300 条' }
];

export const PROMPT_POLISH_ENGINE_OPTIONS: Array<{ value: PromptPolishEngine; label: string }> = [
  { value: 'local', label: '本地规则' },
  { value: 'provider', label: '模型润色' }
];

export const PROMPT_POLISH_LANGUAGE_OPTIONS: Array<{ value: PromptPolishLanguage; label: string }> = [
  { value: 'zh', label: '保持中文' },
  { value: 'en', label: '输出英文' },
  { value: 'bilingual', label: '中英双语' }
];

export const PROMPT_POLISH_STRENGTH_OPTIONS: Array<{ value: PromptPolishStrength; label: string }> = [
  { value: 'concise', label: '简洁增强' },
  { value: 'detailed', label: '细节扩写' },
  { value: 'professional', label: '专业生图提示词' },
  { value: 'cinematic', label: '电影感' },
  { value: 'commercial', label: '商业摄影' }
];

export const PROMPT_POLISH_PROTOCOL_OPTIONS: Array<{ value: PromptPolishProtocol; label: string }> = [
  { value: 'chat-completions', label: 'Chat Completions' },
  { value: 'responses', label: 'Responses' }
];

const STORAGE_KEY = 'visionhub.app.settings';
const LEGACY_THEME_KEY = 'visionhub.themeMode';

export const defaultAppSettings: AppSettings = {
  themeMode: 'dark',
  startupPage: 'generate',
  sidebarCollapsed: false,
  primaryAccent: PRIMARY_ACCENT_OPTIONS[0].value,
  generatorAccent: getRecommendedGlobalAccent(PRIMARY_ACCENT_OPTIONS[0].value),
  refreshIntervalSeconds: 60,
  generationDefaults: {
    defaultMode: 'text',
    defaultProviderId: 'openai-gpt-image',
    defaultModelId: 'gpt-image-1',
    defaultSize: '1024x1024',
    defaultCount: 1,
    defaultQuality: 'auto',
    outputFormat: 'JPEG',
    reviewMode: 'auto'
  },
  promptHistory: {
    enabled: true,
    maxItems: 100,
    dedupe: true,
    includeFailed: true,
    showThumbnails: true,
    defaultPolishMode: 'detail'
  },
  promptPolish: {
    engine: 'local',
    providerId: 'openai-gpt-image',
    modelId: 'gpt-4o-mini',
    language: 'zh',
    strength: 'professional',
    protocol: 'chat-completions',
    fallbackToLocal: true
  }
};

function isAppPage(value: unknown): value is AppPage {
  return STARTUP_PAGE_OPTIONS.some((option) => option.value === value);
}

function isThemeMode(value: unknown): value is ThemeMode {
  return value === 'dark' || value === 'light' || value === 'system';
}

function pickColor(value: unknown, options: ColorOption[], fallback: string) {
  if (typeof value !== 'string') return fallback;
  const migratedValue = LEGACY_COLOR_MIGRATIONS[value] ?? value;
  return options.some((option) => option.value === migratedValue) ? migratedValue : fallback;
}

function pickRefreshInterval(value: unknown) {
  return typeof value === 'number' && REFRESH_INTERVAL_OPTIONS.some((option) => option.value === value)
    ? value
    : defaultAppSettings.refreshIntervalSeconds;
}

function pickNumberOption(value: unknown, options: Array<{ value: number }>, fallback: number) {
  return typeof value === 'number' && options.some((option) => option.value === value) ? value : fallback;
}

function pickStringOption<T extends string>(value: unknown, options: Array<{ value: T }>, fallback: T): T {
  return typeof value === 'string' && options.some((option) => option.value === value) ? (value as T) : fallback;
}

function normalizeGenerationDefaults(value: Partial<GenerationDefaults> | null | undefined): GenerationDefaults {
  const fallback = defaultAppSettings.generationDefaults;
  const defaultMode: DefaultGenerationMode = value?.defaultMode === 'image' ? 'image' : 'text';
  const defaultProviderId = typeof value?.defaultProviderId === 'string' && value.defaultProviderId.trim()
    ? value.defaultProviderId
    : fallback.defaultProviderId;
  const defaultModelId = typeof value?.defaultModelId === 'string' && value.defaultModelId.trim()
    ? value.defaultModelId
    : fallback.defaultModelId;

  return {
    defaultMode,
    defaultProviderId,
    defaultModelId,
    defaultSize: pickStringOption(value?.defaultSize, DEFAULT_SIZE_OPTIONS, fallback.defaultSize),
    defaultCount: pickNumberOption(value?.defaultCount, DEFAULT_COUNT_OPTIONS, fallback.defaultCount),
    defaultQuality: pickStringOption(value?.defaultQuality, DEFAULT_QUALITY_OPTIONS, fallback.defaultQuality),
    outputFormat: pickStringOption<OutputFormat>(value?.outputFormat, OUTPUT_FORMAT_OPTIONS, fallback.outputFormat),
    reviewMode: pickStringOption<ReviewMode>(value?.reviewMode, REVIEW_MODE_OPTIONS, fallback.reviewMode)
  };
}

function normalizePromptHistory(value: Partial<PromptHistorySettings> | null | undefined): PromptHistorySettings {
  const fallback = defaultAppSettings.promptHistory;
  return {
    enabled: typeof value?.enabled === 'boolean' ? value.enabled : fallback.enabled,
    maxItems: pickNumberOption(value?.maxItems, PROMPT_HISTORY_LIMIT_OPTIONS, fallback.maxItems),
    dedupe: typeof value?.dedupe === 'boolean' ? value.dedupe : fallback.dedupe,
    includeFailed: typeof value?.includeFailed === 'boolean' ? value.includeFailed : fallback.includeFailed,
    showThumbnails: typeof value?.showThumbnails === 'boolean' ? value.showThumbnails : fallback.showThumbnails,
    defaultPolishMode: typeof value?.defaultPolishMode === 'string' && value.defaultPolishMode.trim()
      ? value.defaultPolishMode
      : fallback.defaultPolishMode
  };
}

function normalizePromptPolish(value: Partial<PromptPolishSettings> | null | undefined): PromptPolishSettings {
  const fallback = defaultAppSettings.promptPolish;
  return {
    engine: pickStringOption(value?.engine, PROMPT_POLISH_ENGINE_OPTIONS, fallback.engine),
    providerId: typeof value?.providerId === 'string' && value.providerId.trim()
      ? value.providerId
      : fallback.providerId,
    modelId: typeof value?.modelId === 'string' && value.modelId.trim()
      ? value.modelId.trim()
      : fallback.modelId,
    language: pickStringOption(value?.language, PROMPT_POLISH_LANGUAGE_OPTIONS, fallback.language),
    strength: pickStringOption(value?.strength, PROMPT_POLISH_STRENGTH_OPTIONS, fallback.strength),
    protocol: pickStringOption(value?.protocol, PROMPT_POLISH_PROTOCOL_OPTIONS, fallback.protocol),
    fallbackToLocal: typeof value?.fallbackToLocal === 'boolean' ? value.fallbackToLocal : fallback.fallbackToLocal
  };
}

export function normalizeAppSettings(value: Partial<AppSettings> | null | undefined): AppSettings {
  const legacyTheme = readStorageValue(LEGACY_THEME_KEY);

  return {
    themeMode: isThemeMode(value?.themeMode)
      ? value.themeMode
      : isThemeMode(legacyTheme)
        ? legacyTheme
        : defaultAppSettings.themeMode,
    startupPage: isAppPage(value?.startupPage) ? value.startupPage : defaultAppSettings.startupPage,
    sidebarCollapsed:
      typeof value?.sidebarCollapsed === 'boolean'
        ? value.sidebarCollapsed
        : defaultAppSettings.sidebarCollapsed,
    primaryAccent: pickColor(value?.primaryAccent, PRIMARY_ACCENT_OPTIONS, defaultAppSettings.primaryAccent),
    generatorAccent: pickColor(value?.generatorAccent, GENERATOR_ACCENT_OPTIONS, defaultAppSettings.generatorAccent),
    refreshIntervalSeconds: pickRefreshInterval(value?.refreshIntervalSeconds),
    generationDefaults: normalizeGenerationDefaults(value?.generationDefaults),
    promptHistory: normalizePromptHistory(value?.promptHistory),
    promptPolish: normalizePromptPolish(value?.promptPolish)
  };
}

export function loadAppSettings(): AppSettings {
  const raw = readStorageValue(STORAGE_KEY);
  if (!raw) return normalizeAppSettings(null);

  try {
    return normalizeAppSettings(JSON.parse(raw) as Partial<AppSettings>);
  } catch (error) {
    console.warn('[VisionHub] app settings parse failed; using defaults', error);
    return normalizeAppSettings(null);
  }
}

export function saveAppSettings(settings: AppSettings) {
  const normalized = normalizeAppSettings(settings);
  writeStorageValue(STORAGE_KEY, JSON.stringify(normalized));
  writeStorageValue(LEGACY_THEME_KEY, normalized.themeMode);
  return normalized;
}
