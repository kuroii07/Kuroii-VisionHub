export type PromptAssistMode = 'inspiration' | 'polish' | 'reuse';

export interface InspirationField {
  id: string;
  label: string;
  placeholder: string;
  defaultValue: string;
}

export type InspirationTemplateGroup =
  | 'commercial'
  | 'character'
  | 'product'
  | 'game'
  | 'social'
  | 'image-to-image'
  | 'cn-platform'
  | 'scene';

export interface InspirationTemplate {
  id: string;
  group: InspirationTemplateGroup;
  category: string;
  title: string;
  description: string;
  bestFor: string;
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

export const INSPIRATION_TEMPLATE_FILTERS: Array<{ id: 'all' | InspirationTemplateGroup; label: string }> = [
  { id: 'all', label: '全部' },
  { id: 'commercial', label: '商业 / 海报' },
  { id: 'character', label: '角色' },
  { id: 'product', label: '产品 / 电商' },
  { id: 'game', label: '游戏资产' },
  { id: 'social', label: '社媒' },
  { id: 'image-to-image', label: '图生图' },
  { id: 'cn-platform', label: '中文平台' },
  { id: 'scene', label: '场景' }
];

export const INSPIRATION_TEMPLATES: InspirationTemplate[] = [
  {
    id: 'cinematic-character',
    group: 'character',
    category: '人物肖像',
    title: '电影感角色海报',
    description: '适合角色展示、游戏人物、社媒竖图。',
    bestFor: '角色半身海报、游戏人物 PV 封面、社媒竖图首图。',
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
    group: 'product',
    category: '产品海报',
    title: '高级产品主图',
    description: '适合电商主图、官网首屏、产品视觉。',
    bestFor: '电商主图、官网 hero、产品发布海报和干净商业物料。',
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
    group: 'cn-platform',
    category: '国风视觉',
    title: '国风活动 KV',
    description: '适合节日海报、活动图、中文视觉。',
    bestFor: '中文活动主视觉、节日海报、小红书 / 公众号配图。',
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
    group: 'scene',
    category: '场景概念',
    title: '世界观场景概念',
    description: '适合游戏场景、分镜概念、背景设定。',
    bestFor: '游戏世界观、影视分镜、远景概念图和背景设定。',
    fields: [
      { id: 'place', label: '地点', placeholder: '例如：废土港口', defaultValue: '巨大的废土港口城市' },
      { id: 'time', label: '时间', placeholder: '例如：黄昏', defaultValue: '黄昏时刻' },
      { id: 'detail', label: '细节', placeholder: '例如：飞船残骸', defaultValue: '远处有飞船残骸和机械塔' },
      { id: 'camera', label: '镜头', placeholder: '例如：广角远景', defaultValue: '广角远景镜头' }
    ],
    template:
      '{place}，{time}，{detail}，{camera}，前景有丰富地貌，中景有建筑群，远景有宏大天际线，电影级构图，沉浸式世界观概念图。'
  },
  {
    id: 'commercial-launch-kv',
    group: 'commercial',
    category: '商业海报',
    title: '新品发布 KV',
    description: '适合品牌发布、活动 banner、首屏视觉。',
    bestFor: '品牌新品发布、官网首屏、活动预热和发布会主视觉。',
    fields: [
      { id: 'subject', label: '主视觉', placeholder: '例如：AI 创作软件发布', defaultValue: 'AI 创作软件新品发布主视觉' },
      { id: 'symbol', label: '核心符号', placeholder: '例如：发光窗口、流体图像', defaultValue: '发光窗口与流体图像碎片' },
      { id: 'palette', label: '配色', placeholder: '例如：青绿、深蓝、银白', defaultValue: '青绿、深蓝与银白高光' },
      { id: 'layout', label: '版式', placeholder: '例如：中心构图、留标题区', defaultValue: '中心构图，顶部和右侧预留标题区域' }
    ],
    template:
      '{subject}，核心视觉符号为{symbol}，{palette}，{layout}，高级商业海报设计，层次清晰，主次明确，适合品牌发布 KV，高清，干净专业。'
  },
  {
    id: 'character-design-sheet',
    group: 'character',
    category: '角色设定',
    title: '角色设定三视图',
    description: '适合角色概念、立绘设定和外观探索。',
    bestFor: '角色设定稿、游戏立绘前期、IP 形象探索。',
    fields: [
      { id: 'character', label: '角色', placeholder: '例如：机械猫侦探', defaultValue: '机械猫侦探' },
      { id: 'outfit', label: '服装 / 装备', placeholder: '例如：复古风衣、微型无人机', defaultValue: '复古风衣、机械义眼和微型无人机' },
      { id: 'personality', label: '性格', placeholder: '例如：冷静、聪明', defaultValue: '冷静、聪明、略带神秘感' },
      { id: 'style', label: '画风', placeholder: '例如：游戏美术设定稿', defaultValue: '高质量游戏美术设定稿' }
    ],
    template:
      '{character}角色设定图，展示正面、侧面和背面，{outfit}，体现{personality}，{style}，白色或浅灰背景，结构清晰，比例准确，便于后续建模和立绘制作。'
  },
  {
    id: 'ecommerce-main-image',
    group: 'product',
    category: '电商主图',
    title: '高转化电商主图',
    description: '适合商品详情、平台首图和促销主视觉。',
    bestFor: '淘宝 / 京东 / 小红书商品图、促销首图、产品卖点图。',
    fields: [
      { id: 'product', label: '商品', placeholder: '例如：便携咖啡机', defaultValue: '便携式胶囊咖啡机' },
      { id: 'sellingPoint', label: '卖点', placeholder: '例如：小巧、快速萃取', defaultValue: '小巧便携、快速萃取、金属质感' },
      { id: 'scene', label: '使用场景', placeholder: '例如：办公桌、露营', defaultValue: '现代办公桌与轻户外露营场景' },
      { id: 'tone', label: '调性', placeholder: '例如：干净、高级', defaultValue: '干净高级、可信赖、轻奢商业感' }
    ],
    template:
      '{product}电商主图，突出{sellingPoint}，结合{scene}，整体{tone}，产品占画面主体，背景简洁，光线柔和，阴影自然，适合高转化商品首图。'
  },
  {
    id: 'studio-product-photo',
    group: 'product',
    category: '产品摄影',
    title: '棚拍产品摄影',
    description: '适合写实产品照、材质展示和官网详情。',
    bestFor: '产品摄影、材质细节、官网详情页和品牌物料。',
    fields: [
      { id: 'product', label: '产品', placeholder: '例如：香水瓶', defaultValue: '透明玻璃香水瓶' },
      { id: 'surface', label: '承托面', placeholder: '例如：黑色亚克力台面', defaultValue: '黑色亚克力反光台面' },
      { id: 'light', label: '布光', placeholder: '例如：侧逆光、柔光箱', defaultValue: '侧逆光和大面积柔光箱' },
      { id: 'detail', label: '细节', placeholder: '例如：水珠、金属盖', defaultValue: '瓶身水珠、金属瓶盖和清晰高光边缘' }
    ],
    template:
      '专业棚拍产品摄影，主体为{product}，放置在{surface}，使用{light}，突出{detail}，真实材质，干净背景，浅景深，高级商业摄影，超清细节。'
  },
  {
    id: 'game-item-icon',
    group: 'game',
    category: '游戏资产',
    title: '游戏道具图标',
    description: '适合背包图标、技能图标和装备道具。',
    bestFor: '游戏 UI 图标、背包道具、技能物品、商店图标。',
    fields: [
      { id: 'item', label: '道具', placeholder: '例如：火焰水晶剑', defaultValue: '火焰水晶剑' },
      { id: 'shape', label: '轮廓', placeholder: '例如：清晰剪影', defaultValue: '清晰强识别剪影' },
      { id: 'effect', label: '特效', placeholder: '例如：火焰粒子', defaultValue: '火焰粒子和能量光环' },
      { id: 'background', label: '背景', placeholder: '例如：深色圆角底板', defaultValue: '深色圆角图标底板' }
    ],
    template:
      '{item}游戏道具图标，{shape}，带有{effect}，置于{background}，居中构图，边缘高光清晰，适合游戏背包和商店 UI，高清，干净透明感。'
  },
  {
    id: 'social-cover',
    group: 'social',
    category: '社媒封面',
    title: '社媒内容封面',
    description: '适合小红书、B 站、抖音和公众号首图。',
    bestFor: '社媒封面、教程首图、内容栏目图和短视频封面。',
    fields: [
      { id: 'topic', label: '主题', placeholder: '例如：AI 绘图工作流', defaultValue: 'AI 绘图工作流教程' },
      { id: 'visual', label: '视觉元素', placeholder: '例如：软件界面、图片网格', defaultValue: '软件界面、图片网格和提示词卡片' },
      { id: 'mood', label: '情绪', placeholder: '例如：清晰、专业', defaultValue: '清晰、专业、有学习价值' },
      { id: 'layout', label: '版式', placeholder: '例如：左文右图', defaultValue: '左侧预留标题区，右侧展示视觉主体' }
    ],
    template:
      '{topic}社媒封面，包含{visual}，整体情绪{mood}，{layout}，强视觉焦点，高可读性，适合小红书、B站、抖音和公众号首图，现代设计感。'
  },
  {
    id: 'image-to-image-redesign',
    group: 'image-to-image',
    category: '图生图改写',
    title: '保留结构重新设计',
    description: '适合基于参考图进行风格重绘和局部升级。',
    bestFor: '图生图改写、参考图风格转换、构图保留的二次设计。',
    fields: [
      { id: 'keep', label: '保留', placeholder: '例如：人物姿态和构图', defaultValue: '保留参考图的主体姿态、构图和空间关系' },
      { id: 'change', label: '改写', placeholder: '例如：改成赛博风', defaultValue: '改写为高级赛博未来风格' },
      { id: 'quality', label: '提升', placeholder: '例如：细节、光影', defaultValue: '提升材质细节、光影层次和画面清晰度' },
      { id: 'avoid', label: '避免', placeholder: '例如：不要改变五官', defaultValue: '避免改变主体身份和核心比例' }
    ],
    template:
      '基于参考图进行图生图改写，{keep}，{change}，{quality}，{avoid}，画面自然统一，保留原始识别度，细节更精致，适合二次创作和风格升级。'
  },
  {
    id: 'cn-platform-natural',
    group: 'cn-platform',
    category: '中文平台',
    title: '中文平台通用自然描述',
    description: '适合即梦、豆包、可灵等中文描述型工作流。',
    bestFor: '中文生图平台、自然语言提示词、快速试图和日常创作。',
    fields: [
      { id: 'subject', label: '画面主体', placeholder: '例如：一只橘猫厨师', defaultValue: '一只橘猫厨师' },
      { id: 'action', label: '动作', placeholder: '例如：正在做甜点', defaultValue: '正在温暖的厨房里制作草莓蛋糕' },
      { id: 'style', label: '风格', placeholder: '例如：温馨插画', defaultValue: '温馨治愈的高质量插画风格' },
      { id: 'detail', label: '补充细节', placeholder: '例如：柔和阳光', defaultValue: '柔和阳光、干净背景、细节丰富' }
    ],
    template:
      '画面中是{subject}，{action}，整体为{style}，加入{detail}。构图清晰，主体突出，画面干净，光影自然，适合中文 AI 生图平台直接使用。'
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
