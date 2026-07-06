import type { GenerationMode, ReferenceImage } from '../domain/providerTypes';
import type { Translator } from '../i18n';

export type GenerationFailureCategory =
  | 'auth'
  | 'permission'
  | 'quota'
  | 'rate-limit'
  | 'protocol'
  | 'model'
  | 'parameter'
  | 'content-safety'
  | 'timeout-background'
  | 'server'
  | 'network'
  | 'response-format'
  | 'no-image'
  | 'unknown';

export type GenerationFailureSeverity = 'error' | 'warning' | 'info';

export type GenerationFailureDiagnosis = {
  category: GenerationFailureCategory;
  severity: GenerationFailureSeverity;
  title: string;
  summary: string;
  actions: string[];
  details: string[];
  rawMessage: string;
  httpStatus?: number;
  traceId?: string;
  requestId?: string;
  isPotentialBackgroundCompletion: boolean;
};

export type DiagnosableGenerationRecord = {
  status?: string;
  error?: string;
  raw?: unknown;
  generationMode?: GenerationMode;
  referenceImages?: ReferenceImage[];
  modelId?: string;
  providerId?: string;
};

type ProtocolMapping = {
  image_to_image_adapter?: string;
  request_shape?: string;
  reference_count?: number;
  reference_fields?: string[];
  endpoint_path?: string;
  protocol?: string;
  is_image_to_image?: boolean;
};

const DEFAULT_ACTIONS = [
  '复制错误信息和 trace/request id，和中转站后台记录对照。',
  '确认当前模型、协议类型、接口路径和图生图映射是否匹配。',
  '如果刚改过配置，先保存配置后用 1 张图或小尺寸重试。'
];

