const { Pool } = require('pg');
require('dotenv').config();

// Build pool config from environment variables only (no DATABASE_URL)
const {
  PGHOST,
  PGPORT,
  PGDATABASE,
  PGUSER,
  PGPASSWORD,
  // SSL and pool tuning
  PGSSL,
  PGSSL_REJECT_UNAUTHORIZED,
  PGPOOL_MAX,
  PGPOOL_IDLE_TIMEOUT_MS,
  PGPOOL_CONN_TIMEOUT_MS,
  PG_KEEPALIVE,
  PG_KEEPALIVE_IDLE_MS,
} = process.env;

const baseConfig = {
  host: PGHOST,
  port: PGPORT ? parseInt(PGPORT, 10) : undefined,
  database: PGDATABASE,
  user: PGUSER,
  password: PGPASSWORD,
};

// SSL defaults to enabled with rejectUnauthorized=false unless overridden via env
let sslOption;
if (PGSSL === 'true' || PGSSL === '1' || typeof PGSSL === 'undefined') {
  // Default to rejectUnauthorized=false unless explicitly set to 'true'
  const rejectUnauth = PGSSL_REJECT_UNAUTHORIZED === 'true';
  sslOption = { rejectUnauthorized: rejectUnauth };
}

const pool = new Pool({
  ...baseConfig,
  ssl: sslOption,
  max: PGPOOL_MAX ? parseInt(PGPOOL_MAX, 10) : 20,
  idleTimeoutMillis: PGPOOL_IDLE_TIMEOUT_MS ? parseInt(PGPOOL_IDLE_TIMEOUT_MS, 10) : 60000,
  connectionTimeoutMillis: PGPOOL_CONN_TIMEOUT_MS ? parseInt(PGPOOL_CONN_TIMEOUT_MS, 10) : 10000,
  keepAlive: typeof PG_KEEPALIVE === 'string' ? PG_KEEPALIVE === 'true' : true,
  keepAliveInitialDelayMillis: PG_KEEPALIVE_IDLE_MS ? parseInt(PG_KEEPALIVE_IDLE_MS, 10) : 10000,
});

// Helper to prefix public schema automatically
function prefixPublicSchema(sql) {
  return sql.replace(
    /(?<!(public|schema)\.)\b(tbl_users|products|product_variants|cart_items|orders|order_items|historical_sales)(?=\s|\)|;|,|$)/gi,
    'public.$2'
  );
}

module.exports = {
  // Regular pooled query
  query: (text, params) => {
    const modifiedText = prefixPublicSchema(text);
    return pool.query(modifiedText, params);
  },

  // Run a function within a single transaction-bound client
  withTransaction: async (fn) => {
    const client = await pool.connect();
    const tx = {
      query: (text, params) => client.query(prefixPublicSchema(text), params),
    };
    try {
      await client.query('BEGIN');
      const result = await fn(tx);
      await client.query('COMMIT');
      return result;
    } catch (err) {
      try { await client.query('ROLLBACK'); } catch (_) {}
      throw err;
    } finally {
      client.release();
    }
  },
};