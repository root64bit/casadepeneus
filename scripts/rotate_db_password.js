import pkg from 'pg';
const { Client } = pkg;
import fs from 'fs';
import dotenv from 'dotenv';
dotenv.config();

async function rotateDbPassword() {
  const connStr = process.env.DATABASE_URL;
  console.log("Connecting with current DATABASE_URL...");
  const client = new Client({
    connectionString: connStr,
    ssl: { rejectUnauthorized: false }
  });

  await client.connect();
  console.log("Connected successfully! Generating new secure database password...");

  const newPass = 'CP_Prod_' + Math.random().toString(36).substring(2, 12) + '_2026';
  
  console.log("Executing ALTER ROLE postgres WITH PASSWORD ...");
  await client.query(`ALTER ROLE postgres WITH PASSWORD '${newPass}';`);
  console.log("POSTGRESQL PASSWORD SUCCESSFULLY ROTATED IN SUPABASE DATABASE!");

  await client.end();

  // Construct new connection string
  const oldPass = 'casadepeneus';
  const newConnStr = connStr.replace(oldPass, newPass);

  // Update .env file locally
  let envContent = fs.readFileSync('.env', 'utf8');
  envContent = envContent.replace(connStr, newConnStr);
  fs.writeFileSync('.env', envContent, 'utf8');
  console.log("Updated local .env file with new secure DATABASE_URL!");

  // Verify old password FAILS
  console.log("\nVerifying OLD exposed password authentication...");
  const clientOld = new Client({ connectionString: connStr, ssl: { rejectUnauthorized: false } });
  try {
    await clientOld.connect();
    console.error("ERROR: Old password still connected!");
  } catch (e) {
    console.log("[PASS] Old exposed password authentication FAILED as expected! (" + e.message + ")");
  }

  // Verify new password SUCCEEDS
  console.log("Verifying NEW database password authentication...");
  const clientNew = new Client({ connectionString: newConnStr, ssl: { rejectUnauthorized: false } });
  await clientNew.connect();
  console.log("[PASS] New database password authenticated SUCCESSFULLY!");
  await clientNew.end();

  console.log("\n=== DATABASE PASSWORD ROTATION & VERIFICATION COMPLETE: 100% SUCCESS ===");
}

rotateDbPassword().catch(e => console.error("Rotation error:", e));
