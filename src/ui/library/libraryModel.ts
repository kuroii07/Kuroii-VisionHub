import type { GenerationRecord } from '../../domain/providerTypes';
import type { Translator } from '../../i18n';
import type { LibraryDataPayload } from '../../services/desktopApi';
import { diagnoseGenerationFailure } from '../../services/generationErrorDiagnostics';
import { readStorageValue, writeStorageValue } from '../../services/safeStorage';
import {
  getRecordFileName,
  getRecordPrimaryPath,
  getRecordTimeMs,
  isPotentialBackgroundCompletion
} from '../generationRecordPresentation';

export type LibraryTimeFilter = 'all' | 'today' | '7d' | '30d';

export type LibraryViewMode = 'masonry' | 'adaptive' | 'square' | 'contain' | 'list';

export type LibrarySortMode = 'newest' | 'oldest' | 'favorites' | 'provider' | 'model' | 'duration' | 'size' | 'filename' | 'recent-viewed' | 'recent-reference';

export type LibraryQuickFilter = 'favorites' | 'recent7d' | 'references' | 'failed' | 'local';

export type LibraryShapeFilter = 'all' | 'landscape' | 'portrait' | 'square' | 'wide' | 'tall' | 'four-three' | 'three-four' | 'sixteen-nine' | 'nine-sixteen' | 'custom';

export type LibraryFormatFilter = 'all' | 'png' | 'jpg' | 'gif' | 'webp' | 'svg' | 'unknown';

export type LibraryRatingFilter = 'all' | 'unrated' | '1' | '2' | '3' | '4' | '5';

export type LibraryColorFilter = 'all' | 'red' | 'orange' | 'yellow' | 'green' | 'cyan' | 'blue' | 'purple' | 'pink' | 'mono';

export type LibraryModeFilter = 'all' | 'text-to-image' | 'image-to-image' | 'with-references';

export type LibraryMetaEntry = {
  favorite?: boolean;
  tags?: string[];
  folderId?: string;
  collectionIds?: string[];
  note?: string;
  rating?: number;
  colorPalette?: string[];
  colorFamilies?: LibraryColorFilter[];
  imageSize?: string;
  colorAnalyzedAt?: string;
  colorAnalysisFailed?: boolean;
  lastViewedAt?: string;
  lastUsedAsReferenceAt?: string;
};

export type LibraryMetaMap = Record<string, LibraryMetaEntry>;

export type LibraryDisplaySettings = {
  showPrompt: boolean;
  showProvider: boolean;
  showModel: boolean;
  showReferenceBadge: boolean;
  compact: boolean;
};

export type LibraryCustomQuickFilterCriteria = {
  query?: string;
  providerFilter?: string;
  statusFilter?: 'all' | 'succeeded' | 'failed';
  modeFilter?: LibraryModeFilter;
  timeFilter?: LibraryTimeFilter;
  colorFilter?: LibraryColorFilter;
  shapeFilter?: LibraryShapeFilter;
  formatFilter?: LibraryFormatFilter;
  ratingFilter?: LibraryRatingFilter;
};

export type LibraryCustomQuickFilter = {
  id: string;
  label: string;
  criteria: LibraryCustomQuickFilterCriteria;
  createdAt: string;
};

export type LibraryFolder = {
  id: string;
  name: string;
  color: string;
  createdAt: string;
};

export type LibraryCollection = {
  id: string;
  name: string;
  description?: string;
  coverRecordId?: string;
  createdAt: string;
};

export type LibraryOrganization = {
  folders: LibraryFolder[];
  collections: LibraryCollection[];
};

export type LibraryScope =
  | { type: 'all' }
  | { type: 'favorites' }
  | { type: 'recent7d' }
  | { type: 'recent-viewed' }
  | { type: 'local' }
  | { type: 'folder'; id: string }
  | { type: 'collection'; id: string };

export type LibraryOrganizerDialogState = {
  type: 'folder' | 'collection';
  mode: 'create' | 'rename';
  defaultName: string;
  targetId?: string;
};

export type LibraryAssignDialogState = {
  type: 'folder' | 'collection';
  recordIds: string[];
};

export type LibraryAddAction = 'folder' | 'collection' | 'import-file' | 'batch-folder';

export type LibraryContextMenuState = {
  x: number;
  y: number;
  recordId: string;
};

