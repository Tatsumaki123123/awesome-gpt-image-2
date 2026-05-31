import express from 'express';
import { config } from './config.js';
import {
  clearSessionCookie,
  createAdminSession,
  createApiKeySecret,
  hashApiKey,
  requireAdmin,
  requireApiKey,
  sessionCookie,
  verifyAdminPassword
} from './auth.js';
import { pool, query } from './db.js';

const app = express();
const MAX_PAGE_SIZE = 100;

app.use(express.json({ limit: '2mb' }));

function json(res, status, payload) {
  res.status(status).json(payload);
}

function pageOptions(req) {
  const page = Math.max(1, Number(req.query.page || 1));
  const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, Number(req.query.pageSize || req.query.page_size || 24)));
  return {
    page,
    pageSize,
    offset: (page - 1) * pageSize
  };
}

function asArray(value) {
  if (Array.isArray(value)) return value.map(String).filter(Boolean);
  if (typeof value === 'string') {
    return value
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
  }
  return [];
}

function textObject(value) {
  if (!value) return {};
  if (typeof value === 'string') return { en: value, zh: value };
  return value;
}

function caseRow(row) {
  return {
    id: Number(row.id),
    title: row.title || '',
    image: row.image || '',
    imageAlt: row.image_alt || '',
    sourceLabel: row.source_label || '',
    sourceUrl: row.source_url || '',
    prompt: row.prompt || '',
    promptPreview: row.prompt_preview || '',
    category: row.category || '',
    styles: row.styles || [],
    scenes: row.scenes || [],
    featured: Boolean(row.featured),
    githubUrl: row.github_url || '',
    status: row.status || 'published',
    createdAt: row.created_at || '',
    updatedAt: row.updated_at || ''
  };
}

function categoryRow(row) {
  return {
    id: row.id,
    value: row.value,
    title: row.title || {},
    description: row.description || {},
    cover: row.cover || '',
    anchor: row.anchor || '',
    templateAnchor: row.template_anchor || '',
    sortOrder: Number(row.sort_order || 0)
  };
}

function tagRow(row) {
  return {
    id: row.id,
    value: row.value,
    kind: row.kind,
    title: row.title || {},
    keywords: row.keywords || [],
    sortOrder: Number(row.sort_order || 0)
  };
}

function templateRow(row) {
  return {
    id: row.id,
    title: row.title || {},
    description: row.description || {},
    category: row.category || '',
    anchor: row.anchor || '',
    cover: row.cover || '',
    styles: row.styles || [],
    scenes: row.scenes || [],
    tags: row.tags || [],
    useWhen: row.use_when || {},
    guidance: row.guidance || {},
    pitfalls: row.pitfalls || {},
    exampleCases: row.example_cases || [],
    prompt: row.prompt || '',
    sortOrder: Number(row.sort_order || 0),
    createdAt: row.created_at || '',
    updatedAt: row.updated_at || ''
  };
}

function apiKeyRow(row) {
  return {
    id: row.id,
    name: row.name,
    keyPrefix: row.key_prefix,
    scopes: row.scopes || [],
    expiresAt: row.expires_at || null,
    lastUsedAt: row.last_used_at || null,
    revokedAt: row.revoked_at || null,
    createdAt: row.created_at
  };
}

function buildCaseFilters(req, { admin = false } = {}) {
  const values = [];
  const where = [];

  if (!admin) where.push(`status = 'published'`);
  if (req.query.status && admin) {
    values.push(String(req.query.status));
    where.push(`status = $${values.length}`);
  }
  if (req.query.category) {
    values.push(String(req.query.category));
    where.push(`category = $${values.length}`);
  }
  if (req.query.style) {
    values.push(String(req.query.style));
    where.push(`$${values.length} = any(styles)`);
  }
  if (req.query.scene) {
    values.push(String(req.query.scene));
    where.push(`$${values.length} = any(scenes)`);
  }
  if (req.query.featured === 'true') where.push(`featured = true`);
  if (req.query.q || req.query.search) {
    values.push(`%${String(req.query.q || req.query.search).trim()}%`);
    where.push(`(title ilike $${values.length} or prompt ilike $${values.length} or source_label ilike $${values.length})`);
  }

  return {
    where: where.length ? `where ${where.join(' and ')}` : '',
    values
  };
}

