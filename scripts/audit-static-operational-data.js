import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const sourceRoot = path.join(root, 'src');
const findings = [];
const rules = [
  { name: 'mock operational import', pattern: /(?:from|import\s*\()\s*['"][^'"]*(?:mockData|fixtures|seedData)/i },
  { name: 'mock production switch', pattern: /VITE_USE_MOCK_DATA\s*===\s*['"]true['"]/ },
  { name: 'fabricated operational identifier', pattern: /(?:TEST-(?:VENDA|COMPRA)|mov-\$\{Date\.now|art-\$\{Date\.now)/ },
  { name: 'embedded initial operational collection', pattern: /\bINITIAL_(?:ARTICLES|SALES|CLIENTS|SUPPLIERS|STOCK_MOVEMENTS)\b/ },
  { name: 'hardcoded privileged credential', pattern: /(?:service_role|access_token|password)\s*[:=]\s*['"][^'"]{12,}['"]/i },
  { name: 'hardcoded UUID in application source', pattern: /\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/i },
  { name: 'hardcoded example email', pattern: /\b(?:example|teste?|demo)@[\w.-]+\.[a-z]{2,}\b/i },
  { name: 'direct financial table mutation', pattern: /\.from\(['"](?:documents|document_lines|payments|ledger_entries)['"]\)\.(?:insert|update|delete)\(/ },
  { name: 'direct stock ledger mutation', pattern: /\.from\(['"](?:stock_movements|inventory_balances)['"]\)\.(?:insert|update|delete)\(/ },
  { name: 'fabricated operational document number', pattern: /(?:docNumber|displayNumber)\s*:\s*`[^`]*\$\{[^}]*Math\.random\(\)/ },
];

function walk(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) walk(file);
    else if (/\.(?:ts|tsx|js|jsx)$/.test(entry.name)) {
      const text = fs.readFileSync(file, 'utf8');
      for (const rule of rules) {
        const match = rule.pattern.exec(text);
        if (match) {
          const line = text.slice(0, match.index).split(/\r?\n/).length;
          findings.push(`${path.relative(root, file)}:${line} — ${rule.name}`);
        }
      }
    }
  }
}

walk(sourceRoot);
for (const file of ['vite.config.ts', 'index.html']) {
  const location = path.join(root, file);
  if (!fs.existsSync(location)) continue;
  const text = fs.readFileSync(location, 'utf8');
  for (const match of text.matchAll(/https:\/\/([a-z0-9]+)\.supabase\.co/gi)) {
    if (match[1] !== 'bkbcgndzsfylwsinxwbb') findings.push(`${file} — obsolete Supabase project`);
  }
}
if (findings.length) {
  console.error('Static operational data audit: FAIL');
  for (const finding of findings) console.error(`- ${finding}`);
  process.exit(1);
}
console.log('Static operational data audit: PASS');
