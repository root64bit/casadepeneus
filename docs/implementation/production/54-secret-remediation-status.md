# Secret Remediation Status

> Review date: 2026-07-28

## Completed locally

- `.env` removed from Git tracking while the local ignored file was preserved.
- `.env.example` contains placeholders only.
- Browser configuration no longer embeds a hard-coded project URL or key.
- `DATABASE_URL`, database passwords, service-role keys, and tokens are
  explicitly prohibited from `VITE_*` variables.

## History finding

`.env` exists in commits `2024a72` and `abf149c`. Removing it from the current
tree does not remove those historical copies. Treat every non-public credential
that appeared there as exposed.

## Required external completion before PILOT

- Rotate the production database password in Supabase.
- Rotate any service-role key, access token, or third-party credential found in
  the historical file.
- Update approved secret stores and CI/deployment settings.
- Re-test database backup and deployment access with the rotated credentials.
- Decide whether to rewrite Git history. If chosen, coordinate a protected
  force-push and require every clone to re-clone; credential rotation remains
  mandatory even after rewriting.

The public Supabase anon key is intended for browser use but must still target
the approved production project and remain protected by RLS. Secret rotation is
not claimed complete until the external actions above are evidenced.
