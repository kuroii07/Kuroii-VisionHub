import type {
  BatchGenerationQueue,
  BatchQueueCompareGroup,
  BatchQueueStatus,
  BatchQueueStore,
  BatchQueueTask,
  BatchQueueTaskKind,
  BatchQueueTaskStatus,
  QueuedGenerationRequestSnapshot,
  QueuedGenerationSource,
  QueuedReferenceImage
} from '../domain/batchQueueTypes';
import { isQueuedGenerationMode } from '../domain/batchQueueTypes';
import type { GenerationMode, ImageGenerationRequest, ReferenceImage } from '../domain/providerTypes';
import { readStorageValue, writeStorageValue } from './safeStorage';

export const BATCH_QUEUE_STORAGE_KEY = 'visionhub.batch.queues.v1';
const CURRENT_STORE_VERSION = 1 as const;
const MAX_QUEUES = 80;
const MAX_TASKS_PER_QUEUE = 300;
const MAX_REFERENCE_DATA_URL_CHARS = 2048;

export interface CreateBatchQueueInput {
  name: string;
  description?: string;
  status?: BatchQueueStatus;
  tasks?: BatchQueueTask[];
  compareGroups?: BatchQueueCompareGroup[];
}

export interface CreateQueuedGenerationSnapshotInput extends ImageGenerationRequest {
  providerName?: string;
  profileId?: string;
  profileName?: string;
  source?: QueuedGenerationSource;
  preserveEmbeddedReferenceImages?: boolean;
}

export interface CreateBatchQueueTaskInput {
  queueId: string;
  snapshot: QueuedGenerationRequestSnapshot;
  kind?: BatchQueueTaskKind;
  compareGroupId?: string;
  title?: string;
  status?: BatchQueueTaskStatus;
}

export interface CreateBatchQueueCompareGroupInput {
  queueId: string;
  prompt: string;
  taskIds?: string[];
  profileIds?: string[];
}

export function createEmptyBatchQueueStore(): BatchQueueStore {
  return {
    version: CURRENT_STORE_VERSION,
    queues: [],
    updatedAt: nowIso()
  };
}

export function loadBatchQueueStore(): BatchQueueStore {
  const raw = readStorageValue(BATCH_QUEUE_STORAGE_KEY);
  if (!raw) return createEmptyBatchQueueStore();

  try {
    return normalizeBatchQueueStore(JSON.parse(raw) as Partial<BatchQueueStore>);
  } catch (error) {
    console.warn('[VisionHub] batch queue store parse failed; using empty store', error);
    return createEmptyBatchQueueStore();
  }
}

export function saveBatchQueueStore(store: BatchQueueStore) {
  const normalized = normalizeBatchQueueStore(store);
  return writeStorageValue(BATCH_QUEUE_STORAGE_KEY, JSON.stringify(normalized));
}

export function createBatchQueue(input: CreateBatchQueueInput): BatchGenerationQueue {
  const createdAt = nowIso();
  const id = createBatchQueueId('queue');
  const tasks = (input.tasks ?? []).slice(0, MAX_TASKS_PER_QUEUE).map((task) =>
    normalizeBatchQueueTask({ ...task, queueId: id })
  );

  return {
    id,
    name: normalizeQueueName(input.name),
    description: input.description?.trim() || undefined,
    status: input.status ?? 'draft',
    tasks,
    compareGroups: (input.compareGroups ?? []).map((group) => normalizeCompareGroup({ ...group, queueId: id })),
    createdAt,
    updatedAt: createdAt
  };
}

export function upsertBatchQueue(queue: BatchGenerationQueue, store = loadBatchQueueStore()) {
  const normalized = normalizeBatchQueue({ ...queue, updatedAt: nowIso() });
  const nextStore: BatchQueueStore = {
    version: CURRENT_STORE_VERSION,
    queues: [
      normalized,
      ...store.queues.filter((item) => item.id !== normalized.id)
    ].slice(0, MAX_QUEUES),
    updatedAt: nowIso()
  };
  saveBatchQueueStore(nextStore);
  return nextStore;
}

