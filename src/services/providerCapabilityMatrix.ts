import type { ProviderCapabilityStatus, ProviderManifest } from '../domain/providerTypes';

export type ProviderMatrixStatus =
  | 'live'
  | 'configurable'
  | 'partial'
  | 'planned'
  | 'localPlan'
  | 'unsupported'
  | 'unknown';

export type ProviderMatrixCapabilityKey =
  | 'textToImage'
  | 'imageToImage'
  | 'multiReferenceImage'
  | 'imagesApi'
  | 'responsesApi'
  | 'openAICompatible'
  | 'officialProtocol'
  | 'localService';

export type ProviderCapabilityMatrixCell = {
  status: ProviderMatrixStatus;
};

export type ProviderCapabilityMatrixTemplate = {
  platformType: 'aggregator' | 'official' | 'local';
  status: 'connected' | 'configurable' | 'planned' | 'local-plan';
  providerId?: string;
};

export const providerMatrixColumnKeys: ProviderMatrixCapabilityKey[] = [
  'textToImage',
  'imageToImage',
  'multiReferenceImage',
  'imagesApi',
  'responsesApi',
  'openAICompatible',
  'officialProtocol',
  'localService'
];

export function mapProviderCapabilityToMatrixStatus(
  template: ProviderCapabilityMatrixTemplate,
  capabilityStatus: ProviderCapabilityStatus
): ProviderMatrixStatus {
  if (capabilityStatus === 'supported') {
    return template.status === 'connected'
      ? 'live'
      : template.status === 'configurable'
        ? 'configurable'
        : template.status === 'local-plan'
          ? 'localPlan'
          : 'planned';
  }
  if (capabilityStatus === 'partial') return 'partial';
  if (capabilityStatus === 'planned') return template.status === 'local-plan' ? 'localPlan' : 'planned';
  if (capabilityStatus === 'unsupported') return 'unsupported';
  return 'unknown';
}

export function resolveProtocolMatrixStatus(
  template: ProviderCapabilityMatrixTemplate,
  capability: ProviderMatrixCapabilityKey
): ProviderMatrixStatus {
  if (capability === 'localService') {
    return template.platformType === 'local' ? 'localPlan' : 'unsupported';
  }
  if (capability === 'officialProtocol') {
    if (template.platformType !== 'official') return 'unsupported';
    return template.status === 'connected' ? 'live' : 'planned';
  }
  if (capability === 'openAICompatible') {
    if (template.platformType !== 'aggregator') return 'unsupported';
    return template.status === 'connected'
      ? 'live'
      : template.status === 'configurable'
        ? 'configurable'
        : 'planned';
  }
  if (capability === 'imagesApi' || capability === 'responsesApi') {
    if (template.status === 'connected') return 'live';
    if (template.status === 'configurable') return 'configurable';
    if (template.status === 'local-plan') return 'unsupported';
    return 'planned';
  }
  return 'unknown';
}

export function getProviderCapabilityMatrixCell(
  template: ProviderCapabilityMatrixTemplate,
  column: { key: ProviderMatrixCapabilityKey },
  providers: readonly ProviderManifest[]
): ProviderCapabilityMatrixCell {
  const provider = template.providerId
    ? providers.find((item) => item.id === template.providerId)
    : undefined;
  let status: ProviderMatrixStatus;

  if (
    column.key === 'textToImage'
    || column.key === 'imageToImage'
    || column.key === 'multiReferenceImage'
  ) {
    if (provider) {
      status = mapProviderCapabilityToMatrixStatus(template, provider.capabilities[column.key]);
    } else {
      status = template.status === 'local-plan' ? 'localPlan' : 'planned';
    }
  } else {
    status = resolveProtocolMatrixStatus(template, column.key);
  }

  return { status };
}