async function listCases(req, { admin = false } = {}) {
  const pagination = pageOptions(req);
  const filters = buildCaseFilters(req, { admin });
  const countResult = await query(`select count(*)::int as total from cases ${filters.where}`, filters.values);
  const rowsResult = await query(
    `
      select *
        from cases
        ${filters.where}
       order by id desc
       limit $${filters.values.length + 1}
      offset $${filters.values.length + 2}
    `,
    [...filters.values, pagination.pageSize, pagination.offset]
  );

  return {
    data: rowsResult.rows.map(caseRow),
    pagination: {
      page: pagination.page,
      pageSize: pagination.pageSize,
      total: countResult.rows[0]?.total || 0
    }
  };
}

app.get('/api/health', (_req, res) => json(res, 200, { ok: true }));

app.post('/api/admin/auth/login', (req, res) => {
  const username = String(req.body?.username || '');
  const password = String(req.body?.password || '');
  if (username !== config.admin.username || !verifyAdminPassword(password)) {
    return json(res, 401, { ok: false, error: 'INVALID_ADMIN_LOGIN' });
  }
  const token = createAdminSession(username);
  res.setHeader('Set-Cookie', sessionCookie(token));
  return json(res, 200, { ok: true, admin: { username } });
});

app.get('/api/admin/auth/me', requireAdmin, (req, res) => {
  json(res, 200, { ok: true, admin: { username: req.admin.sub } });
});

app.post('/api/admin/auth/logout', (_req, res) => {
  res.setHeader('Set-Cookie', clearSessionCookie());
  json(res, 200, { ok: true });
});

app.get('/api/v1/categories', requireApiKey, async (_req, res, next) => {
  try {
    const { rows } = await query('select * from categories order by sort_order asc, value asc');
    json(res, 200, { data: rows.map(categoryRow) });
  } catch (error) {
    next(error);
  }
});

app.get('/api/v1/templates', requireApiKey, async (req, res, next) => {
  try {
    const values = [];
    const where = [];
    if (req.query.category) {
      values.push(String(req.query.category));
      where.push(`category = $${values.length}`);
    }
    if (req.query.q || req.query.search) {
      values.push(`%${String(req.query.q || req.query.search).trim()}%`);
      where.push(`(title::text ilike $${values.length} or description::text ilike $${values.length} or prompt ilike $${values.length})`);
    }
    const { rows } = await query(
      `select * from templates ${where.length ? `where ${where.join(' and ')}` : ''} order by sort_order asc, id asc`,
      values
    );
    json(res, 200, { data: rows.map(templateRow) });
  } catch (error) {
    next(error);
  }
});

app.get('/api/v1/templates/:id', requireApiKey, async (req, res, next) => {
  try {
    const { rows } = await query('select * from templates where id = $1', [req.params.id]);
    if (!rows[0]) return json(res, 404, { ok: false, error: 'TEMPLATE_NOT_FOUND' });
    return json(res, 200, { data: templateRow(rows[0]) });
  } catch (error) {
    next(error);
  }
});

app.get('/api/v1/cases', requireApiKey, async (req, res, next) => {
  try {
    json(res, 200, await listCases(req));
  } catch (error) {
    next(error);
  }
});

app.get('/api/v1/search', requireApiKey, async (req, res, next) => {
  try {
    json(res, 200, await listCases(req));
  } catch (error) {
    next(error);
  }
});

