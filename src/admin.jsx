import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './admin.css';

const tabs = [
  { id: 'overview', label: '概览' },
  { id: 'cases', label: '案例' },
  { id: 'categories', label: '分类' },
  { id: 'templates', label: '模板' },
  { id: 'tags', label: '标签' },
  { id: 'apiKeys', label: 'API Key' }
];

const emptyCase = {
  id: '',
  title: '',
  image: '',
  imageAlt: '',
  sourceLabel: '',
  sourceUrl: '',
  prompt: '',
  promptPreview: '',
  category: '',
  styles: [],
  scenes: [],
  featured: false,
  usageCount: 0,
  favoriteCount: 0,
  status: 'published'
};

const emptyCategory = {
  value: '',
  title: { zh: '', en: '' },
  description: { zh: '', en: '' },
  cover: '',
  anchor: '',
  templateAnchor: '',
  sortOrder: 0
};

const emptyTemplate = {
  id: '',
  title: { zh: '', en: '' },
  description: { zh: '', en: '' },
  category: '',
  anchor: '',
  cover: '',
  styles: [],
  scenes: [],
  tags: [],
  useWhen: { zh: '', en: '' },
  guidance: { zh: [], en: [] },
  pitfalls: { zh: [], en: [] },
  exampleCases: [],
  prompt: '',
  sortOrder: 0
};

const emptyTag = {
  value: '',
  kind: 'style',
  title: { zh: '', en: '' },
  keywords: [],
  sortOrder: 0
};

async function api(path, options = {}) {
  const response = await fetch(path, {
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {})
    },
    ...options,
    body: options.body && typeof options.body !== 'string' ? JSON.stringify(options.body) : options.body
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || payload.message || '请求失败');
  return payload;
}

function csv(value) {
  return Array.isArray(value) ? value.join(', ') : String(value || '');
}

function parseCsv(value) {
  return String(value || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseIntegerCsv(value) {
  return parseCsv(value)
    .map(Number)
    .filter(Number.isFinite);
}

function textValue(value, language = 'zh') {
  if (!value) return '';
  if (typeof value === 'string') return value;
  return value[language] || value.zh || value.en || '';
}

function setTextObject(object, language, value) {
  return {
    ...(typeof object === 'object' && object ? object : {}),
    [language]: value
  };
}

function compactPrompt(prompt) {
  return String(prompt || '').replace(/\s+/g, ' ').trim().slice(0, 220);
}

function normalizeCase(item) {
  return {
    ...emptyCase,
    ...item,
    id: item?.id ?? '',
    styles: Array.isArray(item?.styles) ? item.styles : [],
    scenes: Array.isArray(item?.scenes) ? item.scenes : [],
    usageCount: Number(item?.usageCount || 0),
    favoriteCount: Number(item?.favoriteCount || 0)
  };
}

function normalizeCategory(item) {
  return {
    ...emptyCategory,
    ...item,
    title: item?.title || emptyCategory.title,
    description: item?.description || emptyCategory.description
  };
}

function normalizeTemplate(item) {
  return {
    ...emptyTemplate,
    ...item,
    title: item?.title || emptyTemplate.title,
    description: item?.description || emptyTemplate.description,
    useWhen: item?.useWhen || emptyTemplate.useWhen,
    guidance: item?.guidance || emptyTemplate.guidance,
    pitfalls: item?.pitfalls || emptyTemplate.pitfalls,
    styles: Array.isArray(item?.styles) ? item.styles : [],
    scenes: Array.isArray(item?.scenes) ? item.scenes : [],
    tags: Array.isArray(item?.tags) ? item.tags : [],
    exampleCases: Array.isArray(item?.exampleCases) ? item.exampleCases : []
  };
}

function normalizeTag(item) {
  return {
    ...emptyTag,
    ...item,
    title: item?.title || emptyTag.title,
    keywords: Array.isArray(item?.keywords) ? item.keywords : []
  };
}

function Field({ label, children, span = false, hint = '' }) {
  return (
    <label className={span ? 'field full' : 'field'}>
      <span>{label}</span>
      {children}
      {hint ? <em>{hint}</em> : null}
    </label>
  );
}

function TextInput({ value, onChange, placeholder = '' }) {
  return <input value={value || ''} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} />;
}

function TextArea({ value, onChange, rows = 5, placeholder = '' }) {
  return <textarea rows={rows} value={value || ''} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} />;
}

function SelectInput({ value, onChange, options }) {
  return (
    <select value={value || ''} onChange={(event) => onChange(event.target.value)}>
      {options.map((option) => (
        <option value={option.value} key={option.value}>{option.label}</option>
      ))}
    </select>
  );
}

function ImagePreview({ src, alt = '', compact = false }) {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [src]);

  const normalizedSrc = String(src || '').trim();
  if (!normalizedSrc || failed) {
    return (
      <div className={compact ? 'imagePreview compact empty' : 'imagePreview empty'}>
        <span>{normalizedSrc ? '图片无法加载' : '暂无图片'}</span>
      </div>
    );
  }

  return (
    <a className={compact ? 'imagePreview compact' : 'imagePreview'} href={normalizedSrc} target="_blank" rel="noreferrer">
      <img src={normalizedSrc} alt={alt || 'case preview'} onError={() => setFailed(true)} />
    </a>
  );
}

