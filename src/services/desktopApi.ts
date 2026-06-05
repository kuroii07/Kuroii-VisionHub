import { invoke } from '@tauri-apps/api/core';
import type { GenerationMode, GenerationRecord, ImageGenerationRequest, ImageGenerationResult, ReferenceImage } from '../domain/providerTypes';
import type { AppSettings, PromptPolishSettings } from './appSettings';

declare global {
  interface Window {
    __TAURI_INTERNALS__?: unknown;
  }
}

interface BackendImageGenerationResult {
  id: string;
  provider_id: string;
  model_id: string;
  status: ImageGenerationResult['status'];
  prompt: string;
  image_urls: string[];
  local_image_paths?: string[];
  cost_hint?: string;
  duration_ms?: number;
  error?: string;
  raw?: unknown;
  created_at: string;
  generation_mode?: GenerationMode;
  reference_images?: BackendReferenceImage[];
}

interface BackendGenerationRecord extends BackendImageGenerationResult {
  provider_name?: string;
  saved_at?: string;
}

interface BackendReferenceImage {
  id: string;
  name?: string;
  mime_type?: string;
  data_url?: string;
  local_path?: string;
  preview_url?: string;
  source: ReferenceImage['source'];
  source_generation_id?: string;
}

interface BackendModelInfo {
  id: string;
  owned_by?: string;
}

interface BackendPromptPolishResult {
  provider_id: string;
  model_id: string;
  prompt: string;
  polished_prompt: string;
  raw: unknown;
  created_at: string;
}

export interface PromptPolishRequest {
  providerId: string;
  modelId: string;
  prompt: string;
  modeId: string;
  settings: PromptPolishSettings;
  baseUrl?: string;
  extraHeaders?: Record<string, string>;
}

export interface PromptPolishResult {
  providerId: string;
  modelId: string;
  prompt: string;
  polishedPrompt: string;
  raw: unknown;
  createdAt: string;
}

export interface AppPaths {
  app_data_dir: string;
  library_dir: string;
  backups_dir: string;
  history_file: string;
}

export interface SettingsBackupResult {
  path: string;
  created_at: string;
}

export interface StorageSettings {
  library_dir_override?: string | null;
  default_library_dir: string;
  resolved_library_dir: string;
  settings_file: string;
}

export function isTauriRuntime() {
  return typeof window !== 'undefined' && Boolean(window.__TAURI_INTERNALS__);
}

function mapReferenceToBackend(reference: ReferenceImage): BackendReferenceImage {
  return {
    id: reference.id,
    name: reference.name,
    mime_type: reference.mimeType,
    data_url: reference.dataUrl,
    local_path: reference.localPath,
    preview_url: reference.previewUrl,
    source: reference.source,
    source_generation_id: reference.sourceGenerationId
  };
}

function mapBackendReference(reference: BackendReferenceImage): ReferenceImage {
  return {
    id: reference.id,
    name: reference.name,
    mimeType: reference.mime_type,
    dataUrl: reference.data_url,
    localPath: reference.local_path,
    previewUrl: reference.preview_url,
    source: reference.source,
    sourceGenerationId: reference.source_generation_id
  };
}

function mapBackendResult(result: BackendImageGenerationResult): ImageGenerationResult {
  const localPaths = result.local_image_paths ?? [];
  return {
    id: result.id,
    providerId: result.provider_id,
    modelId: result.model_id,
    status: result.status,
    prompt: result.prompt,
    imageUrls: result.image_urls,
    localImagePaths: localPaths,
    costHint: result.cost_hint,
    durationMs: result.duration_ms,
    error: result.error,
    raw: result.raw,
    createdAt: result.created_at,
    generationMode: result.generation_mode ?? 'text-to-image',
    referenceImages: (result.reference_images ?? []).map(mapBackendReference)
  };
}

function mapBackendRecord(record: BackendGenerationRecord): GenerationRecord {
  return {
    ...mapBackendResult(record),
    providerName: record.provider_name,
    savedAt: record.saved_at
  };
}

export async function saveProviderSecret(providerId: string, secret: string) {
  return invoke<{ provider_id: string; available: boolean }>('save_provider_secret', {
    request: { provider_id: providerId, secret }
  });
}

export async function getProviderSecretStatus(providerId: string) {
  return invoke<{ provider_id: string; available: boolean }>('get_provider_secret_status', {
    providerId
  });
}

export async function deleteProviderSecret(providerId: string) {
  return invoke<{ provider_id: string; available: boolean }>('delete_provider_secret', {
    providerId
  });
}

