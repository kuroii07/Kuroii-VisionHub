import { describe, expect, it } from 'vitest';
import type { Translator } from '../i18n';
import type { ProviderManifest } from '../domain/providerTypes';
import { getProviderManifest } from '../providers/registry';
import { defaultOpenAICompatibleConfig } from './providerConfig';
import {
  createEmptyProviderDraftConfig,
  providerGenerationLabel,
  providerServiceTemplateDisplayName
} from './providerDraftPresentation';
import { getProviderServiceTemplate } from './providerServiceCatalog';

const t = ((key: string) => `translated:${key}`) as Translator;

describe('providerDraftPresentation', () => {
  it('uses translated and fallback template display names', () => {
    const template = getProviderServiceTemplate('official-openai')!;
    expect(providerServiceTemplateDisplayName(template, t)).toBe('translated:provider.service.official-openai.label');
    expect(providerServiceTemplateDisplayName(template)).toBe('OpenAI official');
    expect(providerServiceTemplateDisplayName({
      ...template,
      defaultDisplayName: undefined,
      label: 'Fallback label'
    })).toBe('Fallback label');
  });

  it.each([
    ['custom-http-provider', 'aggregator-openai-compatible', '', 'images', '/v1/images/generations'],
    ['openai-gpt-image', 'official-openai', 'https://api.openai.com', 'images', '/v1/images/generations'],
    ['minimax-image', 'official-minimax', 'https://api.minimaxi.com', 'custom-images', '/v1/image_generation'],
    ['gemini-image', 'official-gemini', 'https://generativelanguage.googleapis.com', 'images', '/v1beta/models/{model}:generateContent']
  ] as const)('creates the existing %s draft defaults', (providerId, templateId, baseUrl, protocol, endpointPath) => {
    const provider = getProviderManifest(providerId);
    const template = getProviderServiceTemplate(templateId)!;
    const draft = createEmptyProviderDraftConfig(provider, template, t);

    expect(draft).toEqual({
      ...defaultOpenAICompatibleConfig,
      displayName: `translated:provider.service.${templateId}.label`,
      baseUrl,
      modelId: provider.models[0]?.id ?? '',
      protocol,
      endpointPath,
      extraHeadersJson: '{}',
      modelOptions: provider.models.map((model) => model.id)
    });
  });

  it('creates an untranslated draft when no service template is supplied', () => {
    const provider = getProviderManifest('custom-http-provider');
    expect(createEmptyProviderDraftConfig(provider)).toEqual({
      ...defaultOpenAICompatibleConfig,
      displayName: '',
      baseUrl: '',
      modelId: provider.models[0]?.id ?? '',
      protocol: 'images',
      endpointPath: '/v1/images/generations',
      extraHeadersJson: '{}',
      modelOptions: provider.models.map((model) => model.id)
    });
  });

  it('builds translated generation labels from the default service template', () => {
    expect(providerGenerationLabel(getProviderManifest('gemini-image'), t)).toBe(
      'translated:provider.platform.official.label · translated:provider.service.official-gemini.label'
    );
  });

  it('falls back to the provider name when no service template exists', () => {
    const provider = {
      ...getProviderManifest('custom-http-provider'),
      id: 'unmapped-provider',
      name: 'Unmapped Provider'
    } as ProviderManifest;

    expect(providerGenerationLabel(provider, t)).toBe('Unmapped Provider');
  });
});
