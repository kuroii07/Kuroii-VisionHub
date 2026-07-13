import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  LOCAL_COMFYUI_WORKFLOW_STORAGE_KEY,
  createLocalWorkflowPreset,
  loadLocalComfyUIWorkflowStore,
  normalizeLocalComfyUIWorkflowStore,
  parseComfyUIWorkflow,
  saveLocalComfyUIWorkflowStore,
  type LocalComfyUIWorkflowSummary
} from './comfyUIWorkflow';

function createSummary(overrides: Partial<LocalComfyUIWorkflowSummary> = {}): LocalComfyUIWorkflowSummary {
  return {
    fileName: 'workflow.json',
    importedAt: '2026-07-13T00:00:00.000Z',
    format: 'api',
    nodeCount: 0,
    linkCount: null,
    promptNodes: [],
    samplerNodes: [],
    checkpointNodes: [],
    sizeNodes: [],
    outputNodes: [],
    loaderNodes: [],
    otherKeyNodes: [],
    warnings: [],
    ...overrides
  };
}

function stubLocalStorage() {
  const values = new Map<string, string>();
  const localStorage = {
    getItem: vi.fn((key: string) => values.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => values.set(key, value)),
    removeItem: vi.fn((key: string) => values.delete(key))
  };
  vi.stubGlobal('window', { localStorage });
  return { localStorage, values };
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('comfyUIWorkflow', () => {
  it('parses API Format workflows and groups key node roles', () => {
    const summary = parseComfyUIWorkflow('api.json', JSON.stringify({
      1: { class_type: 'CLIPTextEncode', inputs: { text: 'orange cat' } },
      2: { class_type: 'KSampler', inputs: { seed: 42, steps: 24 } },
      3: { class_type: 'CheckpointLoaderSimple', inputs: { ckpt_name: 'model.safetensors' } },
      4: { class_type: 'SaveImage', inputs: { filename_prefix: 'VisionHub' } }
    }));

    expect(summary.format).toBe('api');
    expect(summary.nodeCount).toBe(4);
    expect(summary.linkCount).toBeNull();
    expect(summary.promptNodes[0]?.summary).toContain('text: orange cat');
    expect(summary.samplerNodes[0]?.summary).toContain('steps: 24');
    expect(summary.checkpointNodes).toHaveLength(1);
    expect(summary.outputNodes).toHaveLength(1);
    expect(summary.warnings).toEqual([]);
  });

  it('parses UI workflows and preserves titles and link counts', () => {
    const summary = parseComfyUIWorkflow('ui.json', JSON.stringify({
      nodes: [
        { id: 1, type: 'CLIPTextEncode', title: 'Positive Prompt', widgets_values: ['forest'] },
        { id: 2, type: 'KSampler', widgets_values: [123, 20] },
        { id: 3, type: 'PreviewImage', widgets_values: [] }
      ],
      links: [[1, 1, 2, 0, '*']]
    }));

    expect(summary.format).toBe('ui');
    expect(summary.nodeCount).toBe(3);
    expect(summary.linkCount).toBe(1);
    expect(summary.promptNodes[0]?.title).toBe('Positive Prompt');
    expect(summary.outputNodes).toHaveLength(1);
    expect(summary.warnings).toEqual([]);
  });

  it('returns an unknown summary for unrecognized workflow objects', () => {
    const summary = parseComfyUIWorkflow('unknown.json', '{}');

    expect(summary.format).toBe('unknown');
    expect(summary.nodeCount).toBe(0);
    expect(summary.warnings).toHaveLength(3);
  });

  it('rejects workflow JSON whose root is not an object', () => {
    expect(() => parseComfyUIWorkflow('invalid.json', '[]')).toThrow(
      'Workflow JSON root is not an object and cannot be detected.'
    );
  });

  it('migrates the legacy single-summary storage shape without changing its fields', () => {
    const legacy = createSummary({ fileName: 'legacy-workflow.json', nodeCount: 7 });
    const store = normalizeLocalComfyUIWorkflowStore(legacy);

    expect(store.presets).toHaveLength(1);
    expect(store.activeId).toBe(store.presets[0]?.id);
    expect(store.presets[0]?.name).toBe('legacy-workflow');
    expect(store.presets[0]?.summary).toEqual(legacy);
  });

  it('falls back to the first valid preset when the saved active id is invalid', () => {
    const first = createLocalWorkflowPreset(createSummary(), 'First');
    const second = createLocalWorkflowPreset(createSummary({ fileName: 'second.json' }), 'Second');
    const store = normalizeLocalComfyUIWorkflowStore({
      activeId: 'missing',
      presets: [first, { id: 12, name: 'invalid', summary: {} }, second]
    });

    expect(store.activeId).toBe(first.id);
    expect(store.presets.map((preset) => preset.name)).toEqual(['First', 'Second']);
  });

  it('loads, saves, and clears the established workflow storage key', () => {
    const { localStorage, values } = stubLocalStorage();
    const preset = createLocalWorkflowPreset(createSummary(), 'Saved workflow');
    const store = { activeId: preset.id, presets: [preset] };

    saveLocalComfyUIWorkflowStore(store);
    expect(localStorage.setItem).toHaveBeenCalledWith(LOCAL_COMFYUI_WORKFLOW_STORAGE_KEY, JSON.stringify(store));
    expect(loadLocalComfyUIWorkflowStore()).toEqual(store);

    saveLocalComfyUIWorkflowStore({ activeId: null, presets: [] });
    expect(localStorage.removeItem).toHaveBeenCalledWith(LOCAL_COMFYUI_WORKFLOW_STORAGE_KEY);
    expect(values.has(LOCAL_COMFYUI_WORKFLOW_STORAGE_KEY)).toBe(false);
  });

  it('does not throw when an empty store is saved without a browser window', () => {
    expect(() => saveLocalComfyUIWorkflowStore({ activeId: null, presets: [] })).not.toThrow();
  });

  it('does not throw when local storage rejects empty-store cleanup', () => {
    vi.stubGlobal('window', {
      localStorage: {
        removeItem: vi.fn(() => {
          throw new Error('storage denied');
        })
      }
    });
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    expect(() => saveLocalComfyUIWorkflowStore({ activeId: null, presets: [] })).not.toThrow();
  });
});
