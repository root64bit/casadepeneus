import pg from "pg";
import dotenv from "dotenv";
import fs from "node:fs";
import path from "node:path";

dotenv.config();

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is required.");
}

const repair = process.argv.includes("--repair");
const migrationDirectory = "supabase/migrations";
const migrationFiles = fs
  .readdirSync(migrationDirectory)
  .filter((name) => /^\d+_/.test(name))
  .filter((name) => Number(name.slice(0, 14)) <= 20260728270000)
  .sort();

const expectedByMigration = migrationFiles.map((fileName) => {
  const sql = fs.readFileSync(path.join(migrationDirectory, fileName), "utf8");
  const relations = [
    ...sql.matchAll(
      /CREATE\s+(?:OR\s+REPLACE\s+)?(?:TABLE|VIEW)\s+(?:IF\s+NOT\s+EXISTS\s+)?([a-z_][\w]*)\.([a-z_][\w]*)/gi,
    ),
  ].map((match) => `${match[1]}.${match[2]}`);
  const functions = [
    ...sql.matchAll(
      /CREATE\s+OR\s+REPLACE\s+FUNCTION\s+([a-z_][\w]*)\.([a-z_][\w]*)\s*\(/gi,
    ),
  ].map((match) => `${match[1]}.${match[2]}`);

  const [version, ...nameParts] = fileName.replace(/\.sql$/i, "").split("_");
  return {
    fileName,
    version,
    name: nameParts.join("_"),
    relations: [...new Set(relations)],
    functions: [...new Set(functions)],
  };
});

const client = new pg.Client({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

try {
  await client.connect();
  await client.query(repair ? "BEGIN" : "BEGIN READ ONLY");

  const results = [];
  for (const migration of expectedByMigration) {
    const missingRelations = [];
    for (const relation of migration.relations) {
      const result = await client.query("SELECT to_regclass($1) IS NOT NULL AS exists", [
        relation,
      ]);
      if (!result.rows[0].exists) missingRelations.push(relation);
    }

    const missingFunctions = [];
    for (const functionName of migration.functions) {
      const [schemaName, routineName] = functionName.split(".");
      const result = await client.query(
        `
          SELECT EXISTS (
            SELECT 1
            FROM pg_proc p
            JOIN pg_namespace n ON n.oid = p.pronamespace
            WHERE n.nspname = $1 AND p.proname = $2
          ) AS exists
        `,
        [schemaName, routineName],
      );
      if (!result.rows[0].exists) missingFunctions.push(functionName);
    }

    results.push({
      version: migration.version,
      name: migration.name,
      relationsChecked: migration.relations.length,
      functionsChecked: migration.functions.length,
      missingRelations,
      missingFunctions,
      status:
        missingRelations.length === 0 && missingFunctions.length === 0
          ? "PASS"
          : "FAIL",
    });
  }

  const failures = results.filter((result) => result.status === "FAIL");
  if (repair && failures.length > 0) {
    throw new Error("Baseline repair refused because expected objects are missing.");
  }

  if (repair) {
    for (const migration of expectedByMigration) {
      await client.query(
        `
          INSERT INTO supabase_migrations.schema_migrations (version, name, statements)
          VALUES ($1, $2, ARRAY[]::TEXT[])
          ON CONFLICT (version) DO UPDATE SET name = EXCLUDED.name
        `,
        [migration.version, migration.name],
      );
    }
    await client.query("COMMIT");
  } else {
    await client.query("ROLLBACK");
  }

  console.log(
    JSON.stringify(
      {
        mode: repair ? "REPAIR" : "AUDIT",
        status: failures.length === 0 ? "PASS" : "FAIL",
        migrations: results,
      },
      null,
      2,
    ),
  );

  if (failures.length > 0) process.exitCode = 1;
} catch (error) {
  await client.query("ROLLBACK").catch(() => {});
  throw error;
} finally {
  await client.end();
}
