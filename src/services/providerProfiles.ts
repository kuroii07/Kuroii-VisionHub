import type { OpenAICompatibleConfig } from './providerConfig';
import {
  defaultOpenAICompatibleConfig,
  exportProviderConfigMap,
  isOfficialOpenAIBaseUrl,
  normalizeProviderConfig
} from './providerConfig';
import { readStorageValue, writeStorageValue } from './safeStorage';

const STORAGE_KEY = 'visionhub.provider.profiles';
const OFFICIAL_OPENAI_PROVIDER_ID = 'openai-gpt-image';
const RELAY_PROVIDER_ID = 'custom-http-provider';

export type ProviderProfileTestStatus = 'untested' | 'passed' | 'warning' | 'failed';

export interface ProviderProfileModelProbe {
  modelId: string;
  available: boolean;
  checkedAt: string;
  message: string;
}

export interface ProviderConnectionProfile extends OpenAICompatibleConfig {
  id: string;
  providerId: string;
  serviceTemplateId?: string;
  enabled: boolean;
  lastTestStatus: ProviderProfileTestStatus;
  lastLatencyMs?: number;
  lastMessage?: string;
  lastTestedAt?: string;
  lastModelCount?: number;
  lastImageModelCount?: number;
  lastModelProbe?: ProviderProfileModelProbe;
  createdAt: string;
  updatedAt: string;
}

export function providerProfileSecretId(profileId: string) {
  return `profile:${profileId}`;
}

export function profileToProviderConfig(profile: ProviderConnectionProfile): OpenAICompatibleConfig {
  return normalizeProviderConfig({
    displayName: profile.displayName,
    baseUrl: profile.baseUrl,
    modelId: profile.modelId,
    protocol: profile.protocol,
    imageToImageAdapter: profile.imageToImageAdapter,
    endpointPath: profile.endpointPath,
    extraHeadersJson: profile.extraHeadersJson,
    modelOptions: profile.modelOptions
  });
}

