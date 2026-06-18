import type {
  BatchGenerationQueue,
  BatchQueueTask,
  QueuedGenerationExecutionResult,
  QueuedGenerationRequestSnapshot
} from '../domain/batchQueueTypes';
import type { GenerationRecord, ImageGenerationRequest, ImageGenerationResult } from '../domain/providerTypes';
import { listProviders } from '../providers/registry';
import { generateOpenAIImage, saveGenerationRecord } from './desktopApi';
import { summarizeBatchQueue } from './batchQueue';

export interface ExecuteQueuedGenerationTaskOptions {
  saveRecords?: boolean;
  providerName?: string;
  now?: () => Date;
  onTaskUpdate?: (task: BatchQueueTask) => void;
}

export interface ExecuteNextBatchQueueTaskResult {
  queue: BatchGenerationQueue;
  execution: QueuedGenerationExecutionResult | null;
}

export async function executeQueuedGenerationTask(
  task: BatchQueueTask,
  options: ExecuteQueuedGenerationTaskOptions = {}
): Promise<QueuedGenerationExecutionResult> {
  const now = options.now ?? (() => new Date());
  const startedAtDate = now();
  const startedAt = startedAtDate.toISOString();
  const runningTask: BatchQueueTask = {
    ...task,
    status: 'running',
    attempt: task.attempt + 1,
    startedAt,
    updatedAt: startedAt,
    error: undefined
  };
  options.onTaskUpdate?.(runningTask);

  try {
    validateQueuedGenerationSnapshot(runningTask.snapshot);
    const result = await runQueuedGenerationSnapshot(runningTask.snapshot);
    const queuedResult = attachQueueMetadataToResult(result, runningTask);
    const recordsToSave = splitImageResultIntoSingleImageRecords(queuedResult);
    const savedRecords = await saveQueueGenerationRecords(
      recordsToSave,
      resolveProviderName(runningTask.snapshot, options.providerName),
      options.saveRecords !== false
    );
    const finishedAtDate = now();
    const finishedAt = finishedAtDate.toISOString();
    const succeeded = queuedResult.status === 'succeeded' && savedRecords.some((record) => record.status === 'succeeded');
    const finishedTask: BatchQueueTask = {
      ...runningTask,
      status: succeeded ? 'succeeded' : 'failed',
      resultRecordIds: savedRecords.map((record) => record.id),
      error: succeeded ? undefined : queuedResult.error ?? '任务没有返回有效图片。',
      finishedAt,
      updatedAt: finishedAt,
      durationMs: Math.max(0, finishedAtDate.getTime() - startedAtDate.getTime())
    };
    options.onTaskUpdate?.(finishedTask);
    return { task: finishedTask, records: savedRecords };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const failedResult = createQueuedFailureRecord(runningTask, message);
    const savedRecords = await saveQueueGenerationRecords(
      [failedResult],
      resolveProviderName(runningTask.snapshot, options.providerName),
      options.saveRecords !== false
    );
    const finishedAtDate = now();
    const finishedAt = finishedAtDate.toISOString();
    const failedTask: BatchQueueTask = {
      ...runningTask,
      status: 'failed',
      resultRecordIds: savedRecords.map((record) => record.id),
      error: message,
      finishedAt,
      updatedAt: finishedAt,
      durationMs: Math.max(0, finishedAtDate.getTime() - startedAtDate.getTime())
    };
    options.onTaskUpdate?.(failedTask);
    return { task: failedTask, records: savedRecords };
  }
}

