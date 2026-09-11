import { getConnectionString } from '@netlify/database';
import pg from 'pg';

type Queryable = Pick<pg.Pool | pg.PoolClient, 'query'>;
type QueryResult<T> = { results: T[] };
type RunResult = { meta: { changes: number } };

function postgresPlaceholders(query: string) {
  let index = 0;
  return query.replace(/\?/g, () => `$${++index}`);
}

let pool: pg.Pool | undefined;

function connection() {
  if (!pool) {
    pool = new pg.Pool({
      connectionString: getConnectionString(),
      max: 5,
      idleTimeoutMillis: 10_000,
    });
  }
  return pool;
}

export class Statement {
  constructor(
    private readonly query: string,
    private readonly values: unknown[] = [],
  ) {}

  bind(...values: unknown[]) {
    return new Statement(this.query, values);
  }

  async all<T = Record<string, unknown>>(client: Queryable = connection()): Promise<QueryResult<T>> {
    const result = await client.query(postgresPlaceholders(this.query), this.values);
    return { results: result.rows as T[] };
  }

  async first<T = Record<string, unknown>>(client: Queryable = connection()): Promise<T | null> {
    const result = await this.all<T>(client);
    return result.results[0] ?? null;
  }

  async run(client: Queryable = connection()): Promise<RunResult> {
    const result = await client.query(postgresPlaceholders(this.query), this.values);
    return { meta: { changes: result.rowCount ?? 0 } };
  }
}

export const database = {
  prepare(query: string) {
    return new Statement(query);
  },
  async batch(statements: Statement[]) {
    const client = await connection().connect();
    try {
      await client.query('BEGIN');
      const results = [];
      for (const statement of statements) results.push(await statement.run(client));
      await client.query('COMMIT');
      return results;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  },
};
