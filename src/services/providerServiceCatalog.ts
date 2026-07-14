export type ProviderPlatformType = 'aggregator' | 'official' | 'local';
export type ProviderServiceTemplateStatus = 'connected' | 'configurable' | 'planned' | 'local-plan';
export type ProviderServiceRegion = 'domestic' | 'overseas' | 'local' | 'custom';

export type ProviderPlatformOption = {
  id: ProviderPlatformType;
  label: string;
  description: string;
};

export type ProviderServiceTemplate = {
  id: string;
  platformType: ProviderPlatformType;
  label: string;
  description: string;
  status: ProviderServiceTemplateStatus;
  region: ProviderServiceRegion;
  sortRank: number;
  providerId?: string;
  defaultDisplayName?: string;
  apiDocUrl?: string;
  supportsTextToImage?: boolean;
  supportsImageToImage?: boolean;
  requiresPolling?: boolean;
  notes: string[];
};

export const providerPlatformOptions: ProviderPlatformOption[] = [
  {
    id: 'aggregator',
    label: 'Relay / Aggregator API',
    description: 'Default entry for relays, aggregators, and OpenAI-compatible services.'
  },
  {
    id: 'official',
    label: 'Official API',
    description: 'Official provider entry. Live integrations can call real APIs; planned entries stay informational.'
  },
  {
    id: 'local',
    label: 'Local models',
    description: 'Local workflow entry that does not affect the online relay flow.'
  }
];

