import {
  Bookmark,
  CheckSquare,
  Copy,
  Database,
  Edit3,
  ExternalLink,
  FolderOpen,
  Grid2X2,
  Grid3x3,
  ImageIcon,
  ImagePlus,
  Link2,
  List,
  Maximize2,
  MoreHorizontal,
  Plus,
  Save,
  Search,
  SlidersHorizontal,
  Sparkles,
  Square,
  Star,
  Trash2,
  Upload,
  X
} from 'lucide-react';
import { memo, useCallback, useEffect, useMemo, useRef, useState, type ClipboardEvent, type DragEvent, type MouseEvent } from 'react';
import type {
  InspirationAsset,
  InspirationCommercialReference,
  InspirationLicenseStatus,
  InspirationRegion,
  InspirationSource,
  InspirationSourceCategory,
  PromptExcerpt,
  PromptExcerptCategory,
  PromptExcerptLanguage
} from '../domain/inspirationTypes';
import {
  deleteInspirationAsset,
  deleteInspirationSource,
  deletePromptExcerpt,
  importInspirationAsset,
  loadInspirationAssets,
  loadInspirationSources,
  loadPromptExcerpts,
  reverseImagePrompt,
  saveInspirationAsset,
  saveInspirationSource,
  savePromptExcerpt
} from '../services/inspirationApi';
import { openExternalUrl } from '../services/desktopApi';
import { defaultEndpointForProtocol, parseExtraHeaders } from '../services/providerConfig';
import { IMAGE_PROMPT_REVERSE_SECRET_ID, type ImagePromptReverseSettings } from '../services/appSettings';
import { StudioSelect } from './StudioSelect';
import type { ConfirmDialogRequest } from './confirmDialog';
import { useToastMessage } from './toast';

type InspirationTab = 'sources' | 'assets' | 'excerpts';
type AssetSourceFilter = 'all' | 'with-source' | 'without-source';
type AssetPromptFilter = 'all' | 'with-inferred' | 'without-inferred';
type AssetShapeFilter = 'all' | 'landscape' | 'portrait' | 'square' | 'wide' | 'tall' | 'four-three' | 'three-four' | 'sixteen-nine' | 'nine-sixteen' | 'custom';
type AssetFormatFilter = 'all' | 'png' | 'jpg' | 'gif' | 'webp' | 'svg' | 'unknown';
type AssetRatingValue = 'unrated' | '1' | '2' | '3' | '4' | '5';
type AssetRatingFilter = 'all' | AssetRatingValue;
type AssetColorFilter = 'all' | 'red' | 'orange' | 'yellow' | 'green' | 'cyan' | 'blue' | 'purple' | 'pink' | 'mono';
type ReversePromptStatus = { assetId: string; message?: string } | null;
type SourceKindFilter = 'all' | 'preset' | 'custom';
type SourceLoginFilter = 'all' | 'requires-login' | 'no-login';
type SourceNavFilter = 'all' | 'preset' | 'custom' | InspirationSourceCategory | InspirationRegion;
type ExcerptSourceFilter = 'all' | 'with-source' | 'without-source';
type ExcerptFavoriteFilter = 'all' | 'favorite';
type ImagePreviewNavigation = {
  items: Array<{ id: string; imageUrl: string; label: string }>;
  currentId: string;
};
type AssetImageMeta = {
  shapeTokens: AssetShapeFilter[];
  colorFamilies: AssetColorFilter[];
  palette: string[];
};

const SOURCE_PRESET_STATS_KEY = 'visionhub.inspiration.sourcePresetStats';
const SOURCE_FAVICON_CACHE_KEY = 'visionhub.inspiration.sourceFaviconCache.v4';
const SOURCE_PRESET_TIMESTAMP = 'preset';
const ASSET_INITIAL_RENDER_COUNT = 48;
const ASSET_RENDER_BATCH_SIZE = 72;
const EXCERPT_INITIAL_RENDER_COUNT = 40;
const EXCERPT_RENDER_BATCH_SIZE = 60;
const SOURCE_FAVICON_DOMAIN_ALIASES: Record<string, string[]> = {
  'jimeng.jianying.com': ['www.jimeng.com', 'jimeng.com'],
  'klingai.kuaishou.com': ['klingai.com', 'www.klingai.com', 'kling.ai'],
  'tongyi.aliyun.com': ['tongyi.aliyun.com', 'www.aliyun.com'],
  'bailian.console.aliyun.com': ['bailian.aliyun.com', 'tongyi.aliyun.com', 'www.aliyun.com'],
  'www.volcengine.com': ['www.volcengine.com', 'volcengine.com'],
  'tusiart.com': ['www.tusiart.com', 'tusiart.com'],
  'modelscope.cn': ['www.modelscope.cn', 'modelscope.cn'],
  'huaban.com': ['huaban.com', 'www.huaban.com'],
  'ibaotu.com': ['ibaotu.com', 'www.ibaotu.com'],
  'www.58pic.com': ['www.58pic.com', '58pic.com'],
  'www.gaoding.com': ['www.gaoding.com', 'gaoding.com'],
  'www.zcool.com.cn': ['www.zcool.com.cn', 'zcool.com.cn'],
  'www.uisdc.com': ['www.uisdc.com', 'uisdc.com']
};

const sourceCategoryOptions: Array<{ value: InspirationSourceCategory | 'all'; label: string }> = [
  { value: 'all', label: '全部类型' },
  { value: 'prompt-template', label: '提示词模板' },
  { value: 'image-gallery', label: '图片灵感' },
  { value: 'model-community', label: '模型社区' },
  { value: 'style-reference', label: '风格参考' },
  { value: 'commercial-design', label: '商业设计' },
  { value: 'other', label: '其他' }
];

const regionOptions: Array<{ value: InspirationRegion | 'all'; label: string }> = [
  { value: 'all', label: '全部地区' },
  { value: 'china', label: '国内' },
  { value: 'global', label: '海外' },
  { value: 'mixed', label: '综合' }
];

const commercialReferenceOptions: Array<{ value: InspirationCommercialReference; label: string }> = [
  { value: 'reference-only', label: '仅作参考' },
  { value: 'user-confirmed', label: '已确认可用' },
  { value: 'unknown', label: '未确认' }
];

const sourceKindOptions: Array<{ value: SourceKindFilter; label: string }> = [
  { value: 'all', label: '全部来源' },
  { value: 'preset', label: '系统预设' },
  { value: 'custom', label: '我的自定义' }
];

const sourceLoginOptions: Array<{ value: SourceLoginFilter; label: string }> = [
  { value: 'all', label: '全部登录' },
  { value: 'requires-login', label: '需要登录' },
  { value: 'no-login', label: '免登录优先' }
];

const sourceCommercialOptions: Array<{ value: InspirationCommercialReference | 'all'; label: string }> = [
  { value: 'all', label: '全部商用' },
  ...commercialReferenceOptions
];

