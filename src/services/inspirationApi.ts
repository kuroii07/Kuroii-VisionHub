import { invoke } from '@tauri-apps/api/core';
import type {
  InspirationAsset,
  ImagePromptReverseDetail,
  ImagePromptReverseLanguage,
  ImagePromptReverseProtocol,
  InspirationAssetImportRequest,
  InspirationLibrary,
  InspirationSource,
  PromptExcerpt
} from '../domain/inspirationTypes';
import { isTauriRuntime } from './desktopApi';

interface BackendInspirationSource {
  id: string;
  name: string;
  url: string;
  category: InspirationSource['category'];
  region: InspirationSource['region'];
  source_kind?: InspirationSource['sourceKind'];
  tags: string[];
  keywords?: string[];
  note?: string;
  scene_notes?: string;
  membership_notes?: string;
  copyright_notes?: string;
  favicon_url?: string;
  requires_login?: boolean;
  commercial_reference: InspirationSource['commercialReference'];
  open_count?: number;
  created_at: string;
  updated_at: string;
  last_opened_at?: string;
}

interface BackendPromptExcerpt {
  id: string;
  title: string;
  prompt: string;
  source_name?: string;
  source_url?: string;
  language: PromptExcerpt['language'];
  category: PromptExcerpt['category'];
  tags: string[];
  note?: string;
  favorite?: boolean;
  created_at: string;
  updated_at: string;
  last_used_at?: string;
  used_count?: number;
}

interface BackendInspirationAsset {
  id: string;
  title: string;
  image_path?: string;
  image_url?: string;
  thumbnail_path?: string;
  source_url?: string;
  source_platform?: string;
  author?: string;
  original_prompt?: string;
  inferred_prompt?: string;
  reverse_prompt?: BackendImagePromptReverseResult;
  tags: string[];
  note?: string;
  license_status: InspirationAsset['licenseStatus'];
  rating?: number;
  created_at: string;
  updated_at: string;
}


interface BackendImagePromptReverseResult {
  prompt: string;
  language?: ImagePromptReverseLanguage;
  detail?: ImagePromptReverseDetail;
  model_id?: string;
  profile_id?: string;
  provider_id?: string;
  protocol?: ImagePromptReverseProtocol;
  generated_at: string;
  edited_at?: string;
  raw_summary?: unknown;
}

export interface ReverseImagePromptRequest {
  providerId: string;
  profileId?: string;
  modelId: string;
  baseUrl: string;
  protocol: ImagePromptReverseProtocol;
  endpointPath?: string;
  extraHeaders?: Record<string, string>;
  secretId?: string;
  imagePath?: string;
  imageUrl?: string;
  language: ImagePromptReverseLanguage;
  detail: ImagePromptReverseDetail;
}

export interface ReverseImagePromptResult {
  providerId: string;
  profileId?: string;
  modelId: string;
  protocol: ImagePromptReverseProtocol;
  prompt: string;
  rawSummary?: unknown;
  createdAt: string;
}

interface BackendInspirationLibrary {
  sources: BackendInspirationSource[];
  assets: BackendInspirationAsset[];
  excerpts?: BackendPromptExcerpt[];
}

const LOCAL_STORAGE_KEY = 'visionhub.inspirations.fallback';
let cachedSources: InspirationSource[] | null = null;
let cachedAssets: InspirationAsset[] | null = null;
let cachedExcerpts: PromptExcerpt[] | null = null;

function mapSourceFromBackend(source: BackendInspirationSource): InspirationSource {
  return {
    id: source.id,
    name: source.name,
    url: source.url,
    category: source.category,
    region: source.region,
    sourceKind: source.source_kind ?? 'custom',
    tags: source.tags ?? [],
    keywords: source.keywords ?? [],
    note: source.note,
    sceneNotes: source.scene_notes,
    membershipNotes: source.membership_notes,
    copyrightNotes: source.copyright_notes,
    faviconUrl: source.favicon_url,
    requiresLogin: source.requires_login,
    commercialReference: source.commercial_reference,
    openCount: source.open_count,
    createdAt: source.created_at,
    updatedAt: source.updated_at,
    lastOpenedAt: source.last_opened_at
  };
}

function mapSourceToBackend(source: InspirationSource): BackendInspirationSource {
  return {
    id: source.id,
    name: source.name,
    url: source.url,
    category: source.category,
    region: source.region,
    source_kind: source.sourceKind ?? 'custom',
    tags: source.tags ?? [],
    keywords: source.keywords ?? [],
    note: source.note,
    scene_notes: source.sceneNotes,
    membership_notes: source.membershipNotes,
    copyright_notes: source.copyrightNotes,
    favicon_url: source.faviconUrl,
    requires_login: source.requiresLogin,
    commercial_reference: source.commercialReference,
    open_count: source.openCount,
    created_at: source.createdAt,
    updated_at: source.updatedAt,
    last_opened_at: source.lastOpenedAt
  };
}