export function diagnoseGenerationFailure(record?: DiagnosableGenerationRecord | null, t?: Translator): GenerationFailureDiagnosis {
  const raw = record?.raw;
  const rawText = stringifyRaw(raw);
  const rawMessage = [record?.error, extractRawErrorMessage(raw), rawText].filter(Boolean).join(' ');
  const lower = rawMessage.toLowerCase();
  const httpStatus = extractHttpStatus(record?.error, raw);
  const protocolMapping = extractProtocolMapping(raw);
  const traceId = extractTraceId(rawMessage, raw);
  const requestId = extractRequestId(rawMessage, raw);
  const referenceCount = protocolMapping?.reference_count ?? record?.referenceImages?.length ?? 0;
  const generationMode = record?.generationMode ?? (referenceCount > 0 ? 'image-to-image' : 'text-to-image');
  const details = buildDetails({ httpStatus, protocolMapping, traceId, requestId, generationMode, referenceCount, modelId: record?.modelId }, t);
  const potentialBackground = isPotentialBackgroundCompletionText(lower, httpStatus, raw);

  if (record?.providerId === 'comfyui-local' || lower.includes('visionhub_comfyui') || lower.includes('comfyui')) {
    const needsApiWorkflow = lower.includes('frontend_preflight_failed') || lower.includes('api workflow') || lower.includes('workflow required');
    return buildDiagnosis({
      category: needsApiWorkflow ? 'protocol' : 'unknown',
      severity: 'error',
      title: needsApiWorkflow
        ? translateDiagnostic(t, 'generate.error.comfy.workflowTitle', 'ComfyUI workflow 需要重新导入')
        : translateDiagnostic(t, 'generate.error.comfy.failedTitle', 'ComfyUI 本地生成失败'),
      summary: needsApiWorkflow
        ? translateDiagnostic(
            t,
            'generate.error.comfy.workflowSummary',
            record?.error || extractRawErrorMessage(raw) || '请先到平台接入 > 本地模型 > ComfyUI 导入 API workflow。'
          )
        : translateDiagnostic(
            t,
            'generate.error.comfy.failedSummary',
            record?.error || extractRawErrorMessage(raw) || '本地 ComfyUI 任务没有完成，需要查看 raw 响应确认是 workflow、队列还是取图问题。'
          ),
      actions: needsApiWorkflow
        ? [
            translateDiagnostic(t, 'generate.error.comfy.workflowAction1', '到平台接入 > 本地模型 > ComfyUI，重新导入 API workflow。'),
            translateDiagnostic(t, 'generate.error.comfy.workflowAction2', '在 ComfyUI 里启用 Dev mode 后，使用导出 API 格式 workflow 的 JSON，不要用普通 UI workflow。'),
            translateDiagnostic(t, 'generate.error.comfy.workflowAction3', '重新导入后回到 AI 创作台再点生成。')
          ]
        : [
            translateDiagnostic(t, 'generate.error.comfy.failedAction1', '先确认 ComfyUI 界面里这个 workflow 能独立运行成功。'),
            translateDiagnostic(t, 'generate.error.comfy.failedAction2', '检查平台接入里的 Base URL 是否是当前 ComfyUI 地址。'),
            translateDiagnostic(t, 'generate.error.comfy.failedAction3', '打开失败记录详情，查看 raw 里的 prompt_id、history 或 ComfyUI 返回错误。')
          ],
      details,
      rawMessage,
      httpStatus,
      traceId,
      requestId
    });
  }

  if (record?.providerId === 'sd-webui-local' || lower.includes('visionhub_sd_webui') || lower.includes('sd webui') || lower.includes('stable diffusion webui') || lower.includes('txt2img')) {
    const needsEndpoint = lower.includes('frontend_preflight_failed') || lower.includes('--api') || lower.includes('connection') || lower.includes('base url');
    return buildDiagnosis({
      category: needsEndpoint ? 'network' : 'unknown',
      severity: 'error',
      title: needsEndpoint ? 'SD WebUI / Forge 本地 API 不可用' : 'SD WebUI / Forge 本地生成失败',
      summary: record?.error || extractRawErrorMessage(raw) || '本地 SD WebUI / Forge txt2img 未完成，请检查端点、模型、采样器或参数。',
      actions: needsEndpoint
        ? [
            '确认 Stable Diffusion WebUI / Forge 已启动，并且启动参数包含 --api。',
            '到“平台接入 > 本地模型 > Stable Diffusion WebUI / Forge”检查 Base URL 和端口。',
            '先在浏览器打开 WebUI，确认本地服务可访问，再运行“测试连接”。'
          ]
        : [
            '先在 WebUI / Forge 的 txt2img 页面测试同一段 Prompt。',
            '检查 checkpoint、采样器、图片尺寸和显存余量。',
            '打开失败记录详情，查看原始 /sdapi/v1/txt2img 响应。'
          ],
      details,
      rawMessage,
      httpStatus,
      traceId,
      requestId
    });
  }

  if (potentialBackground) {
    return buildDiagnosis({
      category: 'timeout-background',
      severity: 'warning',
      title: '同步超时，后台可能仍在生成',
      summary: '连接先断开了，不一定代表任务失败。中转站或上游可能仍在后台处理。',
      actions: [
        '先点“重载历史”，或稍后到作品画廊/中转站后台查看是否已生成。',
        '下次可先降低尺寸、质量或生成数量，减少同步等待时间。',
        '如果经常出现，优先检查中转站是否支持后台任务轮询。'
      ],
      details,
      rawMessage,
      httpStatus,
      traceId,
      requestId,
      isPotentialBackgroundCompletion: true
    });
  }

  if (hasAny(lower, ['moderation_blocked', 'safety', 'policy', 'content policy', '内容安全', '审核', '敏感'])) {
    return buildDiagnosis({
      category: 'content-safety',
      severity: 'warning',
      title: '内容安全拦截',
      summary: '请求被安全策略拦截，通常需要修改提示词或参考图后再提交。',
      actions: [
        '删除攻击、露骨、暴力、真实人物敏感身份等高风险描述。',
        '如果提示词没问题，换一张参考图或减少参考图中的敏感元素。',
        '不要直接重试同一请求，先改 Prompt 或输入图。'
      ],
      details,
      rawMessage,
      httpStatus,
      traceId,
      requestId
    });
  }

  if (httpStatus === 401 || hasAny(lower, ['unauthorized', 'invalid api key', 'incorrect api key', '认证失败', 'api key 无效', 'apikey'])) {
    return buildDiagnosis({
      category: 'auth',
      severity: 'error',
      title: '认证失败',
      summary: '当前 API Key 没被服务商接受，可能是 Key 无效、过期、填错通道或中转站鉴权格式不对。',
      actions: [
        '到平台接入页重新保存当前 Provider profile 的 API Key。',
        '确认 Base URL 对应的是同一家中转站，不要把官方 Key 和中转站 Key 混用。',
        '如果中转站要求额外 Header，检查额外 Header JSON 是否正确。'
      ],
      details,
      rawMessage,
      httpStatus,
      traceId,
      requestId
    });
  }

  if (httpStatus === 403 || hasAny(lower, ['forbidden', 'permission', 'not allowed', '权限不足', '无权限', 'organization verification'])) {
    return buildDiagnosis({
      category: 'permission',
      severity: 'error',
      title: '权限不足或模型未开通',
      summary: '账号/Key 可能没有当前模型、图片接口或图生图能力的权限。',
      actions: [
        '换一个已确认支持生图的模型测试。',
        '检查中转站账号是否开通图片模型、图生图和对应额度。',
        '官方 OpenAI 通道需要确认组织验证、项目权限和模型权限。'
      ],
      details,
      rawMessage,
      httpStatus,
      traceId,
      requestId
    });
  }

  if (httpStatus === 429 || hasAny(lower, ['rate limit', 'too many requests', 'insufficient_quota', 'quota', 'billing hard limit', '余额不足', '额度', '限流', '并发'])) {
    return buildDiagnosis({
      category: hasAny(lower, ['rate limit', 'too many requests', '限流', '并发']) ? 'rate-limit' : 'quota',
      severity: 'warning',
      title: '额度/频率受限',
      summary: '当前账号可能余额不足、达到频率限制、并发限制或项目账单上限。',
      actions: [
        '检查中转站余额、套餐、并发限制和失败扣费规则。',
        '降低生成数量/尺寸后重试，或等一段时间再试。',
        '如果是官方 OpenAI，检查项目用量上限、付款方式和组织额度。'
      ],
      details,
      rawMessage,
      httpStatus,
      traceId,
      requestId
    });
  }

  if (isProtocolMismatch(lower, httpStatus, generationMode, protocolMapping, referenceCount)) {
    return buildDiagnosis({
      category: 'protocol',
      severity: 'error',
      title: referenceCount > 1 ? '多参考图协议不匹配' : '图生图协议不匹配',
      summary: referenceCount > 1
        ? '当前服务商可能只兼容单参考图，或不接受现在的多图字段结构。'
        : '当前图生图字段、请求形态或接口路径与服务商要求不一致。',
      actions: protocolActions(protocolMapping, referenceCount),
      details,
      rawMessage,
      httpStatus,
      traceId,
      requestId
    });
  }

  if (httpStatus === 404 || hasAny(lower, ['not found', 'no such model', 'model_not_found', '模型不存在', '接口不存在'])) {
    return buildDiagnosis({
      category: hasAny(lower, ['model', '模型']) ? 'model' : 'protocol',
      severity: 'error',
      title: hasAny(lower, ['model', '模型']) ? '模型不存在或名称不对' : '接口路径不存在',
      summary: '服务商没有找到当前模型或接口路径。',
      actions: [
        '从中转站后台复制准确模型名，避免手打别名。',
        '检查协议类型和 endpoint path，例如官方图生图应是 /v1/images/edits。',
        '如果模型列表拉取失败，先手动填一个确认可用的图片模型。'
      ],
      details,
      rawMessage,
      httpStatus,
      traceId,
      requestId
    });
  }

  if (httpStatus === 400 || httpStatus === 422 || hasAny(lower, ['invalid request', 'bad request', 'invalid parameter', '参数', '字段', 'size', 'quality'])) {
    return buildDiagnosis({
      category: 'parameter',
      severity: 'error',
      title: '请求参数不被接受',
      summary: '服务商拒绝了当前参数，常见原因是尺寸、质量、模型名、输出格式或参考图字段不支持。',
      actions: [
        '先切回常用尺寸、质量“自动”、生成数量 1 后重试。',
        '图生图先只保留 1 张参考图，确认单图成功后再试多图。',
        '检查平台接入里的协议类型、图生图映射和接口路径。'
      ],
      details,
      rawMessage,
      httpStatus,
      traceId,
      requestId
    });
  }

  if (hasAny(lower, ['html instead of json', '响应不是 json', 'cannot parse', 'parse_error', '<html', 'cloudflare'])) {
    return buildDiagnosis({
      category: 'response-format',
      severity: 'error',
      title: '返回内容不是标准 JSON',
      summary: '接口返回了 HTML、网关页或非标准响应，通常是 Base URL/路径不对，或中转站需要浏览器验证。',
      actions: [
        '检查 Base URL 不要带多余路径，endpoint path 单独填写。',
        '确认中转站 API 域名不是网页控制台地址。',
        '如果返回 Cloudflare/登录页，说明该地址不适合直接作为 API。'
      ],
      details,
      rawMessage,
      httpStatus,
      traceId,
      requestId
    });
  }

  if (httpStatus && httpStatus >= 500) {
    return buildDiagnosis({
      category: 'server',
      severity: 'warning',
      title: '服务商/中转站异常',
      summary: '请求已到服务端，但上游或中转站没有正常完成。',
      actions: [
        '稍后重试，或换同平台其他图片模型测试。',
        '降低尺寸、质量、生成数量，排除单次任务过重。',
        '如果持续失败，把 trace/request id 发给中转站排查。'
      ],
      details,
      rawMessage,
      httpStatus,
      traceId,
      requestId
    });
  }

  if (hasAny(lower, ['failed to fetch', 'dns', 'certificate', 'connection refused', 'connection reset', 'timed out', '网络', '连接失败', '证书'])) {
    return buildDiagnosis({
      category: 'network',
      severity: 'error',
      title: '网络连接失败',
      summary: '软件没有稳定连到当前 API 地址，可能是地址不可达、证书问题或服务临时断开。',
      actions: [
        '检查 Base URL 是否能在浏览器或中转站文档中确认。',
        '不要修改系统代理；先换一个已验证可用的中转站 API 地址测试。',
        '如果是本地服务，确认服务端口已启动。'
      ],
      details,
      rawMessage,
      httpStatus,
      traceId,
      requestId
    });
  }

  if (hasAny(lower, ['没有返回有效图片', 'no image', 'returned no image', '接口没有返回图片'])) {
    return buildDiagnosis({
      category: 'no-image',
      severity: 'error',
      title: '接口成功响应但没有图片',
      summary: '服务端返回了响应，但里面没有可提取的图片 URL 或 base64。',
      actions: [
        '确认当前模型是真正的生图模型，而不是只返回文本的对话模型。',
        '检查协议类型：Responses、Images、Chat Completions 的返回结构不同。',
        '打开失败记录详情，查看 raw 响应里图片字段位置是否和当前解析规则不一致。'
      ],
      details,
      rawMessage,
      httpStatus,
      traceId,
      requestId
    });
  }

  return buildDiagnosis({
    category: 'unknown',
    severity: 'error',
    title: '生图失败，原因待确认',
    summary: '这类错误还没有被明确归类，需要结合 HTTP 状态、trace id 和 raw 响应继续判断。',
    actions: DEFAULT_ACTIONS,
    details,
    rawMessage,
    httpStatus,
    traceId,
    requestId
  });
}