export function appendBatchQueueTasks(queueId: string, tasks: BatchQueueTask[], store = loadBatchQueueStore()) {
  const queue = store.queues.find((item) => item.id === queueId);
  if (!queue) throw new Error('批量队列不存在，无法追加任务。');

  const now = nowIso();
  const shouldReactivateQueue =
    tasks.length > 0 &&
    (queue.status === 'draft' ||
      queue.status === 'paused' ||
      queue.status === 'completed' ||
      queue.status === 'completed-with-errors' ||
      queue.status === 'cancelled');
  const nextQueue: BatchGenerationQueue = {
    ...queue,
    status: shouldReactivateQueue ? 'ready' : queue.status,
    tasks: [
      ...queue.tasks,
      ...tasks.map((task) => normalizeBatchQueueTask({ ...task, queueId }))
    ].slice(0, MAX_TASKS_PER_QUEUE),
    updatedAt: now
  };
  return upsertBatchQueue(nextQueue, store);
}

export function appendBatchQueueTasksAndCompareGroups(
  queueId: string,
  tasks: BatchQueueTask[],
  compareGroups: BatchQueueCompareGroup[] = [],
  store = loadBatchQueueStore()
) {
  const queue = store.queues.find((item) => item.id === queueId);
  if (!queue) throw new Error('批量队列不存在，无法追加对比任务。');

  const now = nowIso();
  const shouldReactivateQueue =
    tasks.length > 0 &&
    (queue.status === 'draft' ||
      queue.status === 'paused' ||
      queue.status === 'completed' ||
      queue.status === 'completed-with-errors' ||
      queue.status === 'cancelled');
  const existingGroupIds = new Set((queue.compareGroups ?? []).map((group) => group.id));
  const nextQueue: BatchGenerationQueue = {
    ...queue,
    status: shouldReactivateQueue ? 'ready' : queue.status,
    tasks: [
      ...queue.tasks,
      ...tasks.map((task) => normalizeBatchQueueTask({ ...task, queueId }))
    ].slice(0, MAX_TASKS_PER_QUEUE),
    compareGroups: [
      ...(queue.compareGroups ?? []),
      ...compareGroups
        .filter((group) => !existingGroupIds.has(group.id))
        .map((group) => normalizeCompareGroup({ ...group, queueId }))
    ],
    updatedAt: now
  };
  return upsertBatchQueue(nextQueue, store);
}

export function updateBatchQueueTask(
  queueId: string,
  taskId: string,
  patch: Partial<BatchQueueTask>,
  store = loadBatchQueueStore()
) {
  const queue = store.queues.find((item) => item.id === queueId);
  if (!queue) throw new Error('批量队列不存在，无法更新任务。');

  const now = nowIso();
  const nextQueue: BatchGenerationQueue = {
    ...queue,
    tasks: queue.tasks.map((task) =>
      task.id === taskId
        ? normalizeBatchQueueTask({ ...task, ...patch, id: task.id, queueId, updatedAt: now })
        : task
    ),
    updatedAt: now
  };
  return upsertBatchQueue(nextQueue, store);
}

export function removeBatchQueueTask(
  queueId: string,
  taskId: string,
  store = loadBatchQueueStore()
) {
  const queue = store.queues.find((item) => item.id === queueId);
  if (!queue) throw new Error('批量队列不存在，无法删除任务。');

  const now = nowIso();
  const nextTasks = queue.tasks.filter((task) => task.id !== taskId);
  const summary = summarizeBatchQueue({ ...queue, tasks: nextTasks });
  const nextStatus: BatchQueueStatus =
    nextTasks.length === 0
      ? 'ready'
      : summary.running > 0
        ? 'running'
        : summary.pending > 0
          ? 'ready'
          : summary.failed > 0
            ? 'completed-with-errors'
            : summary.cancelled === nextTasks.length
              ? 'cancelled'
              : 'completed';
  return upsertBatchQueue({
    ...queue,
    status: nextStatus,
    tasks: nextTasks,
    updatedAt: now,
    finishedAt: nextStatus === 'completed' || nextStatus === 'completed-with-errors'
      ? now
      : queue.finishedAt
  }, store);
}