const presetInspirationSources: InspirationSource[] = [
  {
    id: 'preset-liblibai',
    name: 'LiblibAI 哩布哩布',
    url: 'https://www.liblib.art',
    category: 'model-community',
    region: 'china',
    sourceKind: 'preset',
    tags: ['SD', '模型', 'LoRA', '工作流'],
    keywords: ['Stable Diffusion', 'Checkpoint', 'ComfyUI', '国风'],
    note: '国内 AI 模型、工作流和图片灵感社区。',
    sceneNotes: '适合找国风模型、角色模型、工作流示例和中文社区参考。',
    membershipNotes: '部分下载、发布和互动能力需要登录。',
    copyrightNotes: '模型和作品授权以具体作者页面为准，商用前逐条确认。',
    requiresLogin: true,
    commercialReference: 'unknown',
    createdAt: SOURCE_PRESET_TIMESTAMP,
    updatedAt: SOURCE_PRESET_TIMESTAMP
  },
  {
    id: 'preset-tusiart',
    name: '吐司 TusiArt',
    url: 'https://tusiart.com',
    category: 'model-community',
    region: 'china',
    sourceKind: 'preset',
    tags: ['模型', '图片灵感', '工作流'],
    keywords: ['LoRA', 'Checkpoint', 'AI 绘画', '中文提示词'],
    note: '国内 AI 绘画模型与作品社区。',
    sceneNotes: '适合找中文模型、作品参数和风格参考。',
    membershipNotes: '浏览部分内容可直接访问，模型下载和互动通常需要登录。',
    copyrightNotes: '不同模型和作品授权不同，商用前查看作者说明。',
    requiresLogin: true,
    commercialReference: 'unknown',
    createdAt: SOURCE_PRESET_TIMESTAMP,
    updatedAt: SOURCE_PRESET_TIMESTAMP
  },
  {
    id: 'preset-jimeng',
    name: '即梦 AI',
    url: 'https://jimeng.jianying.com',
    category: 'image-gallery',
    region: 'china',
    sourceKind: 'preset',
    tags: ['AI 图片', '视频', '中文创作'],
    keywords: ['即梦', '文生图', '图生图', '短视频'],
    note: '国内 AI 图片和视频创作入口。',
    sceneNotes: '适合参考中文商业图、短视频视觉和平台热门风格。',
    membershipNotes: '创作和保存通常需要登录。',
    copyrightNotes: '平台生成内容的使用边界以平台条款为准。',
    requiresLogin: true,
    commercialReference: 'unknown',
    createdAt: SOURCE_PRESET_TIMESTAMP,
    updatedAt: SOURCE_PRESET_TIMESTAMP
  },
  {
    id: 'preset-kling',
    name: '可灵 AI',
    url: 'https://klingai.kuaishou.com',
    category: 'image-gallery',
    region: 'china',
    sourceKind: 'preset',
    tags: ['AI 视频', 'AI 图片', '灵感'],
    keywords: ['可灵', '视频生成', '图片生成', '镜头'],
    note: 'AI 图像与视频创作平台。',
    sceneNotes: '适合参考视频镜头、商业短片和图像生成案例。',
    membershipNotes: '创作和管理资产需要登录。',
    copyrightNotes: '商用和素材使用以平台条款及素材来源为准。',
    requiresLogin: true,
    commercialReference: 'unknown',
    createdAt: SOURCE_PRESET_TIMESTAMP,
    updatedAt: SOURCE_PRESET_TIMESTAMP
  },
  {
    id: 'preset-tongyi-wanxiang',
    name: '通义万相',
    url: 'https://tongyi.aliyun.com/wanxiang',
    category: 'image-gallery',
    region: 'china',
    sourceKind: 'preset',
    tags: ['AI 图片', '阿里云', '中文'],
    keywords: ['通义万相', '文生图', '图生图', '中文提示词'],
    note: '中文 AI 图像生成与案例参考入口。',
    sceneNotes: '适合参考中文提示词、商业海报和平台能力边界。',
    membershipNotes: '创作功能通常需要登录。',
    copyrightNotes: '生成内容使用以平台条款为准。',
    requiresLogin: true,
    commercialReference: 'unknown',
    createdAt: SOURCE_PRESET_TIMESTAMP,
    updatedAt: SOURCE_PRESET_TIMESTAMP
  },
  {
    id: 'preset-modelscope',
    name: '魔搭社区 ModelScope',
    url: 'https://modelscope.cn',
    category: 'model-community',
    region: 'china',
    sourceKind: 'preset',
    tags: ['模型', '开源', 'AIGC'],
    keywords: ['ModelScope', '模型库', '图像模型', '开源协议'],
    note: '中文模型社区和模型托管平台。',
    sceneNotes: '适合查模型说明、示例、协议和开源项目。',
    membershipNotes: '下载、收藏和发布通常需要登录。',
    copyrightNotes: '按具体模型许可证判断商用和再分发边界。',
    requiresLogin: true,
    commercialReference: 'unknown',
    createdAt: SOURCE_PRESET_TIMESTAMP,
    updatedAt: SOURCE_PRESET_TIMESTAMP
  },
  {
    id: 'preset-volcengine-ark',
    name: '火山方舟',
    url: 'https://www.volcengine.com/product/ark',
    category: 'model-community',
    region: 'china',
    sourceKind: 'preset',
    tags: ['模型服务', 'API', '中转参考'],
    keywords: ['火山方舟', '豆包', '模型广场', 'API'],
    note: '模型服务和模型广场入口。',
    sceneNotes: '适合查看国内模型服务、模型能力和 API 说明。',
    membershipNotes: '控制台、调用和计费需要账号。',
    copyrightNotes: '商用和调用以平台合同、模型条款为准。',
    requiresLogin: true,
    commercialReference: 'unknown',
    createdAt: SOURCE_PRESET_TIMESTAMP,
    updatedAt: SOURCE_PRESET_TIMESTAMP
  },
  {
    id: 'preset-bailian',
    name: '阿里云百炼',
    url: 'https://bailian.console.aliyun.com',
    category: 'model-community',
    region: 'china',
    sourceKind: 'preset',
    tags: ['模型服务', 'API', '应用搭建'],
    keywords: ['百炼', '通义', '模型调用', '控制台'],
    note: '模型调用、应用搭建和模型服务入口。',
    sceneNotes: '适合查模型调用、提示词调试和应用集成路线。',
    membershipNotes: '需要阿里云账号。',
    copyrightNotes: '调用和商用以云服务条款及模型协议为准。',
    requiresLogin: true,
    commercialReference: 'unknown',
    createdAt: SOURCE_PRESET_TIMESTAMP,
    updatedAt: SOURCE_PRESET_TIMESTAMP
  },
  {
    id: 'preset-zcool',
    name: '站酷 ZCOOL',
    url: 'https://www.zcool.com.cn',
    category: 'commercial-design',
    region: 'china',
    sourceKind: 'preset',
    tags: ['设计作品', '视觉参考', '品牌'],
    keywords: ['海报', '包装', '品牌设计', '插画'],
    note: '国内设计师作品和商业视觉参考社区。',
    sceneNotes: '适合找海报、品牌、插画、电商视觉方向。',
    membershipNotes: '浏览公开作品为主，收藏互动需要登录。',
    copyrightNotes: '作品通常仅供参考，未经授权不要直接复用。',
    requiresLogin: false,
    commercialReference: 'reference-only',
    createdAt: SOURCE_PRESET_TIMESTAMP,
    updatedAt: SOURCE_PRESET_TIMESTAMP
  },
  {
    id: 'preset-huaban',
    name: '花瓣',
    url: 'https://huaban.com',
    category: 'style-reference',
    region: 'china',
    sourceKind: 'preset',
    tags: ['灵感板', '图片参考', '设计'],
    keywords: ['Moodboard', '视觉参考', '配色', '版式'],
    note: '图片灵感收集和视觉参考平台。',
    sceneNotes: '适合快速整理风格板、配色和版式方向。',
    membershipNotes: '浏览部分内容可用，收藏和画板管理需要登录。',
    copyrightNotes: '图片来源复杂，默认仅做参考。',
    requiresLogin: false,
    commercialReference: 'reference-only',
    createdAt: SOURCE_PRESET_TIMESTAMP,
    updatedAt: SOURCE_PRESET_TIMESTAMP
  },
  {
    id: 'preset-uisdc',
    name: '优设网',
    url: 'https://www.uisdc.com',
    category: 'commercial-design',
    region: 'china',
    sourceKind: 'preset',
    tags: ['设计教程', '趋势', '资源'],
    keywords: ['UI', '电商', '字体', '设计趋势'],
    note: '设计教程、趋势和资源导航。',
    sceneNotes: '适合查中文设计趋势、教程和工具资源。',
    membershipNotes: '公开内容为主，部分资源可能需要登录或跳转。',
    copyrightNotes: '资源授权以原资源页为准。',
    requiresLogin: false,
    commercialReference: 'reference-only',
    createdAt: SOURCE_PRESET_TIMESTAMP,
    updatedAt: SOURCE_PRESET_TIMESTAMP
  },
  {
    id: 'preset-qiantu',
    name: '千图网',
    url: 'https://www.58pic.com',
    category: 'commercial-design',
    region: 'china',
    sourceKind: 'preset',
    tags: ['设计素材', '电商', '模板'],
    keywords: ['海报', '主图', 'PSD', '模板'],
    note: '商业设计素材和模板平台。',
    sceneNotes: '适合参考电商主图、海报版式和节日活动视觉。',
    membershipNotes: '下载通常需要登录或会员。',
    copyrightNotes: '商用以素材授权和会员权益为准。',
    requiresLogin: true,
    commercialReference: 'unknown',
    createdAt: SOURCE_PRESET_TIMESTAMP,
    updatedAt: SOURCE_PRESET_TIMESTAMP
  },
  {
    id: 'preset-baotu',
    name: '包图网',
    url: 'https://ibaotu.com',
    category: 'commercial-design',
    region: 'china',
    sourceKind: 'preset',
    tags: ['设计素材', '模板', '商用'],
    keywords: ['电商', '海报', '视频模板', 'PPT'],
    note: '设计模板、图片和视频素材平台。',
    sceneNotes: '适合参考商业活动物料、详情页和主视觉。',
    membershipNotes: '下载和授权通常需要会员。',
    copyrightNotes: '商用需按会员授权范围确认。',
    requiresLogin: true,
    commercialReference: 'unknown',
    createdAt: SOURCE_PRESET_TIMESTAMP,
    updatedAt: SOURCE_PRESET_TIMESTAMP
  },
  {
    id: 'preset-gaoding',
    name: '稿定设计',
    url: 'https://www.gaoding.com',
    category: 'commercial-design',
    region: 'china',
    sourceKind: 'preset',
    tags: ['在线设计', '模板', '电商'],
    keywords: ['海报', '电商主图', '社媒图', '模板'],
    note: '在线设计和模板参考平台。',
    sceneNotes: '适合参考中文社媒、电商和营销图模板。',
    membershipNotes: '编辑、保存和部分模板需要登录或会员。',
    copyrightNotes: '模板和素材授权以平台说明为准。',
    requiresLogin: true,
    commercialReference: 'unknown',
    createdAt: SOURCE_PRESET_TIMESTAMP,
    updatedAt: SOURCE_PRESET_TIMESTAMP
  },
  {
    id: 'preset-civitai',
    name: 'Civitai',
    url: 'https://civitai.com',
    category: 'model-community',
    region: 'global',
    sourceKind: 'preset',
    tags: ['SD', '模型', 'LoRA', '图片参数'],
    keywords: ['Checkpoint', 'LoRA', 'Flux', 'Stable Diffusion'],
    note: '海外模型、图片参数和社区资源平台。',
    sceneNotes: '适合找模型、LoRA、生成参数、风格图和社区趋势。',
    membershipNotes: '部分内容、下载和互动需要登录。',
    copyrightNotes: '商用按具体模型许可证和作者说明确认。',
    requiresLogin: true,
    commercialReference: 'unknown',
    createdAt: SOURCE_PRESET_TIMESTAMP,
    updatedAt: SOURCE_PRESET_TIMESTAMP
  },
  {
    id: 'preset-huggingface',
    name: 'Hugging Face',
    url: 'https://huggingface.co',
    category: 'model-community',
    region: 'global',
    sourceKind: 'preset',
    tags: ['模型', '数据集', 'Spaces'],
    keywords: ['Diffusers', 'Transformers', 'Flux', '模型卡'],
    note: '模型、数据集和 Demo 托管社区。',
    sceneNotes: '适合查模型卡、许可证、Demo 和开源项目。',
    membershipNotes: '下载公开模型通常可用，收藏发布和私有资源需要登录。',
    copyrightNotes: '以每个模型或数据集的许可证为准。',
    requiresLogin: false,
    commercialReference: 'unknown',
    createdAt: SOURCE_PRESET_TIMESTAMP,
    updatedAt: SOURCE_PRESET_TIMESTAMP
  },
  {
    id: 'preset-replicate',
    name: 'Replicate',
    url: 'https://replicate.com',
    category: 'model-community',
    region: 'global',
    sourceKind: 'preset',
    tags: ['模型 Demo', 'API', '实验'],
    keywords: ['Model demo', 'API', 'Flux', 'image generation'],
    note: '模型在线 Demo 和 API 示例平台。',
    sceneNotes: '适合快速试看海外模型效果和参数示例。',
    membershipNotes: '运行模型和 API 调用通常需要账号。',
    copyrightNotes: '商用需同时确认模型许可证和平台条款。',
    requiresLogin: true,
    commercialReference: 'unknown',
    createdAt: SOURCE_PRESET_TIMESTAMP,
    updatedAt: SOURCE_PRESET_TIMESTAMP
  },
  {
    id: 'preset-midjourney-showcase',
    name: 'Midjourney Showcase',
    url: 'https://www.midjourney.com/showcase',
    category: 'image-gallery',
    region: 'global',
    sourceKind: 'preset',
    tags: ['Midjourney', '图片灵感', '风格'],
    keywords: ['MJ', 'showcase', 'composition', 'lighting'],
    note: 'Midjourney 官方作品展示入口。',
    sceneNotes: '适合参考构图、质感、镜头语言和高级风格。',
    membershipNotes: '部分浏览和账户功能可能需要登录。',
    copyrightNotes: '作品默认仅作参考，不直接复用。',
    requiresLogin: false,
    commercialReference: 'reference-only',
    createdAt: SOURCE_PRESET_TIMESTAMP,
    updatedAt: SOURCE_PRESET_TIMESTAMP
  },
  {
    id: 'preset-prompthero',
    name: 'PromptHero',
    url: 'https://prompthero.com',
    category: 'prompt-template',
    region: 'global',
    sourceKind: 'preset',
    tags: ['Prompt', 'AI 图片', '搜索'],
    keywords: ['Midjourney prompt', 'Stable Diffusion prompt', 'DALL-E'],
    note: '提示词和 AI 图片案例搜索平台。',
    sceneNotes: '适合按风格、题材和模型找提示词写法。',
    membershipNotes: '浏览为主，收藏和部分功能需要账号。',
    copyrightNotes: '提示词和图片使用边界按原页面说明确认。',
    requiresLogin: false,
    commercialReference: 'reference-only',
    createdAt: SOURCE_PRESET_TIMESTAMP,
    updatedAt: SOURCE_PRESET_TIMESTAMP
  },
  {
    id: 'preset-openart',
    name: 'OpenArt',
    url: 'https://openart.ai',
    category: 'prompt-template',
    region: 'global',
    sourceKind: 'preset',
    tags: ['Prompt', 'AI 图片', '灵感'],
    keywords: ['prompt search', 'image prompt', 'style reference'],
    note: 'AI 图片灵感和提示词平台。',
    sceneNotes: '适合查提示词案例、风格关键词和创作工具。',
    membershipNotes: '创作、收藏和高级功能需要登录。',
    copyrightNotes: '商用以平台条款及具体素材说明为准。',
    requiresLogin: true,
    commercialReference: 'unknown',
    createdAt: SOURCE_PRESET_TIMESTAMP,
    updatedAt: SOURCE_PRESET_TIMESTAMP
  },
  {
    id: 'preset-lexica',
    name: 'Lexica',
    url: 'https://lexica.art',
    category: 'prompt-template',
    region: 'global',
    sourceKind: 'preset',
    tags: ['Prompt', '图片搜索', '风格'],
    keywords: ['prompt search', 'Stable Diffusion', 'visual search'],
    note: 'AI 图片与提示词搜索入口。',
    sceneNotes: '适合从图片反查提示词结构和风格词。',
    membershipNotes: '浏览公开内容为主，账户功能需要登录。',
    copyrightNotes: '默认作为参考，不直接复用他人图片。',
    requiresLogin: false,
    commercialReference: 'reference-only',
    createdAt: SOURCE_PRESET_TIMESTAMP,
    updatedAt: SOURCE_PRESET_TIMESTAMP
  },
  {
    id: 'preset-promptbase',
    name: 'PromptBase',
    url: 'https://promptbase.com',
    category: 'prompt-template',
    region: 'global',
    sourceKind: 'preset',
    tags: ['Prompt 市场', '商业模板', '付费'],
    keywords: ['marketplace', 'prompt template', 'commercial prompt'],
    note: '付费提示词模板市场。',
    sceneNotes: '适合参考商业 Prompt 包装方式和模板分类。',
    membershipNotes: '购买、收藏和发布需要登录。',
    copyrightNotes: '付费提示词授权按购买条款确认。',
    requiresLogin: true,
    commercialReference: 'unknown',
    createdAt: SOURCE_PRESET_TIMESTAMP,
    updatedAt: SOURCE_PRESET_TIMESTAMP
  },
  {
    id: 'preset-flowgpt',
    name: 'FlowGPT',
    url: 'https://flowgpt.com',
    category: 'prompt-template',
    region: 'global',
    sourceKind: 'preset',
    tags: ['Prompt', '文本助手', 'Agent'],
    keywords: ['ChatGPT prompt', 'agent', 'workflow'],
    note: '文本 Prompt、角色和工作流灵感社区。',
    sceneNotes: '适合找文本润色、角色设定和工作流 Prompt 结构。',
    membershipNotes: '互动、收藏和发布需要登录。',
    copyrightNotes: '商用需确认原作者说明和平台条款。',
    requiresLogin: true,
    commercialReference: 'unknown',
    createdAt: SOURCE_PRESET_TIMESTAMP,
    updatedAt: SOURCE_PRESET_TIMESTAMP
  },
  {
    id: 'preset-artstation',
    name: 'ArtStation',
    url: 'https://www.artstation.com',
    category: 'style-reference',
    region: 'global',
    sourceKind: 'preset',
    tags: ['概念设计', '游戏美术', '3D'],
    keywords: ['concept art', 'character design', 'environment art'],
    note: '专业美术、游戏、概念设计作品平台。',
    sceneNotes: '适合参考高质量角色、场景、材质和世界观设计。',
    membershipNotes: '浏览公开作品为主，收藏和关注需要登录。',
    copyrightNotes: '作品版权归作者，默认仅作参考。',
    requiresLogin: false,
    commercialReference: 'reference-only',
    createdAt: SOURCE_PRESET_TIMESTAMP,
    updatedAt: SOURCE_PRESET_TIMESTAMP
  },
  {
    id: 'preset-behance',
    name: 'Behance',
    url: 'https://www.behance.net',
    category: 'commercial-design',
    region: 'global',
    sourceKind: 'preset',
    tags: ['设计作品', '品牌', '视觉系统'],
    keywords: ['branding', 'poster', 'UI design', 'campaign'],
    note: 'Adobe 旗下设计作品展示平台。',
    sceneNotes: '适合参考品牌、广告、电商、UI 和视觉系统案例。',
    membershipNotes: '浏览公开作品为主，收藏互动需要登录。',
    copyrightNotes: '作品默认仅作参考，不直接复用。',
    requiresLogin: false,
    commercialReference: 'reference-only',
    createdAt: SOURCE_PRESET_TIMESTAMP,
    updatedAt: SOURCE_PRESET_TIMESTAMP
  },
  {
    id: 'preset-dribbble',
    name: 'Dribbble',
    url: 'https://dribbble.com',
    category: 'commercial-design',
    region: 'global',
    sourceKind: 'preset',
    tags: ['UI', '插画', '图标'],
    keywords: ['UI', 'illustration', 'icon', 'landing page'],
    note: 'UI、插画和数字产品视觉参考平台。',
    sceneNotes: '适合参考图标、仪表盘、落地页和移动端视觉。',
    membershipNotes: '浏览公开作品为主，收藏和联系设计师需要登录。',
    copyrightNotes: '作品版权归作者，默认仅作参考。',
    requiresLogin: false,
    commercialReference: 'reference-only',
    createdAt: SOURCE_PRESET_TIMESTAMP,
    updatedAt: SOURCE_PRESET_TIMESTAMP
  },
  {
    id: 'preset-pinterest',
    name: 'Pinterest',
    url: 'https://www.pinterest.com',
    category: 'style-reference',
    region: 'global',
    sourceKind: 'preset',
    tags: ['灵感板', '图片参考', 'Moodboard'],
    keywords: ['moodboard', 'color palette', 'composition'],
    note: '全球图片灵感和收藏板平台。',
    sceneNotes: '适合整理视觉情绪板、造型、构图和配色方向。',
    membershipNotes: '完整浏览和收藏通常需要登录。',
    copyrightNotes: '图片来源复杂，默认仅做参考。',
    requiresLogin: true,
    commercialReference: 'reference-only',
    createdAt: SOURCE_PRESET_TIMESTAMP,
    updatedAt: SOURCE_PRESET_TIMESTAMP
  },
  {
    id: 'preset-freepik',
    name: 'Freepik',
    url: 'https://www.freepik.com',
    category: 'commercial-design',
    region: 'global',
    sourceKind: 'preset',
    tags: ['素材', '矢量', '模板'],
    keywords: ['vector', 'mockup', 'PSD', 'stock'],
    note: '图片、矢量、PSD 和模板素材平台。',
    sceneNotes: '适合查商业海报、图标、插画和样机方向。',
    membershipNotes: '下载和高级素材通常需要账号或会员。',
    copyrightNotes: '免费和会员授权不同，商用前确认具体授权。',
    requiresLogin: true,
    commercialReference: 'unknown',
    createdAt: SOURCE_PRESET_TIMESTAMP,
    updatedAt: SOURCE_PRESET_TIMESTAMP
  },
  {
    id: 'preset-envato',
    name: 'Envato Elements',
    url: 'https://elements.envato.com',
    category: 'commercial-design',
    region: 'global',
    sourceKind: 'preset',
    tags: ['素材', '模板', '商业设计'],
    keywords: ['template', 'mockup', 'video template', 'font'],
    note: '订阅制商业素材和模板平台。',
    sceneNotes: '适合参考广告模板、样机、字体和视频包装。',
    membershipNotes: '下载需要订阅账号。',
    copyrightNotes: '商用按订阅授权和项目注册规则确认。',
    requiresLogin: true,
    commercialReference: 'unknown',
    createdAt: SOURCE_PRESET_TIMESTAMP,
    updatedAt: SOURCE_PRESET_TIMESTAMP
  },
  {
    id: 'preset-adobe-stock',
    name: 'Adobe Stock',
    url: 'https://stock.adobe.com',
    category: 'commercial-design',
    region: 'global',
    sourceKind: 'preset',
    tags: ['图库', '商用素材', '模板'],
    keywords: ['stock photo', 'template', 'vector', '3D'],
    note: '商业图库、模板和素材平台。',
    sceneNotes: '适合查商用图库、模板和高级素材方向。',
    membershipNotes: '下载和授权需要 Adobe 账号及额度。',
    copyrightNotes: '商用以 Adobe Stock 授权类型为准。',
    requiresLogin: true,
    commercialReference: 'unknown',
    createdAt: SOURCE_PRESET_TIMESTAMP,
    updatedAt: SOURCE_PRESET_TIMESTAMP
  },
  {
    id: 'preset-canva',
    name: 'Canva',
    url: 'https://www.canva.com',
    category: 'commercial-design',
    region: 'global',
    sourceKind: 'preset',
    tags: ['在线设计', '模板', '社媒'],
    keywords: ['poster', 'social media', 'presentation', 'template'],
    note: '在线设计和模板平台。',
    sceneNotes: '适合参考社媒图、演示文稿、海报和品牌模板。',
    membershipNotes: '编辑、保存和部分模板需要登录或会员。',
    copyrightNotes: '素材商用按 Canva 授权规则确认。',
    requiresLogin: true,
    commercialReference: 'unknown',
    createdAt: SOURCE_PRESET_TIMESTAMP,
    updatedAt: SOURCE_PRESET_TIMESTAMP
  },
  {
    id: 'preset-unsplash',
    name: 'Unsplash',
    url: 'https://unsplash.com',
    category: 'image-gallery',
    region: 'global',
    sourceKind: 'preset',
    tags: ['摄影', '图片素材', '参考'],
    keywords: ['photo', 'lighting', 'composition', 'lifestyle'],
    note: '高质量摄影图片素材平台。',
    sceneNotes: '适合参考摄影构图、光影、生活方式和产品场景。',
    membershipNotes: '下载公开图片通常可用，收藏和账户功能需要登录。',
    copyrightNotes: '仍需按图片和平台授权确认使用边界。',
    requiresLogin: false,
    commercialReference: 'unknown',
    createdAt: SOURCE_PRESET_TIMESTAMP,
    updatedAt: SOURCE_PRESET_TIMESTAMP
  },
  {
    id: 'preset-pexels',
    name: 'Pexels',
    url: 'https://www.pexels.com',
    category: 'image-gallery',
    region: 'global',
    sourceKind: 'preset',
    tags: ['摄影', '视频素材', '参考'],
    keywords: ['photo', 'video', 'stock', 'composition'],
    note: '图片和视频素材参考平台。',
    sceneNotes: '适合找摄影参考、产品场景和真实光影。',
    membershipNotes: '下载公开素材通常可用，收藏需要登录。',
    copyrightNotes: '按平台许可证和具体素材说明确认。',
    requiresLogin: false,
    commercialReference: 'unknown',
    createdAt: SOURCE_PRESET_TIMESTAMP,
    updatedAt: SOURCE_PRESET_TIMESTAMP
  },
  {
    id: 'preset-pixabay',
    name: 'Pixabay',
    url: 'https://pixabay.com',
    category: 'image-gallery',
    region: 'global',
    sourceKind: 'preset',
    tags: ['图片素材', '视频素材', '插画'],
    keywords: ['stock', 'illustration', 'vector', 'video'],
    note: '图片、插画、矢量和视频素材平台。',
    sceneNotes: '适合找基础素材、插画风格和真实场景参考。',
    membershipNotes: '下载公开素材通常可用，高级和账户功能需要登录。',
    copyrightNotes: '按平台许可证和具体素材限制确认。',
    requiresLogin: false,
    commercialReference: 'unknown',
    createdAt: SOURCE_PRESET_TIMESTAMP,
    updatedAt: SOURCE_PRESET_TIMESTAMP
  },
  {
    id: 'preset-polyhaven',
    name: 'Poly Haven',
    url: 'https://polyhaven.com',
    category: 'style-reference',
    region: 'global',
    sourceKind: 'preset',
    tags: ['HDRI', '材质', '3D'],
    keywords: ['HDRI', 'texture', 'model', '3D asset'],
    note: 'HDRI、材质和 3D 资产平台。',
    sceneNotes: '适合参考写实材质、环境光和 3D 场景资产。',
    membershipNotes: '公开资源通常可直接下载。',
    copyrightNotes: '多数资源授权友好，但仍需查看具体许可。',
    requiresLogin: false,
    commercialReference: 'unknown',
    createdAt: SOURCE_PRESET_TIMESTAMP,
    updatedAt: SOURCE_PRESET_TIMESTAMP
  },
  {
    id: 'preset-textures',
    name: 'Textures.com',
    url: 'https://www.textures.com',
    category: 'style-reference',
    region: 'global',
    sourceKind: 'preset',
    tags: ['材质', '贴图', '3D'],
    keywords: ['texture', 'material', 'PBR', 'surface'],
    note: '材质、贴图和 PBR 纹理素材平台。',
    sceneNotes: '适合参考表面质感、写实材质和 3D 贴图方向。',
    membershipNotes: '下载通常需要账号，高清资源可能需要额度或会员。',
    copyrightNotes: '商用按账户权益和素材授权确认。',
    requiresLogin: true,
    commercialReference: 'unknown',
    createdAt: SOURCE_PRESET_TIMESTAMP,
    updatedAt: SOURCE_PRESET_TIMESTAMP
  }
];

const licenseOptions: Array<{ value: InspirationLicenseStatus | 'all'; label: string }> = [
  { value: 'all', label: '全部授权' },
  { value: 'reference-only', label: '仅作参考' },
  { value: 'commercial-confirmed', label: '商用已确认' },
  { value: 'unknown', label: '未确认' }
];

const assetSourceOptions: Array<{ value: AssetSourceFilter; label: string }> = [
  { value: 'all', label: '全部来源' },
  { value: 'with-source', label: '有来源' },
  { value: 'without-source', label: '无来源' }
];

const assetPromptOptions: Array<{ value: AssetPromptFilter; label: string }> = [
  { value: 'all', label: '全部反推' },
  { value: 'with-inferred', label: '已有反推' },
  { value: 'without-inferred', label: '未反推' }
];

const assetShapeOptions: Array<{ value: AssetShapeFilter; label: string }> = [
  { value: 'all', label: '全部形状' },
  { value: 'landscape', label: '横图' },
  { value: 'portrait', label: '竖图' },
  { value: 'square', label: '方形' },
  { value: 'wide', label: '细长横图' },
  { value: 'tall', label: '细长竖图' },
  { value: 'four-three', label: '4:3' },
  { value: 'three-four', label: '3:4' },
  { value: 'sixteen-nine', label: '16:9' },
  { value: 'nine-sixteen', label: '9:16' },
  { value: 'custom', label: '自定义' }
];

const assetFormatOptions: Array<{ value: AssetFormatFilter; label: string }> = [
  { value: 'all', label: '全部格式' },
  { value: 'png', label: 'PNG' },
  { value: 'jpg', label: 'JPG' },
  { value: 'webp', label: 'WebP' },
  { value: 'gif', label: 'GIF' },
  { value: 'svg', label: 'SVG' },
  { value: 'unknown', label: '未知格式' }
];

const assetRatingOptions: Array<{ value: AssetRatingFilter; label: string }> = [
  { value: 'all', label: '全部评分' },
  { value: '5', label: '★★★★★' },
  { value: '4', label: '★★★★☆' },
  { value: '3', label: '★★★☆☆' },
  { value: '2', label: '★★☆☆☆' },
  { value: '1', label: '★☆☆☆☆' },
  { value: 'unrated', label: '尚未评分' }
];

const assetRatingEditOptions = assetRatingOptions.filter((option) => option.value !== 'all') as Array<{ value: AssetRatingValue; label: string }>;

const assetColorOptions: Array<{ value: AssetColorFilter; label: string; color: string }> = [
  { value: 'all', label: '全部颜色', color: '#64748b' },
  { value: 'red', label: '红色', color: '#ef4444' },
  { value: 'orange', label: '橙色', color: '#f97316' },
  { value: 'yellow', label: '黄色', color: '#eab308' },
  { value: 'green', label: '绿色', color: '#22c55e' },
  { value: 'cyan', label: '青色', color: '#06b6d4' },
  { value: 'blue', label: '蓝色', color: '#3b82f6' },
  { value: 'purple', label: '紫色', color: '#8b5cf6' },
  { value: 'pink', label: '粉色', color: '#ec4899' },
  { value: 'mono', label: '黑白', color: '#64748b' }
];


const excerptCategoryOptions: Array<{ value: PromptExcerptCategory | 'all'; label: string }> = [
  { value: 'all', label: '全部类型' },
  { value: 'general', label: '通用 Prompt' },
  { value: 'portrait', label: '人像' },
  { value: 'product', label: '产品' },
  { value: 'scene', label: '场景' },
  { value: 'character', label: '角色' },
  { value: 'poster', label: '海报' },
  { value: 'game-art', label: '游戏美术' },
  { value: 'photography', label: '摄影' },
  { value: 'negative', label: '负面提示词' },
  { value: 'other', label: '其他' }
];

