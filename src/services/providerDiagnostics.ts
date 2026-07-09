import type { Translator } from '../i18n';
import type { OpenAICompatibleConfig } from './providerConfig';
import type { ProviderConnectionProfile } from './providerProfiles';
import {
  buildGeminiManualModelProbe,
  buildMiniMaxManualModelProbe,
  endpointRiskHint,
  imageToImageAdapterLabel,
  isGeminiProvider,
  isMiniMaxProvider,
  protocolLabel,
  providerEndpointPreview,
  referenceSubmissionHint,
  resolveImageToImageAdapterForDisplay
} from './providerDisplay';

export type ProviderDiagnosticLevel = 'pass' | 'warn' | 'fail' | 'info';

export type ProviderDiagnosticItem = {
  id: string;
  label: string;
  detail: string;
  level: ProviderDiagnosticLevel;
};

type ProviderServiceTemplateLike = {
  status: 'connected' | 'configurable' | 'planned' | 'local-plan';
  supportsTextToImage?: boolean;
  supportsImageToImage?: boolean;
  requiresPolling?: boolean;
};

export function buildProviderStabilityDiagnosticItems(input: {
  config: OpenAICompatibleConfig;
  providerId: string;
  template?: ProviderServiceTemplateLike;
  supportsModelList: boolean;
  t: Translator;
}): ProviderDiagnosticItem[] {
  const t = input.t;
  const resolvedAdapter = resolveImageToImageAdapterForDisplay(input.config, input.providerId);
  const template = input.template;
  const endpointPreview = providerEndpointPreview(input.config);
  const endpointHint = endpointRiskHint(input.config, input.providerId, t);
  const adapterLabel = imageToImageAdapterLabel(resolvedAdapter, t);
  return [
    {
      id: 'endpoint-preview',
      label: t('provider.stability.item.endpointPreview'),
      level: safeProviderConfigText(input.config.baseUrl) && safeProviderConfigText(input.config.endpointPath) ? 'pass' : 'warn',
      detail: t('provider.stability.detail.endpointPreview', { endpoint: endpointPreview, hint: endpointHint })
    },
    {
      id: 'capability-boundary',
      label: t('provider.stability.item.capabilityBoundary'),
      level: template?.status === 'planned' || template?.status === 'local-plan' ? 'info' : 'pass',
      detail: template
        ? t('provider.stability.detail.capabilityBoundary', {
            status: t(`provider.status.${template.status}` as Parameters<Translator>[0]),
            textToImage: template.supportsTextToImage === false ? t('provider.stability.value.uncommitted') : t('provider.stability.value.canCheck'),
            imageToImage: template.supportsImageToImage === false ? t('provider.stability.value.uncommitted') : t('provider.stability.value.canCheck'),
            polling: template.requiresPolling ? t('provider.stability.value.asyncPossible') : t('provider.stability.value.asyncNotMarked')
          })
        : t('provider.stability.detail.capabilityBoundaryNoTemplate')
    },
    {
      id: 'reference-submission',
      label: t('provider.stability.item.referenceSubmission'),
      level: template?.supportsImageToImage === false ? 'warn' : 'info',
      detail: t('provider.stability.detail.referenceSubmission', {
        adapter: adapterLabel,
        hint: referenceSubmissionHint(input.config, input.providerId, template, t)
      })
    },
    {
      id: 'cost-risk-boundary',
      label: t('provider.stability.item.costRiskBoundary'),
      level: 'info',
      detail: providerCostRiskHint(input.config, template, t)
    },
    {
      id: 'model-list-boundary',
      label: t('provider.stability.item.modelListBoundary'),
      level: input.supportsModelList ? 'info' : 'pass',
      detail: input.supportsModelList
        ? t('provider.stability.detail.modelListSupported')
        : t('provider.stability.detail.modelListManualOfficial')
    }
  ];
}