function mapReversePromptFromBackend(result?: BackendImagePromptReverseResult): InspirationAsset['reversePrompt'] {
  if (!result || !result.prompt?.trim()) return undefined;
  return {
    prompt: result.prompt,
    language: result.language,
    detail: result.detail,
    modelId: result.model_id,
    profileId: result.profile_id,
    providerId: result.provider_id,
    protocol: result.protocol,
    generatedAt: result.generated_at,
    editedAt: result.edited_at,
    rawSummary: result.raw_summary
  };
}

function mapReversePromptToBackend(result?: InspirationAsset['reversePrompt']): BackendImagePromptReverseResult | undefined {
  if (!result?.prompt?.trim()) return undefined;
  return {
    prompt: result.prompt,
    language: result.language,
    detail: result.detail,
    model_id: result.modelId,
    profile_id: result.profileId,
    provider_id: result.providerId,
    protocol: result.protocol,
    generated_at: result.generatedAt,
    edited_at: result.editedAt,
    raw_summary: result.rawSummary
  };
}

function mapAssetFromBackend(asset: BackendInspirationAsset): InspirationAsset {
  return {
    id: asset.id,
    title: asset.title,
    imagePath: asset.image_path,
    imageUrl: asset.image_url,
    thumbnailPath: asset.thumbnail_path,
    sourceUrl: asset.source_url,
    sourcePlatform: asset.source_platform,
    author: asset.author,
    originalPrompt: asset.original_prompt,
    inferredPrompt: asset.inferred_prompt,
    reversePrompt: mapReversePromptFromBackend(asset.reverse_prompt),
    tags: asset.tags ?? [],
    note: asset.note,
    licenseStatus: asset.license_status,
    rating: asset.rating,
    createdAt: asset.created_at,
    updatedAt: asset.updated_at
  };
}

function mapAssetToBackend(asset: InspirationAsset): BackendInspirationAsset {
  return {
    id: asset.id,
    title: asset.title,
    image_path: asset.imagePath,
    image_url: asset.imageUrl,
    thumbnail_path: asset.thumbnailPath,
    source_url: asset.sourceUrl,
    source_platform: asset.sourcePlatform,
    author: asset.author,
    original_prompt: asset.originalPrompt,
    inferred_prompt: asset.inferredPrompt,
    reverse_prompt: mapReversePromptToBackend(asset.reversePrompt),
    tags: asset.tags ?? [],
    note: asset.note,
    license_status: asset.licenseStatus,
    rating: asset.rating,
    created_at: asset.createdAt,
    updated_at: asset.updatedAt
  };
}


function mapExcerptFromBackend(excerpt: BackendPromptExcerpt): PromptExcerpt {
  return {
    id: excerpt.id,
    title: excerpt.title,
    prompt: excerpt.prompt,
    sourceName: excerpt.source_name,
    sourceUrl: excerpt.source_url,
    language: excerpt.language ?? 'auto',
    category: excerpt.category ?? 'general',
    tags: excerpt.tags ?? [],
    note: excerpt.note,
    favorite: excerpt.favorite,
    createdAt: excerpt.created_at,
    updatedAt: excerpt.updated_at,
    lastUsedAt: excerpt.last_used_at,
    usedCount: excerpt.used_count
  };
}

function mapExcerptToBackend(excerpt: PromptExcerpt): BackendPromptExcerpt {
  return {
    id: excerpt.id,
    title: excerpt.title,
    prompt: excerpt.prompt,
    source_name: excerpt.sourceName,
    source_url: excerpt.sourceUrl,
    language: excerpt.language,
    category: excerpt.category,
    tags: excerpt.tags ?? [],
    note: excerpt.note,
    favorite: excerpt.favorite,
    created_at: excerpt.createdAt,
    updated_at: excerpt.updatedAt,
    last_used_at: excerpt.lastUsedAt,
    used_count: excerpt.usedCount
  };
}

function emptyLibrary(): InspirationLibrary {
  return { sources: [], assets: [], excerpts: [] };
}

function loadFallbackLibrary(): InspirationLibrary {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (!raw) return emptyLibrary();
    const parsed = JSON.parse(raw) as InspirationLibrary;
    return {
      sources: Array.isArray(parsed.sources) ? parsed.sources : [],
      assets: Array.isArray(parsed.assets) ? parsed.assets : [],
      excerpts: Array.isArray(parsed.excerpts) ? parsed.excerpts : []
    };
  } catch (error) {
    console.warn('[VisionHub] inspiration fallback parse failed', error);
    return emptyLibrary();
  }
}