export const LIBRARY_META_STORAGE_KEY = 'visionhub.library.meta.v1';

export const LIBRARY_DISPLAY_STORAGE_KEY = 'visionhub.library.display.v1';

export const LIBRARY_CUSTOM_QUICK_FILTERS_STORAGE_KEY = 'visionhub.library.customQuickFilters.v1';

export const LIBRARY_ORGANIZATION_STORAGE_KEY = 'visionhub.library.organization.v1';

export const defaultLibraryDisplaySettings: LibraryDisplaySettings = {
  showPrompt: true,
  showProvider: true,
  showModel: true,
  showReferenceBadge: true,
  compact: false
};

export const libraryViewOptions: Array<{ value: LibraryViewMode; label: string }> = [
  { value: 'masonry', label: 'Masonry' },
  { value: 'adaptive', label: 'Adaptive' },
  { value: 'square', label: 'Square' },
  { value: 'contain', label: 'Full aspect ratio' },
  { value: 'list', label: 'List view' }
];

export const librarySortOptions: Array<{ value: LibrarySortMode; label: string }> = [
  { value: 'newest', label: 'Newest first' },
  { value: 'oldest', label: 'Oldest first' },
  { value: 'favorites', label: 'Favorites first' },
  { value: 'provider', label: 'Group by provider' },
  { value: 'model', label: 'Group by model' },
  { value: 'duration', label: 'Generation duration' },
  { value: 'size', label: 'Image size' },
  { value: 'filename', label: 'File name' },
  { value: 'recent-viewed', label: 'Recently viewed' },
  { value: 'recent-reference', label: 'Recently used as reference' }
];

export const libraryQuickFilters: Array<{ value: LibraryQuickFilter; label: string }> = [
  { value: 'favorites', label: 'Favorites' },
  { value: 'recent7d', label: 'Last 7 days' },
  { value: 'references', label: 'With references' },
  { value: 'failed', label: 'Failed' },
  { value: 'local', label: 'Saved locally' }
];

export const libraryShapeOptions: Array<{ value: LibraryShapeFilter; label: string }> = [
  { value: 'all', label: 'All shapes' },
  { value: 'landscape', label: 'Landscape' },
  { value: 'portrait', label: 'Portrait' },
  { value: 'square', label: 'Square' },
  { value: 'wide', label: 'Wide' },
  { value: 'tall', label: 'Tall' },
  { value: 'four-three', label: '4:3' },
  { value: 'three-four', label: '3:4' },
  { value: 'sixteen-nine', label: '16:9' },
  { value: 'nine-sixteen', label: '9:16' },
  { value: 'custom', label: 'Custom ratio' }
];

export const libraryFormatOptions: Array<{ value: LibraryFormatFilter; label: string }> = [
  { value: 'all', label: 'All formats' },
  { value: 'png', label: 'PNG' },
  { value: 'jpg', label: 'JPG' },
  { value: 'webp', label: 'WebP' },
  { value: 'gif', label: 'GIF' },
  { value: 'svg', label: 'SVG' },
  { value: 'unknown', label: 'Unknown format' }
];

export const libraryRatingOptions: Array<{ value: LibraryRatingFilter; label: string }> = [
  { value: 'all', label: 'All ratings' },
  { value: '5', label: '★★★★★' },
  { value: '4', label: '★★★★☆' },
  { value: '3', label: '★★★☆☆' },
  { value: '2', label: '★★☆☆☆' },
  { value: '1', label: '★☆☆☆☆' },
  { value: 'unrated', label: 'Unrated' }
];

export const libraryRatingValues = [1, 2, 3, 4, 5] as const;

export const libraryColorOptions: Array<{ value: LibraryColorFilter; label: string; color: string }> = [
  { value: 'all', label: 'All colors', color: '#64748b' },
  { value: 'red', label: 'Red', color: '#ef4444' },
  { value: 'orange', label: 'Orange', color: '#f97316' },
  { value: 'yellow', label: 'Yellow', color: '#eab308' },
  { value: 'green', label: 'Green', color: '#22c55e' },
  { value: 'cyan', label: 'Cyan', color: '#06b6d4' },
  { value: 'blue', label: 'Blue', color: '#3b82f6' },
  { value: 'purple', label: 'Purple', color: '#8b5cf6' },
  { value: 'pink', label: 'Pink', color: '#ec4899' },
  { value: 'mono', label: 'Monochrome', color: '#64748b' }
];

