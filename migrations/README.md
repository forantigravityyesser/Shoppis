# Migrations

Project-owned, sequential SQL migrations. Applied by hand through the admin SQL
path (InsForge admin query / MCP). The applied history is recorded in the
**`public.schema_migrations`** table (created by `0034_create_schema_migrations.sql`).

## Naming convention

```
<NNNN>_<lower_snake_name>.sql
```

- `NNNN` — 4-digit zero-padded version, contiguous from `0001`.
- name — `lower_snake_case`, no spaces and no uppercase.
- Examples: `0026_storefront_catalog_read.sql`, `0033_storefront_catalog_hardening.sql`.

Validate the whole directory at any time:

```bash
npm run migrations:check
```

It fails on malformed names, duplicate versions, or numbering gaps — the exact
class of regression that produced two `0030_*` files.

## Tracking

`public.schema_migrations` is the registry of what is applied to this backend:

| column       | meaning                                   |
| ------------ | ----------------------------------------- |
| `version`    | 4-digit version (PK)                      |
| `name`       | migration name without version/extension  |
| `applied_at` | when it was recorded                      |

`0034` bootstrapped the table and backfilled `0001..0034` as the baseline.

After applying a new migration, record it:

```bash
npm run migrations:record -- 0035
```

Inspect what is applied:

```bash
npx -y @insforge/cli db query "select version, name, applied_at from public.schema_migrations order by version"
```

Access: the table is `REVOKE`d from `anon`/`authenticated`; only the migration
owner (`project_admin`) can read/write it. Migration history is not public.

## Workflow

1. Create `migrations/<NNNN>_name.sql` with the next free version.
2. Apply the file as a whole through the admin SQL path (multi-statement files are
   normal — all existing migrations are multi-statement).
3. Record it: `npm run migrations:record -- <NNNN>`.
4. `npm run migrations:check` stays green.

## Why not the InsForge CLI `db migrations`

The CLI manages migrations under `migrations/` too, but its format/flow cannot
represent this project's history:

- **Timestamp versions + hyphenated names required** (`20260418091500_create-users.sql`),
  while this project uses `0001_...` versions and snake_case names.
- **Strict validation of every file** in `migrations/` on `new` / `up --to` /
  `up --all` — legacy files would block the CLI entirely.
- **No backfill**: there is no "mark as already applied". Adoption would mean
  renaming all files and re-applying already-applied, non-idempotent DDL.

So tracking lives in the project-owned `public.schema_migrations` table.
Reconsider adopting the CLI only as a deliberate, separate migration-hygiene
project (rename + baseline), not as an in-place retrofit.
