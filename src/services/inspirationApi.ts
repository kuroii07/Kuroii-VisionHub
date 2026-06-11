import { invoke } from '@tauri-apps/api/core';
import type {
  InspirationAsset,
  InspirationAssetImportRequest,
  InspirationLibrary,
  InspirationSource
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
  tags: string[];
  note?: string;
  license_status: InspirationAsset['licenseStatus'];
  rating?: number;
  created_at: string;
  updated_at: string;
}

interface BackendInspirationLibrary {
  sources: BackendInspirationSource[];
  assets: BackendInspirationAsset[];
}

const LOCAL_STORAGE_KEY = 'visionhub.inspirations.fallback';
let cachedSources: InspirationSource[] | null = null;
let cachedAssets: InspirationAsset[] | null = null;

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
    tags: asset.tags ?? [],
    note: asset.note,
    license_status: asset.licenseStatus,
    rating: asset.rating,
    created_at: asset.createdAt,
    updated_at: asset.updatedAt
  };
}

function emptyLibrary(): InspirationLibrary {
  return { sources: [], assets: [] };
}

function loadFallbackLibrary(): InspirationLibrary {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (!raw) return emptyLibrary();
    const parsed = JSON.parse(raw) as InspirationLibrary;
    return {
      sources: Array.isArray(parsed.sources) ? parsed.sources : [],
      assets: Array.isArray(parsed.assets) ? parsed.assets : []
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
  const [sources, assets] = await Promise.all([loadInspirationSources(), loadInspirationAssets()]);
  return { sources, assets };
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
  if (!isTauriRuntime()) return loadFallbackLibrary();
  const result = await invoke<BackendInspirationLibrary>('load_inspirations');
  const library = {
    sources: (result.sources ?? []).map(mapSourceFromBackend),
    assets: (result.assets ?? []).map(mapAssetFromBackend)
  };
  cachedSources = library.sources;
  cachedAssets = library.assets;
  return library;
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
