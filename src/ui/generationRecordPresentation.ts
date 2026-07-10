import type { GenerationRecord, ReferenceImage } from '../domain/providerTypes';
import { diagnoseGenerationFailure, type GenerationFailureCategory, type GenerationFailureSeverity } from '../services/generationErrorDiagnostics';
import type { Translator } from '../i18n';

export function isPotentialBackgroundCompletion(record: Pick<GenerationRecord, 'status' | 'error' | 'raw'>) {
  return diagnoseGenerationFailure(record).isPotentialBackgroundCompletion;
}

export function generationStatusLabel(record: Pick<GenerationRecord, 'status' | 'error' | 'raw'>, t?: Translator) {
  if (record.status === 'succeeded') return t ? t('library.generationStatus.succeeded') : 'Succeeded';
  if (isPotentialBackgroundCompletion(record)) return t ? t('library.generationStatus.pendingRecovery') : 'Needs check';
  if (record.status === 'running') return t ? t('library.generationStatus.running') : 'Running';
  if (record.status === 'queued') return t ? t('library.generationStatus.queued') : 'Queued';
  if (record.status === 'cancelled') return t ? t('library.generationStatus.cancelled') : 'Cancelled';
  return t ? t('library.generationStatus.failed') : 'Failed';
}

export function generationStatusClass(record: Pick<GenerationRecord, 'status' | 'error' | 'raw'>) {
  return isPotentialBackgroundCompletion(record) ? 'pendingRecovery' : record.status;
}

export function generationFailureActions(record: Pick<GenerationRecord, 'status' | 'error' | 'raw' | 'generationMode' | 'referenceImages' | 'modelId' | 'providerId'>, t?: Translator) {
  return diagnoseGenerationFailure(record, t).actions;
}

export function generationFailureDetails(record: Pick<GenerationRecord, 'status' | 'error' | 'raw' | 'generationMode' | 'referenceImages' | 'modelId' | 'providerId'>, t?: Translator) {
  return diagnoseGenerationFailure(record, t).details;
}

export const generationFailureCategoryLabels: Record<GenerationFailureCategory, string> = {
  auth: 'Auth',
  permission: 'Permission',
  quota: 'Quota',
  'rate-limit': 'Rate limit',
  protocol: 'Protocol',
  model: 'Model',
  parameter: 'Parameters',
  'content-safety': 'Safety',
  'timeout-background': 'Needs check',
  server: 'Provider',
  network: 'Network',
  'response-format': 'Response format',
  'no-image': 'No image',
  unknown: 'Unknown'
};

export const generationFailureSeverityLabels: Record<GenerationFailureSeverity, string> = {
  error: 'Blocking',
  warning: 'Warning',
  info: 'Info'
};

export function generationFailureCategoryLabel(category: GenerationFailureCategory, t?: Translator) {
  return t ? t(`generate.error.category.${category}` as Parameters<Translator>[0]) : generationFailureCategoryLabels[category];
}

export function generationFailureSeverityLabel(severity: GenerationFailureSeverity, t?: Translator) {
  return t ? t(`generate.error.severity.${severity}` as Parameters<Translator>[0]) : generationFailureSeverityLabels[severity];
}

export function translateOrFallback(
  t: Translator | undefined,
  key: Parameters<Translator>[0],
  fallback: string,
  params?: Record<string, string | number>
) {
  return t ? t(key, params) : fallback;
}

export function generationModeCopyLabel(mode: GenerationRecord['generationMode'] | undefined, t?: Translator) {
  if (mode === 'image-to-image') return t ? t('library.modeBadge.image-to-image') : 'Image to image';
  if (mode === 'imported') return t ? t('library.modeBadge.imported') : 'Imported image';
  return t ? t('library.modeBadge.text-to-image') : 'Text to image';
}

export function safeStringifyDiagnosticRaw(raw: unknown) {
  if (raw == null) return '';
  try {
    return JSON.stringify(raw, null, 2);
  } catch {
    return String(raw);
  }
}

export function clipDiagnosticText(text: string, maxLength = 1400, t?: Translator) {
  if (text.length <= maxLength) return text;
  const clipped = text.slice(0, maxLength);
  return t ? t('library.copy.rawTruncated', { text: clipped }) : `${clipped}\n...Truncated. Copy Raw to inspect the full content.`;
}

export function generationFailureRawText(record: Pick<GenerationRecord, 'error' | 'raw' | 'status' | 'generationMode' | 'referenceImages' | 'modelId' | 'providerId'>, t?: Translator) {
  const diagnosis = diagnoseGenerationFailure(record, t);
  return safeStringifyDiagnosticRaw(record.raw) || diagnosis.rawMessage || record.error || '';
}

