import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './admin.css';

const tabs = [
  { id: 'cases', label: '案例' },
  { id: 'categories', label: '分类' },
  { id: 'templates', label: '模板' },
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
  category: '',
  styles: [],
  scenes: [],
  featured: false,
  status: 'published'
};

const emptyCategory = {
  value: '',
  title: { en: '', zh: '' },
  description: { en: '', zh: '' },
  cover: '',
  anchor: '',
  templateAnchor: '',
  sortOrder: 0
};

const emptyTemplate = {
  id: '',
  title: { en: '', zh: '' },
  description: { en: '', zh: '' },
  category: '',
  anchor: '',
  cover: '',
  styles: [],
  scenes: [],
  tags: [],
  useWhen: { en: '', zh: '' },
  guidance: { en: [], zh: [] },
  pitfalls: { en: [], zh: [] },
  exampleCases: [],
  prompt: '',
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
    body: options.body && typeof options.body !== 'string'
      ? JSON.stringify(options.body)
      : options.body
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

function parseJson(value, fallback) {
  try {
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
}

function textValue(value, language) {
  if (!value) return '';
  if (typeof value === 'string') return value;
  return value[language] || value.zh || value.en || '';
}

function Login({ onLogin }) {
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  async function submit(event) {
    event.preventDefault();
    setError('');
    try {
      await api('/api/admin/auth/login', {
        method: 'POST',
        body: { username, password }
      });
      onLogin();
    } catch (loginError) {
      setError(loginError.message);
    }
  }

  return (
    <div className="loginWrap">
      <form className="loginCard" onSubmit={submit}>
        <h1>管理后台登录</h1>
        <label>
          管理员账号
          <input value={username} onChange={(event) => setUsername(event.target.value)} />
        </label>
        <label>
          管理员密码
          <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} />
        </label>
        {error ? <div className="notice error">{error}</div> : null}
        <button className="primaryButton" type="submit">登录</button>
      </form>
    </div>
  );
}

function CaseEditor({ value, onChange, onSave, onCancel }) {
  const item = value || emptyCase;
  return (
    <form className="editorPanel" onSubmit={(event) => { event.preventDefault(); onSave(item); }}>
      <label>ID<input value={item.id} onChange={(event) => onChange({ ...item, id: event.target.value })} /></label>
      <label>标题<input value={item.title} onChange={(event) => onChange({ ...item, title: event.target.value })} /></label>
      <label>分类<input value={item.category} onChange={(event) => onChange({ ...item, category: event.target.value })} /></label>
      <label>图片路径<input value={item.image} onChange={(event) => onChange({ ...item, image: event.target.value })} /></label>
      <label>来源名称<input value={item.sourceLabel} onChange={(event) => onChange({ ...item, sourceLabel: event.target.value })} /></label>
      <label>来源 URL<input value={item.sourceUrl} onChange={(event) => onChange({ ...item, sourceUrl: event.target.value })} /></label>
      <label>风格标签<input value={csv(item.styles)} onChange={(event) => onChange({ ...item, styles: parseCsv(event.target.value) })} /></label>
      <label>场景标签<input value={csv(item.scenes)} onChange={(event) => onChange({ ...item, scenes: parseCsv(event.target.value) })} /></label>
      <label>状态
        <select value={item.status} onChange={(event) => onChange({ ...item, status: event.target.value })}>
          <option value="published">published</option>
          <option value="draft">draft</option>
          <option value="archived">archived</option>
        </select>
      </label>
      <label>
        推荐
        <select value={String(Boolean(item.featured))} onChange={(event) => onChange({ ...item, featured: event.target.value === 'true' })}>
          <option value="false">否</option>
          <option value="true">是</option>
        </select>
      </label>
      <label className="full">Prompt<textarea value={item.prompt} onChange={(event) => onChange({ ...item, prompt: event.target.value })} /></label>
      <div className="rowActions full">
        <button className="primaryButton" type="submit">保存</button>
        <button className="secondaryButton" type="button" onClick={onCancel}>取消</button>
      </div>
    </form>
  );
}

function CategoryEditor({ value, onChange, onSave, onCancel }) {
  const item = value || emptyCategory;
  return (
    <form className="editorPanel" onSubmit={(event) => { event.preventDefault(); onSave(item); }}>
      <label>Value<input value={item.value} onChange={(event) => onChange({ ...item, value: event.target.value })} /></label>
      <label>排序<input value={item.sortOrder} onChange={(event) => onChange({ ...item, sortOrder: Number(event.target.value) })} /></label>
      <label>中文标题<input value={textValue(item.title, 'zh')} onChange={(event) => onChange({ ...item, title: { ...item.title, zh: event.target.value } })} /></label>
      <label>英文标题<input value={textValue(item.title, 'en')} onChange={(event) => onChange({ ...item, title: { ...item.title, en: event.target.value } })} /></label>
      <label>封面<input value={item.cover} onChange={(event) => onChange({ ...item, cover: event.target.value })} /></label>
      <label>模板锚点<input value={item.templateAnchor} onChange={(event) => onChange({ ...item, templateAnchor: event.target.value })} /></label>
      <label className="full">描述 JSON<textarea value={JSON.stringify(item.description || {}, null, 2)} onChange={(event) => onChange({ ...item, description: parseJson(event.target.value, item.description || {}) })} /></label>
      <div className="rowActions full">
        <button className="primaryButton" type="submit">保存</button>
        <button className="secondaryButton" type="button" onClick={onCancel}>取消</button>
      </div>
    </form>
  );
}

function TemplateEditor({ value, onChange, onSave, onCancel }) {
  const item = value || emptyTemplate;
  return (
    <form className="editorPanel" onSubmit={(event) => { event.preventDefault(); onSave(item); }}>
      <label>ID<input value={item.id} onChange={(event) => onChange({ ...item, id: event.target.value })} /></label>
      <label>分类<input value={item.category} onChange={(event) => onChange({ ...item, category: event.target.value })} /></label>
      <label>中文标题<input value={textValue(item.title, 'zh')} onChange={(event) => onChange({ ...item, title: { ...item.title, zh: event.target.value } })} /></label>
      <label>英文标题<input value={textValue(item.title, 'en')} onChange={(event) => onChange({ ...item, title: { ...item.title, en: event.target.value } })} /></label>
      <label>封面<input value={item.cover} onChange={(event) => onChange({ ...item, cover: event.target.value })} /></label>
      <label>排序<input value={item.sortOrder} onChange={(event) => onChange({ ...item, sortOrder: Number(event.target.value) })} /></label>
      <label>风格标签<input value={csv(item.styles)} onChange={(event) => onChange({ ...item, styles: parseCsv(event.target.value) })} /></label>
      <label>场景标签<input value={csv(item.scenes)} onChange={(event) => onChange({ ...item, scenes: parseCsv(event.target.value) })} /></label>
      <label className="full">模板 Prompt<textarea value={item.prompt || ''} onChange={(event) => onChange({ ...item, prompt: event.target.value })} /></label>
      <label className="full">完整 JSON<textarea value={JSON.stringify(item, null, 2)} onChange={(event) => onChange(parseJson(event.target.value, item))} /></label>
      <div className="rowActions full">
        <button className="primaryButton" type="submit">保存</button>
        <button className="secondaryButton" type="button" onClick={onCancel}>取消</button>
      </div>
    </form>
  );
}

function ApiKeys() {
  const [items, setItems] = useState([]);
  const [name, setName] = useState('');
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
    const payload = await api('/api/admin/api-keys', {
      method: 'POST',
      body: { name: name || 'External project', scopes: ['read'] }
    });
    setNewKey(payload.apiKey);
    setName('');
    await load();
  }

  async function revoke(id) {
    await api(`/api/admin/api-keys/${id}`, { method: 'DELETE' });
    await load();
  }

  return (
    <div className="contentPanel">
      <form className="toolbar" onSubmit={createKey}>
        <input placeholder="项目名称，例如 my-web-app" value={name} onChange={(event) => setName(event.target.value)} />
        <button className="primaryButton" type="submit">创建 API Key</button>
      </form>
      {newKey ? <div className="notice">新 Key 只显示一次：{newKey}</div> : null}
      {message ? <div className="notice error">{message}</div> : null}
      <Table
        columns={['名称', '前缀', '权限', '最后使用', '状态', '操作']}
        rows={items.map((item) => [
          item.name,
          item.keyPrefix,
          csv(item.scopes),
          item.lastUsedAt || '-',
          item.revokedAt ? '已停用' : '可用',
          <button className="dangerButton" type="button" onClick={() => revoke(item.id)}>停用</button>
        ])}
      />
    </div>
  );
}

