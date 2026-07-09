import type { ImageToImageAdapter } from '../domain/providerTypes';
import type { Translator } from '../i18n';
import { defaultEndpointForProtocol, OFFICIAL_OPENAI_BASE_URL, type OpenAICompatibleConfig } from './providerConfig';

type ProviderServiceTemplateLike = {
  status?: 'connected' | 'configurable' | 'planned' | 'local-plan';
  supportsImageToImage?: boolean;
};

export function isMiniMaxProvider(providerId: string) {
  return providerId === 'minimax-image';
}

export function isGeminiProvider(providerId: string) {
  return providerId === 'gemini-image';
}

export function providerUsesConfig(providerId: string) {
  return providerId === 'openai-gpt-image' || providerId === 'custom-http-provider' || providerId === 'minimax-image' || providerId === 'gemini-image';
}

export function providerSupportsOpenAICompatibleModelList(providerId: string) {
  return providerId === 'openai-gpt-image' || providerId === 'custom-http-provider';
}

export function minimaxModelOptions() {
  return ['image-01', 'image-01-live'];
}

export function geminiModelOptions() {
  return ['gemini-2.5-flash-image'];
}

export function officialFixedModelOptions(providerId: string) {
  if (isMiniMaxProvider(providerId)) return minimaxModelOptions();
  if (isGeminiProvider(providerId)) return geminiModelOptions();
  return [];
}

export function buildMiniMaxManualModelProbe(modelId: string, source: string, t?: Translator) {
  const normalizedModelId = modelId.trim();
  const options = minimaxModelOptions();
  const available = Boolean(normalizedModelId) && options.includes(normalizedModelId);
  const fallbackModel = normalizedModelId || (t ? t('provider.diagnostics.value.notFilled') : 'not filled');
  return {
    modelId: normalizedModelId,
    available,
    checkedAt: new Date().toISOString(),
    message: available
      ? t
        ? t('provider.diagnostics.detail.minimaxModelProbeAvailable', { model: normalizedModelId, source })
        : `MiniMax official template includes model "${normalizedModelId}". ${source}`
      : t
        ? t('provider.diagnostics.detail.minimaxModelProbeMissing', { options: options.join(' / '), model: fallbackModel, source })
        : `MiniMax currently recommends ${options.join(' / ')}; "${fallbackModel}" is not built in. ${source}`
  };
}

export function buildGeminiManualModelProbe(modelId: string, source: string, t?: Translator) {
  const normalizedModelId = modelId.trim();
  const options = geminiModelOptions();
  const available = Boolean(normalizedModelId) && options.includes(normalizedModelId);
  const fallbackModel = normalizedModelId || (t ? t('provider.diagnostics.value.notFilled') : 'not filled');
  return {
    modelId: normalizedModelId,
    available,
    checkedAt: new Date().toISOString(),
    message: available
      ? t
        ? t('provider.diagnostics.detail.geminiModelProbeAvailable', { model: normalizedModelId, source })
        : `Gemini official template includes model "${normalizedModelId}". ${source}`
      : t
        ? t('provider.diagnostics.detail.geminiModelProbeMissing', { options: options.join(' / '), model: fallbackModel, source })
        : `Gemini currently recommends ${options.join(' / ')}; "${fallbackModel}" is not built in. ${source}`
  };
}

export function modelListUnsupportedMessage(providerId: string, modelId: string, t?: Translator) {
  if (isMiniMaxProvider(providerId)) {
    const source = t
      ? t('provider.diagnostics.detail.minimaxFixedModelListSource')
      : 'MiniMax official image API uses fixed model IDs and does not read OpenAI-compatible /v1/models.';
    const modelProbe = buildMiniMaxManualModelProbe(modelId, source, t);
    return modelProbe.message;
  }
  if (isGeminiProvider(providerId)) {
    const source = t
      ? t('provider.diagnostics.detail.geminiFixedModelListSource')
      : 'Gemini official image API uses fixed model IDs and does not read OpenAI-compatible /v1/models.';
    return buildGeminiManualModelProbe(modelId, source, t).message;
  }
  return t
    ? t('provider.diagnostics.detail.officialModelListUnsupported')
    : 'The current official API does not provide an OpenAI-compatible model list. Built-in template models and manual model IDs are kept for real test generation.';
}