export const providerServiceTemplates: ProviderServiceTemplate[] = [
  {
    id: 'aggregator-openai-compatible',
    platformType: 'aggregator',
    label: 'OpenAI-compatible relay',
    description: 'Live now. Best for relay services that wrap GPT Image, Nano Banana, Qwen, Doubao, Grok, Midjourney, Kling, and similar models as OpenAI-compatible APIs.',
    status: 'connected',
    region: 'custom',
    sortRank: 10,
    providerId: 'custom-http-provider',
    defaultDisplayName: 'OpenAI-compatible relay',
    supportsTextToImage: true,
    supportsImageToImage: true,
    notes: ['Follow the provider docs for Base URL, model ID, and protocol path.', 'Legacy relay configs are migrated here without changing profile IDs.']
  },
  {
    id: 'aggregator-generic-api',
    platformType: 'aggregator',
    label: 'Aggregator API',
    description: 'Generic aggregator template. It can save config; image capabilities depend on the actual provider.',
    status: 'configurable',
    region: 'custom',
    sortRank: 20,
    providerId: 'custom-http-provider',
    defaultDisplayName: 'Aggregator API',
    supportsTextToImage: true,
    supportsImageToImage: true,
    notes: ['Use this when there is no dedicated brand template.', 'Before saving, fill Base URL, model ID, and protocol from the provider docs.']
  },
  {
    id: 'siliconflow',
    platformType: 'aggregator',
    label: 'SiliconFlow',
    description: 'Mainland aggregator candidate. Kept configurable first; image capability needs model-level validation.',
    status: 'configurable',
    region: 'domestic',
    sortRank: 30,
    providerId: 'custom-http-provider',
    defaultDisplayName: 'SiliconFlow',
    apiDocUrl: 'https://docs.siliconflow.cn/',
    supportsTextToImage: true,
    supportsImageToImage: false,
    notes: ['Connection config can be saved; image models and OpenAI-compatible behavior depend on the provider.']
  },
  {
    id: 'aggregator-custom',
    platformType: 'aggregator',
    label: 'Other aggregator',
    description: 'Generic custom template for other OpenAI-compatible aggregator APIs.',
    status: 'configurable',
    region: 'custom',
    sortRank: 90,
    providerId: 'custom-http-provider',
    defaultDisplayName: 'Other aggregator',
    supportsTextToImage: true,
    supportsImageToImage: true,
    notes: ['Keeps maximum manual config space for providers with unusual docs.']
  },
  {
    id: 'official-openai',
    platformType: 'official',
    label: 'OpenAI official',
    description: 'Live now; only for https://api.openai.com.',
    status: 'connected',
    region: 'overseas',
    sortRank: 10,
    providerId: 'openai-gpt-image',
    defaultDisplayName: 'OpenAI official',
    apiDocUrl: 'https://platform.openai.com/docs/guides/images',
    supportsTextToImage: true,
    supportsImageToImage: true,
    notes: ['ChatGPT Plus web quota is not API quota.', 'Legacy official OpenAI configs are migrated here without changing profile IDs.']
  },
  {
    id: 'official-minimax',
    platformType: 'official',
    label: 'MiniMax official',
    description: 'First official API V4 slice for China; supports text-to-image through the official image endpoint.',
    status: 'configurable',
    region: 'domestic',
    sortRank: 20,
    providerId: 'minimax-image',
    defaultDisplayName: 'MiniMax official',
    apiDocUrl: 'https://platform.minimaxi.com/',
    supportsTextToImage: true,
    supportsImageToImage: true,
    notes: ['Uses the MiniMax official Bearer API key, separate from relay keys.', 'Currently supports image-01 / image-01-live text-to-image and single character subject reference; multi-reference comes later.']
  },
  {
    id: 'official-mimo',
    platformType: 'official',
    label: 'Xiaomi MiMo official',
    description: 'Mainland candidate. The official API currently focuses on text, image understanding, and multimodal reasoning; no image-generation endpoint is open yet.',
    status: 'planned',
    region: 'domestic',
    sortRank: 30,
    apiDocUrl: 'https://mimo.mi.com/docs/zh-CN/quick-start/usage-guide/multimodal-understanding/image-understanding',
    supportsTextToImage: false,
    supportsImageToImage: false,
    notes: ['Docs show image understanding with URL / Base64 image input for captioning, classification, and visual Q&A.', 'No public text-to-image / image-to-image endpoint found; keep this as informational only.']
  },
  {
    id: 'official-gemini',
    platformType: 'official',
    label: 'Google Gemini / Nano Banana official',
    description: 'First global official API V4 slice; supports Gemini image generation / editing and saves returned inline images.',
    status: 'configurable',
    region: 'overseas',
    sortRank: 40,
    providerId: 'gemini-image',
    defaultDisplayName: 'Google Gemini official',
    apiDocUrl: 'https://ai.google.dev/gemini-api/docs/image-generation',
    supportsTextToImage: true,
    supportsImageToImage: true,
    notes: ['Uses a Google Gemini API key, separate from relay keys.', 'Currently uses gemini-2.5-flash-image for text-to-image and reference-image editing; multi-image limits come later.']
  },
  {
    id: 'official-xai',
    platformType: 'official',
    label: 'xAI official',
    description: 'Planned only. Save, enable, and real test generation are disabled for now.',
    status: 'planned',
    region: 'overseas',
    sortRank: 50,
    apiDocUrl: 'https://docs.x.ai/docs/guides/image-generations',
    supportsTextToImage: true,
    supportsImageToImage: false,
    notes: ['Future work will follow the official image endpoint capabilities.']
  },
  {
    id: 'official-volcengine',
    platformType: 'official',
    label: 'Volcengine / Seedream official',
    description: 'Planned only. Save, enable, and real test generation are disabled for now.',
    status: 'planned',
    region: 'domestic',
    sortRank: 60,
    supportsTextToImage: true,
    supportsImageToImage: true,
    requiresPolling: true,
    notes: ['Future work needs Volcengine auth, model parameters, and result persistence.']
  },
  {
    id: 'official-bailian',
    platformType: 'official',
    label: 'Alibaba Model Studio / Tongyi Wanxiang official',
    description: 'Planned only. Save, enable, and real test generation are disabled for now.',
    status: 'planned',
    region: 'domestic',
    sortRank: 70,
    apiDocUrl: 'https://help.aliyun.com/zh/model-studio/',
    supportsTextToImage: true,
    supportsImageToImage: true,
    requiresPolling: true,
    notes: ['Future work needs official auth and async task polling.']
  },
  {
    id: 'official-kling',
    platformType: 'official',
    label: 'Kling enterprise API',
    description: 'Planned only. Save, enable, and real test generation are disabled for now.',
    status: 'planned',
    region: 'domestic',
    sortRank: 80,
    supportsTextToImage: true,
    supportsImageToImage: true,
    requiresPolling: true,
    notes: ['Can become an image / video generation enterprise API route later.']
  },
  {
    id: 'official-jimeng',
    platformType: 'official',
    label: 'Jimeng enterprise API',
    description: 'Planned only. Save, enable, and real test generation are disabled for now.',
    status: 'planned',
    region: 'domestic',
    sortRank: 90,
    supportsTextToImage: true,
    supportsImageToImage: true,
    requiresPolling: true,
    notes: ['Can become a mainland official enterprise API route later.']
  },
  {
    id: 'local-comfyui',
    platformType: 'local',
    label: 'ComfyUI',
    description: 'Local ComfyUI supports connection diagnostics, API workflow import, text-to-image, and image-to-image tests with LoadImage nodes.',
    status: 'configurable',
    region: 'local',
    sortRank: 10,
    providerId: 'comfyui-local',
    supportsTextToImage: true,
    supportsImageToImage: true,
    requiresPolling: true,
    notes: ['Supports ComfyUI API workflows; regular UI workflows must be re-exported from ComfyUI in API format.', 'Currently writes Prompt, negative prompt, size, and Seed automatically; image-to-image uploads the first reference image into LoadImage nodes.']
  },
  {
    id: 'local-sd-webui',
    platformType: 'local',
    label: 'Stable Diffusion WebUI / Forge',
    description: '0.4.3 supports local connection diagnostics, txt2img, and gallery save. WebUI / Forge must be launched with --api.',
    status: 'configurable',
    region: 'local',
    sortRank: 20,
    providerId: 'sd-webui-local',
    supportsTextToImage: true,
    supportsImageToImage: false,
    notes: ['A1111 Stable Diffusion WebUI or Forge must be started with --api.', 'Current slice supports txt2img, Seed, negative prompt, sampler, steps, CFG, and gallery save; img2img / ControlNet comes later.']
  }
];

