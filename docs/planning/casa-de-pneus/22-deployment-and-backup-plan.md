# Deployment and Backup Plan

## 1. Overview
This document outlines the infrastructure, deployment pipelines, and disaster recovery strategies for the new Casa de Pneus management system.

## 2. Infrastructure Deployment
- **Frontend & API**: Hosted on **Vercel**. Next.js applications run natively on Vercel, providing optimal performance, global edge caching for static assets, and scalable serverless functions for API routes.
- **Database, Auth, Storage**: Hosted on **Supabase** (managed PostgreSQL). Provides built-in authentication, Row Level Security, object storage (for PDFs, images), and Edge Functions if needed.

## 3. Environment Setup
- **Development**: Local environment using Supabase CLI (local PostgreSQL + Auth) and local Next.js dev server.
- **Staging**: Hosted on Vercel (`staging` branch) connected to a separate Supabase Staging project. Used for user acceptance testing (UAT) and migration dry-runs.
- **Production**: Hosted on Vercel (`main` branch) connected to the Production Supabase project. Live environment.

## 4. CI/CD Pipeline
Implemented via **GitHub Actions** and Vercel's native integration.
- **Push to Branch**: Triggers GitHub Actions.
  1. **Lint**: Run ESLint and Prettier.
  2. **Type Check**: Run TypeScript compilation checks (`tsc --noEmit`).
  3. **Test**: Run unit and integration tests.
- **Merge to `staging`**: Vercel automatically builds and deploys to the staging URL.
- **Merge to `main`**: Vercel automatically builds and deploys to the production URL.

## 5. Database Migrations
- Managed via the **Supabase CLI**.
- Schema changes are saved as sequential SQL migration files in `supabase/migrations/`.
- Local changes are generated using `supabase db diff`.
- Migrations are applied automatically to Staging and Production via GitHub Actions using the Supabase CLI (`supabase link` and `supabase db push`), ensuring schema consistency across all environments.

## 6. Backup Strategy
- **Supabase Automatic Backups**: Daily automated physical backups configured in the Supabase Production project. Point-in-Time Recovery (PITR) enabled if available/budgeted, allowing restoration to any minute.
- **Manual Backups**: Before any major system update or final data migration cutover, a manual full backup (`pg_dump`) is executed and stored securely in an external location.
- **Storage Backups**: Periodic backups of the Supabase Storage buckets containing uploaded documents or generated PDFs.

## 7. Disaster Recovery
- **RTO (Recovery Time Objective)**: Target time to restore service after a failure is < 4 hours.
- **RPO (Recovery Point Objective)**: Target maximum data loss is < 24 hours (based on daily backups), or minimal if PITR is active.
- If the primary region goes down, a new Supabase project can be spun up in an alternative region, and the latest SQL dump applied. Vercel routes traffic dynamically and is highly resilient.

## 8. Monitoring and Logging
- **Error Tracking**: Integration with Sentry or LogRocket for real-time frontend and serverless function error tracking.
- **Performance**: Vercel Analytics for web vitals, latency, and request tracing.
- **Database Logs**: Supabase dashboard provides slow query logs, Postgres error logs, and Auth logs.
- **Uptime**: Setup an external ping service (e.g., UptimeRobot) to alert administrators if the production URL is unreachable.

## 9. Security & SSL/TLS
- **SSL/TLS**: Provided automatically by Vercel for all custom domains. Supabase connections are encrypted natively via PostgreSQL SSL modes.
- **Domain Setup**: Initial deployment to `casadepeneus.vercel.app`. The production custom domain (e.g., `sistema.casadepneus.co.mz`) will be configured in Vercel.

## 10. Environment Variables
- Handled securely via Vercel Environment Variables configuration.
- Must include:
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - `SUPABASE_SERVICE_ROLE_KEY` (Server-side only)
  - Any external API keys.
- Never commit `.env` files to source control. Use `.env.example` for reference.