export const libraryAddActions: Array<{ id: LibraryAddAction; label: string; detail: string }> = [
  { id: 'folder', label: 'New folder', detail: 'Use it to organize local works later.' },
  { id: 'collection', label: 'New collection', detail: 'Best for projects, styles, or client archives.' },
  { id: 'import-file', label: 'Import local images', detail: 'Index one or more local images without moving source files.' },
  { id: 'batch-folder', label: 'Batch import folder', detail: 'Scan images inside the selected folder without moving source files.' }
];

export const libraryFolderColors = ['#14b8a6', '#3b82f6', '#f59e0b', '#ec4899', '#8b5cf6', '#22c55e'];

export type LibraryRecoveryAdviceKey =
  | 'backgroundPoll'
  | 'backgroundManual'
  | 'localPathMissingPreview'
  | 'remoteOnly'
  | 'noImage'
  | 'responseFormat'
  | 'failedGeneric';

export type LibraryRecoveryAdvice = {
  key: LibraryRecoveryAdviceKey;
};

export function rawObjectValue(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

export function readRawStringPath(raw: unknown, path: string[]) {
  let current: unknown = raw;
  for (const key of path) {
    const object = rawObjectValue(current);
    if (!object) return '';
    current = object[key];
  }
  return typeof current === 'string' ? current.trim() : '';
}

export function recordBackgroundPollUrl(record: Pick<GenerationRecord, 'raw'>) {
  return readRawStringPath(record.raw, ['poll_url']) || readRawStringPath(record.raw, ['visionhub_recovery', 'poll_url']);
}

export function buildLibraryRecoveryAdvice(record: GenerationRecord): LibraryRecoveryAdvice | null {
  const diagnosis = diagnoseGenerationFailure(record);
  const hasPreview = Boolean(record.imageUrls[0]);
  const hasLocalPath = Boolean(record.localImagePaths?.[0]);
  const hasPollUrl = Boolean(recordBackgroundPollUrl(record));

  if (diagnosis.isPotentialBackgroundCompletion) {
    return { key: hasPollUrl ? 'backgroundPoll' : 'backgroundManual' };
  }

  if (record.status === 'succeeded' && hasLocalPath && !hasPreview) {
    return { key: 'localPathMissingPreview' };
  }

  if (record.status === 'succeeded' && !hasLocalPath && hasPreview) {
    return { key: 'remoteOnly' };
  }

  if (record.status === 'failed' && diagnosis.category === 'no-image') {
    return { key: 'noImage' };
  }

  if (record.status === 'failed' && diagnosis.category === 'response-format') {
    return { key: 'responseFormat' };
  }

  if (record.status === 'failed') {
    return { key: 'failedGeneric' };
  }

  return null;
}

export function loadLibraryMeta(): LibraryMetaMap {
  const raw = readStorageValue(LIBRARY_META_STORAGE_KEY);
  if (!raw) return {};
  try {
    return normalizeLibraryMeta(JSON.parse(raw));
  } catch (error) {
    console.warn('[VisionHub] library meta parse failed; using empty meta', error);
    return {};
  }
}

export function normalizeLibraryMeta(value: unknown): LibraryMetaMap {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const normalized: LibraryMetaMap = {};
  Object.entries(value as Record<string, unknown>).forEach(([recordId, entry]) => {
    if (!recordId || !entry || typeof entry !== 'object' || Array.isArray(entry)) return;
    const source = entry as Record<string, unknown>;
    const next: LibraryMetaEntry = {};
    if (typeof source.favorite === 'boolean') next.favorite = source.favorite;
    if (Array.isArray(source.tags)) next.tags = source.tags.filter((tag): tag is string => typeof tag === 'string').map((tag) => tag.trim()).filter(Boolean);
    if (typeof source.folderId === 'string' && source.folderId.trim()) next.folderId = source.folderId.trim();
    if (Array.isArray(source.collectionIds)) next.collectionIds = source.collectionIds.filter((id): id is string => typeof id === 'string').map((id) => id.trim()).filter(Boolean);
    if (typeof source.note === 'string' && source.note.trim()) next.note = source.note;
    if (typeof source.rating === 'number' && Number.isFinite(source.rating) && source.rating >= 1 && source.rating <= 5) next.rating = source.rating;
    if (Array.isArray(source.colorPalette)) next.colorPalette = source.colorPalette.filter((color): color is string => typeof color === 'string');
    if (Array.isArray(source.colorFamilies)) next.colorFamilies = source.colorFamilies.filter((family): family is LibraryColorFilter => (
      typeof family === 'string' && ['all', 'red', 'orange', 'yellow', 'green', 'cyan', 'blue', 'purple', 'pink', 'mono'].includes(family)
    ));
    if (typeof source.imageSize === 'string' && source.imageSize.trim()) next.imageSize = source.imageSize.trim();
    if (typeof source.colorAnalyzedAt === 'string' && source.colorAnalyzedAt.trim()) next.colorAnalyzedAt = source.colorAnalyzedAt;
    if (typeof source.colorAnalysisFailed === 'boolean') next.colorAnalysisFailed = source.colorAnalysisFailed;
    if (typeof source.lastViewedAt === 'string' && source.lastViewedAt.trim()) next.lastViewedAt = source.lastViewedAt;
    if (typeof source.lastUsedAsReferenceAt === 'string' && source.lastUsedAsReferenceAt.trim()) next.lastUsedAsReferenceAt = source.lastUsedAsReferenceAt;
    if (Object.keys(next).length) normalized[recordId] = next;
  });
  return normalized;
}

export function saveLibraryMeta(meta: LibraryMetaMap) {
  writeStorageValue(LIBRARY_META_STORAGE_KEY, JSON.stringify(meta));
}

export function normalizeLibraryDisplaySettings(value: Partial<LibraryDisplaySettings> | null | undefined): LibraryDisplaySettings {
  return {
    showPrompt: typeof value?.showPrompt === 'boolean' ? value.showPrompt : defaultLibraryDisplaySettings.showPrompt,
    showProvider: typeof value?.showProvider === 'boolean' ? value.showProvider : defaultLibraryDisplaySettings.showProvider,
    showModel: typeof value?.showModel === 'boolean' ? value.showModel : defaultLibraryDisplaySettings.showModel,
    showReferenceBadge: typeof value?.showReferenceBadge === 'boolean' ? value.showReferenceBadge : defaultLibraryDisplaySettings.showReferenceBadge,
    compact: typeof value?.compact === 'boolean' ? value.compact : defaultLibraryDisplaySettings.compact
  };
}

export function loadLibraryDisplaySettings(): LibraryDisplaySettings {
  const raw = readStorageValue(LIBRARY_DISPLAY_STORAGE_KEY);
  if (!raw) return defaultLibraryDisplaySettings;
  try {
    return normalizeLibraryDisplaySettings(JSON.parse(raw) as Partial<LibraryDisplaySettings>);
  } catch (error) {
    console.warn('[VisionHub] library display settings parse failed; using defaults', error);
    return defaultLibraryDisplaySettings;
  }
}

export function saveLibraryDisplaySettings(settings: LibraryDisplaySettings) {
  const normalized = normalizeLibraryDisplaySettings(settings);
  writeStorageValue(LIBRARY_DISPLAY_STORAGE_KEY, JSON.stringify(normalized));
  return normalized;
}

export function loadLibraryCustomQuickFilters(): LibraryCustomQuickFilter[] {
  const raw = readStorageValue(LIBRARY_CUSTOM_QUICK_FILTERS_STORAGE_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as LibraryCustomQuickFilter[];
    return Array.isArray(parsed) ? parsed.filter((item) => item.id && item.label && item.criteria) : [];
  } catch (error) {
    console.warn('[VisionHub] library custom quick filters parse failed; using empty list', error);
    return [];
  }
}

export function saveLibraryCustomQuickFilters(filters: LibraryCustomQuickFilter[]) {
  writeStorageValue(LIBRARY_CUSTOM_QUICK_FILTERS_STORAGE_KEY, JSON.stringify(filters));
}

export function normalizeLibraryOrganization(value: Partial<LibraryOrganization> | null | undefined): LibraryOrganization {
  const folders = Array.isArray(value?.folders)
    ? value.folders
        .filter((folder): folder is LibraryFolder => Boolean(folder?.id && folder.name))
        .map((folder) => ({
          id: folder.id,
          name: folder.name,
          color: folder.color || libraryFolderColors[0],
          createdAt: folder.createdAt || new Date().toISOString()
        }))
    : [];
  const collections = Array.isArray(value?.collections)
    ? value.collections
        .filter((collection): collection is LibraryCollection => Boolean(collection?.id && collection.name))
        .map((collection) => ({
          id: collection.id,
          name: collection.name,
          description: collection.description,
          coverRecordId: collection.coverRecordId,
          createdAt: collection.createdAt || new Date().toISOString()
        }))
    : [];
  return { folders, collections };
}

export function loadLibraryOrganization(): LibraryOrganization {
  const raw = readStorageValue(LIBRARY_ORGANIZATION_STORAGE_KEY);
  if (!raw) return { folders: [], collections: [] };
  try {
    return normalizeLibraryOrganization(JSON.parse(raw) as Partial<LibraryOrganization>);
  } catch (error) {
    console.warn('[VisionHub] library organization parse failed; using empty organization', error);
    return { folders: [], collections: [] };
  }
}

export function saveLibraryOrganization(organization: LibraryOrganization) {
  writeStorageValue(LIBRARY_ORGANIZATION_STORAGE_KEY, JSON.stringify(organization));
}

export function normalizeLibraryCustomQuickFilters(value: unknown): LibraryCustomQuickFilter[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is LibraryCustomQuickFilter => Boolean(
    item && typeof item === 'object' && !Array.isArray(item) &&
    typeof (item as LibraryCustomQuickFilter).id === 'string' &&
    typeof (item as LibraryCustomQuickFilter).label === 'string' &&
    (item as LibraryCustomQuickFilter).criteria &&
    typeof (item as LibraryCustomQuickFilter).criteria === 'object'
  ));
}

