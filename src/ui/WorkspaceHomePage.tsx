import {
  Bookmark,
  Database,
  ExternalLink,
  Gauge,
  HardDrive,
  Image,
  ImagePlus,
  Layers,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Wand2
} from 'lucide-react';
import type { ReactNode } from 'react';
import type { GenerationRecord } from '../domain/providerTypes';
import type { Translator } from '../i18n';
import type { AppPage, HomeModuleSettings } from '../services/appSettings';
import { diagnoseGenerationFailure } from '../services/generationErrorDiagnostics';
import {
  generationFailureCategoryLabel,
  generationStatusClass,
  generationStatusLabel,
  getRecordFileName,
  getRecordTimeMs
} from './generationRecordPresentation';

type LocalModelDiagnosticStatus = 'idle' | 'checking' | 'online' | 'offline' | 'failed';
type LocalComfyUIDiagnosticState = {
  status: LocalModelDiagnosticStatus;
};
type LocalComfyUIWorkflowFormat = 'api' | 'ui' | 'unknown';
type LocalComfyUIWorkflowPreset = {
  name: string;
  summary: {
    format: LocalComfyUIWorkflowFormat;
  };
  rawWorkflow?: unknown;
};
type LocalComfyUIWorkflowStore = {
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

export function WorkspaceHomePage(props: {
  t: Translator;
  providerName: string;
  providerProfileName: string;
  providerModelId: string;
  selectedProviderId: string;
  isRealProviderReady: boolean;
  secretAvailable: boolean;
  desktopRuntime: boolean;
  localComfyUIDiagnostic: LocalComfyUIDiagnosticState;
  localComfyUIWorkflowStore: LocalComfyUIWorkflowStore;
  activeComfyUIWorkflowPreset: LocalComfyUIWorkflowPreset | null;
  resultSummary: { total: number; succeeded: number; failed: number; pending: number };
  recentSuccessRecords: GenerationRecord[];
  recentFailureRecords: GenerationRecord[];
  favoriteRecords: GenerationRecord[];
  referenceRecords: GenerationRecord[];
  providerNameMap: Map<string, string>;
  homeModules: HomeModuleSettings;
  onNavigate: (page: AppPage) => void;
  onUseRecordAsReference: (record: GenerationRecord) => void;
  onOpenComfyUIWorkflowManager: () => void;
}) {
  const runnableWorkflowCount = props.localComfyUIWorkflowStore.presets.filter((preset) => Boolean(preset.rawWorkflow)).length;
  const comfyStatusLabel =
    props.localComfyUIDiagnostic.status === 'online'
      ? props.t('home.status.comfyOnline')
      : props.localComfyUIDiagnostic.status === 'offline'
        ? props.t('home.status.comfyOffline')
        : props.localComfyUIDiagnostic.status === 'failed'
          ? props.t('home.status.connectionFailed')
          : props.localComfyUIDiagnostic.status === 'checking'
            ? props.t('home.status.checking')
            : props.t('home.status.localPending');
  const comfyStatusTone =
    props.localComfyUIDiagnostic.status === 'online'
      ? 'ready'
      : props.localComfyUIDiagnostic.status === 'offline' || props.localComfyUIDiagnostic.status === 'failed'
        ? 'warning'
        : 'idle';
  const providerStatusTone = props.isRealProviderReady ? 'ready' : props.selectedProviderId === 'comfyui-local' || props.secretAvailable ? 'warning' : 'idle';
  const providerStatusLabel = props.isRealProviderReady
    ? props.t('home.status.providerReady')
    : props.selectedProviderId === 'comfyui-local'
      ? props.t('home.status.localWorkflowPending')
      : props.t('home.status.waitingSecret');
  const activeWorkflow = props.activeComfyUIWorkflowPreset;
  const activeWorkflowStatus = activeWorkflow ? comfyUIWorkflowRunStatus(activeWorkflow, props.t) : null;
  const continueRecord = props.recentSuccessRecords[0] ?? props.referenceRecords[0] ?? props.favoriteRecords[0] ?? null;
  const materialRecords = mergeWorkspaceRecords([
    ...props.recentSuccessRecords,
    ...props.referenceRecords,
    ...props.favoriteRecords
  ]).slice(0, 8);
  const pendingTaskCount = props.recentFailureRecords.length + props.resultSummary.pending;
  const quickActions: Array<{ page: AppPage; label: string; detail: string; icon: ReactNode }> = [
    { page: 'generate', label: props.t('nav.generate'), detail: props.t('home.quick.generateDetail'), icon: <Wand2 size={16} /> },
    { page: 'library', label: props.t('nav.library'), detail: props.t('home.quick.libraryDetail'), icon: <Image size={16} /> },
    { page: 'inspiration', label: props.t('nav.inspiration'), detail: props.t('home.quick.inspirationDetail'), icon: <Bookmark size={16} /> },
    { page: 'templates', label: props.t('nav.templates'), detail: props.t('home.quick.templatesDetail'), icon: <Layers size={16} /> },
    { page: 'providers', label: props.t('nav.providers'), detail: props.t('home.quick.providersDetail'), icon: <Database size={16} /> }
  ];
  function useRecordAsReferenceAndCreate(record: GenerationRecord) {
    props.onUseRecordAsReference(record);
    props.onNavigate('generate');
  }

  return (
    <section className="workspaceHome workspaceHomeV21" aria-label={props.t('home.aria')}>
      <header className="workspaceCommandBar">
        <div className="workspaceCommandTitle">
          <span>{props.t('home.command.eyebrow')}</span>
          <h1>{props.t('home.title')}</h1>
        </div>
        <div className="workspaceCommandStatus" aria-label={props.t('home.status.current')}>
          <span className={`workspaceStatusPill ${providerStatusTone}`}>
            <ShieldCheck size={14} /> {providerStatusLabel}
          </span>
          <span className={`workspaceStatusPill ${comfyStatusTone}`}>
            <HardDrive size={14} /> {comfyStatusLabel}
          </span>
          <span className="workspaceStatusPill neutral">{props.t('home.status.localFirst')}</span>
        </div>
        <div className="workspaceCommandActions">
          <button type="button" className="workspaceCommandButton primary" onClick={() => props.onNavigate('generate')}>
            <Wand2 size={15} /> {props.t('home.action.start')}
          </button>
          <button type="button" className="workspaceCommandButton" onClick={() => props.onNavigate('library')}>
            <Image size={15} /> {props.t('home.action.openGallery')}
          </button>
          <button type="button" className="workspaceCommandButton" onClick={() => props.onNavigate('providers')}>
            <Gauge size={15} /> {props.t('home.action.checkConfig')}
          </button>
        </div>
      </header>

      {props.homeModules.resume || props.homeModules.attention ? (
      <section className={`workspaceFlowGrid ${!props.homeModules.resume || !props.homeModules.attention ? 'singleModule' : ''}`} aria-label={props.t('home.resume.aria')}>
        {props.homeModules.resume ? <article className={`workspaceContinuePanel ${continueRecord ? '' : 'isEmpty'}`}>
          <div className="workspaceSectionHeading">
            <div>
              <p className="eyebrow">{props.t('home.resume.eyebrow')}</p>
              <h2>{props.t('home.resume.title')}</h2>
            </div>
            <span className="workspaceSoftCounter">{props.t('home.resume.successCount', { count: props.resultSummary.succeeded })}</span>
          </div>
          {continueRecord ? (
            <div className="workspaceContinueBody">
              <button
                type="button"
                className="workspaceContinuePreview"
                onClick={() => props.onNavigate('library')}
                aria-label={props.t('home.resume.openRecent')}
              >
                <img src={continueRecord.imageUrls[0]} alt={continueRecord.prompt || getRecordFileName(continueRecord) || props.t('home.resume.recentAlt')} loading="lazy" decoding="async" />
              </button>
              <div className="workspaceContinueInfo">
                <strong>{getRecordFileName(continueRecord) || continueRecord.prompt || props.t('home.resume.untitled')}</strong>
                <p>{continueRecord.prompt || props.t('home.resume.noPrompt')}</p>
                <div className="workspaceContinueMeta">
                  <span>{props.providerNameMap.get(continueRecord.providerId) ?? continueRecord.providerName ?? props.providerName}</span>
                  <span>{continueRecord.modelId || props.providerModelId}</span>
                  <span>{formatWorkspaceHomeTime(continueRecord.createdAt, props.t)}</span>
                </div>
                <div className="workspaceContinueActions">
                  <button type="button" className="workspaceCommandButton primary" onClick={() => useRecordAsReferenceAndCreate(continueRecord)}>
                    <ImagePlus size={15} /> {props.t('home.action.setReference')}
                  </button>
                  <button type="button" className="workspaceCommandButton" onClick={() => props.onNavigate('library')}>
                    <ExternalLink size={15} /> {props.t('home.action.openDetail')}
                  </button>
                  <button type="button" className="workspaceCommandButton" onClick={() => props.onNavigate('generate')}>
                    <Wand2 size={15} /> {props.t('home.action.continueDesk')}
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <WorkspaceHomeEmpty title={props.t('home.resume.emptyTitle')} hint={props.t('home.resume.emptyHint')} actionLabel={props.t('home.action.start')} onAction={() => props.onNavigate('generate')} />
          )}
        </article> : null}

        {props.homeModules.attention ? <aside className="workspaceTaskRail" aria-label={props.t('home.attention.aria')}>
          <div className="workspaceMiniStats">
            <span><strong>{props.resultSummary.total}</strong>{props.t('home.attention.totalRecords')}</span>
            <span><strong>{props.favoriteRecords.length}</strong>{props.t('home.attention.favorites')}</span>
            <span><strong>{props.referenceRecords.length}</strong>{props.t('home.attention.references')}</span>
          </div>
          <div className="workspaceTodoPanel">
            <div className="workspaceSectionHeading compact">
              <div>
                <p className="eyebrow">{props.t('home.attention.eyebrow')}</p>
                <h2>{props.t('home.attention.title')}</h2>
              </div>
              <span className={pendingTaskCount ? 'workspaceSoftCounter warning' : 'workspaceSoftCounter'}>{props.t('home.attention.itemCount', { count: pendingTaskCount })}</span>
            </div>
            {props.recentFailureRecords.length || props.resultSummary.pending ? (
              <div className="workspaceTodoList">
                {props.resultSummary.pending ? (
                  <button type="button" className="workspaceTodoItem" onClick={() => props.onNavigate('library')}>
                    <span className="workspaceTodoDot pending" />
                    <span><strong>{props.t('home.attention.pendingTitle', { count: props.resultSummary.pending })}</strong><small>{props.t('home.attention.pendingHint')}</small></span>
                  </button>
                ) : null}
                {props.recentFailureRecords.map((record) => {
                  const diagnosis = diagnoseGenerationFailure(record, props.t);
                  return (
                    <button type="button" className="workspaceTodoItem" key={record.id} onClick={() => props.onNavigate('library')}>
                      <span className={`workspaceTodoDot ${generationStatusClass(record)}`} />
                      <span>
                        <strong>{generationStatusLabel(record)} · {generationFailureCategoryLabel(diagnosis.category, props.t)}</strong>
                        <small>{diagnosis.title} · {formatWorkspaceHomeTime(record.createdAt, props.t)}</small>
                      </span>
                    </button>
                  );
                })}
              </div>
            ) : (
              <WorkspaceHomeEmpty title={props.t('home.attention.emptyTitle')} hint={props.t('home.attention.emptyHint')} />
            )}
          </div>
          <div className="workspaceLocalSummary">
            <div>
              <strong>{props.t('home.local.title')}</strong>
              <span>{props.t('home.local.workflowSummary', { total: props.localComfyUIWorkflowStore.presets.length, runnable: runnableWorkflowCount })}</span>
              <small>{activeWorkflow ? `${activeWorkflow.name} · ${workflowFormatLabel(activeWorkflow.summary.format, props.t)} · ${activeWorkflowStatus ?? props.t('home.status.checking')}` : props.t('home.local.noWorkflow')}</small>
            </div>
            <button type="button" className="workspaceIconAction" onClick={props.onOpenComfyUIWorkflowManager} aria-label={props.t('home.local.openManager')} title={props.t('home.local.openManager')}>
              <SlidersHorizontal size={15} />
            </button>
          </div>
        </aside> : null}
      </section>
      ) : null}

      {props.homeModules.materials ? <section className="workspaceAssetStripPanel" aria-label={props.t('home.materials.aria')}>
        <div className="workspaceSectionHeading">
          <div>
            <p className="eyebrow">{props.t('home.materials.eyebrow')}</p>
            <h2>{props.t('home.materials.title')}</h2>
          </div>
          <div className="workspaceStripFilters" aria-label={props.t('home.materials.sourceAria')}>
            <span>{props.t('home.materials.recent')}</span>
            <span>{props.t('home.materials.reference')}</span>
            <span>{props.t('home.materials.favorite')}</span>
          </div>
        </div>
        {materialRecords.length ? (
          <div className="workspaceAssetStrip">
            {materialRecords.map((record) => (
              <article className="workspaceAssetTile" key={record.id}>
                <button type="button" className="workspaceAssetThumb" onClick={() => props.onNavigate('library')} aria-label={props.t('home.materials.enterGallery')}>
                  <img src={record.imageUrls[0]} alt={record.prompt || getRecordFileName(record) || props.t('home.materials.thumbAlt')} loading="lazy" decoding="async" />
                </button>
                <div className="workspaceAssetMeta">
                  <strong>{getRecordFileName(record) || record.prompt || props.t('home.materials.untitled')}</strong>
                  <span>{formatWorkspaceHomeTime(record.createdAt, props.t)}</span>
                </div>
                <div className="workspaceAssetActions">
                  <button type="button" onClick={() => useRecordAsReferenceAndCreate(record)}>{props.t('home.action.reference')}</button>
                  <button type="button" onClick={() => props.onNavigate('library')}>{props.t('home.action.detail')}</button>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <WorkspaceHomeEmpty title={props.t('home.materials.emptyTitle')} hint={props.t('home.materials.emptyHint')} actionLabel={props.t('home.materials.enterGallery')} onAction={() => props.onNavigate('library')} />
        )}
      </section> : null}

      {props.homeModules.quickActions ? <section className="workspaceCommandDock" aria-label={props.t('home.quick.aria')}>
        <span className="workspaceDockLabel">{props.t('home.quick.label')}</span>
        {quickActions.map((item) => (
          <button type="button" key={item.page} className="workspaceDockButton" onClick={() => props.onNavigate(item.page)}>
            {item.icon}
            <span><strong>{item.label}</strong><small>{item.detail}</small></span>
          </button>
        ))}
      </section> : null}

    </section>
  );
}

function mergeWorkspaceRecords(records: GenerationRecord[]) {
  const seen = new Set<string>();
  return records.filter((record) => {
    if (!record.imageUrls[0] || seen.has(record.id)) return false;
    seen.add(record.id);
    return true;
  });
}

function WorkspaceHomeEmpty(props: { title: string; hint: string; actionLabel?: string; onAction?: () => void }) {
  return (
    <div className="workspaceHomeEmpty">
      <Sparkles size={18} />
      <strong>{props.title}</strong>
      <small>{props.hint}</small>
      {props.actionLabel && props.onAction ? (
        <button type="button" className="workspaceCommandButton" onClick={props.onAction}>{props.actionLabel}</button>
      ) : null}
    </div>
  );
}

function formatWorkspaceHomeTime(value: string, t: Translator) {
  const time = getRecordTimeMs(value);
  if (!time) return t('common.time.unknown');
  const diffMs = Date.now() - time;
  if (diffMs < 60 * 1000) return t('common.time.justNow');
  if (diffMs < 60 * 60 * 1000) return t('common.time.minutesAgo', { count: Math.max(1, Math.round(diffMs / (60 * 1000))) });
  if (diffMs < 24 * 60 * 60 * 1000) return t('common.time.hoursAgo', { count: Math.max(1, Math.round(diffMs / (60 * 60 * 1000))) });
  if (diffMs < 7 * 24 * 60 * 60 * 1000) return t('common.time.daysAgo', { count: Math.max(1, Math.round(diffMs / (24 * 60 * 60 * 1000))) });
  return new Date(time).toLocaleDateString(t('common.locale'), { month: '2-digit', day: '2-digit' });
}
