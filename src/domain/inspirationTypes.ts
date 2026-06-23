export type InspirationSourceCategory =
  | 'prompt-template'
  | 'image-gallery'
  | 'model-community'
  | 'style-reference'
  | 'commercial-design'
  | 'other';

export type InspirationRegion = 'china' | 'global' | 'mixed';
export type InspirationCommercialReference = 'unknown' | 'reference-only' | 'user-confirmed';
export type InspirationLicenseStatus = 'unknown' | 'reference-only' | 'commercial-confirmed';
export type InspirationSourceKind = 'preset' | 'custom';
export type ImagePromptReverseLanguage = 'zh' | 'en' | 'source';
export type ImagePromptReverseDetail = 'concise' | 'detailed' | 'professional';
export type ImagePromptReverseProtocol = 'responses' | 'chat-completions' | 'gemini-generate-content';
export type PromptExcerptLanguage = 'auto' | 'zh' | 'en' | 'ja' | 'mixed';
export type PromptExcerptCategory = 'general' | 'portrait' | 'product' | 'scene' | 'character' | 'poster' | 'game-art' | 'photography' | 'negative' | 'other';

export interface InspirationSource {
  id: string;
  name: string;
  url: string;
  category: InspirationSourceCategory;
  region: InspirationRegion;
  sourceKind?: InspirationSourceKind;
  tags: string[];
  keywords?: string[];
  note?: string;
  sceneNotes?: string;
  membershipNotes?: string;
  copyrightNotes?: string;
  faviconUrl?: string;
  requiresLogin?: boolean;
  commercialReference: InspirationCommercialReference;
  openCount?: number;
  createdAt: string;
  updatedAt: string;
  lastOpenedAt?: string;
}

export interface InspirationAsset {
  id: string;
  title: string;
  imagePath?: string;
  imageUrl?: string;
  thumbnailPath?: string;
  sourceUrl?: string;
  sourcePlatform?: string;
  author?: string;
  originalPrompt?: string;
  inferredPrompt?: string;
  reversePrompt?: {
    prompt: string;
    language?: ImagePromptReverseLanguage;
    detail?: ImagePromptReverseDetail;
    modelId?: string;
    profileId?: string;
    providerId?: string;
    protocol?: ImagePromptReverseProtocol;
    generatedAt: string;
    editedAt?: string;
    rawSummary?: unknown;
  };
  tags: string[];
  note?: string;
  licenseStatus: InspirationLicenseStatus;
  rating?: number;
  createdAt: string;
  updatedAt: string;
}

export interface InspirationLibrary {
  sources: InspirationSource[];
  assets: InspirationAsset[];
  excerpts: PromptExcerpt[];
}

export interface PromptExcerpt {
  id: string;
  title: string;
  prompt: string;
  sourceName?: string;
  sourceUrl?: string;
  language: PromptExcerptLanguage;
  category: PromptExcerptCategory;
  tags: string[];
  note?: string;
  favorite?: boolean;
  createdAt: string;
  updatedAt: string;
  lastUsedAt?: string;
  usedCount?: number;
}

export interface InspirationAssetImportRequest {
  title: string;
  dataUrl: string;
  fileName?: string;
  sourceUrl?: string;
  sourcePlatform?: string;
  author?: string;
  originalPrompt?: string;
  tags?: string[];
  note?: string;
  licenseStatus?: InspirationLicenseStatus;
  rating?: number;
}
