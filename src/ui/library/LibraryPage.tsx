import {
  Bookmark, ChevronRight, Clock3, Copy, Database, Download, FolderOpen, Gauge, Globe2, Grid2X2,
  HardDrive, Image, ImagePlus, Info, Maximize2, MoreHorizontal, Pencil, Plus, RefreshCcw, Settings, Sidebar,
  SlidersHorizontal, Sparkles, Star, Trash2, Upload, X, ZoomIn, ZoomOut
} from 'lucide-react';
import { memo, useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type MouseEvent, type PointerEvent } from 'react';
import type { GenerationRecord, ReferenceImage } from '../../domain/providerTypes';
import { listProviders } from '../../providers/registry';
import {
  importLibraryImagesFromFiles, importLibraryImagesFromFolder, isTauriRuntime, loadLibraryData,
  prepareLibraryThumbnails, revealGenerationFile, saveLibraryData, saveTextFileWithDialog,
  type LibraryThumbnail
} from '../../services/desktopApi';
import { diagnoseGenerationFailure, type GenerationFailureCategory, type GenerationFailureSeverity } from '../../services/generationErrorDiagnostics';
import type { Translator } from '../../i18n';
import { StudioSelect } from '../StudioSelect';
import type { ConfirmDialogRequest } from '../confirmDialog';
import { useToastMessage } from '../toast';
import { ImagePreviewModal, type ImagePreviewNavigation, type ImagePreviewNavigationItem, type ImagePreviewState } from '../ImagePreviewModal';
import {
  clipDiagnosticText, formatTime, generationFailureActions, generationFailureCopyText, generationFailureDetails,
  generationFailureRawText, generationRequestSummaryCopyText, generationStatusClass, getRecordFileName,
  getRecordPrimaryPath, getRecordRevealPath, getRecordTimeMs, getReferencePreviewUrl,
  isPotentialBackgroundCompletion, summarizeReferenceSources
} from '../generationRecordPresentation';
import { readUrlSearchList, readUrlSearchParam } from '../urlSearch';
import {
  LIBRARY_INITIAL_RENDER_COUNT, LIBRARY_RENDER_BATCH_SIZE, analyzeImageColors, buildLibraryDataPayload,
  buildLibraryRecoveryAdvice, compactLibraryMetaEntry, getRecordFileSizeLabel,
  getRecordFormat, getRecordFormatLabel, getRecordShapeTokens, getRecordSizeLabel, libraryAddActions,
  libraryColorMatchesFilter, libraryColorOptions, libraryFocusSearchEvent, libraryFolderColors, libraryFormatOptions,
  libraryQuickFilters, libraryRatingOptions, libraryRatingValues, libraryShapeOptions, librarySortOptions,
  libraryViewOptions, loadLibraryCustomQuickFilters, loadLibraryDisplaySettings, loadLibraryMeta,
  loadLibraryOrganization, normalizeLibraryCustomQuickFilters, normalizeLibraryDisplaySettings,
  normalizeLibraryMeta, normalizeLibraryOrganization, saveLibraryCustomQuickFilters, saveLibraryDisplaySettings,
  saveLibraryMeta, saveLibraryOrganization, sortLibraryRecords,
  type LibraryAddAction, type LibraryAssignDialogState, type LibraryCollection, type LibraryColorFilter,
  type LibraryContextMenuState, type LibraryCustomQuickFilter, type LibraryCustomQuickFilterCriteria,
  type LibraryDisplaySettings, type LibraryFolder, type LibraryFormatFilter, type LibraryMetaEntry,
  type LibraryMetaMap, type LibraryModeFilter, type LibraryOrganization, type LibraryOrganizerDialogState,
  type LibraryQuickFilter, type LibraryRatingFilter, type LibraryScope, type LibraryShapeFilter,
  type LibrarySortMode, type LibraryTimeFilter, type LibraryViewMode, type LibraryRecoveryAdvice
} from './libraryModel';

function useStableEvent<T extends (...args: any[]) => unknown>(handler: T): T {
  const handlerRef = useRef(handler);
  handlerRef.current = handler;
  return useCallback(((...args: Parameters<T>) => handlerRef.current(...args)) as T, []);
}

export const CachedLibraryPage = memo(function CachedLibraryPage(props: {
  t: Translator;
  providers: ReturnType<typeof listProviders>;
  results: GenerationRecord[];
  isHistoryLoaded: boolean;
  isActive: boolean;
  preview: ImagePreviewState | null;
  resolveProviderLabel: (provider: ReturnType<typeof listProviders>[number]) => string;
  onAddResult: (record: GenerationRecord) => void;
  onPreview: (imageUrl: string, navigation?: ImagePreviewNavigation) => void;
  onNavigatePreview: (item: ImagePreviewNavigationItem) => void;
  onClosePreview: () => void;
  onUseAsReference: (record: GenerationRecord) => void;
  onRetryRecord: (record: GenerationRecord) => void;
  onRecheckBackgroundRecord: (record: GenerationRecord) => Promise<GenerationRecord>;
  onRequestConfirm: (request: ConfirmDialogRequest) => void;
  onDelete: (recordId: string) => Promise<void>;
}) {
  return (
    <section
      className={`workspacePage cachedLibraryPage ${props.isActive ? 'active' : 'inactive'}`}
      aria-hidden={!props.isActive}
    >
      <LibraryPage
        t={props.t}
        providers={props.providers}
        results={props.results}
        isHistoryLoaded={props.isHistoryLoaded}
        isActive={props.isActive}
        resolveProviderLabel={props.resolveProviderLabel}
        onAddResult={props.onAddResult}
        onPreview={props.onPreview}
        onUseAsReference={props.onUseAsReference}
        onRetryRecord={props.onRetryRecord}
        onRecheckBackgroundRecord={props.onRecheckBackgroundRecord}
        onRequestConfirm={props.onRequestConfirm}
        onDelete={props.onDelete}
      />
      {props.isActive && props.preview ? (
        <ImagePreviewModal
          t={props.t}
          imageUrl={props.preview.imageUrl}
          navigation={props.preview.navigation}
          onNavigate={props.onNavigatePreview}
          onClose={props.onClosePreview}
        />
      ) : null}
    </section>
  );
});

const LibraryRecordCard = memo(function LibraryRecordCard(props: {
  t: Translator;
  record: GenerationRecord;
  providerName: string;
  meta?: LibraryMetaEntry;
  isSelected: boolean;
  viewMode: LibraryViewMode;
  displaySettings: LibraryDisplaySettings;
  thumbnail?: LibraryThumbnail;
  thumbnailPending: boolean;
  isCurrentScopeRemovable: boolean;
  onSelect: (recordId: string, event?: MouseEvent<HTMLElement>) => void;
  onOpenContextMenu: (recordId: string, event: MouseEvent<HTMLElement>) => void;
  onPreview: (record: GenerationRecord, imageUrl?: string) => void;
  onAnalyzeColors: (recordId: string, image: HTMLImageElement, imageSizeOverride?: string) => void;
  onToggleFavorite: (recordId: string) => void;
  onOpenDetails: (record: GenerationRecord) => void;
  onOpenDiagnostics: (record: GenerationRecord) => void;
  onUseAsReference: (record: GenerationRecord) => void;
  onCopyPrompt: (record: GenerationRecord) => void;
  onCopyPath: (record: GenerationRecord) => void;
  onExportRecord: (record: GenerationRecord) => void;
  onAssignFolder: (recordId: string) => void;
  onAssignCollection: (recordId: string) => void;
  onRemoveFromCurrentScope: (recordId: string) => void;
  onDelete: (recordId: string) => void;
}) {
  const ct = (key: string, params?: Record<string, string | number>) => props.t(key as Parameters<Translator>[0], params);
  const imageUrl = props.record.imageUrls[0];
  const cardImageUrl = props.thumbnailPending ? undefined : props.thumbnail?.thumbnailUrl ?? imageUrl;
  const originalImageSize = props.thumbnail?.width && props.thumbnail.height
    ? `${props.thumbnail.width}x${props.thumbnail.height}`
    : undefined;
  const modeLabel = ct(`library.modeBadge.${(props.record.generationMode ?? 'text-to-image') === 'image-to-image' ? 'image-to-image' : 'text-to-image'}`);
  const referenceCount = props.record.referenceImages?.length ?? 0;
  const referenceSummary = summarizeReferenceSources(props.record.referenceImages, props.t);
  const isFavorite = Boolean(props.meta?.favorite);
  const statusLabel = isPotentialBackgroundCompletion(props.record)
    ? ct('library.generationStatus.pendingRecovery')
    : ct(`library.generationStatus.${props.record.status}`);

  return (
    <article
      className={`libraryCard libraryCardV2 ${props.record.status === 'failed' ? 'failed' : ''} ${isFavorite ? 'favorite' : ''} ${props.isSelected ? 'selected' : ''}`}
      aria-selected={props.isSelected}
      onClick={(event) => {
        const target = event.target;
        if (target instanceof Element && target.closest('button, a, input, select, textarea, .libraryQuickMenu')) return;
        props.onSelect(props.record.id, event);
      }}
      onContextMenu={(event) => props.onOpenContextMenu(props.record.id, event)}
    >
      <button
        className={`librarySelectMark ${props.isSelected ? 'active' : ''}`}
        type="button"
        aria-label={props.isSelected ? ct('library.action.unselectImage') : ct('library.action.selectImage')}
        onClick={(event) => {
          event.stopPropagation();
          props.onSelect(props.record.id, event);
        }}
      >
        <span />
      </button>
      {props.thumbnailPending ? (
        <div className="libraryFailedThumb" aria-busy="true">{ct('common.loading')}</div>
      ) : cardImageUrl ? (
        <button
          className="libraryThumb"
          onClick={(event) => {
            if (event.ctrlKey || event.metaKey || event.shiftKey) {
              props.onSelect(props.record.id, event);
              return;
            }
            props.onPreview(props.record, imageUrl);
          }}
        >
          <img
            src={cardImageUrl}
            alt={props.record.prompt}
            loading="lazy"
            decoding="async"
            onLoad={(event) => props.onAnalyzeColors(props.record.id, event.currentTarget, originalImageSize)}
            onError={(event) => {
              if (imageUrl && event.currentTarget.dataset.originalFallback !== 'true') {
                event.currentTarget.dataset.originalFallback = 'true';
                event.currentTarget.src = imageUrl;
              }
            }}
          />
          <span><Maximize2 size={15} /> {ct('library.action.preview')}</span>
        </button>
      ) : (
        <div className="libraryFailedThumb">{ct('library.action.failedThumb')}</div>
      )}
      <div className="libraryImageOverlay">
        <button className={`iconMiniButton favoriteButton ${isFavorite ? 'active' : ''}`} type="button" data-tooltip={isFavorite ? ct('library.action.removeFavorite') : ct('library.action.favorite')} aria-label={isFavorite ? ct('library.action.removeFavorite') : ct('library.action.favorite')} onClick={() => props.onToggleFavorite(props.record.id)}>
          <Star size={14} fill={isFavorite ? 'currentColor' : 'none'} />
        </button>
        <div className="libraryMoreMenuWrap">
          <button className="iconMiniButton" type="button" data-tooltip={ct('library.action.more')} aria-label={ct('library.action.more')}>
            <MoreHorizontal size={15} />
          </button>
          <div className="libraryQuickMenu" aria-label={ct('library.context.imageActions')}>
            <button type="button" onClick={() => props.onOpenDetails(props.record)}><Info size={13} /> {ct('library.detail.title')}</button>
            {props.record.error || props.record.status === 'failed' ? (
              <button type="button" onClick={() => props.onOpenDiagnostics(props.record)}><Gauge size={13} /> {ct('library.action.viewDiagnostics')}</button>
            ) : null}
            <button type="button" disabled={!imageUrl} onClick={() => props.onUseAsReference(props.record)}><ImagePlus size={13} /> {ct('library.action.setReference')}</button>
            <button type="button" onClick={() => props.onCopyPrompt(props.record)}><Copy size={13} /> {ct('library.action.copyPrompt')}</button>
            <button type="button" disabled={!getRecordPrimaryPath(props.record)} onClick={() => props.onCopyPath(props.record)}><Copy size={13} /> {ct('library.action.copyPath')}</button>
            <button type="button" onClick={() => props.onExportRecord(props.record)}><Download size={13} /> {ct('library.action.exportList')}</button>
            <span className="libraryMenuDivider" />
            <button type="button" onClick={() => props.onToggleFavorite(props.record.id)}><Star size={13} /> {isFavorite ? ct('library.action.removeFavorite') : ct('library.action.addFavorite')}</button>
            <button type="button" onClick={() => props.onAssignFolder(props.record.id)}><FolderOpen size={13} /> {ct('library.action.moveFolder')}</button>
            <button type="button" onClick={() => props.onAssignCollection(props.record.id)}><Bookmark size={13} /> {ct('library.action.addCollection')}</button>
            {props.isCurrentScopeRemovable ? (
              <button type="button" onClick={() => props.onRemoveFromCurrentScope(props.record.id)}><X size={13} /> {ct('library.action.removeCurrentScope')}</button>
            ) : null}
            <span className="libraryMenuDivider" />
            <button className="dangerAction" type="button" onClick={() => props.onDelete(props.record.id)}><Trash2 size={13} /> {ct('library.action.deleteRecord')}</button>
          </div>
        </div>
      </div>
      <div className="libraryCardBody">
        <div className="resultTitleRow">
          <strong>{props.displaySettings.showProvider ? props.providerName : formatTime(props.record.createdAt)}</strong>
          <div className="cardTopActions">
            <span className="statusBadge modeBadge">{modeLabel}</span>
            {props.displaySettings.showReferenceBadge && referenceCount > 0 ? <span className="statusBadge referenceBadge" title={ct('library.reference.title', { summary: referenceSummary })}>{ct('library.reference.badge', { count: referenceCount })}</span> : null}
            <span className={`statusBadge ${generationStatusClass(props.record)}`}>{statusLabel}</span>
          </div>
        </div>
        {props.viewMode === 'list' || props.displaySettings.showPrompt ? <p title={props.record.prompt}>{props.record.prompt}</p> : null}
        <div className="metadataRow">
          {props.displaySettings.showModel ? <span>{props.record.modelId}</span> : null}
          <span><Clock3 size={12} /> {formatTime(props.record.createdAt)}</span>
        </div>
      </div>
    </article>
  );
});

