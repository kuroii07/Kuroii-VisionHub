import type {
  ImageGenerationRequest,
  ImageGenerationResult,
  ProviderAdapter,
  ProviderManifest
} from '../domain/providerTypes';
import { generateOpenAIImage } from '../services/desktopApi';

export class TauriOpenAIAdapter implements ProviderAdapter {
  constructor(public readonly manifest: ProviderManifest) {}

  async textToImage(request: ImageGenerationRequest): Promise<ImageGenerationResult> {
    return generateOpenAIImage(request);
  }

  async imageToImage(request: ImageGenerationRequest): Promise<ImageGenerationResult> {
    return generateOpenAIImage({ ...request, generationMode: 'image-to-image' });
  }

  normalizeResult(raw: unknown, request: ImageGenerationRequest): ImageGenerationResult {
    return {
      id: `openai-${Date.now()}`,
      providerId: request.providerId,
      modelId: request.modelId,
      status: 'failed',
      prompt: request.prompt,
      imageUrls: [],
      error: 'OpenAI result normalization is handled by the Tauri backend.',
      raw,
      createdAt: new Date().toISOString()
    };
  }
}
