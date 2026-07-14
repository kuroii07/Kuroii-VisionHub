import { describe, expect, it } from 'vitest';
import { defaultOpenAICompatibleConfig } from './providerConfig';
import {
  ensureManualModelOption,
  isProviderConnectionProfileLike,
  safeProviderConfigText
} from './providerConfigValidation';

describe('providerConfigValidation', () => {
  it.each([
    ['  text  ', 'text'],
    ['', ''],
    ['   ', ''],
    [null, ''],
    [undefined, ''],
    [42, ''],
    [{ value: 'text' }, '']
  ])('normalizes config text %j to %j', (value, expected) => {
    expect(safeProviderConfigText(value)).toBe(expected);
  });

  it.each([
    [{ id: 'profile-1', providerId: 'custom-http-provider' }, true],
    [{ id: '', providerId: '' }, true],
    [{ id: 1, providerId: 'custom-http-provider' }, false],
    [{ id: 'profile-1', providerId: 2 }, false],
    [{ id: 'profile-1' }, false],
    [null, false],
    [[], false],
    ['profile', false]
  ])('classifies profile shape %j as %s', (value, expected) => {
    expect(isProviderConnectionProfileLike(value)).toBe(expected);
  });

  it('returns the same config when the current model is empty', () => {
    const config = { ...defaultOpenAICompatibleConfig, modelId: '   ', modelOptions: ['model-a'] };
    expect(ensureManualModelOption(config)).toBe(config);
  });

  it('returns the same config when the trimmed current model already exists', () => {
    const config = { ...defaultOpenAICompatibleConfig, modelId: ' model-a ', modelOptions: ['model-a', 'model-b'] };
    expect(ensureManualModelOption(config)).toBe(config);
  });

  it('prepends a missing trimmed model without mutating the original config', () => {
    const config = { ...defaultOpenAICompatibleConfig, modelId: ' model-c ', modelOptions: ['model-a', 'model-b'] };
    const nextConfig = ensureManualModelOption(config);

    expect(nextConfig).not.toBe(config);
    expect(nextConfig.modelId).toBe(' model-c ');
    expect(nextConfig.modelOptions).toEqual(['model-c', 'model-a', 'model-b']);
    expect(config.modelOptions).toEqual(['model-a', 'model-b']);
  });
});
