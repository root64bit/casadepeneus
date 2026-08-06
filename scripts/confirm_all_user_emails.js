import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const connStr = process.env.DATABASE_URL;
if (!connStr) throw new Error("DATABASE_URL missing");

async function confirmEmails() {
  const client = new pg.Client({ connectionString: connStr, ssl: { rejectUnauthorized: false } });
  await client.connect();

  await client.query(`
    UPDATE auth.users
    SET email_confirmed_at = COALESCE(email_confirmed_at, NOW());
  `);

  console.log("✅ All user emails confirmed in Supabase auth.users!");
  await client.end();
}

confirmEmails();