export function generationFailureSummary(record?: DiagnosableGenerationRecord | null) {
  const diagnosis = diagnoseGenerationFailure(record);
  return `${diagnosis.title}：${diagnosis.summary}`;
}

export function isPotentialBackgroundCompletion(record?: DiagnosableGenerationRecord | null) {
  return diagnoseGenerationFailure(record).isPotentialBackgroundCompletion;
}

function translateDiagnostic(t: Translator | undefined, key: Parameters<Translator>[0], fallback: string, params?: Record<string, string | number>) {
  return t ? t(key, params) : fallback;
}

function buildDiagnosis(input: Omit<GenerationFailureDiagnosis, 'actions' | 'details' | 'isPotentialBackgroundCompletion'> & {
  actions: string[];
  details?: string[];
  isPotentialBackgroundCompletion?: boolean;
}): GenerationFailureDiagnosis {
  return {
    ...input,
    actions: input.actions.filter(Boolean).slice(0, 4),
    details: (input.details ?? []).filter(Boolean),
    isPotentialBackgroundCompletion: Boolean(input.isPotentialBackgroundCompletion)
  };
}

function hasAny(text: string, tokens: string[]) {
  return tokens.some((token) => text.includes(token.toLowerCase()));
}

function stringifyRaw(raw: unknown) {
  if (raw == null) return '';
  try {
    return JSON.stringify(raw);
  } catch {
    return String(raw);
  }
}

