import { describe, expect, it } from 'vitest';
import { normalizeProviderConfig } from './providerConfig';
import {
  isGeminiProvider,
  isMiniMaxProvider,
  providerEndpointPreview,
  providerSupportsOpenAICompatibleModelList,
  providerUsesConfig,
  resolveImageToImageAdapterForDisplay
} from './providerDisplay';

describe('providerDisplay', () => {
  it.each([
    ['images', 'openai-images-edit'],
    ['responses', 'responses-input-image'],
    ['chat-completions', 'chat-image-url'],
    ['images-minimal', 'json-image-array'],
    ['custom-images', 'json-image-array']
  ] as const)('resolves auto mapping for %s', (protocol, adapter) => {
    const config = normalizeProviderConfig({
      protocol,
      imageToImageAdapter: 'auto',
      endpointPath: ''
    });

    expect(resolveImageToImageAdapterForDisplay(config, 'custom-http-provider')).toBe(adapter);
  });

  it('keeps an explicitly selected image-to-image mapping', () => {
    const config = normalizeProviderConfig({
      protocol: 'images',
      imageToImageAdapter: 'json-image-array'
    });

    expect(resolveImageToImageAdapterForDisplay(config, 'custom-http-provider')).toBe('json-image-array');
  });

  it('classifies configurable provider families', () => {
    expect(providerUsesConfig('custom-http-provider')).toBe(true);
    expect(providerUsesConfig('openai-gpt-image')).toBe(true);
    expect(providerUsesConfig('minimax-image')).toBe(true);
    expect(providerUsesConfig('gemini-image')).toBe(true);
    expect(providerUsesConfig('planned-provider')).toBe(false);

    expect(providerSupportsOpenAICompatibleModelList('custom-http-provider')).toBe(true);
    expect(providerSupportsOpenAICompatibleModelList('openai-gpt-image')).toBe(true);
    expect(providerSupportsOpenAICompatibleModelList('minimax-image')).toBe(false);
    expect(isMiniMaxProvider('minimax-image')).toBe(true);
    expect(isGeminiProvider('gemini-image')).toBe(true);
  });

  it('builds endpoint previews without duplicating slashes', () => {
    expect(providerEndpointPreview({
      baseUrl: 'https://relay.example.com/api/',
      modelId: 'image model',
      protocol: 'responses',
      endpointPath: '/v1/responses'
    })).toBe('https://relay.example.com/api/v1/responses');

    expect(providerEndpointPreview({
      baseUrl: 'https://generativelanguage.googleapis.com',
      modelId: 'gemini image',
      protocol: 'custom-images',
      endpointPath: '/v1beta/models/{model}:generateContent'
    })).toBe('https://generativelanguage.googleapis.com/v1beta/models/gemini%20image:generateContent');
  });
});

