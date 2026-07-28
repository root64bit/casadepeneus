import fs from 'node:fs';
import path from 'node:path';
import dotenv from 'dotenv';

const projectRef = 'bkbcgndzsfylwsinxwbb';
const envPath = path.join(process.cwd(), '.env');
const current = dotenv.parse(fs.readFileSync(envPath, 'utf8'));
if (!current.access_token) throw new Error('Management access token is unavailable.');

const headers = { Authorization: `Bearer ${current.access_token}` };
const listResponse = await fetch(
  `https://api.supabase.com/v1/projects/${projectRef}/api-keys?reveal=false`,
  { headers },
);
if (!listResponse.ok) throw new Error(`Unable to list API keys (${listResponse.status}).`);
const keys = await listResponse.json();
const publishable = keys.find((key) => key.type === 'publishable' && key.name === 'default');
const secret = keys.find((key) => key.type === 'secret' && key.name === 'default');
if (!publishable || !secret) throw new Error('Default publishable/secret key pair not found.');

async function reveal(id) {
  const response = await fetch(
    `https://api.supabase.com/v1/projects/${projectRef}/api-keys/${id}?reveal=true`,
    { headers },
  );
  if (!response.ok) throw new Error(`Unable to reveal replacement key (${response.status}).`);
  const body = await response.json();
  if (!body.api_key) throw new Error('Replacement API key value is unavailable.');
  return body.api_key;
}

const [publishableValue, secretValue] = await Promise.all([
  reveal(publishable.id),
  reveal(secret.id),
]);
if (!publishableValue.startsWith('sb_publishable_') || !secretValue.startsWith('sb_secret_')) {
  throw new Error('Unexpected replacement key format.');
}

current.VITE_SUPABASE_ANON_KEY = publishableValue;
current.service_role = secretValue;
const content = Object.entries(current)
  .map(([key, value]) => `${key}=${value}`)
  .join('\n');
fs.writeFileSync(envPath, `${content}\n`, { mode: 0o600 });
console.log('Local Supabase API keys migrated to publishable/secret formats; values were not logged.');
