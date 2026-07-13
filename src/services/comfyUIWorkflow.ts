import { readStorageValue, removeStorageValue, writeStorageValue } from './safeStorage';

export type LocalComfyUIWorkflowFormat = 'api' | 'ui' | 'unknown';
export type LocalComfyUIWorkflowNodeRole = 'prompt' | 'sampler' | 'checkpoint' | 'size' | 'output' | 'loader' | 'other';
export type LocalComfyUIWorkflowNode = {
  id: string;
  type: string;
  title?: string;
  role: LocalComfyUIWorkflowNodeRole;
  summary: string;
};
export type LocalComfyUIWorkflowSummary = {
  fileName: string;
  importedAt: string;
  format: LocalComfyUIWorkflowFormat;
  nodeCount: number;
  linkCount: number | null;
  promptNodes: LocalComfyUIWorkflowNode[];
  samplerNodes: LocalComfyUIWorkflowNode[];
  checkpointNodes: LocalComfyUIWorkflowNode[];
  sizeNodes: LocalComfyUIWorkflowNode[];
  outputNodes: LocalComfyUIWorkflowNode[];
  loaderNodes: LocalComfyUIWorkflowNode[];
  otherKeyNodes: LocalComfyUIWorkflowNode[];
  warnings: string[];
};
export type LocalComfyUIWorkflowPreset = {
  id: string;
  name: string;
  summary: LocalComfyUIWorkflowSummary;
  rawWorkflow?: unknown;
  createdAt: string;
  updatedAt: string;
};
export type LocalComfyUIWorkflowStore = {
  activeId: string | null;
  presets: LocalComfyUIWorkflowPreset[];
};

export const LOCAL_COMFYUI_WORKFLOW_STORAGE_KEY = 'visionhub.local.comfyui.workflow.v1';

