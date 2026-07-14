import { describe, expect, it } from 'vitest';
import type { Translator } from '../i18n';
import type { ProviderConnectionProfile, ProviderProfileTestStatus } from './providerProfiles';
import { getProviderServiceTemplate, type ProviderServiceTemplate } from './providerServiceCatalog';
import {
  buildProviderProfileFilterOptions,
  matchesProviderProfileFilter,
  providerProfileBelongsToTemplate,
  type ProviderProfileFilter
} from './providerProfileSelection';

function makeProfile(overrides: Partial<ProviderConnectionProfile> = {}): ProviderConnectionProfile {
  return {
    id: 'profile-1',
    providerId: 'custom-http-provider',
    displayName: 'Profile',
    baseUrl: 'https://example.com',
    modelId: 'image-model',
    protocol: 'images',
    imageToImageAdapter: 'auto',
    endpointPath: '/v1/images/generations',
    extraHeadersJson: '{}',
    modelOptions: [],
    enabled: false,
    lastTestStatus: 'untested',
    createdAt: '2026-07-14T00:00:00.000Z',
    updatedAt: '2026-07-14T00:00:00.000Z',
    ...overrides
  };
}

describe('providerProfileSelection', () => {
  it('requires matching provider ids and a configurable template provider', () => {
    const template = getProviderServiceTemplate('official-openai')!;
    expect(providerProfileBelongsToTemplate(
      makeProfile({ providerId: 'custom-http-provider' }),
      template
    )).toBe(false);
    expect(providerProfileBelongsToTemplate(
      makeProfile(),
      { ...template, providerId: undefined } as ProviderServiceTemplate
    )).toBe(false);
  });

  it('uses an explicit serviceTemplateId when present', () => {
    const template = getProviderServiceTemplate('aggregator-generic-api')!;
    expect(providerProfileBelongsToTemplate(
      makeProfile({ serviceTemplateId: 'aggregator-generic-api' }),
      template
    )).toBe(true);
    expect(providerProfileBelongsToTemplate(
      makeProfile({ serviceTemplateId: 'aggregator-custom' }),
      template
    )).toBe(false);
  });

  it.each([
    ['custom-http-provider', 'aggregator-openai-compatible', true],
    ['custom-http-provider', 'aggregator-generic-api', false],
    ['openai-gpt-image', 'official-openai', true],
    ['minimax-image', 'official-minimax', true],
    ['gemini-image', 'official-gemini', true],
    ['sd-webui-local', 'local-sd-webui', true],
    ['comfyui-local', 'local-comfyui', false]
  ] as const)('preserves legacy %s fallback for %s', (providerId, templateId, expected) => {
    expect(providerProfileBelongsToTemplate(
      makeProfile({ providerId, serviceTemplateId: undefined }),
      getProviderServiceTemplate(templateId)!
    )).toBe(expected);
  });

  it('builds translated filter options with existing counts and order', () => {
    const profiles = [
      makeProfile({ id: 'enabled-passed', enabled: true, lastTestStatus: 'passed' }),
      makeProfile({ id: 'enabled-warning', enabled: true, lastTestStatus: 'warning' }),
      makeProfile({ id: 'failed', lastTestStatus: 'failed' }),
      makeProfile({ id: 'untested', lastTestStatus: 'untested' })
    ];
    const t = ((key: string) => `translated:${key}`) as Translator;

    expect(buildProviderProfileFilterOptions(profiles, t)).toEqual([
      { id: 'all', label: 'translated:provider.profileFilter.all', count: 4 },
      { id: 'enabled', label: 'translated:provider.profileFilter.enabled', count: 2 },
      { id: 'passed', label: 'translated:provider.profileFilter.passed', count: 1 },
      { id: 'warning', label: 'translated:provider.profileFilter.warning', count: 1 },
      { id: 'failed', label: 'translated:provider.profileFilter.failed', count: 1 },
      { id: 'untested', label: 'translated:provider.profileFilter.untested', count: 1 }
    ]);
  });

  it.each([
    ['all', false, 'failed', true],
    ['enabled', true, 'failed', true],
    ['enabled', false, 'failed', false],
    ['passed', false, 'passed', true],
    ['warning', false, 'warning', true],
    ['failed', false, 'failed', true],
    ['untested', false, 'untested', true],
    ['passed', false, 'warning', false]
  ] as const)('matches %s filter for enabled=%s status=%s', (filter, enabled, status, expected) => {
    expect(matchesProviderProfileFilter(
      makeProfile({ enabled, lastTestStatus: status as ProviderProfileTestStatus }),
      filter as ProviderProfileFilter
    )).toBe(expected);
  });
});
