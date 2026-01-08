import mysql from 'mysql2/promise';

let pool: mysql.Pool | null = null;

export function getDbConnection(): mysql.Pool {
  if (!pool) {
    const dbHost = process.env.DB_HOST;
    const dbName = process.env.DB_NAME;
    const dbUser = process.env.DB_USER;
    const dbPassword = process.env.DB_PASSWORD;

    if (!dbHost || !dbName || !dbUser || !dbPassword) {
      throw new Error(
        'Missing required database environment variables: DB_HOST, DB_NAME, DB_USER, DB_PASSWORD'
      );
    }

    pool = mysql.createPool({
      host: dbHost,
      database: dbName,
      user: dbUser,
      password: dbPassword,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
      charset: 'utf8mb4',
    });
  }
  return pool;
}

