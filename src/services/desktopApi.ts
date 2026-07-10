import { convertFileSrc, invoke } from '@tauri-apps/api/core';
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

interface BackendImportLibraryImagesResult {
  records: BackendGenerationRecord[];
  skipped_duplicates?: number;
  skipped_unsupported?: number;
}

interface BackendLibraryThumbnailResult {
  source_path: string;
  thumbnail_path?: string;
  width?: number;
  height?: number;
  cache_hit: boolean;
  error?: string;
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
  role?: ReferenceImage['role'];
  added_at?: string;
}

interface BackendModelInfo {
  id: string;
  owned_by?: string;
}

export interface ComfyUIDiagnosisEndpoint {
  path: string;
  ok: boolean;
  status: number | null;
  detail: string;
}

export interface ComfyUIDiagnosisResult {
  baseUrl: string;
  resolvedBaseUrl: string;
  checkedAt: string;
  latencyMs: number;
  online: boolean;
  systemStats?: unknown;
  objectInfoNodeCount?: number | null;
  queueRunning?: number | null;
  queuePending?: number | null;
  endpoints: ComfyUIDiagnosisEndpoint[];
  message: string;
}

interface BackendComfyUIGenerationResult extends BackendImageGenerationResult {}

interface BackendComfyUIDiagnosisResult {
  base_url: string;
  resolved_base_url: string;
  checked_at: string;
  latency_ms: number;
  online: boolean;
  system_stats?: unknown;
  object_info_node_count?: number | null;
  queue_running?: number | null;
  queue_pending?: number | null;
  endpoints: ComfyUIDiagnosisEndpoint[];
  message: string;
}

export interface SdWebUIDiagnosisResult {
  baseUrl: string;
  resolvedBaseUrl: string;
  checkedAt: string;
  latencyMs: number;
  online: boolean;
  sdModelCheckpoint?: string | null;
  samplerCount?: number | null;
  modelCount?: number | null;
  endpoints: ComfyUIDiagnosisEndpoint[];
  message: string;
}

interface BackendSdWebUIDiagnosisResult {
  base_url: string;
  resolved_base_url: string;
  checked_at: string;
  latency_ms: number;
  online: boolean;
  sd_model_checkpoint?: string | null;
  sampler_count?: number | null;
  model_count?: number | null;
  endpoints: ComfyUIDiagnosisEndpoint[];
  message: string;
}

interface BackendSdWebUIGenerationResult extends BackendImageGenerationResult {}

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
  styleId?: string;
  settings: PromptPolishSettings;
  baseUrl?: string;
  extraHeaders?: Record<string, string>;
  secretId?: string;
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
  library_meta_file?: string;
}

export interface SettingsBackupResult {
  path: string;
  created_at: string;
}

export interface SaveTextFileResult {
  path?: string | null;
  saved: boolean;
}

export interface StorageSettings {
  library_dir_override?: string | null;
  inspiration_dir_override?: string | null;
  default_library_dir: string;
  resolved_library_dir: string;
  default_inspiration_dir: string;
  resolved_inspiration_dir: string;
  settings_file: string;
}

export interface LibraryDataPayload {
  version?: number;
  exists?: boolean;
  meta?: unknown;
  organization?: unknown;
  display_settings?: unknown;
  custom_quick_filters?: unknown;
  updated_at?: string | null;
}

export interface LibraryThumbnail {
  sourcePath: string;
  thumbnailPath?: string;
  thumbnailUrl?: string;
  width?: number;
  height?: number;
  cacheHit: boolean;
  error?: string;
}

export function isTauriRuntime() {
  return typeof window !== 'undefined' && Boolean(window.__TAURI_INTERNALS__);
}

function mapReferenceToBackend(reference: ReferenceImage): BackendReferenceImage {
  return {
    id: reference.id,
    name: reference.name,
    mime_type: reference.mimeType,
    data_url: isInlineImageUrl(reference.dataUrl) ? reference.dataUrl : undefined,
    local_path: reference.localPath,
    preview_url: isBackendSafeImageUrl(reference.previewUrl) ? reference.previewUrl : undefined,
    source: reference.source,
    source_generation_id: reference.sourceGenerationId,
    role: reference.role,
    added_at: reference.addedAt
  };
}

function mapBackendReference(reference: BackendReferenceImage): ReferenceImage {
  const previewUrl =
    reference.preview_url ??
    reference.data_url ??
    localPathToDisplayUrl(reference.local_path);
  return {
    id: reference.id,
    name: reference.name,
    mimeType: reference.mime_type,
    dataUrl: reference.data_url,
    localPath: reference.local_path,
    previewUrl,
    source: reference.source,
    sourceGenerationId: reference.source_generation_id,
    role: reference.role,
    addedAt: reference.added_at
  };
}

