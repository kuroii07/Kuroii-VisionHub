import type { ImageToImageAdapter } from '../domain/providerTypes';
import { readStorageValue, writeStorageValue } from './safeStorage';

export type OpenAICompatibleProtocol =
  | 'images'
  | 'images-minimal'
  | 'responses'
  | 'chat-completions'
  | 'custom-images';

export const IMAGE_TO_IMAGE_ADAPTERS: ImageToImageAdapter[] = [
  'auto',
  'openai-images-edit',
  'responses-input-image',
  'chat-image-url',
  'json-image-array'
];

export interface OpenAICompatibleConfig {
  displayName: string;
  baseUrl: string;
  modelId: string;
  protocol: OpenAICompatibleProtocol;
  imageToImageAdapter: ImageToImageAdapter;
  endpointPath: string;
  extraHeadersJson: string;
  modelOptions: string[];
}

export interface ProviderConfigPreset {
  id: string;
  label: string;
  description: string;
  config: OpenAICompatibleConfig;
}

const STORAGE_KEY = 'visionhub.provider.configs';

type ProviderConfigMap = Record<string, Partial<OpenAICompatibleConfig>>;

export const OFFICIAL_OPENAI_BASE_URL = 'https://api.openai.com';

export const defaultOpenAICompatibleConfig: OpenAICompatibleConfig = {
  displayName: '聚合站 / OpenAI 兼容',
  baseUrl: '',
  modelId: 'gpt-image-1',
  protocol: 'images',
  imageToImageAdapter: 'auto',
  endpointPath: '/v1/images/generations',
  extraHeadersJson: '{}',
  modelOptions: []
};

export const PROVIDER_CONFIG_PRESETS: ProviderConfigPreset[] = [
  {
    id: 'openai-images',
    label: 'OpenAI Images',
    description: 'OpenAI 官方 Images API，适合 gpt-image-1 / gpt-image-2 路线。',
    config: {
      ...defaultOpenAICompatibleConfig,
      displayName: 'OpenAI Images',
      baseUrl: OFFICIAL_OPENAI_BASE_URL,
      modelId: 'gpt-image-1',
      protocol: 'images',
      imageToImageAdapter: 'openai-images-edit',
      endpointPath: '/v1/images/generations'
    }
  },
  {
    id: 'openai-responses',
    label: 'OpenAI Responses',
    description: 'OpenAI Responses API，适合通过 Responses 协议包装图片生成。',
    config: {
      ...defaultOpenAICompatibleConfig,
      displayName: 'OpenAI Responses',
      baseUrl: OFFICIAL_OPENAI_BASE_URL,
      modelId: 'gpt-image-1',
      protocol: 'responses',
      imageToImageAdapter: 'responses-input-image',
      endpointPath: '/v1/responses'
    }
  },
  {
    id: 'relay-images',
    label: '聚合站 / 中转站',
    description: 'OpenAI-compatible 聚合站；替换 Base URL、模型 ID 后即可保存使用。',
    config: {
      ...defaultOpenAICompatibleConfig,
      displayName: '聚合站中转',
      baseUrl: 'https://your-relay.example.com',
      modelId: 'gpt-image-1',
      protocol: 'images',
      imageToImageAdapter: 'auto',
      endpointPath: '/v1/images/generations'
    }
  },
  {
    id: 'custom-images',
    label: '自定义图片路径',
    description: '保留自定义 endpointPath，适合非标准图片接口。',
    config: {
      ...defaultOpenAICompatibleConfig,
      displayName: 'Custom Images Provider',
      baseUrl: 'https://your-provider.example.com',
      modelId: 'image-model-id',
      protocol: 'custom-images',
      imageToImageAdapter: 'json-image-array',
      endpointPath: '/v1/images/generations'
    }
  }
];

export function defaultEndpointForProtocol(protocol: OpenAICompatibleProtocol) {
  switch (protocol) {
    case 'responses':
      return '/v1/responses';
    case 'chat-completions':
      return '/v1/chat/completions';
    case 'images-minimal':
    case 'custom-images':
    case 'images':
    default:
      return '/v1/images/generations';
  }
}

function normalizeEndpointPath(endpointPath: unknown, protocol: OpenAICompatibleProtocol) {
  const trimmed = String(endpointPath || defaultEndpointForProtocol(protocol)).trim();
  if (!trimmed || trimmed.startsWith('/') || /^https?:\/\//i.test(trimmed)) return trimmed;
  return `/${trimmed}`;
}

export function normalizeImageToImageAdapter(value: unknown): ImageToImageAdapter {
  return IMAGE_TO_IMAGE_ADAPTERS.includes(value as ImageToImageAdapter)
    ? (value as ImageToImageAdapter)
    : defaultOpenAICompatibleConfig.imageToImageAdapter;
}

export function isOfficialOpenAIBaseUrl(baseUrl: string) {
  const trimmed = baseUrl.trim();
  if (!trimmed) return false;
  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === 'https:' && parsed.hostname === 'api.openai.com';
  } catch {
    return false;
  }
}

