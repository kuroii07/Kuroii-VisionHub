import { describe, expect, it } from 'vitest';
import { createTranslator } from '../i18n';
import { normalizeProviderConfig } from './providerConfig';
import {
  buildProviderReadinessItems,
  isModelListUnavailableError,
  mapProviderErrorMessage
} from './providerDiagnostics';

const t = createTranslator('zh-CN');

describe('providerDiagnostics', () => {
  it.each([
    ['model list returned HTTP 403', true],
    ['GET /v1/models failed', true],
    ['Cloudflare Just a moment <!doctype html>', true],
    ['does not contain data array', true],
    ['generation completed', false]
  ])('detects model-list fallback errors: %s', (message, expected) => {
    expect(isModelListUnavailableError(new Error(message))).toBe(expected);
  });

  it.each([
    ['401 invalid API key', 'provider.error.unauthorized'],
    ['403 forbidden', 'provider.error.forbidden'],
    ['404 not found', 'provider.error.notFound'],
    ['429 rate limit', 'provider.error.rateLimit'],
    ['request timed out', 'provider.error.timeout'],
    ['DNS connection failed', 'provider.error.network'],
    ['invalid JSON response', 'provider.error.json']
  ] as const)('maps %s to a localized provider error', (message, key) => {
    const mapped = mapProviderErrorMessage(new Error(message), t);
    expect(mapped).toBe(t(key, { message }));
  });

  it('keeps unknown provider errors unchanged', () => {
    expect(mapProviderErrorMessage(new Error('custom provider failure'), t)).toBe('custom provider failure');
  });

  it('returns planned-route readiness for unavailable integrations', () => {
    const items = buildProviderReadinessItems({
      profile: null,
      config: normalizeProviderConfig({}),
      providerId: 'planned-provider',
      desktopRuntime: true,
      secretAvailable: false,
      serviceConfigurable: false,
      supportsOpenAICompatible: false,
      t
    });

    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ id: 'route', level: 'info' });
  });

  it('marks a configured relay as ready for generation checks', () => {
    const config = normalizeProviderConfig({
      displayName: 'Relay',
      baseUrl: 'https://relay.example.com',
      modelId: 'image-model',
      protocol: 'images',
      imageToImageAdapter: 'auto',
      endpointPath: '/v1/images/generations'
    });
    const items = buildProviderReadinessItems({
      profile: null,
      config,
      providerId: 'custom-http-provider',
      desktopRuntime: true,
      secretAvailable: true,
      serviceConfigurable: true,
      supportsOpenAICompatible: true,
      t
    });

    expect(items.find((item) => item.id === 'text-to-image')?.level).toBe('info');
    expect(items.find((item) => item.id === 'image-to-image')?.level).toBe('info');
    expect(items.find((item) => item.id === 'multi-reference')?.level).toBe('info');
  });
});

