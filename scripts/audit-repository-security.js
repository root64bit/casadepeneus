import { execFileSync } from 'node:child_process';
import fs from 'node:fs';

const tracked = execFileSync('git', ['ls-files', '-z'])
  .toString('utf8')
  .split('\0')
  .filter(Boolean);
const findings = [];
for (const file of tracked) {
  if (/^\.env(?:\.|$)/i.test(file) && file !== '.env.example') {
    findings.push(`${file}: environment file is tracked`);
    continue;
  }
  if (!fs.existsSync(file) || fs.statSync(file).size > 2_000_000) continue;
  const text = fs.readFileSync(file, 'utf8');
  if (/(?:service_role|DATABASE_URL|access_token)\s*=\s*\S{16,}/i.test(text)) {
    findings.push(`${file}: populated privileged secret`);
  }
  if (/sb_secret_[A-Za-z0-9_-]{20,}/.test(text)) {
    findings.push(`${file}: Supabase secret key`);
  }
}
if (findings.length) {
  console.error('Repository security audit: FAIL');
  findings.forEach((finding) => console.error(`- ${finding}`));
  process.exit(1);
}
console.log('Repository security audit: PASS');