const excerptLanguageOptions: Array<{ value: PromptExcerptLanguage | 'all'; label: string }> = [
  { value: 'all', label: '全部语言' },
  { value: 'auto', label: '自动/未标注' },
  { value: 'zh', label: '中文' },
  { value: 'en', label: '英文' },
  { value: 'ja', label: '日文' },
  { value: 'mixed', label: '混合' }
];

const excerptSourceOptions: Array<{ value: ExcerptSourceFilter; label: string }> = [
  { value: 'all', label: '全部来源' },
  { value: 'with-source', label: '有来源' },
  { value: 'without-source', label: '无来源' }
];

const excerptFavoriteOptions: Array<{ value: ExcerptFavoriteFilter; label: string }> = [
  { value: 'all', label: '全部状态' },
  { value: 'favorite', label: '只看常用' }
];

const emptyExcerptDraft = {
  id: '',
  title: '',
  prompt: '',
  sourceName: '',
  sourceUrl: '',
  language: 'auto' as PromptExcerptLanguage,
  category: 'general' as PromptExcerptCategory,
  tags: '',
  note: '',
  favorite: false,
  createdAt: ''
};

const emptySourceDraft = {
  id: '',
  name: '',
  url: '',
  category: 'prompt-template' as InspirationSourceCategory,
  region: 'mixed' as InspirationRegion,
  sourceKind: 'custom' as const,
  tags: '',
  keywords: '',
  note: '',
  sceneNotes: '',
  membershipNotes: '',
  copyrightNotes: '',
  faviconUrl: '',
  requiresLogin: false,
  commercialReference: 'reference-only' as InspirationCommercialReference,
  createdAt: ''
};

const emptyAssetDraft = {
  title: '',
  sourceUrl: '',
  sourcePlatform: '',
  author: '',
  originalPrompt: '',
  tags: '',
  note: '',
  licenseStatus: 'reference-only' as InspirationLicenseStatus,
  rating: 'unrated' as AssetRatingValue
};

const assetViewOptions: Array<{ value: 'adaptive' | 'square' | 'contain' | 'list'; label: string }> = [
  { value: 'adaptive', label: '自适应' },
  { value: 'square', label: '方图' },
  { value: 'contain', label: '完整图' },
  { value: 'list', label: '列表' }
];

function excerptCategoryLabel(value: PromptExcerptCategory) {
  return excerptCategoryOptions.find((option) => option.value === value)?.label ?? value;
}

function excerptLanguageLabel(value: PromptExcerptLanguage) {
  return excerptLanguageOptions.find((option) => option.value === value)?.label ?? value;
}

function categoryLabel(value: InspirationSourceCategory) {
  return sourceCategoryOptions.find((option) => option.value === value)?.label ?? value;
}

function regionLabel(value: InspirationRegion) {
  return regionOptions.find((option) => option.value === value)?.label ?? value;
}

function sourceKindLabel(value?: InspirationSource['sourceKind']) {
  return value === 'preset' ? '系统预设' : '我的自定义';
}

function commercialReferenceLabel(value: InspirationCommercialReference) {
  return commercialReferenceOptions.find((option) => option.value === value)?.label ?? value;
}

function licenseLabel(value: InspirationLicenseStatus) {
  return licenseOptions.find((option) => option.value === value)?.label ?? value;
}

function getAssetColorLabel(color?: AssetColorFilter) {
  return assetColorOptions.find((option) => option.value === color)?.label ?? '';
}

function parseTags(value: string) {
  return value
    .split(/[，,]/)
    .map((tag) => tag.trim())
    .filter(Boolean)
    .filter((tag, index, array) => array.indexOf(tag) === index);
}

function tagsToText(tags?: string[]) {
  return (tags ?? []).join('，');
}

function formatSourceTime(value?: string) {
  if (!value || value === SOURCE_PRESET_TIMESTAMP) return '未打开';
  const date = new Date(Number(value));
  if (Number.isNaN(date.getTime())) return '未打开';
  return date.toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' });
}

function timestampId(prefix: string) {
  return `${prefix}-${Date.now()}`;
}

function rgbToHex(red: number, green: number, blue: number) {
  return `#${[red, green, blue].map((value) => value.toString(16).padStart(2, '0')).join('')}`;
}

