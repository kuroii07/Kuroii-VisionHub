import { describe, expect, it } from 'vitest';
import {
  getDefaultProviderServiceTemplateForProvider,
  getProviderServiceTemplate,
  getProviderServiceTemplatesForPlatform,
  isProviderServiceTemplateConfigurable,
  providerPlatformOptions,
  providerServiceTemplates
} from './providerServiceCatalog';

describe('providerServiceCatalog', () => {
  it('keeps the established platform order', () => {
    expect(providerPlatformOptions.map((option) => option.id)).toEqual([
      'aggregator',
      'official',
      'local'
    ]);
  });

  it('keeps every established service template exactly once', () => {
    const ids = providerServiceTemplates.map((template) => template.id);

    expect(ids).toEqual([
      'aggregator-openai-compatible',
      'aggregator-generic-api',
      'siliconflow',
      'aggregator-custom',
      'official-openai',
      'official-minimax',
      'official-mimo',
      'official-gemini',
      'official-xai',
      'official-volcengine',
      'official-bailian',
      'official-kling',
      'official-jimeng',
      'local-comfyui',
      'local-sd-webui'
    ]);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it.each([
    ['aggregator', [
      'aggregator-openai-compatible',
      'aggregator-generic-api',
      'siliconflow',
      'aggregator-custom'
    ]],
    ['official', [
      'official-openai',
      'official-minimax',
      'official-gemini',
      'official-mimo',
      'official-xai',
      'official-volcengine',
      'official-bailian',
      'official-kling',
      'official-jimeng'
    ]],
    ['local', ['local-comfyui', 'local-sd-webui']]
  ] as const)('sorts %s templates by status and rank', (platformType, expectedIds) => {
    expect(getProviderServiceTemplatesForPlatform(platformType).map((template) => template.id))
      .toEqual(expectedIds);
  });

  it('finds templates by id without manufacturing unknown entries', () => {
    expect(getProviderServiceTemplate('official-openai')?.providerId).toBe('openai-gpt-image');
    expect(getProviderServiceTemplate('missing-template')).toBeUndefined();
  });

  it.each([
    ['custom-http-provider', 'aggregator-openai-compatible'],
    ['openai-gpt-image', 'official-openai'],
    ['minimax-image', 'official-minimax'],
    ['gemini-image', 'official-gemini'],
    ['sd-webui-local', 'local-sd-webui'],
    ['comfyui-local', 'local-comfyui'],
    ['missing-provider', undefined]
  ] as const)('maps provider %s to default template %s', (providerId, expectedId) => {
    expect(getDefaultProviderServiceTemplateForProvider(providerId)?.id).toBe(expectedId);
  });

  it('only marks connected/configurable templates with provider ids as configurable', () => {
    expect(isProviderServiceTemplateConfigurable(getProviderServiceTemplate('official-openai')!)).toBe(true);
    expect(isProviderServiceTemplateConfigurable(getProviderServiceTemplate('official-minimax')!)).toBe(true);
    expect(isProviderServiceTemplateConfigurable(getProviderServiceTemplate('official-xai')!)).toBe(false);
    expect(isProviderServiceTemplateConfigurable(getProviderServiceTemplate('official-mimo')!)).toBe(false);
  });
});