export async function executeNextBatchQueueTask(
  queue: BatchGenerationQueue,
  options: ExecuteQueuedGenerationTaskOptions = {}
): Promise<ExecuteNextBatchQueueTaskResult> {
  if (queue.status === 'paused' || queue.status === 'cancelled' || queue.status === 'completed') {
    return { queue, execution: null };
  }

  const nextTask = queue.tasks.find((task) => task.status === 'pending');
  if (!nextTask) {
    return { queue: finalizeQueueStatus(queue), execution: null };
  }

  const runningQueue: BatchGenerationQueue = {
    ...queue,
    status: 'running',
    startedAt: queue.startedAt ?? new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  const execution = await executeQueuedGenerationTask(nextTask, options);
  const nextQueue = finalizeQueueStatus({
    ...runningQueue,
    tasks: runningQueue.tasks.map((task) => task.id === execution.task.id ? execution.task : task),
    updatedAt: new Date().toISOString()
  });
  return { queue: nextQueue, execution };
}

export function snapshotToImageGenerationRequest(
  snapshot: QueuedGenerationRequestSnapshot
): ImageGenerationRequest {
  return {
    providerId: snapshot.providerId,
    modelId: snapshot.modelId,
    prompt: snapshot.prompt,
    negativePrompt: snapshot.negativePrompt,
    size: snapshot.size,
    quality: snapshot.quality,
    outputFormat: snapshot.outputFormat,
    outputCompression: snapshot.outputCompression,
    count: snapshot.count,
    generationMode: snapshot.generationMode,
    references: snapshot.references,
    seed: snapshot.seed,
    baseUrl: snapshot.baseUrl,
    protocol: snapshot.protocol,
    imageToImageAdapter: snapshot.imageToImageAdapter,
    endpointPath: snapshot.endpointPath,
    extraHeaders: snapshot.extraHeaders,
    secretId: snapshot.secretId,
    metadata: snapshot.metadata
  };
}

function validateQueuedGenerationSnapshot(snapshot: QueuedGenerationRequestSnapshot) {
  if (!snapshot.providerId.trim()) throw new Error('队列任务缺少平台 ID。');
  if (!snapshot.modelId.trim()) throw new Error('队列任务缺少模型 ID。');
  if (!snapshot.prompt.trim()) throw new Error('队列任务缺少 Prompt。');
  if (!snapshot.size.trim()) throw new Error('队列任务缺少输出尺寸。');
  if (snapshot.generationMode === 'image-to-image') {
    if (!snapshot.references?.length) throw new Error('图生图队列任务缺少参考图。');
    const missingImagePayload = snapshot.references.filter((reference) =>
      !reference.dataUrl &&
      !reference.previewUrl &&
      !reference.localPath
    );
    if (missingImagePayload.length > 0) {
      throw new Error('图生图队列任务中有参考图缺少可用图片数据，请重新添加参考图后再入队。');
    }
  }
  if (snapshot.providerId === 'comfyui-local') {
    throw new Error('ComfyUI 批量队列需要 workflow 快照和节点映射，当前基础执行器暂未启用本地模型执行。');
  }
}

async function runQueuedGenerationSnapshot(snapshot: QueuedGenerationRequestSnapshot) {
  return generateOpenAIImage(snapshotToImageGenerationRequest(snapshot));
}

function attachQueueMetadataToResult(result: ImageGenerationResult, task: BatchQueueTask): ImageGenerationResult {
  return {
    ...result,
    generationMode: task.snapshot.generationMode,
    referenceImages: task.snapshot.references,
    raw: {
      visionhub_queue_task: {
        queueId: task.queueId,
        taskId: task.id,
        kind: task.kind,
        compareGroupId: task.compareGroupId ?? null,
        profileId: task.snapshot.profileId ?? null,
        source: task.snapshot.source,
        capturedAt: task.snapshot.capturedAt,
        attempt: task.attempt
      },
      providerRaw: result.raw ?? null
    }
  };
}

async function saveQueueGenerationRecords(
  records: ImageGenerationResult[],
  providerName: string | undefined,
  shouldSave: boolean
): Promise<GenerationRecord[]> {
  if (!shouldSave) return records;

  const savedRecords: GenerationRecord[] = [];
  for (const record of records) {
    savedRecords.push(await saveGenerationRecord(record, providerName));
  }
  return savedRecords;
}

function splitImageResultIntoSingleImageRecords(result: ImageGenerationResult): ImageGenerationResult[] {
  if (result.status !== 'succeeded' || result.imageUrls.length <= 1) return [result];

  const localImagePaths = result.localImagePaths ?? [];
  const total = result.imageUrls.length;
  return result.imageUrls.map((imageUrl, index) => ({
    ...result,
    id: `${result.id}-queue-${index + 1}`,
    imageUrls: [imageUrl],
    localImagePaths: localImagePaths[index] ? [localImagePaths[index]] : [],
    raw: {
      visionhub_queue_split_image_record: {
        sourceResultId: result.id,
        imageIndex: index + 1,
        total
      },
      originalRaw: result.raw ?? null
    }
  }));
}

function createQueuedFailureRecord(task: BatchQueueTask, message: string): ImageGenerationResult {
  return {
    id: `queue-error-${Date.now()}`,
    providerId: task.snapshot.providerId,
    modelId: task.snapshot.modelId || 'not-configured',
    status: 'failed',
    prompt: task.snapshot.prompt,
    imageUrls: [],
    localImagePaths: [],
    costHint: '队列任务未返回有效图片；以供应商实际账单为准。',
    error: message,
    raw: {
      visionhub_queue_task_error: {
        queueId: task.queueId,
        taskId: task.id,
        kind: task.kind,
        compareGroupId: task.compareGroupId ?? null,
        profileId: task.snapshot.profileId ?? null,
        source: task.snapshot.source,
        attempt: task.attempt
      }
    },
    createdAt: new Date().toISOString(),
    generationMode: task.snapshot.generationMode,
    referenceImages: task.snapshot.references
  };
}

function resolveProviderName(snapshot: QueuedGenerationRequestSnapshot, fallback?: string) {
  return fallback
    ?? snapshot.providerName
    ?? listProviders().find((provider) => provider.id === snapshot.providerId)?.name;
}

function finalizeQueueStatus(queue: BatchGenerationQueue): BatchGenerationQueue {
  const summary = summarizeBatchQueue(queue);
  if (summary.running > 0) return { ...queue, status: 'running' };
  if (summary.pending > 0) return { ...queue, status: queue.status === 'running' ? 'ready' : queue.status };
  if (summary.failed > 0) {
    return { ...queue, status: 'completed-with-errors', finishedAt: queue.finishedAt ?? new Date().toISOString() };
  }
  if (summary.succeeded > 0 || summary.cancelled > 0 || summary.total === 0) {
    return { ...queue, status: 'completed', finishedAt: queue.finishedAt ?? new Date().toISOString() };
  }
  return queue;
}
