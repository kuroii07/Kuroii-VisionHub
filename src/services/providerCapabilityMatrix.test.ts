import { describe, expect, it } from 'vitest';
import type { ProviderCapabilityStatus, ProviderManifest } from '../domain/providerTypes';
import {
  getProviderCapabilityMatrixCell,
  mapProviderCapabilityToMatrixStatus,
  providerMatrixColumnKeys,
  resolveProtocolMatrixStatus,
  type ProviderCapabilityMatrixTemplate,
  type ProviderMatrixCapabilityKey
} from './providerCapabilityMatrix';

function makeTemplate(
  overrides: Partial<ProviderCapabilityMatrixTemplate> = {}
): ProviderCapabilityMatrixTemplate {
  return {
    platformType: 'aggregator',
    status: 'connected',
    providerId: 'test-provider',
    ...overrides
  };
}

function makeProvider(
  capabilities: Partial<ProviderManifest['capabilities']>
): ProviderManifest {
  return {
    id: 'test-provider',
    capabilities: {
      textToImage: 'unknown',
      imageToImage: 'unknown',
      multiReferenceImage: 'unknown',
      ...capabilities
    }
  } as ProviderManifest;
}

describe('providerCapabilityMatrix', () => {
  it('keeps the established capability column order', () => {
    expect(providerMatrixColumnKeys).toEqual([
      'textToImage',
      'imageToImage',
      'multiReferenceImage',
      'imagesApi',
      'responsesApi',
      'openAICompatible',
      'officialProtocol',
      'localService'
    ]);
  });

  it.each([
    ['connected', 'supported', 'live'],
    ['configurable', 'supported', 'configurable'],
    ['local-plan', 'supported', 'localPlan'],
    ['planned', 'supported', 'planned'],
    ['connected', 'partial', 'partial'],
    ['local-plan', 'planned', 'localPlan'],
    ['connected', 'planned', 'planned'],
    ['connected', 'unsupported', 'unsupported'],
    ['connected', 'unknown', 'unknown']
  ] as const)('maps %s templates with %s capabilities to %s', (status, capability, expected) => {
    expect(mapProviderCapabilityToMatrixStatus(
      makeTemplate({ status }),
      capability as ProviderCapabilityStatus
    )).toBe(expected);
  });

  it.each([
    ['local', 'planned', 'localService', 'localPlan'],
    ['aggregator', 'connected', 'localService', 'unsupported'],
    ['official', 'connected', 'officialProtocol', 'live'],
    ['official', 'planned', 'officialProtocol', 'planned'],
    ['aggregator', 'connected', 'officialProtocol', 'unsupported'],
    ['aggregator', 'connected', 'openAICompatible', 'live'],
    ['aggregator', 'configurable', 'openAICompatible', 'configurable'],
    ['aggregator', 'planned', 'openAICompatible', 'planned'],
    ['official', 'connected', 'openAICompatible', 'unsupported'],
    ['aggregator', 'connected', 'imagesApi', 'live'],
    ['aggregator', 'configurable', 'responsesApi', 'configurable'],
    ['local', 'local-plan', 'imagesApi', 'unsupported'],
    ['official', 'planned', 'responsesApi', 'planned'],
    ['official', 'connected', 'textToImage', 'unknown']
  ] as const)('resolves %s/%s %s to %s', (platformType, status, capability, expected) => {
    expect(resolveProtocolMatrixStatus(
      makeTemplate({ platformType, status }),
      capability as ProviderMatrixCapabilityKey
    )).toBe(expected);
  });

  it('uses provider manifest capabilities for generation cells', () => {
    const cell = getProviderCapabilityMatrixCell(
      makeTemplate(),
      { key: 'textToImage' },
      [makeProvider({ textToImage: 'partial' })]
    );

    expect(cell).toEqual({ status: 'partial' });
  });

  it('falls back to template planning state when no manifest is registered', () => {
    expect(getProviderCapabilityMatrixCell(
      makeTemplate({ providerId: 'missing-provider', status: 'local-plan' }),
      { key: 'imageToImage' },
      []
    )).toEqual({ status: 'localPlan' });

    expect(getProviderCapabilityMatrixCell(
      makeTemplate({ providerId: undefined, status: 'planned' }),
      { key: 'multiReferenceImage' },
      []
    )).toEqual({ status: 'planned' });
  });

  it('uses protocol rules for non-generation cells', () => {
    expect(getProviderCapabilityMatrixCell(
      makeTemplate({ platformType: 'official', status: 'connected' }),
      { key: 'officialProtocol' },
      []
    )).toEqual({ status: 'live' });
  });
});