export function buildProviderReadinessItems(input: {
  profile: ProviderConnectionProfile | null;
  config: OpenAICompatibleConfig;
  providerId: string;
  desktopRuntime: boolean;
  secretAvailable: boolean;
  serviceConfigurable: boolean;
  supportsOpenAICompatible: boolean;
  t: Translator;
}): ProviderDiagnosticItem[] {
  const t = input.t;
  if (!input.serviceConfigurable || !input.supportsOpenAICompatible) {
    return [{
      id: 'route',
      label: t('provider.readiness.item.route'),
      level: 'info',
      detail: t('provider.readiness.detail.routePlanned')
    }];
  }

  const modelId = input.config.modelId.trim();
  const hasBaseUrl = Boolean(input.config.baseUrl.trim());
  const hasEndpointPath = input.config.endpointPath.trim().startsWith('/');
  const modelCount = input.profile?.lastModelCount;
  const modelProbe = input.profile?.lastModelProbe;
  const generationVerified = Boolean(input.profile?.lastMessage?.includes('\u6d4b\u8bd5\u751f\u6210\u529f'));
  const resolvedAdapter = resolveImageToImageAdapterForDisplay(input.config, input.providerId);
  const adapterLabel = imageToImageAdapterLabel(resolvedAdapter, t);
  const protocolLabelText = protocolLabel(input.config.protocol, t);
  const isMiniMax = isMiniMaxProvider(input.providerId);
  const isGemini = isGeminiProvider(input.providerId);
  const readyForGeneration = hasBaseUrl && modelId && hasEndpointPath && input.secretAvailable && input.desktopRuntime;

  if (isMiniMax) {
    const miniMaxProbe = buildMiniMaxManualModelProbe(
      modelId,
      t('provider.readiness.detail.minimaxFixedModelSource'),
      t
    );
    return [
      {
        id: 'config-profile',
        label: t('provider.readiness.item.configProfile'),
        level: input.profile ? 'pass' : 'info',
        detail: input.profile
          ? t('provider.readiness.detail.minimaxProfileSaved')
          : t('provider.readiness.detail.minimaxProfileDraft')
      },
      {
        id: 'model-list',
        label: t('provider.readiness.item.modelList'),
        level: 'info',
        detail: t('provider.readiness.detail.minimaxModelList')
      },
      {
        id: 'model-probe',
        label: t('provider.readiness.item.currentModel'),
        level: miniMaxProbe.available ? 'pass' : 'warn',
        detail: miniMaxProbe.message
      },
      {
        id: 'text-to-image',
        label: t('provider.readiness.item.textToImage'),
        level: generationVerified
          ? 'pass'
          : readyForGeneration
            ? 'info'
            : 'warn',
        detail: generationVerified
          ? t('provider.readiness.detail.minimaxTextToImageVerified')
          : readyForGeneration
            ? t('provider.readiness.detail.minimaxTextToImageReady')
            : t('provider.readiness.detail.minimaxTextToImageMissing')
      },
      {
        id: 'image-to-image',
        label: t('provider.readiness.item.imageToImage'),
        level: readyForGeneration ? 'info' : 'warn',
        detail: readyForGeneration
          ? t('provider.readiness.detail.minimaxImageToImageReady')
          : t('provider.readiness.detail.minimaxImageToImageMissing')
      },
      {
        id: 'multi-reference',
        label: t('provider.readiness.item.multiReference'),
        level: 'info',
        detail: t('provider.readiness.detail.minimaxMultiReference')
      }
    ];
  }

  if (isGemini) {
    const geminiProbe = buildGeminiManualModelProbe(
      modelId,
      t('provider.readiness.detail.geminiFixedModelSource'),
      t
    );
    return [
      {
        id: 'config-profile',
        label: t('provider.readiness.item.configProfile'),
        level: input.profile ? 'pass' : 'info',
        detail: input.profile
          ? t('provider.readiness.detail.geminiProfileSaved')
          : t('provider.readiness.detail.geminiProfileDraft')
      },
      {
        id: 'model-list',
        label: t('provider.readiness.item.modelList'),
        level: 'info',
        detail: t('provider.readiness.detail.geminiModelList')
      },
      {
        id: 'model-probe',
        label: t('provider.readiness.item.currentModel'),
        level: geminiProbe.available ? 'pass' : 'warn',
        detail: geminiProbe.message
      },
      {
        id: 'text-to-image',
        label: t('provider.readiness.item.textToImage'),
        level: generationVerified
          ? 'pass'
          : readyForGeneration
            ? 'info'
            : 'warn',
        detail: generationVerified
          ? t('provider.readiness.detail.geminiTextToImageVerified')
          : readyForGeneration
            ? t('provider.readiness.detail.geminiTextToImageReady')
            : t('provider.readiness.detail.geminiTextToImageMissing')
      },
      {
        id: 'image-to-image',
        label: t('provider.readiness.item.imageToImageEdit'),
        level: readyForGeneration ? 'info' : 'warn',
        detail: readyForGeneration
          ? t('provider.readiness.detail.geminiImageToImageReady')
          : t('provider.readiness.detail.geminiImageToImageMissing')
      },
      {
        id: 'multi-reference',
        label: t('provider.readiness.item.multiReference'),
        level: 'info',
        detail: t('provider.readiness.detail.geminiMultiReference')
      }
    ];
  }

  return [
    {
      id: 'config-profile',
      label: t('provider.readiness.item.configProfile'),
      level: input.profile ? 'pass' : 'info',
      detail: input.profile
        ? t('provider.readiness.detail.profileSaved')
        : t('provider.readiness.detail.profileDraft')
    },
    {
      id: 'model-list',
      label: t('provider.readiness.item.modelList'),
      level: typeof modelCount === 'number' ? (modelCount > 0 ? 'pass' : 'warn') : 'info',
      detail: typeof modelCount === 'number'
        ? t('provider.readiness.detail.modelListCount', { count: modelCount, imageCount: input.profile?.lastImageModelCount ?? 0 })
        : t('provider.readiness.detail.modelListNotRefreshed')
    },
    {
      id: 'model-probe',
      label: t('provider.readiness.item.currentModel'),
      level: modelProbe ? (modelProbe.available ? 'pass' : 'warn') : (modelId ? 'info' : 'fail'),
      detail: modelProbe?.message ?? (modelId ? t('provider.readiness.detail.currentModelNotProbed', { model: modelId }) : t('provider.readiness.detail.currentModelEmpty'))
    },
    {
      id: 'text-to-image',
      label: t('provider.readiness.item.textToImage'),
      level: generationVerified
        ? 'pass'
        : readyForGeneration
          ? 'info'
          : 'warn',
      detail: generationVerified
        ? t('provider.readiness.detail.textToImageVerified')
        : readyForGeneration
          ? t('provider.readiness.detail.textToImageReady', { protocol: protocolLabelText })
          : t('provider.readiness.detail.textToImageMissing')
    },
    {
      id: 'image-to-image',
      label: t('provider.readiness.item.imageToImage'),
      level: hasEndpointPath && modelId ? 'info' : 'warn',
      detail: hasEndpointPath && modelId
        ? t('provider.readiness.detail.imageToImageMapped', { adapter: adapterLabel })
        : t('provider.readiness.detail.imageToImageMissing')
    },
    {
      id: 'multi-reference',
      label: t('provider.readiness.item.multiReference'),
      level: ['openai-images-edit', 'responses-input-image', 'chat-image-url', 'json-image-array'].includes(resolvedAdapter) ? 'info' : 'warn',
      detail: t('provider.readiness.detail.multiReferenceMapped', { adapter: adapterLabel })
    }
  ];
}

