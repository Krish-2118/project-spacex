This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## One-time event import (`final sheet events.xlsx`)

Imports the **Final Events** sheet into `public.events`. The **Needs Review** sheet is skipped (categories not confirmed).
Both scripts read credentials from `.env` (see `.env.example`); none are written to the generated files.

**1. Posters** (`scripts/process-event-posters.mjs`): downloads each event's first poster link from Google Drive,
converts it to WebP below 1,000,000 bytes (auto-oriented, longest edge at most 2560px, never below 1080px), and uploads
it to ImageKit `/innovision/events`.

```bash
node --env-file=.env scripts/process-event-posters.mjs --dry-run   # no uploads: check output/previews + reports
node --env-file=.env scripts/process-event-posters.mjs             # upload, write output/events-ready-to-import.csv
```

- Drive files must be shared "Anyone with the link"; otherwise Drive returns a sign-in page and the row fails.
  PDF posters fail too: export them as PNG/JPG in Drive (same link) and rerun.
- Categories: `Flagship` → `flagship events`, `Standout` → `standout events`, `Main` → `main events`.
  Rulebook links become `brochure_url`. For repeated names (trimmed, case-insensitive), the last row wins.
- `--overrides event-import-overrides.json` applies per-title decisions: `exclude` (e.g. duplicate events),
  `posterFiles` (a local PNG/JPG replacing the Drive poster, path relative to the JSON file) and `descriptionFixes`
  (exact text replacements; each must match). Every title must match a row of the sheet. Pass the same file on
  every run. Add `--no-upload` to rebuild the CSV from the existing ImageKit uploads only.
- Safe to rerun: rows that were ready in the previous report are kept without downloading or uploading again, as long
  as their poster source is unchanged and the ImageKit file still exists (`--refresh` reprocesses everything).
  ImageKit names contain a hash of the WebP, so existing files are never overwritten or duplicated.
  The script exits with code 2 if any row failed.
- Outputs: `events-ready-to-import.csv` (`title, description, poster_url, brochure_url, category`),
  `events-processing-report.json` (every row and its status), `events-failed.csv`, `previews/` (git-ignored).

**2. Database** (`scripts/build-events-import-sql.mjs`): validates the CSV against the table constraints and writes
`output/events-import.sql`. The Supabase CSV importer can't skip existing titles, so the SQL stages the rows in a temp
table and inserts only titles not already in `public.events` (trimmed, case-insensitive; the table has no unique
constraint on `title`). It never updates or deletes, and a second run inserts nothing.

```bash
node --env-file=.env scripts/build-events-import-sql.mjs --inspect-db   # read-only: live columns, constraints,
                                                                        # existing titles -> events-insert-plan.json
```

Review `output/events-insert-plan.json`, then run `output/events-import.sql` once in the Supabase SQL Editor (or
`psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f output/events-import.sql`). Its last result lists each row as inserted
or skipped. `format`, `duration` and `venue` take the column defaults; `created_by` stays NULL.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
