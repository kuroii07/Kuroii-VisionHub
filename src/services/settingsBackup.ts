import type { AppSettings } from './appSettings';
import { normalizeAppSettings } from './appSettings';
import type { OpenAICompatibleConfig } from './providerConfig';
import { normalizeProviderConfig } from './providerConfig';
import type { ProviderConnectionProfile } from './providerProfiles';
import { normalizeProviderProfile } from './providerProfiles';

export const SETTINGS_BACKUP_SCHEMA = 'visionhub-settings-backup/v1';
export const MAX_SETTINGS_BACKUP_BYTES = 5 * 1024 * 1024;

export interface ParsedSettingsBackup {
  sourceVersion: string;
  createdAt: string;
  appSettings: AppSettings;
  providerProfiles: ProviderConnectionProfile[];
  legacyProviderConfigs: Record<string, OpenAICompatibleConfig>;
  historyRecordCount: number;
  warnings: string[];
}

function objectRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function sanitizeProviderConfig(value: unknown): OpenAICompatibleConfig | null {
  const item = objectRecord(value);
  if (!item) return null;
  return normalizeProviderConfig({
    displayName: item.displayName as string,
    baseUrl: item.baseUrl as string,
    modelId: item.modelId as string,
    protocol: item.protocol as OpenAICompatibleConfig['protocol'],
    imageToImageAdapter: item.imageToImageAdapter as OpenAICompatibleConfig['imageToImageAdapter'],
    endpointPath: item.endpointPath as string,
    extraHeadersJson: item.extraHeadersJson as string,
    modelOptions: item.modelOptions as string[]
  });
}

function sanitizeProviderProfile(value: unknown): ProviderConnectionProfile | null {
  const item = objectRecord(value);
  const id = typeof item?.id === 'string' ? item.id.trim() : '';
  if (!item || !id) return null;
  const config = sanitizeProviderConfig(item);
  if (!config) return null;
  return normalizeProviderProfile({
    ...config,
    id,
    providerId: typeof item.providerId === 'string' ? item.providerId : '',
    serviceTemplateId: typeof item.serviceTemplateId === 'string' ? item.serviceTemplateId : undefined,
    enabled: Boolean(item.enabled),
    lastTestStatus: item.lastTestStatus as ProviderConnectionProfile['lastTestStatus'],
    lastLatencyMs: typeof item.lastLatencyMs === 'number' ? item.lastLatencyMs : undefined,
    lastMessage: typeof item.lastMessage === 'string' ? item.lastMessage : undefined,
    lastTestedAt: typeof item.lastTestedAt === 'string' ? item.lastTestedAt : undefined,
    lastModelCount: typeof item.lastModelCount === 'number' ? item.lastModelCount : undefined,
    lastImageModelCount: typeof item.lastImageModelCount === 'number' ? item.lastImageModelCount : undefined,
    lastModelProbe: objectRecord(item.lastModelProbe) as unknown as ProviderConnectionProfile['lastModelProbe'],
    createdAt: typeof item.createdAt === 'string' ? item.createdAt : undefined,
    updatedAt: typeof item.updatedAt === 'string' ? item.updatedAt : undefined
  });
}

export function parseSettingsBackupText(text: string): ParsedSettingsBackup {
  if (new TextEncoder().encode(text).byteLength > MAX_SETTINGS_BACKUP_BYTES) {
    throw new Error('设置备份不能超过 5 MB。');
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (error) {
    throw new Error(`设置备份不是有效 JSON：${error instanceof Error ? error.message : String(error)}`);
  }
  const root = objectRecord(parsed);
  if (!root || root.schema !== SETTINGS_BACKUP_SCHEMA) {
    throw new Error(`只支持 ${SETTINGS_BACKUP_SCHEMA}。`);
  }
  const appSettingsValue = objectRecord(root.app_settings);
  if (!appSettingsValue) throw new Error('设置备份缺少 app_settings。');

  const warnings: string[] = [];
  const providerConfigs = objectRecord(root.provider_configs);
  const rawProfiles = Array.isArray(providerConfigs?.profiles) ? providerConfigs.profiles.slice(0, 200) : [];
  const profileIds = new Set<string>();
  const providerProfiles: ProviderConnectionProfile[] = [];
  rawProfiles.forEach((value) => {
    const profile = sanitizeProviderProfile(value);
    if (!profile) {
      warnings.push('已跳过缺少有效 profile id 的平台配置。');
      return;
    }
    if (profileIds.has(profile.id)) {
      warnings.push(`检测到重复 profile id ${profile.id}，已保留第一条。`);
      return;
    }
    profileIds.add(profile.id);
    providerProfiles.push(profile);
  });

  const legacyProviderConfigs: Record<string, OpenAICompatibleConfig> = {};
  const legacy = objectRecord(providerConfigs?.legacy);
  Object.entries(legacy ?? {}).slice(0, 100).forEach(([providerId, value]) => {
    const config = sanitizeProviderConfig(value);
    if (providerId.trim() && config) legacyProviderConfigs[providerId] = config;
  });

  const historyRecordCount = Array.isArray(root.generation_history) ? root.generation_history.length : 0;
  if (historyRecordCount > 0) {
    warnings.push(`备份包含 ${historyRecordCount} 条生成历史；本次仅恢复设置和平台配置，不导入历史记录或图片路径。`);
  }

  return {
    sourceVersion: typeof root.version === 'string' ? root.version : 'unknown',
    createdAt: typeof root.created_at === 'string' ? root.created_at : '',
    appSettings: normalizeAppSettings(appSettingsValue as Partial<AppSettings>),
    providerProfiles,
    legacyProviderConfigs,
    historyRecordCount,
    warnings
  };
}

export function mergeImportedProviderProfiles(
  current: ProviderConnectionProfile[],
  imported: ProviderConnectionProfile[]
) {
  const importedIds = new Set(imported.map((profile) => profile.id));
  return [
    ...imported.map((profile) => normalizeProviderProfile(profile)),
    ...current.filter((profile) => !importedIds.has(profile.id))
  ];
}
