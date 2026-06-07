import {
  Bookmark,
  Copy,
  Edit3,
  ExternalLink,
  ImagePlus,
  Link2,
  Maximize2,
  Plus,
  Save,
  Sparkles,
  Trash2,
  Upload,
  X
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState, type ClipboardEvent, type DragEvent } from 'react';
import type {
  InspirationAsset,
  InspirationCommercialReference,
  InspirationLicenseStatus,
  InspirationRegion,
  InspirationSource,
  InspirationSourceCategory
} from '../domain/inspirationTypes';
import {
  deleteInspirationAsset,
  deleteInspirationSource,
  importInspirationAsset,
  loadInspirationLibrary,
  saveInspirationAsset,
  saveInspirationSource
} from '../services/inspirationApi';
import { openExternalUrl } from '../services/desktopApi';
import { StudioSelect } from './StudioSelect';
import type { ConfirmDialogRequest } from './confirmDialog';
import { useToastMessage } from './toast';

type InspirationTab = 'sources' | 'assets';

const sourceCategoryOptions: Array<{ value: InspirationSourceCategory | 'all'; label: string }> = [
  { value: 'all', label: '全部类型' },
  { value: 'prompt-template', label: '提示词模板' },
  { value: 'image-gallery', label: '图片灵感' },
  { value: 'model-community', label: '模型社区' },
  { value: 'style-reference', label: '风格参考' },
  { value: 'commercial-design', label: '商业设计' },
  { value: 'other', label: '其他' }
];

const regionOptions: Array<{ value: InspirationRegion | 'all'; label: string }> = [
  { value: 'all', label: '全部地区' },
  { value: 'china', label: '国内' },
  { value: 'global', label: '海外' },
  { value: 'mixed', label: '综合' }
];

const commercialReferenceOptions: Array<{ value: InspirationCommercialReference; label: string }> = [
  { value: 'reference-only', label: '仅作参考' },
  { value: 'user-confirmed', label: '已确认可用' },
  { value: 'unknown', label: '未确认' }
];

const licenseOptions: Array<{ value: InspirationLicenseStatus | 'all'; label: string }> = [
  { value: 'all', label: '全部授权' },
  { value: 'reference-only', label: '仅作参考' },
  { value: 'commercial-confirmed', label: '商用已确认' },
  { value: 'unknown', label: '未确认' }
];

const emptySourceDraft = {
  id: '',
  name: '',
  url: '',
  category: 'prompt-template' as InspirationSourceCategory,
  region: 'mixed' as InspirationRegion,
  tags: '',
  note: '',
  requiresLogin: false,
  commercialReference: 'reference-only' as InspirationCommercialReference
};

const emptyAssetDraft = {
  title: '',
  sourceUrl: '',
  sourcePlatform: '',
  author: '',
  originalPrompt: '',
  tags: '',
  note: '',
  licenseStatus: 'reference-only' as InspirationLicenseStatus
};

function categoryLabel(value: InspirationSourceCategory) {
  return sourceCategoryOptions.find((option) => option.value === value)?.label ?? value;
}

function regionLabel(value: InspirationRegion) {
  return regionOptions.find((option) => option.value === value)?.label ?? value;
}

function licenseLabel(value: InspirationLicenseStatus) {
  return licenseOptions.find((option) => option.value === value)?.label ?? value;
}

function parseTags(value: string) {
  return value
    .split(/[，,]/)
    .map((tag) => tag.trim())
    .filter(Boolean)
    .filter((tag, index, array) => array.indexOf(tag) === index);
}

function tagsToText(tags?: string[]) {
  return (tags ?? []).join('，');
}

function timestampId(prefix: string) {
  return `${prefix}-${Date.now()}`;
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error('读取图片失败'));
    reader.readAsDataURL(file);
  });
}

function firstImageFile(files: FileList | File[] | null | undefined) {
  if (!files) return null;
  const array = Array.from(files);
  return array.find((file) => file.type.startsWith('image/')) ?? null;
}

