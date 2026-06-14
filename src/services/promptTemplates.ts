import { readStorageValue, writeStorageValue } from './safeStorage';

export type PromptTemplateCategory =
  | 'commercial-poster'
  | 'ecommerce'
  | 'character'
  | 'game-asset'
  | 'icon-ui'
  | 'social-cover'
  | 'image-to-image'
  | 'free-platform'
  | 'style';

export interface PromptTemplate {
  id: string;
  title: string;
  category: PromptTemplateCategory;
  tone: string;
  prompt: string;
  tags: string[];
  description?: string;
  variables?: string[];
  favorite?: boolean;
  custom?: boolean;
  createdAt?: string;
  updatedAt?: string;
  lastUsedAt?: string;
  usedCount?: number;
}

export const PROMPT_TEMPLATE_CATEGORIES: Array<{ value: 'all' | PromptTemplateCategory; label: string }> = [
  { value: 'all', label: '全部模板' },
  { value: 'commercial-poster', label: '商业海报' },
  { value: 'ecommerce', label: '电商主图' },
  { value: 'character', label: '角色设定' },
  { value: 'game-asset', label: '游戏资产' },
  { value: 'icon-ui', label: '图标 UI' },
  { value: 'social-cover', label: '社媒封面' },
  { value: 'image-to-image', label: '图生图改写' },
  { value: 'free-platform', label: '免费平台专用' },
  { value: 'style', label: '风格探索' }
];

