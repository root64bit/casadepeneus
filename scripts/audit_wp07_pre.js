import pkg from 'pg';
const { Client } = pkg;
import dotenv from 'dotenv';
dotenv.config();

const connStr = process.env.DATABASE_URL;
if (!connStr) throw new Error("DATABASE_URL environment variable is required.");

async function auditPreWP07() {
  console.log("Connecting to production pooler via DATABASE_URL...");
  const client = new Client({
    connectionString: connStr,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    const resTables = await client.query("SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public';");
    console.log("Public tables count:", resTables.rows[0].count);
    await client.end();
  } catch (err) {
    console.error("ERROR:", err);
    await client.end().catch(() => {});
  }
}

auditPreWP07();