export function generationFailureCopyText(record: GenerationRecord, providerName?: string, t?: Translator) {
  const diagnosis = diagnoseGenerationFailure(record, t);
  const detailLines = generationFailureDetails(record, t);
  const categoryLabel = generationFailureCategoryLabel(diagnosis.category, t);
  const severityLabel = generationFailureSeverityLabel(diagnosis.severity, t);
  const statusLabel = generationStatusLabel(record, t);
  const primaryPath = getRecordPrimaryPath(record);
  const mode = generationModeCopyLabel(record.generationMode, t);
  const actionsText = diagnosis.actions.map((action, index) => `${index + 1}. ${action}`).join('\n');
  return [
    translateOrFallback(t, 'library.copy.failureReportTitle', 'Kuroii VisionHub generation failure diagnosis'),
    translateOrFallback(t, 'library.copy.field.diagnosis', `Diagnosis: ${diagnosis.title}`, { value: diagnosis.title }),
    translateOrFallback(t, 'library.copy.field.summary', `Summary: ${diagnosis.summary}`, { value: diagnosis.summary }),
    translateOrFallback(t, 'library.copy.field.category', `Category: ${categoryLabel} / ${severityLabel}`, { category: categoryLabel, severity: severityLabel }),
    translateOrFallback(t, 'library.copy.field.status', `Status: ${statusLabel} (${record.status})`, { status: statusLabel, raw: record.status }),
    providerName
      ? translateOrFallback(t, 'library.copy.field.providerWithId', `Provider: ${providerName} (${record.providerId})`, { provider: providerName, id: record.providerId })
      : translateOrFallback(t, 'library.copy.field.provider', `Provider: ${record.providerName ?? record.providerId}`, { provider: record.providerName ?? record.providerId }),
    translateOrFallback(t, 'library.copy.field.model', `Model: ${record.modelId || '-'}`, { model: record.modelId || '-' }),
    translateOrFallback(t, 'library.copy.field.mode', `Mode: ${mode}`, { mode }),
    translateOrFallback(t, 'library.copy.field.references', `References: ${record.referenceImages?.length ?? 0}`, { count: record.referenceImages?.length ?? 0 }),
    record.durationMs ? translateOrFallback(t, 'library.copy.field.duration', `Duration: ${record.durationMs}ms`, { ms: record.durationMs }) : '',
    record.createdAt ? translateOrFallback(t, 'library.copy.field.createdAt', `Created at: ${record.createdAt}`, { time: record.createdAt }) : '',
    primaryPath ? translateOrFallback(t, 'library.copy.field.imagePath', `Image/path: ${primaryPath}`, { path: primaryPath }) : '',
    detailLines.length ? translateOrFallback(t, 'library.copy.field.details', `Details: ${detailLines.join(' / ')}`, { details: detailLines.join(' / ') }) : '',
    diagnosis.actions.length ? translateOrFallback(t, 'library.copy.field.actions', `Suggested actions:\n${actionsText}`, { actions: actionsText }) : '',
    diagnosis.rawMessage ? translateOrFallback(t, 'library.copy.field.rawError', `Raw error: ${diagnosis.rawMessage}`, { message: diagnosis.rawMessage }) : ''
  ].filter(Boolean).join('\n\n');
}