export const DEFAULT_PROMPT_TEMPLATES: PromptTemplate[] = [
  {
    id: 'commercial-launch-kv',
    title: '新品发布 KV',
    category: 'commercial-poster',
    tone: '高级、聚焦、适合发布会和活动主视觉',
    description: '把产品或软件包装成有清晰焦点的发布主视觉。',
    variables: ['主视觉', '核心符号', '配色', '版式', '文字区'],
    tags: ['商业海报', 'KV', '发布', '品牌'],
    prompt:
      '{主视觉}新品发布 KV，核心视觉符号为{核心符号}，{配色}，{版式}，{文字区}清晰预留，干净专业，高级商业海报设计，高清，层次明确'
  },
  {
    id: 'commercial-sale-campaign',
    title: '促销活动主海报',
    category: 'commercial-poster',
    tone: '醒目、有冲击力、适合促销和节日活动',
    description: '适合做限时优惠、节日促销、会员活动等商业活动主图。',
    variables: ['活动主题', '促销信息', '场景氛围', '配色', '行动区'],
    tags: ['商业海报', '促销', '活动', '节日'],
    prompt:
      '{活动主题}促销活动主海报，突出{促销信息}，{场景氛围}，{配色}高识别配色，{行动区}清晰可见，中心主体突出，强视觉冲击，适合电商、社媒和线下物料'
  },
  {
    id: 'commercial-brand-concept',
    title: '品牌概念主视觉',
    category: 'commercial-poster',
    tone: '品牌感、克制、适合长期宣传',
    description: '用于品牌调性升级、品牌故事和概念宣传。',
    variables: ['品牌主体', '品牌符号', '视觉隐喻', '配色', '留白'],
    tags: ['商业海报', '品牌', '概念', '调性'],
    prompt:
      '{品牌主体}品牌概念主视觉，包含{品牌符号}和{视觉隐喻}，{配色}作为品牌主色，{留白}，构图高级克制，适合品牌官网、宣传物料和发布长图'
  },
  {
    id: 'commercial-exhibition-keyart',
    title: '活动展会视觉',
    category: 'commercial-poster',
    tone: '正式、清晰、适合展会和活动页',
    description: '适合会议、展会、公开课、线下活动的主视觉。',
    variables: ['活动主题', '活动场景', '主视觉符号', '信息区', '风格'],
    tags: ['商业海报', '活动', '展会', '会议'],
    prompt:
      '{活动主题}活动展会主视觉，位于{活动场景}，主视觉符号为{主视觉符号}，{信息区}预留清楚，整体{风格}，信息层级清楚，适合活动海报和落地页头图'
  },
  {
    id: 'ecommerce-premium-main',
    title: '高转化电商主图',
    category: 'ecommerce',
    tone: '干净、可信、适合商品首图',
    description: '突出商品材质、卖点和平台首图识别度。',
    variables: ['产品', '卖点', '使用场景', '材质', '背景'],
    tags: ['电商', '主图', '产品', '高转化'],
    prompt:
      '{产品}高转化电商主图，突出{卖点}，放入{使用场景}，强调{材质}，使用{背景}，产品居中占据视觉主体，柔和棚拍布光，自然阴影，适合电商平台首图'
  },
  {
    id: 'ecommerce-lifestyle-scene',
    title: '场景化商品图',
    category: 'ecommerce',
    tone: '真实、有使用感、适合生活方式商品',
    description: '把商品放进真实使用场景，增强购买想象。',
    variables: ['产品', '使用场景', '人群/动作', '光线', '氛围'],
    tags: ['电商', '场景图', '生活方式', '商品'],
    prompt:
      '{产品}场景化商品图，放置在{使用场景}中，加入{人群/动作}，使用{光线}，整体{氛围}，产品清晰可辨，环境干净可信，突出商品用途和生活方式价值'
  },
  {
    id: 'ecommerce-sellpoint-board',
    title: '卖点展示主图',
    category: 'ecommerce',
    tone: '清晰、信息化、适合详情页首屏',
    description: '适合展示成分、结构、功能卖点和差异化亮点。',
    variables: ['产品', '核心卖点', '材质', '信息模块', '配色'],
    tags: ['电商', '卖点', '详情页', '功能'],
    prompt:
      '{产品}卖点展示主图，突出{核心卖点}，强调{材质}，周围以{信息模块}展示功能、成分或使用效果，{配色}清爽配色，视觉干净，卖点一眼可读'
  },
  {
    id: 'ecommerce-premium-packshot',
    title: '高级棚拍产品图',
    category: 'ecommerce',
    tone: '高级、质感、适合品牌商品',
    description: '偏品牌广告感的产品棚拍图，突出材质和溢价感。',
    variables: ['产品', '材质', '承托面', '布光', '镜头'],
    tags: ['电商', '棚拍', '质感', '产品摄影'],
    prompt:
      '{产品}高级棚拍产品图，突出{材质}，放置在{承托面}，使用{布光}，{镜头}，边缘高光精致，柔和阴影，反射控制干净，整体有品牌广告摄影质感'
  },
  {
    id: 'character-design-sheet',
    title: '角色设定稿',
    category: 'character',
    tone: '清晰、可开发、适合角色外观探索',
    description: '用于角色概念、立绘前期和设定方向统一。',
    variables: ['角色', '姿态', '服装/装备', '性格', '画风'],
    tags: ['角色', '设定', '立绘', '游戏'],
    prompt:
      '{角色}角色设定稿，展示{姿态}和关键结构，{服装/装备}细节清楚，体现{性格}，整体为{画风}，背景简洁，适合后续立绘和建模参考'
  },
  {
    id: 'character-fullbody-turnaround',
    title: '角色全身三视图',
    category: 'character',
    tone: '规范、可交付、适合建模和立绘前期',
    description: '用于角色正面、侧面、背面结构统一。',
    variables: ['角色', '三视图要求', '服装/装备', '配色', '画风'],
    tags: ['角色', '三视图', '全身', '设定'],
    prompt:
      '{角色}角色全身三视图，{三视图要求}，{服装/装备}结构清楚，{配色}统一，整体{画风}，白色或浅色背景，适合建模、立绘和动画参考'
  },
  {
    id: 'character-portrait-card',
    title: '角色头像卡',
    category: 'character',
    tone: '精致、有记忆点、适合头像和角色卡',
    description: '适合做角色头像、抽卡头像、角色介绍卡。',
    variables: ['角色', '表情', '发型/服饰', '背景', '镜头'],
    tags: ['角色', '头像', '角色卡', '立绘'],
    prompt:
      '{角色}角色头像卡，{表情}清晰，有强记忆点，{发型/服饰}精致，{背景}简洁但有氛围，使用{镜头}，适合游戏角色卡、社媒头像和角色介绍页'
  },
  {
    id: 'character-outfit-variants',
    title: '角色服装方案',
    category: 'character',
    tone: '多方案、时装感、适合角色造型探索',
    description: '为同一角色探索不同服装方向。',
    variables: ['角色', '服装方向', '配色', '配饰', '画风'],
    tags: ['角色', '服装', '造型', '方案'],
    prompt:
      '{角色}角色服装方案，保持身份特征一致，提供 3 套{服装方向}，{配色}作为主色系，展示{配饰}和材质差异，整体{画风}，适合角色造型探索'
  },
  {
    id: 'game-item-icon',
    title: '游戏道具图标',
    category: 'game-asset',
    tone: '强识别、干净、适合背包和商店 UI',
    description: '用于道具、装备、技能和资源图标。',
    variables: ['道具', '轮廓', '材质', '特效', '背景'],
    tags: ['游戏资产', '图标', '道具', 'UI'],
    prompt:
      '{道具}游戏道具图标，{轮廓}，{材质}质感明确，带有{特效}，置于{背景}，居中构图，边缘高光清晰，小尺寸下仍易识别，适合游戏背包和商店 UI'
  },
  {
    id: 'game-skill-effect-icon',
    title: '技能特效图标',
    category: 'game-asset',
    tone: '能量感、强识别、适合技能栏',
    description: '用于技能、法术、状态效果等图标。',
    variables: ['技能', '能量颜色', '特效形态', '爆点', '背景'],
    tags: ['游戏资产', '技能', '特效', '图标'],
    prompt:
      '{技能}技能特效图标，{能量颜色}能量轨迹清晰，{特效形态}，中心{爆点}明确，置于{背景}，轮廓强，小尺寸下可读，适合 RPG、卡牌、动作游戏技能栏'
  },
  {
    id: 'game-prop-concept-board',
    title: '游戏道具设定板',
    category: 'game-asset',
    tone: '设定清楚、材质明确、适合资产生产',
    description: '用于武器、装备、道具的概念设定图。',
    variables: ['道具', '画风', '材质', '细节', '比例参考'],
    tags: ['游戏资产', '道具', '设定板', '武器'],
    prompt:
      '{道具}游戏道具设定板，整体{画风}，强调{材质}，包含{细节}、主视图和{比例参考}，背景干净，适合后续建模、绘制和资产生产'
  },
  {
    id: 'game-reward-card',
    title: '奖励卡片资产',
    category: 'game-asset',
    tone: '游戏感、可复用、适合活动和结算',
    description: '适合奖励弹窗、活动奖励、任务结算卡片。',
    variables: ['奖励物', '稀有度', '边框', '光效', '用途'],
    tags: ['游戏资产', '奖励', '卡片', '活动'],
    prompt:
      '{奖励物}游戏奖励卡片，表现{稀有度}，使用{边框}，中央奖励物清晰，加入{光效}，适合{用途}，卡片层级明确，可复用 UI 边框'
  },
  {
    id: 'app-icon-ui',
    title: '软件图标概念',
    category: 'icon-ui',
    tone: '简洁、现代、适合应用图标和功能图标',
    description: '用于软件图标、功能按钮和轻量 UI 资产。',
    variables: ['应用主题', '核心符号', '图形风格', '主色', '底板'],
    tags: ['图标', 'UI', '软件', '品牌'],
    prompt:
      '{应用主题}软件图标概念，以{核心符号}作为视觉中心，{图形风格}，{主色}主色，使用{底板}，几何结构清晰，无多余文字，适合桌面软件和 AI 工具品牌图标'
  },
  {
    id: 'ui-feature-icon-set',
    title: '功能图标组',
    category: 'icon-ui',
    tone: '统一、清晰、适合软件功能入口',
    description: '为一组软件功能生成统一风格图标。',
    variables: ['功能组', '图标隐喻', '线条风格', '主色', '使用场景'],
    tags: ['图标', 'UI', '图标组', '功能'],
    prompt:
      '{功能组}功能图标组，使用{图标隐喻}，{线条风格}统一，{主色}视觉系统，适合{使用场景}，包含 6 个功能图标，小尺寸下可读'
  },
  {
    id: 'ui-brand-symbol',
    title: '品牌符号图标',
    category: 'icon-ui',
    tone: '简洁、有品牌识别度、适合 Logo 草案',
    description: '用于软件品牌符号、Logo 方向和启动图标。',
    variables: ['品牌主题', '抽象符号', '结构', '主色', '应用场景'],
    tags: ['图标', 'Logo', '品牌', '软件'],
    prompt:
      '{品牌主题}品牌符号图标，以{抽象符号}为核心，{结构}简洁，{主色}主色，适合{应用场景}，抽象但易识别，无文字，无复杂背景'
  },
  {
    id: 'ui-empty-state-illustration',
    title: '空状态插画',
    category: 'icon-ui',
    tone: '轻量、友好、适合产品界面',
    description: '用于软件空状态、引导页和功能缺省提示。',
    variables: ['空状态主题', '场景', '情绪', '配色', '角色/物件'],
    tags: ['UI', '空状态', '插画', '产品'],
    prompt:
      '{空状态主题}空状态插画，位于{场景}，呈现{情绪}，{配色}柔和配色，包含{角色/物件}，图形简洁，留白充足，适合软件空状态和首次引导'
  },
  {
    id: 'social-tutorial-cover',
    title: '教程社媒封面',
    category: 'social-cover',
    tone: '醒目、清晰、适合内容首图',
    description: '用于小红书、B 站、公众号和短视频封面。',
    variables: ['内容主题', '视觉元素', '标题区', '配色', '平台'],
    tags: ['社媒', '封面', '教程', '内容'],
    prompt:
      '{内容主题}教程社媒封面，包含{视觉元素}，{标题区}预留清楚，{配色}主色，适合{平台}，信息层级清晰，强视觉焦点'
  },
  {
    id: 'social-xiaohongshu-cover',
    title: '小红书种草封面',
    category: 'social-cover',
    tone: '清爽、强标题、适合移动端信息流',
    description: '用于小红书笔记、攻略、种草内容封面。',
    variables: ['笔记主题', '种草对象', '场景', '配色', '标题区'],
    tags: ['社媒', '小红书', '封面', '种草'],
    prompt:
      '{笔记主题}小红书封面，突出{种草对象}，{场景}氛围，{配色}清爽配色，{标题区}醒目，主体清晰，适合手机信息流点击'
  },
  {
    id: 'social-video-thumbnail',
    title: '视频平台缩略图',
    category: 'social-cover',
    tone: '强对比、清晰、适合 B 站和视频号',
    description: '用于教程、测评、演示类视频缩略图。',
    variables: ['视频主题', '核心人物/物体', '情绪', '配色', '标题关键词'],
    tags: ['社媒', '视频封面', 'B站', '缩略图'],
    prompt:
      '{视频主题}视频缩略图，突出{核心人物/物体}，整体{情绪}，{配色}高对比配色，预留{标题关键词}，画面清晰，适合 B 站、视频号和 YouTube 缩略图'
  },
  {
    id: 'social-article-header',
    title: '公众号文章头图',
    category: 'social-cover',
    tone: '克制、信息清晰、适合长文开头',
    description: '用于公众号、博客、知识文章的头图。',
    variables: ['文章主题', '视觉隐喻', '配色', '信息层级', '风格'],
    tags: ['社媒', '公众号', '文章头图', '知识'],
    prompt:
      '{文章主题}公众号文章头图，使用{视觉隐喻}，{配色}低噪配色，{信息层级}轻量清晰，整体{风格}，适合知识文章、教程、产品更新和长文开头配图'
  },
  {
    id: 'image-to-image-redesign',
    title: '图生图结构保留改写',
    category: 'image-to-image',
    tone: '保留主体、升级质感、适合参考图重绘',
    description: '基于参考图保留构图与主体，改变风格和完成度。',
    variables: ['保留内容', '改写方向', '提升重点', '避免事项', '风格'],
    tags: ['图生图', '重绘', '参考图', '改写'],
    prompt:
      '基于参考图进行图生图改写，{保留内容}，改写为{改写方向}，重点提升{提升重点}，{避免事项}，整体{风格}，画面自然统一，保留原始识别度'
  },
  {
    id: 'image-to-image-style-transfer',
    title: '图生图风格迁移',
    category: 'image-to-image',
    tone: '保留构图、改变画风、适合风格实验',
    description: '把参考图转换成指定风格，同时尽量保留主体和布局。',
    variables: ['保留内容', '目标风格', '主色调', '质感提升', '避免事项'],
    tags: ['图生图', '风格迁移', '参考图', '重绘'],
    prompt:
      '基于参考图进行风格迁移，{保留内容}，转换为{目标风格}，使用{主色调}，增强{质感提升}，{避免事项}，不改变主体身份和核心结构'
  },
  {
    id: 'image-to-image-product-upgrade',
    title: '产品图质感升级',
    category: 'image-to-image',
    tone: '保留产品、提升光影和商业质感',
    description: '用于把普通商品图升级成更专业的商业图。',
    variables: ['产品', '保留内容', '场景', '布光', '质感'],
    tags: ['图生图', '产品图', '质感升级', '电商'],
    prompt:
      '基于参考图升级{产品}产品图，{保留内容}，放入{场景}，使用{布光}，增强{质感}，适合商业展示和电商主图'
  },
  {
    id: 'image-to-image-character-consistency',
    title: '角色一致性重绘',
    category: 'image-to-image',
    tone: '身份一致、动作变化、适合角色系列图',
    description: '保持角色身份特征，生成不同动作或场景。',
    variables: ['角色', '保留特征', '新场景', '动作/镜头', '画风'],
    tags: ['图生图', '角色一致性', '系列图', '重绘'],
    prompt:
      '基于参考图保持{角色}角色身份一致，保留{保留特征}，切换到{新场景}，使用{动作/镜头}，整体{画风}，不要改变角色核心特征'
  },
  {
    id: 'free-platform-cn-natural',
    title: '中文平台自然描述',
    category: 'free-platform',
    tone: '自然语言、中文友好、适合豆包 / 即梦 / 可灵',
    description: '给网页平台使用的短句式中文 Prompt。',
    variables: ['画面主体', '动作/状态', '场景', '风格', '补充细节'],
    tags: ['免费平台', '中文', '即梦', '豆包', '可灵'],
    prompt:
      '请在网页平台生成一张图片：画面中是{画面主体}，{动作/状态}，位于{场景}，整体是{风格}，加入{补充细节}，画面干净，主体明确，构图自然'
  },
  {
    id: 'free-platform-short-direct',
    title: '网页平台短 Prompt',
    category: 'free-platform',
    tone: '短句、直接、适合限制较多的平台',
    description: '适合网页平台输入框较短或不适合复杂结构时使用。',
    variables: ['画面主体', '场景', '风格', '光影', '画质'],
    tags: ['免费平台', '短 Prompt', '网页平台', '中文'],
    prompt:
      '{画面主体}，{场景}，{风格}，{光影}，{画质}，主体清晰，构图干净，细节丰富'
  },
  {
    id: 'free-platform-i2i-cn',
    title: '网页图生图参考描述',
    category: 'free-platform',
    tone: '清晰、保守、适合网页图生图',
    description: '配合网页平台上传参考图时使用。',
    variables: ['保留内容', '改写风格', '提升重点', '避免事项', '画面要求'],
    tags: ['免费平台', '图生图', '参考图', '中文'],
    prompt:
      '请在网页平台参考上传图片生成：{保留内容}，整体改成{改写风格}，提升{提升重点}，{避免事项}，{画面要求}'
  },
  {
    id: 'free-platform-poster-cn',
    title: '中文平台海报描述',
    category: 'free-platform',
    tone: '中文自然、适合海报类网页生成',
    description: '给国内网页平台生成海报、封面和宣传图。',
    variables: ['海报主题', '主视觉', '配色', '标题区', '背景'],
    tags: ['免费平台', '海报', '中文', '封面'],
    prompt:
      '请在网页平台生成一张{海报主题}宣传海报，主视觉为{主视觉}，{配色}作为主色，{标题区}预留清楚，{背景}干净有层次，适合作为封面或宣传图'
  },
  {
    id: 'style-cinematic-clean',
    title: '电影感干净视觉',
    category: 'style',
    tone: '电影感、克制、高级',
    description: '适合给短 Prompt 增加稳定画面质感。',
    variables: ['画面主体', '场景', '镜头', '光线', '质感'],
    tags: ['风格', '电影感', '光影', '高级'],
    prompt:
      '{画面主体}，位于{场景}，使用{镜头}，{光线}，{质感}，电影级构图，清晰层次，高级色彩控制，画面干净'
  },
  {
    id: 'style-polished-anime',
    title: '精修二次元质感',
    category: 'style',
    tone: '干净、精修、适合角色和头像',
    description: '适合角色、头像、立绘和二次元风格探索。',
    variables: ['角色/主体', '场景', '画风', '配色', '细节'],
    tags: ['风格', '二次元', '精修', '角色'],
    prompt:
      '{角色/主体}，位于{场景}，{画风}，{配色}柔和配色，加入{细节}，线条干净，面部精致，光影通透，高清完成稿'
  },
  {
    id: 'style-minimal-editorial',
    title: '编辑极简视觉',
    category: 'style',
    tone: '极简、留白、适合海报和封面',
    description: '用更少元素获得高级版式和视觉秩序。',
    variables: ['主题', '镜头/构图', '配色', '留白', '信息重点'],
    tags: ['风格', '极简', '编辑设计', '留白'],
    prompt:
      '{主题}，{镜头/构图}，编辑极简视觉，{配色}低饱和配色，{留白}，突出{信息重点}，适合杂志封面、品牌海报和高级内容头图'
  },
  {
    id: 'style-fantasy-atmosphere',
    title: '奇幻氛围视觉',
    category: 'style',
    tone: '氛围感、幻想、适合场景和角色',
    description: '适合幻想题材、游戏场景和角色氛围图。',
    variables: ['主体', '场景', '主光色', '氛围', '故事细节'],
    tags: ['风格', '奇幻', '氛围', '游戏'],
    prompt:
      '{主体}，位于{场景}，{主光色}作为主光色，整体{氛围}，加入{故事细节}，空间层次丰富，光影戏剧化，适合游戏概念图和幻想插画'
  }
];

