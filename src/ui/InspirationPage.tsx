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
import { useEffect, useMemo, useRef, useState, type ClipboardEvent, type DragEvent } from 'react';
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
  loadInspirationLibrary,
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
type AssetImageMeta = {
  shapeTokens: AssetShapeFilter[];
  colorFamilies: AssetColorFilter[];
  palette: string[];
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
  tags: '',
  note: '',
  requiresLogin: false,
  commercialReference: 'reference-only' as InspirationCommercialReference
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
  const [isLoaded, setIsLoaded] = useState(false);
  const [message, setMessage] = useState('');
  const [query, setQuery] = useState('');
  const [sourceCategory, setSourceCategory] = useState<InspirationSourceCategory | 'all'>('all');
  const [sourceRegion, setSourceRegion] = useState<InspirationRegion | 'all'>('all');
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
    loadInspirationLibrary()
      .then((library) => {
        if (!active) return;
        setSources(library.sources);
        setAssets(library.assets);
      })
      .catch((error) => {
        if (active) setMessage(error instanceof Error ? error.message : String(error));
      })
      .finally(() => {
        if (active) setIsLoaded(true);
      });
    return () => {
      active = false;
    };
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

  const normalizedQuery = query.trim().toLowerCase();
  const filteredSources = useMemo(() => {
    return sources.filter((source) => {
      const matchesCategory = sourceCategory === 'all' || source.category === sourceCategory;
      const matchesRegion = sourceRegion === 'all' || source.region === sourceRegion;
      const haystack = [source.name, source.url, source.note ?? '', ...source.tags].join(' ').toLowerCase();
      return matchesCategory && matchesRegion && (!normalizedQuery || haystack.includes(normalizedQuery));
    });
  }, [normalizedQuery, sourceCategory, sourceRegion, sources]);

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
      const saved = await saveInspirationSource({
        id: sourceDraft.id || timestampId('source'),
        name,
        url,
        category: sourceDraft.category,
        region: sourceDraft.region,
        tags: parseTags(sourceDraft.tags),
        note: sourceDraft.note.trim() || undefined,
        requiresLogin: sourceDraft.requiresLogin,
        commercialReference: sourceDraft.commercialReference,
        createdAt: sourceDraft.id ? now : now,
        updatedAt: now
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
      const saved = await saveInspirationSource({ ...source, lastOpenedAt: String(Date.now()) });
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
    setSourceDraft({
      id: source.id,
      name: source.name,
      url: source.url,
      category: source.category,
      region: source.region,
      tags: tagsToText(source.tags),
      note: source.note ?? '',
      requiresLogin: Boolean(source.requiresLogin),
      commercialReference: source.commercialReference
    });
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

  function handleAssetMenuClose() { setAssetMenuTarget(null); }

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
          <span><Link2 size={15} /> {sources.length} 个网站</span>
          <span><Bookmark size={15} /> {assets.length} 张收藏</span>
          <span><Sparkles size={15} /> 本地持久化</span>
        </div>
      </header>

      <section className="inspirationTabs" aria-label="灵感中心分类">
        <button className={activeTab === 'sources' ? 'active' : ''} onClick={() => setActiveTab('sources')}>
          <Link2 size={15} /> 提示词网站
        </button>
        <button className={activeTab === 'assets' ? 'active' : ''} onClick={() => setActiveTab('assets')}>
          <Bookmark size={15} /> 图片收藏
        </button>
      </section>

      {activeTab === 'sources' ? (
      <section className="inspirationToolbar">
        <label className="librarySearchBox">
          <span>搜索</span>
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="名称 / URL / Prompt / 标签" />
        </label>
        <label>
          <span>类型</span>
          <StudioSelect value={sourceCategory} onChange={(value) => setSourceCategory(value as typeof sourceCategory)} options={sourceCategoryOptions} />
        </label>
        <label>
          <span>地区</span>
          <StudioSelect value={sourceRegion} onChange={(value) => setSourceRegion(value as typeof sourceRegion)} options={regionOptions} />
        </label>
      </section>
      ) : null}

      {activeTab === 'sources' ? (
        <section className="inspirationLayout">
          <article className="inspirationPanel">
            <div className="panelTitleRow">
              <strong>{sourceDraft.id ? '编辑灵感网站' : '添加灵感网站'}</strong>
              {sourceDraft.id ? <button className="iconMiniButton" title="取消编辑来源" aria-label="取消编辑来源" onClick={resetSourceDraft}><X size={13} /></button> : null}
            </div>
            <label><span>名称</span><input value={sourceDraft.name} onChange={(event) => setSourceDraft({ ...sourceDraft, name: event.target.value })} placeholder="例如：自用提示词收藏站" /></label>
            <label><span>URL</span><input value={sourceDraft.url} onChange={(event) => setSourceDraft({ ...sourceDraft, url: event.target.value })} placeholder="https://..." /></label>
            <div className="inspirationFormGrid">
              <label><span>类型</span><StudioSelect value={sourceDraft.category} onChange={(value) => setSourceDraft({ ...sourceDraft, category: value as InspirationSourceCategory })} options={sourceCategoryOptions.filter((option) => option.value !== 'all') as Array<{ value: InspirationSourceCategory; label: string }>} /></label>
              <label><span>地区</span><StudioSelect value={sourceDraft.region} onChange={(value) => setSourceDraft({ ...sourceDraft, region: value as InspirationRegion })} options={regionOptions.filter((option) => option.value !== 'all') as Array<{ value: InspirationRegion; label: string }>} /></label>
            </div>
            <label><span>标签</span><input value={sourceDraft.tags} onChange={(event) => setSourceDraft({ ...sourceDraft, tags: event.target.value })} placeholder="商业，角色，构图" /></label>
            <label><span>备注</span><textarea value={sourceDraft.note} onChange={(event) => setSourceDraft({ ...sourceDraft, note: event.target.value })} rows={3} placeholder="登录要求、常用分类、适合场景" /></label>
            <label className="inspirationCheck"><input type="checkbox" checked={sourceDraft.requiresLogin} onChange={(event) => setSourceDraft({ ...sourceDraft, requiresLogin: event.target.checked })} /><span>需要登录</span></label>
            <label><span>商用备注</span><StudioSelect value={sourceDraft.commercialReference} onChange={(value) => setSourceDraft({ ...sourceDraft, commercialReference: value as InspirationCommercialReference })} options={commercialReferenceOptions} /></label>
            <button className="rowActionButton primaryAction" onClick={() => void submitSource()}><Save size={15} /> 保存网站</button>
          </article>

          <section className="inspirationGrid sourceGrid">
            {!isLoaded ? (
              <div className="emptyState libraryEmpty"><Sparkles size={42} /><h3>正在加载灵感网站</h3></div>
            ) : filteredSources.length === 0 ? (
              <div className="emptyState libraryEmpty"><Link2 size={42} /><h3>还没有灵感网站</h3><p>先添加你常用的提示词模板站、模型社区或图片参考站。</p></div>
            ) : filteredSources.map((source) => (
              <article className="inspirationCard sourceCard" key={source.id}>
                <div className="sourceCardHeader">
                  <strong title={source.name}>{source.name}</strong>
                  <span>{categoryLabel(source.category)} / {regionLabel(source.region)}</span>
                </div>
                <p title={source.url}>{source.url}</p>
                {source.note ? <small title={source.note}>{source.note}</small> : null}
                <div className="templateTags">{source.tags.map((tag) => <span key={tag}>{tag}</span>)}</div>
                <div className="cardActions inspirationActions">
                  <button className="miniButton primaryMini" onClick={() => void openSource(source)}><ExternalLink size={13} /> 打开</button>
                  <button className="miniButton" onClick={() => void copyText('URL', source.url)}><Copy size={13} /> 复制</button>
                  <button className="miniButton" onClick={() => editSource(source)}><Edit3 size={13} /> 编辑</button>
                  <button className="miniButton dangerText" onClick={() => void removeSource(source.id)}><Trash2 size={13} /> 删除</button>
                </div>
              </article>
            ))}
          </section>
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
                {!isLoaded ? (
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
            </div>
          </section>
        </section>
      )}
    </div>
  );
}