const LibraryPage = memo(function LibraryPage(props: {
  t: Translator;
  providers: ReturnType<typeof listProviders>;
  results: GenerationRecord[];
  isHistoryLoaded: boolean;
  isActive: boolean;
  resolveProviderLabel: (provider: ReturnType<typeof listProviders>[number]) => string;
  onAddResult: (record: GenerationRecord) => void;
  onPreview: (imageUrl: string, navigation?: ImagePreviewNavigation) => void;
  onUseAsReference: (record: GenerationRecord) => void;
  onRetryRecord: (record: GenerationRecord) => void;
  onRecheckBackgroundRecord: (record: GenerationRecord) => Promise<GenerationRecord>;
  onRequestConfirm: (request: ConfirmDialogRequest) => void;
  onDelete: (recordId: string) => Promise<void>;
}) {
  const lt = (key: string, params?: Record<string, string | number>) => props.t(key as Parameters<Translator>[0], params);
  const libraryColorLabel = (color: LibraryColorFilter) => lt(`library.color.${color}`);
  const libraryGenerationStatusLabel = (record: Pick<GenerationRecord, 'status' | 'error' | 'raw'>) => (
    isPotentialBackgroundCompletion(record)
      ? lt('library.generationStatus.pendingRecovery')
      : lt(`library.generationStatus.${record.status}`)
  );
  const libraryGenerationModeLabel = (mode: GenerationRecord['generationMode']) => lt(`library.modeBadge.${mode === 'image-to-image' ? 'image-to-image' : 'text-to-image'}`);
  const libraryReferenceSourceLabel = (source: ReferenceImage['source']) => lt(`library.referenceSource.${source}`);
  const libraryReferenceRoleLabel = (role?: ReferenceImage['role']) => lt(`library.referenceRole.${role ?? 'auto'}`);
  const libraryFailureCategoryLabel = (category: GenerationFailureCategory) => lt(`library.failureCategory.${category}`);
  const libraryFailureSeverityLabel = (severity: GenerationFailureSeverity) => lt(`library.failureSeverity.${severity}`);
  const libraryRecoveryAdviceText = (advice: LibraryRecoveryAdvice) => ({
    title: lt(`library.recovery.${advice.key}.title`),
    summary: lt(`library.recovery.${advice.key}.summary`),
    actions: [1, 2, 3].map((index) => lt(`library.recovery.${advice.key}.action${index}`))
  });
  const [query, setQuery] = useState('');
  const [providerFilter, setProviderFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'succeeded' | 'failed'>(() => {
    const status = readUrlSearchParam('status');
    return status === 'all' || status === 'succeeded' || status === 'failed' ? status : 'succeeded';
  });
  const [modeFilter, setModeFilter] = useState<LibraryModeFilter>('all');
  const [timeFilter, setTimeFilter] = useState<LibraryTimeFilter>('all');
  const [colorFilter, setColorFilter] = useState<LibraryColorFilter>('all');
  const [shapeFilter, setShapeFilter] = useState<LibraryShapeFilter>('all');
  const [formatFilter, setFormatFilter] = useState<LibraryFormatFilter>('all');
  const [ratingFilter, setRatingFilter] = useState<LibraryRatingFilter>('all');
  const [colorMenuOpen, setColorMenuOpen] = useState(false);
  const [quickFilters, setQuickFilters] = useState<LibraryQuickFilter[]>([]);
  const [customQuickFilters, setCustomQuickFilters] = useState<LibraryCustomQuickFilter[]>(() => loadLibraryCustomQuickFilters());
  const [activeCustomQuickFilterIds, setActiveCustomQuickFilterIds] = useState<string[]>([]);
  const [libraryOrganization, setLibraryOrganization] = useState<LibraryOrganization>(() => loadLibraryOrganization());
  const [libraryScope, setLibraryScope] = useState<LibraryScope>({ type: 'all' });
  const [libraryOrganizerOpen, setLibraryOrganizerOpen] = useState(() => readUrlSearchParam('organizer') === '1');
  const [organizerDialog, setOrganizerDialog] = useState<LibraryOrganizerDialogState | null>(null);
  const [assignDialog, setAssignDialog] = useState<LibraryAssignDialogState | null>(null);
  const [quickFilterEditorOpen, setQuickFilterEditorOpen] = useState(false);
  const [quickFilterName, setQuickFilterName] = useState('');
  const [viewMode, setViewMode] = useState<LibraryViewMode>('adaptive');
  const [sortMode, setSortMode] = useState<LibrarySortMode>('newest');
  const [thumbnailScale, setThumbnailScale] = useState(1);
  const [searchVisible, setSearchVisible] = useState(true);
  const [filtersVisible, setFiltersVisible] = useState(true);
  const [activePanel, setActivePanel] = useState<'main' | 'view' | 'display' | 'sort' | 'add' | null>(null);
  const [selectedRecordId, setSelectedRecordId] = useState<string | null>(() => readUrlSearchParam('record'));
  const [diagnosticRecordId, setDiagnosticRecordId] = useState<string | null>(null);
  const [selectedRecordIds, setSelectedRecordIds] = useState<string[]>(() => readUrlSearchList('selected'));
  const [selectionAnchorId, setSelectionAnchorId] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<LibraryContextMenuState | null>(null);
  const [libraryMeta, setLibraryMeta] = useState<LibraryMetaMap>(() => loadLibraryMeta());
  const [displaySettings, setDisplaySettings] = useState<LibraryDisplaySettings>(() => loadLibraryDisplaySettings());
  const [renderedItemCount, setRenderedItemCount] = useState(LIBRARY_INITIAL_RENDER_COUNT);
  const [libraryThumbnails, setLibraryThumbnails] = useState<Record<string, LibraryThumbnail>>({});
  const [copyMessage, setCopyMessage] = useState('');
  const [recheckingRecordId, setRecheckingRecordId] = useState<string | null>(null);
  const dockRef = useRef<HTMLElement | null>(null);
  const loadMoreRef = useRef<HTMLButtonElement | null>(null);
  const colorFilterRef = useRef<HTMLLabelElement | null>(null);
  const quickFilterEditorRef = useRef<HTMLDivElement | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const libraryDataHydratedRef = useRef(!isTauriRuntime());
  const pendingImageMetaPatchesRef = useRef<Record<string, Partial<LibraryMetaEntry>>>({});
  const pendingColorAnalysisRef = useRef<Set<string>>(new Set());
  const thumbnailRequestsInFlightRef = useRef<Set<string>>(new Set());
  const imageMetaFlushRef = useRef<{ timerId: number | null; idleId: number | null }>({ timerId: null, idleId: null });
  useToastMessage(copyMessage, setCopyMessage);

  const flushImageMetaPatches = useCallback(() => {
    const patches = pendingImageMetaPatchesRef.current;
    pendingImageMetaPatchesRef.current = {};
    imageMetaFlushRef.current.timerId = null;
    imageMetaFlushRef.current.idleId = null;
    const entries = Object.entries(patches);
    if (!entries.length) return;
    setLibraryMeta((current) => {
      let changed = false;
      const next = { ...current };
      entries.forEach(([recordId, patch]) => {
        const entry = compactLibraryMetaEntry({
          ...next[recordId],
          ...patch
        });
        const previous = next[recordId];
        if (Object.keys(entry).length) {
          if (JSON.stringify(previous ?? {}) !== JSON.stringify(entry)) {
            next[recordId] = entry;
            changed = true;
          }
          return;
        }
        if (previous) {
          delete next[recordId];
          changed = true;
        }
      });
      if (!changed) return current;
      saveLibraryMeta(next);
      return next;
    });
  }, []);

  const queueImageMetaPatch = useCallback((recordId: string, patch: Partial<LibraryMetaEntry>) => {
    pendingImageMetaPatchesRef.current[recordId] = {
      ...pendingImageMetaPatchesRef.current[recordId],
      ...patch
    };
    if (imageMetaFlushRef.current.timerId !== null || imageMetaFlushRef.current.idleId !== null) return;
    imageMetaFlushRef.current.timerId = window.setTimeout(() => {
      imageMetaFlushRef.current.timerId = null;
      if ('requestIdleCallback' in window) {
        imageMetaFlushRef.current.idleId = window.requestIdleCallback(flushImageMetaPatches, { timeout: 1200 });
        return;
      }
      flushImageMetaPatches();
    }, 180);
  }, [flushImageMetaPatches]);

  useEffect(() => () => {
    if (imageMetaFlushRef.current.timerId !== null) {
      window.clearTimeout(imageMetaFlushRef.current.timerId);
    }
    if (imageMetaFlushRef.current.idleId !== null && 'cancelIdleCallback' in window) {
      window.cancelIdleCallback(imageMetaFlushRef.current.idleId);
    }
  }, []);

  useEffect(() => {
    if (!isTauriRuntime()) return;
    let cancelled = false;

    async function hydrateLibraryData() {
      try {
        const data = await loadLibraryData();
        if (cancelled) return;

        if (data?.exists) {
          const nextMeta = normalizeLibraryMeta(data.meta);
          const nextOrganization = normalizeLibraryOrganization(data.organization as Partial<LibraryOrganization>);
          const nextDisplaySettings = normalizeLibraryDisplaySettings(data.display_settings as Partial<LibraryDisplaySettings>);
          const nextCustomQuickFilters = normalizeLibraryCustomQuickFilters(data.custom_quick_filters);

          setLibraryMeta(nextMeta);
          setLibraryOrganization(nextOrganization);
          setDisplaySettings(nextDisplaySettings);
          setCustomQuickFilters(nextCustomQuickFilters);

          saveLibraryMeta(nextMeta);
          saveLibraryOrganization(nextOrganization);
          saveLibraryDisplaySettings(nextDisplaySettings);
          saveLibraryCustomQuickFilters(nextCustomQuickFilters);
        } else {
          void saveLibraryData(buildLibraryDataPayload(libraryMeta, libraryOrganization, displaySettings, customQuickFilters));
        }
      } catch (error) {
        console.warn('[VisionHub] library metadata file sync failed; local cache is still available', error);
        if (!cancelled) setCopyMessage(lt('library.message.metadataSyncFailed'));
      } finally {
        if (!cancelled) libraryDataHydratedRef.current = true;
      }
    }

    void hydrateLibraryData();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!libraryDataHydratedRef.current || !isTauriRuntime()) return;
    let idleId: number | null = null;
    const save = () => {
      void saveLibraryData(buildLibraryDataPayload(libraryMeta, libraryOrganization, displaySettings, customQuickFilters))
        .catch((error) => {
          console.warn('[VisionHub] library metadata file save failed; local cache is still available', error);
        });
    };
    const timer = window.setTimeout(() => {
      if ('requestIdleCallback' in window) {
        idleId = window.requestIdleCallback(save, { timeout: 2000 });
        return;
      }
      save();
    }, 650);
    return () => {
      window.clearTimeout(timer);
      if (idleId !== null && 'cancelIdleCallback' in window) {
        window.cancelIdleCallback(idleId);
      }
    };
  }, [libraryMeta, libraryOrganization, displaySettings, customQuickFilters]);
  const isDockSubPanel = activePanel !== null && activePanel !== 'main' && activePanel !== 'add';
  const providerNameMap = useMemo(
    () => new Map(props.providers.map((provider) => [provider.id, props.resolveProviderLabel(provider)])),
    [props.providers, props.resolveProviderLabel]
  );
  const providerOptions = useMemo(
    () => [
      { value: 'all', label: lt('library.filter.providerAll') },
      ...props.providers.map((provider) => ({ value: provider.id, label: props.resolveProviderLabel(provider) }))
    ],
    [lt, props.providers, props.resolveProviderLabel]
  );
  const libraryItems = useMemo(
    () => props.results.filter((result) => result.imageUrls.length > 0 || result.status === 'failed'),
    [props.results]
  );
  const libraryRecordMap = useMemo(
    () => new Map(libraryItems.map((record) => [record.id, record])),
    [libraryItems]
  );
  const { successCount, failedCount, localPathCount } = useMemo(() => {
    let success = 0;
    let failed = 0;
    let local = 0;
    libraryItems.forEach((record) => {
      if (record.status === 'succeeded') success += 1;
      if (record.status === 'failed') failed += 1;
      if (record.localImagePaths?.[0]) local += 1;
    });
    return { successCount: success, failedCount: failed, localPathCount: local };
  }, [libraryItems]);
  const { nowMs, todayStartMs } = useMemo(() => {
    const now = Date.now();
    const today = new Date(now);
    today.setHours(0, 0, 0, 0);
    return { nowMs: now, todayStartMs: today.getTime() };
  }, [libraryItems.length]);
  const normalizedQuery = query.trim().toLowerCase();
  const activeCustomFilters = useMemo(
    () => activeCustomQuickFilterIds
      .map((filterId) => customQuickFilters.find((item) => item.id === filterId) ?? null)
      .filter((filter): filter is LibraryCustomQuickFilter => Boolean(filter)),
    [activeCustomQuickFilterIds, customQuickFilters]
  );
  const filteringMetaSignature = useMemo(() => {
    const needsFavorite =
      sortMode === 'favorites' ||
      libraryScope.type === 'favorites' ||
      quickFilters.includes('favorites') ||
      Boolean(normalizedQuery);
    const needsFolder = libraryScope.type === 'folder';
    const needsCollection = libraryScope.type === 'collection';
    const needsColor = colorFilter !== 'all' || activeCustomFilters.some((filter) => Boolean(filter.criteria.colorFilter && filter.criteria.colorFilter !== 'all')) || Boolean(normalizedQuery);
    const needsShape = shapeFilter !== 'all' || sortMode === 'size' || activeCustomFilters.some((filter) => Boolean(filter.criteria.shapeFilter && filter.criteria.shapeFilter !== 'all'));
    const needsRating = ratingFilter !== 'all' || activeCustomFilters.some((filter) => Boolean(filter.criteria.ratingFilter && filter.criteria.ratingFilter !== 'all'));
    const needsTags = Boolean(normalizedQuery) || activeCustomFilters.some((filter) => Boolean(filter.criteria.query?.trim()));
    if (!needsFavorite && !needsFolder && !needsCollection && !needsColor && !needsShape && !needsRating && !needsTags) return 'none';
    return libraryItems.map((record) => {
      const meta = libraryMeta[record.id];
      if (!meta) return record.id;
      return [
        record.id,
        needsFavorite ? Number(Boolean(meta.favorite)) : '',
        needsFolder ? meta.folderId ?? '' : '',
        needsCollection ? meta.collectionIds?.join(',') ?? '' : '',
        needsColor ? `${meta.colorFamilies?.join(',') ?? ''}|${meta.colorPalette?.join(',') ?? ''}` : '',
        needsShape ? meta.imageSize ?? '' : '',
        needsRating ? meta.rating ?? '' : '',
        needsTags ? meta.tags?.join(',') ?? '' : ''
      ].join(':');
    }).join('|');
  }, [activeCustomFilters, colorFilter, libraryItems, libraryMeta, libraryScope, normalizedQuery, quickFilters, ratingFilter, shapeFilter, sortMode]);
  const statusOptions = [
    { value: 'succeeded', label: lt('library.status.succeeded') },
    { value: 'failed', label: lt('library.status.failed') },
    { value: 'all', label: lt('library.status.all') }
  ];
  const modeOptions = [
    { value: 'all', label: lt('library.mode.all') },
    { value: 'text-to-image', label: lt('library.mode.text-to-image') },
    { value: 'image-to-image', label: lt('library.mode.image-to-image') },
    { value: 'with-references', label: lt('library.mode.with-references') }
  ];
  const timeOptions = [
    { value: 'all', label: lt('library.time.all') },
    { value: 'today', label: lt('library.time.today') },
    { value: '7d', label: lt('library.time.7d') },
    { value: '30d', label: lt('library.time.30d') }
  ];
  const translatedLibraryQuickFilters = libraryQuickFilters.map((filter) => ({ ...filter, label: lt(`library.quick.${filter.value}`) }));
  const translatedLibraryViewOptions = libraryViewOptions.map((option) => ({ ...option, label: lt(`library.view.${option.value}`) }));
  const translatedLibrarySortOptions = librarySortOptions.map((option) => ({ ...option, label: lt(`library.sort.${option.value}`) }));
  const translatedLibraryShapeOptions = libraryShapeOptions.map((option) => ({ ...option, label: lt(`library.shape.${option.value}`) }));
  const translatedLibraryFormatOptions = libraryFormatOptions.map((option) => ({ ...option, label: lt(`library.format.${option.value}`) }));
  const translatedLibraryRatingOptions = libraryRatingOptions.map((option) => ({ ...option, label: lt(`library.rating.${option.value}`) }));
  const translatedLibraryColorOptions = libraryColorOptions.map((option) => ({ ...option, label: libraryColorLabel(option.value) }));
  const translatedLibraryAddActions = libraryAddActions.map((action) => ({ ...action, label: lt(`library.add.${action.id}`), detail: lt(`library.add.${action.id}Detail`) }));
  const filteredItems = useMemo(() => sortLibraryRecords(libraryItems.filter((result) => {
    const providerName = providerNameMap.get(result.providerId) ?? result.providerName ?? result.providerId;
    const generationMode = result.generationMode ?? 'text-to-image';
    const recordTime = getRecordTimeMs(result.createdAt);
    const matchesProvider = providerFilter === 'all' || result.providerId === providerFilter;
    const matchesStatus = statusFilter === 'all' || result.status === statusFilter;
    const matchesMode =
      modeFilter === 'all' ||
      generationMode === modeFilter ||
      (modeFilter === 'with-references' && Boolean(result.referenceImages?.length));
    const matchesTime =
      timeFilter === 'all' ||
      (timeFilter === 'today' && recordTime >= todayStartMs) ||
      (timeFilter === '7d' && recordTime >= nowMs - 7 * 24 * 60 * 60 * 1000) ||
      (timeFilter === '30d' && recordTime >= nowMs - 30 * 24 * 60 * 60 * 1000);
    const referenceText = result.referenceImages?.map((reference) => `${reference.name ?? ''} ${reference.source}`).join(' ') ?? '';
    const meta = libraryMeta[result.id];
    const shapeTokens = getRecordShapeTokens(result, meta);
    const format = getRecordFormat(result);
    const rating = meta?.rating;
    const matchesShape = shapeFilter === 'all' || shapeTokens.includes(shapeFilter);
    const matchesFormat = formatFilter === 'all' || format === formatFilter;
    const matchesRating =
      ratingFilter === 'all' ||
      (ratingFilter === 'unrated' && !rating) ||
      (ratingFilter !== 'unrated' && rating === Number(ratingFilter));
    const matchesColor = libraryColorMatchesFilter(meta, colorFilter);
    const matchesQuickFilters = quickFilters.every((filter) => {
      if (filter === 'favorites') return Boolean(meta?.favorite);
      if (filter === 'recent7d') return recordTime >= nowMs - 7 * 24 * 60 * 60 * 1000;
      if (filter === 'references') return Boolean(result.referenceImages?.length);
      if (filter === 'failed') return result.status === 'failed';
      if (filter === 'local') return Boolean(result.localImagePaths?.[0]);
      return true;
    });
    const matchesLibraryScope =
      libraryScope.type === 'all' ||
      (libraryScope.type === 'favorites' && Boolean(meta?.favorite)) ||
      (libraryScope.type === 'recent7d' && recordTime >= nowMs - 7 * 24 * 60 * 60 * 1000) ||
      (libraryScope.type === 'recent-viewed' && Boolean(meta?.lastViewedAt)) ||
      (libraryScope.type === 'local' && Boolean(result.localImagePaths?.[0])) ||
      (libraryScope.type === 'folder' && meta?.folderId === libraryScope.id) ||
      (libraryScope.type === 'collection' && Boolean(meta?.collectionIds?.includes(libraryScope.id)));
    const matchesCustomQuickFilters = activeCustomFilters.every((filter) => {
      const criteria = filter.criteria;
      if (criteria.query?.trim()) {
        const customQuery = criteria.query.trim().toLowerCase();
        const customText = [
          result.prompt,
          result.modelId,
          result.providerId,
          providerName,
          result.status,
          referenceText,
          result.error ?? '',
          getRecordFileName(result),
          getRecordPrimaryPath(result),
          meta?.favorite ? lt('library.searchTokens.favorite') : '',
          ...(meta?.colorFamilies?.map((family) => libraryColorLabel(family)) ?? []),
          ...(meta?.tags ?? [])
        ].join(' ').toLowerCase();
        if (!customText.includes(customQuery)) return false;
      }
      if (criteria.providerFilter && criteria.providerFilter !== 'all' && result.providerId !== criteria.providerFilter) return false;
      if (criteria.statusFilter && criteria.statusFilter !== 'all' && result.status !== criteria.statusFilter) return false;
      if (criteria.modeFilter && criteria.modeFilter !== 'all' && generationMode !== criteria.modeFilter && !(criteria.modeFilter === 'with-references' && Boolean(result.referenceImages?.length))) return false;
      if (criteria.timeFilter === 'today' && recordTime < todayStartMs) return false;
      if (criteria.timeFilter === '7d' && recordTime < nowMs - 7 * 24 * 60 * 60 * 1000) return false;
      if (criteria.timeFilter === '30d' && recordTime < nowMs - 30 * 24 * 60 * 60 * 1000) return false;
      if (criteria.colorFilter && !libraryColorMatchesFilter(meta, criteria.colorFilter)) return false;
      if (criteria.shapeFilter && criteria.shapeFilter !== 'all' && !shapeTokens.includes(criteria.shapeFilter)) return false;
      if (criteria.formatFilter && criteria.formatFilter !== 'all' && format !== criteria.formatFilter) return false;
      if (criteria.ratingFilter === 'unrated' && rating) return false;
      if (criteria.ratingFilter && criteria.ratingFilter !== 'all' && criteria.ratingFilter !== 'unrated' && rating !== Number(criteria.ratingFilter)) return false;
      return true;
    });
    const statusText = libraryGenerationStatusLabel(result);
    const modeSearchText = generationMode === 'image-to-image' ? `${lt('library.modeBadge.image-to-image')} image-to-image img2img` : `${lt('library.modeBadge.text-to-image')} text-to-image txt2img`;
    const haystack = [
      result.prompt,
      result.modelId,
      result.providerId,
      providerName,
      statusText,
      result.status,
      modeSearchText,
      referenceText,
      result.error ?? '',
      getRecordFileName(result),
      getRecordPrimaryPath(result),
      meta?.favorite ? lt('library.searchTokens.favorite') : '',
      ...(meta?.colorFamilies?.map((family) => libraryColorLabel(family)) ?? []),
      result.localImagePaths?.[0] ? lt('library.searchTokens.local') : '',
      result.referenceImages?.length ? lt('library.searchTokens.reference') : '',
      ...(meta?.tags ?? [])
    ]
      .join(' ')
      .toLowerCase();
    const matchesQuery = !normalizedQuery || haystack.includes(normalizedQuery);
    return matchesProvider && matchesStatus && matchesMode && matchesTime && matchesShape && matchesFormat && matchesRating && matchesColor && matchesQuickFilters && matchesLibraryScope && matchesCustomQuickFilters && matchesQuery;
  }), sortMode, libraryMeta, providerNameMap), [
    activeCustomFilters,
    colorFilter,
    filteringMetaSignature,
    formatFilter,
    libraryItems,
    libraryScope,
    modeFilter,
    normalizedQuery,
    nowMs,
    providerFilter,
    providerNameMap,
    quickFilters,
    ratingFilter,
    shapeFilter,
    sortMode,
    statusFilter,
    timeFilter,
    todayStartMs
  ]);
  const filteredIds = useMemo(() => filteredItems.map((result) => result.id), [filteredItems]);
  const filteredIdsSignature = useMemo(() => filteredIds.join('|'), [filteredIds]);
  const selectedIdSet = useMemo(() => new Set(selectedRecordIds), [selectedRecordIds]);
  const visibleLibraryItems = useMemo(
    () => filteredItems.slice(0, Math.min(renderedItemCount, filteredItems.length)),
    [filteredItems, renderedItemCount]
  );
  useEffect(() => {
    if (!props.isActive || !props.isHistoryLoaded || !isTauriRuntime()) return;
    const paths = Array.from(new Set(
      visibleLibraryItems
        .map((record) => record.localImagePaths?.[0]?.trim())
        .filter((path): path is string => Boolean(path))
    )).filter((path) => !libraryThumbnails[path] && !thumbnailRequestsInFlightRef.current.has(path));
    if (!paths.length) return;

    paths.forEach((path) => thumbnailRequestsInFlightRef.current.add(path));
    void prepareLibraryThumbnails(paths)
      .then((results) => {
        if (!results.length) return;
        setLibraryThumbnails((current) => {
          const next = { ...current };
          results.forEach((result) => {
            next[result.sourcePath] = result;
          });
          return next;
        });
      })
      .catch((error) => {
        console.warn('[VisionHub] library thumbnail preparation failed; original images remain available', error);
      })
      .finally(() => {
        paths.forEach((path) => thumbnailRequestsInFlightRef.current.delete(path));
      });
  }, [libraryThumbnails, props.isActive, props.isHistoryLoaded, visibleLibraryItems]);
  const canRenderMoreLibraryItems = renderedItemCount < filteredItems.length;
  const selectedRecord = selectedRecordId ? libraryRecordMap.get(selectedRecordId) ?? null : null;
  const diagnosticRecord = diagnosticRecordId ? libraryRecordMap.get(diagnosticRecordId) ?? null : null;
  const selectedRecords = useMemo(
    () => selectedRecordIds
      .map((recordId) => libraryRecordMap.get(recordId) ?? null)
      .filter((result): result is GenerationRecord => Boolean(result)),
    [libraryRecordMap, selectedRecordIds]
  );
  const contextRecord = contextMenu ? libraryRecordMap.get(contextMenu.recordId) ?? null : null;
  const contextSelection = selectedRecords.length ? selectedRecords : contextRecord ? [contextRecord] : [];
  const diagnosticRecordProviderName = diagnosticRecord ? providerNameMap.get(diagnosticRecord.providerId) ?? diagnosticRecord.providerName ?? diagnosticRecord.providerId : '';
  const diagnosticRecordFailureDiagnosis = useMemo(
    () => diagnosticRecord && (diagnosticRecord.error || diagnosticRecord.status === 'failed') ? diagnoseGenerationFailure(diagnosticRecord, props.t) : null,
    [diagnosticRecord, props.t]
  );
  const diagnosticRecordFailureDetails = useMemo(
    () => diagnosticRecordFailureDiagnosis && diagnosticRecord ? generationFailureDetails(diagnosticRecord, props.t) : [],
    [diagnosticRecord, diagnosticRecordFailureDiagnosis, props.t]
  );
  const diagnosticRecordFailureActions = useMemo(
    () => diagnosticRecordFailureDiagnosis && diagnosticRecord ? generationFailureActions(diagnosticRecord, props.t) : [],
    [diagnosticRecord, diagnosticRecordFailureDiagnosis, props.t]
  );
  const diagnosticRecordFailureRawText = useMemo(
    () => diagnosticRecordFailureDiagnosis && diagnosticRecord ? generationFailureRawText(diagnosticRecord, props.t) : '',
    [diagnosticRecord, diagnosticRecordFailureDiagnosis, props.t]
  );
  const diagnosticRecordRecoveryAdvice = useMemo(
    () => diagnosticRecord ? buildLibraryRecoveryAdvice(diagnosticRecord) : null,
    [diagnosticRecord]
  );
  const selectedRecordRecoveryAdvice = useMemo(
    () => selectedRecord ? buildLibraryRecoveryAdvice(selectedRecord) : null,
    [selectedRecord]
  );
  const diagnosticRecordRecoveryAdviceText = diagnosticRecordRecoveryAdvice ? libraryRecoveryAdviceText(diagnosticRecordRecoveryAdvice) : null;
  const selectedRecordRecoveryAdviceText = selectedRecordRecoveryAdvice ? libraryRecoveryAdviceText(selectedRecordRecoveryAdvice) : null;
  const selectedRecordMeta = selectedRecord ? libraryMeta[selectedRecord.id] : undefined;
  const selectedRecordFileName = selectedRecord ? getRecordFileName(selectedRecord) || selectedRecord.id : '';
  const selectedRecordDetailMeta = selectedRecord
    ? [selectedRecord.modelId || '-', getRecordSizeLabel(selectedRecord, selectedRecordMeta), getRecordFileSizeLabel(selectedRecord, props.t), getRecordFormatLabel(selectedRecord, props.t)]
    : [];
  const selectedRecordFolder = selectedRecordMeta?.folderId
    ? libraryOrganization.folders.find((folder) => folder.id === selectedRecordMeta.folderId)
    : undefined;
  const selectedRecordCollections = selectedRecordMeta?.collectionIds?.length
    ? libraryOrganization.collections.filter((collection) => selectedRecordMeta.collectionIds?.includes(collection.id))
    : [];
  const { folderCounts, collectionCounts, favoriteScopeCount, recentScopeCount, recentViewedScopeCount, localScopeCount } = useMemo(() => {
    const nextFolderCounts = new Map<string, number>();
    const nextCollectionCounts = new Map<string, number>();
    let favorite = 0;
    let recent = 0;
    let recentViewed = 0;
    let local = 0;
    libraryItems.forEach((record) => {
      const meta = libraryMeta[record.id];
      if (meta?.folderId) nextFolderCounts.set(meta.folderId, (nextFolderCounts.get(meta.folderId) ?? 0) + 1);
      meta?.collectionIds?.forEach((collectionId) => {
        nextCollectionCounts.set(collectionId, (nextCollectionCounts.get(collectionId) ?? 0) + 1);
      });
      if (meta?.favorite) favorite += 1;
      if (getRecordTimeMs(record.createdAt) >= nowMs - 7 * 24 * 60 * 60 * 1000) recent += 1;
      if (meta?.lastViewedAt) recentViewed += 1;
      if (record.localImagePaths?.[0]) local += 1;
    });
    return {
      folderCounts: nextFolderCounts,
      collectionCounts: nextCollectionCounts,
      favoriteScopeCount: favorite,
      recentScopeCount: recent,
      recentViewedScopeCount: recentViewed,
      localScopeCount: local
    };
  }, [libraryItems, libraryMeta, nowMs]);
  const selectedScopeTitle =
    libraryScope.type === 'all' ? lt('library.organizer.all')
      : libraryScope.type === 'favorites' ? lt('library.organizer.favorites')
      : libraryScope.type === 'recent7d' ? lt('library.organizer.recent7d')
      : libraryScope.type === 'recent-viewed' ? lt('library.organizer.recentViewed')
      : libraryScope.type === 'local' ? lt('library.organizer.local')
      : libraryScope.type === 'folder' ? libraryOrganization.folders.find((folder) => folder.id === libraryScope.id)?.name ?? lt('library.organizer.folders')
      : libraryOrganization.collections.find((collection) => collection.id === libraryScope.id)?.name ?? lt('library.organizer.collections');

  useEffect(() => {
    const total = filteredItems.length;
    const initialCount = Math.min(LIBRARY_INITIAL_RENDER_COUNT, total);
    setRenderedItemCount(initialCount);
  }, [filteredIdsSignature, filteredItems.length]);

  useEffect(() => {
    if (!props.isActive || !canRenderMoreLibraryItems) return;
    const target = loadMoreRef.current;
    if (!target || !('IntersectionObserver' in window)) return;
    const observer = new IntersectionObserver((entries) => {
      if (!entries.some((entry) => entry.isIntersecting)) return;
      setRenderedItemCount((current) => Math.min(current + LIBRARY_RENDER_BATCH_SIZE, filteredItems.length));
    }, { root: null, rootMargin: '420px 0px' });
    observer.observe(target);
    return () => {
      observer.disconnect();
    };
  }, [canRenderMoreLibraryItems, filteredIdsSignature, filteredItems.length, props.isActive]);

  useEffect(() => {
    function focusSearch() {
      setSearchVisible(true);
      searchInputRef.current?.focus();
      searchInputRef.current?.select();
    }
    window.addEventListener(libraryFocusSearchEvent, focusSearch);
    return () => window.removeEventListener(libraryFocusSearchEvent, focusSearch);
  }, []);
  useEffect(() => {
    if (!props.isHistoryLoaded) return;
    if (selectedRecordId && !libraryRecordMap.has(selectedRecordId)) {
      setSelectedRecordId(null);
    }
    if (diagnosticRecordId && !libraryRecordMap.has(diagnosticRecordId)) {
      setDiagnosticRecordId(null);
    }
    setSelectedRecordIds((current) => {
      const next = current.filter((recordId) => libraryRecordMap.has(recordId));
      return next.length === current.length ? current : next;
    });
  }, [diagnosticRecordId, libraryRecordMap, props.isHistoryLoaded, selectedRecordId]);

  useEffect(() => {
    if (!activePanel) return;
    function closePanelOnOutsidePointer(event: globalThis.PointerEvent) {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (dockRef.current?.contains(target)) return;
      setActivePanel(null);
    }
    window.addEventListener('pointerdown', closePanelOnOutsidePointer);
    return () => window.removeEventListener('pointerdown', closePanelOnOutsidePointer);
  }, [activePanel]);

  useEffect(() => {
    if (!colorMenuOpen) return;
    function closeColorMenu(event: globalThis.PointerEvent) {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (colorFilterRef.current?.contains(target)) return;
      setColorMenuOpen(false);
    }
    window.addEventListener('pointerdown', closeColorMenu);
    return () => window.removeEventListener('pointerdown', closeColorMenu);
  }, [colorMenuOpen]);

  useEffect(() => {
    if (!quickFilterEditorOpen) return;
    function closeQuickFilterEditor(event: globalThis.PointerEvent) {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (quickFilterEditorRef.current?.contains(target)) return;
      setQuickFilterEditorOpen(false);
    }
    window.addEventListener('pointerdown', closeQuickFilterEditor);
    return () => window.removeEventListener('pointerdown', closeQuickFilterEditor);
  }, [quickFilterEditorOpen]);

  useEffect(() => {
    if (!libraryOrganizerOpen) return;
    function closeOrganizerOnEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') setLibraryOrganizerOpen(false);
    }
    window.addEventListener('keydown', closeOrganizerOnEscape);
    return () => window.removeEventListener('keydown', closeOrganizerOnEscape);
  }, [libraryOrganizerOpen]);

  useEffect(() => {
    if (!contextMenu) return;
    function closeContextMenu(event: globalThis.PointerEvent) {
      const target = event.target;
      if (target instanceof Element && target.closest('.libraryContextMenu')) return;
      setContextMenu(null);
    }
    function closeContextMenuOnEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') setContextMenu(null);
    }
    window.addEventListener('pointerdown', closeContextMenu);
    window.addEventListener('keydown', closeContextMenuOnEscape);
    return () => {
      window.removeEventListener('pointerdown', closeContextMenu);
      window.removeEventListener('keydown', closeContextMenuOnEscape);
    };
  }, [contextMenu]);

  async function copyText(label: string, value?: string) {
    if (!value) return;
    try {
      await navigator.clipboard?.writeText(value);
      setCopyMessage(lt('library.message.copied', { label }));
    } catch (error) {
      setCopyMessage(error instanceof Error ? error.message : String(error));
    }
  }

  function updateLibraryMeta(recordId: string, patch: Partial<LibraryMetaEntry>) {
    setLibraryMeta((current) => {
      const entry = compactLibraryMetaEntry({
        ...current[recordId],
        ...patch
      });
      const next = { ...current };
      if (Object.keys(entry).length) next[recordId] = entry;
      else delete next[recordId];
      saveLibraryMeta(next);
      return next;
    });
  }

  function toggleFavorite(recordId: string) {
    const isFavorite = Boolean(libraryMeta[recordId]?.favorite);
    updateLibraryMeta(recordId, { favorite: !isFavorite });
    setCopyMessage(isFavorite ? lt('library.message.favoriteRemoved') : lt('library.message.favoriteAdded'));
  }

  function setRecordRating(recordId: string, rating: number) {
    const currentRating = libraryMeta[recordId]?.rating;
    updateLibraryMeta(recordId, { rating: currentRating === rating ? undefined : rating });
  }

  function runRecordColorAnalysis(recordId: string, image: HTMLImageElement, imageSizeOverride?: string) {
    const current = libraryMeta[recordId];
    const pending = pendingImageMetaPatchesRef.current[recordId];
    if (pending?.colorPalette?.length || pending?.colorAnalysisFailed) return;
    const imageSize = imageSizeOverride ?? (image.naturalWidth && image.naturalHeight ? `${image.naturalWidth}x${image.naturalHeight}` : undefined);
    const shouldAnalyzeColors = !current?.colorPalette?.length || current.colorPalette.length < 10 || current.colorAnalysisFailed;
    if (!shouldAnalyzeColors) {
      if (imageSize && current?.imageSize !== imageSize) queueImageMetaPatch(recordId, { imageSize });
      return;
    }
    try {
      const result = analyzeImageColors(image);
      if (!result) {
        queueImageMetaPatch(recordId, { imageSize, colorAnalysisFailed: true });
        return;
      }
      queueImageMetaPatch(recordId, {
        imageSize,
        colorPalette: result.palette,
        colorFamilies: result.families,
        colorAnalyzedAt: new Date().toISOString(),
        colorAnalysisFailed: false
      });
    } catch {
      queueImageMetaPatch(recordId, { colorAnalysisFailed: true });
    }
  }

  function analyzeRecordColors(recordId: string, image: HTMLImageElement, imageSizeOverride?: string) {
    if (pendingColorAnalysisRef.current.has(recordId)) return;
    pendingColorAnalysisRef.current.add(recordId);
    const run = () => {
      pendingColorAnalysisRef.current.delete(recordId);
      runRecordColorAnalysis(recordId, image, imageSizeOverride);
    };
    if ('requestIdleCallback' in window) {
      window.requestIdleCallback(run, { timeout: 2200 });
      return;
    }
    globalThis.setTimeout(run, 320);
  }

  function setRecordsFavorite(recordIds: string[], favorite: boolean) {
    const uniqueIds = Array.from(new Set(recordIds)).filter((recordId) => libraryRecordMap.has(recordId));
    if (!uniqueIds.length) return;
    setLibraryMeta((current) => {
      const next = { ...current };
      uniqueIds.forEach((recordId) => {
        next[recordId] = {
          ...next[recordId],
          favorite
        };
      });
      saveLibraryMeta(next);
      return next;
    });
    setContextMenu(null);
    setCopyMessage(favorite ? lt('library.message.batchFavoriteAdded', { count: uniqueIds.length }) : lt('library.message.batchFavoriteRemoved', { count: uniqueIds.length }));
  }

  function updateDisplaySettings(patch: Partial<LibraryDisplaySettings>) {
    setDisplaySettings((current) => {
      const next = saveLibraryDisplaySettings({ ...current, ...patch });
      return next;
    });
  }

  function selectRecord(recordId: string, event?: MouseEvent<HTMLElement>) {
    setContextMenu(null);
    const primaryModifier = Boolean(event?.ctrlKey || event?.metaKey);
    const shiftModifier = Boolean(event?.shiftKey);
    if (shiftModifier && selectionAnchorId) {
      const anchorIndex = filteredIds.indexOf(selectionAnchorId);
      const targetIndex = filteredIds.indexOf(recordId);
      if (anchorIndex >= 0 && targetIndex >= 0) {
        const [start, end] = anchorIndex < targetIndex ? [anchorIndex, targetIndex] : [targetIndex, anchorIndex];
        setSelectedRecordIds(filteredIds.slice(start, end + 1));
        return;
      }
    }
    if (primaryModifier) {
      setSelectedRecordIds((current) => (
        current.includes(recordId)
          ? current.filter((item) => item !== recordId)
          : [...current, recordId]
      ));
      setSelectionAnchorId(recordId);
      return;
    }
    setSelectedRecordIds([recordId]);
    setSelectionAnchorId(recordId);
  }

  function selectAllFilteredRecords() {
    setSelectedRecordIds(filteredIds);
    setSelectionAnchorId(filteredIds[0] ?? null);
    setContextMenu(null);
  }

  function clearSelection() {
    setSelectedRecordIds([]);
    setSelectionAnchorId(null);
    setContextMenu(null);
  }

  function openLibraryContextMenu(recordId: string, event: MouseEvent<HTMLElement>) {
    event.preventDefault();
    event.stopPropagation();
    if (!selectedIdSet.has(recordId)) {
      setSelectedRecordIds([recordId]);
      setSelectionAnchorId(recordId);
    }
    const menuWidth = 176;
    const menuHeight = 430;
    setContextMenu({
      x: Math.min(event.clientX, Math.max(12, window.innerWidth - menuWidth - 12)),
      y: Math.min(event.clientY, Math.max(12, window.innerHeight - menuHeight - 12)),
      recordId
    });
  }

  function openRecordDetails(record: GenerationRecord) {
    updateLibraryMeta(record.id, { lastViewedAt: new Date().toISOString() });
    setSelectedRecordId(record.id);
    setDiagnosticRecordId(null);
  }

  function openRecordDiagnostics(record: GenerationRecord) {
    setDiagnosticRecordId(record.id);
    setSelectedRecordId(null);
  }

  function createLibraryPreviewNavigation(record: GenerationRecord): ImagePreviewNavigation | undefined {
    const items = filteredItems
      .filter((item) => Boolean(item.imageUrls[0]))
      .map((item) => ({
        id: item.id,
        imageUrl: item.imageUrls[0],
        label: getRecordFileName(item) || item.prompt || lt('library.title')
      }));
    return items.length > 1 ? { items, currentId: record.id } : undefined;
  }

  function previewRecord(record: GenerationRecord, imageUrl?: string) {
    if (!imageUrl) return;
    updateLibraryMeta(record.id, { lastViewedAt: new Date().toISOString() });
    props.onPreview(imageUrl, createLibraryPreviewNavigation(record));
  }

  const handleSelectRecord = useStableEvent(selectRecord);
  const handleOpenLibraryContextMenu = useStableEvent(openLibraryContextMenu);
  const handlePreviewRecord = useStableEvent(previewRecord);
  const handleAnalyzeRecordColors = useStableEvent(analyzeRecordColors);
  const handleToggleFavorite = useStableEvent(toggleFavorite);
  const handleOpenRecordDetails = useStableEvent(openRecordDetails);
  const handleOpenRecordDiagnostics = useStableEvent(openRecordDiagnostics);
  const handleUseRecordAsReference = useStableEvent(useRecordAsReference);
  const handleCopyRecordPrompt = useStableEvent((record: GenerationRecord) => {
    void copyText('Prompt', record.prompt);
  });
  const handleCopyRecordPath = useStableEvent((record: GenerationRecord) => {
    void copyText('Path', getRecordPrimaryPath(record));
  });
  const handleExportRecord = useStableEvent((record: GenerationRecord) => {
    exportSelectedRecordList([record]);
  });
  const handleAssignRecordFolder = useStableEvent((recordId: string) => {
    setAssignDialog({ type: 'folder', recordIds: [recordId] });
  });
  const handleAssignRecordCollection = useStableEvent((recordId: string) => {
    setAssignDialog({ type: 'collection', recordIds: [recordId] });
  });
  const handleRemoveRecordFromCurrentScope = useStableEvent((recordId: string) => {
    removeRecordsFromCurrentScope([recordId]);
  });
  const handleDeleteRecord = useStableEvent((recordId: string) => {
    void deleteRecord(recordId);
  });

  function useRecordAsReference(record: GenerationRecord) {
    updateLibraryMeta(record.id, { lastUsedAsReferenceAt: new Date().toISOString() });
    props.onUseAsReference(record);
  }

  async function deleteRecord(recordId: string) {
    props.onRequestConfirm({
      title: lt('library.confirm.deleteRecordTitle'),
      message: lt('library.confirm.deleteRecordMessage'),
      confirmLabel: lt('library.confirm.delete'),
      tone: 'danger',
      onConfirm: async () => {
        try {
          await props.onDelete(recordId);
          setSelectedRecordId((current) => (current === recordId ? null : current));
          setDiagnosticRecordId((current) => (current === recordId ? null : current));
          setSelectedRecordIds((current) => current.filter((item) => item !== recordId));
          setCopyMessage(lt('library.message.deleteRecordSuccess'));
        } catch (error) {
          setCopyMessage(error instanceof Error ? error.message : String(error));
          throw error;
        }
      }
    });
  }

  async function deleteRecords(recordIds: string[]) {
    const uniqueIds = Array.from(new Set(recordIds)).filter((recordId) => libraryRecordMap.has(recordId));
    if (!uniqueIds.length) return;
    if (uniqueIds.length === 1) {
      await deleteRecord(uniqueIds[0]);
      return;
    }
    props.onRequestConfirm({
      title: lt('library.confirm.deleteRecordsTitle'),
      message: lt('library.confirm.deleteRecordsMessage', { count: uniqueIds.length }),
      confirmLabel: lt('library.confirm.delete'),
      tone: 'danger',
      onConfirm: async () => {
        try {
          for (const recordId of uniqueIds) {
            await props.onDelete(recordId);
          }
          setSelectedRecordIds((current) => current.filter((recordId) => !uniqueIds.includes(recordId)));
          setSelectedRecordId((current) => (current && uniqueIds.includes(current) ? null : current));
          setDiagnosticRecordId((current) => (current && uniqueIds.includes(current) ? null : current));
          setSelectionAnchorId(null);
          setContextMenu(null);
          setCopyMessage(lt('library.message.deleteRecordsSuccess', { count: uniqueIds.length }));
        } catch (error) {
          setCopyMessage(error instanceof Error ? error.message : String(error));
          throw error;
        }
      }
    });
  }

  async function copySelectedPrompts(records: GenerationRecord[]) {
    const prompts = records.map((record, index) => `${records.length > 1 ? `${index + 1}. ` : ''}${record.prompt}`).join('\n\n');
    await copyText(records.length > 1 ? 'Prompts' : 'Prompt', prompts);
    setContextMenu(null);
  }

  async function copySelectedPaths(records: GenerationRecord[]) {
    const paths = records
      .map((record) => getRecordPrimaryPath(record))
      .filter(Boolean);
    if (!paths.length) {
      setCopyMessage(lt('library.message.noPaths'));
      setContextMenu(null);
      return;
    }
    await copyText(paths.length > 1 ? 'Paths' : 'Path', paths.join('\n'));
    setContextMenu(null);
  }

  function buildLibraryRecordList(records: GenerationRecord[]) {
    const exportedAt = new Date().toLocaleString();
    return [
      lt('library.export.title'),
      '',
      lt('library.export.time', { time: exportedAt }),
      lt('library.export.count', { count: records.length }),
      '',
      ...records.flatMap((record, index) => {
        const providerName = providerNameMap.get(record.providerId) ?? record.providerName ?? record.providerId;
        const primaryPath = getRecordPrimaryPath(record) || '-';
        const fileName = getRecordFileName(record) || record.id;
        const meta = libraryMeta[record.id];
        return [
          `## ${index + 1}. ${fileName}`,
          '',
          `- ID：${record.id}`,
          lt('library.export.status', { status: libraryGenerationStatusLabel(record) }),
          lt('library.export.provider', { provider: providerName }),
          lt('library.export.model', { model: record.modelId || '-' }),
          lt('library.export.type', { type: libraryGenerationModeLabel(record.generationMode) }),
          lt('library.export.created', { time: formatTime(record.createdAt) }),
          lt('library.export.path', { path: primaryPath }),
          lt('library.export.favorite', { value: meta?.favorite ? lt('library.export.yes') : lt('library.export.no') }),
          lt('library.export.size', { size: getRecordSizeLabel(record, meta) }),
          '',
          'Prompt：',
          '',
          '```text',
          record.prompt || '',
          '```',
          ''
        ];
      })
    ].join('\n');
  }

  async function exportSelectedRecordList(records: GenerationRecord[]) {
    if (!records.length) return;
    try {
      const content = buildLibraryRecordList(records);
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const suggestedFileName = `visionhub-library-records-${timestamp}.md`;
      if (isTauriRuntime()) {
        const result = await saveTextFileWithDialog({ suggestedFileName, content });
        if (!result.saved) {
          setCopyMessage(lt('library.message.exportCancelled'));
          return;
        }
        setCopyMessage(result.path ? lt('library.message.exportedPath', { path: result.path }) : lt('library.message.exportedCount', { count: records.length }));
      } else {
        const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = suggestedFileName;
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
        window.setTimeout(() => URL.revokeObjectURL(url), 800);
        setCopyMessage(lt('library.message.exportedCount', { count: records.length }));
      }
      setContextMenu(null);
    } catch (error) {
      setCopyMessage(error instanceof Error ? error.message : String(error));
    }
  }

  function openContextDetails(records: GenerationRecord[]) {
    if (records.length !== 1) return;
    openRecordDetails(records[0]);
    setContextMenu(null);
  }

  function openContextDiagnostics(records: GenerationRecord[]) {
    if (records.length !== 1) return;
    openRecordDiagnostics(records[0]);
    setContextMenu(null);
  }

  async function recheckDiagnosticRecord(record: GenerationRecord) {
    setRecheckingRecordId(record.id);
    try {
      const updated = await props.onRecheckBackgroundRecord(record);
      setDiagnosticRecordId(updated.id);
      setSelectedRecordId(null);
      setCopyMessage(updated.status === 'succeeded' ? lt('library.message.backgroundRecovered') : lt('library.message.backgroundRechecked'));
    } catch (error) {
      setCopyMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setRecheckingRecordId(null);
    }
  }

  function useContextRecordAsReference(records: GenerationRecord[]) {
    if (records.length !== 1) return;
    useRecordAsReference(records[0]);
    setContextMenu(null);
  }

  function handleAddAction(action: LibraryAddAction) {
    setActivePanel(null);
    if (action === 'folder') {
      openCreateOrganizerDialog('folder');
      return;
    }
    if (action === 'collection') {
      openCreateOrganizerDialog('collection');
      return;
    }
    if (action === 'import-file') {
      void importLibraryFiles();
      return;
    }
    if (action === 'batch-folder') {
      void importLibraryFolder();
    }
  }

  function selectLibraryScope(scope: LibraryScope) {
    setLibraryScope(scope);
    setLibraryOrganizerOpen(false);
  }

  function updateLibraryOrganization(next: LibraryOrganization) {
    setLibraryOrganization(next);
    saveLibraryOrganization(next);
  }

  function openCreateOrganizerDialog(type: LibraryOrganizerDialogState['type']) {
    setOrganizerDialog({
      type,
      mode: 'create',
      defaultName: type === 'folder'
        ? `${lt('library.dialog.newFolder')} ${libraryOrganization.folders.length + 1}`
        : `${lt('library.dialog.newCollection')} ${libraryOrganization.collections.length + 1}`
    });
  }

  function openRenameOrganizerDialog(type: LibraryOrganizerDialogState['type'], targetId: string, defaultName: string) {
    setOrganizerDialog({
      type,
      mode: 'rename',
      targetId,
      defaultName
    });
  }

  function createLibraryFolder(name: string) {
    const folder: LibraryFolder = {
      id: `folder-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      name,
      color: libraryFolderColors[libraryOrganization.folders.length % libraryFolderColors.length],
      createdAt: new Date().toISOString()
    };
    updateLibraryOrganization({
      ...libraryOrganization,
      folders: [...libraryOrganization.folders, folder]
    });
    if (selectedRecordIds.length) {
      setLibraryMeta((current) => {
        const next = { ...current };
        selectedRecordIds.forEach((recordId) => {
          next[recordId] = { ...next[recordId], folderId: folder.id };
        });
        saveLibraryMeta(next);
        return next;
      });
    }
    selectLibraryScope({ type: 'folder', id: folder.id });
    setCopyMessage(selectedRecordIds.length ? lt('library.message.createdFolderAssigned', { count: selectedRecordIds.length }) : lt('library.message.createdFolder', { name }));
  }

  function createLibraryCollection(name: string) {
    const collection: LibraryCollection = {
      id: `collection-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      name,
      coverRecordId: selectedRecordIds[0],
      createdAt: new Date().toISOString()
    };
    updateLibraryOrganization({
      ...libraryOrganization,
      collections: [...libraryOrganization.collections, collection]
    });
    if (selectedRecordIds.length) {
      setLibraryMeta((current) => {
        const next = { ...current };
        selectedRecordIds.forEach((recordId) => {
          const ids = next[recordId]?.collectionIds ?? [];
          next[recordId] = {
            ...next[recordId],
            collectionIds: ids.includes(collection.id) ? ids : [...ids, collection.id]
          };
        });
        saveLibraryMeta(next);
        return next;
      });
    }
    selectLibraryScope({ type: 'collection', id: collection.id });
    setCopyMessage(selectedRecordIds.length ? lt('library.message.createdCollectionAssigned', { count: selectedRecordIds.length }) : lt('library.message.createdCollection', { name }));
  }

  function deleteLibraryFolder(folder: LibraryFolder) {
    props.onRequestConfirm({
      title: lt('library.confirm.deleteFolderTitle'),
      message: lt('library.confirm.deleteFolderMessage', { name: folder.name }),
      confirmLabel: lt('library.confirm.delete'),
      tone: 'danger',
      onConfirm: async () => {
        const nextOrganization = {
          ...libraryOrganization,
          folders: libraryOrganization.folders.filter((item) => item.id !== folder.id)
        };
        updateLibraryOrganization(nextOrganization);
        setLibraryMeta((current) => {
          const next = { ...current };
          Object.entries(next).forEach(([recordId, meta]) => {
            if (meta.folderId === folder.id) {
              next[recordId] = { ...meta, folderId: undefined };
            }
          });
          saveLibraryMeta(next);
          return next;
        });
        if (libraryScope.type === 'folder' && libraryScope.id === folder.id) selectLibraryScope({ type: 'all' });
        setCopyMessage(lt('library.message.deletedFolder', { name: folder.name }));
      }
    });
  }

  function deleteLibraryCollection(collection: LibraryCollection) {
    props.onRequestConfirm({
      title: lt('library.confirm.deleteCollectionTitle'),
      message: lt('library.confirm.deleteCollectionMessage', { name: collection.name }),
      confirmLabel: lt('library.confirm.delete'),
      tone: 'danger',
      onConfirm: async () => {
        const nextOrganization = {
          ...libraryOrganization,
          collections: libraryOrganization.collections.filter((item) => item.id !== collection.id)
        };
        updateLibraryOrganization(nextOrganization);
        setLibraryMeta((current) => {
          const next = { ...current };
          Object.entries(next).forEach(([recordId, meta]) => {
            if (meta.collectionIds?.includes(collection.id)) {
              next[recordId] = {
                ...meta,
                collectionIds: meta.collectionIds.filter((id) => id !== collection.id)
              };
            }
          });
          saveLibraryMeta(next);
          return next;
        });
        if (libraryScope.type === 'collection' && libraryScope.id === collection.id) selectLibraryScope({ type: 'all' });
        setCopyMessage(lt('library.message.deletedCollection', { name: collection.name }));
      }
    });
  }

  function renameLibraryOrganizerItem(dialog: LibraryOrganizerDialogState, name: string) {
    if (!dialog.targetId) return;
    const nextOrganization = dialog.type === 'folder'
      ? {
          ...libraryOrganization,
          folders: libraryOrganization.folders.map((folder) => (
            folder.id === dialog.targetId ? { ...folder, name } : folder
          ))
        }
      : {
          ...libraryOrganization,
          collections: libraryOrganization.collections.map((collection) => (
            collection.id === dialog.targetId ? { ...collection, name } : collection
          ))
        };
    updateLibraryOrganization(nextOrganization);
    setCopyMessage(lt('library.message.renamed', { name }));
  }

  function assignRecordsToFolder(recordIds: string[], folderId: string) {
    if (!recordIds.length) return;
    setLibraryMeta((current) => {
      const next = { ...current };
      recordIds.forEach((recordId) => {
        next[recordId] = { ...next[recordId], folderId };
      });
      saveLibraryMeta(next);
      return next;
    });
    setAssignDialog(null);
    setContextMenu(null);
    setCopyMessage(lt('library.message.movedToFolder', { count: recordIds.length }));
  }

  function assignRecordsToCollection(recordIds: string[], collectionId: string) {
    if (!recordIds.length) return;
    setLibraryMeta((current) => {
      const next = { ...current };
      recordIds.forEach((recordId) => {
        const ids = next[recordId]?.collectionIds ?? [];
        next[recordId] = {
          ...next[recordId],
          collectionIds: ids.includes(collectionId) ? ids : [...ids, collectionId]
        };
      });
      saveLibraryMeta(next);
      return next;
    });
    setAssignDialog(null);
    setContextMenu(null);
    setCopyMessage(lt('library.message.addedToCollection', { count: recordIds.length }));
  }

  function removeRecordsFromCurrentScope(recordIds: string[]) {
    if (!recordIds.length || (libraryScope.type !== 'folder' && libraryScope.type !== 'collection')) return;
    setLibraryMeta((current) => {
      const next = { ...current };
      recordIds.forEach((recordId) => {
        const meta = next[recordId] ?? {};
        if (libraryScope.type === 'folder' && meta.folderId === libraryScope.id) {
          next[recordId] = { ...meta, folderId: undefined };
        } else if (libraryScope.type === 'collection' && meta.collectionIds?.includes(libraryScope.id)) {
          next[recordId] = {
            ...meta,
            collectionIds: meta.collectionIds.filter((id) => id !== libraryScope.id)
          };
        }
      });
      saveLibraryMeta(next);
      return next;
    });
    setContextMenu(null);
    setCopyMessage(lt('library.message.removedFromScope', { count: recordIds.length }));
  }

  async function importLibraryFiles() {
    try {
      const result = await importLibraryImagesFromFiles();
      const records = result.records;
      records.forEach(props.onAddResult);
      attachImportedRecordsToCurrentScope(records);
      setCopyMessage(importLibrarySummary(lt('library.message.importFiles'), records.length, result.skippedDuplicates, result.skippedUnsupported));
    } catch (error) {
      setCopyMessage(error instanceof Error ? error.message : String(error));
    }
  }

  async function importLibraryFolder() {
    try {
      const result = await importLibraryImagesFromFolder();
      const records = result.records;
      records.forEach(props.onAddResult);
      attachImportedRecordsToCurrentScope(records);
      setCopyMessage(importLibrarySummary(lt('library.message.importFolder'), records.length, result.skippedDuplicates, result.skippedUnsupported));
    } catch (error) {
      setCopyMessage(error instanceof Error ? error.message : String(error));
    }
  }

  function importLibrarySummary(label: string, imported: number, skippedDuplicates: number, skippedUnsupported: number) {
    if (!imported && !skippedDuplicates && !skippedUnsupported) return lt('library.message.noImport');
    const parts = [lt('library.message.importSummary', { label, count: imported })];
    if (skippedDuplicates) parts.push(lt('library.message.skippedDuplicates', { count: skippedDuplicates }));
    if (skippedUnsupported) parts.push(lt('library.message.skippedUnsupported', { count: skippedUnsupported }));
    return parts.join('，');
  }

  function attachImportedRecordsToCurrentScope(records: GenerationRecord[]) {
    if (!records.length || (libraryScope.type !== 'folder' && libraryScope.type !== 'collection')) return;
    setLibraryMeta((current) => {
      const next = { ...current };
      records.forEach((record) => {
        if (libraryScope.type === 'folder') {
          next[record.id] = { ...next[record.id], folderId: libraryScope.id };
          return;
        }
        const ids = next[record.id]?.collectionIds ?? [];
        next[record.id] = {
          ...next[record.id],
          collectionIds: ids.includes(libraryScope.id) ? ids : [...ids, libraryScope.id]
        };
      });
      saveLibraryMeta(next);
      return next;
    });
  }

  function clearLibraryFilters() {
    setQuery('');
    setProviderFilter('all');
    setStatusFilter('succeeded');
    setModeFilter('all');
    setTimeFilter('all');
    setColorFilter('all');
    setShapeFilter('all');
    setFormatFilter('all');
    setRatingFilter('all');
    setQuickFilters([]);
    setActiveCustomQuickFilterIds([]);
  }

  function toggleQuickFilter(filter: LibraryQuickFilter) {
    if (filter === 'failed') {
      setStatusFilter((current) => (current === 'failed' ? 'succeeded' : 'failed'));
      return;
    }
    setQuickFilters((current) => (
      current.includes(filter)
        ? current.filter((item) => item !== filter)
        : [...current, filter]
    ));
  }

  function currentCustomQuickFilterCriteria(): LibraryCustomQuickFilterCriteria {
    return {
      query: query.trim() || undefined,
      providerFilter,
      statusFilter,
      modeFilter,
      timeFilter,
      colorFilter,
      shapeFilter,
      formatFilter,
      ratingFilter
    };
  }

  function customQuickFilterHasCriteria(criteria: LibraryCustomQuickFilterCriteria) {
    return Boolean(
      criteria.query ||
      criteria.providerFilter !== 'all' ||
      criteria.statusFilter !== 'succeeded' ||
      criteria.modeFilter !== 'all' ||
      criteria.timeFilter !== 'all' ||
      criteria.colorFilter !== 'all' ||
      criteria.shapeFilter !== 'all' ||
      criteria.formatFilter !== 'all' ||
      criteria.ratingFilter !== 'all'
    );
  }

  function addCustomQuickFilter() {
    const criteria = currentCustomQuickFilterCriteria();
    if (!customQuickFilterHasCriteria(criteria)) {
      setCopyMessage(lt('library.message.needFilter'));
      return;
    }
    const label = quickFilterName.trim() || lt('library.quick.placeholder', { count: customQuickFilters.length + 1 });
    const nextFilter: LibraryCustomQuickFilter = {
      id: `custom-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      label,
      criteria,
      createdAt: new Date().toISOString()
    };
    const next = [...customQuickFilters, nextFilter];
    setCustomQuickFilters(next);
    saveLibraryCustomQuickFilters(next);
    setActiveCustomQuickFilterIds((current) => [...current, nextFilter.id]);
    setQuickFilterName('');
    setQuickFilterEditorOpen(false);
    setCopyMessage(lt('library.message.addedQuickFilter', { name: label }));
  }

  function deleteCustomQuickFilter(filterId: string) {
    const next = customQuickFilters.filter((filter) => filter.id !== filterId);
    setCustomQuickFilters(next);
    saveLibraryCustomQuickFilters(next);
    setActiveCustomQuickFilterIds((current) => current.filter((id) => id !== filterId));
    setCopyMessage(lt('library.message.deletedQuickFilter'));
  }

  function toggleCustomQuickFilter(filterId: string) {
    setActiveCustomQuickFilterIds((current) => (
      current.includes(filterId)
        ? current.filter((id) => id !== filterId)
        : [...current, filterId]
    ));
  }

  const gridStyle = { '--library-thumb-scale': thumbnailScale } as CSSProperties;
  const activeFilterCount = [
    providerFilter !== 'all',
    statusFilter !== 'succeeded',
    modeFilter !== 'all',
    timeFilter !== 'all',
    colorFilter !== 'all',
    shapeFilter !== 'all',
    formatFilter !== 'all',
    ratingFilter !== 'all',
    quickFilters.length > 0,
    activeCustomQuickFilterIds.length > 0,
    Boolean(query.trim())
  ].filter(Boolean).length;
  return (
    <>
      <header className="topbar libraryTopbar">
        <div className="pageTitleBlock">
          <p className="eyebrow">Local Library</p>
          <h1>{lt('library.title')}</h1>
          <p>{lt('library.subtitle')}</p>
        </div>
        <div className="statusPills">
          <span><Image size={15} /> {props.isHistoryLoaded ? lt('library.stats.success', { count: successCount }) : lt('library.loading')}</span>
          <span><HardDrive size={15} /> {lt('library.stats.local', { count: localPathCount })}</span>
          <span><Info size={15} /> {lt('library.stats.failed', { count: failedCount })}</span>
        </div>
      </header>

      {filtersVisible ? (
        <section className="libraryInlineFilters" aria-label={lt('library.filter.aria')}>
          <div className="libraryStructuredFilters">
            <label><span>{lt('library.filter.provider')}</span><StudioSelect className="libraryFilterSelect filterIconPlatform" leadingIcon={<Globe2 size={15} />} value={providerFilter} onChange={setProviderFilter} options={providerOptions} /></label>
            <label><span>{lt('library.filter.status')}</span><StudioSelect className="libraryFilterSelect filterIconStatus" leadingIcon={<Info size={15} />} value={statusFilter} onChange={(value) => setStatusFilter(value as 'all' | 'succeeded' | 'failed')} options={statusOptions} /></label>
            <label><span>{lt('library.filter.type')}</span><StudioSelect className="libraryFilterSelect filterIconType" leadingIcon={<Image size={15} />} value={modeFilter} onChange={(value) => setModeFilter(value as typeof modeFilter)} options={modeOptions} /></label>
            <label><span>{lt('library.filter.time')}</span><StudioSelect className="libraryFilterSelect filterIconTime" leadingIcon={<Clock3 size={15} />} value={timeFilter} onChange={(value) => setTimeFilter(value as LibraryTimeFilter)} options={timeOptions} /></label>
            <label className="libraryColorFilter" ref={colorFilterRef}>
              <span>{lt('library.filter.color')}</span>
              <button
                className={`libraryColorFilterButton ${colorMenuOpen ? 'active' : ''}`}
                type="button"
                aria-haspopup="listbox"
                aria-expanded={colorMenuOpen}
                onClick={() => setColorMenuOpen((value) => !value)}
              >
                <span className="libraryColorWheel" />
                <span>{libraryColorLabel(colorFilter) || lt('library.filter.color')}</span>
              </button>
              {colorMenuOpen ? (
                <div className="libraryColorFilterMenu" role="listbox" aria-label={lt('library.filter.colorAria')}>
                  {translatedLibraryColorOptions.map((option) => (
                    <button
                      className={colorFilter === option.value ? 'active' : ''}
                      key={option.value}
                      type="button"
                      role="option"
                      aria-selected={colorFilter === option.value}
                      onClick={() => {
                        setColorFilter(option.value);
                        setColorMenuOpen(false);
                      }}
                    >
                      <span style={{ background: option.color }} />
                      {option.label}
                    </button>
                  ))}
                </div>
              ) : null}
            </label>
            <label><span>{lt('library.filter.shape')}</span><StudioSelect className="libraryFilterSelect filterIconShape" leadingIcon={<Grid2X2 size={15} />} value={shapeFilter} onChange={(value) => setShapeFilter(value as LibraryShapeFilter)} options={translatedLibraryShapeOptions} /></label>
            <label><span>{lt('library.filter.format')}</span><StudioSelect className="libraryFilterSelect filterIconFormat" leadingIcon={<Database size={15} />} value={formatFilter} onChange={(value) => setFormatFilter(value as LibraryFormatFilter)} options={translatedLibraryFormatOptions} /></label>
            <label><span>{lt('library.filter.rating')}</span><StudioSelect className="libraryFilterSelect filterIconRating" leadingIcon={<Star size={15} />} value={ratingFilter} onChange={(value) => setRatingFilter(value as LibraryRatingFilter)} options={translatedLibraryRatingOptions} /></label>
            <button className="miniButton libraryClearFiltersButton" type="button" disabled={!activeFilterCount} onClick={clearLibraryFilters}>
              {activeFilterCount ? lt('library.filter.clearCount', { count: activeFilterCount }) : lt('library.filter.clear')}
            </button>
          </div>
          <div className="libraryQuickFilters" aria-label={lt('library.quick.aria')}>
            {translatedLibraryQuickFilters.map((filter) => {
              const isActive = filter.value === 'failed' ? statusFilter === 'failed' : quickFilters.includes(filter.value);
              return (
                <button
                  className={`libraryQuickFilterChip ${isActive ? 'active' : ''}`}
                  key={filter.value}
                  type="button"
                  onClick={() => toggleQuickFilter(filter.value)}
                >
                  {filter.label}
                </button>
              );
            })}
            {customQuickFilters.map((filter) => {
              const isActive = activeCustomQuickFilterIds.includes(filter.id);
              return (
                <span className={`libraryCustomQuickFilter ${isActive ? 'active' : ''}`} key={filter.id}>
                  <button
                    className="libraryCustomQuickFilterToggle"
                    type="button"
                    onClick={() => toggleCustomQuickFilter(filter.id)}
                    title={filter.label}
                  >
                    {filter.label}
                  </button>
                  <button
                    className="libraryCustomQuickFilterDelete"
                    type="button"
                    aria-label={lt('library.quick.deleteNamed', { name: filter.label })}
                    onClick={(event) => {
                      event.stopPropagation();
                      deleteCustomQuickFilter(filter.id);
                    }}
                  >
                    <X size={12} />
                  </button>
                </span>
              );
            })}
            <div className="libraryQuickFilterAddWrap" ref={quickFilterEditorRef}>
              <button
                className={`libraryQuickFilterAddButton ${quickFilterEditorOpen ? 'active' : ''}`}
                type="button"
                aria-label={lt('library.quick.addAria')}
                aria-haspopup="dialog"
                aria-expanded={quickFilterEditorOpen}
                onClick={() => setQuickFilterEditorOpen((value) => !value)}
              >
                <Plus size={14} />
              </button>
              {quickFilterEditorOpen ? (
                <div className="libraryQuickFilterEditor" role="dialog" aria-label={lt('library.quick.dialogAria')}>
                  <div>
                    <strong>{lt('library.quick.title')}</strong>
                    <span>{lt('library.quick.hint')}</span>
                  </div>
                  <input
                    value={quickFilterName}
                    onChange={(event) => setQuickFilterName(event.target.value)}
                    placeholder={lt('library.quick.placeholder', { count: customQuickFilters.length + 1 })}
                    maxLength={16}
                  />
                  <button className="libraryQuickFilterSave" type="button" onClick={addCustomQuickFilter}>
                    {lt('library.quick.save')}
                  </button>
                  {customQuickFilters.length ? (
                    <div className="libraryQuickFilterManage" aria-label={lt('library.quick.manageAria')}>
                      {customQuickFilters.map((filter) => (
                        <button
                          key={filter.id}
                          type="button"
                          onClick={() => deleteCustomQuickFilter(filter.id)}
                          title={lt('library.quick.deleteTitle', { name: filter.label })}
                        >
                          <span>{filter.label}</span>
                          <X size={12} />
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
          </div>
        </section>
      ) : null}

      {selectedRecords.length > 0 ? (
        <section className="librarySelectionBar" aria-label={lt('library.selection.aria')}>
          <strong>{lt('library.selection.count', { count: selectedRecords.length })}</strong>
          <span>{selectedRecords.length === filteredItems.length ? lt('library.selection.allSelected') : lt('library.selection.resultCount', { count: filteredItems.length })}</span>
          <button className="miniButton" type="button" onClick={selectAllFilteredRecords}>{lt('library.selection.selectAll')}</button>
          <button className="miniButton" type="button" onClick={clearSelection}>{lt('library.selection.clear')}</button>
          <div className="libraryBatchMenuWrap">
            <button className="miniButton" type="button"><MoreHorizontal size={13} /> {lt('library.selection.batch')}</button>
            <div className="libraryQuickMenu libraryBatchMenu" aria-label={lt('library.selection.batch')}>
              <button type="button" onClick={() => setRecordsFavorite(selectedRecordIds, true)}><Star size={13} /> {lt('library.action.addFavorite')}</button>
              <button type="button" onClick={() => setRecordsFavorite(selectedRecordIds, false)}><Star size={13} /> {lt('library.action.removeFavorite')}</button>
              <span className="libraryMenuDivider" />
              <button type="button" onClick={() => void copySelectedPrompts(selectedRecords)}><Copy size={13} /> {lt('library.action.copyPrompt')}</button>
              <button type="button" onClick={() => void copySelectedPaths(selectedRecords)}><Copy size={13} /> {lt('library.action.copyPath')}</button>
              <button type="button" onClick={() => exportSelectedRecordList(selectedRecords)}><Download size={13} /> {lt('library.action.exportList')}</button>
              <span className="libraryMenuDivider" />
              <button type="button" onClick={() => setAssignDialog({ type: 'folder', recordIds: selectedRecordIds })}><FolderOpen size={13} /> {lt('library.action.moveFolder')}</button>
              <button type="button" onClick={() => setAssignDialog({ type: 'collection', recordIds: selectedRecordIds })}><Bookmark size={13} /> {lt('library.action.addCollection')}</button>
              {(libraryScope.type === 'folder' || libraryScope.type === 'collection') ? (
                <button type="button" onClick={() => removeRecordsFromCurrentScope(selectedRecordIds)}><X size={13} /> {lt('library.action.removeCurrentScope')}</button>
              ) : null}
            </div>
          </div>
          <button className="miniButton danger" type="button" onClick={() => void deleteRecords(selectedRecordIds)}><Trash2 size={13} /> {lt('library.action.delete')}</button>
        </section>
      ) : null}

      <section className="libraryWorkspace" aria-label={lt('library.workspace.aria')}>
        {libraryOrganizerOpen ? (
          <button className="libraryOrganizerBackdrop" type="button" aria-label={lt('library.organizer.closeAria')} onClick={() => setLibraryOrganizerOpen(false)} />
        ) : null}
        <aside className={`libraryOrganizer ${libraryOrganizerOpen ? 'open' : ''}`} aria-label={lt('library.organizer.aria')} aria-hidden={!libraryOrganizerOpen}>
          <div className="libraryOrganizerHeader">
            <div>
              <strong>{lt('library.organizer.title')}</strong>
              <span>{selectedScopeTitle}</span>
            </div>
            <button className="iconMiniButton" type="button" data-tooltip={lt('library.action.close')} aria-label={lt('library.organizer.closeAria')} onClick={() => setLibraryOrganizerOpen(false)}><X size={14} /></button>
          </div>
          <div className="libraryOrganizerGroup">
            <button className={libraryScope.type === 'all' ? 'active' : ''} type="button" onClick={() => selectLibraryScope({ type: 'all' })}>
              <Image size={14} /><span>{lt('library.organizer.all')}</span><em>{libraryItems.length}</em>
            </button>
            <button className={libraryScope.type === 'favorites' ? 'active' : ''} type="button" onClick={() => selectLibraryScope({ type: 'favorites' })}>
              <Star size={14} /><span>{lt('library.organizer.favorites')}</span><em>{favoriteScopeCount}</em>
            </button>
            <button className={libraryScope.type === 'recent7d' ? 'active' : ''} type="button" onClick={() => selectLibraryScope({ type: 'recent7d' })}>
              <Clock3 size={14} /><span>{lt('library.organizer.recent7d')}</span><em>{recentScopeCount}</em>
            </button>
            <button className={libraryScope.type === 'recent-viewed' ? 'active' : ''} type="button" onClick={() => selectLibraryScope({ type: 'recent-viewed' })}>
              <Clock3 size={14} /><span>{lt('library.organizer.recentViewed')}</span><em>{recentViewedScopeCount}</em>
            </button>
            <button className={libraryScope.type === 'local' ? 'active' : ''} type="button" onClick={() => selectLibraryScope({ type: 'local' })}>
              <HardDrive size={14} /><span>{lt('library.organizer.local')}</span><em>{localScopeCount}</em>
            </button>
          </div>
          <div className="libraryOrganizerSection">
            <div><strong>{lt('library.organizer.folders')}</strong><button type="button" aria-label={lt('library.organizer.newFolder')} onClick={() => openCreateOrganizerDialog('folder')}><Plus size={13} /></button></div>
            {libraryOrganization.folders.length ? libraryOrganization.folders.map((folder) => (
              <div className="libraryOrganizerItem" key={folder.id}>
                <button className={libraryScope.type === 'folder' && libraryScope.id === folder.id ? 'active' : ''} type="button" onClick={() => selectLibraryScope({ type: 'folder', id: folder.id })}>
                  <span className="libraryFolderDot" style={{ background: folder.color }} /><span>{folder.name}</span><em>{folderCounts.get(folder.id) ?? 0}</em>
                </button>
                <span className="libraryOrganizerItemActions">
                  <button
                    className="libraryOrganizerIconAction"
                    type="button"
                    aria-label={lt('library.organizer.renameFolder', { name: folder.name })}
                    onClick={() => openRenameOrganizerDialog('folder', folder.id, folder.name)}
                  >
                    <Pencil size={12} />
                  </button>
                  <button
                    className="libraryOrganizerDelete"
                    type="button"
                    aria-label={lt('library.organizer.deleteFolder', { name: folder.name })}
                    onClick={() => deleteLibraryFolder(folder)}
                  >
                    <X size={12} />
                  </button>
                </span>
              </div>
            )) : <p>{lt('library.organizer.noFolders')}</p>}
          </div>
          <div className="libraryOrganizerSection">
            <div><strong>{lt('library.organizer.collections')}</strong><button type="button" aria-label={lt('library.organizer.newCollection')} onClick={() => openCreateOrganizerDialog('collection')}><Plus size={13} /></button></div>
            {libraryOrganization.collections.length ? libraryOrganization.collections.map((collection) => (
              <div className="libraryOrganizerItem" key={collection.id}>
                <button className={libraryScope.type === 'collection' && libraryScope.id === collection.id ? 'active' : ''} type="button" onClick={() => selectLibraryScope({ type: 'collection', id: collection.id })}>
                  <Bookmark size={14} /><span>{collection.name}</span><em>{collectionCounts.get(collection.id) ?? 0}</em>
                </button>
                <span className="libraryOrganizerItemActions">
                  <button
                    className="libraryOrganizerIconAction"
                    type="button"
                    aria-label={lt('library.organizer.renameCollection', { name: collection.name })}
                    onClick={() => openRenameOrganizerDialog('collection', collection.id, collection.name)}
                  >
                    <Pencil size={12} />
                  </button>
                  <button
                    className="libraryOrganizerDelete"
                    type="button"
                    aria-label={lt('library.organizer.deleteCollection', { name: collection.name })}
                    onClick={() => deleteLibraryCollection(collection)}
                  >
                    <X size={12} />
                  </button>
                </span>
              </div>
            )) : <p>{lt('library.organizer.noCollections')}</p>}
          </div>
        </aside>

        <div className="libraryContentPane">
          <div className="libraryScopeBar">
            <strong>
              {libraryScope.type === 'favorites' ? <Star size={15} /> :
                libraryScope.type === 'recent7d' ? <Clock3 size={15} /> :
                libraryScope.type === 'recent-viewed' ? <Clock3 size={15} /> :
                libraryScope.type === 'local' ? <HardDrive size={15} /> :
                libraryScope.type === 'folder' ? <FolderOpen size={15} /> :
                libraryScope.type === 'collection' ? <Bookmark size={15} /> :
                <Image size={15} />}
              {selectedScopeTitle}
            </strong>
            <span>{lt('library.count.items', { count: filteredItems.length })}</span>
            {libraryScope.type !== 'all' ? (
              <button className="libraryScopeClearButton" type="button" aria-label={lt('library.organizer.backAll')} onClick={() => selectLibraryScope({ type: 'all' })}>
                <X size={13} />
              </button>
            ) : null}
          </div>

          {!props.isHistoryLoaded ? (
            <div className="emptyState libraryEmpty"><Sparkles size={42} /><h3>{lt('library.empty.loadingTitle')}</h3></div>
          ) : filteredItems.length === 0 ? (
            <div className="emptyState libraryEmpty">
              <Sparkles size={42} />
              <h3>{libraryItems.length === 0 ? lt('library.empty.noImagesTitle') : lt('library.empty.noMatchesTitle')}</h3>
              <p>{libraryItems.length === 0 ? lt('library.empty.noImagesHint') : lt('library.empty.noMatchesHint')}</p>
            </div>
          ) : (
            <section className={`libraryGrid libraryGridV2 view-${viewMode} ${displaySettings.compact ? 'compact' : ''}`} style={gridStyle}>
              {visibleLibraryItems.map((result) => (
                <LibraryRecordCard
                  key={result.id}
                  t={props.t}
                  record={result}
                  thumbnail={result.localImagePaths?.[0] ? libraryThumbnails[result.localImagePaths[0]] : undefined}
                  thumbnailPending={Boolean(
                    isTauriRuntime()
                    && result.localImagePaths?.[0]
                    && !libraryThumbnails[result.localImagePaths[0]]
                  )}
                  providerName={providerNameMap.get(result.providerId) ?? result.providerName ?? result.providerId}
                  meta={libraryMeta[result.id]}
                  isSelected={selectedIdSet.has(result.id)}
                  viewMode={viewMode}
                  displaySettings={displaySettings}
                  isCurrentScopeRemovable={libraryScope.type === 'folder' || libraryScope.type === 'collection'}
                  onSelect={handleSelectRecord}
                  onOpenContextMenu={handleOpenLibraryContextMenu}
                  onPreview={handlePreviewRecord}
                  onAnalyzeColors={handleAnalyzeRecordColors}
                  onToggleFavorite={handleToggleFavorite}
                  onOpenDetails={handleOpenRecordDetails}
                  onOpenDiagnostics={handleOpenRecordDiagnostics}
                  onUseAsReference={handleUseRecordAsReference}
                  onCopyPrompt={handleCopyRecordPrompt}
                  onCopyPath={handleCopyRecordPath}
                  onExportRecord={handleExportRecord}
                  onAssignFolder={handleAssignRecordFolder}
                  onAssignCollection={handleAssignRecordCollection}
                  onRemoveFromCurrentScope={handleRemoveRecordFromCurrentScope}
                  onDelete={handleDeleteRecord}
                />
              ))}
            </section>
          )}
          {props.isHistoryLoaded && canRenderMoreLibraryItems ? (
            <div className="libraryLoadMore">
              <button
                ref={loadMoreRef}
                type="button"
                onClick={() => setRenderedItemCount((current) => Math.min(current + LIBRARY_RENDER_BATCH_SIZE, filteredItems.length))}
              >
                {lt('library.performance.loadMore', { shown: visibleLibraryItems.length, total: filteredItems.length })}
              </button>
              <span>{lt('library.performance.loadedHint', { shown: visibleLibraryItems.length, total: filteredItems.length })}</span>
            </div>
          ) : null}
        </div>
      </section>

      {contextMenu && contextSelection.length > 0 ? (
        <div
          className="libraryContextMenu"
          role="menu"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onPointerDown={(event) => event.stopPropagation()}
          onContextMenu={(event) => event.preventDefault()}
        >
          <div className="libraryContextMenuHeader">
            <strong>{contextSelection.length > 1 ? lt('library.context.selected', { count: contextSelection.length }) : lt('library.context.imageActions')}</strong>
            <button className="iconMiniButton" type="button" data-tooltip={lt('library.action.close')} aria-label={lt('library.action.close')} onClick={() => setContextMenu(null)}><X size={13} /></button>
          </div>
          {contextSelection.length === 1 ? (
            <>
              <button type="button" role="menuitem" onClick={() => openContextDetails(contextSelection)}>
                <Info size={13} /> {lt('library.action.openDetails')}
              </button>
              {contextSelection[0]?.error || contextSelection[0]?.status === 'failed' ? (
                <button type="button" role="menuitem" onClick={() => openContextDiagnostics(contextSelection)}>
                  <Gauge size={13} /> {lt('library.action.viewDiagnostics')}
                </button>
              ) : null}
              <button type="button" role="menuitem" disabled={!contextSelection[0]?.imageUrls[0]} onClick={() => useContextRecordAsReference(contextSelection)}>
                <ImagePlus size={13} /> {lt('library.action.setReference')}
              </button>
            </>
          ) : null}
          <button type="button" role="menuitem" onClick={() => void copySelectedPrompts(contextSelection)}>
            <Copy size={13} /> {lt('library.action.copyPrompt')}
          </button>
          <button type="button" role="menuitem" onClick={() => void copySelectedPaths(contextSelection)}>
            <Copy size={13} /> {lt('library.action.copyPath')}
          </button>
          <button type="button" role="menuitem" onClick={() => exportSelectedRecordList(contextSelection)}>
            <Download size={13} /> {lt('library.action.exportList')}
          </button>
          <span className="libraryMenuDivider" />
          <button type="button" role="menuitem" onClick={() => setAssignDialog({ type: 'folder', recordIds: contextSelection.map((record) => record.id) })}>
            <FolderOpen size={13} /> {lt('library.action.moveFolder')}
          </button>
          <button type="button" role="menuitem" onClick={() => setAssignDialog({ type: 'collection', recordIds: contextSelection.map((record) => record.id) })}>
            <Bookmark size={13} /> {lt('library.action.addCollection')}
          </button>
          {(libraryScope.type === 'folder' || libraryScope.type === 'collection') ? (
            <button type="button" role="menuitem" onClick={() => removeRecordsFromCurrentScope(contextSelection.map((record) => record.id))}>
              <X size={13} /> {lt('library.action.removeCurrentScope')}
            </button>
          ) : null}
          <span className="libraryMenuDivider" />
          {contextSelection.length === 1 ? (
            <button type="button" role="menuitem" onClick={() => setRecordsFavorite(contextSelection.map((record) => record.id), !libraryMeta[contextSelection[0].id]?.favorite)}>
              <Star size={13} /> {libraryMeta[contextSelection[0].id]?.favorite ? lt('library.action.removeFavorite') : lt('library.action.addFavorite')}
            </button>
          ) : (
            <>
              <button type="button" role="menuitem" onClick={() => setRecordsFavorite(contextSelection.map((record) => record.id), true)}>
                <Star size={13} /> {lt('library.action.addFavorite')}
              </button>
              <button type="button" role="menuitem" onClick={() => setRecordsFavorite(contextSelection.map((record) => record.id), false)}>
                <Star size={13} /> {lt('library.action.removeFavorite')}
              </button>
            </>
          )}
          <button className="dangerAction" type="button" role="menuitem" onClick={() => void deleteRecords(contextSelection.map((record) => record.id))}>
            <Trash2 size={13} /> {contextSelection.length > 1 ? lt('library.action.deleteSelected') : lt('library.action.deleteRecord')}
          </button>
        </div>
      ) : null}

      {organizerDialog ? (
        <LibraryOrganizerDialog
          t={props.t}
          type={organizerDialog.type}
          mode={organizerDialog.mode}
          defaultName={organizerDialog.defaultName}
          selectedCount={selectedRecordIds.length}
          onClose={() => setOrganizerDialog(null)}
          onSubmit={(name) => {
            if (organizerDialog.mode === 'rename') renameLibraryOrganizerItem(organizerDialog, name);
            else if (organizerDialog.type === 'folder') createLibraryFolder(name);
            else createLibraryCollection(name);
            setOrganizerDialog(null);
          }}
        />
      ) : null}

      {assignDialog ? (
        <LibraryAssignDialog
          t={props.t}
          type={assignDialog.type}
          recordCount={assignDialog.recordIds.length}
          assignedIds={
            assignDialog.type === 'folder'
              ? Array.from(new Set(assignDialog.recordIds.map((recordId) => libraryMeta[recordId]?.folderId).filter((id): id is string => Boolean(id))))
              : Array.from(new Set(assignDialog.recordIds.flatMap((recordId) => libraryMeta[recordId]?.collectionIds ?? [])))
          }
          folders={libraryOrganization.folders}
          collections={libraryOrganization.collections}
          onClose={() => setAssignDialog(null)}
          onCreate={() => {
            setAssignDialog(null);
            openCreateOrganizerDialog(assignDialog.type);
          }}
          onSelect={(targetId) => {
            if (assignDialog.type === 'folder') assignRecordsToFolder(assignDialog.recordIds, targetId);
            else assignRecordsToCollection(assignDialog.recordIds, targetId);
          }}
        />
      ) : null}

      <section ref={dockRef} className={`libraryFloatingDock ${searchVisible ? '' : 'collapsed'}`}>
        {activePanel ? (
          <div className={`libraryDockPanel dockPanel-${activePanel} ${activePanel === 'add' ? 'dockAlignEnd' : 'dockAlignStart'}`}>
            <div className="libraryDockPanelHeader">
              <strong>
                {activePanel === 'main' ? lt('library.dock.menuTitle') : activePanel === 'view' ? lt('library.dock.viewTitle') : activePanel === 'display' ? lt('library.dock.displayTitle') : activePanel === 'sort' ? lt('library.dock.sortTitle') : lt('library.dock.addTitle')}
              </strong>
              <button
                className="iconMiniButton"
                type="button"
                data-tooltip={isDockSubPanel ? lt('library.dock.backMenu') : lt('library.dock.closePanel')}
                aria-label={isDockSubPanel ? lt('library.dock.backMenu') : lt('library.dock.closePanel')}
                onClick={() => setActivePanel(isDockSubPanel ? 'main' : null)}
              >
                {isDockSubPanel ? <Sidebar size={14} /> : <X size={14} />}
              </button>
            </div>
            {activePanel === 'main' ? (
              <div className="libraryMainMenuGrid">
                <button type="button" onClick={() => setSearchVisible((value) => !value)}>
                  <Sidebar size={15} />
                  <span>{searchVisible ? lt('library.dock.hideSearch') : lt('library.dock.showSearch')}</span>
                </button>
                <button type="button" onClick={() => setFiltersVisible((value) => !value)}>
                  <SlidersHorizontal size={15} />
                  <span>{filtersVisible ? lt('library.dock.hideFilters') : lt('library.dock.showFilters')}{activeFilterCount ? ` (${activeFilterCount})` : ''}</span>
                </button>
                <button className="menuHasChild" type="button" onClick={() => setActivePanel('view')}>
                  <Grid2X2 size={15} />
                  <span>{lt('library.dock.viewTitle')}</span>
                  <ChevronRight className="menuChevron" size={14} />
                </button>
                <button className="menuHasChild" type="button" onClick={() => setActivePanel('display')}>
                  <Settings size={15} />
                  <span>{lt('library.dock.displayTitle')}</span>
                  <ChevronRight className="menuChevron" size={14} />
                </button>
                <button className="menuHasChild" type="button" onClick={() => setActivePanel('sort')}>
                  <Clock3 size={15} />
                  <span>{lt('library.dock.sortTitle')}</span>
                  <ChevronRight className="menuChevron" size={14} />
                </button>
                <button type="button" onClick={() => setThumbnailScale((value) => Math.min(1.28, Number((value + 0.08).toFixed(2))))}>
                  <ZoomIn size={15} />
                  <span>{lt('library.dock.zoomIn')}</span>
                </button>
                <button type="button" onClick={() => setThumbnailScale((value) => Math.max(0.78, Number((value - 0.08).toFixed(2))))}>
                  <ZoomOut size={15} />
                  <span>{lt('library.dock.zoomOut')}</span>
                </button>
              </div>
            ) : null}
            {activePanel === 'view' ? (
              <div className="librarySegmentGrid">
                {translatedLibraryViewOptions.map((option) => (
                  <button className={viewMode === option.value ? 'active' : ''} key={option.value} type="button" onClick={() => setViewMode(option.value)}>{option.label}</button>
                ))}
                <button type="button" onClick={() => setThumbnailScale((value) => Math.min(1.28, Number((value + 0.08).toFixed(2))))}><ZoomIn size={14} /> {lt('library.dock.zoomIn')}</button>
                <button type="button" onClick={() => setThumbnailScale((value) => Math.max(0.78, Number((value - 0.08).toFixed(2))))}><ZoomOut size={14} /> {lt('library.dock.zoomOut')}</button>
              </div>
            ) : null}
            {activePanel === 'display' ? (
              <div className="libraryDisplayList">
                <label><input type="checkbox" checked={displaySettings.showPrompt} onChange={(event) => updateDisplaySettings({ showPrompt: event.target.checked })} /> {lt('library.display.showPrompt')}</label>
                <label><input type="checkbox" checked={displaySettings.showProvider} onChange={(event) => updateDisplaySettings({ showProvider: event.target.checked })} /> {lt('library.display.showProvider')}</label>
                <label><input type="checkbox" checked={displaySettings.showModel} onChange={(event) => updateDisplaySettings({ showModel: event.target.checked })} /> {lt('library.display.showModel')}</label>
                <label><input type="checkbox" checked={displaySettings.showReferenceBadge} onChange={(event) => updateDisplaySettings({ showReferenceBadge: event.target.checked })} /> {lt('library.display.showReferenceBadge')}</label>
                <label><input type="checkbox" checked={displaySettings.compact} onChange={(event) => updateDisplaySettings({ compact: event.target.checked })} /> {lt('library.display.compact')}</label>
              </div>
            ) : null}
            {activePanel === 'sort' ? (
              <div className="librarySegmentGrid">
                {translatedLibrarySortOptions.map((option) => (
                  <button className={sortMode === option.value ? 'active' : ''} key={option.value} type="button" onClick={() => setSortMode(option.value)}>{option.label}</button>
                ))}
              </div>
            ) : null}
            {activePanel === 'add' ? (
              <div className="libraryAddList">
                {translatedLibraryAddActions.map((action) => (
                  <button key={action.id} type="button" onClick={() => handleAddAction(action.id)}>
                    {action.id === 'folder' ? <FolderOpen size={15} /> : action.id === 'collection' ? <Bookmark size={15} /> : action.id === 'import-file' ? <Upload size={15} /> : <Database size={15} />}
                    <span>{action.label}</span>
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        ) : null}
        <div className="libraryDockBar">
          <button className={`libraryDockIcon ${libraryOrganizerOpen ? 'active' : ''}`} type="button" data-tooltip={lt('library.dock.organizer')} aria-label={lt('library.organizer.aria')} onClick={() => setLibraryOrganizerOpen((value) => !value)}>
            <FolderOpen size={18} />
          </button>
          <button className="libraryDockIcon" type="button" data-tooltip={lt('library.dock.menu')} aria-label={lt('library.dock.menu')} onClick={() => setActivePanel((panel) => panel === 'main' ? null : 'main')}>
            <SlidersHorizontal size={18} />{activeFilterCount ? <span>{activeFilterCount}</span> : null}
          </button>
          {searchVisible ? (
            <label className="libraryDockSearch">
              <input ref={searchInputRef} value={query} onChange={(event) => setQuery(event.target.value)} placeholder={lt('library.search.placeholder')} />
            </label>
          ) : (
            <button className="libraryDockRestore" type="button" onClick={() => setSearchVisible(true)}>{lt('library.dock.showSearch')}</button>
          )}
          <button className="libraryDockAdd" type="button" data-tooltip={lt('library.dock.addTitle')} aria-label={lt('library.dock.addTitle')} onClick={() => setActivePanel((panel) => panel === 'add' ? null : 'add')}><Plus size={19} /></button>
        </div>
      </section>

      {selectedRecord ? (
        <>
          <button
            className="libraryDetailBackdrop"
            type="button"
            aria-label={lt('library.detail.closeAria')}
            onClick={() => setSelectedRecordId(null)}
          />
          <aside className="libraryDetailDrawer" aria-label={lt('library.detail.aria')}>
            <div className="libraryDetailHeader">
              <div className="libraryDetailTitle">
                <p className="eyebrow">Image Details</p>
                <h2>{libraryMeta[selectedRecord.id]?.favorite ? lt('library.detail.favoriteTitle') : lt('library.detail.title')}</h2>
                <small title={selectedRecordFileName}>{selectedRecordFileName}</small>
              </div>
              <div className="libraryDetailHeaderActions">
                <button className="iconMiniButton" type="button" data-tooltip={lt('library.detail.close')} aria-label={lt('library.detail.close')} onClick={() => setSelectedRecordId(null)}><X size={15} /></button>
              </div>
            </div>
            {selectedRecord.imageUrls[0] ? (
              <div className="libraryDetailPreview">
                <button className="libraryDetailPreviewImageButton" type="button" onClick={() => props.onPreview(selectedRecord.imageUrls[0])}>
                  <img
                    src={selectedRecord.imageUrls[0]}
                    alt={selectedRecord.prompt}
                    decoding="async"
                    onLoad={(event) => analyzeRecordColors(selectedRecord.id, event.currentTarget)}
                  />
                </button>
                <div className="libraryRatingControl" aria-label={lt('library.detail.ratingAria')}>
                  {libraryRatingValues.map((rating) => (
                    <button
                      className={(selectedRecordMeta?.rating ?? 0) >= rating ? 'active' : ''}
                      key={rating}
                      type="button"
                      aria-label={lt('library.detail.ratingStar', { count: rating })}
                      title={lt('library.detail.ratingStar', { count: rating })}
                      onClick={() => setRecordRating(selectedRecord.id, rating)}
                    >
                      <Star size={15} fill={(selectedRecordMeta?.rating ?? 0) >= rating ? 'currentColor' : 'none'} />
                    </button>
                  ))}
                </div>
                <span className="libraryDetailImageMetaOverlay" aria-label={lt('library.detail.imageInfo')}>
                  {selectedRecordDetailMeta.map((item, index) => (
                    <span key={`${item}-${index}`}>{item}</span>
                  ))}
                </span>
              </div>
            ) : (
              <div className="libraryDetailMissing">{lt('library.detail.noPreview')}</div>
            )}
            <div className="libraryDetailColorSection">
              <span>{lt('library.detail.primaryColor')}</span>
              {selectedRecordMeta?.colorPalette?.length ? (
                <div className="libraryAutoColorPalette" aria-label={lt('library.detail.paletteAria')}>
                  {selectedRecordMeta.colorPalette.map((color) => (
                    <span key={color} title={color} style={{ background: color }} />
                  ))}
                </div>
              ) : (
                <small>{selectedRecordMeta?.colorAnalysisFailed ? lt('library.detail.unrecognized') : lt('library.detail.analyzing')}</small>
              )}
            </div>
            <div className="libraryDetailSection promptDetailSection">
              <div className="libraryPromptHeader">
                <strong>Prompt</strong>
                <button className="miniButton libraryPromptCopyButton" type="button" onClick={() => void copyText('Prompt', selectedRecord.prompt)}>
                  <Copy size={12} /> {lt('library.action.copy')}
                </button>
              </div>
              <p>{selectedRecord.prompt}</p>
            </div>
            <div className="libraryDetailOrganizerSection">
              <div className="libraryDetailOrganizerHeader">
                <div className="libraryDetailOrganizerTitleLine">
                  <strong>{lt('library.detail.organize')}</strong>
                  <div className="libraryDetailOrganizerChips">
                    {selectedRecordFolder ? (
                      <button type="button" onClick={() => {
                        selectLibraryScope({ type: 'folder', id: selectedRecordFolder.id });
                        setSelectedRecordId(null);
                      }}>
                        <span className="libraryFolderDot" style={{ background: selectedRecordFolder.color }} />
                        <span>{selectedRecordFolder.name}</span>
                      </button>
                    ) : (
                      <span><FolderOpen size={13} /> {lt('library.detail.noFolder')}</span>
                    )}
                    {selectedRecordCollections.length ? selectedRecordCollections.map((collection) => (
                      <button key={collection.id} type="button" onClick={() => {
                        selectLibraryScope({ type: 'collection', id: collection.id });
                        setSelectedRecordId(null);
                      }}>
                        <Bookmark size={13} />
                        <span>{collection.name}</span>
                      </button>
                    )) : (
                      <span><Bookmark size={13} /> {lt('library.detail.noCollection')}</span>
                    )}
                  </div>
                </div>
                <div className="libraryDetailOrganizerActions">
                  <button className="iconMiniButton" type="button" data-tooltip={lt('library.action.moveFolder')} aria-label={lt('library.action.moveFolder')} onClick={() => setAssignDialog({ type: 'folder', recordIds: [selectedRecord.id] })}><FolderOpen size={14} /></button>
                  <button className="iconMiniButton" type="button" data-tooltip={lt('library.action.addCollection')} aria-label={lt('library.action.addCollection')} onClick={() => setAssignDialog({ type: 'collection', recordIds: [selectedRecord.id] })}><Bookmark size={14} /></button>
                  {(libraryScope.type === 'folder' || libraryScope.type === 'collection') ? (
                    <button className="iconMiniButton" type="button" data-tooltip={lt('library.action.removeCurrentScope')} aria-label={lt('library.action.removeCurrentScope')} onClick={() => removeRecordsFromCurrentScope([selectedRecord.id])}><X size={14} /></button>
                  ) : null}
                </div>
              </div>
            </div>
            {selectedRecordRecoveryAdviceText ? (
              <div className="libraryDetailSection libraryRecoveryAdvicePanel">
                <div className="generationDiagnosticHeader">
                  <div>
                    <span>{lt('library.detail.recoveryAdvice')}</span>
                    <strong>{selectedRecordRecoveryAdviceText.title}</strong>
                  </div>
                </div>
                <p>{selectedRecordRecoveryAdviceText.summary}</p>
                <ul className="generationErrorActionsList libraryErrorActionsList">
                  {selectedRecordRecoveryAdviceText.actions.map((action) => <li key={action}>{action}</li>)}
                </ul>
              </div>
            ) : null}
            <div className="libraryDetailActions">
              <button className={`miniButton ${libraryMeta[selectedRecord.id]?.favorite ? 'active' : ''}`} type="button" onClick={() => toggleFavorite(selectedRecord.id)}><Star size={13} /> {libraryMeta[selectedRecord.id]?.favorite ? lt('library.action.favorited') : lt('library.action.favorite')}</button>
              <button className="miniButton" type="button" disabled={!selectedRecord.imageUrls[0]} onClick={() => useRecordAsReference(selectedRecord)}><ImagePlus size={13} /> {lt('library.action.setReference')}</button>
              <button className="miniButton" type="button" onClick={() => props.onRetryRecord(selectedRecord)}><RefreshCcw size={13} /> {lt('library.action.retry')}</button>
              {selectedRecord.error || selectedRecord.status === 'failed' ? (
                <button className="miniButton" type="button" onClick={() => openRecordDiagnostics(selectedRecord)}><Gauge size={13} /> {lt('library.action.viewDiagnostics')}</button>
              ) : null}
              <button className="miniButton" type="button" disabled={!getRecordPrimaryPath(selectedRecord)} onClick={() => void copyText('Path', getRecordPrimaryPath(selectedRecord))}><Copy size={13} /> {lt('library.action.path')}</button>
              <button className="miniButton" type="button" disabled={!getRecordRevealPath(selectedRecord)} onClick={() => {
                const path = getRecordRevealPath(selectedRecord);
                if (path) void revealGenerationFile(path);
              }}><FolderOpen size={13} /> {lt('library.action.folder')}</button>
              <button className="miniButton danger" type="button" onClick={() => void deleteRecord(selectedRecord.id)}><Trash2 size={13} /> {lt('library.action.deleteRecord')}</button>
            </div>
            {selectedRecord.referenceImages?.length ? (
              <div
                className="libraryDetailSection libraryReferenceDetailSection"
                style={{ '--reference-detail-list-max-height': `${Math.min(selectedRecord.referenceImages.length * 92 - 10, 358)}px` } as CSSProperties}
              >
                <strong>{lt('library.detail.references')}</strong>
                <div className="libraryReferenceDetailList">
                  {selectedRecord.referenceImages.map((reference, index) => {
                    const previewUrl = getReferencePreviewUrl(reference);
                    return (
                      <article className="libraryReferenceDetailItem" key={reference.id || `${reference.source}-${index}`}>
                        <button
                          className="libraryReferenceDetailThumb"
                          type="button"
                          disabled={!previewUrl}
                          onClick={() => previewUrl && props.onPreview(previewUrl)}
                        >
                          {previewUrl ? <img src={previewUrl} alt={reference.name ?? lt('library.detail.referenceAlt', { index: index + 1 })} /> : <ImagePlus size={16} />}
                        </button>
                        <div>
                          <strong>{reference.name || lt('library.detail.referenceName', { index: index + 1 })}</strong>
                          <span>{libraryReferenceSourceLabel(reference.source)} · {libraryReferenceRoleLabel(reference.role)}</span>
                          {reference.localPath ? <small title={reference.localPath}>{reference.localPath}</small> : null}
                          {reference.sourceGenerationId ? <small>{lt('library.detail.sourceRecord', { id: reference.sourceGenerationId })}</small> : null}
                        </div>
                      </article>
                    );
                  })}
                </div>
              </div>
            ) : null}
          </aside>
        </>
      ) : null}
      {diagnosticRecord && diagnosticRecordFailureDiagnosis ? (
        <>
          <button
            className="libraryDetailBackdrop"
            type="button"
            aria-label={lt('library.diagnostic.closeAria')}
            onClick={() => setDiagnosticRecordId(null)}
          />
          <aside className="libraryDetailDrawer libraryDiagnosticDrawer" aria-label={lt('library.diagnostic.aria')}>
            <div className="libraryDetailHeader">
              <div className="libraryDetailTitle">
                <p className="eyebrow">Error Diagnostics</p>
                <h2>{lt('library.diagnostic.title')}</h2>
                <small title={getRecordFileName(diagnosticRecord) || diagnosticRecord.id}>{getRecordFileName(diagnosticRecord) || diagnosticRecord.id}</small>
              </div>
              <div className="libraryDetailHeaderActions">
                <button className="iconMiniButton" type="button" data-tooltip={lt('library.diagnostic.viewDetails')} aria-label={lt('library.diagnostic.viewDetails')} onClick={() => openRecordDetails(diagnosticRecord)}><Info size={15} /></button>
                <button className="iconMiniButton" type="button" data-tooltip={lt('library.diagnostic.close')} aria-label={lt('library.diagnostic.close')} onClick={() => setDiagnosticRecordId(null)}><X size={15} /></button>
              </div>
            </div>
            <div className={`libraryDetailSection warning generationDiagnosticPanel severity-${diagnosticRecordFailureDiagnosis.severity}`}>
              <div className="generationDiagnosticHeader">
                <div>
                  <span>{lt('library.diagnostic.report')}</span>
                  <strong>{diagnosticRecordFailureDiagnosis.title}</strong>
                </div>
                <em>{libraryFailureCategoryLabel(diagnosticRecordFailureDiagnosis.category)} · {libraryFailureSeverityLabel(diagnosticRecordFailureDiagnosis.severity)}</em>
              </div>
              <p>{diagnosticRecordFailureDiagnosis.summary}</p>
              <div className="generationDiagnosisChips" aria-label={lt('library.diagnostic.paramsAria')}>
                <span>{lt('library.diagnostic.status', { status: libraryGenerationStatusLabel(diagnosticRecord) })}</span>
                <span>{lt('library.diagnostic.provider', { provider: diagnosticRecordProviderName })}</span>
                <span>{lt('library.diagnostic.model', { model: diagnosticRecord.modelId || '-' })}</span>
                {diagnosticRecordFailureDetails.map((detail) => <span key={detail}>{detail}</span>)}
              </div>
              {diagnosticRecordFailureDiagnosis.isPotentialBackgroundCompletion ? (
                <div className="generationBackgroundNotice">
                  <Clock3 size={14} />
                  <span>{lt('library.diagnostic.backgroundNotice')}</span>
                </div>
              ) : null}
              {diagnosticRecordFailureDiagnosis.isPotentialBackgroundCompletion ? (
                <div className="generationRecoveryCallout">
                  <div>
                    <strong>{lt('library.diagnostic.recheckTitle')}</strong>
                    <span>{lt('library.diagnostic.recheckHint')}</span>
                  </div>
                  <button
                    className="miniButton"
                    type="button"
                    disabled={recheckingRecordId === diagnosticRecord.id}
                    onClick={() => void recheckDiagnosticRecord(diagnosticRecord)}
                  >
                    <RefreshCcw size={13} /> {recheckingRecordId === diagnosticRecord.id ? lt('library.diagnostic.rechecking') : lt('library.diagnostic.recheck')}
                  </button>
                </div>
              ) : null}
              {diagnosticRecordRecoveryAdviceText ? (
                <div className="generationDiagnosticBlock libraryRecoveryAdvicePanel compact">
                  <strong>{diagnosticRecordRecoveryAdviceText.title}</strong>
                  <p>{diagnosticRecordRecoveryAdviceText.summary}</p>
                  <ul className="generationErrorActionsList libraryErrorActionsList">
                    {diagnosticRecordRecoveryAdviceText.actions.map((action) => <li key={action}>{action}</li>)}
                  </ul>
                </div>
              ) : null}
              <div className="generationDiagnosticBlock">
                <strong>{lt('library.diagnostic.actions')}</strong>
                <ul className="generationErrorActionsList libraryErrorActionsList">
                  {diagnosticRecordFailureActions.map((action) => <li key={action}>{action}</li>)}
                </ul>
              </div>
              {diagnosticRecordFailureRawText ? (
                <details className="generationRawDetails">
                  <summary>{lt('library.diagnostic.rawSummary')}</summary>
                  <pre>{clipDiagnosticText(diagnosticRecordFailureRawText)}</pre>
                </details>
              ) : null}
              <div className="libraryDetailInlineActions generationDiagnosticActions">
                <button className="miniButton" type="button" onClick={() => props.onRetryRecord(diagnosticRecord)}><RefreshCcw size={13} /> {lt('library.action.retry')}</button>
                <button className="miniButton" type="button" onClick={() => void copyText(lt('library.diagnostic.title'), generationFailureCopyText(diagnosticRecord, diagnosticRecordProviderName, lt))}><Copy size={13} /> {lt('library.diagnostic.copyDiagnosis')}</button>
                <button className="miniButton" type="button" onClick={() => void copyText(lt('library.diagnostic.copyRequest'), generationRequestSummaryCopyText(diagnosticRecord, diagnosticRecordProviderName, lt))}><Copy size={13} /> {lt('library.diagnostic.copyRequest')}</button>
                <button className="miniButton" type="button" disabled={!diagnosticRecordFailureRawText} onClick={() => void copyText('Raw', diagnosticRecordFailureRawText)}><Database size={13} /> {lt('library.diagnostic.copyRaw')}</button>
              </div>
            </div>
          </aside>
        </>
      ) : null}
    </>
  );
});

function LibraryOrganizerDialog(props: {
  t: Translator;
  type: 'folder' | 'collection';
  mode: 'create' | 'rename';
  defaultName: string;
  selectedCount: number;
  onClose: () => void;
  onSubmit: (name: string) => void;
}) {
  const dt = (key: string, params?: Record<string, string | number>) => props.t(key as Parameters<Translator>[0], params);
  const [name, setName] = useState(props.defaultName);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const title = props.mode === 'rename'
    ? props.type === 'folder' ? dt('library.dialog.renameFolder') : dt('library.dialog.renameCollection')
    : props.type === 'folder' ? dt('library.dialog.newFolder') : dt('library.dialog.newCollection');
  const hint = props.mode === 'rename'
    ? dt('library.dialog.renameHint')
    : props.selectedCount
    ? dt('library.dialog.createSelectedHint', { count: props.selectedCount })
    : props.type === 'folder'
      ? dt('library.dialog.folderHint')
      : dt('library.dialog.collectionHint');

  useEffect(() => {
    window.setTimeout(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    }, 0);
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') props.onClose();
    }
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [props.onClose]);

  function submit() {
    const trimmed = name.trim();
    if (!trimmed) return;
    props.onSubmit(trimmed);
  }

  return (
    <div className="modalBackdrop organizerDialogBackdrop" onClick={props.onClose}>
      <section className="organizerDialog" role="dialog" aria-modal="true" aria-labelledby="organizer-dialog-title" onClick={(event) => event.stopPropagation()}>
        <header>
          <div>
            <p className="eyebrow">{dt('library.dialog.eyebrow')}</p>
            <h2 id="organizer-dialog-title">{title}</h2>
          </div>
          <button className="iconMiniButton" type="button" data-tooltip={dt('library.action.close')} aria-label={dt('library.action.close')} onClick={props.onClose}><X size={15} /></button>
        </header>
        <label>
          <span>{dt('library.dialog.name')}</span>
          <input
            ref={inputRef}
            value={name}
            maxLength={24}
            onChange={(event) => setName(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                submit();
              }
            }}
          />
        </label>
        <p>{hint}</p>
        <div className="organizerDialogActions">
          <button type="button" className="confirmCancelButton" onClick={props.onClose}>{dt('library.dialog.cancel')}</button>
          <button type="button" className="confirmPrimaryButton" disabled={!name.trim()} onClick={submit}>{props.mode === 'rename' ? dt('library.dialog.save') : dt('library.dialog.create')}</button>
        </div>
      </section>
    </div>
  );
}

function LibraryAssignDialog(props: {
  t: Translator;
  type: 'folder' | 'collection';
  recordCount: number;
  assignedIds: string[];
  folders: LibraryFolder[];
  collections: LibraryCollection[];
  onClose: () => void;
  onCreate: () => void;
  onSelect: (targetId: string) => void;
}) {
  const dt = (key: string, params?: Record<string, string | number>) => props.t(key as Parameters<Translator>[0], params);
  const items: Array<{ id: string; name: string; color?: string }> = props.type === 'folder'
    ? props.folders.map((folder) => ({ id: folder.id, name: folder.name, color: folder.color }))
    : props.collections.map((collection) => ({ id: collection.id, name: collection.name }));
  const title = props.type === 'folder' ? dt('library.dialog.assignFolder') : dt('library.dialog.assignCollection');
  const emptyText = props.type === 'folder' ? dt('library.organizer.noFolders') : dt('library.organizer.noCollections');

  useEffect(() => {
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') props.onClose();
    }
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [props.onClose]);

  return (
    <div className="modalBackdrop organizerDialogBackdrop" onClick={props.onClose}>
      <section className="assignDialog" role="dialog" aria-modal="true" aria-label={title} onClick={(event) => event.stopPropagation()}>
        <header>
          <div>
            <p className="eyebrow">{dt('library.dialog.eyebrow')}</p>
            <h2>{title}</h2>
            <span>{dt('library.count.items', { count: props.recordCount })}</span>
          </div>
          <button className="iconMiniButton" type="button" data-tooltip={dt('library.action.close')} aria-label={dt('library.action.close')} onClick={props.onClose}><X size={15} /></button>
        </header>
        <div className="assignDialogList">
          {items.length ? items.map((item) => {
            const isAssigned = props.assignedIds.includes(item.id);
            const disabled = isAssigned && props.recordCount === 1;
            return (
            <button className={isAssigned ? 'assigned' : ''} key={item.id} type="button" disabled={disabled} onClick={() => props.onSelect(item.id)}>
              {props.type === 'folder'
                ? <span className="libraryFolderDot" style={{ background: item.color ?? libraryFolderColors[0] }} />
                : <Bookmark size={14} />}
              <span>{item.name}</span>
              {isAssigned ? <em>{props.recordCount === 1 ? dt('library.dialog.alreadyHere') : dt('library.dialog.partlyHere')}</em> : null}
            </button>
            );
          }) : (
            <p>{emptyText}</p>
          )}
        </div>
        <button className="assignDialogCreate" type="button" onClick={props.onCreate}>
          <Plus size={14} /> {props.type === 'folder' ? dt('library.dialog.newFolder') : dt('library.dialog.newCollection')}
        </button>
      </section>
    </div>
  );
}
