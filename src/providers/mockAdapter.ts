import type {
  ImageGenerationRequest,
  ImageGenerationResult,
  ProviderAdapter,
  ProviderManifest
} from '../domain/providerTypes';

export class MockProviderAdapter implements ProviderAdapter {
  constructor(public readonly manifest: ProviderManifest) {}

  async textToImage(request: ImageGenerationRequest): Promise<ImageGenerationResult> {
    await new Promise((resolve) => setTimeout(resolve, 350));
    return this.normalizeResult({ demo: true }, request);
  }

  async imageToImage(request: ImageGenerationRequest): Promise<ImageGenerationResult> {
    await new Promise((resolve) => setTimeout(resolve, 350));
    return this.normalizeResult({ demo: true, references: request.references?.length ?? 0 }, {
      ...request,
      generationMode: 'image-to-image'
    });
  }

  async estimateCost(request: ImageGenerationRequest): Promise<string> {
    const base = request.count > 1 ? `${request.count} 张` : '1 张';
    return `${base} · 以供应商实时价格为准`;
  }

  normalizeResult(raw: unknown, request: ImageGenerationRequest): ImageGenerationResult {
    const hue =
      Array.from(request.prompt).reduce((sum, char) => sum + char.charCodeAt(0), 0) % 360;
    const count = Math.max(1, Math.min(4, Math.round(Number.isFinite(request.count) ? request.count : 1)));
    const imageUrls = Array.from({ length: count }, (_, index) => {
      const imageHue = (hue + index * 38) % 360;
      return `data:image/svg+xml;utf8,${encodeURIComponent(renderDemoSvg(request.prompt, imageHue, index + 1, count))}`;
    });

    return {
      id: `demo-${Date.now()}`,
      providerId: request.providerId,
      modelId: request.modelId,
      status: 'succeeded',
      prompt: request.prompt,
      imageUrls,
      costHint: 'Demo 模式未消耗额度',
      durationMs: 350,
      raw,
      createdAt: new Date().toISOString(),
      generationMode: request.generationMode ?? 'text-to-image',
      referenceImages: request.references ?? []
    };
  }
}

function renderDemoSvg(prompt: string, hue: number, index: number, total: number) {
  const safePrompt = prompt
    .replace(/[<>&]/g, (char) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' })[char]!)
    .slice(0, 120);

  return `
  <svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
    <defs>
      <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="hsl(${hue}, 92%, 62%)"/>
        <stop offset="0.45" stop-color="hsl(${(hue + 55) % 360}, 80%, 42%)"/>
        <stop offset="1" stop-color="#0b1020"/>
      </linearGradient>
      <filter id="blur"><feGaussianBlur stdDeviation="18"/></filter>
    </defs>
    <rect width="1024" height="1024" rx="64" fill="#080b12"/>
    <circle cx="260" cy="220" r="260" fill="hsl(${hue}, 90%, 55%)" opacity="0.38" filter="url(#blur)"/>
    <circle cx="760" cy="760" r="300" fill="hsl(${(hue + 110) % 360}, 90%, 55%)" opacity="0.32" filter="url(#blur)"/>
    <rect x="96" y="112" width="832" height="720" rx="44" fill="url(#g)" opacity="0.9"/>
    <rect x="130" y="146" width="764" height="652" rx="32" fill="rgba(8,11,18,.42)" stroke="rgba(255,255,255,.25)"/>
    <text x="156" y="224" font-size="42" fill="#fff" font-family="Inter, Arial" font-weight="700">VisionHub Demo Render</text>
    <text x="156" y="284" font-size="24" fill="rgba(255,255,255,.78)" font-family="Inter, Arial">Provider mock output · replace with real API adapter</text>
    <foreignObject x="156" y="356" width="700" height="260">
      <div xmlns="http://www.w3.org/1999/xhtml" style="font: 34px/1.35 Inter,Arial; color: white; font-weight: 650; word-break: break-word;">${safePrompt || '输入 Prompt 后生成预览'}</div>
    </foreignObject>
    <rect x="156" y="692" width="260" height="52" rx="18" fill="rgba(255,255,255,.16)"/>
    <text x="184" y="727" font-size="22" fill="#fff" font-family="Inter, Arial">Demo 模式 · ${index}/${total}</text>
  </svg>`;
}