export function createQueuedGenerationSnapshot(
  input: CreateQueuedGenerationSnapshotInput
): QueuedGenerationRequestSnapshot {
  const capturedAt = nowIso();
  const { references, referencePolicy } = compactReferencesForQueue(
    input.references ?? [],
    Boolean(input.preserveEmbeddedReferenceImages)
  );

  return normalizeQueuedGenerationSnapshot({
    providerId: input.providerId,
    providerName: input.providerName,
    profileId: input.profileId,
    profileName: input.profileName,
    modelId: input.modelId,
    prompt: input.prompt,
    negativePrompt: input.negativePrompt,
    size: input.size,
    quality: input.quality,
    outputFormat: input.outputFormat,
    outputCompression: input.outputCompression,
    count: input.count,
    generationMode: input.generationMode ?? 'text-to-image',
    references,
    seed: input.seed,
    baseUrl: input.baseUrl,
    protocol: input.protocol,
    imageToImageAdapter: input.imageToImageAdapter,
    endpointPath: input.endpointPath,
    extraHeaders: input.extraHeaders,
    secretId: input.secretId,
    metadata: {
      ...(input.metadata ?? {}),
      visionhub_queue_snapshot: {
        profileId: input.profileId ?? null,
        source: input.source ?? 'manual'
      }
    },
    source: input.source ?? 'manual',
    capturedAt,
    snapshotVersion: CURRENT_STORE_VERSION,
    referencePolicy
  });
}

export function createBatchQueueTask(input: CreateBatchQueueTaskInput): BatchQueueTask {
  const createdAt = nowIso();
  const title = input.title?.trim() || summarizePrompt(input.snapshot.prompt);

  return normalizeBatchQueueTask({
    id: createBatchQueueId('task'),
    queueId: input.queueId,
    kind: input.kind ?? 'single',
    compareGroupId: input.compareGroupId,
    title,
    snapshot: input.snapshot,
    status: input.status ?? 'pending',
    attempt: 0,
    resultRecordIds: [],
    createdAt,
    updatedAt: createdAt
  });
}

export function createBatchQueueCompareGroup(input: CreateBatchQueueCompareGroupInput): BatchQueueCompareGroup {
  const createdAt = nowIso();
  return normalizeCompareGroup({
    id: createBatchQueueId('compare'),
    queueId: input.queueId,
    prompt: input.prompt,
    taskIds: input.taskIds ?? [],
    profileIds: input.profileIds ?? [],
    createdAt,
    updatedAt: createdAt
  });
}

export function getRunnableBatchQueueTasks(queue: BatchGenerationQueue) {
  return queue.tasks.filter((task) => task.status === 'pending' || task.status === 'failed');
}

export function summarizeBatchQueue(queue: BatchGenerationQueue) {
  const total = queue.tasks.length;
  const succeeded = queue.tasks.filter((task) => task.status === 'succeeded').length;
  const failed = queue.tasks.filter((task) => task.status === 'failed').length;
  const running = queue.tasks.filter((task) => task.status === 'running').length;
  const pending = queue.tasks.filter((task) => task.status === 'pending').length;
  const cancelled = queue.tasks.filter((task) => task.status === 'cancelled').length;
  const requestedImages = queue.tasks.reduce((sum, task) => sum + normalizeCount(task.snapshot.count), 0);

  return { total, pending, running, succeeded, failed, cancelled, requestedImages };
}