export function buildGenerationUsageReadinessItem(input: {
  profile: ProviderConnectionProfile | null;
  generationProfile: ProviderConnectionProfile | null;
  selectedProviderId: string;
  generationProviderId: string;
  t: Translator;
}): ProviderDiagnosticItem {
  const t = input.t;
  if (input.selectedProviderId !== input.generationProviderId) {
    return {
      id: 'generation-usage',
      label: t('provider.readiness.item.generationUsage'),
      level: 'info',
      detail: t('provider.readiness.detail.generationUsageOtherPlatform')
    };
  }
  if (!input.profile) {
    return {
      id: 'generation-usage',
      label: t('provider.readiness.item.generationUsage'),
      level: 'warn',
      detail: t('provider.readiness.detail.generationUsageDraft')
    };
  }
  if (input.generationProfile?.id === input.profile.id) {
    return {
      id: 'generation-usage',
      label: t('provider.readiness.item.generationUsage'),
      level: 'pass',
      detail: t('provider.readiness.detail.generationUsageActive', { name: input.profile.displayName })
    };
  }
  return {
    id: 'generation-usage',
    label: t('provider.readiness.item.generationUsage'),
    level: 'warn',
    detail: input.generationProfile
      ? t('provider.readiness.detail.generationUsageMismatch', { active: input.generationProfile.displayName, editing: input.profile.displayName })
      : t('provider.readiness.detail.generationUsageMissing')
  };
}

