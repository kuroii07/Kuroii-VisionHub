import type { GenerationMode, ImageGenerationRequest, GenerationRecord, ReferenceImage } from './providerTypes';

export type BatchQueueStatus =
  | 'draft'
  | 'ready'
  | 'running'
  | 'paused'
  | 'completed'
  | 'completed-with-errors'
  | 'cancelled';

export type BatchQueueTaskStatus =
  | 'pending'
  | 'running'
  | 'succeeded'
  | 'failed'
  | 'cancelled';

export type BatchQueueTaskKind = 'single' | 'model-compare' | 'prompt-size-sweep';

export type QueuedGenerationSource =
  | 'generate-page'
  | 'library-retry'
  | 'model-compare'
  | 'batch-variants'
  | 'manual';

export interface QueuedReferenceImage extends ReferenceImage {
  dataUrlOmitted?: boolean;
}

export interface QueuedGenerationRequestSnapshot extends ImageGenerationRequest {
  snapshotVersion: 1;
  providerName?: string;
  profileId?: string;
  profileName?: string;
  secretId?: ImageGenerationRequest['secretId'];
  source: QueuedGenerationSource;
  capturedAt: string;
  referencePolicy?: {
    embeddedImageData: 'included' | 'omitted' | 'mixed';
    omittedReferenceIds: string[];
  };
  references?: QueuedReferenceImage[];
}

export interface BatchQueueTask {
  id: string;
  queueId: string;
  kind: BatchQueueTaskKind;
  compareGroupId?: string;
  title: string;
  snapshot: QueuedGenerationRequestSnapshot;
  status: BatchQueueTaskStatus;
  attempt: number;
  resultRecordIds: string[];
  error?: string;
  createdAt: string;
  updatedAt: string;
  startedAt?: string;
  finishedAt?: string;
  durationMs?: number;
}

export interface BatchQueueCompareGroup {
  id: string;
  queueId: string;
  prompt: string;
  taskIds: string[];
  profileIds: string[];
  selectedResultRecordId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface BatchGenerationQueue {
  id: string;
  name: string;
  description?: string;
  status: BatchQueueStatus;
  tasks: BatchQueueTask[];
  compareGroups?: BatchQueueCompareGroup[];
  createdAt: string;
  updatedAt: string;
  startedAt?: string;
  finishedAt?: string;
}

export interface BatchQueueStore {
  version: 1;
  queues: BatchGenerationQueue[];
  updatedAt: string;
}

export interface QueuedGenerationExecutionResult {
  task: BatchQueueTask;
  records: GenerationRecord[];
}

export function isQueuedGenerationMode(value: unknown): value is GenerationMode {
  return value === 'text-to-image' || value === 'image-to-image' || value === 'imported';
}
