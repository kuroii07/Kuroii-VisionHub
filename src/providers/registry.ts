import type { ProviderAdapter, ProviderManifest } from '../domain/providerTypes';
import { isTauriRuntime } from '../services/desktopApi';
import { providerManifests } from './manifests';
import { MockProviderAdapter } from './mockAdapter';
import { TauriOpenAIAdapter } from './tauriOpenAIAdapter';

export const providerRegistry = new Map<string, ProviderManifest>(
  providerManifests.map((manifest) => [manifest.id, manifest])
);

export function listProviders() {
  return providerManifests;
}

export function getProviderManifest(providerId: string) {
  const manifest = providerRegistry.get(providerId);
  if (!manifest) {
    throw new Error(`Unknown provider: ${providerId}`);
  }
  return manifest;
}

export function createProviderAdapter(providerId: string): ProviderAdapter {
  if (
    (providerId === 'openai-gpt-image' ||
      providerId === 'custom-http-provider' ||
      providerId === 'minimax-image' ||
      providerId === 'gemini-image') &&
    isTauriRuntime()
  ) {
    return new TauriOpenAIAdapter(getProviderManifest(providerId));
  }

  // Browser preview and non-wired providers use a safe mock adapter.
  return new MockProviderAdapter(getProviderManifest(providerId));
}
