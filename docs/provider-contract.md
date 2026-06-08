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

## Image-to-image mapping V2

Provider profiles can set `imageToImageAdapter` to control how reference images are sent:

- `auto`: resolve from provider and protocol.
- `openai-images-edit`: multipart `/v1/images/edits` with `image` and `image[]`.
- `responses-input-image`: Responses JSON `content[]` with `input_text` and `input_image`.
- `chat-image-url`: Chat Completions JSON `content[]` with `text` and `image_url`.
- `json-image-array`: custom JSON with first `image` plus `images` array.

Generation results include `raw.visionhub_protocol_mapping` so failed records can show the resolved adapter, endpoint path, request shape, reference count, roles, and field names without exposing credentials.

## Current implementation note

The UI uses `MockProviderAdapter` by default so the prototype can be reviewed without API keys.
`OpenAIImagesAdapter` is scaffolded for the first real Provider and should be wired through
Tauri-side secure secret retrieval rather than renderer-side API key input.