export function defaultBaseUrlPlaceholder(providerId: string, t?: Translator) {
  if (providerId === 'openai-gpt-image') return OFFICIAL_OPENAI_BASE_URL;
  if (providerId === 'minimax-image') return 'https://api.minimaxi.com';
  if (providerId === 'gemini-image') return 'https://generativelanguage.googleapis.com';
  return t ? t('provider.placeholder.baseUrlRelay') : 'https://your-relay.example.com';
}

export function defaultEndpointPlaceholder(providerId: string, t?: Translator) {
  if (providerId === 'minimax-image') return '/v1/image_generation';
  if (providerId === 'gemini-image') return '/v1beta/models/{model}:generateContent';
  return t ? t('provider.placeholder.endpointPath') : '/v1/images/generations';
}

export function providerEndpointHint(providerId: string, t?: Translator) {
  if (providerId === 'minimax-image') {
    return t
      ? t('provider.endpointHint.minimax')
      : 'MiniMax official text-to-image uses /v1/image_generation by default. This is the official image API path, not OpenAI-compatible /v1/images/generations.';
  }
  if (providerId === 'gemini-image') {
    return t
      ? t('provider.endpointHint.gemini')
      : 'Gemini official image API uses /v1beta/models/{model}:generateContent. After saving, the backend replaces {model} with the current model ID.';
  }
  return t
    ? t('provider.endpointHint.default')
    : 'Follow relay docs, for example /images/generations, /v1/images/generations, or /v1/responses. Saved requests use this path.';
}

export function protocolLabel(protocol: OpenAICompatibleConfig['protocol'], t?: Translator) {
  if (t) return t(`provider.protocol.${protocol}.label` as Parameters<Translator>[0]);
  const labels: Record<OpenAICompatibleConfig['protocol'], string> = {
    images: 'Images',
    'images-minimal': 'Images minimal',
    responses: 'Responses',
    'chat-completions': 'Chat',
    'custom-images': 'Custom'
  };
  return labels[protocol];
}

export function imageToImageAdapterLabel(adapter: ImageToImageAdapter, t?: Translator) {
  if (t) return t(`provider.i2i.${adapter}.label` as Parameters<Translator>[0]);
  const labels: Record<ImageToImageAdapter, string> = {
    auto: 'Auto',
    'openai-images-edit': 'OpenAI Images edits',
    'responses-input-image': 'Responses input_image',
    'chat-image-url': 'Chat image_url',
    'json-image-array': 'JSON image/images'
  };
  return labels[adapter];
}

export function imageToImageAdapterDescription(adapter: ImageToImageAdapter, t?: Translator) {
  if (t) return t(`provider.i2i.${adapter}.description` as Parameters<Translator>[0]);
  const fallbackDescriptions: Record<ImageToImageAdapter, string> = {
    auto: 'Choose the mapping from current platform and protocol.',
    'openai-images-edit': 'Official Images image-to-image via multipart reference upload.',
    'responses-input-image': 'Send references as input_image with the Responses protocol.',
    'chat-image-url': 'Wrap image-to-image through chat messages with image_url.',
    'json-image-array': 'Common custom-relay shape with image plus images array.'
  };
  return fallbackDescriptions[adapter];
}

export function resolveImageToImageAdapterForDisplay(
  config: OpenAICompatibleConfig,
  providerId: string
): Exclude<ImageToImageAdapter, 'auto'> {
  if (config.imageToImageAdapter !== 'auto') return config.imageToImageAdapter;
  if (config.protocol === 'images') return 'openai-images-edit';
  if (config.protocol === 'responses') return 'responses-input-image';
  if (config.protocol === 'chat-completions') return 'chat-image-url';
  return 'json-image-array';
}

export function imageToImageAdapterDiagnosticDetail(config: OpenAICompatibleConfig, providerId: string, t: Translator) {
  const resolved = resolveImageToImageAdapterForDisplay(config, providerId);
  const adapterLabel = t(`provider.i2i.${resolved}.label` as Parameters<Translator>[0]);
  const prefix = config.imageToImageAdapter === 'auto'
    ? t('provider.i2i.autoPrefix', { adapter: adapterLabel })
    : t('provider.i2i.fixedPrefix', { adapter: adapterLabel });
  return t('provider.i2i.diagnosticText', {
    prefix,
    field: t(`provider.i2i.${resolved}.field` as Parameters<Translator>[0])
  });
}