export function generationRequestSummaryCopyText(record: GenerationRecord, providerName?: string, t?: Translator) {
  const diagnosis = diagnoseGenerationFailure(record, t);
  const rawText = generationFailureRawText(record, t);
  const categoryLabel = generationFailureCategoryLabel(diagnosis.category, t);
  const severityLabel = generationFailureSeverityLabel(diagnosis.severity, t);
  const statusLabel = generationStatusLabel(record, t);
  const primaryPath = getRecordPrimaryPath(record);
  const mode = generationModeCopyLabel(record.generationMode, t);
  const clippedRawText = rawText ? clipDiagnosticText(rawText, 1800, t) : '';
  return [
    translateOrFallback(t, 'library.copy.requestSummaryTitle', 'Kuroii VisionHub request summary'),
    translateOrFallback(t, 'library.copy.field.recordId', `Record ID: ${record.id}`, { id: record.id }),
    translateOrFallback(t, 'library.copy.field.status', `Status: ${statusLabel} (${record.status})`, { status: statusLabel, raw: record.status }),
    translateOrFallback(t, 'library.copy.field.provider', `Provider: ${providerName ?? record.providerName ?? record.providerId}`, { provider: providerName ?? record.providerName ?? record.providerId }),
    translateOrFallback(t, 'library.copy.field.providerId', `Provider ID: ${record.providerId}`, { id: record.providerId }),
    translateOrFallback(t, 'library.copy.field.model', `Model: ${record.modelId || '-'}`, { model: record.modelId || '-' }),
    translateOrFallback(t, 'library.copy.field.mode', `Mode: ${mode}`, { mode }),
    translateOrFallback(t, 'library.copy.field.references', `References: ${record.referenceImages?.length ?? 0}`, { count: record.referenceImages?.length ?? 0 }),
    record.costHint ? translateOrFallback(t, 'library.copy.field.cost', `Cost hint: ${record.costHint}`, { value: record.costHint }) : '',
    record.durationMs ? translateOrFallback(t, 'library.copy.field.duration', `Duration: ${record.durationMs}ms`, { ms: record.durationMs }) : '',
    record.createdAt ? translateOrFallback(t, 'library.copy.field.createdAt', `Created at: ${record.createdAt}`, { time: record.createdAt }) : '',
    primaryPath ? translateOrFallback(t, 'library.copy.field.mainPath', `Primary path: ${primaryPath}`, { path: primaryPath }) : '',
    translateOrFallback(t, 'library.copy.field.diagnosticCategory', `Diagnostic category: ${categoryLabel} / ${severityLabel}`, { category: categoryLabel, severity: severityLabel }),
    diagnosis.httpStatus ? translateOrFallback(t, 'library.copy.field.http', `HTTP: ${diagnosis.httpStatus}`, { status: diagnosis.httpStatus }) : '',
    diagnosis.traceId ? translateOrFallback(t, 'library.copy.field.traceId', `trace_id: ${diagnosis.traceId}`, { value: diagnosis.traceId }) : '',
    diagnosis.requestId ? translateOrFallback(t, 'library.copy.field.requestId', `request_id: ${diagnosis.requestId}`, { value: diagnosis.requestId }) : '',
    translateOrFallback(t, 'library.copy.field.prompt', `Prompt:\n${record.prompt}`, { prompt: record.prompt }),
    record.error ? translateOrFallback(t, 'library.copy.field.error', `Error: ${record.error}`, { message: record.error }) : '',
    clippedRawText ? translateOrFallback(t, 'library.copy.field.rawSummary', `Raw summary:\n${clippedRawText}`, { summary: clippedRawText }) : ''
  ].filter(Boolean).join('\n\n');
}

export function getRecordPrimaryPath(record: GenerationRecord) {
  return record.localImagePaths?.[0] ?? record.imageUrls[0] ?? '';
}

export function isRevealableLocalPath(value?: string) {
  if (!value) return false;
  const trimmed = value.trim();
  return Boolean(trimmed) && !/^https?:\/\//i.test(trimmed) && !/^data:/i.test(trimmed);
}

export function getRecordRevealPath(record: GenerationRecord) {
  const localPath = record.localImagePaths?.find(isRevealableLocalPath);
  if (localPath) return localPath;
  return record.imageUrls.find(isRevealableLocalPath) ?? '';
}

export function getRecordFileName(record: GenerationRecord) {
  const path = getRecordPrimaryPath(record);
  return path.split(/[\\/]/).filter(Boolean).pop() ?? '';
}

export function getRecordTimeMs(value: string) {
  const numeric = Number(value);
  if (Number.isFinite(numeric) && numeric > 0) return numeric;
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
}

export function summarizeReferenceSources(references?: ReferenceImage[], t?: Translator) {
  if (!references?.length) return '';
  const fallbackLabels: Record<ReferenceImage['source'], string> = {
    upload: 'Local',
    'generated-result': 'Gallery work',
    clipboard: 'Clipboard',
    'drag-drop': 'Drag drop',
    inspiration: 'Inspiration'
  };
  const counts = new Map<string, number>();
  for (const reference of references) {
    const label = t
      ? t(`library.referenceSource.${reference.source}` as Parameters<Translator>[0])
      : fallbackLabels[reference.source] ?? reference.source;
    counts.set(label, (counts.get(label) ?? 0) + 1);
  }
  return Array.from(counts.entries()).map(([label, count]) => `${label} ${count}`).join(t ? ' / ' : ', ');
}

export function getReferencePreviewUrl(reference: ReferenceImage) {
  return reference.previewUrl || reference.dataUrl || reference.localPath || '';
}

export function formatTime(value: string) {
  const numeric = Number(value);
  const date = Number.isFinite(numeric) && numeric > 0 ? new Date(numeric) : new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
}
