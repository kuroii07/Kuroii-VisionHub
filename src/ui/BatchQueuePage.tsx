import {
  Bookmark,
  Image,
  ListChecks,
  Pause,
  Pencil,
  Play,
  Plus,
  RefreshCcw,
  Trash2,
  Wand2
} from 'lucide-react';
import type {
  BatchGenerationQueue,
  BatchQueueRunProgress,
  BatchQueueTemplate
} from '../domain/batchQueueTypes';
import type { GenerationRecord } from '../domain/providerTypes';
import type { Translator } from '../i18n';
import { summarizeBatchQueue } from '../services/batchQueue';
import type { AppPage } from '../services/appSettings';
import { getRecordTimeMs } from './generationRecordPresentation';
import type { ImagePreviewNavigation } from './ImagePreviewModal';

export function BatchQueuePage(props: {
  t: Translator;
  queues: BatchGenerationQueue[];
  results: GenerationRecord[];
  templates: BatchQueueTemplate[];
  activeQueueId: string;
  executingTaskId: string | null;
  runningQueueId: string | null;
  runProgress: BatchQueueRunProgress | null;
  onPreview: (imageUrl: string, navigation?: ImagePreviewNavigation) => void;
  onNavigate: (page: AppPage) => void;
  onSelectQueue: (queueId: string) => void;
  onCreateQueue: () => void;
  onRenameQueue: (queueId: string) => void;
  onDeleteQueue: (queueId: string) => void;
  onRefresh: () => void;
  onStartQueue: (queueId: string) => void;
  onStopQueue: (queueId: string) => void;
  onExecuteTask: (queueId: string, taskId: string) => void;
  onCancelTask: (queueId: string, taskId: string) => void;
  onRequeueTask: (queueId: string, taskId: string) => void;
  onRequeueFailedTasks: (queueId: string) => void;
  onDeleteTask: (queueId: string, taskId: string) => void;
  onSaveTemplate: (queueId: string) => void;
  onApplyTemplate: (templateId: string) => void;
  onDeleteTemplate: (templateId: string) => void;
}) {
  const t = props.t;
  const queueStatusLabel = (status: BatchGenerationQueue['status']) => {
    const labels: Record<BatchGenerationQueue['status'], string> = {
      draft: t('batch.status.draft'),
      ready: t('batch.status.ready'),
      running: t('batch.status.running'),
      paused: t('batch.status.paused'),
      completed: t('batch.status.completed'),
      'completed-with-errors': t('batch.status.completedWithErrors'),
      cancelled: t('batch.status.cancelled')
    };
    return labels[status] ?? status;
  };
  const taskStatusLabel = (status: BatchGenerationQueue['tasks'][number]['status']) => {
    const labels: Record<BatchGenerationQueue['tasks'][number]['status'], string> = {
      pending: t('batch.taskStatus.pending'),
      running: t('batch.taskStatus.running'),
      succeeded: t('batch.taskStatus.succeeded'),
      failed: t('batch.taskStatus.failed'),
      cancelled: t('batch.taskStatus.cancelled')
    };
    return labels[status] ?? status;
  };

  const activeQueue = (props.activeQueueId ? props.queues.find((queue) => queue.id === props.activeQueueId) : null)
    ?? props.queues[0]
    ?? null;
  const activeSummary = activeQueue ? summarizeBatchQueue(activeQueue) : {
    total: 0,
    pending: 0,
    running: 0,
    succeeded: 0,
    failed: 0,
    cancelled: 0,
    requestedImages: 0
  };
  const aggregate = props.queues.reduce((acc, queue) => {
    const summary = summarizeBatchQueue(queue);
    acc.total += summary.total;
    acc.pending += summary.pending;
    acc.running += summary.running;
    acc.succeeded += summary.succeeded;
    acc.failed += summary.failed;
    acc.requestedImages += summary.requestedImages;
    acc.compareGroups += queue.compareGroups?.length ?? 0;
    return acc;
  }, { total: 0, pending: 0, running: 0, succeeded: 0, failed: 0, requestedImages: 0, compareGroups: 0 });
  const visibleTasks = activeQueue ? [...activeQueue.tasks].reverse().slice(0, 80) : [];
  const compareGroupMap = new Map((activeQueue?.compareGroups ?? []).map((group) => [group.id, group]));
  const resultRecordMap = new Map(props.results.map((record) => [record.id, record]));
  const compareResultGroups = activeQueue ? (activeQueue.compareGroups ?? [])
    .map((group) => {
      const groupTasks = group.taskIds
        .map((taskId) => activeQueue.tasks.find((task) => task.id === taskId))
        .filter((task): task is BatchGenerationQueue['tasks'][number] => Boolean(task));
      const completedCount = groupTasks.filter((task) => task.status === 'succeeded' || task.status === 'failed' || task.status === 'cancelled').length;
      return {
        group,
        tasks: groupTasks,
        completedCount,
        resultCount: groupTasks.reduce((sum, task) => sum + task.resultRecordIds.filter((recordId) => resultRecordMap.has(recordId)).length, 0)
      };
    })
    .sort((a, b) => b.group.createdAt.localeCompare(a.group.createdAt))
    .slice(0, 4) : [];
  const batchVariantGroups = activeQueue ? summarizeBatchVariantGroups(activeQueue) : [];
  const omittedReferenceCount = visibleTasks.reduce(
    (sum, task) => sum + (task.snapshot.referencePolicy?.omittedReferenceIds.length ?? 0),
    0
  );
  const isActiveQueueRunning = Boolean(activeQueue && props.runningQueueId === activeQueue.id);
  const activeRunProgress = activeQueue && props.runProgress?.queueId === activeQueue.id ? props.runProgress : null;
  const canStartActiveQueue = Boolean(activeQueue && activeSummary.pending > 0 && !props.runningQueueId && !props.executingTaskId);
  const activeTaskId = props.executingTaskId ?? activeRunProgress?.currentTaskId ?? null;
  const activeExecutingTask = activeQueue && activeTaskId
    ? activeQueue.tasks.find((task) => task.id === activeTaskId)
    : null;
  const activeQueueFinishedCount = activeSummary.succeeded + activeSummary.failed + activeSummary.cancelled;
  const activeRunCompletedCount = activeRunProgress
    ? activeRunProgress.completedThisRun + activeRunProgress.failedThisRun
    : 0;
  const activeRunTotalCount = activeRunProgress?.initialPendingCount ?? activeSummary.total;
  const activeRunPercent = activeRunTotalCount > 0
    ? Math.min(100, Math.round((activeRunCompletedCount / activeRunTotalCount) * 100))
    : 0;
  const activeQueueProgressText = activeQueue
    ? isActiveQueueRunning
      ? activeRunProgress?.pauseRequested
        ? t('batch.progress.pauseRequested', { completed: activeRunCompletedCount, total: activeRunTotalCount })
        : t('batch.progress.running', { completed: activeRunCompletedCount, total: activeRunTotalCount, pending: activeSummary.pending })
      : activeSummary.pending > 0
        ? activeQueue.status === 'paused'
          ? t('batch.progress.paused', { pending: activeSummary.pending })
          : t('batch.progress.ready', { pending: activeSummary.pending })
        : t('batch.progress.finished', { finished: activeQueueFinishedCount, total: activeSummary.total })
    : t('batch.progress.noQueue');
  const activeQueuePrimaryActionLabel = isActiveQueueRunning
    ? activeRunProgress?.pauseRequested ? t('batch.action.pausing') : t('batch.action.pauseQueue')
    : activeQueue?.status === 'paused'
      ? t('batch.action.resumeQueue')
      : t('batch.action.runPending');
  const visibleTemplates = props.templates.slice(0, 4);
  const canSaveActiveQueueTemplate = Boolean(activeQueue && activeSummary.total > 0 && !isActiveQueueRunning && activeSummary.running === 0);

  return (
    <section className="batchQueuePage" aria-label={t('batch.aria')}>
      <header className="batchQueueHero">
        <div className="workspaceCommandTitle">
          <span>Batch Queue</span>
          <h1>{t('batch.title')}</h1>
        </div>
        <p>{t('batch.subtitle')}</p>
        <div className="batchQueueActions">
          <button
            type="button"
            className="workspaceCommandButton primary"
            onClick={() => props.onNavigate('generate')}
            title={t('batch.action.goCreateTitle')}
            aria-label={t('batch.action.goCreateTitle')}
          >
            <Wand2 size={15} /> {t('batch.action.goCreate')}
          </button>
          <button
            type="button"
            className="workspaceCommandButton"
            onClick={props.onRefresh}
            title={t('batch.action.refreshTitle')}
            aria-label={t('batch.action.refresh')}
          >
            <RefreshCcw size={15} /> {t('batch.action.refresh')}
          </button>
          <button
            type="button"
            className="workspaceCommandButton"
            onClick={props.onCreateQueue}
            title={t('batch.action.newQueueLongTitle')}
            aria-label={t('batch.action.newQueue')}
          >
            <Plus size={15} /> {t('batch.action.newQueue')}
          </button>
          <button
            type="button"
            className="workspaceCommandButton"
            disabled={!activeQueue || !canSaveActiveQueueTemplate}
            onClick={() => activeQueue ? props.onSaveTemplate(activeQueue.id) : undefined}
            title={t('batch.action.saveTemplateTitle')}
            aria-label={t('batch.action.saveTemplate')}
          >
            <Bookmark size={15} /> {t('batch.action.saveTemplate')}
          </button>
          <button
            type="button"
            className={`workspaceCommandButton ${isActiveQueueRunning ? 'dangerAction' : 'primary'}`}
            disabled={!activeQueue || (!isActiveQueueRunning && !canStartActiveQueue)}
            onClick={() => activeQueue ? (isActiveQueueRunning ? props.onStopQueue(activeQueue.id) : props.onStartQueue(activeQueue.id)) : undefined}
            title={isActiveQueueRunning ? t('batch.action.pauseTitle') : t('batch.action.runTitle')}
            aria-label={isActiveQueueRunning ? t('batch.action.pauseAria') : t('batch.action.runAria')}
          >
            {isActiveQueueRunning ? <Pause size={15} /> : <Play size={15} />} {activeQueuePrimaryActionLabel}
          </button>
          <button
            type="button"
            className="workspaceCommandButton"
            disabled={!activeQueue || activeSummary.failed === 0 || Boolean(props.runningQueueId) || Boolean(props.executingTaskId)}
            onClick={() => activeQueue ? props.onRequeueFailedTasks(activeQueue.id) : undefined}
            title={t('batch.action.retryFailedTitle')}
            aria-label={t('batch.action.retryFailedAria')}
          >
            <RefreshCcw size={15} /> {t('batch.action.retryFailed')}
          </button>
        </div>
      </header>

      {activeQueue ? (
        <div className={`batchQueueRunBanner ${isActiveQueueRunning ? 'running' : ''} ${activeQueue.status === 'paused' ? 'paused' : ''}`} aria-live="polite">
          <div>
            <strong>{isActiveQueueRunning ? activeRunProgress?.pauseRequested ? t('batch.banner.pauseRequested') : t('batch.banner.running') : activeQueue.status === 'paused' ? t('batch.banner.paused') : t('batch.banner.mode')}</strong>
            <span>{activeQueueProgressText}</span>
            {activeExecutingTask ? <em>{t('batch.currentTask', { title: activeExecutingTask.title })}</em> : null}
            {activeRunProgress?.currentTaskTitle && !activeExecutingTask ? <em>{t('batch.currentTask', { title: activeRunProgress.currentTaskTitle })}</em> : null}
          </div>
          {isActiveQueueRunning ? (
            <div className="batchQueueProgressTrack" aria-label={t('batch.progressAria', { percent: activeRunPercent })}>
              <span style={{ width: `${activeRunPercent}%` }} />
            </div>
          ) : null}
          <small>{t('batch.banner.serialHint')}</small>
        </div>
      ) : null}

      <div className="batchQueueStats" aria-label={t('batch.statsAria')}>
        <BatchQueueStat label={t('batch.stats.queues')} value={props.queues.length} hint={activeQueue?.name ?? t('batch.progress.noQueue')} />
        <BatchQueueStat label={t('batch.stats.tasks')} value={aggregate.total} hint={t('batch.stats.pendingHint', { count: aggregate.pending })} />
        <BatchQueueStat label={t('batch.stats.images')} value={aggregate.requestedImages} hint={t('batch.stats.imagesHint')} />
        <BatchQueueStat label={t('batch.stats.compareGroups')} value={aggregate.compareGroups} hint={t('batch.stats.compareGroupsHint', { count: activeQueue?.compareGroups?.length ?? 0 })} />
        <BatchQueueStat label={t('batch.stats.failedSucceeded')} value={`${aggregate.failed} / ${aggregate.succeeded}`} hint={t('batch.stats.writebackHint')} />
      </div>

      {activeQueue ? (
        <div className="batchQueueLayout">
          <aside className="batchQueueListPanel" aria-label={t('batch.queueListAria')}>
            <div className="workspaceSectionHeading compact">
              <div>
                <p className="eyebrow">Queues</p>
                <h2>{t('batch.queueListTitle')}</h2>
              </div>
              <button
                type="button"
                className="workspaceCommandButton batchQueueCreateButton"
                onClick={props.onCreateQueue}
                title={t('batch.action.newQueueShortTitle')}
                aria-label={t('batch.action.newQueue')}
              >
                <Plus size={14} /> {t('batch.action.new')}
              </button>
            </div>
            {props.queues.map((queue) => {
              const summary = summarizeBatchQueue(queue);
              const isSelected = activeQueue?.id === queue.id;
              const isQueueRunning = props.runningQueueId === queue.id || summary.running > 0;
              const canRenameQueue = !isQueueRunning;
              const canDeleteQueue = props.queues.length > 1 && !isQueueRunning;
              const selectQueue = () => props.onSelectQueue(queue.id);
              return (
                <article
                  className={`batchQueueCard ${isSelected ? 'active' : ''}`}
                  key={queue.id}
                  role="button"
                  tabIndex={0}
                  aria-pressed={isSelected}
                  onClick={selectQueue}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      selectQueue();
                    }
                  }}
                >
                  <div className="batchQueueCardHeader">
                    <strong>{queue.name}</strong>
                    {isSelected ? <em>{t('batch.queue.current')}</em> : null}
                  </div>
                  <span>{t('batch.queue.summary', { total: summary.total, pending: summary.pending, images: summary.requestedImages })}</span>
                  <small>{queueStatusLabel(queue.status)} - {t('batch.queue.compareGroupCount', { count: queue.compareGroups?.length ?? 0 })} - {formatWorkspaceHomeTime(queue.updatedAt, t)}</small>
                  <div className="batchQueueCardActions" aria-label={t('batch.queue.actionsAria', { name: queue.name })}>
                    <button
                      type="button"
                      className="workspaceCommandButton"
                      onClick={(event) => {
                        event.stopPropagation();
                        props.onRenameQueue(queue.id);
                      }}
                      disabled={!canRenameQueue}
                      title={t('batch.queue.renameTitle')}
                      aria-label={t('batch.queue.renameAria', { name: queue.name })}
                    >
                      <Pencil size={13} /> {t('batch.queue.rename')}
                    </button>
                    <button
                      type="button"
                      className="workspaceCommandButton dangerAction"
                      onClick={(event) => {
                        event.stopPropagation();
                        props.onDeleteQueue(queue.id);
                      }}
                      disabled={!canDeleteQueue}
                      title={canDeleteQueue ? t('batch.queue.deleteTitle') : t('batch.queue.deleteDisabledTitle')}
                      aria-label={t('batch.queue.deleteAria', { name: queue.name })}
                    >
                      <Trash2 size={13} /> {t('batch.queue.delete')}
                    </button>
                  </div>
                </article>
              );
            })}
          </aside>

          <section className="batchTaskPanel" aria-label={t('batch.taskListAria')}>
            <div className="workspaceSectionHeading compact">
              <div>
                <p className="eyebrow">Tasks</p>
                <h2>{t('batch.taskListTitle')}</h2>
              </div>
              {omittedReferenceCount > 0 ? (
                <span className="workspaceSoftCounter warning">{t('batch.task.omittedReferences', { count: omittedReferenceCount })}</span>
              ) : (
                <span className="workspaceSoftCounter">{t('batch.stats.pendingHint', { count: activeSummary.pending })}</span>
              )}
            </div>
            {visibleTemplates.length ? (
              <div className="batchTemplateList" aria-label={t('batch.templatesAria')}>
                {visibleTemplates.map((template) => (
                  <article className="batchTemplateCard" key={template.id}>
                    <div>
                      <strong>{template.name}</strong>
                      <span>{t('batch.template.summary', { tasks: template.taskTemplates.length, groups: template.compareGroups.length })}</span>
                      <small>
                        {template.usedCount ? t('batch.template.usedCount', { count: template.usedCount }) : t('batch.template.notUsed')}
                        {template.lastUsedAt ? ` · ${formatWorkspaceHomeTime(template.lastUsedAt, t)}` : ` · ${formatWorkspaceHomeTime(template.updatedAt, t)}`}
                      </small>
                    </div>
                    <div className="batchTemplateActions">
                      <button
                        type="button"
                        className="workspaceCommandButton primary"
                        onClick={() => props.onApplyTemplate(template.id)}
                        disabled={Boolean(props.runningQueueId) || Boolean(props.executingTaskId)}
                        title={t('batch.template.applyTitle')}
                        aria-label={t('batch.template.applyAria', { name: template.name })}
                      >
                        {t('batch.template.apply')}
                      </button>
                      <button
                        type="button"
                        className="workspaceCommandButton dangerAction"
                        onClick={() => props.onDeleteTemplate(template.id)}
                        disabled={Boolean(props.runningQueueId) || Boolean(props.executingTaskId)}
                        title={t('batch.template.deleteTitle')}
                        aria-label={t('batch.template.deleteAria', { name: template.name })}
                      >
                        {t('batch.template.delete')}
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            ) : null}
            {compareResultGroups.length ? (
              <div className="batchCompareResultList" aria-label={t('batch.compare.aria')}>
                {compareResultGroups.map(({ group, tasks, completedCount, resultCount }) => (
                  <article className="batchCompareResultGroup" key={group.id}>
                    <div className="batchCompareResultHeader">
                      <div>
                        <strong>{t('batch.compare.title')}</strong>
                        <span>{t('batch.compare.summary', { completed: completedCount, total: tasks.length, result: resultCount > 0 ? t('batch.compare.resultCount', { count: resultCount }) : t('batch.compare.statusOnly') })}</span>
                      </div>
                      <small>{formatWorkspaceHomeTime(group.createdAt, t)}</small>
                    </div>
                    <p>{group.prompt}</p>
                    <div className="batchCompareResultGrid">
                      {tasks.map((task) => {
                        const taskRecords = task.resultRecordIds
                          .map((recordId) => resultRecordMap.get(recordId))
                          .filter((record): record is GenerationRecord => Boolean(record));
                        const successRecord = taskRecords.find((record) => record.status === 'succeeded' && record.imageUrls[0]);
                        const firstRecord = taskRecords[0];
                        const previewUrl = successRecord?.imageUrls[0];
                        const status = firstRecord?.status ?? task.status;
                        return (
                          <article className={`batchCompareResultCard ${status}`} key={task.id}>
                            {previewUrl ? (
                              <button
                                type="button"
                                className="batchCompareThumb"
                                onClick={() => props.onPreview(previewUrl)}
                                title={t('batch.compare.previewTitle')}
                                aria-label={t('batch.compare.previewAria', { name: task.snapshot.profileName ?? task.snapshot.modelId })}
                              >
                                <img src={previewUrl} alt={task.title} loading="lazy" decoding="async" />
                              </button>
                            ) : (
                              <div className="batchCompareThumb empty">
                                <Image size={18} />
                                <span>{taskStatusLabel(task.status)}</span>
                              </div>
                            )}
                            <div className="batchCompareResultMeta">
                              <strong>{task.snapshot.profileName ?? task.snapshot.providerName ?? task.snapshot.providerId}</strong>
                              <span>{task.snapshot.modelId}</span>
                              <small>{task.snapshot.size} ? {t('batch.countImages', { count: task.snapshot.count })} ? {task.durationMs ? `${Math.round(task.durationMs / 1000)}s` : t('batch.durationPending')}</small>
                              {task.error || firstRecord?.error ? <em>{task.error ?? firstRecord?.error}</em> : null}
                            </div>
                          </article>
                        );
                      })}
                    </div>
                  </article>
                ))}
              </div>
            ) : null}
            {batchVariantGroups.length ? (
              <div className="batchVariantGroupList" aria-label={t('batch.variant.aria')}>
                {batchVariantGroups.slice(0, 4).map((group) => (
                  <div className="batchVariantGroupCard" key={group.key}>
                    <div>
                      <strong>{t('batch.variant.title')}</strong>
                      <span>{t('batch.variant.summary', { prompts: group.promptCount, sizes: group.sizeCount, total: group.total })}</span>
                    </div>
                    <small>{group.sizes.join(' / ')}</small>
                    <em>{t('batch.variant.statusSummary', { succeeded: group.succeeded, running: group.running, pending: group.pending, failed: group.failed })}</em>
                  </div>
                ))}
              </div>
            ) : null}
            {visibleTasks.length ? (
              <div className="batchTaskList">
                {visibleTasks.map((task) => {
                  const isExecuting = props.executingTaskId === task.id;
                  const canExecute = task.status === 'pending' && !props.executingTaskId && !props.runningQueueId;
                  const canRequeue = task.status === 'failed' && !props.executingTaskId;
                  const canCancel = task.status === 'pending' && !props.executingTaskId && !props.runningQueueId;
                  const canDelete = (task.status === 'failed' || task.status === 'cancelled') && !props.executingTaskId && !props.runningQueueId;
                  const compareGroup = task.compareGroupId ? compareGroupMap.get(task.compareGroupId) : undefined;
                  const compareTaskIndex = compareGroup ? compareGroup.taskIds.indexOf(task.id) + 1 : 0;
                  const isBatchVariantTask = task.kind === 'prompt-size-sweep';
                  return (
                  <article className={`batchTaskItem ${isExecuting ? 'running' : ''}`} key={task.id}>
                    <div className="batchTaskMain">
                      <div className="batchTaskTitleRow">
                        <strong>{task.title}</strong>
                        {isBatchVariantTask ? (
                          <span className="batchVariantBadge" title={t('batch.variant.badgeTitle')}>
                            {t('batch.variant.badge')}
                          </span>
                        ) : null}
                        {compareGroup ? (
                          <span className="batchCompareBadge" title={t('batch.compare.badgeTitle', { id: compareGroup.id })}>
                            {t('batch.compare.badge', { index: compareTaskIndex > 0 ? `${compareTaskIndex}/${compareGroup.taskIds.length}` : compareGroup.taskIds.length })}
                          </span>
                        ) : null}
                        <span className={`batchTaskStatus ${task.status}`}>{taskStatusLabel(task.status)}</span>
                      </div>
                      <p>{task.snapshot.prompt}</p>
                      <div className="batchTaskMeta">
                        <span>{task.snapshot.generationMode === 'image-to-image' ? t('batch.mode.imageToImage') : t('batch.mode.textToImage')}</span>
                        <span>{task.snapshot.providerName ?? task.snapshot.providerId}</span>
                        <span>{task.snapshot.profileName ?? t('batch.profileUnbound')}</span>
                        <span>{task.snapshot.modelId}</span>
                        <span>{task.snapshot.size}</span>
                        <span>{t('batch.countImages', { count: task.snapshot.count })}</span>
                      </div>
                      {task.error ? <small className="batchTaskError">{task.error}</small> : null}
                    </div>
                    <div className="batchTaskSide">
                      <span>{formatWorkspaceHomeTime(task.createdAt, t)}</span>
                      <small>
                        {task.attempt > 0 ? t('batch.task.attemptPrefix', { count: task.attempt }) : ''}
                        {task.snapshot.referencePolicy?.omittedReferenceIds.length ? t('batch.task.referencesNeedConfirm') : t('batch.task.referenceCount', { count: task.snapshot.references?.length ?? 0 })}
                      </small>
                      <div className="batchTaskActions">
                        {task.status === 'failed' ? (
                          <button
                            type="button"
                            className="workspaceCommandButton primary"
                            onClick={() => props.onRequeueTask(task.queueId, task.id)}
                            disabled={!canRequeue}
                            title={t('batch.task.requeueTitle')}
                            aria-label={t('batch.task.requeueAria')}
                          >
                            {t('batch.task.requeue')}
                          </button>
                        ) : (
                          <button
                            type="button"
                            className="workspaceCommandButton primary"
                            onClick={() => props.onExecuteTask(task.queueId, task.id)}
                            disabled={!canExecute}
                            title={t('batch.task.executeTitle')}
                            aria-label={t('batch.task.executeAria')}
                          >
                            {isExecuting ? t('batch.task.executing') : t('batch.task.execute')}
                          </button>
                        )}
                        <button
                          type="button"
                          className="workspaceCommandButton"
                          onClick={() => props.onCancelTask(task.queueId, task.id)}
                          disabled={!canCancel}
                          title={t('batch.task.cancelTitle')}
                          aria-label={t('batch.task.cancelAria')}
                        >
                          {t('batch.task.cancel')}
                        </button>
                        {(task.status === 'failed' || task.status === 'cancelled') ? (
                          <button
                            type="button"
                            className="workspaceCommandButton dangerAction"
                            onClick={() => props.onDeleteTask(task.queueId, task.id)}
                            disabled={!canDelete}
                            title={t('batch.task.deleteTitle')}
                            aria-label={t('batch.task.deleteAria')}
                          >
                            {t('batch.task.delete')}
                          </button>
                        ) : null}
                      </div>
                    </div>
                  </article>
                  );
                })}
              </div>
            ) : (
              <div className="workspaceHomeEmpty">
                <strong>{t('batch.emptyQueueTitle')}</strong>
                <small>{t('batch.emptyQueueHint')}</small>
                <button type="button" className="workspaceCommandButton primary" onClick={() => props.onNavigate('generate')}>
                  <Wand2 size={15} /> {t('batch.action.addTask')}
                </button>
              </div>
            )}
          </section>
        </div>
      ) : (
        <div className="workspaceHomeEmpty batchQueueEmpty">
          <ListChecks size={28} />
          <strong>{t('batch.emptyTitle')}</strong>
          <small>{t('batch.emptyHint')}</small>
          <div className="batchQueueEmptyActions">
            <button type="button" className="workspaceCommandButton primary" onClick={() => props.onNavigate('generate')}>
              <Wand2 size={15} /> {t('batch.action.goCreate')}
            </button>
            <button type="button" className="workspaceCommandButton" onClick={props.onCreateQueue}>
              <Plus size={15} /> {t('batch.action.newQueue')}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

type BatchVariantGroupSummary = {
  key: string;
  promptCount: number;
  sizeCount: number;
  total: number;
  pending: number;
  running: number;
  succeeded: number;
  failed: number;
  cancelled: number;
  sizes: string[];
  addedAt: string;
};

function summarizeBatchVariantGroups(queue: BatchGenerationQueue[]): BatchVariantGroupSummary[];
function summarizeBatchVariantGroups(queue: BatchGenerationQueue): BatchVariantGroupSummary[];
function summarizeBatchVariantGroups(queue: BatchGenerationQueue | BatchGenerationQueue[]): BatchVariantGroupSummary[] {
  const queues = Array.isArray(queue) ? queue : [queue];
  const groups = new Map<string, BatchVariantGroupSummary & { sizeSet: Set<string> }>();

  for (const currentQueue of queues) {
    for (const task of currentQueue.tasks) {
      if (task.kind !== 'prompt-size-sweep') continue;
      const meta = readBatchVariantMetadata(task);
      const addedAt = meta.addedAt || task.createdAt;
      const key = `${currentQueue.id}:${addedAt}:${meta.promptCount}:${meta.sizeCount}`;
      const existing = groups.get(key) ?? {
        key,
        promptCount: meta.promptCount,
        sizeCount: meta.sizeCount,
        total: 0,
        pending: 0,
        running: 0,
        succeeded: 0,
        failed: 0,
        cancelled: 0,
        sizes: [],
        sizeSet: new Set<string>(),
        addedAt
      };
      existing.total += 1;
      existing[task.status] += 1;
      const variantSize = meta.variantSize || task.snapshot.size;
      if (variantSize && !existing.sizeSet.has(variantSize)) {
        existing.sizeSet.add(variantSize);
        existing.sizes.push(variantSize);
      }
      groups.set(key, existing);
    }
  }

  return Array.from(groups.values())
    .map(({ sizeSet: _sizeSet, ...group }) => group)
    .sort((a, b) => b.addedAt.localeCompare(a.addedAt));
}

function readBatchVariantMetadata(task: BatchGenerationQueue['tasks'][number]) {
  const raw = task.snapshot.metadata?.visionhub_batch_variants;
  if (!raw || typeof raw !== 'object') {
    return {
      addedAt: task.createdAt,
      promptCount: 1,
      sizeCount: 1,
      variantSize: task.snapshot.size
    };
  }
  const metadata = raw as Record<string, unknown>;
  const promptCount = typeof metadata.promptCount === 'number' && Number.isFinite(metadata.promptCount)
    ? Math.max(1, Math.round(metadata.promptCount))
    : 1;
  const sizeCount = typeof metadata.sizeCount === 'number' && Number.isFinite(metadata.sizeCount)
    ? Math.max(1, Math.round(metadata.sizeCount))
    : 1;
  return {
    addedAt: typeof metadata.addedAt === 'string' ? metadata.addedAt : task.createdAt,
    promptCount,
    sizeCount,
    variantSize: typeof metadata.variantSize === 'string' ? metadata.variantSize : task.snapshot.size
  };
}

function BatchQueueStat(props: { label: string; value: number | string; hint: string }) {
  return (
    <div className="batchQueueStat">
      <span>{props.label}</span>
      <strong>{props.value}</strong>
      <small>{props.hint}</small>
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
