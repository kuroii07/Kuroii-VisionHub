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
import { useEffect, useMemo, useRef, useState, type ClipboardEvent, type DragEvent, type MouseEvent } from 'react';
import type {
  InspirationAsset,
  InspirationCommercialReference,
  InspirationLicenseStatus,
  InspirationRegion,
  InspirationSource,
  InspirationSourceCategory
} from '../domain/inspirationTypes';
import {
  deleteInspirationAsset,
  deleteInspirationSource,
  importInspirationAsset,
  loadInspirationAssets,
  loadInspirationSources,
  saveInspirationAsset,
  saveInspirationSource
} from '../services/inspirationApi';
import { openExternalUrl } from '../services/desktopApi';
import { StudioSelect } from './StudioSelect';
import type { ConfirmDialogRequest } from './confirmDialog';
import { useToastMessage } from './toast';

type InspirationTab = 'sources' | 'assets';
type AssetSourceFilter = 'all' | 'with-source' | 'without-source';
type AssetPromptFilter = 'all' | 'with-inferred' | 'without-inferred';
type AssetShapeFilter = 'all' | 'landscape' | 'portrait' | 'square' | 'wide' | 'tall' | 'four-three' | 'three-four' | 'sixteen-nine' | 'nine-sixteen' | 'custom';
type AssetFormatFilter = 'all' | 'png' | 'jpg' | 'gif' | 'webp' | 'svg' | 'unknown';
type AssetRatingValue = 'unrated' | '1' | '2' | '3' | '4' | '5';
type AssetRatingFilter = 'all' | AssetRatingValue;
type AssetColorFilter = 'all' | 'red' | 'orange' | 'yellow' | 'green' | 'cyan' | 'blue' | 'purple' | 'pink' | 'mono';
type SourceKindFilter = 'all' | 'preset' | 'custom';
type SourceLoginFilter = 'all' | 'requires-login' | 'no-login';
type SourceNavFilter = 'all' | 'preset' | 'custom' | InspirationSourceCategory | InspirationRegion;
type AssetImageMeta = {
  shapeTokens: AssetShapeFilter[];
  colorFamilies: AssetColorFilter[];
  palette: string[];
};

const SOURCE_PRESET_STATS_KEY = 'visionhub.inspiration.sourcePresetStats';
const SOURCE_PRESET_TIMESTAMP = 'preset';

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
  { value: 'all', label: '全部颜色', color: 'linear-gradient(135deg, #ef4444, #f59e0b, #22c55e, #38bdf8, #8b5cf6)' },
  { value: 'red', label: '红色', color: '#ef4444' },
  { value: 'orange', label: '橙色', color: '#f97316' },
  { value: 'yellow', label: '黄色', color: '#eab308' },
  { value: 'green', label: '绿色', color: '#22c55e' },
  { value: 'cyan', label: '青色', color: '#06b6d4' },
  { value: 'blue', label: '蓝色', color: '#3b82f6' },
  { value: 'purple', label: '紫色', color: '#8b5cf6' },
  { value: 'pink', label: '粉色', color: '#ec4899' },
  { value: 'mono', label: '黑白', color: 'linear-gradient(135deg, #111827 0 45%, #f8fafc 45% 100%)' }
];

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

