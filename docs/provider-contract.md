# Provider Adapter Contract

VisionHub Studio treats every online or local image platform as a Provider Adapter.

## Required methods

- `textToImage(request)`
- `normalizeResult(raw, request)`

## Optional methods

- `imageToImage(request)`
- `editImage(request)`
- `multiReferenceImage(request)`
- `generateSeries(request)`
- `pollTask(taskId)`
- `cancelTask(taskId)`
- `estimateCost(request)`

## Provider implementation order

1. OpenAI GPT Image
2. Gemini Nano Banana
3. xAI Grok Image
4. Volcengine Seedream / 豆包 / 火山方舟
5. 即梦 official or enterprise API
6. Kling official or authorized API
7. Custom HTTP / OpenAI-compatible
8. ComfyUI / local models

## Safety defaults

- Do not simulate consumer web UIs for Jimeng, Doubao, Kling, or other platforms.
- Store secrets through desktop secure storage, not renderer-side localStorage.
- Keep provider raw responses in task details only after masking credentials.
- Show clear errors for quota, moderation, network, auth, and provider parameter mismatch.

## Current implementation note

The UI uses `MockProviderAdapter` by default so the prototype can be reviewed without API keys.
`OpenAIImagesAdapter` is scaffolded for the first real Provider and should be wired through
Tauri-side secure secret retrieval rather than renderer-side API key input.
