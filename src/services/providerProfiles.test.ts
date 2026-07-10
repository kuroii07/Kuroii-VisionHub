import { describe, expect, it } from 'vitest';
import {
  normalizeProfileProviderId,
  normalizeProviderProfile,
  providerProfileSecretId
} from './providerProfiles';

describe('providerProfiles', () => {
  it('migrates non-official OpenAI profiles to the relay provider without changing the profile id', () => {
    const profile = normalizeProviderProfile({
      id: 'existing-profile-id',
      providerId: 'openai-gpt-image',
      displayName: 'Existing relay',
      baseUrl: 'https://relay.example.com',
      modelId: 'image-model',
      protocol: 'images',
      imageToImageAdapter: 'auto',
      endpointPath: '/v1/images/generations',
      extraHeadersJson: '{}',
      modelOptions: [],
      enabled: true,
      lastTestStatus: 'passed',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-02T00:00:00.000Z'
    });

    expect(profile.id).toBe('existing-profile-id');
    expect(profile.providerId).toBe('custom-http-provider');
    expect(providerProfileSecretId(profile.id)).toBe('profile:existing-profile-id');
  });

  it('keeps the official provider id for the official OpenAI host', () => {
    expect(normalizeProfileProviderId('openai-gpt-image', 'https://api.openai.com')).toBe('openai-gpt-image');
    expect(normalizeProfileProviderId('openai-gpt-image', 'https://relay.example.com')).toBe('custom-http-provider');
  });
});

