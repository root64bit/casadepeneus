# 26 Risk Register

| ID | Risk | Category | Probability | Impact | Mitigation | Contingency | Owner | Status |
|---|---|---|---|---|---|---|---|---|
| RSK-01 | Legacy data format unknown | Technical | High | High | Early discovery phase (Phase 0) to analyze XT-POS DB format. | Use CSV exports or screen scraping if direct DB access fails. | Dev Team | Open |
| RSK-02 | Character encoding corruption | Data | Medium | High | Identify encoding early (e.g., CP1252/ISO-8859-1) and test conversion to UTF-8. | Build custom encoding mapping scripts. | Data Eng | Open |
| RSK-03 | Stock balance discrepancies | Operational | Medium | High | Reconcile stock post-migration; mandate physical inventory count before go-live. | Post-migration adjustment tools. | Ops | Open |
| RSK-04 | Fiscal compliance gaps | Compliance | Low | Critical | Research Mozambican fiscal requirements (e.g., sequential numbering, tax codes). | Hire local fiscal consultant if needed. | PM | Open |
| RSK-05 | User resistance to new system | Adoption | Medium | Medium | Involve users early; mimic legacy keyboard shortcuts (F2, F3). | Phased rollout, extended training sessions. | Change Mgt | Open |
| RSK-06 | Internet dependency for cloud system | Infrastructure | Medium | High | Implement offline capabilities for core sales; investigate local caching (PWA). | Provide 4G/5G backup router for the shop. | IT Support | Open |
| RSK-07 | Data loss during migration | Data | Low | Critical | Ensure full disk images and multiple verified backups before any action. | Restore from Phase 0 backups. | Dev Team | Open |
| RSK-08 | Performance issues with large datasets | Technical | Low | Medium | Implement pagination, database indexing, and query optimization from day one. | Upgrade Supabase compute tier if necessary. | Dev Team | Open |
| RSK-09 | Supabase service disruption | External | Low | High | Use Supabase Point-in-Time Recovery and standard SLAs. | Read-only mode fallbacks. | DevOps | Open |
| RSK-10 | Concurrent access conflicts | Technical | Medium | Medium | Implement optimistic concurrency control (versioning) on high-contention tables. | Transaction retries and lock mechanisms. | Dev Team | Open |
