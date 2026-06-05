import type { ProviderManifest } from '../domain/providerTypes';

export const providerManifests: ProviderManifest[] = [
  {
    id: 'openai-gpt-image',
    name: 'GPT Image',
    vendor: 'OpenAI',
    region: 'global',
    phase: 'official-api',
    executionModes: ['sync', 'openai-compatible'],
    homepage: 'https://openai.com',
    docs: 'https://platform.openai.com/docs/guides/image-generation',
    auth: { type: 'api-key', label: 'OpenAI API Key', secretStorageKey: 'provider.openai.apiKey' },
    capabilities: {
      textToImage: 'supported',
      imageToImage: 'supported',
      editImage: 'supported',
      multiReferenceImage: 'partial',
      generateSeries: 'partial',
      imageToVideo: 'unsupported',
      promptPolish: 'supported',
      chineseTextRendering: 'partial',
      localWorkflow: 'unsupported'
    },
    models: [
      {
        id: 'gpt-image-1',
        label: 'gpt-image-1',
        description: 'OpenAI image generation and editing model.',
        defaultSize: '1024x1024',
        defaultQuality: 'high',
        tags: ['mvp', 'official']
      }
    ],
    textModels: [
      {
        id: 'gpt-4o-mini',
        label: 'gpt-4o-mini',
        description: '轻量文本模型，适合提示词润色、翻译和结构化改写。',
        tags: ['text', 'prompt-polish', 'recommended']
      },
      {
        id: 'gpt-4.1-mini',
        label: 'gpt-4.1-mini',
        description: '更强的提示词改写与风格扩写模型。',
        tags: ['text', 'prompt-polish']
      }
    ],
    notes: ['首版 MVP Provider。真实请求集中封装在后端/Adapter，前端不直接保存密钥。']
  },
  {
    id: 'gemini-nano-banana',
    name: 'Nano Banana',
    vendor: 'Google Gemini',
    region: 'global',
    phase: 'official-api',
    executionModes: ['sync', 'streaming'],
    homepage: 'https://ai.google.dev',
    docs: 'https://ai.google.dev/gemini-api/docs/image-generation',
    auth: { type: 'api-key', label: 'Gemini API Key', secretStorageKey: 'provider.google.apiKey' },
    capabilities: {
      textToImage: 'supported',
      imageToImage: 'supported',
      editImage: 'supported',
      multiReferenceImage: 'supported',
      generateSeries: 'partial',
      imageToVideo: 'planned',
      promptPolish: 'planned',
      chineseTextRendering: 'partial',
      localWorkflow: 'unsupported'
    },
    models: [
      {
        id: 'gemini-2.5-flash-image',
        label: 'Nano Banana',
        description: 'Fast image generation/editing route through Gemini API.',
        defaultSize: '1024x1024',
        tags: ['online', 'global']
      },
      {
        id: 'gemini-3-pro-image-preview',
        label: 'Nano Banana Pro',
        description: 'Higher fidelity Gemini image route when available.',
        defaultSize: '1024x1024',
        defaultQuality: 'high',
        tags: ['online', 'global', 'pro']
      }
    ],
    notes: ['v0.2 Provider；重点验证多参考图、图像编辑和中文提示词表现。']
  },
  {
    id: 'xai-grok-image',
    name: 'Grok Image',
    vendor: 'xAI',
    region: 'global',
    phase: 'official-api',
    executionModes: ['sync'],
    homepage: 'https://x.ai',
    docs: 'https://docs.x.ai/docs/guides/image-generation',
    auth: { type: 'api-key', label: 'xAI API Key', secretStorageKey: 'provider.xai.apiKey' },
    capabilities: {
      textToImage: 'supported',
      imageToImage: 'supported',
      editImage: 'supported',
      multiReferenceImage: 'unknown',
      generateSeries: 'partial',
      imageToVideo: 'unknown',
      promptPolish: 'partial',
      chineseTextRendering: 'partial',
      localWorkflow: 'unsupported'
    },
    models: [
      {
        id: 'grok-2-image',
        label: 'Grok Image',
        description: 'xAI image generation route.',
        defaultSize: '1024x1024',
        tags: ['online', 'global']
      }
    ],
    notes: ['v0.2 Provider；需要重点处理内容审核、错误分类和额度提示。']
  },
  {
    id: 'volcengine-seedream',
    name: 'Seedream / 豆包 / 火山方舟',
    vendor: 'Volcengine',
    region: 'china',
    phase: 'official-api',
    executionModes: ['async-polling', 'custom-http'],
    homepage: 'https://www.volcengine.com/product/ark',
    docs: 'https://www.volcengine.com/docs/6791/1541523',
    auth: {
      type: 'access-key-secret',
      label: '火山方舟 AK/SK',
      secretStorageKey: 'provider.volcengine.aksk'
    },
    capabilities: {
      textToImage: 'supported',
      imageToImage: 'supported',
      editImage: 'supported',
      multiReferenceImage: 'supported',
      generateSeries: 'supported',
      imageToVideo: 'planned',
      promptPolish: 'planned',
      chineseTextRendering: 'supported',
      localWorkflow: 'unsupported'
    },
    models: [
      {
        id: 'seedream-4-0',
        label: 'Seedream 4.0',
        description: '中文场景、电商海报、系列图优先的在线模型。',
        defaultSize: '1024x1024',
        defaultQuality: 'standard',
        tags: ['china', 'online', '中文']
      }
    ],
    notes: ['即梦/豆包能力优先通过官方火山方舟或授权 API 进入，不做网页自动化模拟。']
  },
  {
    id: 'jimeng-official',
    name: '即梦',
    vendor: 'ByteDance / Jimeng',
    region: 'china',
    phase: 'official-or-enterprise-api',
    executionModes: ['async-polling', 'custom-http'],
    homepage: 'https://jimeng.jianying.com',
    auth: {
      type: 'custom',
      label: '官方或企业 API 凭据',
      secretStorageKey: 'provider.jimeng.credentials'
    },
    capabilities: {
      textToImage: 'unknown',
      imageToImage: 'unknown',
      editImage: 'unknown',
      multiReferenceImage: 'unknown',
      generateSeries: 'unknown',
      imageToVideo: 'planned',
      promptPolish: 'planned',
      chineseTextRendering: 'supported',
      localWorkflow: 'unsupported'
    },
    models: [
      {
        id: 'jimeng-api-placeholder',
        label: '即梦官方 API 待确认',
        description: '首版作为能力占位和调研任务，不使用网页自动化。',
        defaultSize: '1024x1024',
        tags: ['china', 'planned']
      }
    ],
    notes: ['若无开放 API，使用 Seedream Provider 承接相近能力；避免模拟登录或批量网页自动化。']
  },
  {
    id: 'kling-image',
    name: '可灵 Kling',
    vendor: 'Kuaishou',
    region: 'china',
    phase: 'official-or-enterprise-api',
    executionModes: ['async-polling'],
    homepage: 'https://klingai.com',
    auth: { type: 'custom', label: '可灵 API 凭据', secretStorageKey: 'provider.kling.credentials' },
    capabilities: {
      textToImage: 'partial',
      imageToImage: 'partial',
      editImage: 'planned',
      multiReferenceImage: 'partial',
      generateSeries: 'partial',
      imageToVideo: 'supported',
      promptPolish: 'planned',
      chineseTextRendering: 'supported',
      localWorkflow: 'unsupported'
    },
    models: [
      {
        id: 'kling-image-placeholder',
        label: 'Kling Image',
        description: '图片能力先作为 v0.3 规划；图生视频后续独立模块。',
        defaultSize: '1024x1024',
        tags: ['china', 'planned', 'video-adjacent']
      }
    ],
    notes: ['v0.3 优先图片能力；视频能力独立为扩展模块，不污染图片 MVP。']
  },
  {
    id: 'custom-http-provider',
    name: 'OpenAI 兼容中转',
    vendor: 'User-defined',
    region: 'global',
    phase: 'aggregator',
    executionModes: ['custom-http', 'openai-compatible', 'async-polling'],
    homepage: 'local://custom-provider',
    auth: { type: 'custom', label: 'Header / Token / Endpoint', secretStorageKey: 'provider.custom.credentials' },
    capabilities: {
      textToImage: 'planned',
      imageToImage: 'planned',
      editImage: 'planned',
      multiReferenceImage: 'planned',
      generateSeries: 'planned',
      imageToVideo: 'planned',
      promptPolish: 'supported',
      chineseTextRendering: 'unknown',
      localWorkflow: 'planned'
    },
    models: [
      {
        id: 'custom-model',
        label: 'Custom Model',
        description: '用户配置 endpoint、headers、body mapping。',
        defaultSize: '1024x1024',
        tags: ['advanced', 'extensible']
      }
    ],
    textModels: [
      {
        id: 'custom-text-model',
        label: 'Custom Text Model',
        description: 'OpenAI-compatible 文本模型，用于提示词润色和翻译。',
        tags: ['text', 'openai-compatible', 'prompt-polish']
      }
    ],
    notes: ['用于 fal.ai、Replicate、Stability、Flux API、Together、Fireworks 等接入模板。']
  },
  {
    id: 'comfyui-local',
    name: 'ComfyUI / 本地模型',
    vendor: 'Local',
    region: 'local',
    phase: 'local-lab',
    executionModes: ['async-polling', 'custom-http'],
    homepage: 'http://127.0.0.1:8188',
    auth: { type: 'local-endpoint', label: '本地 ComfyUI Endpoint', secretStorageKey: 'provider.comfyui.endpoint' },
    capabilities: {
      textToImage: 'planned',
      imageToImage: 'planned',
      editImage: 'planned',
      multiReferenceImage: 'planned',
      generateSeries: 'planned',
      imageToVideo: 'planned',
      promptPolish: 'planned',
      chineseTextRendering: 'unknown',
      localWorkflow: 'supported'
    },
    models: [
      {
        id: 'comfy-workflow-json',
        label: 'ComfyUI Workflow JSON',
        description: '后期接入本地 Flux / SDXL 工作流。',
        defaultSize: '1024x1024',
        tags: ['local', 'future']
      }
    ],
    notes: ['本地模型后置，不影响在线平台接入的首发路线。']
  }
];