function hexToRgb(hex: string) {
  const normalized = hex.trim().replace(/^#/, '');
  if (!/^[0-9a-f]{6}$/i.test(normalized)) return null;
  return {
    red: Number.parseInt(normalized.slice(0, 2), 16),
    green: Number.parseInt(normalized.slice(2, 4), 16),
    blue: Number.parseInt(normalized.slice(4, 6), 16)
  };
}

function rgbToHsl(red: number, green: number, blue: number) {
  const r = red / 255;
  const g = green / 255;
  const b = blue / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const lightness = (max + min) / 2;
  if (max === min) return { hue: 0, saturation: 0, lightness };
  const delta = max - min;
  const saturation = lightness > 0.5 ? delta / (2 - max - min) : delta / (max + min);
  const hue = max === r
    ? ((g - b) / delta + (g < b ? 6 : 0)) * 60
    : max === g
      ? ((b - r) / delta + 2) * 60
      : ((r - g) / delta + 4) * 60;
  return { hue, saturation, lightness };
}

function getColorFamily(red: number, green: number, blue: number): AssetColorFilter {
  const { hue, saturation, lightness } = rgbToHsl(red, green, blue);
  if (saturation < 0.16 || lightness < 0.16 || lightness > 0.9) return 'mono';
  if (hue < 18 || hue >= 344) return 'red';
  if (hue < 45) return 'orange';
  if (hue < 72) return 'yellow';
  if (hue < 155) return 'green';
  if (hue < 195) return 'cyan';
  if (hue < 250) return 'blue';
  if (hue < 292) return 'purple';
  if (hue < 344) return 'pink';
  return 'mono';
}

function getFilterColorFamilies(filter: AssetColorFilter): AssetColorFilter[] {
  if (filter === 'all') return ['all'];
  if (filter === 'orange') return ['orange', 'red', 'yellow'];
  if (filter === 'cyan') return ['cyan', 'blue', 'green'];
  if (filter === 'purple') return ['purple', 'blue', 'pink'];
  if (filter === 'pink') return ['pink', 'red', 'purple'];
  return [filter];
}

function analyzeImageColors(image: HTMLImageElement) {
  if (!image.naturalWidth || !image.naturalHeight) return null;
  try {
    const canvas = document.createElement('canvas');
    const size = 48;
    canvas.width = size;
    canvas.height = size;
    const context = canvas.getContext('2d', { willReadFrequently: true });
    if (!context) return null;
    context.drawImage(image, 0, 0, size, size);
    const pixels = context.getImageData(0, 0, size, size).data;
    const buckets = new Map<string, { red: number; green: number; blue: number; count: number; score: number }>();
    const familyScores = new Map<AssetColorFilter, number>();
    for (let index = 0; index < pixels.length; index += 4) {
      const alpha = pixels[index + 3];
      if (alpha < 96) continue;
      const red = pixels[index];
      const green = pixels[index + 1];
      const blue = pixels[index + 2];
      const { saturation, lightness } = rgbToHsl(red, green, blue);
      const weight = 0.45 + saturation * 1.3 + (1 - Math.abs(lightness - 0.52)) * 0.45;
      const family = getColorFamily(red, green, blue);
      familyScores.set(family, (familyScores.get(family) ?? 0) + weight);
      const key = `${Math.round(red / 28)}-${Math.round(green / 28)}-${Math.round(blue / 28)}`;
      const current = buckets.get(key) ?? { red: 0, green: 0, blue: 0, count: 0, score: 0 };
      current.red += red;
      current.green += green;
      current.blue += blue;
      current.count += 1;
      current.score += weight;
      buckets.set(key, current);
    }
    const palette = Array.from(buckets.values())
      .sort((left, right) => right.score - left.score)
      .slice(0, 10)
      .map((bucket) => rgbToHex(
        Math.round(bucket.red / bucket.count),
        Math.round(bucket.green / bucket.count),
        Math.round(bucket.blue / bucket.count)
      ));
    const familyEntries = Array.from(familyScores.entries())
      .filter(([family]) => family !== 'all')
      .sort((left, right) => right[1] - left[1]);
    const topFamilyScore = familyEntries[0]?.[1] ?? 0;
    const families = Array.from(new Set([
      ...familyEntries
        .filter(([, score]) => score >= topFamilyScore * 0.14)
        .slice(0, 8)
        .map(([family]) => family),
      ...palette
        .map((hex) => hexToRgb(hex))
        .filter((rgb): rgb is { red: number; green: number; blue: number } => Boolean(rgb))
        .map((rgb) => getColorFamily(rgb.red, rgb.green, rgb.blue))
    ]));
    return palette.length ? { palette, families } : null;
  } catch {
    return null;
  }
}

function ratioClose(left: number, right: number) {
  return Math.abs(left - right) < 0.04;
}

function getShapeTokensFromSize(width: number, height: number): AssetShapeFilter[] {
  if (!width || !height) return ['custom'];
  const ratio = width / height;
  const tokens: AssetShapeFilter[] = ['custom'];
  if (ratioClose(ratio, 1)) tokens.push('square');
  if (ratio > 1.04) tokens.push('landscape');
  if (ratio < 0.96) tokens.push('portrait');
  if (ratio >= 1.9) tokens.push('wide');
  if (ratio <= 0.53) tokens.push('tall');
  if (ratioClose(ratio, 4 / 3)) tokens.push('four-three');
  if (ratioClose(ratio, 3 / 4)) tokens.push('three-four');
  if (ratioClose(ratio, 16 / 9)) tokens.push('sixteen-nine');
  if (ratioClose(ratio, 9 / 16)) tokens.push('nine-sixteen');
  return tokens;
}

function getAssetFormat(asset: InspirationAsset): AssetFormatFilter {
  const source = [
    asset.imageUrl,
    asset.imagePath,
    asset.thumbnailPath,
    asset.sourceUrl,
    asset.title
  ].filter(Boolean).join(' ').toLowerCase();
  const dataUrlMatch = source.match(/data:image\/([^;,]+)/);
  const extensionMatch = source.match(/\.([a-z0-9]+)(?:$|[?#\s])/);
  const rawFormat = dataUrlMatch?.[1] ?? extensionMatch?.[1] ?? '';
  if (rawFormat === 'jpeg' || rawFormat === 'jpg') return 'jpg';
  if (rawFormat === 'png') return 'png';
  if (rawFormat === 'webp') return 'webp';
  if (rawFormat === 'gif') return 'gif';
  if (rawFormat === 'svg' || rawFormat === 'svg+xml') return 'svg';
  return 'unknown';
}

function getTextColorFamilies(asset: InspirationAsset): AssetColorFilter[] {
  const text = [
    asset.title,
    asset.sourcePlatform ?? '',
    asset.author ?? '',
    asset.originalPrompt ?? '',
    asset.inferredPrompt ?? '',
    asset.note ?? '',
    ...asset.tags
  ].join(' ').toLowerCase();
  const entries: Array<{ family: AssetColorFilter; keywords: string[] }> = [
    { family: 'red', keywords: ['red', 'crimson', 'scarlet', '红', '红色', '赤色'] },
    { family: 'orange', keywords: ['orange', 'amber', '橙', '橙色', '琥珀'] },
    { family: 'yellow', keywords: ['yellow', 'gold', 'golden', '黄', '黄色', '金色'] },
    { family: 'green', keywords: ['green', 'emerald', '绿', '绿色', '翠绿'] },
    { family: 'cyan', keywords: ['cyan', 'teal', 'turquoise', '青', '青色', '蓝绿'] },
    { family: 'blue', keywords: ['blue', 'azure', 'navy', '蓝', '蓝色', '海军蓝'] },
    { family: 'purple', keywords: ['purple', 'violet', '紫', '紫色'] },
    { family: 'pink', keywords: ['pink', 'magenta', 'rose', '粉', '粉色', '玫红'] },
    { family: 'mono', keywords: ['black and white', 'monochrome', 'grayscale', '黑白', '单色', '灰度'] }
  ];
  return entries.filter((entry) => entry.keywords.some((keyword) => text.includes(keyword))).map((entry) => entry.family);
}

function colorFamiliesMatchFilter(families: AssetColorFilter[] | undefined, filter: AssetColorFilter) {
  if (filter === 'all') return true;
  if (!families?.length) return false;
  const accepted = new Set(getFilterColorFamilies(filter));
  return families.some((family) => accepted.has(family));
}

function getAssetRating(asset: InspirationAsset) {
  return typeof asset.rating === 'number' && asset.rating >= 1 && asset.rating <= 5 ? asset.rating : undefined;
}

function assetRatingDraft(asset: InspirationAsset): AssetRatingValue {
  const rating = getAssetRating(asset);
  return rating ? String(rating) as AssetRatingValue : 'unrated';
}

function parseAssetRating(value: AssetRatingValue) {
  return value === 'unrated' ? undefined : Number(value);
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error('读取图片失败'));
    reader.readAsDataURL(file);
  });
}

function firstImageFile(files: FileList | File[] | null | undefined) {
  if (!files) return null;
  const array = Array.from(files);
  return array.find((file) => file.type.startsWith('image/')) ?? null;
}

function sourceHostname(url?: string) {
  if (!url) return '';
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}

function sourceFaviconDomain(url?: string) {
  if (!url) return '';
  try {
    return new URL(url).hostname;
  } catch {
    return '';
  }
}

function sourceFaviconCacheKey(source: InspirationSource) {
  const explicitFavicon = source.faviconUrl?.trim();
  const domains = sourceFaviconDomains(source.url);
  return `${source.id}:${explicitFavicon || domains.join('|') || source.url}`;
}

function sourceFaviconDomains(url?: string) {
  const domain = sourceFaviconDomain(url);
  if (!domain) return [];
  const withoutWww = domain.replace(/^www\./, '');
  const withWww = domain.startsWith('www.') ? domain : `www.${domain}`;
  return Array.from(new Set([
    ...(SOURCE_FAVICON_DOMAIN_ALIASES[domain] ?? []),
    domain,
    withoutWww,
    withWww
  ].filter(Boolean)));
}

function sourceFaviconCandidates(source: InspirationSource) {
  const explicitFavicon = source.faviconUrl?.trim();
  const domainUrls = sourceFaviconDomains(source.url).flatMap((domain) => [
    `https://${domain}/favicon.ico`,
    `https://${domain}/favicon.png`,
    `https://${domain}/apple-touch-icon.png`,
    `https://icons.duckduckgo.com/ip3/${domain}.ico`,
    `https://www.google.com/s2/favicons?domain=${domain}&sz=64`,
    `https://icon.horse/icon/${domain}`
  ]);
  return Array.from(new Set([
    explicitFavicon,
    ...domainUrls
  ].filter(Boolean) as string[]));
}

function defaultSourceFaviconUrl(source: InspirationSource) {
  return sourceFaviconCandidates(source)[0] ?? '';
}

function fallbackSourceFaviconUrls(source: InspirationSource) {
  return sourceFaviconCandidates(source).slice(1);
}

function endpointForImageReverseProtocol(protocol: ImagePromptReverseSettings['protocol']) {
  if (protocol === 'gemini-generate-content') return '/v1beta/models/{model}:generateContent';
  if (protocol === 'responses' || protocol === 'chat-completions') return defaultEndpointForProtocol(protocol);
  return '/v1/chat/completions';
}

function reverseSettingLabel(value: string, fallback: string) {
  return value.trim() || fallback;
}

export const InspirationPage = memo(function InspirationPage(props: {
  onPreview: (imageUrl: string, navigation?: ImagePreviewNavigation) => void;
  onUseAsReference: (asset: InspirationAsset) => void;
  onUsePrompt: (prompt: string) => void;
  onCreateTemplate: (title: string, prompt: string, tags: string[]) => string;
  onRequestConfirm: (request: ConfirmDialogRequest) => void;
  imagePromptReverse: ImagePromptReverseSettings;
  imagePromptReverseSecretAvailable: boolean;
  onOpenSettings: () => void;
  importVersion?: number;
}) {
  const [activeTab, setActiveTab] = useState<InspirationTab>('sources');
  const [isAssetTabMounted, setIsAssetTabMounted] = useState(false);
  const [sources, setSources] = useState<InspirationSource[]>([]);
  const [assets, setAssets] = useState<InspirationAsset[]>([]);
  const [excerpts, setExcerpts] = useState<PromptExcerpt[]>([]);
  const [sourcesLoaded, setSourcesLoaded] = useState(false);
  const [assetsLoaded, setAssetsLoaded] = useState(false);
  const [assetsLoading, setAssetsLoading] = useState(false);
  const [excerptsLoaded, setExcerptsLoaded] = useState(false);
  const [excerptsLoading, setExcerptsLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [query, setQuery] = useState('');
  const [sourceCategory, setSourceCategory] = useState<InspirationSourceCategory | 'all'>('all');
  const [sourceRegion, setSourceRegion] = useState<InspirationRegion | 'all'>('all');
  const [sourceKindFilter, setSourceKindFilter] = useState<SourceKindFilter>('all');
  const [sourceLoginFilter, setSourceLoginFilter] = useState<SourceLoginFilter>('all');
  const [sourceCommercialFilter, setSourceCommercialFilter] = useState<InspirationCommercialReference | 'all'>('all');
  const [sourceNavFilter, setSourceNavFilter] = useState<SourceNavFilter>('all');
  const [excerptCategory, setExcerptCategory] = useState<PromptExcerptCategory | 'all'>('all');
  const [excerptLanguage, setExcerptLanguage] = useState<PromptExcerptLanguage | 'all'>('all');
  const [excerptSourceFilter, setExcerptSourceFilter] = useState<ExcerptSourceFilter>('all');
  const [excerptFavoriteFilter, setExcerptFavoriteFilter] = useState<ExcerptFavoriteFilter>('all');
  const [sourceViewMode, setSourceViewMode] = useState<'list' | 'card'>('list');
  const [sourceEditorOpen, setSourceEditorOpen] = useState(false);
  const [sourcePresetStats, setSourcePresetStats] = useState<Record<string, { openCount?: number; lastOpenedAt?: string }>>({});
  const [sourceFaviconCache, setSourceFaviconCache] = useState<Record<string, string | null>>(() => {
    try {
      const raw = localStorage.getItem(SOURCE_FAVICON_CACHE_KEY);
      if (!raw) return {};
      const parsed = JSON.parse(raw) as Record<string, string | null>;
      return Object.fromEntries(
        Object.entries(parsed).filter(([, value]) => value === null || typeof value === 'string')
      );
    } catch {
      return {};
    }
  });
  const [assetLicense, setAssetLicense] = useState<InspirationLicenseStatus | 'all'>('all');
  const [assetSourceFilter, setAssetSourceFilter] = useState<AssetSourceFilter>('all');
  const [assetPromptFilter, setAssetPromptFilter] = useState<AssetPromptFilter>('all');
  const [assetColorFilter, setAssetColorFilter] = useState<AssetColorFilter>('all');
  const [assetShapeFilter, setAssetShapeFilter] = useState<AssetShapeFilter>('all');
  const [assetFormatFilter, setAssetFormatFilter] = useState<AssetFormatFilter>('all');
  const [assetRatingFilter, setAssetRatingFilter] = useState<AssetRatingFilter>('all');
  const [assetColorMenuOpen, setAssetColorMenuOpen] = useState(false);
  const [sourceDraft, setSourceDraft] = useState(emptySourceDraft);
  const [assetDraft, setAssetDraft] = useState(emptyAssetDraft);
  const [excerptDraft, setExcerptDraft] = useState(emptyExcerptDraft);
  const [excerptEditorOpen, setExcerptEditorOpen] = useState(false);
  const [assetEditDraft, setAssetEditDraft] = useState(emptyAssetDraft);
  const [assetFile, setAssetFile] = useState<File | null>(null);
  const [editingAssetId, setEditingAssetId] = useState<string | null>(null);
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [assetViewMode, setAssetViewMode] = useState<'adaptive' | 'square' | 'contain' | 'list'>('adaptive');
  const [selectedAssetIds, setSelectedAssetIds] = useState<string[]>([]);
  const [assetMenuTarget, setAssetMenuTarget] = useState<{ assetId: string; x: number; y: number } | null>(null);
  const [assetSearchVisible, setAssetSearchVisible] = useState(true);
  const [assetFiltersVisible, setAssetFiltersVisible] = useState(true);
  const folderInputRef = useRef<HTMLInputElement | null>(null);
  const assetColorFilterRef = useRef<HTMLLabelElement | null>(null);
  const lastImportVersionRef = useRef(props.importVersion ?? 0);
  const [assetImageMeta, setAssetImageMeta] = useState<Record<string, AssetImageMeta>>({});
  const [renderedAssetCount, setRenderedAssetCount] = useState(ASSET_INITIAL_RENDER_COUNT);
  const [renderedExcerptCount, setRenderedExcerptCount] = useState(EXCERPT_INITIAL_RENDER_COUNT);
  const [reversePromptStatus, setReversePromptStatus] = useState<ReversePromptStatus>(null);
  const [reversePromptError, setReversePromptError] = useState('');
  const pendingAssetImageMetaRef = useRef<Record<string, AssetImageMeta>>({});
  const assetImageMetaFlushRef = useRef<{ timerId: number | null; idleId: number | null }>({ timerId: null, idleId: null });

  useToastMessage(message, setMessage);

  const flushAssetImageMeta = useCallback(() => {
    const patches = pendingAssetImageMetaRef.current;
    pendingAssetImageMetaRef.current = {};
    assetImageMetaFlushRef.current.timerId = null;
    assetImageMetaFlushRef.current.idleId = null;
    const entries = Object.entries(patches);
    if (!entries.length) return;
    setAssetImageMeta((current) => {
      let changed = false;
      const next = { ...current };
      entries.forEach(([assetId, meta]) => {
        const previous = current[assetId];
        if (
          previous &&
          previous.shapeTokens.join('|') === meta.shapeTokens.join('|') &&
          previous.colorFamilies.join('|') === meta.colorFamilies.join('|') &&
          previous.palette.join('|') === meta.palette.join('|')
        ) {
          return;
        }
        next[assetId] = meta;
        changed = true;
      });
      return changed ? next : current;
    });
  }, []);

  const queueAssetImageMeta = useCallback((assetId: string, meta: AssetImageMeta) => {
    pendingAssetImageMetaRef.current[assetId] = meta;
    if (assetImageMetaFlushRef.current.timerId !== null || assetImageMetaFlushRef.current.idleId !== null) return;
    assetImageMetaFlushRef.current.timerId = window.setTimeout(() => {
      assetImageMetaFlushRef.current.timerId = null;
      if ('requestIdleCallback' in window) {
        assetImageMetaFlushRef.current.idleId = window.requestIdleCallback(flushAssetImageMeta, { timeout: 1200 });
        return;
      }
      flushAssetImageMeta();
    }, 180);
  }, [flushAssetImageMeta]);

  useEffect(() => () => {
    if (assetImageMetaFlushRef.current.timerId !== null) {
      window.clearTimeout(assetImageMetaFlushRef.current.timerId);
    }
    if (assetImageMetaFlushRef.current.idleId !== null && 'cancelIdleCallback' in window) {
      window.cancelIdleCallback(assetImageMetaFlushRef.current.idleId);
    }
  }, []);

  useEffect(() => {
    let active = true;
    loadInspirationSources()
      .then((loadedSources) => {
        if (!active) return;
        setSources(loadedSources);
      })
      .catch((error) => {
        if (active) setMessage(error instanceof Error ? error.message : String(error));
      })
      .finally(() => {
        if (active) setSourcesLoaded(true);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (activeTab === 'assets') setIsAssetTabMounted(true);
  }, [activeTab]);

  useEffect(() => {
    if (activeTab !== 'assets' || assetsLoaded) return;
    let active = true;
    setAssetsLoading(true);
    loadInspirationAssets()
      .then((loadedAssets) => {
        if (!active) return;
        setAssets(loadedAssets);
        setAssetsLoaded(true);
      })
      .catch((error) => {
        if (active) setMessage(error instanceof Error ? error.message : String(error));
      })
      .finally(() => {
        if (active) setAssetsLoading(false);
      });
    return () => {
      active = false;
    };
  }, [activeTab, assetsLoaded]);


  useEffect(() => {
    if (activeTab !== 'excerpts' || excerptsLoaded) return;
    let active = true;
    setExcerptsLoading(true);
    loadPromptExcerpts()
      .then((loadedExcerpts) => {
        if (!active) return;
        setExcerpts(loadedExcerpts);
        setExcerptsLoaded(true);
      })
      .catch((error) => {
        if (active) setMessage(error instanceof Error ? error.message : String(error));
      })
      .finally(() => {
        if (active) setExcerptsLoading(false);
      });
    return () => {
      active = false;
    };
  }, [activeTab, excerptsLoaded]);

  useEffect(() => {
    const version = props.importVersion ?? 0;
    if (version === lastImportVersionRef.current) return;
    lastImportVersionRef.current = version;
    let active = true;
    setIsAssetTabMounted(true);
    setAssetsLoading(true);
    loadInspirationAssets()
      .then((loadedAssets) => {
        if (!active) return;
        setAssets(loadedAssets);
        setAssetsLoaded(true);
        setRenderedAssetCount(ASSET_INITIAL_RENDER_COUNT);
      })
      .catch((error) => {
        if (active) setMessage(error instanceof Error ? error.message : String(error));
      })
      .finally(() => {
        if (active) setAssetsLoading(false);
      });
    return () => {
      active = false;
    };
  }, [props.importVersion]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(SOURCE_PRESET_STATS_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as Record<string, { openCount?: number; lastOpenedAt?: string }>;
      setSourcePresetStats(parsed && typeof parsed === 'object' ? parsed : {});
    } catch {
      setSourcePresetStats({});
    }
  }, []);

  useEffect(() => {
    if (!assetColorMenuOpen) return;
    function closeColorMenu(event: globalThis.PointerEvent) {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (assetColorFilterRef.current?.contains(target)) return;
      setAssetColorMenuOpen(false);
    }
    window.addEventListener('pointerdown', closeColorMenu);
    return () => window.removeEventListener('pointerdown', closeColorMenu);
  }, [assetColorMenuOpen]);

  useEffect(() => {
    if (!assetMenuTarget) return;
    function closeAssetContextMenu(event: globalThis.PointerEvent) {
      const target = event.target;
      if (target instanceof Element && target.closest('.libraryContextMenu')) return;
      setAssetMenuTarget(null);
    }
    function closeAssetContextMenuOnEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') setAssetMenuTarget(null);
    }
    window.addEventListener('pointerdown', closeAssetContextMenu);
    window.addEventListener('keydown', closeAssetContextMenuOnEscape);
    return () => {
      window.removeEventListener('pointerdown', closeAssetContextMenu);
      window.removeEventListener('keydown', closeAssetContextMenuOnEscape);
    };
  }, [assetMenuTarget]);

  const normalizedQuery = query.trim().toLowerCase();
  const hasSearchQuery = normalizedQuery.length > 0;
  const allSources = useMemo(() => {
    const customSources = sources.map((source) => ({ ...source, sourceKind: source.sourceKind ?? 'custom' as const }));
    const customUrlSet = new Set(customSources.map((source) => source.url.trim().toLowerCase()).filter(Boolean));
    const presetSources = presetInspirationSources
      .filter((source) => !customUrlSet.has(source.url.trim().toLowerCase()))
      .map((source) => ({
        ...source,
        openCount: sourcePresetStats[source.id]?.openCount ?? source.openCount,
        lastOpenedAt: sourcePresetStats[source.id]?.lastOpenedAt ?? source.lastOpenedAt
      }));
    return [...customSources, ...presetSources];
  }, [sourcePresetStats, sources]);

  const filteredSources = useMemo(() => {
    return allSources
      .filter((source) => {
        const sourceKind = source.sourceKind ?? 'custom';
        const matchesCategory = sourceCategory === 'all' || source.category === sourceCategory;
        const matchesRegion = sourceRegion === 'all' || source.region === sourceRegion;
        const matchesKind = sourceKindFilter === 'all' || sourceKind === sourceKindFilter;
        const matchesLogin =
          sourceLoginFilter === 'all' ||
          (sourceLoginFilter === 'requires-login' ? Boolean(source.requiresLogin) : !source.requiresLogin);
        const matchesCommercial = sourceCommercialFilter === 'all' || source.commercialReference === sourceCommercialFilter;
        const matchesNav =
          sourceNavFilter === 'all' ||
          sourceNavFilter === sourceKind ||
          sourceNavFilter === source.category ||
          sourceNavFilter === source.region;
        const haystack = [
          source.name,
          source.url,
          source.note ?? '',
          source.sceneNotes ?? '',
          source.membershipNotes ?? '',
          source.copyrightNotes ?? '',
          ...source.tags,
          ...(source.keywords ?? [])
        ].join(' ').toLowerCase();
        return matchesCategory && matchesRegion && matchesKind && matchesLogin && matchesCommercial && matchesNav && (!normalizedQuery || haystack.includes(normalizedQuery));
      })
      .sort((left, right) => {
        const leftPinned = left.sourceKind === 'custom' ? 1 : 0;
        const rightPinned = right.sourceKind === 'custom' ? 1 : 0;
        if (leftPinned !== rightPinned) return rightPinned - leftPinned;
        const leftTime = left.lastOpenedAt && left.lastOpenedAt !== SOURCE_PRESET_TIMESTAMP ? Number(left.lastOpenedAt) : 0;
        const rightTime = right.lastOpenedAt && right.lastOpenedAt !== SOURCE_PRESET_TIMESTAMP ? Number(right.lastOpenedAt) : 0;
        if (leftTime !== rightTime) return rightTime - leftTime;
        return left.name.localeCompare(right.name, 'zh-CN');
      });
  }, [allSources, normalizedQuery, sourceCategory, sourceCommercialFilter, sourceKindFilter, sourceLoginFilter, sourceNavFilter, sourceRegion]);


  const recentPromptSource = useMemo(() => {
    return allSources
      .filter((source) => source.category === 'prompt-template')
      .sort((left, right) => Number(right.lastOpenedAt ?? 0) - Number(left.lastOpenedAt ?? 0))[0] ?? null;
  }, [allSources]);

  const excerptSearchIndex = useMemo(() => {
    if (!hasSearchQuery) return null;
    return new Map<string, string>(excerpts.map((excerpt) => [
      excerpt.id,
      [
        excerpt.title,
        excerpt.prompt,
        excerpt.sourceName ?? '',
        excerpt.sourceUrl ?? '',
        excerpt.note ?? '',
        ...excerpt.tags
      ].join(' ').toLowerCase()
    ] as [string, string]));
  }, [excerpts, hasSearchQuery]);

  const assetSearchIndex = useMemo(() => {
    if (!hasSearchQuery) return null;
    return new Map<string, string>(assets.map((asset) => {
      const prompt = asset.originalPrompt || asset.inferredPrompt || '';
      return [
        asset.id,
        [
          asset.title,
          asset.sourceUrl ?? '',
          asset.sourcePlatform ?? '',
          asset.author ?? '',
          prompt,
          asset.note ?? '',
          ...asset.tags
        ].join(' ').toLowerCase()
      ] as [string, string];
    }));
  }, [assets, hasSearchQuery]);

  const filteredExcerpts = useMemo(() => {
    return excerpts
      .filter((excerpt) => {
        const hasSource = Boolean(excerpt.sourceName || excerpt.sourceUrl);
        const matchesCategory = excerptCategory === 'all' || excerpt.category === excerptCategory;
        const matchesLanguage = excerptLanguage === 'all' || excerpt.language === excerptLanguage;
        const matchesSource = excerptSourceFilter === 'all' || (excerptSourceFilter === 'with-source' ? hasSource : !hasSource);
        const matchesFavorite = excerptFavoriteFilter === 'all' || Boolean(excerpt.favorite);
        const matchesQuery = !normalizedQuery || (excerptSearchIndex?.get(excerpt.id)?.includes(normalizedQuery) ?? false);
        return matchesCategory && matchesLanguage && matchesSource && matchesFavorite && matchesQuery;
      })
      .sort((left, right) => Number(right.updatedAt || right.createdAt) - Number(left.updatedAt || left.createdAt));
  }, [excerptCategory, excerptFavoriteFilter, excerptLanguage, excerptSearchIndex, excerptSourceFilter, excerpts, normalizedQuery]);

  const filteredExcerptIdsSignature = useMemo(() => filteredExcerpts.map((excerpt) => excerpt.id).join('|'), [filteredExcerpts]);
  const visibleExcerpts = useMemo(
    () => filteredExcerpts.slice(0, Math.min(renderedExcerptCount, filteredExcerpts.length)),
    [filteredExcerpts, renderedExcerptCount]
  );

  const filteredAssets = useMemo(() => {
    return assets.filter((asset) => {
      const hasSource = Boolean(asset.sourceUrl || asset.sourcePlatform || asset.author);
      const hasInferredPrompt = Boolean(asset.inferredPrompt?.trim());
      const matchesLicense = assetLicense === 'all' || asset.licenseStatus === assetLicense;
      const matchesSource = assetSourceFilter === 'all' || (assetSourceFilter === 'with-source' ? hasSource : !hasSource);
      const matchesPrompt = assetPromptFilter === 'all' || (assetPromptFilter === 'with-inferred' ? hasInferredPrompt : !hasInferredPrompt);
      const meta = assetImageMeta[asset.id];
      const shapeTokens = meta?.shapeTokens ?? ['custom'];
      const format = getAssetFormat(asset);
      const rating = getAssetRating(asset);
      const colorFamilies = meta?.colorFamilies.length ? meta.colorFamilies : getTextColorFamilies(asset);
      const matchesShape = assetShapeFilter === 'all' || shapeTokens.includes(assetShapeFilter);
      const matchesFormat = assetFormatFilter === 'all' || format === assetFormatFilter;
      const matchesRating =
        assetRatingFilter === 'all' ||
        (assetRatingFilter === 'unrated' && !rating) ||
        (assetRatingFilter !== 'unrated' && rating === Number(assetRatingFilter));
      const matchesColor = colorFamiliesMatchFilter(colorFamilies, assetColorFilter);
      const matchesQuery = !normalizedQuery || (assetSearchIndex?.get(asset.id)?.includes(normalizedQuery) ?? false);
      return matchesLicense && matchesSource && matchesPrompt && matchesShape && matchesFormat && matchesRating && matchesColor && matchesQuery;
    });
  }, [assetColorFilter, assetFormatFilter, assetImageMeta, assetLicense, assetPromptFilter, assetRatingFilter, assetSearchIndex, assetShapeFilter, assetSourceFilter, assets, normalizedQuery]);
  const filteredAssetIdsSignature = useMemo(() => filteredAssets.map((asset) => asset.id).join('|'), [filteredAssets]);
  const visibleAssets = useMemo(
    () => filteredAssets.slice(0, Math.min(renderedAssetCount, filteredAssets.length)),
    [filteredAssets, renderedAssetCount]
  );
  const assetPreviewNavigationItems = useMemo(
    () => filteredAssets
      .filter((asset) => Boolean(asset.imageUrl))
      .map((asset) => ({
        id: asset.id,
        imageUrl: asset.imageUrl!,
        label: asset.title || '灵感图片'
      })),
    [filteredAssets]
  );

  const selectedAsset = useMemo(
    () => assets.find((asset) => asset.id === selectedAssetId) ?? null,
    [assets, selectedAssetId]
  );

  const contextAssets = useMemo(() => {
    if (!assetMenuTarget) return [];
    const selected = assets.filter((asset) => selectedAssetIds.includes(asset.id));
    if (selected.some((asset) => asset.id === assetMenuTarget.assetId)) return selected;
    const targetAsset = assets.find((asset) => asset.id === assetMenuTarget.assetId);
    return targetAsset ? [targetAsset] : [];
  }, [assetMenuTarget, assets, selectedAssetIds]);

  function previewAssetFromGallery(asset: InspirationAsset) {
    if (!asset.imageUrl) return;
    props.onPreview(
      asset.imageUrl,
      assetPreviewNavigationItems.length > 1 ? { items: assetPreviewNavigationItems, currentId: asset.id } : undefined
    );
  }
  const sourceNavItems = useMemo(() => {
    const count = (predicate: (source: InspirationSource) => boolean) => allSources.filter(predicate).length;
    return [
      { value: 'all' as SourceNavFilter, label: '全部网站', count: allSources.length },
      { value: 'preset' as SourceNavFilter, label: '系统预设', count: count((source) => source.sourceKind === 'preset') },
      { value: 'custom' as SourceNavFilter, label: '我的自定义', count: count((source) => (source.sourceKind ?? 'custom') === 'custom') },
      { value: 'prompt-template' as SourceNavFilter, label: '提示词', count: count((source) => source.category === 'prompt-template') },
      { value: 'model-community' as SourceNavFilter, label: '模型社区', count: count((source) => source.category === 'model-community') },
      { value: 'image-gallery' as SourceNavFilter, label: '图片灵感', count: count((source) => source.category === 'image-gallery') },
      { value: 'commercial-design' as SourceNavFilter, label: '商业设计', count: count((source) => source.category === 'commercial-design') },
      { value: 'style-reference' as SourceNavFilter, label: '风格/素材', count: count((source) => source.category === 'style-reference') },
      { value: 'china' as SourceNavFilter, label: '国内', count: count((source) => source.region === 'china') },
      { value: 'global' as SourceNavFilter, label: '海外', count: count((source) => source.region === 'global') }
    ];
  }, [allSources]);
  const activeSourceFilterCount = [
    sourceCategory !== 'all',
    sourceRegion !== 'all',
    sourceKindFilter !== 'all',
    sourceLoginFilter !== 'all',
    sourceCommercialFilter !== 'all',
    sourceNavFilter !== 'all'
  ].filter(Boolean).length;
  const activeExcerptFilterCount = [
    excerptCategory !== 'all',
    excerptLanguage !== 'all',
    excerptSourceFilter !== 'all',
    excerptFavoriteFilter !== 'all'
  ].filter(Boolean).length;
  const activeAssetFilterCount = [
    assetSourceFilter !== 'all',
    assetLicense !== 'all',
    assetPromptFilter !== 'all',
    assetColorFilter !== 'all',
    assetShapeFilter !== 'all',
    assetFormatFilter !== 'all',
    assetRatingFilter !== 'all'
  ].filter(Boolean).length;

  useEffect(() => {
    if (activeTab !== 'excerpts') {
      setRenderedExcerptCount(EXCERPT_INITIAL_RENDER_COUNT);
      return;
    }

    const total = filteredExcerpts.length;
    const initialCount = Math.min(EXCERPT_INITIAL_RENDER_COUNT, total);
    setRenderedExcerptCount(initialCount);
    if (total <= initialCount) return;

    let cancelled = false;
    let frameId = 0;
    let nextCount = initialCount;
    const renderNextBatch = () => {
      frameId = window.requestAnimationFrame(() => {
        if (cancelled) return;
        nextCount = Math.min(nextCount + EXCERPT_RENDER_BATCH_SIZE, total);
        setRenderedExcerptCount(nextCount);
        if (nextCount < total) renderNextBatch();
      });
    };

    renderNextBatch();
    return () => {
      cancelled = true;
      if (frameId) window.cancelAnimationFrame(frameId);
    };
  }, [activeTab, filteredExcerptIdsSignature, filteredExcerpts.length]);

  useEffect(() => {
    const total = filteredAssets.length;
    const initialCount = Math.min(ASSET_INITIAL_RENDER_COUNT, total);
    setRenderedAssetCount(initialCount);
    if (total <= initialCount) return;

    let cancelled = false;
    let frameId = 0;
    let nextCount = initialCount;
    const renderNextBatch = () => {
      frameId = window.requestAnimationFrame(() => {
        if (cancelled) return;
        nextCount = Math.min(nextCount + ASSET_RENDER_BATCH_SIZE, total);
        setRenderedAssetCount(nextCount);
        if (nextCount < total) renderNextBatch();
      });
    };

    renderNextBatch();
    return () => {
      cancelled = true;
      if (frameId) window.cancelAnimationFrame(frameId);
    };
  }, [filteredAssetIdsSignature, filteredAssets.length]);


  function resetExcerptDraft() {
    setExcerptDraft(emptyExcerptDraft);
    setExcerptEditorOpen(false);
  }

  function buildExcerptTitle(prompt: string) {
    const compact = prompt.replace(/\s+/g, ' ').trim();
    return compact.slice(0, 32) || '未命名摘录';
  }

  function openExcerptEditor(excerpt?: PromptExcerpt, seed?: Partial<typeof emptyExcerptDraft>) {
    if (excerpt) {
      setExcerptDraft({
        id: excerpt.id,
        title: excerpt.title,
        prompt: excerpt.prompt,
        sourceName: excerpt.sourceName ?? '',
        sourceUrl: excerpt.sourceUrl ?? '',
        language: excerpt.language,
        category: excerpt.category,
        tags: tagsToText(excerpt.tags),
        note: excerpt.note ?? '',
        favorite: Boolean(excerpt.favorite),
        createdAt: excerpt.createdAt
      });
    } else {
      const prompt = seed?.prompt ?? '';
      setExcerptDraft({
        ...emptyExcerptDraft,
        ...seed,
        title: seed?.title || buildExcerptTitle(prompt),
        prompt
      });
    }
    setActiveTab('excerpts');
    setExcerptEditorOpen(true);
  }

  function clearExcerptFilters() {
    setExcerptCategory('all');
    setExcerptLanguage('all');
    setExcerptSourceFilter('all');
    setExcerptFavoriteFilter('all');
    setQuery('');
  }

  async function createExcerptFromClipboard() {
    try {
      const prompt = (await navigator.clipboard?.readText())?.trim() ?? '';
      if (!prompt) {
        setMessage('剪贴板里没有可保存的文本 Prompt。');
        return;
      }
      openExcerptEditor(undefined, {
        prompt,
        title: buildExcerptTitle(prompt),
        sourceName: recentPromptSource?.name ?? '',
        sourceUrl: recentPromptSource?.url ?? '',
        tags: recentPromptSource ? tagsToText(recentPromptSource.tags.slice(0, 4)) : ''
      });
      setMessage('已从剪贴板读取 Prompt，可确认后保存为摘录。');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    }
  }

  async function submitExcerpt() {
    const prompt = excerptDraft.prompt.trim();
    if (!prompt) {
      setMessage('请填写要保存的 Prompt 摘录。');
      return;
    }
    try {
      const now = String(Date.now());
      const previous = excerptDraft.id ? excerpts.find((item) => item.id === excerptDraft.id) : undefined;
      const saved = await savePromptExcerpt({
        id: excerptDraft.id || timestampId('excerpt'),
        title: excerptDraft.title.trim() || buildExcerptTitle(prompt),
        prompt,
        sourceName: excerptDraft.sourceName.trim() || undefined,
        sourceUrl: excerptDraft.sourceUrl.trim() || undefined,
        language: excerptDraft.language,
        category: excerptDraft.category,
        tags: parseTags(excerptDraft.tags),
        note: excerptDraft.note.trim() || undefined,
        favorite: excerptDraft.favorite,
        createdAt: excerptDraft.createdAt || previous?.createdAt || now,
        updatedAt: now,
        lastUsedAt: previous?.lastUsedAt,
        usedCount: previous?.usedCount
      });
      setExcerpts((current) => [saved, ...current.filter((item) => item.id !== saved.id)]);
      setExcerptsLoaded(true);
      resetExcerptDraft();
      setMessage('Prompt 摘录已保存。');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    }
  }

  async function removeExcerpt(excerptId: string) {
    props.onRequestConfirm({
      title: '删除 Prompt 摘录',
      message: '确定删除这条 Prompt 摘录吗？这只会删除摘录记录，不影响模板、作品和图片收藏。',
      confirmLabel: '删除',
      tone: 'danger',
      onConfirm: async () => {
        try {
          await deletePromptExcerpt(excerptId);
          setExcerpts((current) => current.filter((item) => item.id !== excerptId));
          if (excerptDraft.id === excerptId) resetExcerptDraft();
          setMessage('Prompt 摘录已删除。');
        } catch (error) {
          setMessage(error instanceof Error ? error.message : String(error));
          throw error;
        }
      }
    });
  }

  async function markExcerptUsed(excerpt: PromptExcerpt) {
    const now = String(Date.now());
    const saved = await savePromptExcerpt({
      ...excerpt,
      lastUsedAt: now,
      usedCount: (excerpt.usedCount ?? 0) + 1,
      updatedAt: excerpt.updatedAt
    });
    setExcerpts((current) => current.map((item) => (item.id === saved.id ? saved : item)));
  }

  function useExcerpt(excerpt: PromptExcerpt) {
    props.onUsePrompt(excerpt.prompt);
    void markExcerptUsed(excerpt);
  }

  async function copyExcerpt(excerpt: PromptExcerpt) {
    await copyText('Prompt 摘录', excerpt.prompt);
    void markExcerptUsed(excerpt);
  }

  function createTemplateFromExcerpt(excerpt: PromptExcerpt) {
    const result = props.onCreateTemplate(excerpt.title, excerpt.prompt, excerpt.tags);
    void markExcerptUsed(excerpt);
    setMessage(result);
  }

  async function toggleExcerptFavorite(excerpt: PromptExcerpt) {
    try {
      const saved = await savePromptExcerpt({ ...excerpt, favorite: !excerpt.favorite });
      setExcerpts((current) => current.map((item) => (item.id === saved.id ? saved : item)));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    }
  }

  function resetSourceDraft() {
    setSourceDraft(emptySourceDraft);
    setSourceEditorOpen(false);
  }

  function openSourceEditor(source?: InspirationSource) {
    if (source) {
      setSourceDraft({
        id: source.sourceKind === 'preset' ? '' : source.id,
        name: source.name,
        url: source.url,
        category: source.category,
        region: source.region,
        sourceKind: 'custom',
        tags: tagsToText(source.tags),
        keywords: tagsToText(source.keywords),
        note: source.note ?? '',
        sceneNotes: source.sceneNotes ?? '',
        membershipNotes: source.membershipNotes ?? '',
        copyrightNotes: source.copyrightNotes ?? '',
        faviconUrl: source.faviconUrl ?? '',
        requiresLogin: Boolean(source.requiresLogin),
        commercialReference: source.commercialReference,
        createdAt: source.sourceKind === 'preset' ? '' : source.createdAt
      });
    } else {
      setSourceDraft(emptySourceDraft);
    }
    setSourceEditorOpen(true);
  }

  function clearSourceFilters() {
    setSourceCategory('all');
    setSourceRegion('all');
    setSourceKindFilter('all');
    setSourceLoginFilter('all');
    setSourceCommercialFilter('all');
    setSourceNavFilter('all');
    setQuery('');
  }

  function clearAssetFilters() {
    setAssetSourceFilter('all');
    setAssetLicense('all');
    setAssetPromptFilter('all');
    setAssetColorFilter('all');
    setAssetShapeFilter('all');
    setAssetFormatFilter('all');
    setAssetRatingFilter('all');
    setQuery('');
    setAssetColorMenuOpen(false);
  }

  function rememberAssetImageMeta(assetId: string, image: HTMLImageElement) {
    if (assetImageMeta[assetId] || pendingAssetImageMetaRef.current[assetId]) return;
    const colors = analyzeImageColors(image);
    const nextMeta: AssetImageMeta = {
      shapeTokens: getShapeTokensFromSize(image.naturalWidth, image.naturalHeight),
      colorFamilies: colors?.families ?? [],
      palette: colors?.palette ?? []
    };
    queueAssetImageMeta(assetId, nextMeta);
  }

  function updateAssetDraftFromFile(file: File | null) {
    setAssetFile(file);
    if (file && !assetDraft.title.trim()) {
      setAssetDraft((current) => ({ ...current, title: file.name.replace(/\.[^.]+$/, '') }));
    }
  }

  async function submitSource() {
    const name = sourceDraft.name.trim();
    const url = sourceDraft.url.trim();
    if (!name || !url) {
      setMessage('请填写网站名称和 URL。');
      return;
    }
    try {
      const now = String(Date.now());
      const previous = sourceDraft.id ? sources.find((source) => source.id === sourceDraft.id) : undefined;
      const saved = await saveInspirationSource({
        id: sourceDraft.id || timestampId('source'),
        name,
        url,
        category: sourceDraft.category,
        region: sourceDraft.region,
        sourceKind: 'custom',
        tags: parseTags(sourceDraft.tags),
        keywords: parseTags(sourceDraft.keywords),
        note: sourceDraft.note.trim() || undefined,
        sceneNotes: sourceDraft.sceneNotes.trim() || undefined,
        membershipNotes: sourceDraft.membershipNotes.trim() || undefined,
        copyrightNotes: sourceDraft.copyrightNotes.trim() || undefined,
        faviconUrl: sourceDraft.faviconUrl.trim() || undefined,
        requiresLogin: sourceDraft.requiresLogin,
        commercialReference: sourceDraft.commercialReference,
        openCount: previous?.openCount,
        createdAt: sourceDraft.createdAt || previous?.createdAt || now,
        updatedAt: now,
        lastOpenedAt: previous?.lastOpenedAt
      });
      setSources((current) => [saved, ...current.filter((item) => item.id !== saved.id)]);
      resetSourceDraft();
      setMessage('灵感网站已保存。');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    }
  }

  async function openSource(source: InspirationSource) {
    try {
      await openExternalUrl(source.url);
      const now = String(Date.now());
      if (source.sourceKind === 'preset') {
        const nextStats = {
          ...sourcePresetStats,
          [source.id]: {
            openCount: (sourcePresetStats[source.id]?.openCount ?? source.openCount ?? 0) + 1,
            lastOpenedAt: now
          }
        };
        setSourcePresetStats(nextStats);
        localStorage.setItem(SOURCE_PRESET_STATS_KEY, JSON.stringify(nextStats));
        return;
      }
      const saved = await saveInspirationSource({
        ...source,
        sourceKind: 'custom',
        openCount: (source.openCount ?? 0) + 1,
        lastOpenedAt: now
      });
      setSources((current) => current.map((item) => (item.id === saved.id ? saved : item)));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    }
  }

  async function copyText(label: string, value?: string) {
    if (!value) return;
    try {
      await navigator.clipboard?.writeText(value);
      setMessage(`${label} 已复制。`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    }
  }

  function editSource(source: InspirationSource) {
    setActiveTab('sources');
    openSourceEditor(source);
  }

  async function removeSource(sourceId: string) {
    props.onRequestConfirm({
      title: '删除灵感网站',
      message: '确定删除这个灵感网站吗？删除后它会从灵感中心的网站列表中移除。',
      confirmLabel: '删除',
      tone: 'danger',
      onConfirm: async () => {
        try {
          await deleteInspirationSource(sourceId);
          setSources((current) => current.filter((source) => source.id !== sourceId));
          setMessage('灵感网站已删除。');
        } catch (error) {
          setMessage(error instanceof Error ? error.message : String(error));
          throw error;
        }
      }
    });
  }

  async function importAssetFile(file: File, overrides?: Partial<typeof emptyAssetDraft>) {
    setIsImporting(true);
    try {
      const draft = { ...emptyAssetDraft, ...overrides };
      const dataUrl = await fileToDataUrl(file);
      const saved = await importInspirationAsset({
        title: draft.title.trim() || file.name.replace(/\.[^.]+$/, ''),
        dataUrl,
        fileName: file.name,
        sourceUrl: draft.sourceUrl.trim() || undefined,
        sourcePlatform: draft.sourcePlatform.trim() || undefined,
        author: draft.author.trim() || undefined,
        originalPrompt: draft.originalPrompt.trim() || undefined,
        tags: parseTags(draft.tags),
        note: draft.note.trim() || undefined,
        licenseStatus: draft.licenseStatus,
        rating: parseAssetRating(draft.rating)
      });
      setAssets((current) => [saved, ...current]);
      setAssetsLoaded(true);
      setSelectedAssetId(saved.id);
      setAssetDraft(emptyAssetDraft);
      setAssetFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      setMessage('灵感图片已导入。');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setIsImporting(false);
    }
  }

  async function importAsset() {
    if (!assetFile) {
      setMessage('请先选择、拖入或粘贴一张图片。');
      return;
    }
    await importAssetFile(assetFile, assetDraft);
  }

  function handleFileImport(event: React.ChangeEvent<HTMLInputElement>) {
    const files = event.target.files;
    const file = firstImageFile(files);
    if (!file) return;
    void importAssetFile(file);
    event.target.value = '';
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    const file = firstImageFile(event.dataTransfer.files);
    if (!file) {
      setMessage('只支持拖入图片文件。');
      return;
    }
    void importAssetFile(file);
  }

  function handlePaste(event: ClipboardEvent<HTMLDivElement>) {
    const file = firstImageFile(Array.from(event.clipboardData.files));
    if (!file) return;
    void importAssetFile(file);
  }

  function startEditAsset(asset: InspirationAsset) {
    setSelectedAssetId(asset.id);
    setEditingAssetId(asset.id);
    setAssetEditDraft({
      title: asset.title,
      sourceUrl: asset.sourceUrl ?? '',
      sourcePlatform: asset.sourcePlatform ?? '',
      author: asset.author ?? '',
      originalPrompt: asset.originalPrompt ?? asset.inferredPrompt ?? '',
      tags: tagsToText(asset.tags),
      note: asset.note ?? '',
      licenseStatus: asset.licenseStatus,
      rating: assetRatingDraft(asset)
    });
    setAssetFile(null);
  }

  function cancelAssetEdit() {
    setEditingAssetId(null);
    setAssetEditDraft(emptyAssetDraft);
  }

  async function updateAssetMetadata() {
    const target = assets.find((asset) => asset.id === editingAssetId);
    if (!target) return;
    try {
      const saved = await saveInspirationAsset({
        ...target,
        title: assetEditDraft.title.trim() || target.title,
        sourceUrl: assetEditDraft.sourceUrl.trim() || undefined,
        sourcePlatform: assetEditDraft.sourcePlatform.trim() || undefined,
        author: assetEditDraft.author.trim() || undefined,
        originalPrompt: assetEditDraft.originalPrompt.trim() || undefined,
        tags: parseTags(assetEditDraft.tags),
        note: assetEditDraft.note.trim() || undefined,
        licenseStatus: assetEditDraft.licenseStatus,
        rating: parseAssetRating(assetEditDraft.rating)
      });
      setAssets((current) => current.map((asset) => (asset.id === saved.id ? saved : asset)));
      cancelAssetEdit();
      setMessage('灵感图片信息已更新。');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    }
  }

  async function removeAsset(assetId: string) {
    props.onRequestConfirm({
      title: '删除灵感收藏',
      message: '确定删除这条灵感收藏吗？这只会删除 VisionHub 记录，不会删除已导入的图片文件。',
      confirmLabel: '删除',
      tone: 'danger',
      onConfirm: async () => {
        try {
          await deleteInspirationAsset(assetId);
          setAssets((current) => current.filter((asset) => asset.id !== assetId));
          if (editingAssetId === assetId) cancelAssetEdit();
          if (selectedAssetId === assetId) setSelectedAssetId(null);
          setMessage('灵感收藏已删除。');
        } catch (error) {
          setMessage(error instanceof Error ? error.message : String(error));
          throw error;
        }
      }
    });
  }

  async function copySelectedPrompts() {
    const prompts = assets
      .filter((asset) => selectedAssetIds.includes(asset.id))
      .map((asset) => assetPrompt(asset))
      .filter(Boolean);
    if (prompts.length === 0) {
      setMessage('所选图片没有可复制的 Prompt。');
      return;
    }
    await copyText('所选 Prompt', prompts.join('\n\n---\n\n'));
  }

  function removeSelectedAssets() {
    if (selectedAssetIds.length === 0) return;
    const selectedCount = selectedAssetIds.length;
    props.onRequestConfirm({
      title: '批量删除灵感收藏',
      message: `确定删除 ${selectedCount} 条灵感收藏记录吗？这只会删除 VisionHub 记录，不会删除已导入的图片文件。`,
      confirmLabel: '删除记录',
      tone: 'danger',
      onConfirm: async () => {
        try {
          for (const assetId of selectedAssetIds) {
            await deleteInspirationAsset(assetId);
          }
          setAssets((current) => current.filter((asset) => !selectedAssetIds.includes(asset.id)));
          if (selectedAssetId && selectedAssetIds.includes(selectedAssetId)) setSelectedAssetId(null);
          clearAssetSelection();
          setMessage(`已删除 ${selectedCount} 条灵感收藏记录。`);
        } catch (error) {
          setMessage(error instanceof Error ? error.message : String(error));
          throw error;
        }
      }
    });
  }

  function assetPrompt(asset: InspirationAsset) {
    return asset.originalPrompt || asset.inferredPrompt || '';
  }

  function createTemplate(asset: InspirationAsset) {
    const prompt = assetPrompt(asset);
    if (!prompt) {
      setMessage('这张灵感图还没有 Prompt，先补充 Prompt 后再转模板。');
      return;
    }
    const result = props.onCreateTemplate(asset.title, prompt, asset.tags);
    setMessage(result);
  }




  function createExcerptFromAsset(asset: InspirationAsset) {
    const prompt = assetPrompt(asset);
    if (!prompt) {
      setMessage('这张灵感图还没有 Prompt，先补充或反推 Prompt 后再保存摘录。');
      return;
    }
    openExcerptEditor(undefined, {
      title: asset.title,
      prompt,
      sourceName: asset.sourcePlatform || asset.author || '',
      sourceUrl: asset.sourceUrl || '',
      tags: tagsToText(asset.tags),
      note: asset.inferredPrompt ? '来自灵感图片反推 Prompt。' : '来自灵感图片原始 Prompt。'
    });
  }


  function sourceDomain(url?: string) {
    return sourceHostname(url);
  }

  function resolveSourceFaviconUrl(source: InspirationSource) {
    const key = sourceFaviconCacheKey(source);
    return Object.prototype.hasOwnProperty.call(sourceFaviconCache, key)
      ? sourceFaviconCache[key]
      : defaultSourceFaviconUrl(source);
  }

  function markResolvedSourceFaviconUrl(source: InspirationSource, url: string | null) {
    const key = sourceFaviconCacheKey(source);
    setSourceFaviconCache((current) => {
      if (current[key] === url) return current;
      const next = { ...current, [key]: url };
      const persistent = Object.fromEntries(Object.entries(next).filter(([, value]) => typeof value === 'string'));
      localStorage.setItem(SOURCE_FAVICON_CACHE_KEY, JSON.stringify(persistent));
      return next;
    });
  }

  function renderSourceFavicon(source: InspirationSource) {
    const faviconUrl = resolveSourceFaviconUrl(source);
    return (
      <span className={`sourceFavicon ${faviconUrl ? 'hasImage' : ''}`} aria-hidden="true">
        {faviconUrl ? (
          <img
            src={faviconUrl}
            alt=""
            loading="lazy"
            onLoad={(event) => markResolvedSourceFaviconUrl(source, event.currentTarget.currentSrc || event.currentTarget.src)}
            onError={(event) => {
              const image = event.currentTarget;
              const fallbackIndex = Number(image.dataset.fallbackIndex ?? '0');
              const fallbackUrls = fallbackSourceFaviconUrls(source);
              const nextUrl = fallbackUrls[fallbackIndex];
              if (nextUrl) {
                image.dataset.fallbackIndex = String(fallbackIndex + 1);
                image.src = nextUrl;
                return;
              }
              image.style.display = 'none';
              image.parentElement?.classList.remove('hasImage');
              markResolvedSourceFaviconUrl(source, null);
            }}
          />
        ) : null}
        <span>{source.name.slice(0, 1).toUpperCase()}</span>
      </span>
    );
  }

  function sourceLogoText(source: InspirationSource) {
    const fromName = source.name.trim().replace(/[^\p{L}\p{N}]/gu, '').slice(0, 1);
    if (fromName) return fromName.toUpperCase();
    const fromDomain = sourceDomain(source.url).replace(/^www\./, '').split(/[.-]/).find(Boolean)?.slice(0, 1);
    return (fromDomain || '站').toUpperCase();
  }

  function renderSourceLogo(source: InspirationSource) {
    const faviconUrl = resolveSourceFaviconUrl(source);
    return (
      <div className={`sourceLogo sourceLogo-${source.category}`} aria-label={`${source.name} Logo`}>
        {faviconUrl ? (
          <img
            src={faviconUrl}
            alt=""
            loading="lazy"
            onLoad={(event) => {
              const image = event.currentTarget;
              if (image.naturalWidth <= 1 || image.naturalHeight <= 1) {
                markResolvedSourceFaviconUrl(source, null);
                return;
              }
              markResolvedSourceFaviconUrl(source, image.currentSrc || image.src);
            }}
            onError={(event) => {
              const image = event.currentTarget;
              const fallbackIndex = Number(image.dataset.fallbackIndex ?? '0');
              const fallbackUrls = fallbackSourceFaviconUrls(source);
              const nextUrl = fallbackUrls[fallbackIndex];
              if (nextUrl) {
                image.dataset.fallbackIndex = String(fallbackIndex + 1);
                image.src = nextUrl;
                return;
              }
              markResolvedSourceFaviconUrl(source, null);
            }}
          />
        ) : null}
        <span>{sourceLogoText(source)}</span>
      </div>
    );
  }

  function toggleAssetSelection(assetId: string) {
    setSelectedAssetIds((current) =>
      current.includes(assetId) ? current.filter((id) => id !== assetId) : [...current, assetId]
    );
  }

  function handleFolderImport(event: React.ChangeEvent<HTMLInputElement>) {
    const files = event.target.files;
    if (!files || files.length === 0) return;
    const imageFiles = Array.from(files).filter((f) => f.type.startsWith('image/'));
    if (imageFiles.length === 0) { setMessage('所选文件夹中没有支持的图片文件。'); return; }
    setIsImporting(true);
    let count = 0;
    const importNext = async (index: number) => {
      if (index >= imageFiles.length) { setIsImporting(false); setMessage(`已导入 ${count} 张图片。`); return; }
      const file = imageFiles[index];
      try {
        const dataUrl = await fileToDataUrl(file);
        const name = file.name.replace(/\.[^.]+$/, '');
        const saved = await importInspirationAsset({ title: name, dataUrl, fileName: file.name, tags: [] });
        setAssets((current) => [...current, saved]);
        setAssetsLoaded(true);
        count++;
      } catch (error) { console.warn('folder import failed', file.name, error); }
      await importNext(index + 1);
    };
    void importNext(0);
    event.target.value = '';
  }

  async function reversePromptForAsset(asset: InspirationAsset) {
    if (!asset.imageUrl && !asset.imagePath) { setMessage('该图片暂不支持反推 Prompt。'); return; }
    const settings = props.imagePromptReverse;
    if (!settings.baseUrl.trim() || !settings.modelId.trim()) {
      setMessage('请先到「偏好设置」配置图片反推 Prompt 的 Base URL 和模型 ID。');
      return;
    }
    if (!props.imagePromptReverseSecretAvailable) {
      setMessage('请先到「偏好设置」保存图片反推专用 API Key。');
      return;
    }
    let extraHeaders: Record<string, string> = {};
    try {
      extraHeaders = parseExtraHeaders(settings.extraHeadersJson || '{}');
    } catch (error) {
      setMessage(`图片反推配置的额外 Headers JSON 无法解析：${error instanceof Error ? error.message : String(error)}`);
      return;
    }
    const protocol = settings.protocol;
    const endpointPath = endpointForImageReverseProtocol(protocol);
    setReversePromptStatus({ assetId: asset.id, message: '正在调用视觉模型反推 Prompt…' });
    setReversePromptError('');
    try {
      const result = await reverseImagePrompt({
        providerId: 'image-prompt-reverse',
        modelId: settings.modelId,
        baseUrl: settings.baseUrl,
        protocol,
        endpointPath,
        extraHeaders,
        secretId: IMAGE_PROMPT_REVERSE_SECRET_ID,
        imagePath: asset.imagePath,
        imageUrl: asset.imageUrl,
        language: settings.language,
        detail: settings.detail
      });
      const saved = await saveInspirationAsset({
        ...asset,
        inferredPrompt: result.prompt,
        reversePrompt: {
          prompt: result.prompt,
          language: settings.language,
          detail: settings.detail,
          modelId: result.modelId,
          profileId: result.profileId,
          providerId: result.providerId,
          protocol: result.protocol,
          generatedAt: result.createdAt,
          rawSummary: result.rawSummary
        }
      });
      setAssets((current) => current.map((item) => (item.id === saved.id ? saved : item)));
      setSelectedAssetId(saved.id);
      setMessage('图片反推 Prompt 已完成并保存。');
    } catch (error) {
      const errorText = error instanceof Error ? error.message : String(error);
      setReversePromptError(errorText);
      setMessage(errorText);
    } finally {
      setReversePromptStatus(null);
    }
  }

  function clearAssetSelection() { setSelectedAssetIds([]); setAssetMenuTarget(null); }

  function openAssetContextMenu(asset: InspirationAsset, event: MouseEvent<HTMLElement>) {
    event.preventDefault();
    event.stopPropagation();
    if (!selectedAssetIds.includes(asset.id)) {
      setSelectedAssetIds([asset.id]);
    }
    const menuWidth = 178;
    const menuHeight = 430;
    setAssetMenuTarget({
      assetId: asset.id,
      x: Math.min(event.clientX, Math.max(12, window.innerWidth - menuWidth - 12)),
      y: Math.min(event.clientY, Math.max(12, window.innerHeight - menuHeight - 12))
    });
  }

  async function copyContextAssetPrompts(targetAssets: InspirationAsset[]) {
    const prompts = targetAssets.map(assetPrompt).filter(Boolean);
    if (prompts.length === 0) {
      setMessage('所选图片没有可复制的 Prompt。');
      setAssetMenuTarget(null);
      return;
    }
    await copyText(targetAssets.length > 1 ? '所选 Prompt' : 'Prompt', prompts.join('\n\n---\n\n'));
    setAssetMenuTarget(null);
  }

  async function copyContextAssetPaths(targetAssets: InspirationAsset[]) {
    const paths = targetAssets.map((asset) => asset.imagePath || asset.imageUrl || '').filter(Boolean);
    if (paths.length === 0) {
      setMessage('所选图片没有可复制的路径。');
      setAssetMenuTarget(null);
      return;
    }
    await copyText(targetAssets.length > 1 ? '所选图片路径' : '图片路径', paths.join('\n'));
    setAssetMenuTarget(null);
  }

  function removeContextAssets(targetAssets: InspirationAsset[]) {
    const targetIds = targetAssets.map((asset) => asset.id);
    if (targetIds.length === 0) return;
    setAssetMenuTarget(null);
    if (targetIds.length === 1) {
      void removeAsset(targetIds[0]);
      return;
    }
    props.onRequestConfirm({
      title: '批量删除灵感收藏',
      message: `确定删除 ${targetIds.length} 条灵感收藏记录吗？这只会删除 VisionHub 记录，不会删除已导入的图片文件。`,
      confirmLabel: '删除记录',
      tone: 'danger',
      onConfirm: async () => {
        try {
          for (const assetId of targetIds) {
            await deleteInspirationAsset(assetId);
          }
          setAssets((current) => current.filter((asset) => !targetIds.includes(asset.id)));
          if (selectedAssetId && targetIds.includes(selectedAssetId)) setSelectedAssetId(null);
          setSelectedAssetIds((current) => current.filter((assetId) => !targetIds.includes(assetId)));
          setMessage(`已删除 ${targetIds.length} 条灵感收藏记录。`);
        } catch (error) {
          setMessage(error instanceof Error ? error.message : String(error));
          throw error;
        }
      }
    });
  }

  function extractAssetDomain(asset: InspirationAsset) {
    if (asset.sourceUrl) return sourceDomain(asset.sourceUrl);
    if (asset.sourcePlatform) return asset.sourcePlatform;
    return '';
  }

  function assetSourceText(asset: InspirationAsset) {
    return extractAssetDomain(asset) || asset.author || '未记录来源';
  }

  return (
    <div className="inspirationPage" onDragOver={(event) => event.preventDefault()} onDrop={handleDrop} onPaste={handlePaste}>
      <header className="topbar inspirationTopbar">
        <div className="pageTitleBlock">
          <p className="eyebrow">Inspiration Center</p>
          <h1>灵感中心</h1>
          <p>管理提示词网站、参考来源和优秀 AI 图片收藏。</p>
        </div>
        <div className="statusPills">
          <span><Link2 size={15} /> {allSources.length} 个网站</span>
          <span><Bookmark size={15} /> {assets.length} 张收藏</span>
          <span><Sparkles size={15} /> 本地持久化</span>
        </div>
      </header>

      <section className="inspirationTabs" aria-label="灵感中心分类">
        <button className={activeTab === 'sources' ? 'active' : ''} onClick={() => { setAssetMenuTarget(null); setActiveTab('sources'); }}>
          <Link2 size={15} /> 提示词网站
        </button>
        <button className={activeTab === 'assets' ? 'active' : ''} onClick={() => { resetSourceDraft(); setAssetMenuTarget(null); setActiveTab('assets'); }}>
          <Bookmark size={15} /> 图片收藏
        </button>
        <button className={activeTab === 'excerpts' ? 'active' : ''} onClick={() => { resetSourceDraft(); setAssetMenuTarget(null); setActiveTab('excerpts'); }}>
          <Sparkles size={15} /> Prompt 摘录
        </button>
      </section>


      <section className={`promptExcerptShell ${activeTab === 'excerpts' ? 'active' : 'inactive'}`} aria-hidden={activeTab !== 'excerpts'}>
        <div className="inspirationGallerySearchPanel sourceSearchPanel promptExcerptToolbar">
          <label className="librarySearchBox">
            <span>搜索摘录</span>
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="标题 / Prompt / 来源 / 标签 / 备注" />
          </label>
          <div className="sourceSearchActions">
            <div className="sourceSearchCountLine">
              <span className="assetCount">{filteredExcerpts.length} / {excerpts.length} 条摘录</span>
              {activeExcerptFilterCount > 0 ? <span className="selectionCount">筛选 {activeExcerptFilterCount} 项</span> : null}
            </div>
            <div className="sourceSearchActionRow">
              <button className="miniButton" type="button" onClick={() => openExcerptEditor()} title="手动新建 Prompt 摘录"><Plus size={13} /> 手动摘录</button>
              <button className="miniButton primaryMini" type="button" onClick={() => void createExcerptFromClipboard()} title="从剪贴板读取文本并保存摘录"><Copy size={13} /> 从剪贴板摘录</button>
            </div>
          </div>
        </div>
        <div className="inspirationGalleryFilterPanel sourceFilterPanel libraryStructuredFilters promptExcerptFilters">
          <label><span>类型</span><StudioSelect className="libraryFilterSelect filterIconType" leadingIcon={<Database size={15} />} value={excerptCategory} onChange={(value) => setExcerptCategory(value as typeof excerptCategory)} options={excerptCategoryOptions} /></label>
          <label><span>语言</span><StudioSelect className="libraryFilterSelect filterIconPlatform" leadingIcon={<Sparkles size={15} />} value={excerptLanguage} onChange={(value) => setExcerptLanguage(value as typeof excerptLanguage)} options={excerptLanguageOptions} /></label>
          <label><span>来源</span><StudioSelect className="libraryFilterSelect filterIconStatus" leadingIcon={<Link2 size={15} />} value={excerptSourceFilter} onChange={(value) => setExcerptSourceFilter(value as ExcerptSourceFilter)} options={excerptSourceOptions} /></label>
          <label><span>常用</span><StudioSelect className="libraryFilterSelect filterIconStatus" leadingIcon={<Star size={15} />} value={excerptFavoriteFilter} onChange={(value) => setExcerptFavoriteFilter(value as ExcerptFavoriteFilter)} options={excerptFavoriteOptions} /></label>
          <button className="miniButton" type="button" title="清空 Prompt 摘录筛选" onClick={clearExcerptFilters}><X size={13} /> 清空</button>
        </div>
        <section className={`promptExcerptLayout ${excerptEditorOpen ? 'withEditor' : ''}`}>
          <div className="promptExcerptList">
            {excerptsLoading ? (
              <div className="emptyState libraryEmpty"><Sparkles size={42} /><h3>正在加载 Prompt 摘录</h3></div>
            ) : filteredExcerpts.length === 0 ? (
              <div className="emptyState libraryEmpty"><Sparkles size={42} /><h3>还没有 Prompt 摘录</h3><p>先在浏览器复制好的 Prompt，再点“从剪贴板摘录”；也可以手动新建。</p></div>
            ) : visibleExcerpts.map((excerpt) => (
              <article className="promptExcerptCard" key={excerpt.id}>
                <div className="promptExcerptCardHeader">
                  <div><span className="badge">{excerptCategoryLabel(excerpt.category)}</span><strong title={excerpt.title}>{excerpt.title}</strong></div>
                  <button className={`iconMiniButton promptFavoriteButton ${excerpt.favorite ? 'active' : ''}`} type="button" onClick={() => void toggleExcerptFavorite(excerpt)} title={excerpt.favorite ? '取消常用' : '标记常用'} aria-label={excerpt.favorite ? '取消常用' : '标记常用'}><Star size={13} fill={excerpt.favorite ? 'currentColor' : 'none'} /></button>
                </div>
                <p className="promptExcerptText">{excerpt.prompt}</p>
                <div className="templateTags promptExcerptTags">
                  {excerpt.tags.slice(0, 5).map((tag) => <span key={tag}>{tag}</span>)}
                  <span>{excerptLanguageLabel(excerpt.language)}</span>
                </div>
                <div className="promptExcerptMeta">
                  <span>{excerpt.sourceName || sourceDomain(excerpt.sourceUrl) || '未记录来源'}</span>
                  <span>{excerpt.usedCount ? `使用 ${excerpt.usedCount} 次` : '尚未使用'}</span>
                </div>
                <div className="promptExcerptActions">
                  <button className="miniButton primaryMini" type="button" onClick={() => useExcerpt(excerpt)}><Sparkles size={13} /> 套用</button>
                  <button className="miniButton" type="button" onClick={() => void copyExcerpt(excerpt)}><Copy size={13} /> 复制</button>
                  <button className="miniButton" type="button" onClick={() => createTemplateFromExcerpt(excerpt)}><Bookmark size={13} /> 转模板</button>
                  <button className="miniButton" type="button" onClick={() => openExcerptEditor(excerpt)}><Edit3 size={13} /> 编辑</button>
                  <button className="miniButton dangerText" type="button" onClick={() => void removeExcerpt(excerpt.id)}><Trash2 size={13} /> 删除</button>
                </div>
              </article>
            ))}
          </div>
          {excerptEditorOpen ? (
            <aside className="sourceEditorDrawer promptExcerptEditor" aria-label={excerptDraft.id ? '编辑 Prompt 摘录' : '新增 Prompt 摘录'}>
              <div className="panelTitleRow"><div><strong>{excerptDraft.id ? '编辑 Prompt 摘录' : '新增 Prompt 摘录'}</strong><p>默认不抓取浏览器内容，只保存你复制或手动整理的 Prompt。</p></div><button className="iconMiniButton" title="关闭摘录编辑" aria-label="关闭摘录编辑" onClick={resetExcerptDraft} type="button"><X size={13} /></button></div>
              <div className="sourceEditorForm">
                <label><span>标题</span><input value={excerptDraft.title} onChange={(event) => setExcerptDraft({ ...excerptDraft, title: event.target.value })} placeholder="例如：赛博角色人像构图" /></label>
                <label><span>Prompt</span><textarea value={excerptDraft.prompt} onChange={(event) => setExcerptDraft({ ...excerptDraft, prompt: event.target.value })} rows={8} placeholder="粘贴或整理你在外部网站看到的 Prompt" /></label>
                <div className="inspirationFormGrid"><label><span>类型</span><StudioSelect value={excerptDraft.category} onChange={(value) => setExcerptDraft({ ...excerptDraft, category: value as PromptExcerptCategory })} options={excerptCategoryOptions.filter((option) => option.value !== 'all') as Array<{ value: PromptExcerptCategory; label: string }>} /></label><label><span>语言</span><StudioSelect value={excerptDraft.language} onChange={(value) => setExcerptDraft({ ...excerptDraft, language: value as PromptExcerptLanguage })} options={excerptLanguageOptions.filter((option) => option.value !== 'all') as Array<{ value: PromptExcerptLanguage; label: string }>} /></label></div>
                <label><span>来源名称</span><input value={excerptDraft.sourceName} onChange={(event) => setExcerptDraft({ ...excerptDraft, sourceName: event.target.value })} placeholder="例如：PromptHero" /></label>
                <label><span>来源 URL</span><input value={excerptDraft.sourceUrl} onChange={(event) => setExcerptDraft({ ...excerptDraft, sourceUrl: event.target.value })} placeholder="https://..." /></label>
                <label><span>标签</span><input value={excerptDraft.tags} onChange={(event) => setExcerptDraft({ ...excerptDraft, tags: event.target.value })} placeholder="人像，赛博，镜头" /></label>
                <label><span>备注</span><textarea value={excerptDraft.note} onChange={(event) => setExcerptDraft({ ...excerptDraft, note: event.target.value })} rows={3} placeholder="这条 Prompt 适合怎么用、需要改哪里" /></label>
                <label className="inspirationCheck inspirationSwitchCheck"><input type="checkbox" checked={excerptDraft.favorite} onChange={(event) => setExcerptDraft({ ...excerptDraft, favorite: event.target.checked })} /><span>标记为常用</span></label>
              </div>
              <div className="sourceEditorActions"><button className="miniButton" onClick={resetExcerptDraft} title="取消摘录" type="button"><X size={13} /> 取消</button><button className="miniButton primaryMini" onClick={() => void submitExcerpt()} title="保存摘录" type="button"><Save size={14} /> 保存摘录</button></div>
            </aside>
          ) : null}
        </section>
      </section>

      <section className={`sourceLibraryShell ${activeTab === 'sources' ? 'active' : 'inactive'}`} aria-hidden={activeTab !== 'sources'}>
          <div className="inspirationGallerySearchPanel sourceSearchPanel">
            <label className="librarySearchBox">
              <span>搜索网站</span>
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="名称 / 域名 / 标签 / 场景 / 关键词" />
            </label>
            <div className="sourceSearchActions">
              <div className="sourceSearchCountLine">
                <span className="assetCount">{filteredSources.length} / {allSources.length} 个网站</span>
                {activeSourceFilterCount > 0 ? <span className="selectionCount">筛选 {activeSourceFilterCount} 项</span> : null}
              </div>
              <div className="sourceSearchActionRow">
                <div className="segmentedControl compactSegment sourceViewSwitch" aria-label="提示词网站视图切换">
                  <button className={sourceViewMode === 'card' ? 'active' : ''} onClick={() => setSourceViewMode('card')} type="button">
                    <Grid2X2 size={13} /> 卡片
                  </button>
                  <button className={sourceViewMode === 'list' ? 'active' : ''} onClick={() => setSourceViewMode('list')} type="button">
                    <List size={13} /> 列表
                  </button>
                </div>
                <button className="miniButton primaryMini" onClick={() => openSourceEditor()} title="添加自定义网站" type="button">
                  <Plus size={14} /> 添加网站
                </button>
              </div>
            </div>
          </div>

          <div className="inspirationGalleryFilterPanel sourceFilterPanel libraryStructuredFilters">
            <label>
              <span>类型</span>
              <StudioSelect className="libraryFilterSelect filterIconType" leadingIcon={<Database size={15} />} value={sourceCategory} onChange={(value) => setSourceCategory(value as typeof sourceCategory)} options={sourceCategoryOptions} />
            </label>
            <label>
              <span>地区</span>
              <StudioSelect className="libraryFilterSelect filterIconPlatform" leadingIcon={<Link2 size={15} />} value={sourceRegion} onChange={(value) => setSourceRegion(value as typeof sourceRegion)} options={regionOptions} />
            </label>
            <label>
              <span>来源</span>
              <StudioSelect className="libraryFilterSelect filterIconStatus" leadingIcon={<Bookmark size={15} />} value={sourceKindFilter} onChange={(value) => setSourceKindFilter(value as SourceKindFilter)} options={sourceKindOptions} />
            </label>
            <label>
              <span>登录</span>
              <StudioSelect className="libraryFilterSelect filterIconStatus" leadingIcon={<CheckSquare size={15} />} value={sourceLoginFilter} onChange={(value) => setSourceLoginFilter(value as SourceLoginFilter)} options={sourceLoginOptions} />
            </label>
            <label>
              <span>商用</span>
              <StudioSelect className="libraryFilterSelect filterIconStatus" leadingIcon={<Star size={15} />} value={sourceCommercialFilter} onChange={(value) => setSourceCommercialFilter(value as typeof sourceCommercialFilter)} options={sourceCommercialOptions} />
            </label>
            <button className="miniButton" type="button" title="清空提示词网站筛选" onClick={clearSourceFilters}>
              <X size={13} /> 清空
            </button>
          </div>

          <section className="sourceLibraryLayout">
            <aside className="sourceCategoryRail" aria-label="提示词网站分类">
              {sourceNavItems.map((item) => (
                <button
                  className={sourceNavFilter === item.value ? 'active' : ''}
                  key={item.value}
                  onClick={() => setSourceNavFilter(item.value)}
                  title={`查看${item.label}`}
                  type="button"
                >
                  <span>{item.label}</span>
                  <small>{item.count}</small>
                </button>
              ))}
            </aside>

            <section className={`sourceTablePanel ${sourceViewMode === 'card' ? 'sourceCardPanel' : ''}`}>
              {sourceViewMode === 'list' ? (
                <div className="sourceTableHeader">
                  <span>网站</span>
                  <span>分类</span>
                  <span>说明</span>
                  <span>状态</span>
                  <span>最近</span>
                  <span>操作</span>
                </div>
              ) : null}

              {!sourcesLoaded ? (
                <div className="emptyState libraryEmpty sourceTableEmpty"><Sparkles size={42} /><h3>正在加载提示词网站</h3></div>
              ) : filteredSources.length === 0 ? (
                <div className="emptyState libraryEmpty sourceTableEmpty"><Link2 size={42} /><h3>没有匹配的网站</h3><p>可以清空筛选，或添加你自己的高价值网站。</p></div>
              ) : sourceViewMode === 'card' ? (
                <div className="sourceCardGrid">
                  {filteredSources.map((source) => (
                    <article className="sourceCard" key={source.id}>
                      <div className="sourceCardHeader">
                        {renderSourceLogo(source)}
                        <div>
                          <strong title={source.name}>{source.name}</strong>
                          <small title={source.url}>{sourceDomain(source.url) || source.url}</small>
                        </div>
                      </div>
                      <div className="sourceCardMeta">
                        <span>{categoryLabel(source.category)}</span>
                        <span>{regionLabel(source.region)}</span>
                        <span>{sourceKindLabel(source.sourceKind)}</span>
                      </div>
                      <p title={source.note || source.sceneNotes}>{source.note || source.sceneNotes || '暂无说明'}</p>
                      <div className="sourceInlineTags">
                        {source.tags.slice(0, 4).map((tag) => <span key={tag}>{tag}</span>)}
                      </div>
                      <div className="sourceCardStatus">
                        <span className={source.requiresLogin ? 'sourceBadge warning' : 'sourceBadge'}>{source.requiresLogin ? '需登录' : '免登录优先'}</span>
                        <span className="sourceBadge">{commercialReferenceLabel(source.commercialReference)}</span>
                        <span className="sourceBadge">打开 {source.openCount ?? 0}</span>
                      </div>
                      <div className="sourceRowActions">
                        <button className="miniButton primaryMini" onClick={() => void openSource(source)} title={`打开 ${source.name}`} type="button"><ExternalLink size={13} /> 打开</button>
                        <button className="miniButton" onClick={() => void copyText('URL', source.url)} title="复制网站链接" type="button"><Copy size={13} /> 复制</button>
                        <button className="miniButton" onClick={() => editSource(source)} title={source.sourceKind === 'preset' ? '存为自定义网站' : '编辑网站'} type="button"><Edit3 size={13} /> {source.sourceKind === 'preset' ? '保存' : '编辑'}</button>
                        {source.sourceKind !== 'preset' ? (
                          <button className="miniButton dangerText" onClick={() => void removeSource(source.id)} title="删除自定义网站" type="button"><Trash2 size={13} /> 删除</button>
                        ) : null}
                      </div>
                    </article>
                  ))}
                </div>
              ) : filteredSources.map((source) => (
                <article className="sourceTableRow" key={source.id}>
                  <div className="sourceIdentityCell">
                    {renderSourceFavicon(source)}
                    <div>
                      <strong title={source.name}>{source.name}</strong>
                      <small title={source.url}>{sourceDomain(source.url) || source.url}</small>
                    </div>
                  </div>
                  <div className="sourceMetaCell">
                    <span>{categoryLabel(source.category)}</span>
                    <small>{regionLabel(source.region)} · {sourceKindLabel(source.sourceKind)}</small>
                  </div>
                  <div className="sourceNoteCell">
                    <p title={source.note || source.sceneNotes}>{source.note || source.sceneNotes || '暂无说明'}</p>
                    <div className="sourceInlineTags">
                      {source.tags.slice(0, 3).map((tag) => <span key={tag}>{tag}</span>)}
                      {(source.tags.length > 3 || (source.keywords?.length ?? 0) > 0) ? <span>+{Math.max(0, source.tags.length - 3) + (source.keywords?.length ?? 0)}</span> : null}
                    </div>
                  </div>
                  <div className="sourceStatusCell">
                    <span className={source.requiresLogin ? 'sourceBadge warning' : 'sourceBadge'}>{source.requiresLogin ? '需登录' : '免登录优先'}</span>
                    <span className="sourceBadge">{commercialReferenceLabel(source.commercialReference)}</span>
                  </div>
                  <div className="sourceRecentCell">
                    <strong>{source.openCount ?? 0}</strong>
                    <small>{formatSourceTime(source.lastOpenedAt)}</small>
                  </div>
                  <div className="sourceRowActions">
                    <button className="miniButton primaryMini" onClick={() => void openSource(source)} title={`打开 ${source.name}`} type="button"><ExternalLink size={13} /> 打开</button>
                    <button className="miniButton" onClick={() => void copyText('URL', source.url)} title="复制网站链接" type="button"><Copy size={13} /> 复制</button>
                    <button className="miniButton" onClick={() => editSource(source)} title={source.sourceKind === 'preset' ? '存为自定义网站' : '编辑网站'} type="button"><Edit3 size={13} /> {source.sourceKind === 'preset' ? '保存' : '编辑'}</button>
                    {source.sourceKind !== 'preset' ? (
                      <button className="miniButton dangerText" onClick={() => void removeSource(source.id)} title="删除自定义网站" type="button"><Trash2 size={13} /> 删除</button>
                    ) : null}
                  </div>
                </article>
              ))}
            </section>
          </section>

          {sourceEditorOpen ? (
            <aside className="sourceEditorDrawer" aria-label={sourceDraft.id ? '编辑提示词网站' : '添加提示词网站'}>
              <div className="panelTitleRow">
                <div>
                  <strong>{sourceDraft.id ? '编辑自定义网站' : '添加自定义网站'}</strong>
                  <p>{sourceDraft.id ? '更新你自己的站点信息。' : '预设库之外的好网站，可以在这里补充。'}</p>
                </div>
                <button className="iconMiniButton" title="关闭添加网站面板" aria-label="关闭添加网站面板" onClick={resetSourceDraft} type="button"><X size={13} /></button>
              </div>
              <div className="sourceEditorForm">
                <label><span>名称</span><input value={sourceDraft.name} onChange={(event) => setSourceDraft({ ...sourceDraft, name: event.target.value })} placeholder="例如：自用提示词收藏站" /></label>
                <label><span>URL</span><input value={sourceDraft.url} onChange={(event) => setSourceDraft({ ...sourceDraft, url: event.target.value })} placeholder="https://..." /></label>
                <div className="inspirationFormGrid">
                  <label><span>类型</span><StudioSelect value={sourceDraft.category} onChange={(value) => setSourceDraft({ ...sourceDraft, category: value as InspirationSourceCategory })} options={sourceCategoryOptions.filter((option) => option.value !== 'all') as Array<{ value: InspirationSourceCategory; label: string }>} /></label>
                  <label><span>地区</span><StudioSelect value={sourceDraft.region} onChange={(value) => setSourceDraft({ ...sourceDraft, region: value as InspirationRegion })} options={regionOptions.filter((option) => option.value !== 'all') as Array<{ value: InspirationRegion; label: string }>} /></label>
                </div>
                <label><span>标签</span><input value={sourceDraft.tags} onChange={(event) => setSourceDraft({ ...sourceDraft, tags: event.target.value })} placeholder="商业，角色，构图" /></label>
                <label><span>常用关键词</span><input value={sourceDraft.keywords} onChange={(event) => setSourceDraft({ ...sourceDraft, keywords: event.target.value })} placeholder="portrait，logo，电商主图" /></label>
                <label><span>备注</span><textarea value={sourceDraft.note} onChange={(event) => setSourceDraft({ ...sourceDraft, note: event.target.value })} rows={2} placeholder="这个网站最值得记录的点" /></label>
                <label><span>适合场景</span><textarea value={sourceDraft.sceneNotes} onChange={(event) => setSourceDraft({ ...sourceDraft, sceneNotes: event.target.value })} rows={2} placeholder="适合找什么类型的参考" /></label>
                <label><span>登录 / 会员说明</span><textarea value={sourceDraft.membershipNotes} onChange={(event) => setSourceDraft({ ...sourceDraft, membershipNotes: event.target.value })} rows={2} placeholder="是否需要登录、会员或额度" /></label>
                <label><span>版权 / 商用备注</span><textarea value={sourceDraft.copyrightNotes} onChange={(event) => setSourceDraft({ ...sourceDraft, copyrightNotes: event.target.value })} rows={2} placeholder="商用前要注意什么" /></label>
                <label><span>Favicon URL</span><input value={sourceDraft.faviconUrl} onChange={(event) => setSourceDraft({ ...sourceDraft, faviconUrl: event.target.value })} placeholder="可选，https://..." /></label>
                <label className="inspirationCheck"><input type="checkbox" checked={sourceDraft.requiresLogin} onChange={(event) => setSourceDraft({ ...sourceDraft, requiresLogin: event.target.checked })} /><span>需要登录</span></label>
                <label><span>商用备注</span><StudioSelect value={sourceDraft.commercialReference} onChange={(value) => setSourceDraft({ ...sourceDraft, commercialReference: value as InspirationCommercialReference })} options={commercialReferenceOptions} /></label>
              </div>
              <div className="sourceEditorActions">
                <button className="miniButton" onClick={resetSourceDraft} title="取消添加或编辑" type="button"><X size={13} /> 取消</button>
                <button className="miniButton primaryMini" onClick={() => void submitSource()} title="保存网站" type="button"><Save size={14} /> 保存</button>
              </div>
            </aside>
          ) : null}
      </section>

      {isAssetTabMounted ? (
        <section
          className={`inspirationAssetGalleryShell libraryPageShell ${activeTab === 'assets' ? 'active' : 'inactive'}`}
          aria-hidden={activeTab !== 'assets'}
        >
          <input ref={fileInputRef} type="file" accept="image/*" hidden onChange={handleFileImport} />

          <section className="inspirationGalleryArea">
            <div className="galleryToolbar">
              <div className="galleryToolbarLeft">
                <button
                  aria-label={assetSearchVisible ? '隐藏图片收藏搜索' : '显示图片收藏搜索'}
                  className={assetSearchVisible ? 'miniButton active' : 'miniButton'}
                  onClick={() => setAssetSearchVisible((value) => !value)}
                  title={assetSearchVisible ? '隐藏搜索' : '显示搜索'}
                  type="button"
                >
                  <Search size={13} /> 搜索
                </button>
                <button
                  aria-label={assetFiltersVisible ? '隐藏图片收藏筛选' : '显示图片收藏筛选'}
                  className={assetFiltersVisible ? 'miniButton active' : 'miniButton'}
                  onClick={() => setAssetFiltersVisible((value) => !value)}
                  title={assetFiltersVisible ? '隐藏筛选' : '显示筛选'}
                  type="button"
                >
                  <SlidersHorizontal size={13} /> 筛选{activeAssetFilterCount ? ` (${activeAssetFilterCount})` : ''}
                </button>
                {assetViewOptions.map((option) => (
                  <button
                    aria-label={`切换图片收藏视图：${option.label}`}
                    className={assetViewMode === option.value ? 'miniButton active' : 'miniButton'}
                    key={option.value}
                    onClick={() => setAssetViewMode(option.value)}
                    title={`切换到${option.label}视图`}
                    type="button"
                  >
                    {option.value === 'list' ? <List size={13} /> : <Grid3x3 size={13} />} {option.label}
                  </button>
                ))}
                {selectedAssetIds.length > 0 ? (
                  <span className="selectionCount">已选 {selectedAssetIds.length} 张</span>
                ) : (
                  <span className="assetCount">{filteredAssets.length} 张收藏</span>
                )}
              </div>
              <div className="galleryToolbarRight">
                <button className="miniButton" onClick={() => setSelectedAssetIds(filteredAssets.map((a) => a.id))} title="全选" type="button">
                  <CheckSquare size={14} /> 全选
                </button>
                {selectedAssetIds.length > 0 && (
                  <button className="miniButton" onClick={clearAssetSelection} title="取消选择" type="button">
                    <X size={14} /> 取消
                  </button>
                )}
                {selectedAssetIds.length > 0 && (
                  <>
                    <button className="miniButton" onClick={() => void copySelectedPrompts()} title="批量复制 Prompt" type="button">
                      <Copy size={14} /> 复制 Prompt
                    </button>
                    <button className="miniButton danger" onClick={removeSelectedAssets} title="批量删除记录" type="button">
                      <Trash2 size={14} /> 删除记录
                    </button>
                  </>
                )}
                <button className="miniButton" onClick={() => folderInputRef.current?.click()} title="导入文件夹" type="button">
                  <FolderOpen size={14} /> 批量导入
                </button>
                <button className="miniButton primaryMini" onClick={() => fileInputRef.current?.click()} title="导入图片" type="button">
                  <Upload size={14} /> 导入图片
                </button>
                <input ref={folderInputRef} type="file" multiple accept="image/*" hidden onChange={handleFolderImport} />
              </div>
            </div>

            {assetSearchVisible ? (
              <div className="inspirationGallerySearchPanel">
                <label className="librarySearchBox">
                  <span>搜索图片收藏</span>
                  <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="名称 / 来源 URL / Prompt / 标签" autoFocus />
                </label>
                {query.trim() ? (
                  <button className="iconMiniButton" type="button" title="清空搜索" aria-label="清空搜索" onClick={() => setQuery('')}><X size={13} /></button>
                ) : null}
              </div>
            ) : null}

            {assetFiltersVisible ? (
              <div className="inspirationGalleryFilterPanel libraryStructuredFilters">
                <label>
                  <span>来源</span>
                  <StudioSelect className="libraryFilterSelect filterIconPlatform" leadingIcon={<Link2 size={15} />} value={assetSourceFilter} onChange={(value) => setAssetSourceFilter(value as AssetSourceFilter)} options={assetSourceOptions} />
                </label>
                <label>
                  <span>授权</span>
                  <StudioSelect className="libraryFilterSelect filterIconStatus" leadingIcon={<Bookmark size={15} />} value={assetLicense} onChange={(value) => setAssetLicense(value as typeof assetLicense)} options={licenseOptions} />
                </label>
                <label>
                  <span>反推 Prompt</span>
                  <StudioSelect className="libraryFilterSelect filterIconType" leadingIcon={<Sparkles size={15} />} value={assetPromptFilter} onChange={(value) => setAssetPromptFilter(value as AssetPromptFilter)} options={assetPromptOptions} />
                </label>
                <label className="libraryColorFilter inspirationColorFilter" ref={assetColorFilterRef}>
                  <span>颜色</span>
                  <button
                    aria-expanded={assetColorMenuOpen}
                    aria-haspopup="listbox"
                    className={`libraryColorFilterButton ${assetColorMenuOpen ? 'active' : ''}`}
                    onClick={() => setAssetColorMenuOpen((value) => !value)}
                    type="button"
                  >
                    <span className="libraryColorWheel" />
                    <span>{getAssetColorLabel(assetColorFilter) || '颜色'}</span>
                  </button>
                  {assetColorMenuOpen ? (
                    <div className="libraryColorFilterMenu" role="listbox" aria-label="灵感收藏颜色筛选">
                      {assetColorOptions.map((option) => (
                        <button
                          aria-selected={assetColorFilter === option.value}
                          className={assetColorFilter === option.value ? 'active' : ''}
                          key={option.value}
                          onClick={() => {
                            setAssetColorFilter(option.value);
                            setAssetColorMenuOpen(false);
                          }}
                          role="option"
                          type="button"
                        >
                          <span style={{ background: option.color }} />
                          {option.label}
                        </button>
                      ))}
                    </div>
                  ) : null}
                </label>
                <label>
                  <span>形状</span>
                  <StudioSelect className="libraryFilterSelect filterIconShape" leadingIcon={<Grid2X2 size={15} />} value={assetShapeFilter} onChange={(value) => setAssetShapeFilter(value as AssetShapeFilter)} options={assetShapeOptions} />
                </label>
                <label>
                  <span>格式</span>
                  <StudioSelect className="libraryFilterSelect filterIconFormat" leadingIcon={<Database size={15} />} value={assetFormatFilter} onChange={(value) => setAssetFormatFilter(value as AssetFormatFilter)} options={assetFormatOptions} />
                </label>
                <label>
                  <span>评分</span>
                  <StudioSelect className="libraryFilterSelect filterIconRating" leadingIcon={<Star size={15} />} value={assetRatingFilter} onChange={(value) => setAssetRatingFilter(value as AssetRatingFilter)} options={assetRatingOptions} />
                </label>
                <button className="miniButton libraryClearFiltersButton" disabled={!activeAssetFilterCount && !query.trim()} type="button" onClick={clearAssetFilters}>
                  <X size={13} /> {activeAssetFilterCount || query.trim() ? `清空 ${activeAssetFilterCount + (query.trim() ? 1 : 0)}` : '清空'}
                </button>
              </div>
            ) : null}

            <div className={selectedAsset ? 'assetGalleryContent withDetail' : 'assetGalleryContent'}>
              <div className="assetGalleryResults">
                {!assetsLoaded || assetsLoading ? (
                  <div className="emptyState libraryEmpty"><Sparkles size={42} /><h3>正在加载图片收藏</h3></div>
                ) : filteredAssets.length === 0 ? (
                  <div className="assetGalleryEmpty">
                    <div className="assetGalleryEmptyIcon"><Bookmark size={42} /></div>
                    <h3>还没有图片收藏</h3>
                    <p>这里会像作品画廊一样管理你从外部收藏的参考图。先导入一张图，后续可以用作图生图参考、复制 Prompt 或转为模板。</p>
                    <div className="assetGalleryEmptyActions">
                      <button className="rowActionButton primaryAction" onClick={() => fileInputRef.current?.click()}><Upload size={15} /> 导入图片</button>
                      <button className="ghostButton" onClick={() => folderInputRef.current?.click()}><FolderOpen size={14} /> 批量导入</button>
                    </div>
                  </div>
                ) : (
                  <section className={`libraryGrid libraryGridV2 view-${assetViewMode}`}>
                    {visibleAssets.map((asset) => {
                      const prompt = assetPrompt(asset);
                      const domain = extractAssetDomain(asset);
                      const isSelected = selectedAssetIds.includes(asset.id);
                      const isActive = selectedAssetId === asset.id;
                      return (
                        <article
                          className={`libraryCard libraryCardV2 inspirationLibraryCard ${isSelected ? 'selected' : ''} ${isActive ? 'favorite' : ''}`}
                          key={asset.id}
                          aria-selected={isSelected}
                          onClick={(event) => {
                            const target = event.target;
                            if (target instanceof Element && target.closest('button, a, input, select, textarea, .libraryQuickMenu')) return;
                            if (event.shiftKey) {
                              toggleAssetSelection(asset.id);
                            } else {
                              setSelectedAssetId(asset.id);
                            }
                          }}
                          onContextMenu={(event) => openAssetContextMenu(asset, event)}
                        >
                          <button
                            className={`librarySelectMark ${isSelected ? 'active' : ''}`}
                            type="button"
                            aria-label={isSelected ? '取消选择' : '选择图片'}
                            onClick={(event) => {
                              event.stopPropagation();
                              toggleAssetSelection(asset.id);
                            }}
                          >
                            <span />
                          </button>
                          {asset.imageUrl ? (
                            <button className="libraryThumb" onClick={(event) => { event.stopPropagation(); previewAssetFromGallery(asset); }}>
                              <img src={asset.imageUrl} alt={asset.title} loading="lazy" decoding="async" onLoad={(event) => rememberAssetImageMeta(asset.id, event.currentTarget)} />
                              <span><Maximize2 size={15} /> 预览</span>
                            </button>
                          ) : (
                            <div className="libraryFailedThumb">图片不可用</div>
                          )}
                          <div className="libraryImageOverlay">
                            <button className="iconMiniButton" type="button" data-tooltip="详情" aria-label="详情" onClick={() => setSelectedAssetId(asset.id)}>
                              <ImageIcon size={14} />
                            </button>
                            <div className="libraryMoreMenuWrap">
                              <button className="iconMiniButton" type="button" data-tooltip="更多操作" aria-label="更多操作">
                                <MoreHorizontal size={15} />
                              </button>
                              <div className="libraryQuickMenu" aria-label="图片操作">
                                <button type="button" onClick={() => setSelectedAssetId(asset.id)}><ImageIcon size={13} /> 图片详情</button>
                                <button type="button" disabled={!asset.imageUrl} onClick={() => props.onUseAsReference(asset)}><ImagePlus size={13} /> 设为参考图</button>
                                <button type="button" disabled={!prompt} onClick={() => void copyText('Prompt', prompt)}><Copy size={13} /> 复制 Prompt</button>
                                <button type="button" disabled={!prompt} onClick={() => props.onUsePrompt(prompt)}><Sparkles size={13} /> 套用 Prompt</button>
                                <button type="button" disabled={!asset.imageUrl || reversePromptStatus?.assetId === asset.id} onClick={() => void reversePromptForAsset(asset)}><Search size={13} /> {reversePromptStatus?.assetId === asset.id ? '反推中' : '反推提示词'}</button>
                                {asset.sourceUrl ? <button type="button" onClick={() => void openExternalUrl(asset.sourceUrl!)}><ExternalLink size={13} /> 打开原链接</button> : null}
                                <span className="libraryMenuDivider" />
                                <button type="button" onClick={() => startEditAsset(asset)}><Edit3 size={13} /> 编辑信息</button>
                                <button className="dangerAction" type="button" onClick={() => void removeAsset(asset.id)}><Trash2 size={13} /> 删除记录</button>
                              </div>
                            </div>
                          </div>
                          <div className="libraryCardBody">
                            <div className="resultTitleRow">
                              <strong title={asset.title}>{asset.title}</strong>
                              <div className="cardTopActions">
                                <span className="statusBadge modeBadge">{domain || '无来源'}</span>
                                <span className={asset.licenseStatus === 'commercial-confirmed' ? 'statusBadge succeeded' : 'statusBadge'}>
                                  {licenseLabel(asset.licenseStatus)}
                                </span>
                                <span className={asset.inferredPrompt ? 'statusBadge succeeded' : 'statusBadge failed'}>
                                  {asset.inferredPrompt ? '已反推' : '未反推'}
                                </span>
                              </div>
                            </div>
                            {assetViewMode === 'list' ? <p title={prompt || asset.note || ''}>{prompt || asset.note || '未记录 Prompt，可先作为视觉参考。'}</p> : null}
                            <div className="metadataRow">
                              <span>{assetSourceText(asset)}</span>
                              <span>
                                {licenseLabel(asset.licenseStatus)}
                              </span>
                            </div>
                          </div>
                        </article>
                      );
                    })}
                  </section>
                )}
              </div>

              {selectedAsset ? (
                <>
                <button className="libraryDetailBackdrop" type="button" aria-label="关闭详情" onClick={() => { setSelectedAssetId(null); cancelAssetEdit(); }} />
                <aside className="libraryDetailDrawer inspirationDetailDrawer" aria-label="灵感图片详情">
                  <div className="libraryDetailHeader">
                    <div className="libraryDetailTitle">
                      <span>灵感详情</span>
                      <strong title={selectedAsset.title}>{selectedAsset.title}</strong>
                    </div>
                    <div className="libraryDetailHeaderActions">
                      {editingAssetId === selectedAsset.id ? (
                        <button className="iconMiniButton" title="取消编辑" aria-label="取消编辑" onClick={cancelAssetEdit}><X size={13} /></button>
                      ) : (
                        <button className="iconMiniButton" title="编辑信息" aria-label="编辑信息" onClick={() => startEditAsset(selectedAsset)}><Edit3 size={13} /></button>
                      )}
                      <button className="iconMiniButton" title="关闭详情" aria-label="关闭详情" onClick={() => { setSelectedAssetId(null); cancelAssetEdit(); }}><X size={13} /></button>
                    </div>
                  </div>
                  {selectedAsset.imageUrl ? (
                    <div className="libraryDetailPreview">
                    <button className="libraryDetailPreviewImageButton" type="button" onClick={() => props.onPreview(selectedAsset.imageUrl!)}>
                      <img src={selectedAsset.imageUrl} alt={selectedAsset.title} decoding="async" onLoad={(event) => rememberAssetImageMeta(selectedAsset.id, event.currentTarget)} />
                    </button>
                    </div>
                  ) : (
                    <div className="libraryDetailMissing"><ImageIcon size={24} /> 图片不可用</div>
                  )}
                  <div className="libraryDetailActions">
                    <button className="miniButton primaryMini" disabled={!selectedAsset.imageUrl} onClick={() => props.onUseAsReference(selectedAsset)}><ImagePlus size={13} /> 参考</button>
                    <button className="miniButton" disabled={!assetPrompt(selectedAsset)} onClick={() => void copyText('Prompt', assetPrompt(selectedAsset))}><Copy size={13} /> Prompt</button>
                    <button className="miniButton" disabled={!selectedAsset.imageUrl || reversePromptStatus?.assetId === selectedAsset.id} onClick={() => void reversePromptForAsset(selectedAsset)}><Search size={13} /> {reversePromptStatus?.assetId === selectedAsset.id ? '反推中' : '反推'}</button>
                    <button className="miniButton" disabled={!assetPrompt(selectedAsset)} onClick={() => createTemplate(selectedAsset)}><Bookmark size={13} /> 模板</button>
                    {editingAssetId === selectedAsset.id ? (
                      <button className="miniButton primaryMini" onClick={() => void updateAssetMetadata()}><Save size={13} /> 保存</button>
                    ) : (
                      <button className="miniButton" onClick={() => startEditAsset(selectedAsset)}><Edit3 size={13} /> 编辑</button>
                    )}
                  </div>
                  {editingAssetId === selectedAsset.id ? (
                    <div className="inspirationDrawerEditForm">
                      <label><span>标题</span><input value={assetEditDraft.title} onChange={(event) => setAssetEditDraft({ ...assetEditDraft, title: event.target.value })} /></label>
                      <label><span>来源 URL</span><input value={assetEditDraft.sourceUrl} onChange={(event) => setAssetEditDraft({ ...assetEditDraft, sourceUrl: event.target.value })} placeholder="https://..." /></label>
                      <div className="inspirationDrawerEditGrid">
                        <label><span>来源平台</span><input value={assetEditDraft.sourcePlatform} onChange={(event) => setAssetEditDraft({ ...assetEditDraft, sourcePlatform: event.target.value })} /></label>
                        <label><span>作者</span><input value={assetEditDraft.author} onChange={(event) => setAssetEditDraft({ ...assetEditDraft, author: event.target.value })} /></label>
                      </div>
                      <label><span>标签</span><input value={assetEditDraft.tags} onChange={(event) => setAssetEditDraft({ ...assetEditDraft, tags: event.target.value })} /></label>
                      <div className="inspirationDrawerEditGrid">
                        <label><span>授权</span><StudioSelect value={assetEditDraft.licenseStatus} onChange={(value) => setAssetEditDraft({ ...assetEditDraft, licenseStatus: value as InspirationLicenseStatus })} options={licenseOptions.filter((option) => option.value !== 'all') as Array<{ value: InspirationLicenseStatus; label: string }>} /></label>
                        <label><span>评分</span><StudioSelect value={assetEditDraft.rating} onChange={(value) => setAssetEditDraft({ ...assetEditDraft, rating: value as AssetRatingValue })} options={assetRatingEditOptions} /></label>
                      </div>
                      <label><span>原始 Prompt</span><textarea value={assetEditDraft.originalPrompt} onChange={(event) => setAssetEditDraft({ ...assetEditDraft, originalPrompt: event.target.value })} rows={5} /></label>
                      <label><span>备注</span><textarea value={assetEditDraft.note} onChange={(event) => setAssetEditDraft({ ...assetEditDraft, note: event.target.value })} rows={3} /></label>
                    </div>
                  ) : (
                    <>
                  <dl className="assetDetailMeta">
                    <div><dt>来源</dt><dd>{assetSourceText(selectedAsset)}</dd></div>
                    <div><dt>作者</dt><dd>{selectedAsset.author || '未记录'}</dd></div>
                    <div><dt>授权</dt><dd>{licenseLabel(selectedAsset.licenseStatus)}</dd></div>
                    <div><dt>评分</dt><dd>{getAssetRating(selectedAsset) ? '★'.repeat(getAssetRating(selectedAsset)!) : '尚未评分'}</dd></div>
                    <div><dt>标签</dt><dd>{selectedAsset.tags.length ? selectedAsset.tags.join('，') : '未设置'}</dd></div>
                  </dl>
                  {selectedAsset.sourceUrl ? (
                    <button className="assetDetailLink" onClick={() => void openExternalUrl(selectedAsset.sourceUrl!)}>
                      <ExternalLink size={13} /> 打开原始链接
                    </button>
                  ) : null}
                  <section className="assetDetailTextBlock">
                    <span>原始 Prompt</span>
                    <p>{selectedAsset.originalPrompt || '未记录原始 Prompt。'}</p>
                  </section>
                  <section className="assetDetailTextBlock reversePromptBlock">
                    <div className="assetDetailBlockHeader">
                      <span>反推 Prompt</span>
                      {selectedAsset.reversePrompt?.generatedAt ? <small>{selectedAsset.reversePrompt.modelId || '视觉模型'} / {new Date(selectedAsset.reversePrompt.generatedAt).toLocaleString()}</small> : null}
                    </div>
                    <div className="reversePromptConfigNote">
                      图片反推配置已移到「偏好设置」的提示词辅助区域，使用独立 API Key，不再复用平台接入的生图配置实例。
                    </div>
                    <div className="reversePromptSummary" aria-label="当前图片反推配置">
                      <span>{reverseSettingLabel(props.imagePromptReverse.displayName, '图片反推 Prompt')}</span>
                      <small>{reverseSettingLabel(props.imagePromptReverse.modelId, '未设置模型')} · {props.imagePromptReverse.protocol} · {props.imagePromptReverse.detail} · {props.imagePromptReverse.language}</small>
                      <em className={props.imagePromptReverseSecretAvailable ? 'ready' : ''}>{props.imagePromptReverseSecretAvailable ? 'API Key 已配置' : 'API Key 未配置'}</em>
                      <button type="button" className="miniButton" onClick={props.onOpenSettings}><SlidersHorizontal size={13} /> 去偏好设置配置</button>
                    </div>
                    <p>{selectedAsset.inferredPrompt || '还没有反推结果。确认上方配置后，点击顶部“反推”即可写入这里。'}</p>
                    {reversePromptStatus?.assetId === selectedAsset.id ? <em className="reversePromptHint">{reversePromptStatus.message}</em> : null}
                    {reversePromptError ? <em className="reversePromptError">{reversePromptError}</em> : null}
                    {selectedAsset.inferredPrompt ? (
                      <div className="assetDetailActions">
                        <button className="miniButton" type="button" onClick={() => void copyText('反推 Prompt', selectedAsset.inferredPrompt)}><Copy size={13} /> 复制反推</button>
                        <button className="miniButton" type="button" onClick={() => props.onUsePrompt(selectedAsset.inferredPrompt!)}><Sparkles size={13} /> 套用反推</button>
                        <button className="miniButton" type="button" onClick={() => createTemplate({ ...selectedAsset, originalPrompt: selectedAsset.inferredPrompt })}><Bookmark size={13} /> 存为模板</button>
                      </div>
                    ) : null}
                  </section>
                  <section className="assetDetailTextBlock">
                    <span>备注</span>
                    <p>{selectedAsset.note || '未记录备注。'}</p>
                  </section>
                    </>
                  )}
                </aside>
                </>
              ) : null}

              {assetMenuTarget && contextAssets.length > 0 ? (
                <div
                  className="libraryContextMenu inspirationAssetContextMenu"
                  role="menu"
                  style={{ left: assetMenuTarget.x, top: assetMenuTarget.y }}
                  onPointerDown={(event) => event.stopPropagation()}
                  onContextMenu={(event) => event.preventDefault()}
                >
                  <div className="libraryContextMenuHeader">
                    <strong>{contextAssets.length > 1 ? `${contextAssets.length} 张已选` : '图片操作'}</strong>
                    <button className="iconMiniButton" type="button" data-tooltip="关闭" aria-label="关闭" onClick={() => setAssetMenuTarget(null)}><X size={13} /></button>
                  </div>
                  {contextAssets.length === 1 ? (
                    <>
                      <button type="button" role="menuitem" onClick={() => { setSelectedAssetId(contextAssets[0].id); setAssetMenuTarget(null); }}>
                        <ImageIcon size={13} /> 打开详情
                      </button>
                      <button type="button" role="menuitem" disabled={!contextAssets[0].imageUrl} onClick={() => { props.onUseAsReference(contextAssets[0]); setAssetMenuTarget(null); }}>
                        <ImagePlus size={13} /> 设为参考图
                      </button>
                      <button type="button" role="menuitem" disabled={!contextAssets[0].imageUrl} onClick={() => { previewAssetFromGallery(contextAssets[0]); setAssetMenuTarget(null); }}>
                        <Maximize2 size={13} /> 预览图片
                      </button>
                    </>
                  ) : null}
                  <button type="button" role="menuitem" onClick={() => void copyContextAssetPrompts(contextAssets)}>
                    <Copy size={13} /> 复制 Prompt
                  </button>
                  <button type="button" role="menuitem" onClick={() => void copyContextAssetPaths(contextAssets)}>
                    <Copy size={13} /> 复制图片路径
                  </button>
                  {contextAssets.length === 1 && contextAssets[0].sourceUrl ? (
                    <button type="button" role="menuitem" onClick={() => { void openExternalUrl(contextAssets[0].sourceUrl!); setAssetMenuTarget(null); }}>
                      <ExternalLink size={13} /> 打开原始链接
                    </button>
                  ) : null}
                  <span className="libraryMenuDivider" />
                  {contextAssets.length === 1 ? (
                    <>
                      <button type="button" role="menuitem" disabled={!assetPrompt(contextAssets[0])} onClick={() => { props.onUsePrompt(assetPrompt(contextAssets[0])); setAssetMenuTarget(null); }}>
                        <Sparkles size={13} /> 套用 Prompt
                      </button>
                      <button type="button" role="menuitem" disabled={!contextAssets[0].imageUrl || reversePromptStatus?.assetId === contextAssets[0].id} onClick={() => { void reversePromptForAsset(contextAssets[0]); setAssetMenuTarget(null); }}>
                        <Search size={13} /> 反推提示词
                      </button>
                      <button type="button" role="menuitem" onClick={() => { startEditAsset(contextAssets[0]); setAssetMenuTarget(null); }}>
                        <Edit3 size={13} /> 编辑信息
                      </button>
                    </>
                  ) : null}
                  <span className="libraryMenuDivider" />
                  <button className="dangerAction" type="button" role="menuitem" onClick={() => removeContextAssets(contextAssets)}>
                    <Trash2 size={13} /> {contextAssets.length > 1 ? '删除所选记录' : '删除记录'}
                  </button>
                </div>
              ) : null}
            </div>
          </section>
        </section>
      ) : null}
    </div>
  );
});