function saveFallbackLibrary(library: InspirationLibrary) {
  localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(library));
}

function nowId() {
  return String(Date.now());
}

export async function loadInspirationLibrary(): Promise<InspirationLibrary> {
  const [sources, assets, excerpts] = await Promise.all([loadInspirationSources(), loadInspirationAssets(), loadPromptExcerpts()]);
  return { sources, assets, excerpts };
}

export async function loadInspirationSources(): Promise<InspirationSource[]> {
  if (cachedSources) return cachedSources;
  if (!isTauriRuntime()) {
    cachedSources = loadFallbackLibrary().sources;
    return cachedSources;
  }
  const result = await invoke<BackendInspirationSource[]>('load_inspiration_sources');
  cachedSources = (result ?? []).map(mapSourceFromBackend);
  return cachedSources;
}

export async function loadInspirationAssets(): Promise<InspirationAsset[]> {
  if (cachedAssets) return cachedAssets;
  if (!isTauriRuntime()) {
    cachedAssets = loadFallbackLibrary().assets;
    return cachedAssets;
  }
  const result = await invoke<BackendInspirationAsset[]>('load_inspiration_assets');
  cachedAssets = (result ?? []).map(mapAssetFromBackend);
  return cachedAssets;
}

export async function reloadInspirationLibrary(): Promise<InspirationLibrary> {
  cachedSources = null;
  cachedAssets = null;
  cachedExcerpts = null;
  if (!isTauriRuntime()) return loadFallbackLibrary();
  const result = await invoke<BackendInspirationLibrary>('load_inspirations');
  const library = {
    sources: (result.sources ?? []).map(mapSourceFromBackend),
    assets: (result.assets ?? []).map(mapAssetFromBackend),
    excerpts: (result.excerpts ?? []).map(mapExcerptFromBackend)
  };
  cachedSources = library.sources;
  cachedAssets = library.assets;
  cachedExcerpts = library.excerpts;
  return library;
}


export async function loadPromptExcerpts(): Promise<PromptExcerpt[]> {
  if (cachedExcerpts) return cachedExcerpts;
  if (!isTauriRuntime()) {
    cachedExcerpts = loadFallbackLibrary().excerpts;
    return cachedExcerpts;
  }
  const result = await invoke<BackendPromptExcerpt[]>('load_prompt_excerpts');
  cachedExcerpts = (result ?? []).map(mapExcerptFromBackend);
  return cachedExcerpts;
}

export async function savePromptExcerpt(excerpt: PromptExcerpt): Promise<PromptExcerpt> {
  if (!isTauriRuntime()) {
    const library = loadFallbackLibrary();
    const nextExcerpt = { ...excerpt, updatedAt: nowId() };
    const excerpts = [nextExcerpt, ...library.excerpts.filter((item) => item.id !== excerpt.id)];
    saveFallbackLibrary({ ...library, excerpts });
    cachedExcerpts = excerpts;
    return nextExcerpt;
  }
  const saved = await invoke<BackendPromptExcerpt>('save_prompt_excerpt', {
    excerpt: mapExcerptToBackend(excerpt)
  });
  const nextExcerpt = mapExcerptFromBackend(saved);
  cachedExcerpts = [nextExcerpt, ...(cachedExcerpts ?? []).filter((item) => item.id !== nextExcerpt.id)];
  return nextExcerpt;
}

export async function deletePromptExcerpt(excerptId: string) {
  if (!isTauriRuntime()) {
    const library = loadFallbackLibrary();
    const excerpts = library.excerpts.filter((item) => item.id !== excerptId);
    saveFallbackLibrary({ ...library, excerpts });
    cachedExcerpts = excerpts;
    return { id: excerptId, deleted: true };
  }
  const result = await invoke<{ id: string; deleted: boolean }>('delete_prompt_excerpt', { excerptId });
  if (result.deleted) cachedExcerpts = (cachedExcerpts ?? []).filter((item) => item.id !== excerptId);
  return result;
}

export async function saveInspirationSource(source: InspirationSource): Promise<InspirationSource> {
  if (!isTauriRuntime()) {
    const library = loadFallbackLibrary();
    const nextSource = { ...source, updatedAt: nowId() };
    const sources = [nextSource, ...library.sources.filter((item) => item.id !== source.id)];
    saveFallbackLibrary({ ...library, sources });
    cachedSources = sources;
    return nextSource;
  }
  const saved = await invoke<BackendInspirationSource>('save_inspiration_source', {
    source: mapSourceToBackend(source)
  });
  const nextSource = mapSourceFromBackend(saved);
  cachedSources = [nextSource, ...(cachedSources ?? []).filter((item) => item.id !== nextSource.id)];
  return nextSource;
}

