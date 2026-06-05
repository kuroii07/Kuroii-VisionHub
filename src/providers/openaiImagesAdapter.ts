import type {
  ImageGenerationRequest,
  ImageGenerationResult,
  ProviderAdapter,
  ProviderManifest
} from '../domain/providerTypes';

interface OpenAIImagePayload {
  model: string;
  prompt: string;
  size?: string;
  quality?: string;
  n?: number;
}

interface OpenAIImageResponse {
  data?: Array<{ url?: string; b64_json?: string; revised_prompt?: string }>;
  error?: { message?: string; type?: string; code?: string };
  [key: string]: unknown;
}

export class OpenAIImagesAdapter implements ProviderAdapter {
  constructor(
    public readonly manifest: ProviderManifest,
    private readonly options: { apiKey: string; baseUrl?: string }
  ) {}

  async textToImage(request: ImageGenerationRequest): Promise<ImageGenerationResult> {
    const started = Date.now();
    const response = await fetch(`${this.options.baseUrl ?? 'https://api.openai.com'}/v1/images/generations`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.options.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(this.toPayload(request))
    });

    const raw = (await response.json()) as OpenAIImageResponse;
    if (!response.ok || raw.error) {
      return {
        id: `openai-error-${Date.now()}`,
        providerId: request.providerId,
        modelId: request.modelId,
        status: 'failed',
        prompt: request.prompt,
        imageUrls: [],
        durationMs: Date.now() - started,
        error: raw.error?.message ?? `OpenAI request failed with HTTP ${response.status}`,
        raw,
        createdAt: new Date().toISOString()
      };
    }

    const normalized = this.normalizeResult(raw, request);
    normalized.durationMs = Date.now() - started;
    return normalized;
  }

  normalizeResult(raw: unknown, request: ImageGenerationRequest): ImageGenerationResult {
    const response = raw as OpenAIImageResponse;
    const imageUrls =
      response.data?.flatMap((item) => {
        if (item.url) return [item.url];
        if (item.b64_json) return [`data:image/png;base64,${item.b64_json}`];
        return [];
      }) ?? [];

    return {
      id: `openai-${Date.now()}`,
      providerId: request.providerId,
      modelId: request.modelId,
      status: imageUrls.length > 0 ? 'succeeded' : 'failed',
      prompt: request.prompt,
      imageUrls,
      error: imageUrls.length > 0 ? undefined : 'OpenAI returned no image data.',
      raw,
      createdAt: new Date().toISOString()
    };
  }

  private toPayload(request: ImageGenerationRequest): OpenAIImagePayload {
    return {
      model: request.modelId,
      prompt: request.prompt,
      size: request.size,
      quality: request.quality,
      n: request.count
    };
  }
}
