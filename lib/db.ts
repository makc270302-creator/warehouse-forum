import { Pool, type PoolClient, type QueryResultRow } from "pg";

declare global {
  // eslint-disable-next-line no-var
  var warehouseDbPool: Pool | undefined;
}

function createPool() {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString && !process.env.DB_HOST) {
    throw new Error("Database connection is not configured");
  }

  return new Pool({
    connectionString: connectionString || undefined,
    host: connectionString ? undefined : process.env.DB_HOST,
    port: connectionString ? undefined : Number(process.env.DB_PORT || 5432),
    database: connectionString ? undefined : process.env.DB_NAME,
    user: connectionString ? undefined : process.env.DB_USER,
    password: connectionString ? undefined : process.env.DB_PASSWORD,
    max: Number(process.env.DATABASE_POOL_SIZE || 15),
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000,
    ssl: process.env.DATABASE_SSL === "true" ? { rejectUnauthorized: false } : undefined
  });
}

export function getPool() {
  if (!global.warehouseDbPool) {
    global.warehouseDbPool = createPool();
  }

  return global.warehouseDbPool;
}

export async function query<T extends QueryResultRow>(text: string, values: unknown[] = []) {
  return getPool().query<T>(text, values);
}

export async function transaction<T>(callback: (client: PoolClient) => Promise<T>) {
  const client = await getPool().connect();

  try {
    await client.query("begin");
    const result = await callback(client);
    await client.query("commit");
    return result;
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}