export async function deleteInspirationSource(sourceId: string) {
  if (!isTauriRuntime()) {
    const library = loadFallbackLibrary();
    const sources = library.sources.filter((item) => item.id !== sourceId);
    saveFallbackLibrary({ ...library, sources });
    cachedSources = sources;
    return { id: sourceId, deleted: true };
  }
  const result = await invoke<{ id: string; deleted: boolean }>('delete_inspiration_source', { sourceId });
  if (result.deleted) cachedSources = (cachedSources ?? []).filter((item) => item.id !== sourceId);
  return result;
}

export async function importInspirationAsset(request: InspirationAssetImportRequest): Promise<InspirationAsset> {
  if (!isTauriRuntime()) {
    const library = loadFallbackLibrary();
    const timestamp = nowId();
    const asset: InspirationAsset = {
      id: `fallback-${timestamp}`,
      title: request.title.trim() || request.fileName || '未命名灵感',
      imageUrl: request.dataUrl,
      sourceUrl: request.sourceUrl,
      sourcePlatform: request.sourcePlatform,
      author: request.author,
      originalPrompt: request.originalPrompt,
      tags: request.tags ?? [],
      note: request.note,
      licenseStatus: request.licenseStatus ?? 'reference-only',
      rating: request.rating,
      createdAt: timestamp,
      updatedAt: timestamp
    };
    const assets = [asset, ...library.assets];
    saveFallbackLibrary({ ...library, assets });
    cachedAssets = assets;
    return asset;
  }
  const saved = await invoke<BackendInspirationAsset>('import_inspiration_asset', {
    request: {
      title: request.title,
      data_url: request.dataUrl,
      file_name: request.fileName,
      source_url: request.sourceUrl,
      source_platform: request.sourcePlatform,
      author: request.author,
      original_prompt: request.originalPrompt,
      tags: request.tags ?? [],
      note: request.note,
      license_status: request.licenseStatus ?? 'reference-only',
      rating: request.rating
    }
  });
  const nextAsset = mapAssetFromBackend(saved);
  cachedAssets = [nextAsset, ...(cachedAssets ?? []).filter((item) => item.id !== nextAsset.id)];
  return nextAsset;
}

export async function saveInspirationAsset(asset: InspirationAsset): Promise<InspirationAsset> {
  if (!isTauriRuntime()) {
    const library = loadFallbackLibrary();
    const nextAsset = { ...asset, updatedAt: nowId() };
    const assets = [nextAsset, ...library.assets.filter((item) => item.id !== asset.id)];
    saveFallbackLibrary({ ...library, assets });
    cachedAssets = assets;
    return nextAsset;
  }
  const saved = await invoke<BackendInspirationAsset>('save_inspiration_asset', {
    asset: mapAssetToBackend(asset)
  });
  const nextAsset = mapAssetFromBackend(saved);
  cachedAssets = [nextAsset, ...(cachedAssets ?? []).filter((item) => item.id !== nextAsset.id)];
  return nextAsset;
}


export async function reverseImagePrompt(request: ReverseImagePromptRequest): Promise<ReverseImagePromptResult> {
  if (!isTauriRuntime()) {
    throw new Error('图片反推提示词需要在桌面版中调用已配置的视觉模型。');
  }
  const result = await invoke<{
    provider_id: string;
    profile_id?: string;
    model_id: string;
    protocol: ImagePromptReverseProtocol;
    prompt: string;
    raw_summary?: unknown;
    created_at: string;
  }>('reverse_image_prompt', {
    request: {
      provider_id: request.providerId,
      profile_id: request.profileId,
      model_id: request.modelId,
      base_url: request.baseUrl,
      protocol: request.protocol,
      endpoint_path: request.endpointPath,
      extra_headers: request.extraHeaders,
      secret_id: request.secretId,
      image_path: request.imagePath,
      image_url: request.imageUrl,
      language: request.language,
      detail: request.detail
    }
  });
  return {
    providerId: result.provider_id,
    profileId: result.profile_id,
    modelId: result.model_id,
    protocol: result.protocol,
    prompt: result.prompt,
    rawSummary: result.raw_summary,
    createdAt: result.created_at
  };
}

export async function deleteInspirationAsset(assetId: string) {
  if (!isTauriRuntime()) {
    const library = loadFallbackLibrary();
    const assets = library.assets.filter((item) => item.id !== assetId);
    saveFallbackLibrary({ ...library, assets });
    cachedAssets = assets;
    return { id: assetId, deleted: true };
  }
  const result = await invoke<{ id: string; deleted: boolean }>('delete_inspiration_asset', { assetId });
  if (result.deleted) cachedAssets = (cachedAssets ?? []).filter((item) => item.id !== assetId);
  return result;
}
