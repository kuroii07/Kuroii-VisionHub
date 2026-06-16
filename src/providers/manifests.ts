import type { ProviderManifest } from '../domain/providerTypes';

export const providerManifests: ProviderManifest[] = [
  {
    id: 'openai-gpt-image',
    name: 'OpenAI 官方 GPT Image',
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
    notes: [
      '仅用于 OpenAI 官方 API；ChatGPT Plus 网页额度不等于 API 生图额度，API Key 需要单独开通 API 账单。'
    ]
  },
  {
    id: 'minimax-image',
    name: 'MiniMax 官方',
    vendor: 'MiniMax',
    region: 'china',
    phase: 'official-api',
    executionModes: ['sync', 'custom-http'],
    homepage: 'https://platform.minimaxi.com/',
    docs: 'https://platform.minimaxi.com/',
    auth: { type: 'bearer-token', label: 'MiniMax API Key', secretStorageKey: 'provider.minimax.apiKey' },
    capabilities: {
      textToImage: 'supported',
      imageToImage: 'partial',
      editImage: 'planned',
      multiReferenceImage: 'unsupported',
      generateSeries: 'partial',
      imageToVideo: 'planned',
      promptPolish: 'unsupported',
      chineseTextRendering: 'unknown',
      localWorkflow: 'unsupported'
    },
    models: [
      {
        id: 'image-01',
        label: 'image-01',
        description: 'MiniMax 官方文生图模型。',
        defaultSize: '1024x1024',
        defaultQuality: 'auto',
        tags: ['official', 'domestic', 'text-to-image']
      },
      {
        id: 'image-01-live',
        label: 'image-01-live',
        description: 'MiniMax 官方实时图片生成模型，能力以官方文档和账号权限为准。',
        defaultSize: '1024x1024',
        defaultQuality: 'auto',
        tags: ['official', 'domestic', 'text-to-image']
      }
    ],
    notes: [
      'MiniMax 官方 API 使用独立凭据通道，不复用中转站 Key。',
      '当前接入文生图和单张人物主体参考图；多参考图和局部编辑后续补。'
    ]
  },
  {
    id: 'custom-http-provider',
    name: '聚合站 / OpenAI 兼容',
    vendor: 'Relay / Aggregator',
    region: 'global',
    phase: 'aggregator',
    executionModes: ['custom-http', 'openai-compatible', 'async-polling'],
    homepage: 'local://custom-provider',
    auth: { type: 'custom', label: '聚合站 API Key', secretStorageKey: 'provider.custom.credentials' },
    capabilities: {
      textToImage: 'supported',
      imageToImage: 'partial',
      editImage: 'partial',
      multiReferenceImage: 'partial',
      generateSeries: 'partial',
      imageToVideo: 'planned',
      promptPolish: 'supported',
      chineseTextRendering: 'unknown',
      localWorkflow: 'planned'
    },
    models: [
      {
        id: 'gpt-image-1',
        label: '中转站图片模型',
        description: '填写聚合站实际支持的模型 ID，例如 GPT Image、Nano Banana、Qwen、豆包、Grok、Midjourney、可灵等。',
        defaultSize: '1024x1024',
        tags: ['relay', 'aggregator', 'recommended']
      }
    ],
    textModels: [
      {
        id: 'gpt-4o-mini',
        label: '中转站文本模型',
        description: 'OpenAI-compatible 文本模型，用于提示词润色和翻译，具体模型 ID 以聚合站为准。',
        tags: ['text', 'openai-compatible', 'prompt-polish']
      }
    ],
    notes: [
      '推荐用于中转站 / 聚合 API；Base URL、模型 ID 和协议类型以服务商文档为准。',
      '如果中转站把 Nano Banana、豆包、千问、Midjourney、可灵等包装成 OpenAI-compatible 接口，可以从这里接入。'
    ]
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