function mapBackendResult(result: BackendImageGenerationResult): ImageGenerationResult {
  const localPaths = result.local_image_paths ?? [];
  const displayImageUrls = localPaths.length
    ? localPaths.map(localPathToDisplayUrl).filter((url): url is string => Boolean(url))
    : result.image_urls.map(imageUrlToDisplayUrl);
  return {
    id: result.id,
    providerId: result.provider_id,
    modelId: result.model_id,
    status: result.status,
    prompt: result.prompt,
    imageUrls: displayImageUrls,
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

function isInlineImageUrl(value?: string) {
  return Boolean(value?.startsWith('data:image/'));
}

function isHttpImageUrl(value?: string) {
  return Boolean(value && /^https?:\/\//i.test(value));
}

function isAssetImageUrl(value?: string) {
  return Boolean(value && /^(asset|tauri):\/\//i.test(value));
}

function isBackendSafeImageUrl(value?: string) {
  return isInlineImageUrl(value) || isHttpImageUrl(value);
}

function localPathToDisplayUrl(path?: string) {
  if (!path) return undefined;
  if (isInlineImageUrl(path) || isHttpImageUrl(path) || isAssetImageUrl(path)) return path;
  if (!isTauriRuntime()) return path;
  return convertFileSrc(path);
}

function imageUrlToDisplayUrl(value: string) {
  return localPathToDisplayUrl(value) ?? value;
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
      negative_prompt: request.negativePrompt,
      size: request.size,
      quality: request.quality,
      seed: request.seed,
      output_format: request.outputFormat,
      output_compression: request.outputCompression,
      count: request.count,
      base_url: request.baseUrl,
      protocol: request.protocol,
      image_to_image_adapter: request.imageToImageAdapter,
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

export async function diagnoseComfyUIConnection(request: { baseUrl: string; timeoutMs?: number }): Promise<ComfyUIDiagnosisResult> {
  const result = await invoke<BackendComfyUIDiagnosisResult>('diagnose_comfyui_connection', {
    request: {
      base_url: request.baseUrl,
      timeout_ms: request.timeoutMs
    }
  });
  return {
    baseUrl: result.base_url,
    resolvedBaseUrl: result.resolved_base_url,
    checkedAt: result.checked_at,
    latencyMs: result.latency_ms,
    online: result.online,
    systemStats: result.system_stats,
    objectInfoNodeCount: result.object_info_node_count,
    queueRunning: result.queue_running,
    queuePending: result.queue_pending,
    endpoints: result.endpoints,
    message: result.message
  };
}

export async function generateComfyUIImage(request: {
  baseUrl: string;
  workflow: unknown;
  workflowName?: string;
  prompt: string;
  negativePrompt?: string;
  size: string;
  seed?: number;
  count?: number;
  outputFormat?: ImageGenerationRequest['outputFormat'];
  outputCompression?: ImageGenerationRequest['outputCompression'];
  timeoutMs?: number;
  generationMode?: ImageGenerationRequest['generationMode'];
  references?: ReferenceImage[];
}) {
  const result = await invoke<BackendComfyUIGenerationResult>('generate_comfyui_image', {
    request: {
      base_url: request.baseUrl,
      workflow: request.workflow,
      workflow_name: request.workflowName,
      prompt: request.prompt,
      negative_prompt: request.negativePrompt,
      size: request.size,
      seed: request.seed,
      count: request.count,
      output_format: request.outputFormat,
      output_compression: request.outputCompression,
      timeout_ms: request.timeoutMs,
      generation_mode: request.generationMode,
      reference_images: request.references?.map(mapReferenceToBackend)
    }
  });
  return mapBackendResult(result);
}

export async function diagnoseSdWebUIConnection(request: { baseUrl: string; timeoutMs?: number }): Promise<SdWebUIDiagnosisResult> {
  const result = await invoke<BackendSdWebUIDiagnosisResult>('diagnose_sd_webui_connection', {
    request: {
      base_url: request.baseUrl,
      timeout_ms: request.timeoutMs
    }
  });
  return {
    baseUrl: result.base_url,
    resolvedBaseUrl: result.resolved_base_url,
    checkedAt: result.checked_at,
    latencyMs: result.latency_ms,
    online: result.online,
    sdModelCheckpoint: result.sd_model_checkpoint,
    samplerCount: result.sampler_count,
    modelCount: result.model_count,
    endpoints: result.endpoints,
    message: result.message
  };
}

export async function generateSdWebUIImage(request: {
  baseUrl: string;
  prompt: string;
  negativePrompt?: string;
  size: string;
  seed?: number;
  count?: number;
  outputFormat?: ImageGenerationRequest['outputFormat'];
  outputCompression?: ImageGenerationRequest['outputCompression'];
  timeoutMs?: number;
  samplerName?: string;
  steps?: number;
  cfgScale?: number;
}) {
  const result = await invoke<BackendSdWebUIGenerationResult>('generate_sd_webui_image', {
    request: {
      base_url: request.baseUrl,
      prompt: request.prompt,
      negative_prompt: request.negativePrompt,
      size: request.size,
      seed: request.seed,
      count: request.count,
      output_format: request.outputFormat,
      output_compression: request.outputCompression,
      timeout_ms: request.timeoutMs,
      sampler_name: request.samplerName,
      steps: request.steps,
      cfg_scale: request.cfgScale
    }
  });
  return mapBackendResult(result);
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
      style_id: request.styleId,
      language: request.settings.language,
      strength: request.settings.strength,
      protocol: request.settings.protocol,
      base_url: request.baseUrl,
      extra_headers: request.extraHeaders,
      secret_id: request.secretId
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

export async function loadLibraryData() {
  if (!isTauriRuntime()) return null;
  return invoke<LibraryDataPayload>('load_library_data');
}

export async function saveLibraryData(data: LibraryDataPayload) {
  if (!isTauriRuntime()) return data;
  return invoke<LibraryDataPayload>('save_library_data', { data });
}

export async function prepareLibraryThumbnails(paths: string[], maxEdge = 512): Promise<LibraryThumbnail[]> {
  if (!isTauriRuntime() || paths.length === 0) return [];
  const results = await invoke<BackendLibraryThumbnailResult[]>('prepare_library_thumbnails', {
    request: {
      paths,
      max_edge: maxEdge
    }
  });
  return results.map((result) => ({
    sourcePath: result.source_path,
    thumbnailPath: result.thumbnail_path,
    thumbnailUrl: localPathToDisplayUrl(result.thumbnail_path),
    width: result.width,
    height: result.height,
    cacheHit: result.cache_hit,
    error: result.error
  }));
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

export async function recheckBackgroundGeneration(
  recordId: string,
  options?: { secretId?: string; extraHeaders?: Record<string, string> }
) {
  if (!isTauriRuntime()) {
    throw new Error('后台任务重查需要 Tauri 桌面端运行时。');
  }
  const record = await invoke<BackendGenerationRecord>('recheck_background_generation', {
    request: {
      record_id: recordId,
      secret_id: options?.secretId,
      extra_headers: options?.extraHeaders
    }
  });
  return mapBackendRecord(record);
}


export async function deleteGenerationRecord(recordId: string) {
  if (!isTauriRuntime()) return { id: recordId, deleted: true };
  return invoke<{ id: string; deleted: boolean }>('delete_generation_record', { recordId });
}

export async function importLibraryImagesFromFiles() {
  if (!isTauriRuntime()) return { records: [], skippedDuplicates: 0, skippedUnsupported: 0 };
  const result = await invoke<BackendImportLibraryImagesResult>('import_library_images_from_files');
  return {
    records: result.records.map(mapBackendRecord),
    skippedDuplicates: result.skipped_duplicates ?? 0,
    skippedUnsupported: result.skipped_unsupported ?? 0
  };
}

export async function importLibraryImagesFromFolder() {
  if (!isTauriRuntime()) return { records: [], skippedDuplicates: 0, skippedUnsupported: 0 };
  const result = await invoke<BackendImportLibraryImagesResult>('import_library_images_from_folder');
  return {
    records: result.records.map(mapBackendRecord),
    skippedDuplicates: result.skipped_duplicates ?? 0,
    skippedUnsupported: result.skipped_unsupported ?? 0
  };
}

export async function referenceImagesFromPaths(paths: string[], limit = 4) {
  if (!isTauriRuntime() || paths.length === 0) return [];
  const references = await invoke<BackendReferenceImage[]>('reference_images_from_paths', {
    request: { paths, limit }
  });
  return references.map(mapBackendReference);
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

export async function revealBackupsDir() {
  if (!isTauriRuntime()) return;
  await invoke('reveal_backups_dir');
}

export async function revealInspirationDir() {
  if (!isTauriRuntime()) return;
  await invoke('reveal_inspiration_dir');
}

export async function getStorageSettings() {
  if (!isTauriRuntime()) return null;
  return invoke<StorageSettings>('get_storage_settings');
}

export async function saveStorageSettings(options?: { libraryDirOverride?: string | null; inspirationDirOverride?: string | null }) {
  return invoke<StorageSettings>('save_storage_settings', {
    request: {
      library_dir_override: options?.libraryDirOverride,
      inspiration_dir_override: options?.inspirationDirOverride
    }
  });
}

export async function chooseLibraryDir() {
  if (!isTauriRuntime()) return null;
  return invoke<StorageSettings | null>('choose_library_dir');
}

export async function chooseInspirationDir() {
  if (!isTauriRuntime()) return null;
  return invoke<StorageSettings | null>('choose_inspiration_dir');
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

export async function saveTextFileWithDialog(request: { suggestedFileName: string; content: string }) {
  return invoke<SaveTextFileResult>('save_text_file_with_dialog', {
    request: {
      suggested_file_name: request.suggestedFileName,
      content: request.content
    }
  });
}
