import { readStorageValue, writeStorageValue } from './safeStorage';

export type PromptTemplateCategory = 'portrait' | 'product' | 'poster' | 'scene' | 'style';

export interface PromptTemplate {
  id: string;
  title: string;
  category: PromptTemplateCategory;
  tone: string;
  prompt: string;
  tags: string[];
}

export const PROMPT_TEMPLATE_CATEGORIES: Array<{ value: 'all' | PromptTemplateCategory; label: string }> = [
  { value: 'all', label: '全部模板' },
  { value: 'portrait', label: '角色 / 人像' },
  { value: 'product', label: '产品图' },
  { value: 'poster', label: '海报 / KV' },
  { value: 'scene', label: '场景概念' },
  { value: 'style', label: '风格探索' }
];

export const DEFAULT_PROMPT_TEMPLATES: PromptTemplate[] = [
  {
    id: 'portrait-cinematic',
    title: '电影感角色海报',
    category: 'portrait',
    tone: '高级、戏剧化、适合角色展示',
    tags: ['角色', '海报', '电影感', '人像'],
    prompt:
      '一张电影感角色海报，半身构图，主体人物站在暗色背景前，轮廓光清晰，面部细节精致，服装材质高级，背景有轻微烟雾和体积光，画面层次丰富，商业级游戏宣传视觉，高清，强对比，细腻质感'
  },
  {
    id: 'product-premium',
    title: '高级产品主图',
    category: 'product',
    tone: '干净、商业、适合电商和官网',
    tags: ['产品', '电商', '商业', '主图'],
    prompt:
      '高级商业产品主图，产品居中悬浮展示，干净浅色背景，柔和阴影，边缘高光清晰，材质真实，构图简洁，适合官网首屏和电商展示，专业摄影棚布光，高清细节，现代科技感'
  },
  {
    id: 'poster-event',
    title: '活动视觉 KV',
    category: 'poster',
    tone: '强冲击、适合活动宣传',
    tags: ['KV', '活动', '宣传', '海报'],
    prompt:
      '一张高冲击力活动主视觉 KV，中心主体突出，背景包含动感光束、粒子和渐变色块，整体构图有明显视觉焦点，适合社媒宣传和活动 Banner，商业设计感，高清，文字区域预留，现代潮流风格'
  },
  {
    id: 'scene-worldbuilding',
    title: '世界观场景概念',
    category: 'scene',
    tone: '宏大、沉浸、适合概念设定',
    tags: ['场景', '概念', '世界观', '游戏'],
    prompt:
      '宏大的游戏世界观场景概念图，远景构图，前景有细节丰富的地貌，中景有建筑或遗迹，远处有巨大天体或城市轮廓，氛围神秘，光影层次清晰，适合游戏美术设定，电影级构图，超清细节'
  },
  {
    id: 'style-clean-ui',
    title: '干净科技风格探索',
    category: 'style',
    tone: '科技、克制、适合软件视觉',
    tags: ['科技', 'UI', '风格', '概念'],
    prompt:
      '干净克制的现代科技视觉风格，浅色与深色面板结合，玻璃质感卡片，柔和渐变光，细腻描边，信息层级清晰，适合 AI 软件界面和品牌视觉，现代、专业、高级、低噪点'
  }
];

const STORAGE_KEY = 'visionhub.prompt.templates';

export function loadPromptTemplates() {
  const raw = readStorageValue(STORAGE_KEY);
  if (!raw) return DEFAULT_PROMPT_TEMPLATES;

  try {
    const saved = JSON.parse(raw) as PromptTemplate[];
    if (!Array.isArray(saved) || saved.length === 0) return DEFAULT_PROMPT_TEMPLATES;
    return saved;
  } catch (error) {
    console.warn('[VisionHub] prompt templates parse failed; using defaults', error);
    return DEFAULT_PROMPT_TEMPLATES;
  }
}

export function savePromptTemplates(templates: PromptTemplate[]) {
  writeStorageValue(STORAGE_KEY, JSON.stringify(templates));
}
