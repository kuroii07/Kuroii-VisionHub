import {
  Copy,
  ExternalLink,
  FolderOpen,
  Gift,
  Globe2,
  Grid2X2,
  Info,
  Layers,
  Star,
  X
} from 'lucide-react';
import { useRef, useState, type ChangeEvent } from 'react';
import type { Translator } from '../i18n';
import { FREE_PLATFORMS, type FreePlatform } from '../services/freePlatforms';
import { readStorageValue, writeStorageValue } from '../services/safeStorage';
import { StudioSelect } from './StudioSelect';

export function FreeGenerationPage(props: {
  t: Translator;
  prompt: string;
  onCopyPrompt: (platform: FreePlatform) => void;
  onOpenPlatform: (platform: FreePlatform) => void;
  onCopyPromptAndOpen: (platform: FreePlatform) => void;
  onImportWebResult: (platform: FreePlatform, file: File) => void;
}) {
  type FreePlatformUsageStatus = 'unused' | 'registered' | 'favorite' | 'unavailable';
  type FreePlatformPrefs = Record<string, { status: FreePlatformUsageStatus; note: string }>;

  const FREE_PLATFORM_PREFS_KEY = 'visionhub.freePlatformPrefs.v1';
  const FREE_PLATFORM_LOGO_CACHE_KEY = 'visionhub.freePlatformLogoCache.v2';
  const t = props.t;
  const statusOptions: Array<{ value: FreePlatformUsageStatus; label: string }> = [
    { value: 'unused', label: t('free.status.unused') },
    { value: 'registered', label: t('free.status.registered') },
    { value: 'favorite', label: t('free.status.favorite') },
    { value: 'unavailable', label: t('free.status.unavailable') }
  ];
  const commercialLabelMap: Record<FreePlatform['commercialUse'], string> = {
    unknown: t('free.platform.commercial.unknown'),
    personal: t('free.platform.commercial.personal'),
    limited: t('free.platform.commercial.limited'),
    allowed: t('free.platform.commercial.allowed')
  };
  const loginLabelMap: Record<FreePlatform['loginRequirement'], string> = {
    required: t('free.platform.login.required'),
    optional: t('free.platform.login.optional'),
    unknown: t('free.platform.login.unknown')
  };
  const regionLabelMap: Record<FreePlatform['region'], string> = {
    china: t('free.platform.region.china'),
    global: t('free.platform.region.global')
  };
  const kindLabelMap: Record<FreePlatform['kind'], string> = {
    'chat-image': t('free.platform.kind.chat-image'),
    image: t('free.platform.kind.image'),
    'image-video': t('free.platform.kind.image-video')
  };

  function loadFreePlatformPrefs(): FreePlatformPrefs {
    const raw = readStorageValue(FREE_PLATFORM_PREFS_KEY);
    if (!raw) return {};
    try {
      const parsed = JSON.parse(raw) as FreePlatformPrefs;
      return Object.fromEntries(
        Object.entries(parsed).map(([id, value]) => [
          id,
          {
            status: statusOptions.some((item) => item.value === value?.status) ? value.status : 'unused',
            note: typeof value?.note === 'string' ? value.note.slice(0, 500) : ''
          }
        ])
      );
    } catch (error) {
      console.warn('[VisionHub] free platform prefs parse failed; using defaults', error);
      return {};
    }
  }

  function loadFreePlatformLogoCache(): Record<string, string | null> {
    const raw = readStorageValue(FREE_PLATFORM_LOGO_CACHE_KEY);
    if (!raw) return {};
    try {
      const parsed = JSON.parse(raw) as Record<string, string | null>;
      return Object.fromEntries(
        Object.entries(parsed).filter(([, value]) => value === null || typeof value === 'string')
      );
    } catch (error) {
      console.warn('[VisionHub] free platform logo cache parse failed; using defaults', error);
      return {};
    }
  }

  const [regionFilter, setRegionFilter] = useState<'all' | FreePlatform['region']>('all');
  const [kindFilter, setKindFilter] = useState<'all' | FreePlatform['kind']>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | FreePlatformUsageStatus>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [prefs, setPrefs] = useState<FreePlatformPrefs>(() => loadFreePlatformPrefs());
  const [detailPlatformId, setDetailPlatformId] = useState<string | null>(null);
  const [expandedListPlatformId, setExpandedListPlatformId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'card' | 'list'>('card');
  const [importTargetPlatform, setImportTargetPlatform] = useState<FreePlatform | null>(null);
  const [resolvedLogoUrls, setResolvedLogoUrls] = useState<Record<string, string | null>>(() => loadFreePlatformLogoCache());
  const webResultInputRef = useRef<HTMLInputElement | null>(null);
  const promptReady = props.prompt.trim().length > 0;

  function savePrefs(nextPrefs: FreePlatformPrefs) {
    setPrefs(nextPrefs);
    writeStorageValue(FREE_PLATFORM_PREFS_KEY, JSON.stringify(nextPrefs));
  }

  function updatePlatformPrefs(platformId: string, patch: Partial<FreePlatformPrefs[string]>) {
    const current = prefs[platformId] ?? { status: 'unused', note: '' };
    savePrefs({
      ...prefs,
      [platformId]: {
        status: patch.status ?? current.status,
        note: patch.note ?? current.note
      }
    });
  }

  function toggleFavorite(platformId: string) {
    const current = prefs[platformId]?.status ?? 'unused';
    updatePlatformPrefs(platformId, { status: current === 'favorite' ? 'registered' : 'favorite' });
  }

  function startImportWebResult(platform: FreePlatform) {
    setImportTargetPlatform(platform);
    webResultInputRef.current?.click();
  }

  function resolveInitialLogoUrl(platform: FreePlatform) {
    return Object.prototype.hasOwnProperty.call(resolvedLogoUrls, platform.id)
      ? resolvedLogoUrls[platform.id]
      : platform.logoUrl;
  }

  function markResolvedLogoUrl(platformId: string, url: string | null) {
    setResolvedLogoUrls((current) => {
      if (current[platformId] === url) return current;
      const next = { ...current, [platformId]: url };
      const persistent = Object.fromEntries(Object.entries(next).filter(([, value]) => typeof value === 'string'));
      writeStorageValue(FREE_PLATFORM_LOGO_CACHE_KEY, JSON.stringify(persistent));
      return next;
    });
  }

  function handleWebResultSelected(event: ChangeEvent<HTMLInputElement>) {
    const file = Array.from(event.target.files ?? []).find((item) => item.type.startsWith('image/'));
    if (file && importTargetPlatform) {
      props.onImportWebResult(importTargetPlatform, file);
    }
    event.target.value = '';
  }

  const filteredPlatforms = FREE_PLATFORMS.filter((platform) => {
    const platformPrefs = prefs[platform.id] ?? { status: 'unused', note: '' };
    const normalizedQuery = searchQuery.trim().toLowerCase();
    const matchesRegion = regionFilter === 'all' || platform.region === regionFilter;
    const matchesKind = kindFilter === 'all' || platform.kind === kindFilter;
    const matchesStatus = statusFilter === 'all' || platformPrefs.status === statusFilter;
    const matchesSearch = !normalizedQuery
      || [
        platform.name,
        platform.vendor,
        platform.bestFor,
        platform.freeQuota,
        platform.commercialNote,
        platform.promptHint,
        platform.tags.join(' '),
        platformPrefs.note
      ].some((value) => value.toLowerCase().includes(normalizedQuery));
    return matchesRegion && matchesKind && matchesStatus && matchesSearch;
  });
  const favoriteCount = FREE_PLATFORMS.filter((platform) => prefs[platform.id]?.status === 'favorite').length;

  return (
    <>
      <header className="topbar freeTopbar">
        <div className="pageTitleBlock">
          <p className="eyebrow">Web Platform Helper</p>
          <h1>{t('free.title')}</h1>
          <p>{t('free.subtitle')}</p>
        </div>
        <div className="statusPills">
          <span>
            <Gift size={15} /> {t('free.stats.platforms', { count: FREE_PLATFORMS.length })}
          </span>
          <span>
            <Star size={15} /> {t('free.stats.favorites', { count: favoriteCount })}
          </span>
          <span>
            <Copy size={15} /> {promptReady ? t('free.stats.promptReady') : t('free.stats.promptMissing')}
          </span>
        </div>
      </header>

      <section className="freeWorkflowStrip" aria-label={t('free.workflowAria')}>
        <div>
          <strong>{t('free.workflow.copyTitle')}</strong>
          <span>{t('free.workflow.copyHint')}</span>
        </div>
        <div>
          <strong>{t('free.workflow.generateTitle')}</strong>
          <span>{t('free.workflow.generateHint')}</span>
        </div>
        <div>
          <strong>{t('free.workflow.importTitle')}</strong>
          <span>{t('free.workflow.importHint')}</span>
        </div>
      </section>

      <section className="freeToolbar">
        <input
          ref={webResultInputRef}
          className="visuallyHidden"
          type="file"
          accept="image/*"
          onChange={handleWebResultSelected}
        />
        <div className="freeFilterGroup">
          <div className="segmentedControl compactSegment">
            <button className={regionFilter === 'all' ? 'active' : ''} onClick={() => setRegionFilter('all')}>
              {t('free.region.all')}
            </button>
            <button className={regionFilter === 'china' ? 'active' : ''} onClick={() => setRegionFilter('china')}>
              {t('free.region.china')}
            </button>
            <button className={regionFilter === 'global' ? 'active' : ''} onClick={() => setRegionFilter('global')}>
              {t('free.region.global')}
            </button>
          </div>
        </div>
        <div className="freeActionGroup">
          <label className="freeSearchBox">
            <span>{t('free.searchLabel')}</span>
            <input
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder={t('free.searchPlaceholder')}
            />
          </label>
          <StudioSelect
            value={kindFilter}
            onChange={(value) => setKindFilter(value as 'all' | FreePlatform['kind'])}
            options={[
              { value: 'all', label: t('free.kind.all') },
              { value: 'chat-image', label: t('free.kind.chat-image') },
              { value: 'image', label: t('free.kind.image') },
              { value: 'image-video', label: t('free.kind.image-video') }
            ]}
          />
          <StudioSelect
            value={statusFilter}
            onChange={(value) => setStatusFilter(value as 'all' | FreePlatformUsageStatus)}
            options={[
              { value: 'all', label: t('free.status.all') },
              ...statusOptions
            ]}
          />
          <button
            className={`miniButton favoriteFilterButton ${statusFilter === 'favorite' ? 'active' : ''}`}
            type="button"
            onClick={() => setStatusFilter(statusFilter === 'favorite' ? 'all' : 'favorite')}
            title={statusFilter === 'favorite' ? t('free.favorite.showAll') : t('free.favorite.only')}
            aria-label={statusFilter === 'favorite' ? t('free.favorite.showAll') : t('free.favorite.only')}
          >
            <Star size={13} fill={statusFilter === 'favorite' ? 'currentColor' : 'none'} /> {t('free.favorite.button')}
          </button>
          <div className="segmentedControl compactSegment freeViewSwitch" aria-label={t('free.viewAria')}>
            <button className={viewMode === 'card' ? 'active' : ''} onClick={() => setViewMode('card')}>
              <Grid2X2 size={13} /> {t('free.view.card')}
            </button>
            <button className={viewMode === 'list' ? 'active' : ''} onClick={() => setViewMode('list')}>
              <Layers size={13} /> {t('free.view.list')}
            </button>
          </div>
        </div>
      </section>

      <section className={viewMode === 'list' ? 'freePlatformList' : 'freePlatformGrid'}>
        {filteredPlatforms.map((platform) => {
          const platformPrefs = prefs[platform.id] ?? { status: 'unused', note: '' };
          const isListExpanded = viewMode === 'list' && expandedListPlatformId === platform.id;
          return (
          <article className={`freePlatformCard ${viewMode === 'list' ? 'listMode' : ''} ${isListExpanded ? 'expanded' : ''}`} key={platform.id}>
            <div className="freePlatformHeader">
              <div
                className="freePlatformLogo"
                style={{ background: platform.brandColor }}
                aria-label={`${platform.name} Logo`}
              >
                {resolveInitialLogoUrl(platform) ? (
                  <img
                    src={resolveInitialLogoUrl(platform) ?? undefined}
                    alt=""
                    loading="lazy"
                    onLoad={(event) => markResolvedLogoUrl(platform.id, event.currentTarget.currentSrc || event.currentTarget.src)}
                    onError={(event) => {
                      const image = event.currentTarget;
                      const fallbackIndex = Number(image.dataset.fallbackIndex ?? '0');
                      const fallbackUrls = platform.fallbackLogoUrls?.length
                        ? platform.fallbackLogoUrls
                        : [platform.fallbackLogoUrl];
                      const nextUrl = fallbackUrls[fallbackIndex];
                      if (nextUrl) {
                        image.dataset.fallbackIndex = String(fallbackIndex + 1);
                        image.src = nextUrl;
                        return;
                      }
                      markResolvedLogoUrl(platform.id, null);
                    }}
                  />
                ) : null}
                <span>{platform.logoText}</span>
              </div>
              <div>
                <strong>{platform.name}</strong>
                <small>{platform.vendor}</small>
              </div>
              <button
                className={`iconButton favoritePlatformButton ${platformPrefs.status === 'favorite' ? 'active' : ''}`}
                onClick={() => toggleFavorite(platform.id)}
                title={platformPrefs.status === 'favorite' ? t('free.platform.favoriteRemove') : t('free.platform.favoriteAdd')}
                aria-label={platformPrefs.status === 'favorite'
                  ? t('free.platform.favoriteRemoveNamed', { name: platform.name })
                  : t('free.platform.favoriteAddNamed', { name: platform.name })}
              >
                <Star size={15} fill={platformPrefs.status === 'favorite' ? 'currentColor' : 'none'} />
              </button>
            </div>

            <div className="freePlatformMeta">
              <span>{regionLabelMap[platform.region]}</span>
              <span>{kindLabelMap[platform.kind]}</span>
              <span>{loginLabelMap[platform.loginRequirement]}</span>
              <span>{platform.supportsImageToImage ? t('free.platform.supportsImageToImage') : t('free.platform.textToImageFirst')}</span>
            </div>

            <p>{platform.bestFor}</p>
            <div className="freePlatformQuickInfo">
              <span>{platform.freeQuota}</span>
              <span>{commercialLabelMap[platform.commercialUse]}</span>
            </div>

            <div className="freePlatformActions">
              <button
                className="miniButton primaryMini"
                onClick={() => props.onCopyPromptAndOpen(platform)}
                title={promptReady ? t('free.action.copyOpenTitleReady', { name: platform.name }) : t('free.action.openTitle', { name: platform.name })}
                aria-label={promptReady ? t('free.action.copyOpenTitleReady', { name: platform.name }) : t('free.action.openTitle', { name: platform.name })}
              >
                <ExternalLink size={13} /> {t('free.action.copyAndOpen')}
              </button>
              <button
                className="miniButton"
                onClick={() => startImportWebResult(platform)}
                title={t('free.action.importTitle', { name: platform.name })}
                aria-label={t('free.action.importTitle', { name: platform.name })}
              >
                <FolderOpen size={13} /> {t('free.action.importResult')}
              </button>
              <button
                className="miniButton subtleMini freePlatformDetailButton"
                onClick={() => {
                  if (viewMode === 'card') {
                    setDetailPlatformId(platform.id);
                    return;
                  }
                  setExpandedListPlatformId((current) => current === platform.id ? null : platform.id);
                }}
                title={t('free.action.detailsTitle', { name: platform.name })}
                aria-label={t('free.action.detailsTitle', { name: platform.name })}
              >
                <Info size={13} /> {t('free.action.details')}
              </button>
            </div>
            {isListExpanded ? (
              <div className="freePlatformExpandedPanel">
                <div className="freePlatformDetails">
                  <small><strong>{t('free.detail.quota')}</strong>{platform.freeQuota}</small>
                  <small><strong>{t('free.detail.limit')}</strong>{platform.watermarkLimit}</small>
                  <small><strong>{t('free.detail.commercial')}</strong>{platform.commercialNote}</small>
                  <small><strong>{t('free.detail.prompt')}</strong>{platform.promptHint}</small>
                </div>
                <div className="freePlatformDetailControls">
                  <label>
                    {t('free.statusLabel')}
                    <StudioSelect
                      value={platformPrefs.status}
                      onChange={(value) => updatePlatformPrefs(platform.id, { status: value as FreePlatformUsageStatus })}
                      options={statusOptions}
                    />
                  </label>
                </div>
                <label>
                  {t('free.noteLabel')}
                  <textarea
                    value={platformPrefs.note}
                    onChange={(event) => updatePlatformPrefs(platform.id, { note: event.target.value.slice(0, 500) })}
                    placeholder={t('free.notePlaceholder', { name: platform.name })}
                    rows={3}
                  />
                </label>
              </div>
            ) : null}
          </article>
        );
        })}
      </section>
      {viewMode === 'card' && detailPlatformId ? (() => {
        const platform = FREE_PLATFORMS.find((item) => item.id === detailPlatformId);
        if (!platform) return null;
        const platformPrefs = prefs[platform.id] ?? { status: 'unused', note: '' };
        return (
          <div className="freePlatformDrawerBackdrop" onClick={() => setDetailPlatformId(null)}>
            <aside className="freePlatformDrawer" role="dialog" aria-modal="true" aria-label={t('free.detailAria', { name: platform.name })} onClick={(event) => event.stopPropagation()}>
              <div className="freePlatformDrawerHeader">
                <div className="freePlatformLogo" style={{ background: platform.brandColor }} aria-label={`${platform.name} Logo`}>
                  {resolveInitialLogoUrl(platform) ? (
                    <img
                      src={resolveInitialLogoUrl(platform) ?? undefined}
                      alt=""
                      loading="lazy"
                      onLoad={(event) => markResolvedLogoUrl(platform.id, event.currentTarget.currentSrc || event.currentTarget.src)}
                      onError={(event) => {
                        const image = event.currentTarget;
                        const fallbackIndex = Number(image.dataset.fallbackIndex ?? '0');
                        const fallbackUrls = platform.fallbackLogoUrls?.length
                          ? platform.fallbackLogoUrls
                          : [platform.fallbackLogoUrl];
                        const nextUrl = fallbackUrls[fallbackIndex];
                        if (nextUrl) {
                          image.dataset.fallbackIndex = String(fallbackIndex + 1);
                          image.src = nextUrl;
                          return;
                        }
                        markResolvedLogoUrl(platform.id, null);
                      }}
                    />
                  ) : null}
                  <span>{platform.logoText}</span>
                </div>
                <div>
                  <p className="eyebrow">Web Platform Detail</p>
                  <h2>{platform.name}</h2>
                  <small>{platform.vendor}</small>
                </div>
                <button className="iconButton" onClick={() => setDetailPlatformId(null)} aria-label={t('free.closeDetails')} title={t('free.closeDetails')}>
                  <X size={16} />
                </button>
              </div>
              <div className="freePlatformMeta">
                <span>{regionLabelMap[platform.region]}</span>
                <span>{kindLabelMap[platform.kind]}</span>
                <span>{loginLabelMap[platform.loginRequirement]}</span>
                <span>{platform.supportsImageToImage ? t('free.platform.supportsImageToImage') : t('free.platform.textToImageFirst')}</span>
              </div>
              <p className="freePlatformDrawerSummary">{platform.bestFor}</p>
              <div className="freePlatformDetails">
                <small><strong>{t('free.detail.quota')}</strong>{platform.freeQuota}</small>
                <small><strong>{t('free.detail.limit')}</strong>{platform.watermarkLimit}</small>
                <small><strong>{t('free.detail.commercial')}</strong>{platform.commercialNote}</small>
                <small><strong>{t('free.detail.prompt')}</strong>{platform.promptHint}</small>
              </div>
              <label className="freePlatformDrawerField">
                <span>{t('free.statusLabel')}</span>
                <StudioSelect
                  value={platformPrefs.status}
                  onChange={(value) => updatePlatformPrefs(platform.id, { status: value as FreePlatformUsageStatus })}
                  options={statusOptions}
                />
              </label>
              <div className="freePlatformDrawerActions">
                <button className="miniButton primaryMini" onClick={() => props.onCopyPromptAndOpen(platform)}>
                  <ExternalLink size={13} /> {t('free.action.copyAndOpen')}
                </button>
                <button className="miniButton" disabled={!promptReady} onClick={() => props.onCopyPrompt(platform)}>
                  <Copy size={13} /> {t('free.action.copyOnly')}
                </button>
                <button className="miniButton" onClick={() => props.onOpenPlatform(platform)}>
                  <Globe2 size={13} /> {t('free.action.openOnly')}
                </button>
                <button className="miniButton" onClick={() => startImportWebResult(platform)}>
                  <FolderOpen size={13} /> {t('free.action.importResult')}
                </button>
              </div>
              <label className="freePlatformDrawerField">
                <span>{t('free.noteLabel')}</span>
                <textarea
                  value={platformPrefs.note}
                  onChange={(event) => updatePlatformPrefs(platform.id, { note: event.target.value.slice(0, 500) })}
                  placeholder={t('free.notePlaceholder', { name: platform.name })}
                  rows={4}
                />
              </label>
            </aside>
          </div>
        );
      })() : null}
    </>
  );
}
