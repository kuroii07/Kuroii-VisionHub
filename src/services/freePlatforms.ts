export type FreePlatformRegion = 'china' | 'global';
export type FreePlatformKind = 'image' | 'image-video' | 'chat-image';

export interface FreePlatform {
  id: string;
  name: string;
  vendor: string;
  logoText: string;
  logoUrl: string;
  brandColor: string;
  region: FreePlatformRegion;
  kind: FreePlatformKind;
  url: string;
  bestFor: string;
  quotaHint: string;
  workflowHint: string;
}

export const FREE_PLATFORMS: FreePlatform[] = [
  {
    id: 'doubao',
    name: '豆包',
    vendor: 'ByteDance',
    logoText: '豆',
    logoUrl: 'https://www.doubao.com/favicon.ico',
    brandColor: '#2563eb',
    region: 'china',
    kind: 'chat-image',
    url: 'https://www.doubao.com',
    bestFor: '中文提示词、日常配图、社媒图',
    quotaHint: '网页登录额度以官方页面为准',
    workflowHint: '复制 Prompt 后在豆包网页粘贴生成，完成后下载并导入作品画廊。'
  },
  {
    id: 'jimeng',
    name: '即梦',
    vendor: 'ByteDance / Jianying',
    logoText: '即',
    logoUrl: 'https://www.jimeng.com/favicon.ico',
    brandColor: '#ec4899',
    region: 'china',
    kind: 'image-video',
    url: 'https://www.jimeng.com',
    bestFor: '中文海报、图像编辑、视频创意',
    quotaHint: '网页登录额度以官方页面为准',
    workflowHint: '适合把 VisionHub 的完整 Prompt 复制过去做图像或视频尝试。'
  },
  {
    id: 'kling',
    name: '可灵',
    vendor: 'Kuaishou',
    logoText: '可',
    logoUrl: 'https://klingai.com/favicon.ico',
    brandColor: '#7c3aed',
    region: 'china',
    kind: 'image-video',
    url: 'https://klingai.com',
    bestFor: '视频生成、图生视频、动态创意',
    quotaHint: '网页登录额度以官方页面为准',
    workflowHint: '可先用本软件整理镜头 Prompt，再打开可灵网页生成。'
  },
  {
    id: 'yuanbao',
    name: '元宝',
    vendor: 'Tencent',
    logoText: '元',
    logoUrl: 'https://yuanbao.tencent.cn/favicon.ico',
    brandColor: '#16a34a',
    region: 'china',
    kind: 'chat-image',
    url: 'https://yuanbao.tencent.cn',
    bestFor: '中文创意、AI 绘画、办公配图',
    quotaHint: '网页登录额度以官方页面为准',
    workflowHint: '复制 Prompt 后在元宝网页继续生成和微调。'
  },
  {
    id: 'qwen',
    name: '千问 / Qwen',
    vendor: 'Alibaba',
    logoText: '千',
    logoUrl: 'https://chat.qwen.ai/favicon.ico',
    brandColor: '#0ea5e9',
    region: 'global',
    kind: 'chat-image',
    url: 'https://chat.qwen.ai',
    bestFor: '中英双语提示词、通用创作',
    quotaHint: '网页登录额度以官方页面为准',
    workflowHint: '可把中文 Prompt 复制过去，也适合先让 Qwen 帮你扩写。'
  },
  {
    id: 'chatgpt',
    name: 'ChatGPT',
    vendor: 'OpenAI',
    logoText: 'G',
    logoUrl: 'https://chatgpt.com/favicon.ico',
    brandColor: '#10a37f',
    region: 'global',
    kind: 'chat-image',
    url: 'https://chatgpt.com',
    bestFor: '图像生成、编辑、英文 Prompt 改写',
    quotaHint: '网页登录额度以官方页面为准',
    workflowHint: '复制 Prompt 后在 ChatGPT 中生成，适合做高质量文字理解。'
  },
  {
    id: 'grok',
    name: 'Grok',
    vendor: 'xAI',
    logoText: 'X',
    logoUrl: 'https://grok.com/favicon.ico',
    brandColor: '#111827',
    region: 'global',
    kind: 'chat-image',
    url: 'https://grok.com',
    bestFor: '快速创意、社媒风格、英文语境',
    quotaHint: '网页登录额度以官方页面为准',
    workflowHint: '适合把短 Prompt 复制过去快速试风格。'
  },
  {
    id: 'gemini',
    name: 'Gemini / Nano Banana',
    vendor: 'Google',
    logoText: 'N',
    logoUrl: 'https://gemini.google.com/favicon.ico',
    brandColor: '#f59e0b',
    region: 'global',
    kind: 'chat-image',
    url: 'https://gemini.google.com',
    bestFor: 'Nano Banana 图像编辑、人物一致性、场景改图',
    quotaHint: '网页登录额度以官方页面为准',
    workflowHint: '复制 Prompt 后在 Gemini 中生成或编辑图片。'
  }
];