function Login({ onLogin }) {
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      await api('/api/admin/auth/login', { method: 'POST', body: { username, password } });
      onLogin();
    } catch (loginError) {
      setError(loginError.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="loginWrap">
      <form className="loginCard" onSubmit={submit}>
        <div>
          <h1>管理后台登录</h1>
          <p>使用配置文件或环境变量里的管理员账号进入内容管理系统。</p>
        </div>
        <Field label="管理员账号">
          <TextInput value={username} onChange={setUsername} />
        </Field>
        <Field label="管理员密码">
          <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} />
        </Field>
        {error ? <div className="notice error">{error}</div> : null}
        <button className="primaryButton" type="submit" disabled={busy}>{busy ? '登录中...' : '登录'}</button>
      </form>
    </div>
  );
}

function Overview({ onNavigate }) {
  const [summary, setSummary] = useState(null);
  const [message, setMessage] = useState('');

  async function load() {
    setMessage('');
    try {
      const payload = await api('/api/admin/summary');
      setSummary(payload.data);
    } catch (error) {
      setMessage(error.message);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const cards = [
    { label: '全部案例', value: summary?.cases?.total ?? '-', hint: `已发布 ${summary?.cases?.published ?? '-'} / 草稿 ${summary?.cases?.draft ?? '-'}`, tab: 'cases' },
    { label: '推荐案例', value: summary?.cases?.featured ?? '-', hint: '首页与精选内容池', tab: 'cases' },
    { label: '总使用次数', value: summary?.cases?.usage_count ?? '-', hint: '外部 API 上报累计', tab: 'cases' },
    { label: '总收藏数', value: summary?.cases?.favorite_count ?? '-', hint: '外部 API 上报累计', tab: 'cases' },
    { label: '分类', value: summary?.categories ?? '-', hint: '案例与模板的主导航', tab: 'categories' },
    { label: '模板', value: summary?.templates ?? '-', hint: '可复用 Prompt 结构', tab: 'templates' },
    { label: '风格标签', value: summary?.styles ?? '-', hint: '用于筛选和模板匹配', tab: 'tags' },
    { label: '场景标签', value: summary?.scenes ?? '-', hint: '用于搜索和外部 API', tab: 'tags' },
    { label: 'API Key', value: summary?.apiKeys?.active ?? '-', hint: `总数 ${summary?.apiKeys?.total ?? '-'}`, tab: 'apiKeys' }
  ];

  return (
    <div className="contentPanel">
      <div className="heroPanel">
        <div>
          <span className="eyebrow">Self-hosted CMS</span>
          <h2>内容、模板与外部 API 统一管理</h2>
          <p>这里的数据来自 PostgreSQL。前台会优先读取动态 API，外部项目也可以通过 API Key 获取分类、模板和案例。</p>
        </div>
        <button className="secondaryButton" type="button" onClick={load}>刷新概览</button>
      </div>
      {message ? <div className="notice error">{message}</div> : null}
      <div className="metricGrid">
        {cards.map((card) => (
          <button className="metricCard" type="button" onClick={() => onNavigate(card.tab)} key={card.label}>
            <span>{card.label}</span>
            <strong>{card.value}</strong>
            <em>{card.hint}</em>
          </button>
        ))}
      </div>
      <div className="helpGrid">
        <div className="helpCard">
          <h3>公开 API 示例</h3>
          <pre>{`GET /api/v1/cases?q=poster&sort=popular&page=1&pageSize=20
GET /api/v1/categories
GET /api/v1/templates
GET /api/v1/search?q=海报&sort=favorites
POST /api/v1/cases/484/use
POST /api/v1/cases/484/favorite`}</pre>
        </div>
        <div className="helpCard">
          <h3>管理建议</h3>
          <p>先维护分类和标签，再录入模板与案例。案例可以设为 draft 暂存，确认图片、来源和 Prompt 后再发布。</p>
        </div>
      </div>
    </div>
  );
}

function EditorShell({ title, subtitle, children, onSave, onCancel, busy }) {
  return (
    <form className="editorPanel" onSubmit={(event) => { event.preventDefault(); onSave(); }}>
      <div className="editorHead full">
        <div>
          <h3>{title}</h3>
          <p>{subtitle}</p>
        </div>
        <div className="rowActions">
          <button className="primaryButton" type="submit" disabled={busy}>{busy ? '保存中...' : '保存'}</button>
          <button className="secondaryButton" type="button" onClick={onCancel}>取消</button>
        </div>
      </div>
      {children}
    </form>
  );
}

function CaseEditor({ value, onChange, onSave, onCancel, categories, styles, scenes, busy }) {
  const item = normalizeCase(value);
  const categoryOptions = [{ value: '', label: '未分类' }, ...categories.map((category) => ({ value: category.value, label: textValue(category.title) || category.value }))];

  return (
    <EditorShell title={item.__new ? '新增案例' : `编辑案例 #${item.id}`} subtitle="维护展示图、来源、Prompt、筛选标签和发布状态。" onSave={() => onSave({ ...item, promptPreview: item.promptPreview || compactPrompt(item.prompt) })} onCancel={onCancel} busy={busy}>
      <Field label="案例 ID">
        <TextInput value={item.id} onChange={(id) => onChange({ ...item, id })} />
      </Field>
      <Field label="标题">
        <TextInput value={item.title} onChange={(title) => onChange({ ...item, title })} />
      </Field>
      <Field label="分类">
        <SelectInput value={item.category} onChange={(category) => onChange({ ...item, category })} options={categoryOptions} />
      </Field>
      <Field label="状态">
        <SelectInput value={item.status} onChange={(status) => onChange({ ...item, status })} options={[
          { value: 'published', label: '发布' },
          { value: 'draft', label: '草稿' },
          { value: 'archived', label: '归档' }
        ]} />
      </Field>
      <Field label="图片路径">
        <TextInput value={item.image} onChange={(image) => onChange({ ...item, image })} placeholder="/images/case001.jpg" />
      </Field>
      <div className="previewField">
        <span>图片预览</span>
        <ImagePreview src={item.image} alt={item.imageAlt || item.title} />
      </div>
      <Field label="图片说明">
        <TextInput value={item.imageAlt} onChange={(imageAlt) => onChange({ ...item, imageAlt })} />
      </Field>
      <Field label="来源名称">
        <TextInput value={item.sourceLabel} onChange={(sourceLabel) => onChange({ ...item, sourceLabel })} />
      </Field>
      <Field label="来源 URL">
        <TextInput value={item.sourceUrl} onChange={(sourceUrl) => onChange({ ...item, sourceUrl })} />
      </Field>
      <Field label="风格标签" hint={`可选：${styles.slice(0, 8).map((tag) => tag.value).join(', ')}`}>
        <TextInput value={csv(item.styles)} onChange={(value) => onChange({ ...item, styles: parseCsv(value) })} />
      </Field>
      <Field label="场景标签" hint={`可选：${scenes.slice(0, 8).map((tag) => tag.value).join(', ')}`}>
        <TextInput value={csv(item.scenes)} onChange={(value) => onChange({ ...item, scenes: parseCsv(value) })} />
      </Field>
      <Field label="推荐">
        <SelectInput value={String(Boolean(item.featured))} onChange={(featured) => onChange({ ...item, featured: featured === 'true' })} options={[
          { value: 'false', label: '否' },
          { value: 'true', label: '是' }
        ]} />
      </Field>
      <Field label="使用次数">
        <TextInput value={item.usageCount} onChange={(usageCount) => onChange({ ...item, usageCount: Math.max(0, Number(usageCount) || 0) })} />
      </Field>
      <Field label="收藏数">
        <TextInput value={item.favoriteCount} onChange={(favoriteCount) => onChange({ ...item, favoriteCount: Math.max(0, Number(favoriteCount) || 0) })} />
      </Field>
      <Field label="GitHub URL">
        <TextInput value={item.githubUrl} onChange={(githubUrl) => onChange({ ...item, githubUrl })} />
      </Field>
      <Field label="Prompt 摘要" span>
        <TextArea value={item.promptPreview} onChange={(promptPreview) => onChange({ ...item, promptPreview })} rows={3} placeholder="留空会从 Prompt 自动截取" />
      </Field>
      <Field label="完整 Prompt" span>
        <TextArea value={item.prompt} onChange={(prompt) => onChange({ ...item, prompt, promptPreview: item.promptPreview || compactPrompt(prompt) })} rows={12} />
      </Field>
    </EditorShell>
  );
}

function CategoryEditor({ value, onChange, onSave, onCancel, busy }) {
  const item = normalizeCategory(value);
  return (
    <EditorShell title={item.__new ? '新增分类' : `编辑分类 ${item.value}`} subtitle="分类会影响前台筛选、模板归类和外部 API 返回。" onSave={() => onSave(item)} onCancel={onCancel} busy={busy}>
      <Field label="Value">
        <TextInput value={item.value} onChange={(value) => onChange({ ...item, value })} placeholder="Posters & Typography" />
      </Field>
      <Field label="排序">
        <TextInput value={item.sortOrder} onChange={(sortOrder) => onChange({ ...item, sortOrder: Number(sortOrder) })} />
      </Field>
      <Field label="中文标题">
        <TextInput value={textValue(item.title, 'zh')} onChange={(value) => onChange({ ...item, title: setTextObject(item.title, 'zh', value) })} />
      </Field>
      <Field label="英文标题">
        <TextInput value={textValue(item.title, 'en')} onChange={(value) => onChange({ ...item, title: setTextObject(item.title, 'en', value) })} />
      </Field>
      <Field label="封面路径">
        <TextInput value={item.cover} onChange={(cover) => onChange({ ...item, cover })} />
      </Field>
      <Field label="画廊锚点">
        <TextInput value={item.anchor} onChange={(anchor) => onChange({ ...item, anchor })} />
      </Field>
      <Field label="模板锚点">
        <TextInput value={item.templateAnchor} onChange={(templateAnchor) => onChange({ ...item, templateAnchor })} />
      </Field>
      <Field label="中文描述">
        <TextArea value={textValue(item.description, 'zh')} onChange={(value) => onChange({ ...item, description: setTextObject(item.description, 'zh', value) })} rows={3} />
      </Field>
      <Field label="英文描述" span>
        <TextArea value={textValue(item.description, 'en')} onChange={(value) => onChange({ ...item, description: setTextObject(item.description, 'en', value) })} rows={3} />
      </Field>
    </EditorShell>
  );
}

function TemplateEditor({ value, onChange, onSave, onCancel, categories, styles, scenes, busy }) {
  const item = normalizeTemplate(value);
  const categoryOptions = [{ value: '', label: '未分类' }, ...categories.map((category) => ({ value: category.value, label: textValue(category.title) || category.value }))];
  return (
    <EditorShell title={item.__new ? '新增模板' : `编辑模板 ${item.id}`} subtitle="模板面向 Prompt 复用和 Agent 选择，建议补齐中英文说明、适用场景和防坑规则。" onSave={() => onSave(item)} onCancel={onCancel} busy={busy}>
      <Field label="模板 ID">
        <TextInput value={item.id} onChange={(id) => onChange({ ...item, id })} />
      </Field>
      <Field label="分类">
        <SelectInput value={item.category} onChange={(category) => onChange({ ...item, category })} options={categoryOptions} />
      </Field>
      <Field label="中文标题">
        <TextInput value={textValue(item.title, 'zh')} onChange={(value) => onChange({ ...item, title: setTextObject(item.title, 'zh', value) })} />
      </Field>
      <Field label="英文标题">
        <TextInput value={textValue(item.title, 'en')} onChange={(value) => onChange({ ...item, title: setTextObject(item.title, 'en', value) })} />
      </Field>
      <Field label="封面路径">
        <TextInput value={item.cover} onChange={(cover) => onChange({ ...item, cover })} />
      </Field>
      <Field label="排序">
        <TextInput value={item.sortOrder} onChange={(sortOrder) => onChange({ ...item, sortOrder: Number(sortOrder) })} />
      </Field>
      <Field label="风格标签" hint={`可选：${styles.slice(0, 8).map((tag) => tag.value).join(', ')}`}>
        <TextInput value={csv(item.styles)} onChange={(value) => onChange({ ...item, styles: parseCsv(value) })} />
      </Field>
      <Field label="场景标签" hint={`可选：${scenes.slice(0, 8).map((tag) => tag.value).join(', ')}`}>
        <TextInput value={csv(item.scenes)} onChange={(value) => onChange({ ...item, scenes: parseCsv(value) })} />
      </Field>
      <Field label="通用标签">
        <TextInput value={csv(item.tags)} onChange={(value) => onChange({ ...item, tags: parseCsv(value) })} />
      </Field>
      <Field label="关联案例 ID">
        <TextInput value={csv(item.exampleCases)} onChange={(value) => onChange({ ...item, exampleCases: parseIntegerCsv(value) })} />
      </Field>
      <Field label="中文描述">
        <TextArea value={textValue(item.description, 'zh')} onChange={(value) => onChange({ ...item, description: setTextObject(item.description, 'zh', value) })} rows={3} />
      </Field>
      <Field label="英文描述">
        <TextArea value={textValue(item.description, 'en')} onChange={(value) => onChange({ ...item, description: setTextObject(item.description, 'en', value) })} rows={3} />
      </Field>
      <Field label="中文适用场景">
        <TextArea value={textValue(item.useWhen, 'zh')} onChange={(value) => onChange({ ...item, useWhen: setTextObject(item.useWhen, 'zh', value) })} rows={3} />
      </Field>
      <Field label="英文适用场景">
        <TextArea value={textValue(item.useWhen, 'en')} onChange={(value) => onChange({ ...item, useWhen: setTextObject(item.useWhen, 'en', value) })} rows={3} />
      </Field>
      <Field label="模板 Prompt" span>
        <TextArea value={item.prompt} onChange={(prompt) => onChange({ ...item, prompt })} rows={12} />
      </Field>
      <Field label="使用建议 JSON" hint='示例：{"zh":["建议一"],"en":["Tip"]}'>
        <TextArea value={JSON.stringify(item.guidance || {}, null, 2)} onChange={(value) => {
          try { onChange({ ...item, guidance: JSON.parse(value) }); } catch { onChange({ ...item }); }
        }} rows={6} />
      </Field>
      <Field label="防坑指南 JSON">
        <TextArea value={JSON.stringify(item.pitfalls || {}, null, 2)} onChange={(value) => {
          try { onChange({ ...item, pitfalls: JSON.parse(value) }); } catch { onChange({ ...item }); }
        }} rows={6} />
      </Field>
    </EditorShell>
  );
}

function TagEditor({ value, onChange, onSave, onCancel, busy }) {
  const item = normalizeTag(value);
  return (
    <EditorShell title={item.__new ? '新增标签' : `编辑标签 ${item.value}`} subtitle="标签用于案例筛选、模板匹配和外部 API 搜索。" onSave={() => onSave(item)} onCancel={onCancel} busy={busy}>
      <Field label="类型">
        <SelectInput value={item.kind} onChange={(kind) => onChange({ ...item, kind })} options={[
          { value: 'style', label: '风格 style' },
          { value: 'scene', label: '场景 scene' }
        ]} />
      </Field>
      <Field label="Value">
        <TextInput value={item.value} onChange={(value) => onChange({ ...item, value })} placeholder="Poster" />
      </Field>
      <Field label="中文标题">
        <TextInput value={textValue(item.title, 'zh')} onChange={(value) => onChange({ ...item, title: setTextObject(item.title, 'zh', value) })} />
      </Field>
      <Field label="英文标题">
        <TextInput value={textValue(item.title, 'en')} onChange={(value) => onChange({ ...item, title: setTextObject(item.title, 'en', value) })} />
      </Field>
      <Field label="关键词" hint="英文逗号分隔">
        <TextInput value={csv(item.keywords)} onChange={(value) => onChange({ ...item, keywords: parseCsv(value) })} />
      </Field>
      <Field label="排序">
        <TextInput value={item.sortOrder} onChange={(sortOrder) => onChange({ ...item, sortOrder: Number(sortOrder) })} />
      </Field>
    </EditorShell>
  );
}

function DataTable({ columns, rows, empty = '暂无数据' }) {
  return (
    <div className="tablePanel">
      <table>
        <thead>
          <tr>{columns.map((column) => <th key={column}>{column}</th>)}</tr>
        </thead>
        <tbody>
          {rows.length ? rows.map((row, index) => (
            <tr key={index}>{row.map((cell, cellIndex) => <td key={cellIndex}>{cell}</td>)}</tr>
          )) : (
            <tr><td colSpan={columns.length} className="emptyCell">{empty}</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function Toolbar({ children }) {
  return <div className="toolbar">{children}</div>;
}

function Pager({ pagination, onPage }) {
  if (!pagination) return null;
  const totalPages = Math.max(1, Math.ceil((pagination.total || 0) / pagination.pageSize));
  return (
    <div className="pager">
      <span>第 {pagination.page} / {totalPages} 页，共 {pagination.total} 条</span>
      <div className="rowActions">
        <button className="secondaryButton" type="button" disabled={pagination.page <= 1} onClick={() => onPage(pagination.page - 1)}>上一页</button>
        <button className="secondaryButton" type="button" disabled={pagination.page >= totalPages} onClick={() => onPage(pagination.page + 1)}>下一页</button>
      </div>
    </div>
  );
}

function CasesPanel({ categories, styles, scenes }) {
  const [items, setItems] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [filters, setFilters] = useState({ q: '', status: '', category: '', style: '', scene: '', sort: 'latest', page: 1 });
  const [editing, setEditing] = useState(null);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  async function load(nextFilters = filters) {
    setMessage('');
    const params = new URLSearchParams({
      page: String(nextFilters.page || 1),
      pageSize: '30'
    });
    for (const key of ['q', 'status', 'category', 'style', 'scene', 'sort']) {
      if (nextFilters[key]) params.set(key, nextFilters[key]);
    }
    const payload = await api(`/api/admin/cases?${params.toString()}`);
    setItems(payload.data || []);
    setPagination(payload.pagination);
  }

  useEffect(() => {
    load().catch((error) => setMessage(error.message));
  }, []);

  function applyFilters(event) {
    event?.preventDefault();
    const next = { ...filters, page: 1 };
    setFilters(next);
    load(next).catch((error) => setMessage(error.message));
  }

  async function save(item) {
    setBusy(true);
    try {
      const isNew = item.__new;
      const id = item.__originalId || item.id;
      const payload = { ...item };
      delete payload.__new;
      delete payload.__originalId;
      await api(isNew ? '/api/admin/cases' : `/api/admin/cases/${encodeURIComponent(id)}`, {
        method: isNew ? 'POST' : 'PUT',
        body: payload
      });
      setEditing(null);
      await load();
      setMessage('案例已保存。');
    } catch (error) {
      setMessage(error.message);
    } finally {
      setBusy(false);
    }
  }

  async function remove(item) {
    if (!window.confirm(`确定删除案例 #${item.id}？`)) return;
    await api(`/api/admin/cases/${encodeURIComponent(item.id)}`, { method: 'DELETE' });
    await load();
  }

  function gotoPage(page) {
    const next = { ...filters, page };
    setFilters(next);
    load(next).catch((error) => setMessage(error.message));
  }

  return (
    <div className="contentPanel">
      <Toolbar>
        <form className="filterForm" onSubmit={applyFilters}>
          <input placeholder="搜索标题、Prompt、来源" value={filters.q} onChange={(event) => setFilters({ ...filters, q: event.target.value })} />
          <select value={filters.status} onChange={(event) => setFilters({ ...filters, status: event.target.value })}>
            <option value="">全部状态</option>
            <option value="published">发布</option>
            <option value="draft">草稿</option>
            <option value="archived">归档</option>
          </select>
          <select value={filters.category} onChange={(event) => setFilters({ ...filters, category: event.target.value })}>
            <option value="">全部分类</option>
            {categories.map((item) => <option value={item.value} key={item.value}>{textValue(item.title) || item.value}</option>)}
          </select>
          <select value={filters.style} onChange={(event) => setFilters({ ...filters, style: event.target.value })}>
            <option value="">全部风格</option>
            {styles.map((item) => <option value={item.value} key={item.value}>{item.value}</option>)}
          </select>
          <select value={filters.scene} onChange={(event) => setFilters({ ...filters, scene: event.target.value })}>
            <option value="">全部场景</option>
            {scenes.map((item) => <option value={item.value} key={item.value}>{item.value}</option>)}
          </select>
          <select value={filters.sort} onChange={(event) => setFilters({ ...filters, sort: event.target.value })}>
            <option value="latest">最新 ID</option>
            <option value="usage">使用次数</option>
            <option value="favorites">收藏数</option>
            <option value="popular">综合热度</option>
            <option value="oldest">最早 ID</option>
          </select>
          <button className="secondaryButton" type="submit">筛选</button>
        </form>
        <button className="primaryButton" type="button" onClick={() => setEditing({ ...emptyCase, __new: true })}>新增案例</button>
      </Toolbar>
      {message ? <div className={message.includes('失败') || message.includes('ERROR') || message.includes('NOT') ? 'notice error' : 'notice'}>{message}</div> : null}
      {editing ? <CaseEditor value={editing} onChange={setEditing} onSave={save} onCancel={() => setEditing(null)} categories={categories} styles={styles} scenes={scenes} busy={busy} /> : null}
      <DataTable
        columns={['图片', 'ID', '标题', '分类', '状态', '统计', '标签', '操作']}
        rows={items.map((item) => [
          <ImagePreview src={item.image} alt={item.imageAlt || item.title} compact />,
          `#${item.id}`,
          <div className="titleCell"><strong>{item.title}</strong><span>{item.sourceLabel || '无来源'}</span></div>,
          item.category,
          <span className={`status ${item.status}`}>{item.status}</span>,
          <div className="statsCell">
            <span>使用 {item.usageCount || 0}</span>
            <span>收藏 {item.favoriteCount || 0}</span>
          </div>,
          <div className="chipWrap">{[...(item.styles || []), ...(item.scenes || [])].slice(0, 5).map((tag) => <span className="chip" key={tag}>{tag}</span>)}</div>,
          <div className="rowActions">
            <button className="secondaryButton" type="button" onClick={() => setEditing({ ...normalizeCase(item), __originalId: item.id })}>编辑</button>
            <button className="dangerButton" type="button" onClick={() => remove(item)}>删除</button>
          </div>
        ])}
      />
      <Pager pagination={pagination} onPage={gotoPage} />
    </div>
  );
}

function CategoriesPanel({ items, reload }) {
  const [editing, setEditing] = useState(null);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  async function save(item) {
    setBusy(true);
    try {
      const isNew = item.__new;
      const id = item.__originalValue || item.value;
      const payload = { ...item };
      delete payload.__new;
      delete payload.__originalValue;
      await api(isNew ? '/api/admin/categories' : `/api/admin/categories/${encodeURIComponent(id)}`, {
        method: isNew ? 'POST' : 'PUT',
        body: payload
      });
      setEditing(null);
      await reload();
      setMessage('分类已保存。');
    } catch (error) {
      setMessage(error.message);
    } finally {
      setBusy(false);
    }
  }

  async function remove(item) {
    if (!window.confirm(`确定删除分类 ${item.value}？`)) return;
    await api(`/api/admin/categories/${encodeURIComponent(item.value)}`, { method: 'DELETE' });
    await reload();
  }

  return (
    <div className="contentPanel">
      <Toolbar>
        <div><strong>分类管理</strong><p>分类会出现在前台筛选和外部 API。</p></div>
        <button className="primaryButton" type="button" onClick={() => setEditing({ ...emptyCategory, __new: true })}>新增分类</button>
      </Toolbar>
      {message ? <div className="notice">{message}</div> : null}
      {editing ? <CategoryEditor value={editing} onChange={setEditing} onSave={save} onCancel={() => setEditing(null)} busy={busy} /> : null}
      <DataTable
        columns={['排序', 'Value', '中文标题', '英文标题', '封面', '操作']}
        rows={items.map((item) => [
          item.sortOrder,
          item.value,
          textValue(item.title, 'zh'),
          textValue(item.title, 'en'),
          item.cover,
          <div className="rowActions">
            <button className="secondaryButton" type="button" onClick={() => setEditing({ ...normalizeCategory(item), __originalValue: item.value })}>编辑</button>
            <button className="dangerButton" type="button" onClick={() => remove(item)}>删除</button>
          </div>
        ])}
      />
    </div>
  );
}

function TemplatesPanel({ categories, styles, scenes }) {
  const [items, setItems] = useState([]);
  const [query, setQuery] = useState('');
  const [editing, setEditing] = useState(null);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  async function load() {
    const suffix = query ? `?q=${encodeURIComponent(query)}` : '';
    const payload = await api(`/api/admin/templates${suffix}`);
    setItems(payload.data || []);
  }

  useEffect(() => {
    load().catch((error) => setMessage(error.message));
  }, []);

  async function save(item) {
    setBusy(true);
    try {
      const isNew = item.__new;
      const id = item.__originalId || item.id;
      const payload = { ...item };
      delete payload.__new;
      delete payload.__originalId;
      await api(isNew ? '/api/admin/templates' : `/api/admin/templates/${encodeURIComponent(id)}`, {
        method: isNew ? 'POST' : 'PUT',
        body: payload
      });
      setEditing(null);
      await load();
      setMessage('模板已保存。');
    } catch (error) {
      setMessage(error.message);
    } finally {
      setBusy(false);
    }
  }

  async function remove(item) {
    if (!window.confirm(`确定删除模板 ${item.id}？`)) return;
    await api(`/api/admin/templates/${encodeURIComponent(item.id)}`, { method: 'DELETE' });
    await load();
  }

  return (
    <div className="contentPanel">
      <Toolbar>
        <form className="filterForm" onSubmit={(event) => { event.preventDefault(); load(); }}>
          <input placeholder="搜索模板 ID 或标题" value={query} onChange={(event) => setQuery(event.target.value)} />
          <button className="secondaryButton" type="submit">搜索</button>
        </form>
        <button className="primaryButton" type="button" onClick={() => setEditing({ ...emptyTemplate, __new: true })}>新增模板</button>
      </Toolbar>
      {message ? <div className="notice">{message}</div> : null}
      {editing ? <TemplateEditor value={editing} onChange={setEditing} onSave={save} onCancel={() => setEditing(null)} categories={categories} styles={styles} scenes={scenes} busy={busy} /> : null}
      <DataTable
        columns={['排序', 'ID', '标题', '分类', '标签', '操作']}
        rows={items.map((item) => [
          item.sortOrder,
          item.id,
          textValue(item.title, 'zh') || textValue(item.title, 'en'),
          item.category,
          <div className="chipWrap">{[...(item.styles || []), ...(item.scenes || [])].slice(0, 5).map((tag) => <span className="chip" key={tag}>{tag}</span>)}</div>,
          <div className="rowActions">
            <button className="secondaryButton" type="button" onClick={() => setEditing({ ...normalizeTemplate(item), __originalId: item.id })}>编辑</button>
            <button className="dangerButton" type="button" onClick={() => remove(item)}>删除</button>
          </div>
        ])}
      />
    </div>
  );
}

function TagsPanel({ styles, scenes, reload }) {
  const [kind, setKind] = useState('');
  const [query, setQuery] = useState('');
  const [items, setItems] = useState([...styles, ...scenes]);
  const [editing, setEditing] = useState(null);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  async function load() {
    const params = new URLSearchParams();
    if (kind) params.set('kind', kind);
    if (query) params.set('q', query);
    const payload = await api(`/api/admin/tags?${params.toString()}`);
    setItems(payload.data || []);
  }

  useEffect(() => {
    setItems([...styles, ...scenes]);
  }, [styles, scenes]);

  async function save(item) {
    setBusy(true);
    try {
      const isNew = item.__new;
      const oldKind = item.__originalKind || item.kind;
      const oldValue = item.__originalValue || item.value;
      const payload = { ...item };
      delete payload.__new;
      delete payload.__originalKind;
      delete payload.__originalValue;
      await api(isNew ? '/api/admin/tags' : `/api/admin/tags/${encodeURIComponent(oldKind)}/${encodeURIComponent(oldValue)}`, {
        method: isNew ? 'POST' : 'PUT',
        body: payload
      });
      setEditing(null);
      await reload();
      await load();
      setMessage('标签已保存。');
    } catch (error) {
      setMessage(error.message);
    } finally {
      setBusy(false);
    }
  }

  async function remove(item) {
    if (!window.confirm(`确定删除标签 ${item.value}？`)) return;
    await api(`/api/admin/tags/${encodeURIComponent(item.kind)}/${encodeURIComponent(item.value)}`, { method: 'DELETE' });
    await reload();
    await load();
  }

  return (
    <div className="contentPanel">
      <Toolbar>
        <form className="filterForm" onSubmit={(event) => { event.preventDefault(); load(); }}>
          <select value={kind} onChange={(event) => setKind(event.target.value)}>
            <option value="">全部类型</option>
            <option value="style">风格</option>
            <option value="scene">场景</option>
          </select>
          <input placeholder="搜索标签" value={query} onChange={(event) => setQuery(event.target.value)} />
          <button className="secondaryButton" type="submit">搜索</button>
        </form>
        <button className="primaryButton" type="button" onClick={() => setEditing({ ...emptyTag, __new: true })}>新增标签</button>
      </Toolbar>
      {message ? <div className="notice">{message}</div> : null}
      {editing ? <TagEditor value={editing} onChange={setEditing} onSave={save} onCancel={() => setEditing(null)} busy={busy} /> : null}
      <DataTable
        columns={['类型', 'Value', '中文标题', '关键词', '排序', '操作']}
        rows={items.map((item) => [
          item.kind,
          item.value,
          textValue(item.title, 'zh') || textValue(item.title, 'en'),
          csv(item.keywords),
          item.sortOrder,
          <div className="rowActions">
            <button className="secondaryButton" type="button" onClick={() => setEditing({ ...normalizeTag(item), __originalKind: item.kind, __originalValue: item.value })}>编辑</button>
            <button className="dangerButton" type="button" onClick={() => remove(item)}>删除</button>
          </div>
        ])}
      />
    </div>
  );
}

function ApiKeysPanel() {
  const [items, setItems] = useState([]);
  const [name, setName] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const [newKey, setNewKey] = useState('');
  const [message, setMessage] = useState('');

  async function load() {
    const payload = await api('/api/admin/api-keys');
    setItems(payload.data || []);
  }

  useEffect(() => {
    load().catch((error) => setMessage(error.message));
  }, []);

  async function createKey(event) {
    event.preventDefault();
    setMessage('');
    try {
      const payload = await api('/api/admin/api-keys', {
        method: 'POST',
        body: { name: name || 'External project', scopes: ['read'], expiresAt: expiresAt || null }
      });
      setNewKey(payload.apiKey);
      setName('');
      setExpiresAt('');
      await load();
    } catch (error) {
      setMessage(error.message);
    }
  }

  async function revoke(id) {
    await api(`/api/admin/api-keys/${id}`, { method: 'DELETE' });
    await load();
  }

  return (
    <div className="contentPanel">
      <form className="editorPanel" onSubmit={createKey}>
        <div className="editorHead full">
          <div>
            <h3>创建外部调用凭据</h3>
            <p>创建后只显示一次明文 API Key，请立即保存到调用方项目的环境变量里。</p>
          </div>
          <button className="primaryButton" type="submit">创建 Key</button>
        </div>
        <Field label="项目名称">
          <TextInput value={name} onChange={setName} placeholder="my-web-app" />
        </Field>
        <Field label="过期时间" hint="可留空">
          <input type="datetime-local" value={expiresAt} onChange={(event) => setExpiresAt(event.target.value)} />
        </Field>
        {newKey ? <div className="notice full">新 Key 只显示一次：<code>{newKey}</code></div> : null}
        {message ? <div className="notice error full">{message}</div> : null}
      </form>
      <div className="helpCard">
        <h3>调用方式</h3>
        <pre>{`curl -H "X-API-Key: agi_xxx" \\
  "https://your-domain/api/v1/cases?q=poster&page=1&pageSize=20"`}</pre>
      </div>
      <DataTable
        columns={['名称', '前缀', '权限', '最后使用', '状态', '创建时间', '操作']}
        rows={items.map((item) => [
          item.name,
          item.keyPrefix,
          csv(item.scopes),
          item.lastUsedAt || '-',
          item.revokedAt ? '已停用' : '可用',
          item.createdAt || '-',
          <button className="dangerButton" type="button" disabled={Boolean(item.revokedAt)} onClick={() => revoke(item.id)}>停用</button>
        ])}
      />
    </div>
  );
}

function AdminApp() {
  const [ready, setReady] = useState(false);
  const [authed, setAuthed] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');
  const [categories, setCategories] = useState([]);
  const [tags, setTags] = useState([]);
  const [message, setMessage] = useState('');

  const styles = useMemo(() => tags.filter((tag) => tag.kind === 'style'), [tags]);
  const scenes = useMemo(() => tags.filter((tag) => tag.kind === 'scene'), [tags]);

  async function loadLookups() {
    const [categoryPayload, tagPayload] = await Promise.all([
      api('/api/admin/categories'),
      api('/api/admin/tags')
    ]);
    setCategories(categoryPayload.data || []);
    setTags(tagPayload.data || []);
  }

  async function checkSession() {
    try {
      await api('/api/admin/auth/me');
      setAuthed(true);
      await loadLookups();
    } catch {
      setAuthed(false);
    } finally {
      setReady(true);
    }
  }

  useEffect(() => {
    checkSession();
  }, []);

  async function logout() {
    await api('/api/admin/auth/logout', { method: 'POST' });
    setAuthed(false);
  }

  async function afterLogin() {
    setAuthed(true);
    await loadLookups().catch((error) => setMessage(error.message));
  }

  if (!ready) return null;
  if (!authed) return <Login onLogin={afterLogin} />;

  return (
    <div className="adminShell">
      <header className="adminTopbar">
        <div>
          <h1>GPT-Image2 内容管理</h1>
          <p>分类、标签、模板、案例和外部 API Key 管理。</p>
        </div>
        <div className="rowActions">
          <a className="secondaryButton" href="/" target="_blank" rel="noreferrer">打开前台</a>
          <button className="secondaryButton" type="button" onClick={logout}>退出</button>
        </div>
      </header>
      <main className="adminMain">
        <nav className="adminNav">
          {tabs.map((tab) => (
            <button type="button" className={activeTab === tab.id ? 'active' : ''} onClick={() => setActiveTab(tab.id)} key={tab.id}>
              {tab.label}
            </button>
          ))}
        </nav>
        {message ? <div className="notice error">{message}</div> : null}
        {activeTab === 'overview' ? <Overview onNavigate={setActiveTab} /> : null}
        {activeTab === 'cases' ? <CasesPanel categories={categories} styles={styles} scenes={scenes} /> : null}
        {activeTab === 'categories' ? <CategoriesPanel items={categories} reload={loadLookups} /> : null}
        {activeTab === 'templates' ? <TemplatesPanel categories={categories} styles={styles} scenes={scenes} /> : null}
        {activeTab === 'tags' ? <TagsPanel styles={styles} scenes={scenes} reload={loadLookups} /> : null}
        {activeTab === 'apiKeys' ? <ApiKeysPanel /> : null}
      </main>
    </div>
  );
}

createRoot(document.getElementById('admin-root')).render(<AdminApp />);
