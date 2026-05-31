import fs from 'node:fs/promises';
import path from 'node:path';
import { pool, query } from './db.js';

async function readJson(file) {
  return JSON.parse(await fs.readFile(path.join(process.cwd(), file), 'utf8'));
}

function textObject(value) {
  if (!value) return {};
  if (typeof value === 'string') return { en: value, zh: value };
  return value;
}

function array(value) {
  return Array.isArray(value) ? value : [];
}

const casesPayload = await readJson('data/cases.json');
const library = await readJson('data/style-library.json');

for (const [index, category] of array(library.categories).entries()) {
  await query(
    `
      insert into categories (
        value, title, description, cover, anchor, template_anchor, sort_order
      )
      values ($1, $2, $3, $4, $5, $6, $7)
      on conflict (value) do update set
        title = excluded.title,
        description = excluded.description,
        cover = excluded.cover,
        anchor = excluded.anchor,
        template_anchor = excluded.template_anchor,
        sort_order = excluded.sort_order
    `,
    [
      category.value,
      textObject(category.title),
      textObject(category.description),
      category.cover || '',
      category.anchor || '',
      category.templateAnchor || category.template_anchor || '',
      index
    ]
  );
}

for (const [index, style] of array(library.styles).entries()) {
  await query(
    `
      insert into style_tags (value, kind, title, keywords, sort_order)
      values ($1, 'style', $2, $3, $4)
      on conflict (kind, value) do update set
        kind = 'style',
        title = excluded.title,
        keywords = excluded.keywords,
        sort_order = excluded.sort_order
    `,
    [style.value, textObject(style.title), array(style.keywords), index]
  );
}

for (const [index, scene] of array(library.scenes).entries()) {
  await query(
    `
      insert into style_tags (value, kind, title, keywords, sort_order)
      values ($1, 'scene', $2, $3, $4)
      on conflict (kind, value) do update set
        kind = 'scene',
        title = excluded.title,
        keywords = excluded.keywords,
        sort_order = excluded.sort_order
    `,
    [scene.value, textObject(scene.title), array(scene.keywords), index]
  );
}

for (const [index, template] of array(library.templates).entries()) {
  await query(
    `
      insert into templates (
        id, title, description, category, anchor, cover, styles, scenes, tags,
        use_when, guidance, pitfalls, example_cases, prompt, sort_order
      )
      values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
      on conflict (id) do update set
        title = excluded.title,
        description = excluded.description,
        category = excluded.category,
        anchor = excluded.anchor,
        cover = excluded.cover,
        styles = excluded.styles,
        scenes = excluded.scenes,
        tags = excluded.tags,
        use_when = excluded.use_when,
        guidance = excluded.guidance,
        pitfalls = excluded.pitfalls,
        example_cases = excluded.example_cases,
        prompt = excluded.prompt,
        sort_order = excluded.sort_order
    `,
    [
      template.id,
      textObject(template.title),
      textObject(template.description),
      template.category || '',
      template.anchor || '',
      template.cover || '',
      array(template.styles),
      array(template.scenes),
      array(template.tags),
      textObject(template.useWhen || template.use_when),
      template.guidance || {},
      template.pitfalls || {},
      array(template.exampleCases || template.example_cases).map(Number).filter(Number.isFinite),
      template.prompt || '',
      index
    ]
  );
}

for (const item of array(casesPayload.cases)) {
  await query(
    `
      insert into cases (
        id, title, image, image_alt, source_label, source_url, prompt, prompt_preview,
        category, styles, scenes, featured, github_url, status
      )
      values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, 'published')
      on conflict (id) do update set
        title = excluded.title,
        image = excluded.image,
        image_alt = excluded.image_alt,
        source_label = excluded.source_label,
        source_url = excluded.source_url,
        prompt = excluded.prompt,
        prompt_preview = excluded.prompt_preview,
        category = excluded.category,
        styles = excluded.styles,
        scenes = excluded.scenes,
        featured = excluded.featured,
        github_url = excluded.github_url
    `,
    [
      Number(item.id),
      item.title || `Case ${item.id}`,
      item.image || '',
      item.imageAlt || item.image_alt || item.title || '',
      item.sourceLabel || item.source_label || '',
      item.sourceUrl || item.source_url || '',
      item.prompt || '',
      item.promptPreview || item.prompt_preview || '',
      item.category || '',
      array(item.styles),
      array(item.scenes),
      Boolean(item.featured),
      item.githubUrl || item.github_url || ''
    ]
  );
}

console.log(`Seeded ${array(casesPayload.cases).length} cases and ${array(library.templates).length} templates.`);
await pool.end();
