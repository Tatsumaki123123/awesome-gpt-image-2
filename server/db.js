import pg from 'pg';

const { Pool } = pg;

export const pool = new Pool({
  connectionString:
    process.env.DATABASE_URL ||
    'postgres://gpt_image:gpt_image@localhost:5432/gpt_image'
});

export async function query(text, params = []) {
  return pool.query(text, params);
}

export async function withClient(callback) {
  const client = await pool.connect();
  try {
    return await callback(client);
  } finally {
    client.release();
  }
}

