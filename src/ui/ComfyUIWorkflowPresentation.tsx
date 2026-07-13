import { Trash2 } from 'lucide-react';
import type { Translator } from '../i18n';
import { UtilityModalShell } from './AppDialogs';

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

function workflowFormatLabel(format: LocalComfyUIWorkflowFormat, t: Translator) {
  if (format === 'api') return t('provider.workflow.format.api');
  if (format === 'ui') return t('provider.workflow.format.ui');
  return t('provider.workflow.format.unknown');
}

function comfyUIWorkflowRunStatus(preset: LocalComfyUIWorkflowPreset, t: Translator) {
  if (preset.summary.format === 'api' && preset.rawWorkflow) return t('provider.workflow.status.runnable');
  if (preset.summary.format === 'api') return t('provider.workflow.status.legacyReimport');
  if (preset.summary.format === 'ui') return t('provider.workflow.status.exportApi');
  return t('provider.workflow.status.unavailable');
}

export function ComfyUIWorkflowSummaryPanel({ preset, t }: { preset: LocalComfyUIWorkflowPreset; t: Translator }) {
  const summary = preset.summary;
  const pt = (key: string, params?: Record<string, string | number>) => t(key as Parameters<Translator>[0], params);
  const groups: Array<{ label: string; nodes: LocalComfyUIWorkflowNode[] }> = [
    { label: pt('provider.workflow.prompt'), nodes: summary.promptNodes },
    { label: pt('provider.workflow.sampler'), nodes: summary.samplerNodes },
    { label: 'Checkpoint', nodes: summary.checkpointNodes },
    { label: pt('provider.workflow.size'), nodes: summary.sizeNodes },
    { label: pt('provider.workflow.output'), nodes: summary.outputNodes },
    { label: pt('provider.workflow.loader'), nodes: summary.loaderNodes }
  ].filter((group) => group.nodes.length > 0);

  return (
    <div className="localWorkflowSummary">
      <div className="localWorkflowMeta">
        <span>{workflowFormatLabel(summary.format, t)}</span>
        <span>{comfyUIWorkflowRunStatus(preset, t)}</span>
        <span>{pt('provider.local.nodes', { count: summary.nodeCount })}</span>
        <span>{pt('provider.workflow.links', { count: summary.linkCount ?? '-' })}</span>
      </div>
      <div className="localWorkflowFile">
        <strong>{preset.name}</strong>
        <small>{summary.fileName} · {preset.rawWorkflow ? pt('provider.workflow.rawSaved') : pt('provider.workflow.summaryOnly')}</small>
      </div>
      {summary.format === 'api' && !preset.rawWorkflow ? (
        <div className="localDiagnosticMessage failed">{pt('provider.workflow.legacyMissingRaw')}</div>
      ) : null}
      {summary.warnings.length ? (
        <div className="localWorkflowWarnings">
          {summary.warnings.map((warning) => (
            <span key={warning}>{warning}</span>
          ))}
        </div>
      ) : null}
      {groups.length ? (
        <div className="localWorkflowNodeGroups">
          {groups.map((group) => (
            <section className="localWorkflowNodeGroup" key={group.label}>
              <div className="localWorkflowNodeGroupHeader">
                <strong>{group.label}</strong>
                <span>{group.nodes.length}</span>
              </div>
              <div className="localWorkflowNodeList">
                {group.nodes.slice(0, 4).map((node) => (
                  <div className="localWorkflowNodeItem" key={`${group.label}-${node.id}`}>
                    <strong>#{node.id} · {node.title || node.type}</strong>
                    <small>{node.title ? node.type : node.summary}</small>
                    {node.title ? <small>{node.summary}</small> : null}
                  </div>
                ))}
                {group.nodes.length > 4 ? <span className="localWorkflowMore">{pt('provider.workflow.moreNodes', { count: group.nodes.length - 4 })}</span> : null}
              </div>
            </section>
          ))}
        </div>
      ) : (
        <div className="localDiagnosticMessage failed">{pt('provider.workflow.noNodes')}</div>
      )}
    </div>
  );
}

export function ComfyUIWorkflowManagerModal(props: {
  t: Translator;
  store: LocalComfyUIWorkflowStore;
  onClose: () => void;
  onSelect: (presetId: string) => void;
  onDelete: (presetId: string) => void;
}) {
  const activePreset = props.store.presets.find((preset) => preset.id === props.store.activeId) ?? props.store.presets[0] ?? null;

  return (
    <UtilityModalShell title={props.t('provider.workflow.manager.title')} eyebrow={props.t('provider.workflow.manager.eyebrow')} className="comfyWorkflowModal" onClose={props.onClose}>
      <div className="comfyWorkflowManager">
        <aside className="comfyWorkflowList" aria-label={props.t('provider.workflow.manager.listAria')}>
          {props.store.presets.length ? (
            props.store.presets.map((preset) => (
              <button
                type="button"
                className={preset.id === activePreset?.id ? 'active' : ''}
                onClick={() => props.onSelect(preset.id)}
                key={preset.id}
              >
                <strong>{preset.name}</strong>
                <span>{workflowFormatLabel(preset.summary.format, props.t)} · {comfyUIWorkflowRunStatus(preset, props.t)} · {props.t('provider.local.nodes', { count: preset.summary.nodeCount })}</span>
              </button>
            ))
          ) : (
            <div className="comfyWorkflowEmpty">
              <strong>{props.t('provider.workflow.manager.emptyTitle')}</strong>
              <span>{props.t('provider.workflow.manager.emptyHint')}</span>
            </div>
          )}
        </aside>
        <section className="comfyWorkflowDetail" aria-label={props.t('provider.workflow.manager.detailAria')}>
          {activePreset ? (
            <>
              <div className="comfyWorkflowDetailHeader">
                <div>
                  <strong>{activePreset.name}</strong>
                  <small>{activePreset.summary.fileName} · {workflowFormatLabel(activePreset.summary.format, props.t)}</small>
                </div>
                <button type="button" className="miniButton dangerMiniButton" onClick={() => props.onDelete(activePreset.id)} title={props.t('provider.workflow.manager.deleteTitle', { name: activePreset.name })} aria-label={props.t('provider.workflow.manager.deleteAria', { name: activePreset.name })}>
                  <Trash2 size={14} /> {props.t('provider.workflow.manager.delete')}
                </button>
              </div>
              <ComfyUIWorkflowSummaryPanel preset={activePreset} t={props.t} />
            </>
          ) : (
            <div className="comfyWorkflowEmpty">
              <strong>{props.t('provider.workflow.manager.selectTitle')}</strong>
              <span>{props.t('provider.workflow.manager.selectHint')}</span>
            </div>
          )}
        </section>
      </div>
    </UtilityModalShell>
  );
}