app.get('/api/v1/cases/:id', requireApiKey, async (req, res, next) => {
  try {
    const { rows } = await query("select * from cases where id = $1 and status = 'published'", [Number(req.params.id)]);
    if (!rows[0]) return json(res, 404, { ok: false, error: 'CASE_NOT_FOUND' });
    return json(res, 200, { data: caseRow(rows[0]) });
  } catch (error) {
    next(error);
  }
});

app.get('/api/v1/site-data', requireApiKey, async (_req, res, next) => {
  try {
    const [casesResult, categoriesResult] = await Promise.all([
      query("select * from cases where status = 'published' order by id desc"),
      query('select * from categories order by sort_order asc, value asc')
    ]);
    const cases = casesResult.rows.map(caseRow);
    const categories = categoriesResult.rows.map((row) => row.value);
    const styles = [...new Set(cases.flatMap((item) => item.styles))].sort();
    const scenes = [...new Set(cases.flatMap((item) => item.scenes))].sort();
    json(res, 200, {
      repository: config.repository,
      totalCases: cases.length,
      categories,
      styles,
      scenes,
      cases
    });
  } catch (error) {
    next(error);
  }
});

app.get('/api/v1/style-library', requireApiKey, async (_req, res, next) => {
  try {
    const [categories, styles, scenes, templates] = await Promise.all([
      query('select * from categories order by sort_order asc, value asc'),
      query("select * from style_tags where kind = 'style' order by sort_order asc, value asc"),
      query("select * from style_tags where kind = 'scene' order by sort_order asc, value asc"),
      query('select * from templates order by sort_order asc, id asc')
    ]);
    json(res, 200, {
      repository: config.repository,
      templateDocument: 'docs/templates.md',
      categories: categories.rows.map(categoryRow),
      styles: styles.rows.map(tagRow),
      scenes: scenes.rows.map(tagRow),
      templates: templates.rows.map(templateRow),
      tagLabels: {}
    });
  } catch (error) {
    next(error);
  }
});

app.get('/api/admin/categories', requireAdmin, async (_req, res, next) => {
  try {
    const { rows } = await query('select * from categories order by sort_order asc, value asc');
    json(res, 200, { data: rows.map(categoryRow) });
  } catch (error) {
    next(error);
  }
});

app.post('/api/admin/categories', requireAdmin, async (req, res, next) => {
  try {
    const item = req.body || {};
    const { rows } = await query(
      `
        insert into categories (value, title, description, cover, anchor, template_anchor, sort_order)
        values ($1, $2, $3, $4, $5, $6, $7)
        returning *
      `,
      [
        item.value,
        textObject(item.title),
        textObject(item.description),
        item.cover || '',
        item.anchor || '',
        item.templateAnchor || item.template_anchor || '',
        Number(item.sortOrder || item.sort_order || 0)
      ]
    );
    json(res, 201, { data: categoryRow(rows[0]) });
  } catch (error) {
    next(error);
  }
});

app.put('/api/admin/categories/:value', requireAdmin, async (req, res, next) => {
  try {
    const item = req.body || {};
    const { rows } = await query(
      `
        update categories
           set value = $2,
               title = $3,
               description = $4,
               cover = $5,
               anchor = $6,
               template_anchor = $7,
               sort_order = $8
         where value = $1
         returning *
      `,
      [
        req.params.value,
        item.value || req.params.value,
        textObject(item.title),
        textObject(item.description),
        item.cover || '',
        item.anchor || '',
        item.templateAnchor || item.template_anchor || '',
        Number(item.sortOrder || item.sort_order || 0)
      ]
    );
    if (!rows[0]) return json(res, 404, { ok: false, error: 'CATEGORY_NOT_FOUND' });
    return json(res, 200, { data: categoryRow(rows[0]) });
  } catch (error) {
    next(error);
  }
});

app.delete('/api/admin/categories/:value', requireAdmin, async (req, res, next) => {
  try {
    await query('delete from categories where value = $1', [req.params.value]);
    json(res, 200, { ok: true });
  } catch (error) {
    next(error);
  }
});