const providerServiceStatusRank: Record<ProviderServiceTemplateStatus, number> = {
  connected: 0,
  configurable: 1,
  'local-plan': 2,
  planned: 3
};

export function getProviderServiceTemplatesForPlatform(platformType: ProviderPlatformType) {
  return [...providerServiceTemplates]
    .filter((template) => template.platformType === platformType)
    .sort((a, b) =>
      providerServiceStatusRank[a.status] - providerServiceStatusRank[b.status]
      || a.sortRank - b.sortRank
      || a.label.localeCompare(b.label, 'zh-CN')
    );
}

export function getProviderServiceTemplate(templateId: string) {
  return providerServiceTemplates.find((template) => template.id === templateId);
}

export function isProviderServiceTemplateConfigurable(template: ProviderServiceTemplate) {
  return Boolean(template.providerId)
    && (template.status === 'connected' || template.status === 'configurable');
}

export function getDefaultProviderServiceTemplateForProvider(providerId: string) {
  if (providerId === 'custom-http-provider') return getProviderServiceTemplate('aggregator-openai-compatible');
  if (providerId === 'openai-gpt-image') return getProviderServiceTemplate('official-openai');
  if (providerId === 'minimax-image') return getProviderServiceTemplate('official-minimax');
  if (providerId === 'gemini-image') return getProviderServiceTemplate('official-gemini');
  if (providerId === 'sd-webui-local') return getProviderServiceTemplate('local-sd-webui');
  return providerServiceTemplates.find((template) => template.providerId === providerId);
}
