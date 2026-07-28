# 27 Open Questions

## Technical & Infrastructure
- What exact database engine does XT-POS PRO v3.50 use? (e.g., Access, SQL Server Express, Firebird)
- What is the character encoding of the legacy data? (Likely Windows-1252 or ISO-8859-1, needs verification)
- What is the internet reliability at the business location?
- Should the system work offline? If so, which functions? (Critical for POS operations?)

## Data & Migration
- Are there multiple fiscal years of data or just current?
- How many articles, customers, suppliers, documents exist? (Needed for sizing and performance tuning)
- Is there multi-warehouse support in the legacy system?

## Business & Operations
- What document numbering format is used (with or without prefix)?
- What payment methods are currently supported?
- Are there existing integration requirements (banking, tax authority)?
- Are there multiple users in the legacy system? What roles?
- What reports are most critical for day-to-day operations?

## Hardware & Peripherals
- Is barcode scanning hardware available? What type?
- What printer hardware is available? Receipt printer? A4?

## Compliance
- Are there any legal/fiscal requirements for electronic invoicing in Mozambique that we must adhere to strictly?