export function createProviderProfile(
  providerId: string,
  config: Partial<OpenAICompatibleConfig> = {}
): ProviderConnectionProfile {
  const now = new Date().toISOString();
  const normalized = normalizeProviderConfig({
    ...defaultOpenAICompatibleConfig,
    ...config
  });

  return {
    ...normalized,
    id: `${providerId}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    providerId,
    enabled: false,
    lastTestStatus: 'untested',
    createdAt: now,
    updatedAt: now
  };
}

export function normalizeProviderProfile(profile: Partial<ProviderConnectionProfile>): ProviderConnectionProfile {
  const normalizedConfig = normalizeProviderConfig(profile);
  const originalProviderId = String(profile.providerId || RELAY_PROVIDER_ID);
  const providerId = normalizeProfileProviderId(originalProviderId, normalizedConfig.baseUrl);
  const base = createProviderProfile(providerId, normalizedConfig);
  return {
    ...base,
    ...normalizedConfig,
    id: String(profile.id || base.id),
    providerId,
    serviceTemplateId: typeof profile.serviceTemplateId === 'string' && profile.serviceTemplateId.trim()
      ? profile.serviceTemplateId
      : undefined,
    enabled: Boolean(profile.enabled),
    lastTestStatus: profile.lastTestStatus ?? 'untested',
    lastLatencyMs: typeof profile.lastLatencyMs === 'number' ? profile.lastLatencyMs : undefined,
    lastMessage: profile.lastMessage,
    lastTestedAt: profile.lastTestedAt,
    lastModelCount: typeof profile.lastModelCount === 'number' ? profile.lastModelCount : undefined,
    lastImageModelCount: typeof profile.lastImageModelCount === 'number' ? profile.lastImageModelCount : undefined,
    lastModelProbe: normalizeModelProbe(profile.lastModelProbe),
    createdAt: String(profile.createdAt || base.createdAt),
    updatedAt: String(profile.updatedAt || base.updatedAt)
  };
}

function normalizeModelProbe(value: unknown): ProviderProfileModelProbe | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  const probe = value as Partial<ProviderProfileModelProbe>;
  const modelId = typeof probe.modelId === 'string' ? probe.modelId.trim() : '';
  const checkedAt = typeof probe.checkedAt === 'string' ? probe.checkedAt : '';
  const message = typeof probe.message === 'string' ? probe.message : '';
  if (!modelId || !checkedAt) return undefined;
  return {
    modelId,
    available: Boolean(probe.available),
    checkedAt,
    message
  };
}

export function normalizeProfileProviderId(providerId: string, baseUrl: string) {
  if (providerId === OFFICIAL_OPENAI_PROVIDER_ID && !isOfficialOpenAIBaseUrl(baseUrl)) {
    return RELAY_PROVIDER_ID;
  }
  return providerId || RELAY_PROVIDER_ID;
}

export function loadProviderProfiles(): ProviderConnectionProfile[] {
  const raw = readStorageValue(STORAGE_KEY);
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as unknown;
      if (Array.isArray(parsed)) {
        const profiles = parsed.map((item) => normalizeProviderProfile(item as Partial<ProviderConnectionProfile>));
        const migrated = profiles.some((profile, index) => {
          const original = parsed[index] as Partial<ProviderConnectionProfile>;
          return profile.providerId !== original.providerId;
        });
        if (migrated) saveProviderProfiles(profiles);
        return profiles;
      }
    } catch (error) {
      console.warn('[VisionHub] provider profiles parse failed; migrating from legacy configs', error);
    }
  }

  return migrateLegacyProviderConfigs();
}

export function saveProviderProfiles(profiles: ProviderConnectionProfile[]) {
  writeStorageValue(STORAGE_KEY, JSON.stringify(profiles));
}

export function upsertProviderProfile(
  profiles: ProviderConnectionProfile[],
  profile: ProviderConnectionProfile
) {
  const normalized = normalizeProviderProfile({ ...profile, updatedAt: new Date().toISOString() });
  const nextProfiles = [
    normalized,
    ...profiles.filter((item) => item.id !== normalized.id)
  ];
  saveProviderProfiles(nextProfiles);
  return nextProfiles;
}

export function deleteProviderProfile(profiles: ProviderConnectionProfile[], profileId: string) {
  const nextProfiles = profiles.filter((profile) => profile.id !== profileId);
  saveProviderProfiles(nextProfiles);
  return nextProfiles;
}

export function setProviderProfileEnabled(
  profiles: ProviderConnectionProfile[],
  profileId: string,
  enabled: boolean
) {
  const now = new Date().toISOString();
  const nextProfiles = profiles.map((profile) =>
    profile.id === profileId
      ? { ...profile, enabled, updatedAt: now }
      : profile
  );
  saveProviderProfiles(nextProfiles);
  return nextProfiles;
}

export function getProfilesForProvider(profiles: ProviderConnectionProfile[], providerId: string) {
  return profiles.filter((profile) => profile.providerId === providerId);
}

export function getActiveProviderProfile(providerId: string) {
  const profiles = getProfilesForProvider(loadProviderProfiles(), providerId);
  return profiles.find((profile) => profile.enabled) ?? profiles[0];
}

function migrateLegacyProviderConfigs() {
  const map = exportProviderConfigMap();
  const entries = Object.entries(map);
  const profiles = entries.map(([providerId, config], index) =>
    normalizeProviderProfile({
      ...createProviderProfile(providerId, config),
      enabled: index === 0
    })
  );

  if (profiles.length === 0) {
    profiles.push({
      ...createProviderProfile(RELAY_PROVIDER_ID, {
        displayName: '聚合站默认配置',
        modelOptions: ['gpt-image-1']
      }),
      enabled: true
    });
  }

  saveProviderProfiles(profiles);
  return profiles;
}
