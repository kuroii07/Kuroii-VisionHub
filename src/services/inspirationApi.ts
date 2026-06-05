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
  tags: string[];
  note?: string;
  requires_login?: boolean;
  commercial_reference: InspirationSource['commercialReference'];
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
  created_at: string;
  updated_at: string;
}

interface BackendInspirationLibrary {
  sources: BackendInspirationSource[];
  assets: BackendInspirationAsset[];
}

const LOCAL_STORAGE_KEY = 'visionhub.inspirations.fallback';

function mapSourceFromBackend(source: BackendInspirationSource): InspirationSource {
  return {
    id: source.id,
    name: source.name,
    url: source.url,
    category: source.category,
    region: source.region,
    tags: source.tags ?? [],
    note: source.note,
    requiresLogin: source.requires_login,
    commercialReference: source.commercial_reference,
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
    tags: source.tags ?? [],
    note: source.note,
    requires_login: source.requiresLogin,
    commercial_reference: source.commercialReference,
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
  if (!isTauriRuntime()) return loadFallbackLibrary();
  const result = await invoke<BackendInspirationLibrary>('load_inspirations');
  return {
    sources: (result.sources ?? []).map(mapSourceFromBackend),
    assets: (result.assets ?? []).map(mapAssetFromBackend)
  };
}

export async function saveInspirationSource(source: InspirationSource): Promise<InspirationSource> {
  if (!isTauriRuntime()) {
    const library = loadFallbackLibrary();
    const nextSource = { ...source, updatedAt: nowId() };
    const sources = [nextSource, ...library.sources.filter((item) => item.id !== source.id)];
    saveFallbackLibrary({ ...library, sources });
    return nextSource;
  }
  const saved = await invoke<BackendInspirationSource>('save_inspiration_source', {
    source: mapSourceToBackend(source)
  });
  return mapSourceFromBackend(saved);
}

export async function deleteInspirationSource(sourceId: string) {
  if (!isTauriRuntime()) {
    const library = loadFallbackLibrary();
    saveFallbackLibrary({ ...library, sources: library.sources.filter((item) => item.id !== sourceId) });
    return { id: sourceId, deleted: true };
  }
  return invoke<{ id: string; deleted: boolean }>('delete_inspiration_source', { sourceId });
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
      createdAt: timestamp,
      updatedAt: timestamp
    };
    saveFallbackLibrary({ ...library, assets: [asset, ...library.assets] });
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
      license_status: request.licenseStatus ?? 'reference-only'
    }
  });
  return mapAssetFromBackend(saved);
}

export async function saveInspirationAsset(asset: InspirationAsset): Promise<InspirationAsset> {
  if (!isTauriRuntime()) {
    const library = loadFallbackLibrary();
    const nextAsset = { ...asset, updatedAt: nowId() };
    const assets = [nextAsset, ...library.assets.filter((item) => item.id !== asset.id)];
    saveFallbackLibrary({ ...library, assets });
    return nextAsset;
  }
  const saved = await invoke<BackendInspirationAsset>('save_inspiration_asset', {
    asset: mapAssetToBackend(asset)
  });
  return mapAssetFromBackend(saved);
}

export async function deleteInspirationAsset(assetId: string) {
  if (!isTauriRuntime()) {
    const library = loadFallbackLibrary();
    saveFallbackLibrary({ ...library, assets: library.assets.filter((item) => item.id !== assetId) });
    return { id: assetId, deleted: true };
  }
  return invoke<{ id: string; deleted: boolean }>('delete_inspiration_asset', { assetId });
}
