export type PromptAssistMode = 'inspiration' | 'polish' | 'reuse';

export interface InspirationField {
  id: string;
  label: string;
  placeholder: string;
  defaultValue: string;
}

export interface InspirationTemplate {
  id: string;
  category: string;
  title: string;
  description: string;
  fields: InspirationField[];
  template: string;
}

export interface PolishMode {
  id: string;
  label: string;
  description: string;
  additions: string[];
}

export const INSPIRATION_TEMPLATES: InspirationTemplate[] = [
  {
    id: 'cinematic-character',
    category: '人物肖像',
    title: '电影感角色海报',
    description: '适合角色展示、游戏人物、社媒竖图。',
    fields: [
      { id: 'subject', label: '主体', placeholder: '例如：赛博女战士', defaultValue: '赛博风格女战士' },
      { id: 'scene', label: '场景', placeholder: '例如：雨夜未来城市', defaultValue: '霓虹闪烁的未来城市街道' },
      { id: 'style', label: '风格', placeholder: '例如：电影感、写实', defaultValue: '电影级写实海报' },
      { id: 'lighting', label: '光线', placeholder: '例如：轮廓光、体积光', defaultValue: '冷暖对比光与轮廓光' }
    ],
    template:
      '一个{subject}，位于{scene}，{style}，{lighting}，半身构图，服装材质细节丰富，背景有浅景深和空气透视，高级商业视觉，高细节，高对比。'
  },
  {
    id: 'premium-product',
    category: '产品海报',
    title: '高级产品主图',
    description: '适合电商主图、官网首屏、产品视觉。',
    fields: [
      { id: 'product', label: '产品', placeholder: '例如：智能耳机', defaultValue: '一款高端智能耳机' },
      { id: 'material', label: '材质', placeholder: '例如：磨砂金属', defaultValue: '磨砂金属与玻璃材质' },
      { id: 'background', label: '背景', placeholder: '例如：浅色渐变', defaultValue: '干净浅色渐变背景' },
      { id: 'mood', label: '氛围', placeholder: '例如：科技、轻奢', defaultValue: '现代科技与轻奢氛围' }
    ],
    template:
      '{product}居中悬浮展示，{material}，{background}，{mood}，柔和阴影，边缘高光清晰，专业棚拍布光，构图简洁，适合商业产品图，高级质感。'
  },
  {
    id: 'chinese-poster',
    category: '国风视觉',
    title: '国风活动 KV',
    description: '适合节日海报、活动图、中文视觉。',
    fields: [
      { id: 'subject', label: '主题', placeholder: '例如：中秋灯会', defaultValue: '中秋主题活动主视觉' },
      { id: 'element', label: '元素', placeholder: '例如：月亮、灯笼', defaultValue: '圆月、灯笼、云纹和山水' },
      { id: 'palette', label: '配色', placeholder: '例如：金色、靛蓝', defaultValue: '靛蓝与暖金配色' },
      { id: 'layout', label: '构图', placeholder: '例如：中心构图', defaultValue: '中心主视觉构图，预留文字区域' }
    ],
    template:
      '{subject}，融合{element}，{palette}，{layout}，东方美学，细腻纹理，层次丰富，适合中文活动海报和社媒传播，高级国风设计。'
  },
  {
    id: 'world-scene',
    category: '场景概念',
    title: '世界观场景概念',
    description: '适合游戏场景、分镜概念、背景设定。',
    fields: [
      { id: 'place', label: '地点', placeholder: '例如：废土港口', defaultValue: '巨大的废土港口城市' },
      { id: 'time', label: '时间', placeholder: '例如：黄昏', defaultValue: '黄昏时刻' },
      { id: 'detail', label: '细节', placeholder: '例如：飞船残骸', defaultValue: '远处有飞船残骸和机械塔' },
      { id: 'camera', label: '镜头', placeholder: '例如：广角远景', defaultValue: '广角远景镜头' }
    ],
    template:
      '{place}，{time}，{detail}，{camera}，前景有丰富地貌，中景有建筑群，远景有宏大天际线，电影级构图，沉浸式世界观概念图。'
  }
];

export const POLISH_MODES: PolishMode[] = [
  {
    id: 'detail',
    label: '更详细',
    description: '补充主体、场景、材质、光线、构图。',
    additions: ['主体细节清晰', '场景层次丰富', '材质真实', '光影自然', '构图稳定', '高细节']
  },
  {
    id: 'cinematic',
    label: '电影感',
    description: '强化镜头、光影、氛围和画面叙事。',
    additions: ['电影级构图', '体积光', '浅景深', '高对比光影', '氛围感强', '视觉焦点明确']
  },
  {
    id: 'commercial',
    label: '商业视觉',
    description: '适合产品图、海报和品牌视觉。',
    additions: ['商业级质感', '主体突出', '干净背景', '高级配色', '可用于宣传物料', '精致细节']
  },
  {
    id: 'platform-cn',
    label: '中文平台',
    description: '更适合中文生图平台理解。',
    additions: ['中文提示词清晰', '避免含混描述', '画面主体明确', '风格关键词完整', '构图要求明确']
  }
];

export function renderInspirationPrompt(template: InspirationTemplate, values: Record<string, string>) {
  return template.template.replace(/\{(\w+)\}/g, (_, key: string) => {
    const field = template.fields.find((item) => item.id === key);
    return (values[key] || field?.defaultValue || '').trim();
  });
}

export function polishPrompt(source: string, modeId: string) {
  const base = source.trim();
  const mode = POLISH_MODES.find((item) => item.id === modeId) ?? POLISH_MODES[0];
  const normalized = base || '一个清晰明确的画面主体';
  return `${normalized}，${mode.additions.join('，')}，画面干净，主题明确，适合 AI 图像生成。`;
}
