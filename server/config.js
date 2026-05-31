import fs from 'node:fs';
import path from 'node:path';

const DEFAULT_CONFIG = {
  server: {
    port: 5003,
    publicApiRequireKey: false
  },
  admin: {
    username: 'admin',
    password: 'change-me',
    sessionSecret: 'dev-only-change-this-secret'
  },
  repository: 'https://github.com/freestylefly/awesome-gpt-image-2'
};

function deepMerge(base, override) {
  const output = { ...base };
  for (const [key, value] of Object.entries(override || {})) {
    output[key] =
      value && typeof value === 'object' && !Array.isArray(value)
        ? deepMerge(base[key] || {}, value)
        : value;
  }
  return output;
}

function readConfigFile() {
  const file = process.env.APP_CONFIG_FILE || path.join(process.cwd(), 'config', 'app.config.json');
  if (!fs.existsSync(file)) return {};
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

const fileConfig = readConfigFile();

export const config = deepMerge(DEFAULT_CONFIG, fileConfig);

if (process.env.ADMIN_USERNAME) config.admin.username = process.env.ADMIN_USERNAME;
if (process.env.ADMIN_PASSWORD) config.admin.password = process.env.ADMIN_PASSWORD;
if (process.env.ADMIN_PASSWORD_HASH) config.admin.passwordHash = process.env.ADMIN_PASSWORD_HASH;
if (process.env.ADMIN_SESSION_SECRET) config.admin.sessionSecret = process.env.ADMIN_SESSION_SECRET;
if (process.env.PUBLIC_API_REQUIRE_KEY) {
  config.server.publicApiRequireKey = process.env.PUBLIC_API_REQUIRE_KEY === 'true';
}
if (process.env.PORT) config.server.port = Number(process.env.PORT);
if (process.env.REPOSITORY_URL) config.repository = process.env.REPOSITORY_URL;