export function InspirationPage(props: {
  onPreview: (imageUrl: string) => void;
  onUseAsReference: (asset: InspirationAsset) => void;
  onUsePrompt: (prompt: string) => void;
  onCreateTemplate: (title: string, prompt: string, tags: string[]) => string;
  onRequestConfirm: (request: ConfirmDialogRequest) => void;
}) {
  const [activeTab, setActiveTab] = useState<InspirationTab>('sources');
  const [sources, setSources] = useState<InspirationSource[]>([]);
  const [assets, setAssets] = useState<InspirationAsset[]>([]);
  const [sourcesLoaded, setSourcesLoaded] = useState(false);
  const [assetsLoaded, setAssetsLoaded] = useState(false);
  const [assetsLoading, setAssetsLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [query, setQuery] = useState('');
  const [sourceCategory, setSourceCategory] = useState<InspirationSourceCategory | 'all'>('all');
  const [sourceRegion, setSourceRegion] = useState<InspirationRegion | 'all'>('all');
  const [sourceKindFilter, setSourceKindFilter] = useState<SourceKindFilter>('all');
  const [sourceLoginFilter, setSourceLoginFilter] = useState<SourceLoginFilter>('all');
  const [sourceCommercialFilter, setSourceCommercialFilter] = useState<InspirationCommercialReference | 'all'>('all');
  const [sourceNavFilter, setSourceNavFilter] = useState<SourceNavFilter>('all');
  const [sourceEditorOpen, setSourceEditorOpen] = useState(false);
  const [sourceAdvancedOpen, setSourceAdvancedOpen] = useState(false);
  const [sourcePresetStats, setSourcePresetStats] = useState<Record<string, { openCount?: number; lastOpenedAt?: string }>>({});
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
  const [assetImageMeta, setAssetImageMeta] = useState<Record<string, AssetImageMeta>>({});

  useToastMessage(message, setMessage);

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

  const filteredAssets = useMemo(() => {
    return assets.filter((asset) => {
      const prompt = asset.originalPrompt || asset.inferredPrompt || '';
      const hasSource = Boolean(asset.sourceUrl || asset.sourcePlatform || asset.author);
      const hasInferredPrompt = Boolean(asset.inferredPrompt?.trim());
      const haystack = [
        asset.title,
        asset.sourceUrl ?? '',
        asset.sourcePlatform ?? '',
        asset.author ?? '',
        prompt,
        asset.note ?? '',
        ...asset.tags
      ]
        .join(' ')
        .toLowerCase();
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
      return matchesLicense && matchesSource && matchesPrompt && matchesShape && matchesFormat && matchesRating && matchesColor && (!normalizedQuery || haystack.includes(normalizedQuery));
    });
  }, [assetColorFilter, assetFormatFilter, assetImageMeta, assetLicense, assetPromptFilter, assetRatingFilter, assetShapeFilter, assetSourceFilter, assets, normalizedQuery]);

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
  const activeAssetFilterCount = [
    assetSourceFilter !== 'all',
    assetLicense !== 'all',
    assetPromptFilter !== 'all',
    assetColorFilter !== 'all',
    assetShapeFilter !== 'all',
    assetFormatFilter !== 'all',
    assetRatingFilter !== 'all'
  ].filter(Boolean).length;

  function resetSourceDraft() {
    setSourceDraft(emptySourceDraft);
    setSourceEditorOpen(false);
    setSourceAdvancedOpen(false);
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
      setSourceAdvancedOpen(Boolean(source.sceneNotes || source.membershipNotes || source.copyrightNotes || source.keywords?.length || source.faviconUrl));
    } else {
      setSourceDraft(emptySourceDraft);
      setSourceAdvancedOpen(false);
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
    const colors = analyzeImageColors(image);
    const nextMeta: AssetImageMeta = {
      shapeTokens: getShapeTokensFromSize(image.naturalWidth, image.naturalHeight),
      colorFamilies: colors?.families ?? [],
      palette: colors?.palette ?? []
    };
    setAssetImageMeta((current) => {
      const previous = current[assetId];
      if (
        previous &&
        previous.shapeTokens.join('|') === nextMeta.shapeTokens.join('|') &&
        previous.colorFamilies.join('|') === nextMeta.colorFamilies.join('|') &&
        previous.palette.join('|') === nextMeta.palette.join('|')
      ) {
        return current;
      }
      return { ...current, [assetId]: nextMeta };
    });
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


  function sourceDomain(url?: string) {
    if (!url) return '';
    try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return ''; }
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
    if (!asset.imageUrl || !asset.imagePath) { setMessage('该图片暂不支持反推 Prompt。'); return; }
    setMessage('反推 Prompt 功能将在后续版本接入视觉模型。目前可手动填写 Prompt 字段。');
  }

  function clearAssetSelection() { setSelectedAssetIds([]); setAssetMenuTarget(null); }

  function openAssetContextMenu(asset: InspirationAsset, event: MouseEvent<HTMLElement>) {
    event.preventDefault();
    event.stopPropagation();
    if (!selectedAssetIds.includes(asset.id)) {
      setSelectedAssetIds([asset.id]);
    }
    const menuWidth = 178;
    const menuHeight = 260;
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
      </section>

      {activeTab === 'sources' ? (
        <section className="sourceLibraryShell">
          <div className="galleryToolbar sourceLibraryToolbar">
            <div className="galleryToolbarLeft">
              <button className="miniButton primaryMini" onClick={() => openSourceEditor()} title="添加自定义网站" type="button">
                <Plus size={14} /> 添加网站
              </button>
              <span className="assetCount">{filteredSources.length} / {allSources.length} 个网站</span>
              {activeSourceFilterCount > 0 ? <span className="selectionCount">筛选 {activeSourceFilterCount} 项</span> : null}
            </div>
            <div className="galleryToolbarRight">
              <button className="miniButton" onClick={clearSourceFilters} title="清空网站筛选" type="button">
                <X size={14} /> 清空
              </button>
            </div>
          </div>

          <div className="inspirationGallerySearchPanel sourceSearchPanel">
            <label className="librarySearchBox">
              <span>搜索网站</span>
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="名称 / 域名 / 标签 / 场景 / 关键词" />
            </label>
            {query.trim() ? (
              <button className="iconMiniButton" type="button" title="清空搜索" aria-label="清空搜索" onClick={() => setQuery('')}><X size={13} /></button>
            ) : null}
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

            <section className="sourceTablePanel">
              <div className="sourceTableHeader">
                <span>网站</span>
                <span>分类</span>
                <span>说明</span>
                <span>状态</span>
                <span>最近</span>
                <span>操作</span>
              </div>

              {!sourcesLoaded ? (
                <div className="emptyState libraryEmpty sourceTableEmpty"><Sparkles size={42} /><h3>正在加载提示词网站</h3></div>
              ) : filteredSources.length === 0 ? (
                <div className="emptyState libraryEmpty sourceTableEmpty"><Link2 size={42} /><h3>没有匹配的网站</h3><p>可以清空筛选，或添加你自己的高价值网站。</p></div>
              ) : filteredSources.map((source) => (
                <article className="sourceTableRow" key={source.id}>
                  <div className="sourceIdentityCell">
                    <span className="sourceFavicon" aria-hidden="true">
                      {source.faviconUrl ? <img src={source.faviconUrl} alt="" /> : source.name.slice(0, 1).toUpperCase()}
                    </span>
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
                <button className="miniButton sourceAdvancedToggle" type="button" onClick={() => setSourceAdvancedOpen((value) => !value)} title={sourceAdvancedOpen ? '收起更多信息' : '展开更多信息'}>
                  <SlidersHorizontal size={13} /> {sourceAdvancedOpen ? '收起更多信息' : '展开更多信息'}
                </button>
                {sourceAdvancedOpen ? (
                  <>
                    <label><span>常用关键词</span><input value={sourceDraft.keywords} onChange={(event) => setSourceDraft({ ...sourceDraft, keywords: event.target.value })} placeholder="portrait，logo，电商主图" /></label>
                    <label><span>备注</span><textarea value={sourceDraft.note} onChange={(event) => setSourceDraft({ ...sourceDraft, note: event.target.value })} rows={2} placeholder="这个网站最值得记录的点" /></label>
                    <label><span>适合场景</span><textarea value={sourceDraft.sceneNotes} onChange={(event) => setSourceDraft({ ...sourceDraft, sceneNotes: event.target.value })} rows={2} placeholder="适合找什么类型的参考" /></label>
                    <label><span>登录 / 会员说明</span><textarea value={sourceDraft.membershipNotes} onChange={(event) => setSourceDraft({ ...sourceDraft, membershipNotes: event.target.value })} rows={2} placeholder="是否需要登录、会员或额度" /></label>
                    <label><span>版权 / 商用备注</span><textarea value={sourceDraft.copyrightNotes} onChange={(event) => setSourceDraft({ ...sourceDraft, copyrightNotes: event.target.value })} rows={2} placeholder="商用前要注意什么" /></label>
                    <label><span>Favicon URL</span><input value={sourceDraft.faviconUrl} onChange={(event) => setSourceDraft({ ...sourceDraft, faviconUrl: event.target.value })} placeholder="可选，https://..." /></label>
                  </>
                ) : null}
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
      ) : (
        <section className="inspirationAssetGalleryShell libraryPageShell">
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
                    {filteredAssets.map((asset) => {
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
                            <button className="libraryThumb" onClick={(event) => { event.stopPropagation(); props.onPreview(asset.imageUrl!); }}>
                              <img src={asset.imageUrl} alt={asset.title} loading="lazy" onLoad={(event) => rememberAssetImageMeta(asset.id, event.currentTarget)} />
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
                                <button type="button" disabled={!asset.imageUrl} onClick={() => void reversePromptForAsset(asset)}><Search size={13} /> 反推提示词</button>
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
                      <img src={selectedAsset.imageUrl} alt={selectedAsset.title} onLoad={(event) => rememberAssetImageMeta(selectedAsset.id, event.currentTarget)} />
                    </button>
                    </div>
                  ) : (
                    <div className="libraryDetailMissing"><ImageIcon size={24} /> 图片不可用</div>
                  )}
                  <div className="libraryDetailActions">
                    <button className="miniButton primaryMini" disabled={!selectedAsset.imageUrl} onClick={() => props.onUseAsReference(selectedAsset)}><ImagePlus size={13} /> 参考</button>
                    <button className="miniButton" disabled={!assetPrompt(selectedAsset)} onClick={() => void copyText('Prompt', assetPrompt(selectedAsset))}><Copy size={13} /> Prompt</button>
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
                  <section className="assetDetailTextBlock">
                    <span>反推 Prompt</span>
                    <p>{selectedAsset.inferredPrompt || '还没有反推结果，后续可接入视觉模型后写入这里。'}</p>
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
                      <button type="button" role="menuitem" disabled={!contextAssets[0].imageUrl} onClick={() => { if (contextAssets[0].imageUrl) props.onPreview(contextAssets[0].imageUrl); setAssetMenuTarget(null); }}>
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
                      <button type="button" role="menuitem" disabled={!contextAssets[0].imageUrl} onClick={() => { void reversePromptForAsset(contextAssets[0]); setAssetMenuTarget(null); }}>
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
      )}
    </div>
  );
}
