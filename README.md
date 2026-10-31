# Innovision 2026 · The Celestial Odyssey

The official website of **Innovision 2026**, the technical fest of **NIT Rourkela** (13–15 November 2026).

The site takes visitors through four "worlds" of events, with a scroll-driven home page, an event explorer, a 3D
photo gallery, a schedule, a merch store and Google sign-in for fest registration. Staff manage it from an admin
dashboard built into the site.

Built by **OpenCode NIT Rourkela and DSC NIT Rourkela**.

---

## Contents

- [Tech stack](#tech-stack)
- [Getting started](#getting-started)
- [Environment variables](#environment-variables)
- [Database setup](#database-setup)
- [Project structure](#project-structure)
- [How the site works](#how-the-site-works)
- [Common tasks](#common-tasks)
- [Admin dashboard and roles](#admin-dashboard-and-roles)
- [API routes](#api-routes)
- [Security](#security)
- [Scripts, CI and deployment](#scripts-ci-and-deployment)
- [Contributing](#contributing)
- [Contact](#contact)

---

## Tech stack

| Area          | What we use                                                                                 |
| ------------- | ------------------------------------------------------------------------------------------- |
| Framework     | [Next.js 16](https://nextjs.org) (App Router, Turbopack) · React 19 · TypeScript            |
| Animation     | [GSAP 3](https://gsap.com) with ScrollTrigger and ScrambleText                              |
| Auth and data | [Supabase](https://supabase.com): Google OAuth, Postgres with Row Level Security, Storage   |
| Images        | [ImageKit](https://imagekit.io): event posters and gallery photos, resized on the CDN       |
| Hosting       | [Vercel](https://vercel.com)                                                                |
| Tooling       | ESLint (`eslint-config-next`), Husky and lint-staged pre-commit hook, GitHub Actions CI     |

> **Heads-up for contributors:** Next.js 16 has breaking changes compared to older versions. For example, middleware
> is now `src/proxy.ts`. Before relying on an API you remember, read the guides bundled in `node_modules/next/dist/docs/`
> (see [`AGENTS.md`](AGENTS.md)).

---

## Getting started

**Requirements:** Node.js 22 (the version CI uses) and npm.

```bash
# 1. Clone and install
git clone https://github.com/OpencodeNIT-R/project-spacex.git
cd project-spacex
npm install            # also installs the Husky pre-commit hook

# 2. Configure the environment
cp .env.example .env   # then fill in the values (see below)

# 3. Run the dev server
npm run dev            # http://localhost:3000
```

The site renders without Supabase or ImageKit keys, but sign-in, registration, the admin dashboard, and events or
gallery photos from the database won't work until they are set.

---

## Environment variables

[`.env.example`](.env.example) is the documented template: copy it to `.env` (or `.env.local`). Real env files are
git-ignored, so never commit secrets. Anything prefixed `NEXT_PUBLIC_` is bundled into the browser and is public.

| Variable                               | Required          | Purpose                                                                                       |
| -------------------------------------- | ----------------- | --------------------------------------------------------------------------------------------- |
| `IMAGEKIT_URL_ENDPOINT`                | yes               | `https://ik.imagekit.io/<id>`. Also allowed in the Content-Security-Policy `img-src`.         |
| `IMAGEKIT_PUBLIC_KEY`                  | yes               | Server-side ImageKit SDK.                                                                     |
| `IMAGEKIT_PRIVATE_KEY`                 | yes (secret)      | Uploads and deletes posters and gallery images. Server only.                                  |
| `NEXT_PUBLIC_SUPABASE_URL`             | yes               | Supabase project URL.                                                                         |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | yes               | Publishable (anon) key. Safe in the browser because RLS is enforced.                          |
| `SUPABASE_SERVICE_ROLE_KEY`            | prod (secret)     | Backend API routes. Bypasses RLS and signs staff links to payment proofs. Server only.        |
| `NEXT_PUBLIC_SITE_URL`                 | optional          | Canonical origin for SEO, sitemap and the sign-in return URL. Defaults to `https://www.innonitrkl.com`. |
| `GOOGLE_SITE_VERIFICATION`             | optional          | Google Search Console verification token.                                                     |
| `DATABASE_URL`                         | local tools only  | Direct Postgres connection for running SQL from your machine. Never add it to Vercel.         |

---

## Database setup

The whole schema (tables, Row Level Security policies, triggers, helper functions and the private storage bucket)
is in [`supabase/schema.sql`](supabase/schema.sql). It is idempotent, so it is safe to run again after updates.

```bash
psql "$DATABASE_URL" -f supabase/schema.sql
# or paste it into Supabase Dashboard → SQL Editor
```

| Table           | Holds                                                                                         |
| --------------- | --------------------------------------------------------------------------------------------- |
| `profiles`      | One row per signed-in user (created by a trigger on Google sign-up) and their `role`.         |
| `registrations` | Fest registrations with payment status. Created only through `/api/register`.                 |
| `events`        | Events added from the admin dashboard, shown in the event worlds.                             |
| `gallery`       | Photos uploaded from the admin dashboard.                                                     |
| `user_sessions` | Server-side session records.                                                                  |

Payment screenshots go to the **private** Supabase Storage bucket `payment-proofs`. Staff see them only through
short-lived signed links.

Also configure, in the Supabase dashboard:

- **Authentication → Providers → Google**: enable Google sign-in.
- **Authentication → URL Configuration**: add `http://localhost:3000` and the production domain.

Scripts in `supabase/manual/` are one-off migrations. They are kept out of any automatic migration path on purpose,
so read each file's header before running it.

---

## Project structure

```text
src/
├── app/                        # Next.js App Router
│   ├── page.tsx                # The whole interactive site (renders <Innovision />)
│   ├── events/                 # Server-rendered event pages, one per world (for SEO and shareable links)
│   ├── register/  merch/       # "Opening soon" pages while those flows are switched off
│   ├── api/                    # Route handlers (see "API routes")
│   ├── layout.tsx              # Fonts, metadata, JSON-LD
│   ├── sitemap.ts  robots.ts   # Generated from src/config/site.ts
│   └── opengraph-image.tsx …   # Generated social share cards
├── components/
│   ├── innovision/             # The main experience
│   │   ├── Innovision.tsx      # The app shell: hash router, GSAP engine, auth, data fetching
│   │   ├── data.ts             # Content: worlds, schedule, products, sponsors, gallery, contacts
│   │   ├── gallery.json        # Static gallery photo list (ImageKit URLs)
│   │   ├── HomeView.tsx        # Landing page
│   │   ├── WorldsView.tsx  DetailView.tsx   # Event worlds and their detail scenes
│   │   ├── GalleryView.tsx     # 3D "fly through" gallery
│   │   ├── ScheduleView.tsx  MerchView.tsx
│   │   ├── SiteFooter.tsx  Hud.tsx  MenuOverlay.tsx …
│   │   ├── AdminDashboard.tsx  admin/       # Staff dashboard
│   │   └── AuthOverlay.tsx  ProfileOverlay.tsx
│   ├── coming-soon/            # Registration and merch teaser pages
│   └── events/                 # Chrome for the /events pages
├── config/
│   ├── launch.ts               # Launch switches (registrations, merch store)
│   ├── payment.ts              # Registration fee, UPI ID and UPI payment link
│   └── site.ts                 # Canonical URL and site name
├── lib/                        # Server and shared helpers: supabase, imagekit, auth, validation, security, seo
└── proxy.ts                    # Request proxy (Next 16's middleware): CSRF, rate limits, auth gate
public/assets/                  # Illustrations, planets, sounds (WebP and SVG)
supabase/                       # schema.sql and manual migrations
```

---

## How the site works

The home page is a single-page experience. [`Innovision.tsx`](src/components/innovision/Innovision.tsx) owns the state
and a small **hash router**, and swaps between views with a curtain transition:

| Route                  | View                                  |
| ---------------------- | ------------------------------------- |
| `#/`                   | Home                                  |
| `#/worlds/<slug>`      | Event worlds slider                   |
| `#/world/<slug>`       | A world's detail scene and its events |
| `#/gallery`            | 3D gallery                            |
| `#/schedule`           | Schedule                              |
| `#/merch`              | Merch store (when open)               |

The four worlds and their slugs are `flagship-events`, `standout-events`, `main-events` and `dts-and-fun-events`.
They also have real server-rendered pages at `/events/<slug>`, which search engines index and people can share.

Views load lazily on first visit. Heavy animation loops pause while a view is hidden, and low-powered devices
(or *prefers-reduced-motion*) get a lighter mode.

---

## Common tasks

### Open registrations or the merch store

Flip the switches in [`src/config/launch.ts`](src/config/launch.ts):

```ts
export const REGISTRATIONS_OPEN = true;
export const MERCH_STORE_OPEN = true;
```

While a switch is `false`, its buttons and links lead to a "coming soon" page, and the real flow stays untouched.
The registration APIs (`/api/register`, `/api/upload`) check the same switch on the server.

### Change the registration fee or UPI ID

Edit [`src/config/payment.ts`](src/config/payment.ts). The fee must match `REGISTRATION_FEE_INR` in
[`src/lib/security.ts`](src/lib/security.ts), which is what the server records. Then regenerate
`public/assets/upi-qr.svg` from the new `UPI_PAY_LINK` as a single byte-mode segment (see the comment in
`payment.ts`), and scan it to check before deploying. Until the organisers send the real QR, `upi-qr.svg` is a
"coming soon" placeholder.

### Add gallery photos

Gallery photos are a **static list** in
[`src/components/innovision/gallery.json`](src/components/innovision/gallery.json), so the home page needs no
database query to show them.

1. Convert the photo to WebP (around 2000px on the long side and quality 80 is a good default).
2. Upload it to ImageKit in the `/innovision/gallery/archive` folder.
3. Add an entry to `gallery.json`:

   ```json
   { "id": "innovision-27", "title": "Robo race", "url": "https://ik.imagekit.io/<id>/innovision/gallery/archive/innovision-27.webp", "width": 2000, "height": 1333 }
   ```

The **first six** entries fly through the home page's gallery section. The gallery page (`#/gallery`) shows all of
them. Pages request resized copies from ImageKit (`?tr=w-…`), and ImageKit picks WebP or AVIF for each browser.

Photos uploaded from the admin dashboard's Gallery tab are stored in the database and appear on the gallery page
after the static list.

### Edit content

Most copy and content lives in [`src/components/innovision/data.ts`](src/components/innovision/data.ts): the worlds,
schedule, products, sponsors (`TITLE_SPONSOR`, `SPONSOR_TIERS`), navigation links and the footer's `CONTACTS`.
Events added in the admin dashboard are merged into the worlds at runtime.

### Change the domain

Set `NEXT_PUBLIC_SITE_URL` in Vercel, add the domain under Supabase → Authentication → URL Configuration, then
redeploy. Canonical URLs, Open Graph tags, `robots.txt`, `sitemap.xml` and JSON-LD all follow it.

---

## Admin dashboard and roles

Staff open the dashboard from their profile on the site. Access depends on `profiles.role`:

| Role                | Can do                                                                   |
| ------------------- | ------------------------------------------------------------------------ |
| `user`              | Register for the fest and view their pass.                               |
| `registration-team` | Review registrations and payment proofs, approve or reject them.         |
| `viewer`            | See what the registration team sees and export it, but change nothing.   |
| `it-team`           | Manage events and gallery photos.                                        |
| `admin`             | Everything above, plus managing users' roles.                            |

Admins can switch users between `user`, `it-team`, `registration-team` and `viewer` (run
`supabase/manual/add_viewer_role.sql` once before giving anyone `viewer`). The `admin` role itself can only be granted
directly in the database:

```sql
update public.profiles set role = 'admin' where email = 'someone@example.com';
```

---

## API routes

| Route                                       | Methods                    | Access                         |
| ------------------------------------------- | -------------------------- | ------------------------------ |
| `/api/events`                               | GET                        | Public (cached)                |
| `/api/gallery`                              | GET                        | Public (cached)                |
| `/api/auth/session`                         | GET, POST                  | Session cookie handling        |
| `/api/auth/profile`                         | POST, PATCH                | Signed-in user                 |
| `/api/auth/logout`                          | POST                       | Signed-in user                 |
| `/api/register`                             | GET, POST                  | Signed-in user                 |
| `/api/upload`                               | POST                       | Signed-in user (payment proof) |
| `/api/admin/registrations`                  | GET, PATCH                 | Admin, registration team (GET: also viewer) |
| `/api/admin/registrations/payment-proof`    | GET                        | Admin, registration team, viewer |
| `/api/admin/events`                         | GET, POST, PATCH, DELETE   | Admin, IT team                 |
| `/api/admin/gallery`                        | GET, POST, PATCH, DELETE   | Admin, IT team                 |
| `/api/admin/users`                          | GET, PATCH                 | Admin                          |

---

## Security

- **Row Level Security** on every table. Privileged columns (`role`, `email`, and others) are protected by triggers,
  and registrations can only be created by the server.
- **[`src/proxy.ts`](src/proxy.ts)** rejects cross-site writes to `/api` (CSRF), caps request body size, and rate-limits
  writes and auth endpoints per IP.
- **Every route handler** checks the Supabase session and the caller's role itself. The proxy's auth gate is only an
  early filter.
- **Strict security headers** and a Content-Security-Policy are set in [`next.config.ts`](next.config.ts).
- **Secrets stay on the server.** Never put a secret in a `NEXT_PUBLIC_*` variable.

---

## Scripts, CI and deployment

```bash
npm run dev      # development server (Turbopack)
npm run build    # production build
npm run start    # serve the production build
npm run lint     # ESLint
```

- **Pre-commit:** Husky runs `eslint --fix` on staged JS/TS files.
- **CI** ([`.github/workflows/ci.yml`](.github/workflows/ci.yml)): on pushes and PRs to `main`, it runs `npm ci`,
  `npm run lint` and `npm run build` on Node 22.
- **Deployment:** Vercel builds production from the `development` branch of
  [OpencodeNIT-R/project-spacex](https://github.com/OpencodeNIT-R/project-spacex). Set the environment variables above in
  the Vercel project settings.

---

## Contributing

1. Fork the repo and create a branch from `development`.
2. Keep to the existing code style: content in `data.ts`, views as plain components that render from the `v` values
   computed in `Innovision.tsx`, and animation in the GSAP engine.
3. Run `npm run lint` and `npm run build` before opening a PR.
4. Open a pull request against `development` on
   [OpencodeNIT-R/project-spacex](https://github.com/OpencodeNIT-R/project-spacex).

---

## Contact

For queries about the fest:

- **Rishav Bansal**: [+91 79788 88164](tel:+917978888164)
- **Manjeet Srichandan**: [+91 77355 10636](tel:+917735510636)

Follow Innovision on [Instagram](https://www.instagram.com/inno.nitr_official) and
[LinkedIn](https://www.linkedin.com/company/innovision-nitrkl/).

---

<p align="center">Crafted with ♥ by <b>OpenCode NIT Rourkela and DSC NIT Rourkela</b></p>