export function createLocalWorkflowPreset(summary: LocalComfyUIWorkflowSummary, name?: string, rawWorkflow?: unknown): LocalComfyUIWorkflowPreset {
  const now = new Date().toISOString();
  return {
    id: `comfyui-workflow-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name: name?.trim() || summary.fileName.replace(/\.json$/i, '') || 'ComfyUI workflow',
    summary,
    rawWorkflow,
    createdAt: now,
    updatedAt: now
  };
}

export function normalizeLocalComfyUIWorkflowStore(value: unknown): LocalComfyUIWorkflowStore {
  const record = asRecord(value);
  if (!record) return { activeId: null, presets: [] };
  if (typeof record.fileName === 'string') {
    const preset = createLocalWorkflowPreset(record as unknown as LocalComfyUIWorkflowSummary);
    return { activeId: preset.id, presets: [preset] };
  }
  const presets = Array.isArray(record.presets)
    ? record.presets
        .map((item) => {
          const preset = asRecord(item);
          const summary = asRecord(preset?.summary);
          if (!preset || !summary || typeof preset.id !== 'string' || typeof preset.name !== 'string' || typeof summary.fileName !== 'string') return null;
          return {
            ...preset,
            rawWorkflow: 'rawWorkflow' in preset ? preset.rawWorkflow : undefined
          } as unknown as LocalComfyUIWorkflowPreset;
        })
        .filter((item): item is LocalComfyUIWorkflowPreset => Boolean(item))
    : [];
  const activeId = typeof record.activeId === 'string' && presets.some((preset) => preset.id === record.activeId)
    ? record.activeId
    : presets[0]?.id ?? null;
  return { activeId, presets };
}

export function loadLocalComfyUIWorkflowStore(): LocalComfyUIWorkflowStore {
  const raw = readStorageValue(LOCAL_COMFYUI_WORKFLOW_STORAGE_KEY);
  if (!raw) return { activeId: null, presets: [] };
  try {
    return normalizeLocalComfyUIWorkflowStore(JSON.parse(raw) as unknown);
  } catch (error) {
    console.warn('[VisionHub] local ComfyUI workflow store parse failed; ignoring saved workflows', error);
    return { activeId: null, presets: [] };
  }
}

export function saveLocalComfyUIWorkflowStore(store: LocalComfyUIWorkflowStore) {
  if (!store.presets.length) {
    removeStorageValue(LOCAL_COMFYUI_WORKFLOW_STORAGE_KEY);
    return;
  }
  writeStorageValue(LOCAL_COMFYUI_WORKFLOW_STORAGE_KEY, JSON.stringify(store));
}

export function readTextFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.onerror = () => reject(reader.error ?? new Error('Failed to read file.'));
    reader.readAsText(file, 'utf-8');
  });
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function stringifyWorkflowValue(value: unknown): string {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (Array.isArray(value)) return value.map(stringifyWorkflowValue).filter(Boolean).join(', ');
  if (value && typeof value === 'object') return JSON.stringify(value);
  return '';
}

function summarizeApiWorkflowInputs(inputs: Record<string, unknown> | null, keys: string[]) {
  if (!inputs) return '';
  return keys
    .filter((key) => key in inputs)
    .map((key) => `${key}: ${stringifyWorkflowValue(inputs[key])}`)
    .filter(Boolean)
    .join(' · ');
}

function classifyComfyUIRole(type: string): LocalComfyUIWorkflowNodeRole {
  const lowerType = type.toLowerCase();
  if (lowerType.includes('cliptextencode') || lowerType.includes('prompt')) return 'prompt';
  if (lowerType.includes('ksampler') || lowerType.includes('sampler')) return 'sampler';
  if (lowerType.includes('checkpoint') || lowerType.includes('unetloader')) return 'checkpoint';
  if (lowerType.includes('emptylatent') || lowerType.includes('latentsize') || lowerType.includes('resize')) return 'size';
  if (lowerType.includes('saveimage') || lowerType.includes('previewimage')) return 'output';
  if (lowerType.includes('loader') || lowerType.includes('lora') || lowerType.includes('vae')) return 'loader';
  return 'other';
}

function makeWorkflowNode(id: string, type: string, title: string | undefined, inputs: Record<string, unknown> | null): LocalComfyUIWorkflowNode {
  const role = classifyComfyUIRole(type);
  const summaryKeysByRole: Record<LocalComfyUIWorkflowNodeRole, string[]> = {
    prompt: ['text', 'clip'],
    sampler: ['seed', 'steps', 'cfg', 'sampler_name', 'scheduler', 'denoise', 'latent_image'],
    checkpoint: ['ckpt_name', 'unet_name', 'model_name'],
    size: ['width', 'height', 'batch_size', 'pixels'],
    output: ['filename_prefix', 'images'],
    loader: ['lora_name', 'vae_name', 'ckpt_name', 'model_name'],
    other: []
  };
  const summary = summarizeApiWorkflowInputs(inputs, summaryKeysByRole[role]) || 'Node detected. Expand the full fields later when mapping.';
  return {
    id,
    type,
    title,
    role,
    summary
  };
}

function parseComfyUIApiWorkflow(fileName: string, raw: Record<string, unknown>): LocalComfyUIWorkflowSummary | null {
  const entries = Object.entries(raw).filter(([, value]) => {
    const node = asRecord(value);
    return typeof node?.class_type === 'string';
  });
  if (!entries.length) return null;
  const nodes = entries.map(([id, value]) => {
    const node = asRecord(value);
    const type = String(node?.class_type ?? 'Unknown');
    return makeWorkflowNode(id, type, undefined, asRecord(node?.inputs));
  });
  return buildComfyUIWorkflowSummary(fileName, 'api', nodes, null);
}

function parseComfyUIUiWorkflow(fileName: string, raw: Record<string, unknown>): LocalComfyUIWorkflowSummary | null {
  const rawNodes = Array.isArray(raw.nodes) ? raw.nodes : [];
  if (!rawNodes.length) return null;
  const nodes = rawNodes
    .map((value, index) => {
      const node = asRecord(value);
      if (!node) return null;
      const type = typeof node.type === 'string' ? node.type : typeof node.class_type === 'string' ? node.class_type : 'Unknown';
      const title = typeof node.title === 'string' ? node.title : undefined;
      const widgetsValues = Array.isArray(node.widgets_values)
        ? Object.fromEntries(node.widgets_values.map((item, valueIndex) => [`widget_${valueIndex + 1}`, item]))
        : null;
      return makeWorkflowNode(String(node.id ?? index + 1), type, title, widgetsValues);
    })
    .filter((node): node is LocalComfyUIWorkflowNode => Boolean(node));
  const linkCount = Array.isArray(raw.links) ? raw.links.length : null;
  return buildComfyUIWorkflowSummary(fileName, 'ui', nodes, linkCount);
}

function buildComfyUIWorkflowSummary(
  fileName: string,
  format: LocalComfyUIWorkflowFormat,
  nodes: LocalComfyUIWorkflowNode[],
  linkCount: number | null
): LocalComfyUIWorkflowSummary {
  const promptNodes = nodes.filter((node) => node.role === 'prompt');
  const samplerNodes = nodes.filter((node) => node.role === 'sampler');
  const checkpointNodes = nodes.filter((node) => node.role === 'checkpoint');
  const sizeNodes = nodes.filter((node) => node.role === 'size');
  const outputNodes = nodes.filter((node) => node.role === 'output');
  const loaderNodes = nodes.filter((node) => node.role === 'loader');
  const otherKeyNodes = nodes
    .filter((node) => node.role === 'other')
    .slice(0, 6);
  const warnings: string[] = [];
  if (!promptNodes.length) warnings.push('No text prompt node detected. Manually choose the Prompt target before generation.');
  if (!samplerNodes.length) warnings.push('No sampler node detected. Confirm the task entry before real generation.');
  if (!outputNodes.length) warnings.push('No save or preview image node detected. Confirm how output images should be read.');
  return {
    fileName,
    importedAt: new Date().toISOString(),
    format,
    nodeCount: nodes.length,
    linkCount,
    promptNodes,
    samplerNodes,
    checkpointNodes,
    sizeNodes,
    outputNodes,
    loaderNodes,
    otherKeyNodes,
    warnings
  };
}

export function parseComfyUIWorkflow(fileName: string, content: string): LocalComfyUIWorkflowSummary {
  const raw = JSON.parse(content) as unknown;
  const record = asRecord(raw);
  if (!record) {
    throw new Error('Workflow JSON root is not an object and cannot be detected.');
  }
  const apiSummary = parseComfyUIApiWorkflow(fileName, record);
  if (apiSummary) return apiSummary;
  const uiSummary = parseComfyUIUiWorkflow(fileName, record);
  if (uiSummary) return uiSummary;
  return buildComfyUIWorkflowSummary(fileName, 'unknown', [], null);
}
