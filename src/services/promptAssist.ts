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
  scope: 'local' | 'provider';
}

export interface PromptStylePreset {
  id: string;
  label: string;
  description: string;
  promptPrefix: string;
}

interface LocalPolishRecipe {
  intent: string;
  subject: string;
  scene: string;
  composition: string;
  lighting: string;
  texture: string;
  color: string;
  quality: string;
  constraints: string;
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

export const LOCAL_POLISH_MODES: PolishMode[] = [
  {
    id: 'standard',
    label: '标准重写',
    description: '把原始想法整理成主体、场景、构图和光影完整的 Prompt。',
    scope: 'local',
    additions: []
  },
  {
    id: 'detail',
    label: '细节扩写',
    description: '显著扩展主体细节、场景层次、材质、光线和画质。',
    scope: 'local',
    additions: []
  },
  {
    id: 'conservative',
    label: '保守润色',
    description: '尽量不改变原意，只补齐生成模型需要的关键画面信息。',
    scope: 'local',
    additions: []
  },
  {
    id: 'cinematic',
    label: '电影感',
    description: '强化镜头、光影、氛围和画面叙事。',
    scope: 'local',
    additions: []
  },
  {
    id: 'poster-kv',
    label: '商业海报',
    description: '适合活动 KV、封面、品牌海报和社媒传播图。',
    scope: 'local',
    additions: []
  },
  {
    id: 'commercial',
    label: '商业视觉',
    description: '兼容旧设置，适合产品图、海报和品牌宣传视觉。',
    scope: 'local',
    additions: []
  },
  {
    id: 'character-design',
    label: '角色设定',
    description: '补全角色身份、外观、服装、姿态、气质和场景关系。',
    scope: 'local',
    additions: []
  },
  {
    id: 'product-photo',
    label: '电商主图',
    description: '强化商品主体、材质、棚拍光、干净背景和商业质感。',
    scope: 'local',
    additions: []
  },
  {
    id: 'image-to-image',
    label: '图生图改写',
    description: '适合配合参考图，明确保留内容和需要改变的方向。',
    scope: 'local',
    additions: []
  },
  {
    id: 'game-asset',
    label: '游戏资产',
    description: '适合图标、道具、角色素材、场景素材等可落地资产。',
    scope: 'local',
    additions: []
  },
  {
    id: 'social-cover',
    label: '社媒封面',
    description: '强化封面焦点、移动端识别度、色彩和传播感。',
    scope: 'local',
    additions: []
  },
  {
    id: 'platform-cn',
    label: '中文平台',
    description: '使用更清晰的中文短句，适合中文生图平台理解。',
    scope: 'local',
    additions: []
  }
];

export const MODEL_POLISH_MODES: PolishMode[] = [
  {
    id: 'smart-expand',
    label: '智能扩写',
    description: '适合很短、笼统的想法，扩写成完整生图提示词。',
    scope: 'provider',
    additions: []
  },
  {
    id: 'conservative',
    label: '保守润色',
    description: '尽量不改变原意，只补齐主体、场景、构图、光影和质量信息。',
    scope: 'provider',
    additions: []
  },
  {
    id: 'pro-image-prompt',
    label: '生图专业版',
    description: '整理为主体、环境、镜头、光线、质感完整的专业 Prompt。',
    scope: 'provider',
    additions: []
  },
  {
    id: 'poster-kv',
    label: '海报/KV',
    description: '面向活动主视觉、封面、品牌海报和社媒传播图。',
    scope: 'provider',
    additions: []
  },
  {
    id: 'character-design',
    label: '角色设定',
    description: '扩写人物/角色外观、服装、姿态、气质和场景。',
    scope: 'provider',
    additions: []
  },
  {
    id: 'product-photo',
    label: '产品摄影/电商',
    description: '强化产品材质、棚拍灯光、背景和商业质感。',
    scope: 'provider',
    additions: []
  },
  {
    id: 'image-to-image',
    label: '图生图改写',
    description: '围绕参考图进行改写，明确保留结构和变化方向。',
    scope: 'provider',
    additions: []
  },
  {
    id: 'game-asset',
    label: '游戏资产',
    description: '适合图标、道具、角色素材、场景素材和可用资产提示词。',
    scope: 'provider',
    additions: []
  },
  {
    id: 'world-scene',
    label: '场景概念图',
    description: '扩写空间层次、世界观细节、氛围和镜头视角。',
    scope: 'provider',
    additions: []
  },
  {
    id: 'ecommerce-detail',
    label: '电商详情图',
    description: '适合商品卖点展示、材质特写和详情页视觉。',
    scope: 'provider',
    additions: []
  },
  {
    id: 'social-cover',
    label: '社媒封面',
    description: '适合小红书、视频封面、头像背景和内容封面图。',
    scope: 'provider',
    additions: []
  }
];

export const PROMPT_STYLE_PRESETS: PromptStylePreset[] = [
  {
    id: 'auto',
    label: '自动/不限定',
    description: '不额外指定画风，按提示词内容和润色模式处理。',
    promptPrefix: ''
  },
  {
    id: 'photorealistic',
    label: '写实摄影',
    description: '真实摄影、自然光、真实材质，适合人物、场景和通用需求。',
    promptPrefix: '写实摄影风格，真实镜头感，自然光线，真实材质，高可信度细节'
  },
  {
    id: 'cinematic',
    label: '电影感',
    description: '电影镜头、叙事氛围、体积光和高完成度画面。',
    promptPrefix: '电影感视觉风格，cinematic lighting，镜头叙事，体积光，浅景深，高级调色'
  },
  {
    id: 'commercial',
    label: '商业广告',
    description: '高级商业视觉、主体突出、干净背景，适合宣传物料。',
    promptPrefix: '商业广告视觉风格，主体突出，干净高级背景，精致布光，品牌质感'
  },
  {
    id: 'product-photo',
    label: '产品摄影',
    description: '棚拍产品图、电商主图、材质和边缘高光清晰。',
    promptPrefix: '产品摄影风格，棚拍布光，干净背景，清晰边缘高光，真实材质，柔和阴影'
  },
  {
    id: 'anime',
    label: '二次元动漫',
    description: '动漫角色、明快线条和高辨识色彩。',
    promptPrefix: '二次元动漫画风，清晰线条，精致角色设计，明快色彩，高完成度插画'
  },
  {
    id: 'chinese-illustration',
    label: '国风插画',
    description: '东方审美、传统纹样、古风角色和国潮视觉。',
    promptPrefix: '国风插画风格，东方审美，传统纹样，细腻线条，雅致配色，国潮视觉'
  },
  {
    id: 'ink-wash',
    label: '水墨国风',
    description: '水墨晕染、留白、宣纸质感和东方意境。',
    promptPrefix: '水墨国风，宣纸质感，墨色层次，留白构图，东方意境，淡雅色彩'
  },
  {
    id: 'watercolor',
    label: '水彩插画',
    description: '轻盈透明、柔和边缘和手绘质感。',
    promptPrefix: '水彩插画风格，透明叠色，柔和边缘，手绘纸张质感，轻盈氛围'
  },
  {
    id: 'oil-painting',
    label: '油画质感',
    description: '厚重笔触、颜料质感和艺术画布效果。',
    promptPrefix: '油画质感，厚重笔触，画布纹理，丰富色层，艺术绘画感'
  },
  {
    id: 'concept-art',
    label: '厚涂概念',
    description: '适合角色、场景、道具和世界观概念图。',
    promptPrefix: '厚涂概念设计风格，体积感强，材质清晰，概念艺术完成度，适合设定图'
  },
  {
    id: 'three-d-render',
    label: '3D 渲染',
    description: '三维建模、真实材质、可控灯光和产品展示感。',
    promptPrefix: '高质量 3D 渲染风格，真实材质，精致模型，干净灯光，清晰体积感'
  },
  {
    id: 'flat-vector',
    label: '扁平矢量',
    description: '简洁图形、清晰边界，适合图标、运营图和信息图。',
    promptPrefix: '扁平矢量插画风格，几何形状，干净边界，简洁配色，高可读性'
  },
  {
    id: 'ui-icon',
    label: 'UI 图标',
    description: '适合软件图标、功能图标和小尺寸识别。',
    promptPrefix: '现代 UI 图标风格，居中构图，简洁轮廓，小尺寸可读，无文字，无水印'
  },
  {
    id: 'game-asset',
    label: '游戏资产',
    description: '适合道具、角色素材、图标和可复用游戏美术。',
    promptPrefix: '游戏资产美术风格，清晰轮廓，居中展示，高可读性，材质统一，干净背景'
  },
  {
    id: 'pixel-art',
    label: '像素艺术',
    description: '像素角色、道具、场景和复古游戏视觉。',
    promptPrefix: '像素艺术风格，清晰像素块，复古游戏视觉，有限色板，高辨识轮廓'
  },
  {
    id: 'line-art',
    label: '线稿漫画',
    description: '黑白线稿、漫画分镜和可上色草图。',
    promptPrefix: '线稿漫画风格，清晰黑白线条，干净轮廓，漫画构图，适合后续上色'
  },
  {
    id: 'cyberpunk',
    label: '赛博朋克',
    description: '霓虹、未来城市、高对比光影和科技感。',
    promptPrefix: '赛博朋克视觉风格，霓虹灯光，未来城市，高对比色彩，科技氛围'
  },
  {
    id: 'retro-film',
    label: '复古胶片',
    description: '胶片颗粒、怀旧色彩和生活化摄影。',
    promptPrefix: '复古胶片摄影风格，柔和颗粒，怀旧色调，自然曝光，真实生活感'
  },
  {
    id: 'minimal-premium',
    label: '极简高级',
    description: '留白、克制配色和高级品牌感。',
    promptPrefix: '极简高级视觉风格，大面积留白，克制配色，干净构图，高级品牌感'
  }
];

export const POLISH_MODES: PolishMode[] = [...LOCAL_POLISH_MODES, ...MODEL_POLISH_MODES];

export function getPolishModesForEngine(engine: 'local' | 'provider') {
  return engine === 'provider' ? MODEL_POLISH_MODES : LOCAL_POLISH_MODES;
}

export function getDefaultPolishMode(engine: 'local' | 'provider') {
  return engine === 'provider' ? MODEL_POLISH_MODES[0].id : LOCAL_POLISH_MODES[1].id;
}

export function resolvePolishMode(modeId: string, engine: 'local' | 'provider') {
  const modes = getPolishModesForEngine(engine);
  return modes.find((mode) => mode.id === modeId) ?? modes.find((mode) => mode.id === getDefaultPolishMode(engine)) ?? modes[0];
}

export function renderInspirationPrompt(template: InspirationTemplate, values: Record<string, string>) {
  return template.template.replace(/\{(\w+)\}/g, (_, key: string) => {
    const field = template.fields.find((item) => item.id === key);
    return (values[key] || field?.defaultValue || '').trim();
  });
}

export function resolvePromptStyle(styleId: string) {
  return PROMPT_STYLE_PRESETS.find((style) => style.id === styleId) ?? PROMPT_STYLE_PRESETS[0];
}

export function applyPromptStyle(source: string, styleId: string) {
  const style = resolvePromptStyle(styleId);
  const base = source.trim();
  if (!style.promptPrefix) return base;
  return `画风/风格：${style.promptPrefix}；原始需求：${base || '一个清晰明确的画面主体'}`;
}

export function polishPrompt(source: string, modeId: string, styleId = 'auto') {
  const base = source.trim();
  const mode = resolvePolishMode(modeId, 'local');
  const subject = normalizePromptSubject(base);
  const recipe = localPolishRecipe(mode.id);
  const style = resolvePromptStyle(styleId);
  return [
    style.promptPrefix ? `风格：${style.promptPrefix}` : null,
    `主体：${subject}，${recipe.subject}`,
    `场景：${recipe.scene}`,
    `构图：${recipe.composition}`,
    `光影：${recipe.lighting}`,
    `材质：${recipe.texture}`,
    `色彩：${recipe.color}`,
    `质量：${recipe.quality}`,
    `约束：${recipe.constraints}`
  ].filter(Boolean).join('；');
}

function normalizePromptSubject(source: string) {
  const cleaned = source
    .replace(/\s+/g, ' ')
    .replace(/[。；;]+$/g, '')
    .trim();
  return cleaned || '一个清晰明确的画面主体';
}

function localPolishRecipe(modeId: string): LocalPolishRecipe {
  const recipes: Record<string, LocalPolishRecipe> = {
    standard: {
      intent: 'standard',
      subject: '主体轮廓清楚，动作或状态明确，避免含混指代',
      scene: '放在与主题匹配的真实环境中，背景有层次但不抢主体',
      composition: '中心或三分法构图，视觉焦点稳定，主体占画面主要位置',
      lighting: '自然主光配合柔和辅光，明暗关系清楚',
      texture: '关键材质和表面细节可见，边缘清晰',
      color: '整体色彩协调，主色和辅助色有区分',
      quality: '高细节，画面干净，适合 AI 图像生成',
      constraints: '保留原始主体和核心意图，不加入冲突元素'
    },
    detail: {
      intent: 'detail',
      subject: '补全外观、姿态、表情或结构细节，让主体更具体可见',
      scene: '前景、中景、远景都有可辨识层次，环境服务主题',
      composition: '明确镜头距离和视角，主体与背景形成清晰空间关系',
      lighting: '主光方向明确，加入高光、阴影和环境光变化',
      texture: '材质纹理、细节边缘、局部装饰和真实质感充分呈现',
      color: '色彩有主次和冷暖关系，氛围统一',
      quality: '精细渲染，高分辨率细节，专业生图提示词',
      constraints: '保留用户指定内容，避免过度添加无关设定'
    },
    conservative: {
      intent: 'conservative',
      subject: '只明确原文已经表达的主体，不改变身份、数量和关键属性',
      scene: '补充最必要的背景信息，让画面成立但不过度扩写',
      composition: '稳定构图，主体清楚，避免夸张镜头',
      lighting: '自然光或柔和棚拍光，保证主体可见',
      texture: '补充基础材质和清晰边缘，不添加复杂装饰',
      color: '保持原文色彩倾向，整体干净统一',
      quality: '清晰、干净、可生成，避免关键词堆砌',
      constraints: '不改变原意，不添加未要求的角色、品牌和文字'
    },
    cinematic: {
      intent: 'cinematic',
      subject: '主体具有明确情绪和叙事动作，画面像电影剧照',
      scene: '环境有故事线索、空气透视和空间纵深',
      composition: '电影镜头语言，低角度或中近景/广角远景可选，视觉焦点强',
      lighting: '体积光、轮廓光、明暗对比和浅景深营造氛围',
      texture: '服装、皮肤、金属、玻璃或环境材质具有真实触感',
      color: '电影级调色，冷暖对比或统一色调，氛围浓郁',
      quality: 'cinematic lighting, depth of field, high detail, dramatic composition',
      constraints: '保留原始主体，不引入具体导演、演员或受版权保护角色'
    },
    'poster-kv': {
      intent: 'poster',
      subject: '主体像主视觉核心元素，轮廓强、识别度高',
      scene: '背景简洁但有层次，能衬托主题并预留标题空间',
      composition: '海报/KV 构图，主体突出，画面上下或侧边可留文案区域',
      lighting: '商业级布光，主体边缘高光清晰，背景不过曝',
      texture: '细节精致，有印刷级或品牌视觉质感',
      color: '高级配色，主色明确，适合传播和封面展示',
      quality: '商业海报质感，高级视觉，清晰焦点，高完成度',
      constraints: '不生成具体文字，不加入真实品牌 Logo'
    },
    commercial: {
      intent: 'commercial',
      subject: '主体突出，展示感明确，适合宣传物料或商业视觉',
      scene: '背景干净、有品牌感，能衬托主体并保持高级质感',
      composition: '商业广告式构图，主体占比清晰，留出干净边距',
      lighting: '棚拍质感主光，轮廓高光和柔和阴影控制清楚',
      texture: '主体材质、皮肤、服装或产品表面细节精致',
      color: '高级配色，主色明确，整体统一',
      quality: '商业级视觉，高完成度，高细节，可用于宣传物料',
      constraints: '不加入未经要求的品牌 Logo、真实商标和小字'
    },
    'character-design': {
      intent: 'character',
      subject: '补全角色身份、年龄感、气质、服装、发型、表情和姿态',
      scene: '背景体现角色世界观，但保持角色为第一视觉焦点',
      composition: '半身或全身角色展示，姿态自然，轮廓易读',
      lighting: '角色轮廓光和面部主光清晰，突出表情与服装细节',
      texture: '服饰面料、配件、道具和皮肤/装甲质感细致',
      color: '角色主色统一，服装与背景形成对比',
      quality: '角色设定图质感，高细节，适合后续图生图或资产延展',
      constraints: '不套用具体 IP 角色，不改变用户指定角色设定'
    },
    'product-photo': {
      intent: 'product',
      subject: '产品形态清晰，卖点区域和轮廓完整可见',
      scene: '干净棚拍或电商主图背景，少量道具衬托产品定位',
      composition: '产品居中或黄金分割摆放，留出干净边距',
      lighting: '柔和棚拍主光，边缘高光、接触阴影和反射控制清楚',
      texture: '材质纹理、金属/玻璃/布料/塑料表面真实可见',
      color: '品牌感配色，背景与产品形成清晰对比',
      quality: '商业摄影，高清细节，干净背景，高级电商主图质感',
      constraints: '不添加未经要求的品牌标识和宣传文字'
    },
    'image-to-image': {
      intent: 'image-to-image',
      subject: '以参考图主体为基础，保留核心轮廓、构图关系和关键身份特征',
      scene: '根据用户描述调整场景、风格或氛围，避免完全偏离参考图',
      composition: '保持参考图主要构图和视角，只优化画面层次与视觉焦点',
      lighting: '在参考图光影基础上增强明暗、轮廓光和整体氛围',
      texture: '保留参考图重要材质特征，同时提升细节和质感',
      color: '延续参考图主色关系，按需求进行风格化或统一调色',
      quality: '图生图改写提示词，参考一致性强，细节更完整',
      constraints: '明确保留参考图核心特征，只改变用户要求改变的部分'
    },
    'game-asset': {
      intent: 'game-asset',
      subject: '主体轮廓适合游戏资产使用，形状清晰、识别度高',
      scene: '背景简洁或透明感构图，便于后续切图、图标或素材复用',
      composition: '居中展示，轮廓完整，避免被裁切，适合小尺寸识别',
      lighting: '高对比边缘光和清晰阴影，增强体积感',
      texture: '材质风格统一，细节可读但不过度杂乱',
      color: '颜色分组明确，适合游戏 UI 或资产库管理',
      quality: 'game asset, clean silhouette, high readability, polished details',
      constraints: '不要文字、Logo、水印，不要复杂背景抢主体'
    },
    'social-cover': {
      intent: 'social',
      subject: '主体第一眼可识别，表情、动作或产品卖点突出',
      scene: '背景信息简洁，移动端缩略图下仍能看清主题',
      composition: '封面式构图，强视觉焦点，预留标题或头像遮挡区域',
      lighting: '明亮清晰，高对比但不过曝',
      texture: '关键细节锐利，背景适度简化',
      color: '醒目但协调，适合社媒流中快速抓住注意力',
      quality: '社媒封面质感，移动端可读，高辨识度，画面干净',
      constraints: '不生成难以阅读的小字，不堆叠过多元素'
    },
    'platform-cn': {
      intent: 'platform-cn',
      subject: '主体明确，身份、动作、外观用清晰中文短句描述',
      scene: '场景、时间、背景元素分开描述，避免抽象空话',
      composition: '构图、景别、视角直接写清楚',
      lighting: '光线方向、氛围、明暗关系明确',
      texture: '材质、细节、画质关键词完整',
      color: '主色、辅助色、整体氛围明确',
      quality: '高清，细节丰富，画面干净，适合中文 AI 生图平台',
      constraints: '逗号分隔，避免长句绕弯，保留原始要求'
    }
  };
  return recipes[modeId] ?? recipes.detail;
}
