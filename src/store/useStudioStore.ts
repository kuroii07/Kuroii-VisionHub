import { create } from 'zustand';
import type { GenerationMode, GenerationRecord, ImageGenerationRequest, ImageGenerationResult, ProviderAdapter, ReferenceImage } from '../domain/providerTypes';
import { createProviderAdapter, listProviders } from '../providers/registry';
import { loadAppSettings } from '../services/appSettings';
import { deleteGenerationRecord, isTauriRuntime, loadGenerationHistory, saveGenerationRecord } from '../services/desktopApi';
import { loadProviderConfig, parseExtraHeaders } from '../services/providerConfig';
import {
  getActiveProviderProfile,
  profileToProviderConfig,
  providerProfileSecretId
} from '../services/providerProfiles';

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
  generate: (options?: { mode?: GenerationMode; references?: ReferenceImage[]; outputFormat?: ImageGenerationRequest['outputFormat']; outputCompression?: ImageGenerationRequest['outputCompression']; negativePrompt?: ImageGenerationRequest['negativePrompt']; seed?: ImageGenerationRequest['seed']; metadata?: ImageGenerationRequest['metadata'] }) => Promise<void>;
}

const providers = listProviders();
const firstProvider = providers[0];
const initialGenerationDefaults = loadAppSettings().generationDefaults;
const initialProviderId = resolveInitialProviderId(initialGenerationDefaults.defaultProviderId);
const initialProvider =
  providers.find((provider) => provider.id === initialProviderId) ?? firstProvider;
const initialModel =
  initialGenerationDefaults.defaultModelId ||
  initialProvider.models.find((model) => model.id === initialGenerationDefaults.defaultModelId)?.id ||
  initialProvider.models[0].id;
const initialPrompt = readSearchParam('prompt') ?? '';