app.get('/api/admin/templates', requireAdmin, async (req, res, next) => {
  try {
    req.query.pageSize ||= '100';
    const values = [];
    const where = [];
    if (req.query.q) {
      values.push(`%${String(req.query.q).trim()}%`);
      where.push(`(id ilike $${values.length} or title::text ilike $${values.length})`);
    }
    const { rows } = await query(
      `select * from templates ${where.length ? `where ${where.join(' and ')}` : ''} order by sort_order asc, id asc`,
      values
    );
    json(res, 200, { data: rows.map(templateRow) });
  } catch (error) {
    next(error);
  }
});

app.post('/api/admin/templates', requireAdmin, async (req, res, next) => {
  try {
    const item = req.body || {};
    const { rows } = await query(
      `
        insert into templates (
          id, title, description, category, anchor, cover, styles, scenes, tags,
          use_when, guidance, pitfalls, example_cases, prompt, sort_order
        )
        values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
        returning *
      `,
      [
        item.id,
        textObject(item.title),
        textObject(item.description),
        item.category || '',
        item.anchor || '',
        item.cover || '',
        asArray(item.styles),
        asArray(item.scenes),
        asArray(item.tags),
        textObject(item.useWhen || item.use_when),
        item.guidance || {},
        item.pitfalls || {},
        asArray(item.exampleCases || item.example_cases).map(Number).filter(Number.isFinite),
        item.prompt || '',
        Number(item.sortOrder || item.sort_order || 0)
      ]
    );
    json(res, 201, { data: templateRow(rows[0]) });
  } catch (error) {
    next(error);
  }
});

app.put('/api/admin/templates/:id', requireAdmin, async (req, res, next) => {
  try {
    const item = req.body || {};
    const { rows } = await query(
      `
        update templates
           set id = $2,
               title = $3,
               description = $4,
               category = $5,
               anchor = $6,
               cover = $7,
               styles = $8,
               scenes = $9,
               tags = $10,
               use_when = $11,
               guidance = $12,
               pitfalls = $13,
               example_cases = $14,
               prompt = $15,
               sort_order = $16
         where id = $1
         returning *
      `,
      [
        req.params.id,
        item.id || req.params.id,
        textObject(item.title),
        textObject(item.description),
        item.category || '',
        item.anchor || '',
        item.cover || '',
        asArray(item.styles),
        asArray(item.scenes),
        asArray(item.tags),
        textObject(item.useWhen || item.use_when),
        item.guidance || {},
        item.pitfalls || {},
        asArray(item.exampleCases || item.example_cases).map(Number).filter(Number.isFinite),
        item.prompt || '',
        Number(item.sortOrder || item.sort_order || 0)
      ]
    );
    if (!rows[0]) return json(res, 404, { ok: false, error: 'TEMPLATE_NOT_FOUND' });
    return json(res, 200, { data: templateRow(rows[0]) });
  } catch (error) {
    next(error);
  }
});

app.delete('/api/admin/templates/:id', requireAdmin, async (req, res, next) => {
  try {
    await query('delete from templates where id = $1', [req.params.id]);
    json(res, 200, { ok: true });
  } catch (error) {
    next(error);
  }
});

app.get('/api/admin/cases', requireAdmin, async (req, res, next) => {
  try {
    json(res, 200, await listCases(req, { admin: true }));
  } catch (error) {
    next(error);
  }
});

app.post('/api/admin/cases', requireAdmin, async (req, res, next) => {
  try {
    const item = req.body || {};
    const { rows } = await query(
      `
        insert into cases (
          id, title, image, image_alt, source_label, source_url, prompt, prompt_preview,
          category, styles, scenes, featured, github_url, status
        )
        values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
        returning *
      `,
      [
        Number(item.id),
        item.title || `Case ${item.id}`,
        item.image || '',
        item.imageAlt || item.image_alt || item.title || '',
        item.sourceLabel || item.source_label || '',
        item.sourceUrl || item.source_url || '',
        item.prompt || '',
        item.promptPreview || item.prompt_preview || String(item.prompt || '').replace(/\n+/g, ' ').slice(0, 220),
        item.category || '',
        asArray(item.styles),
        asArray(item.scenes),
        Boolean(item.featured),
        item.githubUrl || item.github_url || '',
        item.status || 'published'
      ]
    );
    json(res, 201, { data: caseRow(rows[0]) });
  } catch (error) {
    next(error);
  }
});

