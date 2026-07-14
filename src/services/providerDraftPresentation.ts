import type { ProviderManifest } from '../domain/providerTypes';
import type { Translator } from '../i18n';
import {
  defaultEndpointForProtocol,
  defaultOpenAICompatibleConfig,
  OFFICIAL_OPENAI_BASE_URL,
  type OpenAICompatibleConfig
} from './providerConfig';
import {
  getDefaultProviderServiceTemplateForProvider,
  type ProviderServiceTemplate
} from './providerServiceCatalog';

export function providerServiceTemplateDisplayName(
  template: ProviderServiceTemplate,
  t?: Translator
) {
  return t
    ? t(`provider.service.${template.id}.label` as Parameters<Translator>[0])
    : template.defaultDisplayName ?? template.label;
}

export function createEmptyProviderDraftConfig(
  provider: ProviderManifest,
  serviceTemplate?: ProviderServiceTemplate,
  t?: Translator
): OpenAICompatibleConfig {
  const isOfficialOpenAI = provider.id === 'openai-gpt-image';
  const isMiniMax = provider.id === 'minimax-image';
  const isGemini = provider.id === 'gemini-image';
  const firstModel = provider.models[0]?.id ?? '';
  return {
    ...defaultOpenAICompatibleConfig,
    displayName: serviceTemplate ? providerServiceTemplateDisplayName(serviceTemplate, t) : '',
    baseUrl: isOfficialOpenAI
      ? OFFICIAL_OPENAI_BASE_URL
      : isMiniMax
        ? 'https://api.minimaxi.com'
        : isGemini
          ? 'https://generativelanguage.googleapis.com'
          : '',
    modelId: firstModel,
    protocol: isMiniMax ? 'custom-images' : 'images',
    endpointPath: isMiniMax
      ? '/v1/image_generation'
      : isGemini
        ? '/v1beta/models/{model}:generateContent'
        : defaultEndpointForProtocol('images'),
    extraHeadersJson: '{}',
    modelOptions: provider.models.map((model) => model.id)
  };
}

export function providerGenerationLabel(provider: ProviderManifest, t: Translator) {
  const template = getDefaultProviderServiceTemplateForProvider(provider.id);
  if (!template) return provider.name;
  const platformLabel = t(`provider.platform.${template.platformType}.label` as Parameters<Translator>[0]);
  const serviceLabel = t(`provider.service.${template.id}.label` as Parameters<Translator>[0]);
  return `${platformLabel} · ${serviceLabel}`;
}