function Table({ columns, rows }) {
  return (
    <div className="tablePanel">
      <table>
        <thead>
          <tr>{columns.map((column) => <th key={column}>{column}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={index}>
              {row.map((cell, cellIndex) => <td key={cellIndex}>{cell}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function CrudPanel({ tab }) {
  const [items, setItems] = useState([]);
  const [editing, setEditing] = useState(null);
  const [query, setQuery] = useState('');
  const [message, setMessage] = useState('');

  const endpoint = useMemo(() => {
    if (tab === 'cases') return '/api/admin/cases';
    if (tab === 'categories') return '/api/admin/categories';
    return '/api/admin/templates';
  }, [tab]);

  async function load() {
    setMessage('');
    const suffix = tab === 'cases' ? `?pageSize=50&q=${encodeURIComponent(query)}` : query ? `?q=${encodeURIComponent(query)}` : '';
    const payload = await api(`${endpoint}${suffix}`);
    setItems(payload.data || []);
  }

  useEffect(() => {
    load().catch((error) => setMessage(error.message));
  }, [endpoint]);

  async function save(item) {
    const isNew = item.__new;
    const id = tab === 'categories' ? item.__originalValue || item.value : item.__originalId || item.id;
    const payload = { ...item };
    delete payload.__new;
    delete payload.__originalId;
    delete payload.__originalValue;
    await api(isNew ? endpoint : `${endpoint}/${encodeURIComponent(id)}`, {
      method: isNew ? 'POST' : 'PUT',
      body: payload
    });
    setEditing(null);
    await load();
  }

  async function remove(item) {
    const id = tab === 'categories' ? item.value : item.id;
    if (!window.confirm(`确定删除 ${id}？`)) return;
    await api(`${endpoint}/${encodeURIComponent(id)}`, { method: 'DELETE' });
    await load();
  }

  function startNew() {
    const base = tab === 'cases' ? emptyCase : tab === 'categories' ? emptyCategory : emptyTemplate;
    setEditing({ ...base, __new: true });
  }

  function startEdit(item) {
    setEditing({
      ...item,
      __originalId: item.id,
      __originalValue: item.value
    });
  }

  const editorProps = {
    value: editing,
    onChange: setEditing,
    onSave: save,
    onCancel: () => setEditing(null)
  };

  return (
    <div className="contentPanel">
      <div className="toolbar">
        <input placeholder="搜索" value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') load(); }} />
        <div className="rowActions">
          <button className="secondaryButton" type="button" onClick={load}>刷新</button>
          <button className="primaryButton" type="button" onClick={startNew}>新增</button>
        </div>
      </div>
      {message ? <div className="notice error">{message}</div> : null}
      {editing && tab === 'cases' ? <CaseEditor {...editorProps} /> : null}
      {editing && tab === 'categories' ? <CategoryEditor {...editorProps} /> : null}
      {editing && tab === 'templates' ? <TemplateEditor {...editorProps} /> : null}
      {tab === 'cases' ? (
        <Table
          columns={['ID', '标题', '分类', '状态', '操作']}
          rows={items.map((item) => [
            item.id,
            item.title,
            item.category,
            item.status,
            <div className="rowActions">
              <button className="secondaryButton" type="button" onClick={() => startEdit(item)}>编辑</button>
              <button className="dangerButton" type="button" onClick={() => remove(item)}>删除</button>
            </div>
          ])}
        />
      ) : null}
      {tab === 'categories' ? (
        <Table
          columns={['Value', '中文标题', '英文标题', '操作']}
          rows={items.map((item) => [
            item.value,
            textValue(item.title, 'zh'),
            textValue(item.title, 'en'),
            <div className="rowActions">
              <button className="secondaryButton" type="button" onClick={() => startEdit(item)}>编辑</button>
              <button className="dangerButton" type="button" onClick={() => remove(item)}>删除</button>
            </div>
          ])}
        />
      ) : null}
      {tab === 'templates' ? (
        <Table
          columns={['ID', '标题', '分类', '操作']}
          rows={items.map((item) => [
            item.id,
            textValue(item.title, 'zh') || textValue(item.title, 'en'),
            item.category,
            <div className="rowActions">
              <button className="secondaryButton" type="button" onClick={() => startEdit(item)}>编辑</button>
              <button className="dangerButton" type="button" onClick={() => remove(item)}>删除</button>
            </div>
          ])}
        />
      ) : null}
    </div>
  );
}

function AdminApp() {
  const [ready, setReady] = useState(false);
  const [authed, setAuthed] = useState(false);
  const [activeTab, setActiveTab] = useState('cases');

  async function checkSession() {
    try {
      await api('/api/admin/auth/me');
      setAuthed(true);
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

  if (!ready) return null;
  if (!authed) return <Login onLogin={() => setAuthed(true)} />;

  return (
    <div className="adminShell">
      <header className="adminTopbar">
        <div>
          <h1>GPT-Image2 内容管理</h1>
          <p>管理分类、模板、案例，并为外部项目创建 API Key。</p>
        </div>
        <button className="secondaryButton" type="button" onClick={logout}>退出</button>
      </header>
      <main className="adminMain">
        <nav className="adminNav">
          {tabs.map((tab) => (
            <button
              type="button"
              className={activeTab === tab.id ? 'active' : ''}
              onClick={() => setActiveTab(tab.id)}
              key={tab.id}
            >
              {tab.label}
            </button>
          ))}
        </nav>
        {activeTab === 'apiKeys' ? <ApiKeys /> : <CrudPanel tab={activeTab} />}
      </main>
    </div>
  );
}

createRoot(document.getElementById('admin-root')).render(<AdminApp />);
