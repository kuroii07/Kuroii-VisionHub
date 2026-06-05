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

export interface InspirationSource {
  id: string;
  name: string;
  url: string;
  category: InspirationSourceCategory;
  region: InspirationRegion;
  tags: string[];
  note?: string;
  requiresLogin?: boolean;
  commercialReference: InspirationCommercialReference;
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
  tags: string[];
  note?: string;
  licenseStatus: InspirationLicenseStatus;
  createdAt: string;
  updatedAt: string;
}

export interface InspirationLibrary {
  sources: InspirationSource[];
  assets: InspirationAsset[];
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
}