const DEFAULT_PROMPT_TEMPLATE_BY_ID = new Map(DEFAULT_PROMPT_TEMPLATES.map((template) => [template.id, template]));

const STORAGE_KEY = 'visionhub.prompt.templates';

function normalizeCategory(value: unknown): PromptTemplateCategory {
  const legacyMap: Record<string, PromptTemplateCategory> = {
    portrait: 'character',
    product: 'ecommerce',
    poster: 'commercial-poster',
    scene: 'style',
    style: 'style'
  };
  if (typeof value === 'string') {
    if (PROMPT_TEMPLATE_CATEGORIES.some((item) => item.value === value)) return value as PromptTemplateCategory;
    if (legacyMap[value]) return legacyMap[value];
  }
  return 'style';
}

function extractVariables(prompt: string) {
  return Array.from(new Set(Array.from(prompt.matchAll(/\{([^{}]+)\}/g)).map((match) => match[1].trim()).filter(Boolean)));
}

function normalizeTemplate(value: Partial<PromptTemplate>, index: number): PromptTemplate {
  const prompt = typeof value.prompt === 'string' ? value.prompt : '';
  const now = String(Date.now() + index);
  return {
    id: typeof value.id === 'string' && value.id.trim() ? value.id : `template-${now}`,
    title: typeof value.title === 'string' && value.title.trim() ? value.title.trim() : '未命名模板',
    category: normalizeCategory(value.category),
    tone: typeof value.tone === 'string' ? value.tone : '',
    prompt,
    tags: Array.isArray(value.tags) ? value.tags.filter((tag): tag is string => typeof tag === 'string' && Boolean(tag.trim())) : [],
    description: typeof value.description === 'string' ? value.description : undefined,
    variables: Array.isArray(value.variables) && value.variables.length
      ? value.variables.filter((item): item is string => typeof item === 'string' && Boolean(item.trim()))
      : extractVariables(prompt),
    favorite: Boolean(value.favorite),
    custom: Boolean(value.custom),
    createdAt: typeof value.createdAt === 'string' ? value.createdAt : undefined,
    updatedAt: typeof value.updatedAt === 'string' ? value.updatedAt : undefined,
    lastUsedAt: typeof value.lastUsedAt === 'string' ? value.lastUsedAt : undefined,
    usedCount: typeof value.usedCount === 'number' && Number.isFinite(value.usedCount) ? value.usedCount : 0
  };
}

