import { create } from 'zustand';
import type { GenerationMode, GenerationRecord, ImageGenerationRequest, ImageGenerationResult, ReferenceImage } from '../domain/providerTypes';
import { createProviderAdapter, listProviders } from '../providers/registry';
import { loadAppSettings } from '../services/appSettings';
import { deleteGenerationRecord, isTauriRuntime, loadGenerationHistory, saveGenerationRecord } from '../services/desktopApi';
import { loadProviderConfig, parseExtraHeaders } from '../services/providerConfig';

interface StudioState {
  selectedProviderId: string;
  selectedModelId: string;
  prompt: string;
  count: number;
  size: string;
  quality: string;
  isGenerating: boolean;
  isHistoryLoaded: boolean;
  results: GenerationRecord[];
  addResult: (record: GenerationRecord) => void;
  removeResult: (recordId: string) => Promise<void>;
  setSelectedProvider: (providerId: string) => void;
  setPrompt: (prompt: string) => void;
  setCount: (count: number) => void;
  setSize: (size: string) => void;
  setQuality: (quality: string) => void;
  setSelectedModel: (modelId: string) => void;
  loadHistory: () => Promise<void>;
  generate: (options?: { mode?: GenerationMode; references?: ReferenceImage[]; metadata?: ImageGenerationRequest['metadata'] }) => Promise<void>;
}

const providers = listProviders();
const firstProvider = providers[0];
const initialGenerationDefaults = loadAppSettings().generationDefaults;
const initialProvider =
  providers.find((provider) => provider.id === initialGenerationDefaults.defaultProviderId) ?? firstProvider;
const initialModel =
  initialGenerationDefaults.defaultModelId ||
  initialProvider.models.find((model) => model.id === initialGenerationDefaults.defaultModelId)?.id ||
  initialProvider.models[0].id;

export const useStudioStore = create<StudioState>((set, get) => ({
  selectedProviderId: initialProvider.id,
  selectedModelId: initialModel,
  prompt: '',
  count: initialGenerationDefaults.defaultCount,
  size: initialGenerationDefaults.defaultSize,
  quality: initialGenerationDefaults.defaultQuality,
  isGenerating: false,
  isHistoryLoaded: false,
  results: [],
  addResult: (record) =>
    set({ results: [record, ...get().results.filter((item) => item.id !== record.id)] }),
  removeResult: async (recordId) => {
    const previousResults = get().results;
    set({ results: previousResults.filter((item) => item.id !== recordId) });
    try {
      await deleteGenerationRecord(recordId);
    } catch (error) {
      set({ results: previousResults });
      throw error;
    }
  },
  setSelectedProvider: (providerId) => {
    const provider = listProviders().find((item) => item.id === providerId) ?? firstProvider;
    const useOpenAICompatibleConfig = provider.id === 'openai-gpt-image' || provider.id === 'custom-http-provider';
    const configuredModelId = useOpenAICompatibleConfig ? loadProviderConfig(provider.id).modelId : undefined;
    set({ selectedProviderId: provider.id, selectedModelId: configuredModelId ?? provider.models[0].id });
  },
  setPrompt: (prompt) => set({ prompt }),
  setCount: (count) => set({ count }),
  setSize: (size) => set({ size }),
  setQuality: (quality) => set({ quality }),
  setSelectedModel: (modelId) => set({ selectedModelId: modelId }),
  loadHistory: async () => {
    if (get().isHistoryLoaded) return;
    if (!isTauriRuntime()) {
      set({ isHistoryLoaded: true });
      return;
    }
    try {
      const history = await loadGenerationHistory();
      set({ results: history, isHistoryLoaded: true });
    } catch (error) {
      const failed: GenerationRecord = {
        id: `history-error-${Date.now()}`,
        providerId: 'local-library',
        modelId: 'history-loader',
        status: 'failed',
        prompt: '加载本地生成历史失败',
        imageUrls: [],
        error: error instanceof Error ? error.message : String(error),
        createdAt: new Date().toISOString()
      };
      set({ results: [failed, ...get().results], isHistoryLoaded: true });
    }
  },
  generate: async (options) => {
    const state = get();
    const adapter = createProviderAdapter(state.selectedProviderId);
    const providerConfig = loadProviderConfig(state.selectedProviderId);
    const useOpenAICompatibleConfig =
      state.selectedProviderId === 'openai-gpt-image' || state.selectedProviderId === 'custom-http-provider';

    const generationMode = options?.mode ?? 'text-to-image';
    const references = options?.references ?? [];
    const metadata = options?.metadata;

    set({ isGenerating: true });
    try {
      const request: ImageGenerationRequest = {
        providerId: state.selectedProviderId,
        modelId: useOpenAICompatibleConfig ? providerConfig.modelId : state.selectedModelId,
        prompt: state.prompt,
        count: state.count,
        size: state.size,
        quality: state.quality,
        generationMode,
        references,
        metadata,
        baseUrl: useOpenAICompatibleConfig ? providerConfig.baseUrl : undefined,
        protocol: useOpenAICompatibleConfig ? providerConfig.protocol : undefined,
        endpointPath: useOpenAICompatibleConfig ? providerConfig.endpointPath : undefined,
        extraHeaders: useOpenAICompatibleConfig
          ? parseExtraHeaders(providerConfig.extraHeadersJson)
          : undefined
      };

      validateGenerationRequest(request, useOpenAICompatibleConfig);
      const result =
        generationMode === 'image-to-image'
          ? await (adapter.imageToImage?.(request) ?? Promise.reject(new Error('当前平台暂不支持图生图。')))
          : await adapter.textToImage(request);
      const providerName = listProviders().find((provider) => provider.id === result.providerId)?.name;
      const savedResult = await saveGenerationRecord({
        ...result,
        generationMode,
        referenceImages: references
      }, providerName);
      set({ results: [savedResult, ...get().results.filter((item) => item.id !== savedResult.id)] });
    } catch (error) {
      const failedModelId = useOpenAICompatibleConfig ? providerConfig.modelId : state.selectedModelId;
      const failedResult: GenerationRecord = {
        id: `error-${Date.now()}`,
        providerId: state.selectedProviderId,
        providerName: listProviders().find((provider) => provider.id === state.selectedProviderId)?.name,
        modelId: failedModelId || 'not-configured',
        status: 'failed',
        prompt: state.prompt,
        imageUrls: [],
        error: error instanceof Error ? error.message : String(error),
        createdAt: new Date().toISOString(),
        generationMode,
        referenceImages: references
      };
      const failed = await saveGenerationRecord(failedResult, failedResult.providerName);
      set({ results: [failed, ...get().results] });
    } finally {
      set({ isGenerating: false });
    }
  }
}));

function validateGenerationRequest(request: ImageGenerationRequest, useOpenAICompatibleConfig: boolean) {
  if (!request.prompt.trim()) {
    throw new Error('请先输入 Prompt。');
  }
  if (!request.modelId.trim()) {
    throw new Error('请先在平台接入设置模型 ID。');
  }
  if (request.generationMode === 'image-to-image' && !request.references?.length) {
    throw new Error('图生图需要先添加至少一张参考图。');
  }
  if (!useOpenAICompatibleConfig) return;
  if (!request.baseUrl) {
    throw new Error('请先在平台接入设置 Base URL。');
  }
  new URL(request.baseUrl);
  if (!request.endpointPath?.startsWith('/')) {
    throw new Error('请检查平台接入的接口路径，路径必须以 / 开头。');
  }
}