function rawAsRecord(raw: unknown): Record<string, unknown> | null {
  return raw && typeof raw === 'object' && !Array.isArray(raw) ? raw as Record<string, unknown> : null;
}

function extractRawErrorMessage(raw: unknown): string {
  const record = rawAsRecord(raw);
  if (!record) return '';
  const error = record.error;
  if (typeof error === 'string') return error;
  const errorRecord = rawAsRecord(error);
  const message = errorRecord?.message;
  if (typeof message === 'string') return message;
  const topMessage = record.message;
  return typeof topMessage === 'string' ? topMessage : '';
}

function extractHttpStatus(error: string | undefined, raw: unknown) {
  const record = rawAsRecord(raw);
  const rawStatus = record?.http_status ?? record?.status;
  if (typeof rawStatus === 'number') return rawStatus;
  if (typeof rawStatus === 'string' && /^\d+$/.test(rawStatus)) return Number(rawStatus);
  const match = `${error ?? ''} ${stringifyRaw(raw)}`.match(/HTTP\s+(\d{3})|status(?:_code)?["':\s]+(\d{3})/i);
  const status = match?.[1] ?? match?.[2];
  return status ? Number(status) : undefined;
}

function extractProtocolMapping(raw: unknown): ProtocolMapping | undefined {
  const record = rawAsRecord(raw);
  const mapping = rawAsRecord(record?.visionhub_protocol_mapping);
  if (!mapping) return undefined;
  const referenceFields = Array.isArray(mapping.reference_fields)
    ? mapping.reference_fields.filter((field): field is string => typeof field === 'string')
    : undefined;
  return {
    image_to_image_adapter: typeof mapping.image_to_image_adapter === 'string' ? mapping.image_to_image_adapter : undefined,
    request_shape: typeof mapping.request_shape === 'string' ? mapping.request_shape : undefined,
    reference_count: typeof mapping.reference_count === 'number' ? mapping.reference_count : undefined,
    reference_fields: referenceFields,
    endpoint_path: typeof mapping.endpoint_path === 'string' ? mapping.endpoint_path : undefined,
    protocol: typeof mapping.protocol === 'string' ? mapping.protocol : undefined,
    is_image_to_image: typeof mapping.is_image_to_image === 'boolean' ? mapping.is_image_to_image : undefined
  };
}

function extractTraceId(text: string, raw: unknown) {
  const record = rawAsRecord(raw);
  const direct = record?.trace_id ?? record?.traceId;
  if (typeof direct === 'string') return direct;
  return text.match(/trace[_ -]?id["':：\s]+([a-z0-9-]+)/i)?.[1];
}

function extractRequestId(text: string, raw: unknown) {
  const record = rawAsRecord(raw);
  const direct = record?.request_id ?? record?.requestId;
  if (typeof direct === 'string') return direct;
  return text.match(/(?:request|req)[_ -]?id["':：\s]+([a-z0-9-]+)/i)?.[1];
}

function isPotentialBackgroundCompletionText(lower: string, httpStatus: number | undefined, raw: unknown) {
  const record = rawAsRecord(raw);
  return (
    httpStatus === 408 ||
    httpStatus === 524 ||
    lower.includes('同步连接超时') ||
    lower.includes('background task') ||
    lower.includes('poll_error') ||
    lower.includes('poll_url') ||
    lower.includes('轮询') ||
    Boolean(record?.poll_error || record?.poll_url)
  );
}

function isProtocolMismatch(
  lower: string,
  httpStatus: number | undefined,
  generationMode: GenerationMode,
  mapping: ProtocolMapping | undefined,
  referenceCount: number
) {
  if (generationMode !== 'image-to-image' && !mapping?.is_image_to_image) return false;
  if (hasAny(lower, ['unsupported image', 'image[]', 'images', 'input_image', 'image_url', 'multipart', '字段', '图生图映射', 'reference'])) return true;
  if (httpStatus && [400, 404, 415, 422].includes(httpStatus) && mapping?.image_to_image_adapter) return true;
  return referenceCount > 1 && mapping?.image_to_image_adapter === 'json-image-array' && httpStatus === 400;
}

function protocolActions(mapping: ProtocolMapping | undefined, referenceCount: number) {
  const adapter = mapping?.image_to_image_adapter;
  if (referenceCount > 1) {
    return [
      '先只保留 1 张参考图重试，确认单图链路稳定。',
      adapter === 'json-image-array'
        ? '如果服务商是 GPT Image 官方兼容路线，改用 OpenAI Images edits，并把路径设为 /v1/images/edits。'
        : '确认服务商文档是否支持多参考图，以及字段名是 image[]、images 还是 input_image。',
      '如果中转站只支持单图，把多参考作为待接入能力，不要直接按 4 张发送。',
      '保留当前 trace id，发给中转站确认多图字段结构。'
    ];
  }
  return [
    adapter === 'openai-images-edit'
      ? '确认 endpoint path 是 /v1/images/edits，不是 /v1/images/generations。'
      : '在平台接入里切换图生图映射：OpenAI edits / Responses input_image / Chat image_url / JSON image-array 逐一匹配。',
    '确认当前模型支持图生图，而不是纯文生图或聊天模型。',
    '先用默认尺寸、质量自动、生成数量 1 测试。'
  ];
}

function buildDetails(input: {
  httpStatus?: number;
  protocolMapping?: ProtocolMapping;
  traceId?: string;
  requestId?: string;
  generationMode?: GenerationMode;
  referenceCount: number;
  modelId?: string;
}, t?: Translator) {
  const details: string[] = [];
  if (input.httpStatus) details.push(`HTTP ${input.httpStatus}`);
  if (input.modelId) details.push(translateDiagnostic(t, 'generate.error.detail.model', `模型：${input.modelId}`, { model: input.modelId }));
  if (input.generationMode) details.push(translateDiagnostic(t, 'generate.error.detail.mode', `模式：${input.generationMode === 'image-to-image' ? '图生图' : '文生图'}`, { mode: input.generationMode === 'image-to-image' ? translateDiagnostic(t, 'generate.error.detail.modeImage', '图生图') : translateDiagnostic(t, 'generate.error.detail.modeText', '文生图') }));
  if (input.referenceCount > 0) details.push(translateDiagnostic(t, 'generate.error.detail.references', `参考图：${input.referenceCount} 张`, { count: input.referenceCount }));
  if (input.protocolMapping?.image_to_image_adapter) {
    details.push(translateDiagnostic(t, 'generate.error.detail.adapter', `图生图映射：${input.protocolMapping.image_to_image_adapter}`, { adapter: input.protocolMapping.image_to_image_adapter }));
  }
  if (input.protocolMapping?.endpoint_path) {
    details.push(translateDiagnostic(t, 'generate.error.detail.endpoint', `接口路径：${input.protocolMapping.endpoint_path}`, { path: input.protocolMapping.endpoint_path }));
  }
  if (input.protocolMapping?.reference_fields?.length) {
    details.push(translateDiagnostic(t, 'generate.error.detail.referenceFields', `参考字段：${input.protocolMapping.reference_fields.join(', ')}`, { fields: input.protocolMapping.reference_fields.join(', ') }));
  }
  if (input.traceId) details.push(`trace_id：${input.traceId}`);
  if (input.requestId) details.push(`request_id：${input.requestId}`);
  return details;
}
