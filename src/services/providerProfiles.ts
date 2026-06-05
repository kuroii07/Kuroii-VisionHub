import type { OpenAICompatibleConfig } from './providerConfig';
import {
  defaultEndpointForProtocol,
  defaultOpenAICompatibleConfig,
  exportProviderConfigMap,
  normalizeProviderConfig
} from './providerConfig';
import { readStorageValue, writeStorageValue } from './safeStorage';

const STORAGE_KEY = 'visionhub.provider.profiles';

export type ProviderProfileTestStatus = 'untested' | 'passed' | 'warning' | 'failed';

export interface ProviderConnectionProfile extends OpenAICompatibleConfig {
  id: string;
  providerId: string;
  enabled: boolean;
  lastTestStatus: ProviderProfileTestStatus;
  lastLatencyMs?: number;
  lastMessage?: string;
  lastTestedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export function providerProfileSecretId(profileId: string) {
  return `profile:${profileId}`;
}

export function profileToProviderConfig(profile: ProviderConnectionProfile): OpenAICompatibleConfig {
  return {
    displayName: profile.displayName,
    baseUrl: profile.baseUrl,
    modelId: profile.modelId,
    protocol: profile.protocol,
    endpointPath: profile.endpointPath,
    extraHeadersJson: profile.extraHeadersJson,
    modelOptions: profile.modelOptions
  };
}

export function createProviderProfile(
  providerId: string,
  config: Partial<OpenAICompatibleConfig> = {}
): ProviderConnectionProfile {
  const now = new Date().toISOString();
  const normalized = normalizeProviderConfig({
    ...defaultOpenAICompatibleConfig,
    ...config,
    endpointPath:
      config.protocol && config.protocol !== 'custom-images'
        ? defaultEndpointForProtocol(config.protocol)
        : config.endpointPath
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
  const providerId = String(profile.providerId || 'openai-gpt-image');
  const base = createProviderProfile(providerId, profile);
  return {
    ...base,
    ...normalizeProviderConfig(profile),
    id: String(profile.id || base.id),
    providerId,
    enabled: Boolean(profile.enabled),
    lastTestStatus: profile.lastTestStatus ?? 'untested',
    lastLatencyMs: typeof profile.lastLatencyMs === 'number' ? profile.lastLatencyMs : undefined,
    lastMessage: profile.lastMessage,
    lastTestedAt: profile.lastTestedAt,
    createdAt: String(profile.createdAt || base.createdAt),
    updatedAt: String(profile.updatedAt || base.updatedAt)
  };
}

export function loadProviderProfiles(): ProviderConnectionProfile[] {
  const raw = readStorageValue(STORAGE_KEY);
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as unknown;
      if (Array.isArray(parsed)) {
        return parsed.map((item) => normalizeProviderProfile(item as Partial<ProviderConnectionProfile>));
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
    profile.id === profileId ? { ...profile, enabled, updatedAt: now } : profile
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
  const profiles = entries.map(([providerId, config], index) => ({
    ...createProviderProfile(providerId, config),
    enabled: index === 0
  }));

  if (profiles.length === 0) {
    profiles.push({
      ...createProviderProfile('openai-gpt-image', {
        displayName: 'GPT Image 默认配置',
        modelOptions: ['gpt-image-1']
      }),
      enabled: true
    });
  }

  saveProviderProfiles(profiles);
  return profiles;
}