export async function generateOpenAIImage(request: ImageGenerationRequest) {
  const result = await invoke<BackendImageGenerationResult>('generate_openai_image', {
    request: {
      provider_id: request.providerId,
      model_id: request.modelId,
      prompt: request.prompt,
      size: request.size,
      quality: request.quality,
      count: request.count,
      base_url: request.baseUrl,
      protocol: request.protocol,
      endpoint_path: request.endpointPath,
      extra_headers: request.extraHeaders,
      secret_id: request.secretId,
      generation_mode: request.generationMode,
      reference_images: request.references?.map(mapReferenceToBackend)
    }
  });

  return mapBackendResult(result);
}

export async function listOpenAICompatibleModels(
  providerId: string,
  baseUrl: string,
  extraHeaders?: Record<string, string>,
  secretId?: string
) {
  const models = await invoke<BackendModelInfo[]>('list_openai_compatible_models', {
    request: {
      provider_id: providerId,
      base_url: baseUrl,
      extra_headers: extraHeaders,
      secret_id: secretId
    }
  });
  return models;
}

export async function polishPromptWithProvider(request: PromptPolishRequest): Promise<PromptPolishResult> {
  if (!isTauriRuntime()) {
    throw new Error('模型润色需要桌面运行时；浏览器预览会自动使用本地规则润色。');
  }

  const result = await invoke<BackendPromptPolishResult>('polish_prompt_with_provider', {
    request: {
      provider_id: request.providerId,
      model_id: request.modelId,
      prompt: request.prompt,
      mode_id: request.modeId,
      language: request.settings.language,
      strength: request.settings.strength,
      protocol: request.settings.protocol,
      base_url: request.baseUrl,
      extra_headers: request.extraHeaders
    }
  });

  return {
    providerId: result.provider_id,
    modelId: result.model_id,
    prompt: result.prompt,
    polishedPrompt: result.polished_prompt,
    raw: result.raw,
    createdAt: result.created_at
  };
}

export async function loadGenerationHistory() {
  if (!isTauriRuntime()) return [];
  const records = await invoke<BackendGenerationRecord[]>('load_generation_history');
  return records.map(mapBackendRecord);
}

export async function saveGenerationRecord(record: ImageGenerationResult, providerName?: string) {
  if (!isTauriRuntime()) return record;
  const hasLocalImages = (record.localImagePaths ?? []).length > 0;
  const saved = await invoke<BackendGenerationRecord>('save_generation_record', {
    record: {
      id: record.id,
      provider_id: record.providerId,
      provider_name: providerName,
      model_id: record.modelId,
      status: record.status,
      prompt: record.prompt,
      image_urls: hasLocalImages
        ? record.imageUrls.filter((url) => !url.startsWith('data:image/'))
        : record.imageUrls,
      local_image_paths: record.localImagePaths ?? [],
      cost_hint: record.costHint,
      duration_ms: record.durationMs,
      error: record.error,
      raw: record.raw ?? null,
      created_at: record.createdAt,
      generation_mode: record.generationMode ?? 'text-to-image',
      reference_images: (record.referenceImages ?? []).map(mapReferenceToBackend)
    }
  });
  return mapBackendRecord(saved);
}


export async function deleteGenerationRecord(recordId: string) {
  if (!isTauriRuntime()) return { id: recordId, deleted: true };
  return invoke<{ id: string; deleted: boolean }>('delete_generation_record', { recordId });
}
export async function revealGenerationFile(path: string) {
  if (!isTauriRuntime()) return;
  await invoke('reveal_generation_file', { path });
}

export async function getAppPaths() {
  if (!isTauriRuntime()) return null;
  return invoke<AppPaths>('get_app_paths');
}

export async function revealAppDataDir() {
  if (!isTauriRuntime()) return;
  await invoke('reveal_app_data_dir');
}

export async function revealLibraryDir() {
  if (!isTauriRuntime()) return;
  await invoke('reveal_library_dir');
}

export async function getStorageSettings() {
  if (!isTauriRuntime()) return null;
  return invoke<StorageSettings>('get_storage_settings');
}

export async function saveStorageSettings(libraryDirOverride?: string) {
  return invoke<StorageSettings>('save_storage_settings', {
    request: {
      library_dir_override: libraryDirOverride
    }
  });
}

export async function chooseLibraryDir() {
  if (!isTauriRuntime()) return null;
  return invoke<StorageSettings | null>('choose_library_dir');
}

export async function openExternalUrl(url: string) {
  if (!isTauriRuntime()) {
    window.open(url, '_blank', 'noopener,noreferrer');
    return;
  }
  await invoke('open_external_url', { url });
}

export async function exportSettingsBackup(request: {
  appSettings: AppSettings;
  providerConfigs: unknown;
}) {
  return invoke<SettingsBackupResult>('export_settings_backup', {
    request: {
      app_settings: request.appSettings,
      provider_configs: request.providerConfigs
    }
  });
}

