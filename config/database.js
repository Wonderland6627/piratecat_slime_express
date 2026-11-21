// PostgreSQL 连接配置
module.exports = {
  /**
   * 解析连接配置。优先 DATABASE_URL，否则使用拆分变量。
   * @returns {{ connectionString?: string, host?: string, port?: number, database?: string, user?: string, password?: string, ssl?: boolean|object, max: number, idleTimeoutMillis: number, connectionTimeoutMillis: number }}
   */
  getPoolConfig() {
    const max = parseInt(process.env.PG_POOL_MAX || '5', 10);
    const sslEnabled = String(process.env.PG_SSL || '').toLowerCase() === 'true';
    const ssl = sslEnabled ? { rejectUnauthorized: false } : false;

    const base = {
      max: Number.isFinite(max) && max > 0 ? max : 5,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
      ssl
    };

    if (process.env.DATABASE_URL) {
      return {
        ...base,
        connectionString: process.env.DATABASE_URL
      };
    }

    return {
      ...base,
      host: process.env.PG_HOST || '127.0.0.1',
      port: parseInt(process.env.PG_PORT || '5432', 10),
      database: process.env.PG_DATABASE || 'slime_dev',
      user: process.env.PG_USER || 'slime_dev_user',
      password: process.env.PG_PASSWORD || ''
    };
  },

  /**
   * @returns {string}
   */
  getDatabaseLabel() {
    if (process.env.DATABASE_URL) {
      try {
        const url = new URL(process.env.DATABASE_URL);
        return `${url.hostname}:${url.port || 5432}/${url.pathname.replace(/^\//, '')}`;
      } catch (_) {
        return '(DATABASE_URL)';
      }
    }
    return `${process.env.PG_HOST || '127.0.0.1'}:${process.env.PG_PORT || '5432'}/${process.env.PG_DATABASE || 'slime_dev'}`;
  }
};
