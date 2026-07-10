import { describe, expect, it } from 'vitest';
import {
  defaultEndpointForProtocol,
  isOfficialOpenAIBaseUrl,
  normalizeImageToImageAdapter,
  normalizeProviderConfig,
  parseExtraHeaders
} from './providerConfig';

describe('providerConfig', () => {
  it.each([
    ['images', '/v1/images/generations'],
    ['images-minimal', '/v1/images/generations'],
    ['responses', '/v1/responses'],
    ['chat-completions', '/v1/chat/completions'],
    ['custom-images', '/v1/images/generations']
  ] as const)('maps %s to its default endpoint', (protocol, endpoint) => {
    expect(defaultEndpointForProtocol(protocol)).toBe(endpoint);
  });

  it('normalizes unsafe or incomplete provider fields', () => {
    const config = normalizeProviderConfig({
      displayName: ' Relay ',
      baseUrl: ' https://relay.example.com/ ',
      modelId: ' image-model ',
      protocol: 'responses',
      imageToImageAdapter: 'not-supported' as never,
      endpointPath: 'v1/responses',
      extraHeadersJson: '',
      modelOptions: [' model-a ', '', 'model-b']
    });

    expect(config.baseUrl).toBe('https://relay.example.com/');
    expect(config.modelId).toBe('image-model');
    expect(config.protocol).toBe('responses');
    expect(config.imageToImageAdapter).toBe('auto');
    expect(config.endpointPath).toBe('/v1/responses');
    expect(config.extraHeadersJson).toBe('{}');
    expect(config.modelOptions).toEqual(['model-a', 'model-b']);
  });

  it('falls back to protocol defaults for invalid values', () => {
    const config = normalizeProviderConfig({
      protocol: 'invalid' as never,
      endpointPath: '',
      imageToImageAdapter: null as never
    });

    expect(config.protocol).toBe('images');
    expect(config.endpointPath).toBe('/v1/images/generations');
    expect(normalizeImageToImageAdapter('responses-input-image')).toBe('responses-input-image');
    expect(normalizeImageToImageAdapter('invalid')).toBe('auto');
  });

  it('recognizes only the official HTTPS OpenAI host', () => {
    expect(isOfficialOpenAIBaseUrl('https://api.openai.com')).toBe(true);
    expect(isOfficialOpenAIBaseUrl('https://api.openai.com/v1')).toBe(true);
    expect(isOfficialOpenAIBaseUrl('http://api.openai.com')).toBe(false);
    expect(isOfficialOpenAIBaseUrl('https://api.openai.com.example.com')).toBe(false);
    expect(isOfficialOpenAIBaseUrl('not-a-url')).toBe(false);
  });

  it('parses extra headers as string values', () => {
    expect(parseExtraHeaders('{"X-Trace":"visionhub","X-Retry":2}')).toEqual({
      'X-Trace': 'visionhub',
      'X-Retry': '2'
    });
    expect(parseExtraHeaders('')).toEqual({});
    expect(() => parseExtraHeaders('[]')).toThrow();
  });
});

