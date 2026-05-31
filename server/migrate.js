import { pool, query } from './db.js';

const statements = [
  `create extension if not exists pgcrypto`,
  `create extension if not exists pg_trgm`,
  `
    create table if not exists categories (
      id serial primary key,
      value text not null unique,
      title jsonb not null default '{}'::jsonb,
      description jsonb not null default '{}'::jsonb,
      cover text not null default '',
      anchor text not null default '',
      template_anchor text not null default '',
      sort_order integer not null default 0,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    )
  `,
  `
    create table if not exists style_tags (
      id serial primary key,
      value text not null,
      kind text not null check (kind in ('style', 'scene')),
      title jsonb not null default '{}'::jsonb,
      keywords jsonb not null default '[]'::jsonb,
      sort_order integer not null default 0,
      unique (kind, value)
    )
  `,
  `
    create table if not exists templates (
      id text primary key,
      title jsonb not null default '{}'::jsonb,
      description jsonb not null default '{}'::jsonb,
      category text not null default '',
      anchor text not null default '',
      cover text not null default '',
      styles text[] not null default array[]::text[],
      scenes text[] not null default array[]::text[],
      tags text[] not null default array[]::text[],
      use_when jsonb not null default '{}'::jsonb,
      guidance jsonb not null default '{}'::jsonb,
      pitfalls jsonb not null default '{}'::jsonb,
      example_cases integer[] not null default array[]::integer[],
      prompt text not null default '',
      sort_order integer not null default 0,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    )
  `,
  `
    create table if not exists cases (
      id integer primary key,
      title text not null,
      image text not null default '',
      image_alt text not null default '',
      source_label text not null default '',
      source_url text not null default '',
      prompt text not null default '',
      prompt_preview text not null default '',
      category text not null default '',
      styles text[] not null default array[]::text[],
      scenes text[] not null default array[]::text[],
      featured boolean not null default false,
      github_url text not null default '',
      status text not null default 'published' check (status in ('draft', 'published', 'archived')),
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    )
  `,
  `
    create table if not exists api_keys (
      id uuid primary key default gen_random_uuid(),
      name text not null,
      key_hash text not null unique,
      key_prefix text not null,
      scopes text[] not null default array['read']::text[],
      expires_at timestamptz,
      last_used_at timestamptz,
      revoked_at timestamptz,
      created_at timestamptz not null default now()
    )
  `,
  `create index if not exists cases_title_trgm_idx on cases using gin (title gin_trgm_ops)`,
  `create index if not exists cases_prompt_trgm_idx on cases using gin (prompt gin_trgm_ops)`,
  `create index if not exists cases_category_idx on cases (category)`,
  `create index if not exists cases_status_idx on cases (status)`,
  `
    create or replace function set_updated_at()
    returns trigger
    language plpgsql
    as $$
    begin
      new.updated_at = now();
      return new;
    end;
    $$
  `,
  `
    drop trigger if exists categories_set_updated_at on categories;
    create trigger categories_set_updated_at
      before update on categories
      for each row execute function set_updated_at()
  `,
  `
    drop trigger if exists templates_set_updated_at on templates;
    create trigger templates_set_updated_at
      before update on templates
      for each row execute function set_updated_at()
  `,
  `
    drop trigger if exists cases_set_updated_at on cases;
    create trigger cases_set_updated_at
      before update on cases
      for each row execute function set_updated_at()
  `
];

for (const statement of statements) {
  await query(statement);
}

console.log('Database schema is ready.');
await pool.end();