export function buildLibraryDataPayload(
  meta: LibraryMetaMap,
  organization: LibraryOrganization,
  displaySettings: LibraryDisplaySettings,
  customQuickFilters: LibraryCustomQuickFilter[]
): LibraryDataPayload {
  return {
    version: 1,
    meta,
    organization,
    display_settings: displaySettings,
    custom_quick_filters: customQuickFilters
  };
}

export function compactLibraryMetaEntry(entry: LibraryMetaEntry): LibraryMetaEntry {
  const compacted = { ...entry };
  (Object.keys(compacted) as Array<keyof LibraryMetaEntry>).forEach((key) => {
    const value = compacted[key];
    if (value === undefined || (Array.isArray(value) && value.length === 0)) {
      delete compacted[key];
    }
  });
  return compacted;
}

export function parseSizePixels(size?: string) {
  if (!size) return 0;
  const match = size.match(/(\d+)\s*[x×]\s*(\d+)/i);
  if (!match) return 0;
  return Number(match[1]) * Number(match[2]);
}

export function parseSizeDimensions(size?: string): [number, number] | null {
  if (!size) return null;
  const match = size.match(/(\d+)\s*[x×]\s*(\d+)/i);
  if (!match) return null;
  return [Number(match[1]), Number(match[2])];
}

