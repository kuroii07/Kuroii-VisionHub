import type { OpenAICompatibleConfig } from './providerConfig';
import type { ProviderConnectionProfile } from './providerProfiles';

export function safeProviderConfigText(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

export function isProviderConnectionProfileLike(
  value: unknown
): value is ProviderConnectionProfile {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const candidate = value as Partial<ProviderConnectionProfile>;
  return typeof candidate.id === 'string' && typeof candidate.providerId === 'string';
}

export function ensureManualModelOption(
  config: OpenAICompatibleConfig
): OpenAICompatibleConfig {
  const modelId = config.modelId.trim();
  if (!modelId || config.modelOptions.includes(modelId)) return config;
  return {
    ...config,
    modelOptions: [modelId, ...config.modelOptions]
  };
}
