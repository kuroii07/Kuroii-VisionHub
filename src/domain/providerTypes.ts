export type ProviderPhase =
  | 'official-api'
  | 'official-or-enterprise-api'
  | 'aggregator'
  | 'local-lab';

export type ProviderExecutionMode =
  | 'sync'
  | 'async-polling'
  | 'streaming'
  | 'openai-compatible'
  | 'custom-http';

export type ProviderCapability =
  | 'textToImage'
  | 'imageToImage'
  | 'editImage'
  | 'multiReferenceImage'
  | 'generateSeries'
  | 'imageToVideo'
  | 'promptPolish'
  | 'chineseTextRendering'
  | 'localWorkflow';

export type ProviderCapabilityStatus =
  | 'supported'
  | 'partial'
  | 'planned'
  | 'unknown'
  | 'unsupported';

export interface ProviderModelPreset {
  id: string;
  label: string;
  description: string;
  defaultSize: string;
  defaultQuality?: string;
  tags: string[];
}

export interface ProviderTextModelPreset {
  id: string;
  label: string;
  description: string;
  tags: string[];
}

export interface ProviderManifest {
  id: string;
  name: string;
  vendor: string;
  region: 'global' | 'china' | 'local';
  phase: ProviderPhase;
  executionModes: ProviderExecutionMode[];
  homepage: string;
  docs?: string;
  auth: {
    type:
      | 'api-key'
      | 'bearer-token'
      | 'access-key-secret'
      | 'local-endpoint'
      | 'custom';
    label: string;
    secretStorageKey: string;
  };
  capabilities: Record<ProviderCapability, ProviderCapabilityStatus>;
  models: ProviderModelPreset[];
  textModels?: ProviderTextModelPreset[];
  notes: string[];
}

export type GenerationMode = 'text-to-image' | 'image-to-image' | 'imported';

export interface ReferenceImage {
  id: string;
  name?: string;
  mimeType?: string;
  dataUrl?: string;
  localPath?: string;
  previewUrl?: string;
  source: 'upload' | 'generated-result' | 'clipboard' | 'drag-drop' | 'inspiration';
  sourceGenerationId?: string;
}

export interface ImageGenerationRequest {
  providerId: string;
  modelId: string;
  prompt: string;
  negativePrompt?: string;
  size: string;
  quality?: string;
  outputFormat?: 'PNG' | 'JPEG' | 'WebP';
  outputCompression?: number;
  count: number;
  generationMode?: GenerationMode;
  references?: ReferenceImage[];
  seed?: number;
  baseUrl?: string;
  protocol?: 'images' | 'responses' | 'chat-completions' | 'custom-images';
  endpointPath?: string;
  extraHeaders?: Record<string, string>;
  secretId?: string;
  metadata?: Record<string, unknown>;
}

export interface ImageGenerationResult {
  id: string;
  providerId: string;
  modelId: string;
  status: 'queued' | 'running' | 'succeeded' | 'failed' | 'cancelled';
  prompt: string;
  imageUrls: string[];
  localImagePaths?: string[];
  costHint?: string;
  durationMs?: number;
  error?: string;
  raw?: unknown;
  createdAt: string;
  generationMode?: GenerationMode;
  referenceImages?: ReferenceImage[];
}

export interface GenerationRecord extends ImageGenerationResult {
  providerName?: string;
  savedAt?: string;
}

export interface ProviderAdapter {
  manifest: ProviderManifest;
  textToImage(request: ImageGenerationRequest): Promise<ImageGenerationResult>;
  imageToImage?(request: ImageGenerationRequest): Promise<ImageGenerationResult>;
  editImage?(request: ImageGenerationRequest): Promise<ImageGenerationResult>;
  multiReferenceImage?(request: ImageGenerationRequest): Promise<ImageGenerationResult>;
  generateSeries?(request: ImageGenerationRequest): Promise<ImageGenerationResult[]>;
  pollTask?(taskId: string): Promise<ImageGenerationResult>;
  cancelTask?(taskId: string): Promise<void>;
  estimateCost?(request: ImageGenerationRequest): Promise<string>;
  normalizeResult(raw: unknown, request: ImageGenerationRequest): ImageGenerationResult;
}