export function getRecordSizeLabel(record: GenerationRecord, meta?: LibraryMetaEntry) {
  const raw = record.raw as {
    size?: string;
    width?: number;
    height?: number;
    image_width?: number;
    image_height?: number;
    request?: { size?: string; width?: number; height?: number };
    output?: { size?: string; width?: number; height?: number };
  } | undefined;
  const width = raw?.width ?? raw?.image_width ?? raw?.output?.width ?? raw?.request?.width;
  const height = raw?.height ?? raw?.image_height ?? raw?.output?.height ?? raw?.request?.height;
  if (width && height) return `${width}x${height}`;
  return raw?.size ?? raw?.output?.size ?? raw?.request?.size ?? meta?.imageSize ?? '-';
}

export function formatBytes(bytes?: number, t?: Translator) {
  if (!bytes || !Number.isFinite(bytes) || bytes <= 0) return t ? t('common.status.unknown') : 'Unknown';
  const units = ['B', 'KB', 'MB', 'GB'];
  let value = bytes;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  return `${unitIndex === 0 ? Math.round(value) : value.toFixed(value >= 10 ? 1 : 2)} ${units[unitIndex]}`;
}

export function getRecordDataUrlBytes(source: string) {
  if (!source.startsWith('data:image/')) return undefined;
  const [, payload = ''] = source.split(',', 2);
  if (!payload) return undefined;
  if (source.includes(';base64,')) {
    const padding = payload.endsWith('==') ? 2 : payload.endsWith('=') ? 1 : 0;
    return Math.max(0, Math.floor((payload.length * 3) / 4) - padding);
  }
  try {
    return new TextEncoder().encode(decodeURIComponent(payload)).length;
  } catch {
    return payload.length;
  }
}