export function InspirationPage(props: {
  onPreview: (imageUrl: string) => void;
  onUseAsReference: (asset: InspirationAsset) => void;
  onUsePrompt: (prompt: string) => void;
  onCreateTemplate: (title: string, prompt: string, tags: string[]) => string;
  onRequestConfirm: (request: ConfirmDialogRequest) => void;
}) {
  const [activeTab, setActiveTab] = useState<InspirationTab>('sources');
  const [sources, setSources] = useState<InspirationSource[]>([]);
  const [assets, setAssets] = useState<InspirationAsset[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);
  const [message, setMessage] = useState('');
  const [query, setQuery] = useState('');
  const [sourceCategory, setSourceCategory] = useState<InspirationSourceCategory | 'all'>('all');
  const [sourceRegion, setSourceRegion] = useState<InspirationRegion | 'all'>('all');
  const [assetLicense, setAssetLicense] = useState<InspirationLicenseStatus | 'all'>('all');
  const [sourceDraft, setSourceDraft] = useState(emptySourceDraft);
  const [assetDraft, setAssetDraft] = useState(emptyAssetDraft);
  const [assetFile, setAssetFile] = useState<File | null>(null);
  const [editingAssetId, setEditingAssetId] = useState<string | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  useToastMessage(message, setMessage);

  useEffect(() => {
    let active = true;
    loadInspirationLibrary()
      .then((library) => {
        if (!active) return;
        setSources(library.sources);
        setAssets(library.assets);
      })
      .catch((error) => {
        if (active) setMessage(error instanceof Error ? error.message : String(error));
      })
      .finally(() => {
        if (active) setIsLoaded(true);
      });
    return () => {
      active = false;
    };
  }, []);

  const normalizedQuery = query.trim().toLowerCase();
  const filteredSources = useMemo(() => {
    return sources.filter((source) => {
      const matchesCategory = sourceCategory === 'all' || source.category === sourceCategory;
      const matchesRegion = sourceRegion === 'all' || source.region === sourceRegion;
      const haystack = [source.name, source.url, source.note ?? '', ...source.tags].join(' ').toLowerCase();
      return matchesCategory && matchesRegion && (!normalizedQuery || haystack.includes(normalizedQuery));
    });
  }, [normalizedQuery, sourceCategory, sourceRegion, sources]);

  const filteredAssets = useMemo(() => {
    return assets.filter((asset) => {
      const prompt = asset.originalPrompt || asset.inferredPrompt || '';
      const haystack = [
        asset.title,
        asset.sourceUrl ?? '',
        asset.sourcePlatform ?? '',
        asset.author ?? '',
        prompt,
        asset.note ?? '',
        ...asset.tags
      ]
        .join(' ')
        .toLowerCase();
      const matchesLicense = assetLicense === 'all' || asset.licenseStatus === assetLicense;
      return matchesLicense && (!normalizedQuery || haystack.includes(normalizedQuery));
    });
  }, [assetLicense, assets, normalizedQuery]);

  function resetSourceDraft() {
    setSourceDraft(emptySourceDraft);
  }

  function updateAssetDraftFromFile(file: File | null) {
    setAssetFile(file);
    if (file && !assetDraft.title.trim()) {
      setAssetDraft((current) => ({ ...current, title: file.name.replace(/\.[^.]+$/, '') }));
    }
  }

  async function submitSource() {
    const name = sourceDraft.name.trim();
    const url = sourceDraft.url.trim();
    if (!name || !url) {
      setMessage('请填写网站名称和 URL。');
      return;
    }
    try {
      const now = String(Date.now());
      const saved = await saveInspirationSource({
        id: sourceDraft.id || timestampId('source'),
        name,
        url,
        category: sourceDraft.category,
        region: sourceDraft.region,
        tags: parseTags(sourceDraft.tags),
        note: sourceDraft.note.trim() || undefined,
        requiresLogin: sourceDraft.requiresLogin,
        commercialReference: sourceDraft.commercialReference,
        createdAt: sourceDraft.id ? now : now,
        updatedAt: now
      });
      setSources((current) => [saved, ...current.filter((item) => item.id !== saved.id)]);
      resetSourceDraft();
      setMessage('灵感网站已保存。');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    }
  }

  async function openSource(source: InspirationSource) {
    try {
      await openExternalUrl(source.url);
      const saved = await saveInspirationSource({ ...source, lastOpenedAt: String(Date.now()) });
      setSources((current) => current.map((item) => (item.id === saved.id ? saved : item)));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    }
  }

  async function copyText(label: string, value?: string) {
    if (!value) return;
    try {
      await navigator.clipboard?.writeText(value);
      setMessage(`${label} 已复制。`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    }
  }

  function editSource(source: InspirationSource) {
    setActiveTab('sources');
    setSourceDraft({
      id: source.id,
      name: source.name,
      url: source.url,
      category: source.category,
      region: source.region,
      tags: tagsToText(source.tags),
      note: source.note ?? '',
      requiresLogin: Boolean(source.requiresLogin),
      commercialReference: source.commercialReference
    });
  }

  async function removeSource(sourceId: string) {
    props.onRequestConfirm({
      title: '删除灵感网站',
      message: '确定删除这个灵感网站吗？删除后它会从灵感中心的网站列表中移除。',
      confirmLabel: '删除',
      tone: 'danger',
      onConfirm: async () => {
        try {
          await deleteInspirationSource(sourceId);
          setSources((current) => current.filter((source) => source.id !== sourceId));
          setMessage('灵感网站已删除。');
        } catch (error) {
          setMessage(error instanceof Error ? error.message : String(error));
          throw error;
        }
      }
    });
  }

  async function importAsset() {
    if (!assetFile) {
      setMessage('请先选择、拖入或粘贴一张图片。');
      return;
    }
    setIsImporting(true);
    try {
      const dataUrl = await fileToDataUrl(assetFile);
      const saved = await importInspirationAsset({
        title: assetDraft.title.trim() || assetFile.name.replace(/\.[^.]+$/, ''),
        dataUrl,
        fileName: assetFile.name,
        sourceUrl: assetDraft.sourceUrl.trim() || undefined,
        sourcePlatform: assetDraft.sourcePlatform.trim() || undefined,
        author: assetDraft.author.trim() || undefined,
        originalPrompt: assetDraft.originalPrompt.trim() || undefined,
        tags: parseTags(assetDraft.tags),
        note: assetDraft.note.trim() || undefined,
        licenseStatus: assetDraft.licenseStatus
      });
      setAssets((current) => [saved, ...current]);
      setAssetDraft(emptyAssetDraft);
      setAssetFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      setMessage('灵感图片已导入。');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setIsImporting(false);
    }
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    const file = firstImageFile(event.dataTransfer.files);
    if (!file) {
      setMessage('只支持拖入图片文件。');
      return;
    }
    updateAssetDraftFromFile(file);
    setMessage('已读取拖入图片，补充信息后可导入。');
  }

  function handlePaste(event: ClipboardEvent<HTMLDivElement>) {
    const file = firstImageFile(Array.from(event.clipboardData.files));
    if (!file) return;
    updateAssetDraftFromFile(file);
    setMessage('已读取剪贴板图片，补充信息后可导入。');
  }

  function startEditAsset(asset: InspirationAsset) {
    setEditingAssetId(asset.id);
    setAssetDraft({
      title: asset.title,
      sourceUrl: asset.sourceUrl ?? '',
      sourcePlatform: asset.sourcePlatform ?? '',
      author: asset.author ?? '',
      originalPrompt: asset.originalPrompt ?? asset.inferredPrompt ?? '',
      tags: tagsToText(asset.tags),
      note: asset.note ?? '',
      licenseStatus: asset.licenseStatus
    });
    setAssetFile(null);
  }

  function cancelAssetEdit() {
    setEditingAssetId(null);
    setAssetDraft(emptyAssetDraft);
    setAssetFile(null);
  }

  async function updateAssetMetadata() {
    const target = assets.find((asset) => asset.id === editingAssetId);
    if (!target) return;
    try {
      const saved = await saveInspirationAsset({
        ...target,
        title: assetDraft.title.trim() || target.title,
        sourceUrl: assetDraft.sourceUrl.trim() || undefined,
        sourcePlatform: assetDraft.sourcePlatform.trim() || undefined,
        author: assetDraft.author.trim() || undefined,
        originalPrompt: assetDraft.originalPrompt.trim() || undefined,
        tags: parseTags(assetDraft.tags),
        note: assetDraft.note.trim() || undefined,
        licenseStatus: assetDraft.licenseStatus
      });
      setAssets((current) => current.map((asset) => (asset.id === saved.id ? saved : asset)));
      cancelAssetEdit();
      setMessage('灵感图片信息已更新。');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    }
  }

  async function removeAsset(assetId: string) {
    props.onRequestConfirm({
      title: '删除灵感收藏',
      message: '确定删除这条灵感收藏吗？这只会删除 VisionHub 记录，不会删除已导入的图片文件。',
      confirmLabel: '删除',
      tone: 'danger',
      onConfirm: async () => {
        try {
          await deleteInspirationAsset(assetId);
          setAssets((current) => current.filter((asset) => asset.id !== assetId));
          if (editingAssetId === assetId) cancelAssetEdit();
          setMessage('灵感收藏已删除。');
        } catch (error) {
          setMessage(error instanceof Error ? error.message : String(error));
          throw error;
        }
      }
    });
  }

  function assetPrompt(asset: InspirationAsset) {
    return asset.originalPrompt || asset.inferredPrompt || '';
  }

  function createTemplate(asset: InspirationAsset) {
    const prompt = assetPrompt(asset);
    if (!prompt) {
      setMessage('这张灵感图还没有 Prompt，先补充 Prompt 后再转模板。');
      return;
    }
    const result = props.onCreateTemplate(asset.title, prompt, asset.tags);
    setMessage(result);
  }

  return (
    <div className="inspirationPage" onDragOver={(event) => event.preventDefault()} onDrop={handleDrop} onPaste={handlePaste}>
      <header className="topbar inspirationTopbar">
        <div className="pageTitleBlock">
          <p className="eyebrow">Inspiration Center</p>
          <h1>灵感中心</h1>
          <p>管理提示词网站、参考来源和优秀 AI 图片收藏。</p>
        </div>
        <div className="statusPills">
          <span><Link2 size={15} /> {sources.length} 个网站</span>
          <span><Bookmark size={15} /> {assets.length} 张收藏</span>
          <span><Sparkles size={15} /> 本地持久化</span>
        </div>
      </header>

      <section className="inspirationTabs" aria-label="灵感中心分类">
        <button className={activeTab === 'sources' ? 'active' : ''} onClick={() => setActiveTab('sources')}>
          <Link2 size={15} /> 提示词网站
        </button>
        <button className={activeTab === 'assets' ? 'active' : ''} onClick={() => setActiveTab('assets')}>
          <Bookmark size={15} /> 图片收藏
        </button>
      </section>

      <section className="inspirationToolbar">
        <label className="librarySearchBox">
          <span>搜索</span>
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="名称 / URL / Prompt / 标签" />
        </label>
        {activeTab === 'sources' ? (
          <>
            <label>
              <span>类型</span>
              <StudioSelect value={sourceCategory} onChange={(value) => setSourceCategory(value as typeof sourceCategory)} options={sourceCategoryOptions} />
            </label>
            <label>
              <span>地区</span>
              <StudioSelect value={sourceRegion} onChange={(value) => setSourceRegion(value as typeof sourceRegion)} options={regionOptions} />
            </label>
          </>
        ) : (
          <label>
            <span>授权备注</span>
            <StudioSelect value={assetLicense} onChange={(value) => setAssetLicense(value as typeof assetLicense)} options={licenseOptions} />
          </label>
        )}
      </section>

      {activeTab === 'sources' ? (
        <section className="inspirationLayout">
          <article className="inspirationPanel">
            <div className="panelTitleRow">
              <strong>{sourceDraft.id ? '编辑灵感网站' : '添加灵感网站'}</strong>
              {sourceDraft.id ? <button className="iconMiniButton" title="取消编辑来源" aria-label="取消编辑来源" onClick={resetSourceDraft}><X size={13} /></button> : null}
            </div>
            <label><span>名称</span><input value={sourceDraft.name} onChange={(event) => setSourceDraft({ ...sourceDraft, name: event.target.value })} placeholder="例如：自用提示词收藏站" /></label>
            <label><span>URL</span><input value={sourceDraft.url} onChange={(event) => setSourceDraft({ ...sourceDraft, url: event.target.value })} placeholder="https://..." /></label>
            <div className="inspirationFormGrid">
              <label><span>类型</span><StudioSelect value={sourceDraft.category} onChange={(value) => setSourceDraft({ ...sourceDraft, category: value as InspirationSourceCategory })} options={sourceCategoryOptions.filter((option) => option.value !== 'all') as Array<{ value: InspirationSourceCategory; label: string }>} /></label>
              <label><span>地区</span><StudioSelect value={sourceDraft.region} onChange={(value) => setSourceDraft({ ...sourceDraft, region: value as InspirationRegion })} options={regionOptions.filter((option) => option.value !== 'all') as Array<{ value: InspirationRegion; label: string }>} /></label>
            </div>
            <label><span>标签</span><input value={sourceDraft.tags} onChange={(event) => setSourceDraft({ ...sourceDraft, tags: event.target.value })} placeholder="商业，角色，构图" /></label>
            <label><span>备注</span><textarea value={sourceDraft.note} onChange={(event) => setSourceDraft({ ...sourceDraft, note: event.target.value })} rows={3} placeholder="登录要求、常用分类、适合场景" /></label>
            <label className="inspirationCheck"><input type="checkbox" checked={sourceDraft.requiresLogin} onChange={(event) => setSourceDraft({ ...sourceDraft, requiresLogin: event.target.checked })} /><span>需要登录</span></label>
            <label><span>商用备注</span><StudioSelect value={sourceDraft.commercialReference} onChange={(value) => setSourceDraft({ ...sourceDraft, commercialReference: value as InspirationCommercialReference })} options={commercialReferenceOptions} /></label>
            <button className="rowActionButton primaryAction" onClick={() => void submitSource()}><Save size={15} /> 保存网站</button>
          </article>

          <section className="inspirationGrid sourceGrid">
            {!isLoaded ? (
              <div className="emptyState libraryEmpty"><Sparkles size={42} /><h3>正在加载灵感网站</h3></div>
            ) : filteredSources.length === 0 ? (
              <div className="emptyState libraryEmpty"><Link2 size={42} /><h3>还没有灵感网站</h3><p>先添加你常用的提示词模板站、模型社区或图片参考站。</p></div>
            ) : filteredSources.map((source) => (
              <article className="inspirationCard sourceCard" key={source.id}>
                <div className="sourceCardHeader">
                  <strong title={source.name}>{source.name}</strong>
                  <span>{categoryLabel(source.category)} / {regionLabel(source.region)}</span>
                </div>
                <p title={source.url}>{source.url}</p>
                {source.note ? <small title={source.note}>{source.note}</small> : null}
                <div className="templateTags">{source.tags.map((tag) => <span key={tag}>{tag}</span>)}</div>
                <div className="cardActions inspirationActions">
                  <button className="miniButton primaryMini" onClick={() => void openSource(source)}><ExternalLink size={13} /> 打开</button>
                  <button className="miniButton" onClick={() => void copyText('URL', source.url)}><Copy size={13} /> 复制</button>
                  <button className="miniButton" onClick={() => editSource(source)}><Edit3 size={13} /> 编辑</button>
                  <button className="miniButton dangerText" onClick={() => void removeSource(source.id)}><Trash2 size={13} /> 删除</button>
                </div>
              </article>
            ))}
          </section>
        </section>
      ) : (
        <section className="inspirationLayout">
          <article className="inspirationPanel assetImportPanel">
            <div className="panelTitleRow">
              <strong>{editingAssetId ? '编辑图片收藏' : '导入图片收藏'}</strong>
              {editingAssetId ? <button className="iconMiniButton" title="取消编辑灵感素材" aria-label="取消编辑灵感素材" onClick={cancelAssetEdit}><X size={13} /></button> : null}
            </div>
            {!editingAssetId ? (
              <button className={`inspirationDropZone ${assetFile ? 'hasFile' : ''}`} onClick={() => fileInputRef.current?.click()} type="button">
                <Upload size={22} />
                <strong>{assetFile ? assetFile.name : '选择 / 拖入 / 粘贴图片'}</strong>
                <span>支持 PNG、JPG、WebP；图片会保存到 VisionHub 本地数据目录。</span>
              </button>
            ) : null}
            <input ref={fileInputRef} type="file" accept="image/*" hidden onChange={(event) => updateAssetDraftFromFile(firstImageFile(event.target.files))} />
            <label><span>标题</span><input value={assetDraft.title} onChange={(event) => setAssetDraft({ ...assetDraft, title: event.target.value })} placeholder="图片主题或用途" /></label>
            <div className="inspirationFormGrid">
              <label><span>来源平台</span><input value={assetDraft.sourcePlatform} onChange={(event) => setAssetDraft({ ...assetDraft, sourcePlatform: event.target.value })} placeholder="平台/作者页" /></label>
              <label><span>作者</span><input value={assetDraft.author} onChange={(event) => setAssetDraft({ ...assetDraft, author: event.target.value })} placeholder="可选" /></label>
            </div>
            <label><span>来源 URL</span><input value={assetDraft.sourceUrl} onChange={(event) => setAssetDraft({ ...assetDraft, sourceUrl: event.target.value })} placeholder="https://..." /></label>
            <label><span>Prompt</span><textarea value={assetDraft.originalPrompt} onChange={(event) => setAssetDraft({ ...assetDraft, originalPrompt: event.target.value })} rows={4} placeholder="收集到的原提示词，后续可一键套用或转模板" /></label>
            <label><span>标签</span><input value={assetDraft.tags} onChange={(event) => setAssetDraft({ ...assetDraft, tags: event.target.value })} placeholder="角色，海报，赛博朋克" /></label>
            <label><span>备注</span><textarea value={assetDraft.note} onChange={(event) => setAssetDraft({ ...assetDraft, note: event.target.value })} rows={3} placeholder="可记录构图、镜头、风格重点" /></label>
            <label><span>授权备注</span><StudioSelect value={assetDraft.licenseStatus} onChange={(value) => setAssetDraft({ ...assetDraft, licenseStatus: value as InspirationLicenseStatus })} options={licenseOptions.filter((option) => option.value !== 'all') as Array<{ value: InspirationLicenseStatus; label: string }>} /></label>
            {editingAssetId ? (
              <button className="rowActionButton primaryAction" onClick={() => void updateAssetMetadata()}><Save size={15} /> 保存修改</button>
            ) : (
              <button className="rowActionButton primaryAction" disabled={isImporting} onClick={() => void importAsset()}><Plus size={15} /> {isImporting ? '导入中…' : '导入收藏'}</button>
            )}
          </article>

          <section className="inspirationGrid assetGrid">
            {!isLoaded ? (
              <div className="emptyState libraryEmpty"><Sparkles size={42} /><h3>正在加载图片收藏</h3></div>
            ) : filteredAssets.length === 0 ? (
              <div className="emptyState libraryEmpty"><Bookmark size={42} /><h3>还没有图片收藏</h3><p>把喜欢的 AI 图片拖进来，建立自己的风格参考库。</p></div>
            ) : filteredAssets.map((asset) => {
              const prompt = assetPrompt(asset);
              return (
                <article className="inspirationCard assetCard" key={asset.id}>
                  {asset.imageUrl ? (
                    <button className="libraryThumb inspirationAssetThumb" onClick={() => props.onPreview(asset.imageUrl!)}>
                      <img src={asset.imageUrl} alt={asset.title} />
                      <span><Maximize2 size={15} /> 预览</span>
                    </button>
                  ) : (
                    <div className="libraryFailedThumb">图片不可用</div>
                  )}
                  <div className="assetCardBody">
                    <div className="sourceCardHeader">
                      <strong title={asset.title}>{asset.title}</strong>
                      <span>{licenseLabel(asset.licenseStatus)}</span>
                    </div>
                    <p title={prompt || asset.note || ''}>{prompt || asset.note || '未记录 Prompt，可先作为视觉参考。'}</p>
                    <div className="templateTags">{asset.tags.map((tag) => <span key={tag}>{tag}</span>)}</div>
                    <div className="cardActions inspirationActions">
                      <button className="miniButton primaryMini" disabled={!asset.imageUrl} onClick={() => props.onUseAsReference(asset)}><ImagePlus size={13} /> 参考</button>
                      <button className="miniButton" disabled={!prompt} onClick={() => props.onUsePrompt(prompt)}><Sparkles size={13} /> 套用</button>
                      <button className="miniButton" disabled={!prompt} onClick={() => createTemplate(asset)}><Bookmark size={13} /> 模板</button>
                      <button className="miniButton" disabled={!prompt} onClick={() => void copyText('Prompt', prompt)}><Copy size={13} /> Prompt</button>
                      <button className="miniButton" onClick={() => startEditAsset(asset)}><Edit3 size={13} /> 编辑</button>
                      <button className="miniButton dangerText" onClick={() => void removeAsset(asset.id)}><Trash2 size={13} /> 删除</button>
                    </div>
                  </div>
                </article>
              );
            })}
          </section>
        </section>
      )}
    </div>
  );
}