app.put('/api/admin/cases/:id', requireAdmin, async (req, res, next) => {
  try {
    const item = req.body || {};
    const { rows } = await query(
      `
        update cases
           set id = $2,
               title = $3,
               image = $4,
               image_alt = $5,
               source_label = $6,
               source_url = $7,
               prompt = $8,
               prompt_preview = $9,
               category = $10,
               styles = $11,
               scenes = $12,
               featured = $13,
               github_url = $14,
               status = $15
         where id = $1
         returning *
      `,
      [
        Number(req.params.id),
        Number(item.id || req.params.id),
        item.title || `Case ${item.id || req.params.id}`,
        item.image || '',
        item.imageAlt || item.image_alt || item.title || '',
        item.sourceLabel || item.source_label || '',
        item.sourceUrl || item.source_url || '',
        item.prompt || '',
        item.promptPreview || item.prompt_preview || String(item.prompt || '').replace(/\n+/g, ' ').slice(0, 220),
        item.category || '',
        asArray(item.styles),
        asArray(item.scenes),
        Boolean(item.featured),
        item.githubUrl || item.github_url || '',
        item.status || 'published'
      ]
    );
    if (!rows[0]) return json(res, 404, { ok: false, error: 'CASE_NOT_FOUND' });
    return json(res, 200, { data: caseRow(rows[0]) });
  } catch (error) {
    next(error);
  }
});

app.delete('/api/admin/cases/:id', requireAdmin, async (req, res, next) => {
  try {
    await query('delete from cases where id = $1', [Number(req.params.id)]);
    json(res, 200, { ok: true });
  } catch (error) {
    next(error);
  }
});

app.get('/api/admin/api-keys', requireAdmin, async (_req, res, next) => {
  try {
    const { rows } = await query('select * from api_keys order by created_at desc');
    json(res, 200, { data: rows.map(apiKeyRow) });
  } catch (error) {
    next(error);
  }
});

app.post('/api/admin/api-keys', requireAdmin, async (req, res, next) => {
  try {
    const secret = createApiKeySecret();
    const item = req.body || {};
    const { rows } = await query(
      `
        insert into api_keys (name, key_hash, key_prefix, scopes, expires_at)
        values ($1, $2, $3, $4, $5)
        returning *
      `,
      [
        item.name || 'External project',
        hashApiKey(secret),
        secret.slice(0, 10),
        asArray(item.scopes).length ? asArray(item.scopes) : ['read'],
        item.expiresAt || item.expires_at || null
      ]
    );
    json(res, 201, { data: apiKeyRow(rows[0]), apiKey: secret });
  } catch (error) {
    next(error);
  }
});

app.delete('/api/admin/api-keys/:id', requireAdmin, async (req, res, next) => {
  try {
    const { rows } = await query(
      'update api_keys set revoked_at = now() where id = $1 returning *',
      [req.params.id]
    );
    if (!rows[0]) return json(res, 404, { ok: false, error: 'API_KEY_NOT_FOUND' });
    return json(res, 200, { data: apiKeyRow(rows[0]) });
  } catch (error) {
    next(error);
  }
});

app.use((error, _req, res, _next) => {
  console.error(error);
  json(res, 500, {
    ok: false,
    error: 'SERVER_ERROR',
    message: process.env.NODE_ENV === 'production' ? undefined : error.message
  });
});

const server = app.listen(config.server.port, () => {
  console.log(`API server listening on :${config.server.port}`);
});

function shutdown() {
  server.close(async () => {
    await pool.end();
    process.exit(0);
  });
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