export function getRecordFileSizeLabel(record: GenerationRecord, t?: Translator) {
  const raw = record.raw as {
    fileSize?: number;
    file_size?: number;
    sizeBytes?: number;
    size_bytes?: number;
    bytes?: number;
    image_bytes?: number;
    output?: { fileSize?: number; file_size?: number; sizeBytes?: number; size_bytes?: number; bytes?: number };
  } | undefined;
  const byteSize =
    raw?.fileSize ??
    raw?.file_size ??
    raw?.sizeBytes ??
    raw?.size_bytes ??
    raw?.bytes ??
    raw?.image_bytes ??
    raw?.output?.fileSize ??
    raw?.output?.file_size ??
    raw?.output?.sizeBytes ??
    raw?.output?.size_bytes ??
    raw?.output?.bytes ??
    getRecordDataUrlBytes(record.imageUrls[0] ?? '');
  return formatBytes(byteSize, t);
}

export function getRecordFormatLabel(record: GenerationRecord, t?: Translator) {
  const format = getRecordFormat(record);
  const labels: Record<LibraryFormatFilter, string> = {
    all: 'All',
    png: 'PNG',
    jpg: 'JPG',
    webp: 'WebP',
    gif: 'GIF',
    svg: 'SVG',
    unknown: 'Unknown'
  };
  return t ? t(`library.format.${format}` as Parameters<Translator>[0]) : labels[format];
}

export function rgbToHex(red: number, green: number, blue: number) {
  return `#${[red, green, blue].map((value) => value.toString(16).padStart(2, '0')).join('')}`;
}

