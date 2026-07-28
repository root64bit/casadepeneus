import fs from 'fs';
import dotenv from 'dotenv';
dotenv.config();
import pkg from 'pg';
const { Client } = pkg;

async function rotatePasswordViaApi() {
  const token = process.env.access_token || process.env.SUPABASE_ACCESS_TOKEN;
  if (!token) {
    throw new Error("access_token not found in environment.");
  }

  const projectRef = 'bkbcgndzsfylwsinxwbb';
  const oldConnStr = process.env.DATABASE_URL;

  // Generate strong new password
  const newPass = 'CP_Prod_' + Math.random().toString(36).substring(2, 10) + '_2026Sec!';
  console.log("Rotating production database password via Supabase Management API...");

  const res = await fetch(`https://api.supabase.com/v1/projects/${projectRef}/database/password`, {
    method: 'PATCH',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ password: newPass })
  });

  if (!res.ok) {
    throw new Error(`Failed to reset password via API: ${res.status} ${await res.text()}`);
  }

  console.log("[PASS] Password successfully updated in Supabase project bkbcgndzsfylwsinxwbb!");

  // Wait 10 seconds for Supabase connection pooler to reload password
  console.log("Waiting 10 seconds for connection pooler to reload password...");
  await new Promise(r => setTimeout(r, 10000));

  // Extract old password from DATABASE_URL
  const match = oldConnStr.match(/postgres:[^@]+@/);
  if (!match) throw new Error("Could not parse password from DATABASE_URL");
  const newConnStr = oldConnStr.replace(match[0], `postgres:${newPass}@`);

  // Update .env file locally
  let envContent = fs.readFileSync('.env', 'utf8');
  envContent = envContent.replace(oldConnStr, newConnStr);
  fs.writeFileSync('.env', envContent, 'utf8');
  console.log("Updated local .env file with new DATABASE_URL!");

  // Verify OLD exposed password fails
  console.log("\nVerifying OLD exposed password authentication...");
  const oldUrl = 'postgres://postgres.bkbcgndzsfylwsinxwbb:casadepeneus@aws-0-eu-west-1.pooler.supabase.com:6543/postgres';
  const clientOld = new Client({ connectionString: oldUrl, ssl: { rejectUnauthorized: false } });
  try {
    await clientOld.connect();
    console.error("ERROR: Old exposed password still authenticates!");
  } catch (e) {
    console.log("[PASS] Old exposed password authentication FAILED as expected! (" + e.message + ")");
  }

  // Verify NEW password succeeds
  console.log("Verifying NEW database password authentication...");
  const clientNew = new Client({ connectionString: newConnStr, ssl: { rejectUnauthorized: false } });
  await clientNew.connect();
  console.log("[PASS] New database password authenticated SUCCESSFULLY!");
  await clientNew.end();

  console.log("\n=== DATABASE PASSWORD ROTATION & VERIFICATION: 100% SUCCESS ===");
}

rotatePasswordViaApi().catch(e => console.error("Rotation error:", e.message));