export function normalizeQueuedGenerationSnapshot(
  snapshot: Partial<QueuedGenerationRequestSnapshot>
): QueuedGenerationRequestSnapshot {
  const generationMode: GenerationMode = isQueuedGenerationMode(snapshot.generationMode)
    ? snapshot.generationMode
    : 'text-to-image';
  const references = (snapshot.references ?? []).map(normalizeQueuedReferenceImage);
  const omittedReferenceIds = snapshot.referencePolicy?.omittedReferenceIds ?? references
    .filter((reference) => reference.dataUrlOmitted)
    .map((reference) => reference.id);

  return {
    snapshotVersion: CURRENT_STORE_VERSION,
    providerId: String(snapshot.providerId || ''),
    providerName: snapshot.providerName?.trim() || undefined,
    profileId: snapshot.profileId?.trim() || undefined,
    profileName: snapshot.profileName?.trim() || undefined,
    modelId: String(snapshot.modelId || '').trim(),
    prompt: String(snapshot.prompt || ''),
    negativePrompt: snapshot.negativePrompt?.trim() || undefined,
    size: String(snapshot.size || '1024x1024'),
    quality: snapshot.quality?.trim() || undefined,
    outputFormat: snapshot.outputFormat,
    outputCompression: typeof snapshot.outputCompression === 'number' ? snapshot.outputCompression : undefined,
    count: normalizeCount(snapshot.count),
    generationMode,
    references,
    seed: typeof snapshot.seed === 'number' ? snapshot.seed : undefined,
    baseUrl: snapshot.baseUrl?.trim() || undefined,
    protocol: snapshot.protocol,
    imageToImageAdapter: snapshot.imageToImageAdapter,
    endpointPath: snapshot.endpointPath?.trim() || undefined,
    extraHeaders: snapshot.extraHeaders,
    secretId: snapshot.secretId?.trim() || undefined,
    metadata: snapshot.metadata ?? {},
    source: snapshot.source ?? 'manual',
    capturedAt: snapshot.capturedAt || nowIso(),
    referencePolicy: {
      embeddedImageData: omittedReferenceIds.length === 0
        ? 'included'
        : omittedReferenceIds.length === references.length
          ? 'omitted'
          : 'mixed',
      omittedReferenceIds
    }
  };
}

function normalizeBatchQueueStore(store: Partial<BatchQueueStore>): BatchQueueStore {
  return {
    version: CURRENT_STORE_VERSION,
    queues: Array.isArray(store.queues)
      ? store.queues.map(normalizeBatchQueue).slice(0, MAX_QUEUES)
      : [],
    updatedAt: store.updatedAt || nowIso()
  };
}

function normalizeBatchQueue(queue: Partial<BatchGenerationQueue>): BatchGenerationQueue {
  const createdAt = queue.createdAt || nowIso();
  return {
    id: queue.id || createBatchQueueId('queue'),
    name: normalizeQueueName(queue.name),
    description: queue.description?.trim() || undefined,
    status: normalizeQueueStatus(queue.status),
    tasks: Array.isArray(queue.tasks)
      ? queue.tasks.map(normalizeBatchQueueTask).slice(0, MAX_TASKS_PER_QUEUE)
      : [],
    compareGroups: Array.isArray(queue.compareGroups)
      ? queue.compareGroups.map(normalizeCompareGroup)
      : [],
    createdAt,
    updatedAt: queue.updatedAt || createdAt,
    startedAt: queue.startedAt,
    finishedAt: queue.finishedAt
  };
}

function normalizeBatchQueueTask(task: Partial<BatchQueueTask>): BatchQueueTask {
  const createdAt = task.createdAt || nowIso();
  return {
    id: task.id || createBatchQueueId('task'),
    queueId: task.queueId || '',
    kind: task.kind === 'model-compare' ? 'model-compare' : 'single',
    compareGroupId: task.compareGroupId,
    title: task.title?.trim() || summarizePrompt(task.snapshot?.prompt ?? ''),
    snapshot: normalizeQueuedGenerationSnapshot(task.snapshot ?? {}),
    status: normalizeTaskStatus(task.status),
    attempt: Math.max(0, Math.round(Number(task.attempt ?? 0))),
    resultRecordIds: Array.isArray(task.resultRecordIds) ? task.resultRecordIds.map(String) : [],
    error: task.error,
    createdAt,
    updatedAt: task.updatedAt || createdAt,
    startedAt: task.startedAt,
    finishedAt: task.finishedAt,
    durationMs: typeof task.durationMs === 'number' ? task.durationMs : undefined
  };
}

function normalizeCompareGroup(group: Partial<BatchQueueCompareGroup>): BatchQueueCompareGroup {
  const createdAt = group.createdAt || nowIso();
  return {
    id: group.id || createBatchQueueId('compare'),
    queueId: group.queueId || '',
    prompt: String(group.prompt || ''),
    taskIds: Array.isArray(group.taskIds) ? group.taskIds.map(String) : [],
    profileIds: Array.isArray(group.profileIds) ? group.profileIds.map(String) : [],
    selectedResultRecordId: group.selectedResultRecordId,
    createdAt,
    updatedAt: group.updatedAt || createdAt
  };
}