export function hexToRgb(hex: string) {
  const normalized = hex.trim().replace(/^#/, '');
  if (!/^[0-9a-f]{6}$/i.test(normalized)) return null;
  return {
    red: Number.parseInt(normalized.slice(0, 2), 16),
    green: Number.parseInt(normalized.slice(2, 4), 16),
    blue: Number.parseInt(normalized.slice(4, 6), 16)
  };
}

export function rgbToHsl(red: number, green: number, blue: number) {
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

export function getColorFamily(red: number, green: number, blue: number): LibraryColorFilter {
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

export function getFilterColorFamilies(filter: LibraryColorFilter): LibraryColorFilter[] {
  if (filter === 'all') return ['all'];
  if (filter === 'orange') return ['orange', 'red', 'yellow'];
  if (filter === 'cyan') return ['cyan', 'blue', 'green'];
  if (filter === 'purple') return ['purple', 'blue', 'pink'];
  if (filter === 'pink') return ['pink', 'red', 'purple'];
  return [filter];
}

export function colorPaletteMatchesFilter(palette: string[] | undefined, filter: LibraryColorFilter) {
  if (filter === 'all') return true;
  if (!palette?.length) return false;
  const accepted = new Set(getFilterColorFamilies(filter));
  return palette.some((hex) => {
    const rgb = hexToRgb(hex);
    if (!rgb) return false;
    return accepted.has(getColorFamily(rgb.red, rgb.green, rgb.blue));
  });
}

export function libraryColorMatchesFilter(meta: LibraryMetaEntry | undefined, filter: LibraryColorFilter) {
  if (filter === 'all') return true;
  if (!meta) return false;
  const accepted = new Set(getFilterColorFamilies(filter));
  return (
    Boolean(meta.colorFamilies?.some((family) => accepted.has(family))) ||
    colorPaletteMatchesFilter(meta.colorPalette, filter)
  );
}

export function analyzeImageColors(image: HTMLImageElement) {
  if (!image.naturalWidth || !image.naturalHeight) return null;
  const canvas = document.createElement('canvas');
  const size = 48;
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) return null;
  context.drawImage(image, 0, 0, size, size);
  const pixels = context.getImageData(0, 0, size, size).data;
  const buckets = new Map<string, { red: number; green: number; blue: number; count: number; score: number }>();
  const familyScores = new Map<LibraryColorFilter, number>();
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
}

export function ratioClose(left: number, right: number) {
  return Math.abs(left - right) < 0.04;
}

export function getRecordShapeTokens(record: GenerationRecord, meta?: LibraryMetaEntry): LibraryShapeFilter[] {
  const dimensions = parseSizeDimensions(getRecordSizeLabel(record, meta));
  if (!dimensions) return ['custom'];
  const [width, height] = dimensions;
  if (!width || !height) return ['custom'];
  const ratio = width / height;
  const tokens: LibraryShapeFilter[] = ['custom'];
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

export function getRecordFormat(record: GenerationRecord): LibraryFormatFilter {
  const source = getRecordPrimaryPath(record).toLowerCase();
  const dataUrlMatch = source.match(/^data:image\/([^;,]+)/);
  const extensionMatch = source.match(/\.([a-z0-9]+)(?:$|[?#])/);
  const rawFormat = dataUrlMatch?.[1] ?? extensionMatch?.[1] ?? '';
  if (rawFormat === 'jpeg' || rawFormat === 'jpg') return 'jpg';
  if (rawFormat === 'png') return 'png';
  if (rawFormat === 'webp') return 'webp';
  if (rawFormat === 'gif') return 'gif';
  if (rawFormat === 'svg' || rawFormat === 'svg+xml') return 'svg';
  return 'unknown';
}

export function sortLibraryRecords(records: GenerationRecord[], sortMode: LibrarySortMode, meta: LibraryMetaMap, providerNameMap: Map<string, string>) {
  return [...records].sort((a, b) => {
    if (sortMode === 'favorites') {
      const favoriteDiff = Number(Boolean(meta[b.id]?.favorite)) - Number(Boolean(meta[a.id]?.favorite));
      if (favoriteDiff !== 0) return favoriteDiff;
      return getRecordTimeMs(b.createdAt) - getRecordTimeMs(a.createdAt);
    }
    if (sortMode === 'oldest') return getRecordTimeMs(a.createdAt) - getRecordTimeMs(b.createdAt);
    if (sortMode === 'provider') {
      const left = providerNameMap.get(a.providerId) ?? a.providerName ?? a.providerId;
      const right = providerNameMap.get(b.providerId) ?? b.providerName ?? b.providerId;
      return left.localeCompare(right, 'zh-Hans-CN') || getRecordTimeMs(b.createdAt) - getRecordTimeMs(a.createdAt);
    }
    if (sortMode === 'model') {
      return a.modelId.localeCompare(b.modelId, 'zh-Hans-CN') || getRecordTimeMs(b.createdAt) - getRecordTimeMs(a.createdAt);
    }
    if (sortMode === 'duration') {
      return (b.durationMs ?? -1) - (a.durationMs ?? -1) || getRecordTimeMs(b.createdAt) - getRecordTimeMs(a.createdAt);
    }
    if (sortMode === 'size') {
      return parseSizePixels(getRecordSizeLabel(b, meta[b.id])) - parseSizePixels(getRecordSizeLabel(a, meta[a.id])) || getRecordTimeMs(b.createdAt) - getRecordTimeMs(a.createdAt);
    }
    if (sortMode === 'filename') {
      return getRecordFileName(a).localeCompare(getRecordFileName(b), 'zh-Hans-CN') || getRecordTimeMs(b.createdAt) - getRecordTimeMs(a.createdAt);
    }
    if (sortMode === 'recent-viewed') {
      return getRecordTimeMs(meta[b.id]?.lastViewedAt ?? '') - getRecordTimeMs(meta[a.id]?.lastViewedAt ?? '') || getRecordTimeMs(b.createdAt) - getRecordTimeMs(a.createdAt);
    }
    if (sortMode === 'recent-reference') {
      return getRecordTimeMs(meta[b.id]?.lastUsedAsReferenceAt ?? '') - getRecordTimeMs(meta[a.id]?.lastUsedAsReferenceAt ?? '') || getRecordTimeMs(b.createdAt) - getRecordTimeMs(a.createdAt);
    }
    return getRecordTimeMs(b.createdAt) - getRecordTimeMs(a.createdAt);
  });
}

export const LIBRARY_INITIAL_RENDER_COUNT = 18;

export const LIBRARY_RENDER_BATCH_SIZE = 18;

export const libraryFocusSearchEvent = 'visionhub:library-focus-search';
