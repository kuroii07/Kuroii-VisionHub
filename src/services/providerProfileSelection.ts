import type { Translator } from '../i18n';
import type { ProviderConnectionProfile } from './providerProfiles';
import type { ProviderServiceTemplate } from './providerServiceCatalog';

export type ProviderProfileFilter =
  | 'all'
  | 'enabled'
  | 'passed'
  | 'warning'
  | 'failed'
  | 'untested';

export function providerProfileBelongsToTemplate(
  profile: ProviderConnectionProfile,
  template: ProviderServiceTemplate
) {
  if (!template.providerId || profile.providerId !== template.providerId) return false;
  if (profile.serviceTemplateId) return profile.serviceTemplateId === template.id;
  return template.id === 'aggregator-openai-compatible'
    || template.id === 'official-openai'
    || template.id === 'official-minimax'
    || template.id === 'official-gemini'
    || template.id === 'local-sd-webui';
}

export function buildProviderProfileFilterOptions(
  profiles: ProviderConnectionProfile[],
  t: Translator
) {
  const counts: Record<ProviderProfileFilter, number> = {
    all: profiles.length,
    enabled: profiles.filter((profile) => profile.enabled).length,
    passed: profiles.filter((profile) => profile.lastTestStatus === 'passed').length,
    warning: profiles.filter((profile) => profile.lastTestStatus === 'warning').length,
    failed: profiles.filter((profile) => profile.lastTestStatus === 'failed').length,
    untested: profiles.filter((profile) => profile.lastTestStatus === 'untested').length
  };
  const ids: ProviderProfileFilter[] = [
    'all',
    'enabled',
    'passed',
    'warning',
    'failed',
    'untested'
  ];
  return ids.map((id) => ({
    id,
    label: t(`provider.profileFilter.${id}` as Parameters<Translator>[0]),
    count: counts[id]
  }));
}

export function matchesProviderProfileFilter(
  profile: ProviderConnectionProfile,
  filter: ProviderProfileFilter
) {
  if (filter === 'all') return true;
  if (filter === 'enabled') return profile.enabled;
  return profile.lastTestStatus === filter;
}
