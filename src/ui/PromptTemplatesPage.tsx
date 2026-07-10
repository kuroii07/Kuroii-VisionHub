import {
  Clock3,
  Copy,
  Grid2X2,
  Layers,
  Pencil,
  Plus,
  Sparkles,
  Star,
  Trash2,
  Wand2,
  X
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import type { Translator } from '../i18n';
import {
  PROMPT_TEMPLATE_CATEGORIES,
  createPromptTemplate,
  loadPromptTemplates,
  savePromptTemplates,
  type PromptTemplate,
  type PromptTemplateCategory
} from '../services/promptTemplates';
import { StudioSelect } from './StudioSelect';
import { useToastMessage } from './toast';

export function PromptTemplatesPage(props: { t: Translator; onUseTemplate: (prompt: string) => void }) {
  type TemplateSourceFilter = 'all' | 'default' | 'custom' | 'favorite' | 'recent';
  type TemplateViewMode = 'card' | 'list';
  type TemplateDraft = {
    id: string;
    title: string;
    category: PromptTemplateCategory;
    tone: string;
    description: string;
    prompt: string;
    tags: string;
  };

  const t = props.t;

  const emptyDraft: TemplateDraft = {
    id: '',
    title: '',
    category: 'style',
    tone: '',
    description: '',
    prompt: '',
    tags: ''
  };
  const templateSourceOptions: Array<{ value: TemplateSourceFilter; label: string }> = [
    { value: 'all', label: t('templates.sourceFilter.all') },
    { value: 'default', label: t('templates.sourceFilter.default') },
    { value: 'custom', label: t('templates.sourceFilter.custom') },
    { value: 'favorite', label: t('templates.sourceFilter.favorite') },
    { value: 'recent', label: t('templates.sourceFilter.recent') }
  ];

  const [templates, setTemplates] = useState<PromptTemplate[]>(() => loadPromptTemplates());
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<'all' | PromptTemplateCategory>('all');
  const [sourceFilter, setSourceFilter] = useState<TemplateSourceFilter>('all');
  const [viewMode, setViewMode] = useState<TemplateViewMode>('card');
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null);
  const [draft, setDraft] = useState<TemplateDraft>(emptyDraft);
  const [variableValues, setVariableValues] = useState<Record<string, string>>({});
  const [copyMessage, setCopyMessage] = useState('');
  useToastMessage(copyMessage, setCopyMessage);

  const translatedTemplateSourceOptions = useMemo(() => templateSourceOptions.map((option) => ({
    ...option,
    label: translateTemplateLabel('templates.sourceFilter', option.value, option.label)
  })), [t]);
  const translatedTemplateCategoryOptions = useMemo(() => PROMPT_TEMPLATE_CATEGORIES.map((option) => ({
    ...option,
    label: translateTemplateLabel('templates.category', option.value, option.label)
  })), [t]);
  const templateViewOptions = useMemo(() => [
    { value: 'card' as TemplateViewMode, label: t('templates.view.card') },
    { value: 'list' as TemplateViewMode, label: t('templates.view.list') }
  ], [t]);

  function translateTemplateLabel(prefix: string, value: string, fallback: string) {
    const key = `${prefix}.${value}` as Parameters<Translator>[0];
    const translated = t(key);
    return translated === key ? fallback : translated;
  }

  function persistTemplates(nextTemplates: PromptTemplate[]) {
    setTemplates(nextTemplates);
    savePromptTemplates(nextTemplates);
  }

  const normalizedQuery = query.trim().toLowerCase();
  const filteredTemplates = useMemo(() => {
    return templates
      .filter((template) => {
        const matchesCategory = category === 'all' || template.category === category;
        const matchesSource =
          sourceFilter === 'all' ||
          (sourceFilter === 'default' && !template.custom) ||
          (sourceFilter === 'custom' && template.custom) ||
          (sourceFilter === 'favorite' && template.favorite) ||
          (sourceFilter === 'recent' && Boolean(template.lastUsedAt));
        const haystack = [
          template.title,
          template.tone,
          template.description ?? '',
          template.prompt,
          ...template.tags,
          ...(template.variables ?? [])
        ].join(' ').toLowerCase();
        return matchesCategory && matchesSource && (!normalizedQuery || haystack.includes(normalizedQuery));
      })
      .sort((left, right) => {
        if (sourceFilter === 'recent') return Number(right.lastUsedAt ?? 0) - Number(left.lastUsedAt ?? 0);
        if (left.favorite !== right.favorite) return left.favorite ? -1 : 1;
        return Number(right.lastUsedAt ?? 0) - Number(left.lastUsedAt ?? 0) || left.title.localeCompare(right.title, 'zh-CN');
      });
  }, [category, normalizedQuery, sourceFilter, templates]);
  const selectedTemplate = useMemo(
    () => templates.find((template) => template.id === selectedTemplateId) ?? filteredTemplates[0] ?? null,
    [filteredTemplates, selectedTemplateId, templates]
  );
  const selectedTemplateVariables = useMemo(() => {
    if (!selectedTemplate) return [];
    const fromTemplate = selectedTemplate.variables?.filter((variable) => variable.trim()) ?? [];
    if (fromTemplate.length) return Array.from(new Set(fromTemplate));
    return Array.from(new Set(Array.from(selectedTemplate.prompt.matchAll(/\{([^{}]+)\}/g)).map((match) => match[1].trim()).filter(Boolean)));
  }, [selectedTemplate]);
  const renderedPrompt = useMemo(() => {
    if (!selectedTemplate) return '';
    return selectedTemplate.prompt.replace(/\{([^{}]+)\}/g, (match, key: string) => {
      const value = variableValues[key.trim()]?.trim();
      return value || match;
    });
  }, [selectedTemplate, variableValues]);
  const favoriteCount = templates.filter((template) => template.favorite).length;
  const recentCount = templates.filter((template) => template.lastUsedAt).length;

  useEffect(() => {
    if (!filteredTemplates.length) {
      setSelectedTemplateId(null);
      return;
    }
    if (!selectedTemplateId || !filteredTemplates.some((template) => template.id === selectedTemplateId)) {
      setSelectedTemplateId(filteredTemplates[0].id);
    }
  }, [filteredTemplates, selectedTemplateId]);

  useEffect(() => {
    setVariableValues({});
  }, [selectedTemplate?.id]);

  function categoryLabel(value: PromptTemplateCategory) {
    const fallback = PROMPT_TEMPLATE_CATEGORIES.find((item) => item.value === value)?.label ?? value;
    return translateTemplateLabel('templates.category', value, fallback);
  }

  function tagsToText(tags: string[]) {
    return tags.join('，');
  }

  function parseTemplateTags(value: string) {
    return value.split(/[，,]/).map((tag) => tag.trim()).filter(Boolean);
  }

  function startCreateTemplate() {
    setEditingTemplateId('new');
    setDetailOpen(true);
    setDraft(emptyDraft);
  }

  function startEditTemplate(template: PromptTemplate) {
    setEditingTemplateId(template.id);
    setDetailOpen(true);
    setDraft({
      id: template.id,
      title: template.title,
      category: template.category,
      tone: template.tone,
      description: template.description ?? '',
      prompt: template.prompt,
      tags: tagsToText(template.tags)
    });
  }

  function cancelEditTemplate() {
    setEditingTemplateId(null);
    setDraft(emptyDraft);
  }

  function saveDraftTemplate() {
    const title = draft.title.trim();
    const prompt = draft.prompt.trim();
    if (!title || !prompt) {
      setCopyMessage(t('templates.needTitlePrompt'));
      return;
    }
    const previous = draft.id ? templates.find((template) => template.id === draft.id) : undefined;
    const shouldUpdateExisting = Boolean(previous?.custom);
    const nextTemplate = createPromptTemplate({
      id: shouldUpdateExisting ? previous?.id : undefined,
      title,
      category: draft.category,
      tone: draft.tone.trim() || t('templates.customTone'),
      description: draft.description.trim() || undefined,
      prompt,
      tags: parseTemplateTags(draft.tags),
      favorite: previous?.favorite,
      lastUsedAt: previous?.lastUsedAt,
      usedCount: previous?.usedCount
    });
    const next = shouldUpdateExisting
      ? templates.map((template) => (template.id === draft.id ? { ...nextTemplate, createdAt: previous?.createdAt ?? nextTemplate.createdAt } : template))
      : [nextTemplate, ...templates];
    persistTemplates(next.slice(0, 300));
    setSelectedTemplateId(nextTemplate.id);
    setDetailOpen(true);
    cancelEditTemplate();
    setCopyMessage(shouldUpdateExisting ? t('templates.updated') : t('templates.savedAsMine'));
  }

  function deleteTemplate(template: PromptTemplate) {
    if (!template.custom) {
      setCopyMessage(t('templates.systemDeleteBlocked'));
      return;
    }
    if (!window.confirm(t('templates.deleteConfirmMessage', { title: template.title }))) return;
    const next = templates.filter((item) => item.id !== template.id);
    persistTemplates(next);
    setSelectedTemplateId(next[0]?.id ?? null);
    setDetailOpen(false);
    if (editingTemplateId === template.id) cancelEditTemplate();
    setCopyMessage(t('templates.deleted'));
  }

  function toggleTemplateFavorite(template: PromptTemplate) {
    persistTemplates(templates.map((item) => item.id === template.id ? { ...item, favorite: !item.favorite } : item));
  }

  function markTemplateUsed(template: PromptTemplate) {
    const now = String(Date.now());
    persistTemplates(templates.map((item) => item.id === template.id ? {
      ...item,
      lastUsedAt: now,
      usedCount: (item.usedCount ?? 0) + 1
    } : item));
  }

  function useTemplate(template: PromptTemplate) {
    const promptToUse = template.id === selectedTemplate?.id ? renderedPrompt : template.prompt;
    props.onUseTemplate(promptToUse);
    markTemplateUsed(template);
  }

  async function copyTemplate(template: PromptTemplate) {
    try {
      const promptToCopy = template.id === selectedTemplate?.id ? renderedPrompt : template.prompt;
      await navigator.clipboard?.writeText(promptToCopy);
      markTemplateUsed(template);
      setCopyMessage(t('templates.copied', { title: template.title }));
    } catch (error) {
      setCopyMessage(error instanceof Error ? error.message : String(error));
    }
  }

  function clearTemplateFilters() {
    setQuery('');
    setCategory('all');
    setSourceFilter('all');
  }

  return (
    <section className="promptLibraryPage">
      <header className="topbar templateTopbar">
        <div className="pageTitleBlock">
          <p className="eyebrow">Prompt Library</p>
          <h1>{t('templates.title')}</h1>
          <p>{t('templates.subtitle')}</p>
        </div>
        <div className="statusPills">
          <span><Layers size={15} /> {t('templates.stats.total', { count: templates.length })}</span>
          <span><Star size={15} /> {t('templates.stats.favorite', { count: favoriteCount })}</span>
          <span><Clock3 size={15} /> {t('templates.stats.recent', { count: recentCount })}</span>
        </div>
      </header>

      <section className="templateToolbar promptLibraryToolbar">
        <label className="templateSearchBox">
          <span>{t('templates.searchLabel')}</span>
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t('templates.searchPlaceholder')} />
        </label>
        <label>
          <span>{t('templates.categoryLabel')}</span>
          <StudioSelect value={category} onChange={(value) => setCategory(value as 'all' | PromptTemplateCategory)} options={translatedTemplateCategoryOptions} />
        </label>
        <label>
          <span>{t('templates.sourceLabel')}</span>
          <StudioSelect value={sourceFilter} onChange={(value) => setSourceFilter(value as TemplateSourceFilter)} options={translatedTemplateSourceOptions} />
        </label>
        <div className="promptLibraryToolbarActions">
          <button
            className={`miniButton favoriteFilterButton ${sourceFilter === 'favorite' ? 'active' : ''}`}
            type="button"
            onClick={() => setSourceFilter(sourceFilter === 'favorite' ? 'all' : 'favorite')}
            title={sourceFilter === 'favorite' ? t('templates.showAll') : t('templates.onlyFavorites')}
            aria-label={sourceFilter === 'favorite' ? t('templates.showAll') : t('templates.onlyFavorites')}
          >
            <Star size={13} fill={sourceFilter === 'favorite' ? 'currentColor' : 'none'} /> {t('templates.favoriteFilter')}
          </button>
          <div className="segmentedControl compactSegment" aria-label={t('templates.viewAria')}>
            <button className={viewMode === 'card' ? 'active' : ''} onClick={() => setViewMode('card')} type="button"><Grid2X2 size={13} /> {templateViewOptions[0].label}</button>
            <button className={viewMode === 'list' ? 'active' : ''} onClick={() => setViewMode('list')} type="button"><Layers size={13} /> {templateViewOptions[1].label}</button>
          </div>
          <button className="miniButton" type="button" onClick={clearTemplateFilters}><X size={13} /> {t('templates.clear')}</button>
          <button className="miniButton primaryMini" type="button" onClick={startCreateTemplate}><Plus size={13} /> {t('templates.new')}</button>
        </div>
      </section>

      <section className="promptCategoryStrip" aria-label={t('templates.categoryStripAria')}>
          {translatedTemplateCategoryOptions.map((item) => {
            const count = item.value === 'all' ? templates.length : templates.filter((template) => template.category === item.value).length;
            return (
              <button className={category === item.value ? 'active' : ''} key={item.value} type="button" onClick={() => setCategory(item.value)}>
                <span>{item.label}</span>
                <small>{count}</small>
              </button>
            );
          })}
      </section>

      <section className="promptLibraryLayout">
        <section className="promptLibraryListPanel">
          <div className="promptLibraryListHeader">
            <strong>{t('templates.resultCount', { count: filteredTemplates.length })}</strong>
            <span>{sourceFilter === 'all' ? t('templates.sourceFilter.all') : translatedTemplateSourceOptions.find((item) => item.value === sourceFilter)?.label}</span>
          </div>
          {filteredTemplates.length === 0 ? (
            <div className="emptyState templateEmpty">
              <Sparkles size={42} />
              <h3>{t('templates.emptyTitle')}</h3>
          <p>{t('templates.subtitle')}</p>
            </div>
          ) : (
            <div className={viewMode === 'list' ? 'promptTemplateList' : 'promptTemplateCards'}>
              {filteredTemplates.map((template) => (
                <article
                  className={`promptTemplateItem ${viewMode === 'list' ? 'listMode' : ''} ${selectedTemplate?.id === template.id ? 'active' : ''}`}
                  key={template.id}
                  onClick={() => { setSelectedTemplateId(template.id); setEditingTemplateId(null); setDetailOpen(true); }}
                >
                  <div className="promptTemplateItemHeader">
                    <span className="badge">{categoryLabel(template.category)}</span>
                    <button
                      className={`iconMiniButton promptFavoriteButton ${template.favorite ? 'active' : ''}`}
                      type="button"
                      title={template.favorite ? t('templates.favoriteRemove') : t('templates.favoriteAdd')}
                      aria-label={template.favorite ? t('templates.favoriteRemoveNamed', { title: template.title }) : t('templates.favoriteAddNamed', { title: template.title })}
                      onClick={(event) => { event.stopPropagation(); toggleTemplateFavorite(template); }}
                    >
                      <Star size={13} fill={template.favorite ? 'currentColor' : 'none'} />
                    </button>
                  </div>
                  <strong title={template.title}>{template.title}</strong>
                  <small>{template.tone || t('templates.noTone')}</small>
                  <p>{template.description || template.prompt}</p>
                  <div className="templateTags">
                    {template.tags.slice(0, 4).map((tag) => <span key={tag}>{tag}</span>)}
                  </div>
                  <div className="promptTemplateMetaLine">
                    <span>{template.custom ? t('templates.kind.custom') : t('templates.kind.system')}</span>
                    <span>{template.usedCount ? t('templates.usedCount', { count: template.usedCount }) : t('templates.notUsed')}</span>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </section>

      {detailOpen ? (
        <div className="templateDrawerBackdrop" onClick={() => { setDetailOpen(false); setEditingTemplateId(null); }}>
        <aside className="promptTemplateDetail templateDetailDrawer" aria-label={t('templates.detailAria')} onClick={(event) => event.stopPropagation()}>
          {editingTemplateId ? (
            <>
              <div className="panelTitleRow">
                <div>
                  <strong>{editingTemplateId === 'new' ? t('templates.editorNew') : t('templates.editorEdit')}</strong>
              <p>{t('templates.emptyHint')}</p>
                </div>
                <button className="iconMiniButton" type="button" onClick={() => { setDetailOpen(false); cancelEditTemplate(); }} title={t('templates.closeEditor')} aria-label={t('templates.closeEditor')}><X size={13} /></button>
              </div>
              <div className="promptTemplateEditor">
                <label><span>{t('templates.fieldTitle')}</span><input value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} placeholder={t('templates.fieldTitlePlaceholder')} /></label>
                <label><span>{t('templates.categoryLabel')}</span><StudioSelect value={draft.category} onChange={(value) => setDraft({ ...draft, category: value as PromptTemplateCategory })} options={translatedTemplateCategoryOptions.filter((item) => item.value !== 'all') as Array<{ value: PromptTemplateCategory; label: string }>} /></label>
                <label><span>{t('templates.fieldTone')}</span><input value={draft.tone} onChange={(event) => setDraft({ ...draft, tone: event.target.value })} placeholder={t('templates.fieldTonePlaceholder')} /></label>
                <label><span>{t('templates.fieldDescription')}</span><textarea value={draft.description} onChange={(event) => setDraft({ ...draft, description: event.target.value })} rows={2} placeholder={t('templates.fieldDescriptionPlaceholder')} /></label>
                <label><span>{t('templates.fieldTags')}</span><input value={draft.tags} onChange={(event) => setDraft({ ...draft, tags: event.target.value })} placeholder={t('templates.fieldTagsPlaceholder')} /></label>
                <label><span>Prompt</span><textarea value={draft.prompt} onChange={(event) => setDraft({ ...draft, prompt: event.target.value })} rows={8} placeholder={t('templates.fieldPromptPlaceholder')} /></label>
              </div>
              <div className="sourceEditorActions">
                <button className="miniButton" type="button" onClick={() => { setDetailOpen(false); cancelEditTemplate(); }}><X size={13} /> {t('templates.cancel')}</button>
                <button className="miniButton primaryMini" type="button" onClick={saveDraftTemplate}><Pencil size={13} /> {t('templates.save')}</button>
              </div>
            </>
          ) : selectedTemplate ? (
            <>
              <div className="panelTitleRow">
                <div>
                  <span className="badge">{categoryLabel(selectedTemplate.category)}</span>
                  <strong>{selectedTemplate.title}</strong>
                  <p>{selectedTemplate.description || selectedTemplate.tone}</p>
                </div>
                <div className="templateDrawerTopActions">
                  <button
                    className={`iconMiniButton promptFavoriteButton ${selectedTemplate.favorite ? 'active' : ''}`}
                    type="button"
                    title={selectedTemplate.favorite ? t('templates.favoriteRemove') : t('templates.favoriteAdd')}
                    aria-label={selectedTemplate.favorite ? t('templates.favoriteRemoveTemplate') : t('templates.favoriteAddTemplate')}
                    onClick={() => toggleTemplateFavorite(selectedTemplate)}
                  >
                    <Star size={14} fill={selectedTemplate.favorite ? 'currentColor' : 'none'} />
                  </button>
                  <button className="iconMiniButton" type="button" onClick={() => setDetailOpen(false)} title={t('templates.closeDetails')} aria-label={t('templates.closeDetails')}><X size={13} /></button>
                </div>
              </div>

              <div className="promptTemplateDetailMeta">
                <span>{selectedTemplate.custom ? t('templates.kind.custom') : t('templates.kind.system')}</span>
                <span>{selectedTemplate.usedCount ? t('templates.usedCount', { count: selectedTemplate.usedCount }) : t('templates.notUsed')}</span>
                <span>{selectedTemplate.lastUsedAt ? t('templates.recentUsed') : t('templates.notRecent')}</span>
              </div>

              <div className="promptTemplateVariables">
                <div className="sectionHeadingRow">
                  <strong>{t('templates.variablesTitle')}</strong>
                  <small>{t('templates.variableCount', { count: selectedTemplateVariables.length })}</small>
                </div>
                {selectedTemplateVariables.map((variable) => (
                  <label key={variable}>
                    <span>{variable}</span>
                    <input
                      value={variableValues[variable] ?? ''}
                      onChange={(event) => setVariableValues((current) => ({ ...current, [variable]: event.target.value }))}
                      placeholder={t('templates.variablePlaceholder', { name: variable })}
                    />
                  </label>
                ))}
              </div>

              <label className="promptTemplatePreview">
                <span>{t('templates.previewPrompt')}</span>
                <textarea value={renderedPrompt} readOnly rows={9} />
              </label>

              <div className="templateTags promptTemplateDetailTags">
                {selectedTemplate.tags.map((tag) => <span key={tag}>{tag}</span>)}
              </div>

              <div className="promptTemplateDetailActions">
                <button className="miniButton primaryMini" type="button" onClick={() => useTemplate(selectedTemplate)}><Wand2 size={13} /> {t('templates.apply')}</button>
                <button className="miniButton" type="button" onClick={() => void copyTemplate(selectedTemplate)}><Copy size={13} /> {t('templates.copy')}</button>
                <button className="miniButton" type="button" onClick={() => startEditTemplate(selectedTemplate)}><Pencil size={13} /> {selectedTemplate.custom ? t('templates.edit') : t('templates.saveAs')}</button>
                <button
                  className="miniButton dangerText"
                  type="button"
                  disabled={!selectedTemplate.custom}
                  title={selectedTemplate.custom ? t('templates.deleteTitle') : t('templates.systemDeleteTitle')}
                  onClick={() => deleteTemplate(selectedTemplate)}
                >
                  <Trash2 size={13} /> {t('templates.delete')}
                </button>
              </div>
            </>
          ) : (
            <div className="emptyState templateEmpty">
              <Layers size={42} />
              <h3>{t('templates.selectTitle')}</h3>
              <p>{t('templates.selectHint')}</p>
            </div>
          )}
        </aside>
        </div>
      ) : null}
    </section>
  );
}
