import { describe, expect, it } from 'vitest';
import { normalizeProviderProfile } from './providerProfiles';
import {
  MAX_SETTINGS_BACKUP_BYTES,
  mergeImportedProviderProfiles,
  parseSettingsBackupText
} from './settingsBackup';

const profile = (id: string, displayName: string) => normalizeProviderProfile({
  id,
  providerId: 'custom-http-provider',
  displayName,
  baseUrl: 'https://relay.example.com',
  modelId: 'image-model',
  protocol: 'images',
  imageToImageAdapter: 'auto',
  endpointPath: '/v1/images/generations',
  extraHeadersJson: '{}',
  modelOptions: ['image-model'],
  enabled: true,
  lastTestStatus: 'untested',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-02T00:00:00.000Z'
});

describe('settingsBackup', () => {
  it('parses and normalizes a v1 backup without importing embedded secrets', () => {
    const parsed = parseSettingsBackupText(JSON.stringify({
      schema: 'visionhub-settings-backup/v1',
      version: '0.5.23',
      created_at: '2026-07-15T01:02:03.000Z',
      app_settings: {
        language: 'en-US',
        themeMode: 'dark'
      },
      provider_configs: {
        profiles: [{
          ...profile('profile-preserved', 'Imported relay'),
          providerId: 'openai-gpt-image',
          baseUrl: 'https://relay.example.com',
          apiKey: 'must-not-survive',
          secret: 'must-not-survive'
        }],
        legacy: {
          'custom-http-provider': {
            displayName: 'Legacy relay',
            baseUrl: 'https://legacy.example.com',
            modelId: 'legacy-image',
            protocol: 'images',
            imageToImageAdapter: 'auto',
            endpointPath: '/v1/images/generations',
            extraHeadersJson: '{}',
            modelOptions: ['legacy-image'],
            apiKey: 'must-not-survive'
          }
        }
      },
      generation_history: [{ id: 'one' }, { id: 'two' }]
    }));

    expect(parsed.sourceVersion).toBe('0.5.23');
    expect(parsed.createdAt).toBe('2026-07-15T01:02:03.000Z');
    expect(parsed.appSettings.language).toBe('en-US');
    expect(parsed.appSettings.themeMode).toBe('dark');
    expect(parsed.providerProfiles).toHaveLength(1);
    expect(parsed.providerProfiles[0].id).toBe('profile-preserved');
    expect(parsed.providerProfiles[0].providerId).toBe('custom-http-provider');
    expect(parsed.providerProfiles[0]).not.toHaveProperty('apiKey');
    expect(parsed.providerProfiles[0]).not.toHaveProperty('secret');
    expect(parsed.legacyProviderConfigs['custom-http-provider'].modelId).toBe('legacy-image');
    expect(parsed.legacyProviderConfigs['custom-http-provider']).not.toHaveProperty('apiKey');
    expect(parsed.historyRecordCount).toBe(2);
  });

  it('rejects invalid, unsupported, or oversized backup input', () => {
    expect(() => parseSettingsBackupText('{')).toThrow('JSON');
    expect(() => parseSettingsBackupText(JSON.stringify({ schema: 'other/v1' }))).toThrow('visionhub-settings-backup/v1');
    expect(() => parseSettingsBackupText('x'.repeat(MAX_SETTINGS_BACKUP_BYTES + 1))).toThrow('5 MB');
  });

  it('deduplicates imported profile ids and reports ignored history', () => {
    const parsed = parseSettingsBackupText(JSON.stringify({
      schema: 'visionhub-settings-backup/v1',
      version: '0.5.23',
      created_at: '2026-07-15T01:02:03.000Z',
      app_settings: {},
      provider_configs: {
        profiles: [profile('duplicate', 'First'), profile('duplicate', 'Second')],
        legacy: {}
      },
      generation_history: [{ id: 'not-imported' }]
    }));

    expect(parsed.providerProfiles).toHaveLength(1);
    expect(parsed.providerProfiles[0].displayName).toBe('First');
    expect(parsed.warnings.join(' ')).toContain('duplicate');
    expect(parsed.warnings.join(' ')).toContain('1');
  });

  it('merges by profile id while preserving current-only profiles', () => {
    const current = [profile('shared', 'Current shared'), profile('current-only', 'Current only')];
    const imported = [profile('shared', 'Imported shared'), profile('imported-only', 'Imported only')];

    const merged = mergeImportedProviderProfiles(current, imported);

    expect(merged.map((item) => item.id)).toEqual(['shared', 'imported-only', 'current-only']);
    expect(merged.find((item) => item.id === 'shared')?.displayName).toBe('Imported shared');
    expect(current[0].displayName).toBe('Current shared');
  });
});