export function providerEndpointPreview(config: Partial<OpenAICompatibleConfig>) {
  const protocol = config.protocol ?? 'images';
  const endpointPath = safeProviderConfigText(config.endpointPath);
  const normalizedPath = endpointPath.startsWith('/') ? endpointPath : `/${endpointPath || defaultEndpointForProtocol(protocol)}`;
  const modelPath = normalizedPath.replace('{model}', encodeURIComponent(safeProviderConfigText(config.modelId) || '{model}'));
  try {
    const baseUrl = new URL(safeProviderConfigText(config.baseUrl));
    const originAndPath = `${baseUrl.origin}${baseUrl.pathname.replace(/\/+$/, '')}`;
    return `${originAndPath}${modelPath}`;
  } catch {
    return modelPath;
  }
}

export function endpointRiskHint(config: Partial<OpenAICompatibleConfig>, providerId: string, t?: Translator) {
  const protocol = config.protocol ?? 'images';
  const endpointPath = safeProviderConfigText(config.endpointPath);
  const expectedEndpointPath = isGeminiProvider(providerId)
    ? '/v1beta/models/{model}:generateContent'
    : isMiniMaxProvider(providerId)
      ? '/v1/image_generation'
      : defaultEndpointForProtocol(protocol);
  if (!endpointPath.startsWith('/')) {
    return t
      ? t('provider.stability.detail.endpointPathSuggestion', { path: expectedEndpointPath })
      : `Endpoint path should start with /. The default for this protocol is ${expectedEndpointPath}.`;
  }
  if (endpointPath !== expectedEndpointPath) {
    return t
      ? t('provider.stability.detail.endpointCustomPath', { path: endpointPath })
      : `Using custom path ${endpointPath}. Confirm provider docs and avoid duplicating Base URL and endpoint path.`;
  }
  return t
    ? t('provider.stability.detail.endpointDefaultPath', { path: expectedEndpointPath })
    : `Using the default path for this protocol: ${expectedEndpointPath}.`;
}

export function referenceSubmissionHint(
  config: OpenAICompatibleConfig,
  providerId: string,
  template?: ProviderServiceTemplateLike,
  t?: Translator
) {
  const resolved = resolveImageToImageAdapterForDisplay(config, providerId);
  if (template?.supportsImageToImage === false) {
    return t
      ? t('provider.stability.detail.referenceUnsupported')
      : 'This service template is marked as not supporting image-to-image. AI Create should not treat reference images as a real capability promise.';
  }
  if (isGeminiProvider(providerId)) {
    return t
      ? t('provider.stability.detail.referenceGemini')
      : 'Gemini official submits reference images as inlineData parts. Multi-image editing requires real reference-image testing.';
  }
  if (isMiniMaxProvider(providerId)) {
    return t
      ? t('provider.stability.detail.referenceMinimax')
      : 'MiniMax official currently submits only the first reference image as subject_reference.character; multiple references are not sent.';
  }
  const hintKeys: Record<Exclude<ImageToImageAdapter, 'auto'>, Parameters<Translator>[0]> = {
    'openai-images-edit': 'provider.stability.detail.referenceOpenAIImagesEdit',
    'responses-input-image': 'provider.stability.detail.referenceResponsesInputImage',
    'chat-image-url': 'provider.stability.detail.referenceChatImageUrl',
    'json-image-array': 'provider.stability.detail.referenceJsonImageArray'
  };
  const fallbackHints: Record<Exclude<ImageToImageAdapter, 'auto'>, string> = {
    'openai-images-edit': 'Uses multipart upload for reference images, suitable for official Images edits.',
    'responses-input-image': 'Puts reference images into Responses input_image content blocks.',
    'chat-image-url': 'Puts reference images into Chat Completions image_url content blocks.',
    'json-image-array': 'Submits image as the first image and images as an array for custom relays. Field names must follow provider docs.'
  };
  return t ? t(hintKeys[resolved]) : fallbackHints[resolved];
}

function safeProviderConfigText(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}
