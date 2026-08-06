import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const connStr = process.env.DATABASE_URL;
if (!connStr) throw new Error("DATABASE_URL missing");

async function listUsers() {
  const client = new pg.Client({ connectionString: connStr, ssl: { rejectUnauthorized: false } });
  await client.connect();

  const profiles = await client.query(`
    SELECT up.id, up.username, up.email, up.full_name, r.code as role_code
    FROM public.user_profiles up
    LEFT JOIN public.user_roles ur ON ur.user_id = up.id
    LEFT JOIN public.roles r ON r.id = ur.role_id;
  `);

  console.log("Registered System Users:");
  console.table(profiles.rows);

  const authUsers = await client.query(`SELECT id, email, created_at FROM auth.users;`);
  console.log("Auth Users:");
  console.table(authUsers.rows);

  await client.end();
}

listUsers();