export function buildOfflineDiagnosticSummary(input: {
  profile: ProviderConnectionProfile | null;
  config: OpenAICompatibleConfig;
  desktopRuntime: boolean;
  secretAvailable: boolean;
  generationProfile: ProviderConnectionProfile | null;
  selectedProviderId: string;
  generationProviderId: string;
  t: Translator;
}) {
  const t = input.t;
  const modelId = input.config.modelId.trim();
  const hasBaseUrl = Boolean(input.config.baseUrl.trim());
  const hasEndpointPath = input.config.endpointPath.trim().startsWith('/');
  const modelProbe = input.profile?.lastModelProbe;
  const generationMatches =
    input.selectedProviderId === input.generationProviderId &&
    Boolean(input.profile && input.generationProfile?.id === input.profile.id);
  const missing: string[] = [];
  if (!input.profile) missing.push(t('provider.offlineSummary.missing.profile'));
  if (!input.desktopRuntime) missing.push(t('provider.offlineSummary.missing.desktopRuntime'));
  if (!input.secretAvailable) missing.push(t('provider.offlineSummary.missing.secret'));
  if (!hasBaseUrl) missing.push(t('provider.offlineSummary.missing.baseUrl'));
  if (!modelId) missing.push(t('provider.offlineSummary.missing.model'));
  if (!hasEndpointPath) missing.push(t('provider.offlineSummary.missing.endpointPath'));
  if (!generationMatches) missing.push(t('provider.offlineSummary.missing.generationUsage'));
  const modelState = modelProbe
    ? modelProbe.available
      ? t('provider.offlineSummary.chip.modelMatched')
      : t('provider.offlineSummary.chip.modelMissing')
    : t('provider.offlineSummary.chip.modelUnchecked');
  const title = missing.length === 0
    ? t('provider.offlineSummary.title.ready')
    : t('provider.offlineSummary.title.pending', { count: missing.length });
  const detail = missing.length === 0
    ? t('provider.offlineSummary.detail.ready')
    : t('provider.offlineSummary.detail.pending', {
        items: missing.slice(0, 3).join(' / '),
        more: missing.length > 3 ? t('provider.offlineSummary.detail.more') : ''
      });
  return {
    title,
    detail,
    chips: [
      { label: input.profile ? t('provider.offlineSummary.chip.profileSaved') : t('provider.offlineSummary.chip.profileDraft'), level: input.profile ? 'pass' : 'warn' },
      { label: input.secretAvailable ? t('provider.offlineSummary.chip.secretSaved') : t('provider.offlineSummary.chip.secretMissing'), level: input.secretAvailable ? 'pass' : 'warn' },
      { label: modelState, level: modelProbe?.available ? 'pass' : modelProbe ? 'warn' : 'info' },
      { label: generationMatches ? t('provider.offlineSummary.chip.generationActive') : t('provider.offlineSummary.chip.generationInactive'), level: generationMatches ? 'pass' : 'info' }
    ] as Array<{ label: string; level: ProviderDiagnosticLevel }>
  };
}

function providerErrorText(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

export function isModelListUnavailableError(error: unknown) {
  const lower = providerErrorText(error).toLowerCase();
  return [
    'model list',
    '/v1/models',
    'http 403',
    '403 forbidden',
    'cannot parse',
    'body preview',
    '<!doctype html',
    'just a moment',
    'challenges.cloudflare.com',
    'cloudflare',
    'does not contain data array'
  ].some((hint) => lower.includes(hint));
}

export function formatModelListFallbackMessage(error: unknown, modelId: string, t: Translator) {
  const mapped = mapProviderErrorMessage(error, t);
  const modelLabel = modelId.trim() || t('provider.error.currentManualModelId');
  return t('provider.error.modelListFallback', { model: modelLabel, message: mapped });
}

export function mapProviderErrorMessage(error: unknown, t: Translator) {
  const message = providerErrorText(error);
  const lower = message.toLowerCase();

  if (
    lower.includes('model list') &&
    (lower.includes('<!doctype html') ||
      lower.includes('just a moment') ||
      lower.includes('challenges.cloudflare.com') ||
      lower.includes('cloudflare'))
  ) {
    return t('provider.error.modelListHtml');
  }

  if (lower.includes('401') || lower.includes('unauthorized') || lower.includes('invalid api key')) {
    return t('provider.error.unauthorized', { message });
  }
  if (lower.includes('403') || lower.includes('forbidden')) {
    return t('provider.error.forbidden', { message });
  }
  if (lower.includes('404') || lower.includes('not found')) {
    return t('provider.error.notFound', { message });
  }
  if (lower.includes('billing hard limit')) {
    return t('provider.error.billingHardLimit', { message });
  }
  if (lower.includes('429') || lower.includes('rate limit') || lower.includes('quota')) {
    return t('provider.error.rateLimit', { message });
  }
  if (lower.includes('timeout') || lower.includes('timed out')) {
    return t('provider.error.timeout', { message });
  }
  if (lower.includes('failed to fetch') || lower.includes('dns') || lower.includes('connection')) {
    return t('provider.error.network', { message });
  }
  if (lower.includes('json')) {
    return t('provider.error.json', { message });
  }
  return message;
}

function providerCostRiskHint(config: OpenAICompatibleConfig, template: ProviderServiceTemplateLike | undefined, t?: Translator) {
  const parts = [t
    ? t('provider.stability.detail.costNoConsume')
    : 'Config self-check does not submit generation requests or consume quota. Only Real test generation, AI Create generation, or batch queue execution calls the API.'];
  if (config.protocol === 'responses' || template?.requiresPolling) {
    parts.push(t
      ? t('provider.stability.detail.costAsyncPolling')
      : 'This route may use async tasks or background polling. A sync timeout does not always mean no charge; check background tasks before retrying after a failure.');
  }
  if (template?.status === 'planned' || template?.status === 'local-plan') {
    parts.push(t
      ? t('provider.stability.detail.costPlannedTemplate')
      : 'This service template is still in planning state and should not expose save, enable, or real test generation.');
  }
  return parts.join(' ');
}

function safeProviderConfigText(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}