export const useStudioStore = create<StudioState>((set, get) => ({
  selectedProviderId: initialProvider.id,
  selectedModelId: initialModel,
  prompt: initialPrompt,
  count: normalizeGenerationCount(initialGenerationDefaults.defaultCount),
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
    const activeProfile = useOpenAICompatibleConfig ? getActiveProviderProfile(provider.id) : undefined;
    const configuredModelId = useOpenAICompatibleConfig
      ? activeProfile
        ? profileToProviderConfig(activeProfile).modelId
        : loadProviderConfig(provider.id).modelId
      : undefined;
    set({ selectedProviderId: provider.id, selectedModelId: configuredModelId ?? provider.models[0].id });
  },
  setPrompt: (prompt) => set({ prompt }),
  setCount: (count) => set({ count: normalizeGenerationCount(count) }),
  setSize: (size) => set({ size }),
  setQuality: (quality) => set({ quality }),
  setSelectedModel: (modelId) => set({ selectedModelId: modelId }),
  loadHistory: async () => {
    if (get().isHistoryLoaded) return;
    if (!isTauriRuntime()) {
      set({
        results: shouldUseVisualQaFixtures() ? createVisualQaRecords() : [],
        isHistoryLoaded: true
      });
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
    const activeProfile = getActiveProviderProfile(state.selectedProviderId);
    const providerConfig = activeProfile
      ? profileToProviderConfig(activeProfile)
      : loadProviderConfig(state.selectedProviderId);
    const useOpenAICompatibleConfig =
      state.selectedProviderId === 'openai-gpt-image' || state.selectedProviderId === 'custom-http-provider';

    const generationMode = options?.mode ?? 'text-to-image';
    const references = options?.references ?? [];
    const outputFormat = options?.outputFormat ?? initialGenerationDefaults.outputFormat;
    const outputCompression = options?.outputCompression;
    const negativePrompt = options?.negativePrompt;
    const seed = options?.seed;
    const metadata = options?.metadata;
    const requestedCount = normalizeGenerationCount(state.count);

    set({ isGenerating: true });
    try {
      const request: ImageGenerationRequest = {
        providerId: state.selectedProviderId,
        modelId: useOpenAICompatibleConfig ? providerConfig.modelId : state.selectedModelId,
        prompt: state.prompt,
        count: requestedCount,
        size: state.size,
        quality: state.quality,
        negativePrompt,
        seed,
        outputFormat,
        outputCompression,
        generationMode,
        references,
        metadata,
        baseUrl: useOpenAICompatibleConfig ? providerConfig.baseUrl : undefined,
        protocol: useOpenAICompatibleConfig ? providerConfig.protocol : undefined,
        imageToImageAdapter: useOpenAICompatibleConfig ? providerConfig.imageToImageAdapter : undefined,
        endpointPath: useOpenAICompatibleConfig ? providerConfig.endpointPath : undefined,
        extraHeaders: useOpenAICompatibleConfig
          ? parseExtraHeaders(providerConfig.extraHeadersJson)
          : undefined,
        secretId: activeProfile ? providerProfileSecretId(activeProfile.id) : undefined
      };

      validateGenerationRequest(request, useOpenAICompatibleConfig);
      const result = await completeRequestedImageCount(
        adapter,
        request,
        generationMode,
        await runProviderGeneration(adapter, request, generationMode)
      );
      const providerName = listProviders().find((provider) => provider.id === result.providerId)?.name;
      const recordsToSave = splitImageResultIntoRecords({
        ...result,
        generationMode,
        referenceImages: references
      });
      const savedResults: GenerationRecord[] = [];
      for (const record of recordsToSave) {
        savedResults.push(await saveGenerationRecord(record, providerName));
      }
      const savedIds = new Set(savedResults.map((item) => item.id));
      set({ results: [...savedResults, ...get().results.filter((item) => !savedIds.has(item.id))] });
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

function normalizeGenerationCount(count: number) {
  if (!Number.isFinite(count)) return 1;
  return Math.max(1, Math.min(4, Math.round(count)));
}

async function runProviderGeneration(
  adapter: ProviderAdapter,
  request: ImageGenerationRequest,
  generationMode: GenerationMode
) {
  if (generationMode === 'image-to-image') {
    return adapter.imageToImage?.(request) ?? Promise.reject(new Error('当前平台暂不支持图生图。'));
  }
  return adapter.textToImage(request);
}

async function completeRequestedImageCount(
  adapter: ProviderAdapter,
  request: ImageGenerationRequest,
  generationMode: GenerationMode,
  firstResult: ImageGenerationResult
): Promise<ImageGenerationResult> {
  const requestedCount = normalizeGenerationCount(request.count);
  if (firstResult.status !== 'succeeded' || firstResult.imageUrls.length >= requestedCount) {
    return firstResult;
  }

  const imageUrls = [...firstResult.imageUrls];
  const localImagePaths = [...(firstResult.localImagePaths ?? [])];
  const rawResponses = [firstResult.raw ?? null];
  let durationMs = firstResult.durationMs ?? 0;
  let warning: string | undefined;

  while (imageUrls.length < requestedCount) {
    const remainingCount = requestedCount - imageUrls.length;
    try {
      const nextResult = await runProviderGeneration(
        adapter,
        { ...request, count: Math.max(1, Math.min(remainingCount, requestedCount)) },
        generationMode
      );
      rawResponses.push(nextResult.raw ?? null);
      durationMs += nextResult.durationMs ?? 0;

      if (nextResult.status !== 'succeeded' || nextResult.imageUrls.length === 0) {
        warning = nextResult.error || `服务商只返回了 ${imageUrls.length} 张图片，未能补齐到 ${requestedCount} 张。`;
        break;
      }

      const availableSlots = requestedCount - imageUrls.length;
      imageUrls.push(...nextResult.imageUrls.slice(0, availableSlots));
      localImagePaths.push(...(nextResult.localImagePaths ?? []).slice(0, availableSlots));
    } catch (error) {
      warning = error instanceof Error ? error.message : String(error);
      break;
    }
  }

  return {
    ...firstResult,
    imageUrls: imageUrls.slice(0, requestedCount),
    localImagePaths: localImagePaths.slice(0, requestedCount),
    durationMs: durationMs || firstResult.durationMs,
    raw: {
      visionhub_count_completion: {
        requestedCount,
        receivedCount: Math.min(imageUrls.length, requestedCount),
        extraRequestCount: Math.max(0, rawResponses.length - 1),
        warning
      },
      responses: rawResponses
    },
    costHint: warning
      ? `${firstResult.costHint ?? '以供应商实际账单为准'}；请求 ${requestedCount} 张，实际返回 ${Math.min(imageUrls.length, requestedCount)} 张。`
      : firstResult.costHint
  };
}

function splitImageResultIntoRecords(result: ImageGenerationResult): ImageGenerationResult[] {
  if (result.status !== 'succeeded' || result.imageUrls.length <= 1) return [result];

  const localImagePaths = result.localImagePaths ?? [];
  const total = result.imageUrls.length;
  return result.imageUrls.map((imageUrl, index) => ({
    ...result,
    id: `${result.id}-${index + 1}`,
    imageUrls: [imageUrl],
    localImagePaths: localImagePaths[index] ? [localImagePaths[index]] : [],
    raw: {
      visionhub_split_image_record: {
        sourceResultId: result.id,
        imageIndex: index + 1,
        total
      },
      originalRaw: result.raw ?? null
    }
  }));
}

function resolveInitialProviderId(providerId: string) {
  if (providerId !== 'openai-gpt-image') return providerId;
  const officialProfile = getActiveProviderProfile('openai-gpt-image');
  const relayProfile = getActiveProviderProfile('custom-http-provider');
  return !officialProfile && relayProfile ? 'custom-http-provider' : providerId;
}

function readSearchParam(name: string) {
  if (typeof window === 'undefined') return null;
  return new URLSearchParams(window.location.search).get(name);
}

function shouldUseVisualQaFixtures() {
  return readSearchParam('qa') === 'visual';
}

function qaImageUrl(title: string, accent: string, shape: 'wide' | 'portrait' | 'square') {
  const width = shape === 'portrait' ? 720 : shape === 'wide' ? 1280 : 900;
  const height = shape === 'portrait' ? 1080 : shape === 'wide' ? 720 : 900;
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
      <defs>
        <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
          <stop stop-color="#111827"/>
          <stop offset="1" stop-color="${accent}"/>
        </linearGradient>
      </defs>
      <rect width="100%" height="100%" fill="url(#bg)"/>
      <circle cx="${width * 0.72}" cy="${height * 0.25}" r="${Math.min(width, height) * 0.16}" fill="rgba(255,255,255,0.16)"/>
      <rect x="${width * 0.13}" y="${height * 0.18}" width="${width * 0.44}" height="${height * 0.52}" rx="34" fill="rgba(255,255,255,0.18)" stroke="rgba(255,255,255,0.42)" stroke-width="4"/>
      <text x="${width * 0.13}" y="${height * 0.82}" fill="white" font-family="Segoe UI, Arial" font-size="${Math.max(32, width * 0.045)}" font-weight="700">${title}</text>
    </svg>
  `;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

function createVisualQaRecords(): GenerationRecord[] {
  const now = Date.now();
  const longPrompt = '超长 Prompt 视觉验收：一个拥有复杂镜头语言、丰富材质、柔和边缘光、多个主体层级、精细背景道具和大量风格约束的图生图任务，用来检查卡片摘要、详情抽屉、筛选栏和底部悬浮搜索在桌面端窗口中是否发生挤压、遮挡、换行失控或视觉噪音。';

  return [
    {
      id: 'qa-wide-success',
      providerId: 'custom-http-provider',
      providerName: '聚合站 / OpenAI 兼容中转',
      modelId: 'gpt-image-qa-wide',
      status: 'succeeded',
      prompt: longPrompt,
      imageUrls: [qaImageUrl('Wide / Reference', '#25d9cf', 'wide')],
      localImagePaths: ['D:\\VisionHub\\library\\qa-wide-reference.png'],
      durationMs: 18200,
      createdAt: new Date(now - 1000 * 60 * 18).toISOString(),
      savedAt: new Date(now - 1000 * 60 * 17).toISOString(),
      generationMode: 'image-to-image',
      referenceImages: [
        { id: 'qa-ref-1', name: '构图参考.png', source: 'upload' },
        { id: 'qa-ref-2', name: '色彩参考.png', source: 'clipboard' }
      ]
    },
    {
      id: 'qa-portrait-success',
      providerId: 'openai-gpt-image',
      providerName: 'OpenAI GPT Image',
      modelId: 'gpt-image-1',
      status: 'succeeded',
      prompt: '竖图卡片验收，检查瀑布流和完整宽高比模式的图片显示、收藏按钮、更多菜单以及详情预览。',
      imageUrls: [qaImageUrl('Portrait', '#8468ff', 'portrait')],
      localImagePaths: ['D:\\VisionHub\\library\\qa-portrait.png'],
      durationMs: 9200,
      createdAt: new Date(now - 1000 * 60 * 60 * 4).toISOString(),
      savedAt: new Date(now - 1000 * 60 * 60 * 4).toISOString(),
      generationMode: 'text-to-image'
    },
    {
      id: 'qa-square-failed',
      providerId: 'custom-http-provider',
      providerName: '聚合站 / OpenAI 兼容中转',
      modelId: 'nano-banana-test',
      status: 'failed',
      prompt: '失败记录验收：用于检查错误信息、失败筛选、待核查提示和空图片占位不会把卡片撑坏。',
      imageUrls: [],
      error: 'HTTP 524: 中转后台可能仍在继续生成，稍后可以重查历史或到图册目录检查落盘结果。',
      raw: { status: 524, background: true },
      durationMs: 60000,
      createdAt: new Date(now - 1000 * 60 * 60 * 26).toISOString(),
      generationMode: 'text-to-image'
    },
    {
      id: 'qa-square-success',
      providerId: 'custom-http-provider',
      providerName: '聚合站 / OpenAI 兼容中转',
      modelId: 'seedream-qa-square',
      status: 'succeeded',
      prompt: '方图验收，检查紧凑间距、收藏状态、颜色筛选和底部 dock 的遮挡情况。',
      imageUrls: [qaImageUrl('Square', '#0ea5e9', 'square')],
      localImagePaths: ['D:\\VisionHub\\library\\qa-square.png'],
      durationMs: 6400,
      createdAt: new Date(now - 1000 * 60 * 60 * 48).toISOString(),
      savedAt: new Date(now - 1000 * 60 * 60 * 48).toISOString(),
      generationMode: 'text-to-image'
    }
  ];
}

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

