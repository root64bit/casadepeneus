import pkg from 'pg';
const { Client } = pkg;
import dotenv from 'dotenv';
dotenv.config();

const connStr = process.env.DATABASE_URL;
if (!connStr) throw new Error("DATABASE_URL environment variable is required.");

async function testPoolers() {
  console.log("Connecting via DATABASE_URL...");
  const client = new Client({
    connectionString: connStr,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log("Connection successful!");
    await client.end();
  } catch (err) {
    console.error("Connection failed:", err.message);
    await client.end().catch(() => {});
  }
}

testPoolers();