export function loadProviderConfig(providerId: string): OpenAICompatibleConfig {
  const raw = readStorageValue(STORAGE_KEY);
  let map: ProviderConfigMap = {};

  if (raw) {
    try {
      map = JSON.parse(raw) as ProviderConfigMap;
    } catch (error) {
      console.warn('[VisionHub] provider config parse failed; using defaults', error);
    }
  }

  return {
    ...defaultOpenAICompatibleConfig,
    ...(map[providerId] ?? {})
  };
}

export function saveProviderConfig(providerId: string, config: OpenAICompatibleConfig) {
  const raw = readStorageValue(STORAGE_KEY);
  let map: ProviderConfigMap = {};

  if (raw) {
    try {
      map = JSON.parse(raw) as ProviderConfigMap;
    } catch (error) {
      console.warn('[VisionHub] provider config parse failed before save; resetting map', error);
    }
  }

  map[providerId] = config;
  writeStorageValue(STORAGE_KEY, JSON.stringify(map));
}

export function normalizeProviderConfig(config: Partial<OpenAICompatibleConfig>): OpenAICompatibleConfig {
  const merged = {
    ...defaultOpenAICompatibleConfig,
    ...config
  };

  return {
    ...merged,
    displayName: String(merged.displayName || defaultOpenAICompatibleConfig.displayName),
    baseUrl: String(merged.baseUrl || defaultOpenAICompatibleConfig.baseUrl).trim(),
    modelId: String(merged.modelId || defaultOpenAICompatibleConfig.modelId).trim(),
    protocol: merged.protocol,
    imageToImageAdapter: normalizeImageToImageAdapter(merged.imageToImageAdapter),
    endpointPath: normalizeEndpointPath(merged.endpointPath, merged.protocol),
    extraHeadersJson: String(merged.extraHeadersJson || '{}'),
    modelOptions: Array.isArray(merged.modelOptions) ? merged.modelOptions.map(String) : []
  };
}

export function applyProviderConfigPreset(
  current: OpenAICompatibleConfig,
  presetId: string
): OpenAICompatibleConfig {
  const preset = PROVIDER_CONFIG_PRESETS.find((item) => item.id === presetId);
  if (!preset) return current;
  return normalizeProviderConfig({
    ...preset.config,
    extraHeadersJson: current.extraHeadersJson,
    modelOptions: preset.config.modelId ? [preset.config.modelId] : current.modelOptions
  });
}

export function exportProviderConfigMap(): ProviderConfigMap {
  const raw = readStorageValue(STORAGE_KEY);
  if (!raw) return {};

  try {
    return JSON.parse(raw) as ProviderConfigMap;
  } catch (error) {
    console.warn('[VisionHub] provider config export failed; using empty map', error);
    return {};
  }
}

export function serializeProviderConfig(config: OpenAICompatibleConfig) {
  const exportable = normalizeProviderConfig(config);
  return JSON.stringify(
    {
      displayName: exportable.displayName,
      baseUrl: exportable.baseUrl,
      modelId: exportable.modelId,
      protocol: exportable.protocol,
      imageToImageAdapter: exportable.imageToImageAdapter,
      endpointPath: exportable.endpointPath,
      extraHeadersJson: exportable.extraHeadersJson,
      modelOptions: exportable.modelOptions
    },
    null,
    2
  );
}

export function parseProviderConfigImport(jsonText: string): OpenAICompatibleConfig {
  const parsed = JSON.parse(jsonText) as unknown;
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('平台配置必须是 JSON 对象。');
  }

  const config = normalizeProviderConfig(parsed as Partial<OpenAICompatibleConfig>);
  // Validate fields that can fail at runtime.
  new URL(config.baseUrl);
  parseExtraHeaders(config.extraHeadersJson);
  if (!config.modelId) throw new Error('平台配置缺少 modelId。');
  if (!config.endpointPath.startsWith('/')) throw new Error('接口路径必须以 / 开头。');
  return config;
}

export function parseExtraHeaders(jsonText: string): Record<string, string> {
  const trimmed = jsonText.trim();
  if (!trimmed) return {};
  const parsed = JSON.parse(trimmed) as unknown;
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('额外 Headers 必须是 JSON 对象，例如 {"X-Trace":"visionhub"}');
  }

  return Object.fromEntries(
    Object.entries(parsed as Record<string, unknown>).map(([key, value]) => [key, String(value)])
  );
}