function hydrateDefaultTemplate(template: PromptTemplate): PromptTemplate {
  if (template.custom) return template;
  const latestDefault = DEFAULT_PROMPT_TEMPLATE_BY_ID.get(template.id);
  if (!latestDefault) return template;
  return {
    ...latestDefault,
    favorite: template.favorite,
    custom: template.custom,
    createdAt: template.createdAt ?? latestDefault.createdAt,
    updatedAt: template.updatedAt ?? latestDefault.updatedAt,
    lastUsedAt: template.lastUsedAt,
    usedCount: template.usedCount
  };
}

function mergeMissingDefaultTemplates(templates: PromptTemplate[]) {
  const savedIds = new Set(templates.map((template) => template.id));
  const missingDefaults = DEFAULT_PROMPT_TEMPLATES.filter((template) => !savedIds.has(template.id));
  return missingDefaults.length ? [...templates, ...missingDefaults] : templates;
}

export function loadPromptTemplates() {
  const raw = readStorageValue(STORAGE_KEY);
  if (!raw) return DEFAULT_PROMPT_TEMPLATES;

  try {
    const saved = JSON.parse(raw) as Partial<PromptTemplate>[];
    if (!Array.isArray(saved) || saved.length === 0) return DEFAULT_PROMPT_TEMPLATES;
    const normalized = saved.map(normalizeTemplate).map(hydrateDefaultTemplate).filter((template) => template.prompt.trim());
    if (!normalized.length) return DEFAULT_PROMPT_TEMPLATES;
    const merged = mergeMissingDefaultTemplates(normalized);
    if (JSON.stringify(saved) !== JSON.stringify(merged.map((template, index) => normalizeTemplate(template, index)))) {
      savePromptTemplates(merged);
    }
    return merged;
  } catch (error) {
    console.warn('[VisionHub] prompt templates parse failed; using defaults', error);
    return DEFAULT_PROMPT_TEMPLATES;
  }
}

export function savePromptTemplates(templates: PromptTemplate[]) {
  writeStorageValue(STORAGE_KEY, JSON.stringify(templates.map(normalizeTemplate)));
}

export function createPromptTemplate(input: Omit<PromptTemplate, 'id' | 'createdAt' | 'updatedAt' | 'variables' | 'custom'> & { id?: string }) {
  const now = String(Date.now());
  return normalizeTemplate({
    ...input,
    id: input.id || `template-${now}`,
    variables: extractVariables(input.prompt),
    custom: true,
    createdAt: now,
    updatedAt: now
  }, 0);
}