function compactReferencesForQueue(references: ReferenceImage[], preserveEmbeddedReferenceImages: boolean) {
  const omittedReferenceIds: string[] = [];
  const compacted = references.map((reference) => {
    const compactedReference = compactReferenceImageForQueue(reference, preserveEmbeddedReferenceImages);
    if (compactedReference.dataUrlOmitted) omittedReferenceIds.push(compactedReference.id);
    return compactedReference;
  });

  return {
    references: compacted,
    referencePolicy: {
      embeddedImageData: omittedReferenceIds.length === 0
        ? 'included' as const
        : omittedReferenceIds.length === compacted.length
          ? 'omitted' as const
          : 'mixed' as const,
      omittedReferenceIds
    }
  };
}

export function compactReferenceImageForQueue(
  reference: ReferenceImage,
  preserveEmbeddedReferenceImages = false
): QueuedReferenceImage {
  const dataUrl = reference.dataUrl?.startsWith('data:image/')
    ? reference.dataUrl
    : undefined;
  const shouldOmitDataUrl =
    Boolean(dataUrl) &&
    !preserveEmbeddedReferenceImages &&
    (dataUrl?.length ?? 0) > MAX_REFERENCE_DATA_URL_CHARS;

  return {
    id: reference.id || createBatchQueueId('reference'),
    name: reference.name,
    mimeType: reference.mimeType,
    dataUrl: shouldOmitDataUrl ? undefined : dataUrl,
    dataUrlOmitted: shouldOmitDataUrl || undefined,
    localPath: reference.localPath,
    previewUrl: reference.previewUrl,
    source: reference.source,
    sourceGenerationId: reference.sourceGenerationId,
    role: reference.role,
    addedAt: reference.addedAt
  };
}

function normalizeQueuedReferenceImage(reference: Partial<QueuedReferenceImage>): QueuedReferenceImage {
  return {
    id: String(reference.id || createBatchQueueId('reference')),
    name: reference.name,
    mimeType: reference.mimeType,
    dataUrl: reference.dataUrl,
    dataUrlOmitted: Boolean(reference.dataUrlOmitted) || undefined,
    localPath: reference.localPath,
    previewUrl: reference.previewUrl,
    source: reference.source ?? 'upload',
    sourceGenerationId: reference.sourceGenerationId,
    role: reference.role,
    addedAt: reference.addedAt
  };
}

function normalizeQueueName(name: unknown) {
  const normalized = String(name || '').trim();
  return normalized || '未命名批量队列';
}

function normalizeQueueStatus(status: unknown): BatchQueueStatus {
  const allowed: BatchQueueStatus[] = ['draft', 'ready', 'running', 'paused', 'completed', 'completed-with-errors', 'cancelled'];
  return allowed.includes(status as BatchQueueStatus) ? (status as BatchQueueStatus) : 'draft';
}

function normalizeTaskStatus(status: unknown): BatchQueueTaskStatus {
  const allowed: BatchQueueTaskStatus[] = ['pending', 'running', 'succeeded', 'failed', 'cancelled'];
  return allowed.includes(status as BatchQueueTaskStatus) ? (status as BatchQueueTaskStatus) : 'pending';
}

function normalizeCount(count: unknown) {
  const numeric = Number(count);
  if (!Number.isFinite(numeric)) return 1;
  return Math.max(1, Math.min(4, Math.round(numeric)));
}

function summarizePrompt(prompt: string) {
  const compact = prompt.replace(/\s+/g, ' ').trim();
  if (!compact) return '未命名任务';
  return compact.length > 40 ? `${compact.slice(0, 40)}…` : compact;
}

function createBatchQueueId(prefix: string) {
  const cryptoApi = typeof crypto !== 'undefined' ? crypto : undefined;
  if (cryptoApi?.randomUUID) return `${prefix}-${cryptoApi.randomUUID()}`;
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function nowIso() {
  return new Date().toISOString();
}
