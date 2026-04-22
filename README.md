# bob.yexley.net

- [Solid.js](https://www.solidjs.com/) with [SolidStart](https://start.solidjs.com/)
- [Tailwind CSS](https://tailwindcss.com/) (with/via [clsx](https://github.com/lukeed/clsx)) ([cheatsheet](https://nerdcave.com/tailwind-cheat-sheet))
- TypeScript (_sigh_)
- [ESLint](https://eslint.org/)
- [shadcn-solid](https://shadcn-solid.com/)
- [Kobalte](https://kobalte.dev/) (kinda like Radix UI for Solid.js)
- [solid-i18n](https://github.com/SanichKotikov/solid-i18n)
- [Cloudflare](https://dash.cloudflare.com/671eff5187276e8e51b1c59181f401b1/pages/view/web-stack)

## UI styling conventions

- Prefer a normal root class for each component and nested CSS for child styling.
- For child classes scoped beneath a root selector, use short underscore-prefixed names like `._panel`, `._trigger`, or `._day`.
- Avoid repeating the full component name on nested child classes unless the selector must work outside the component root, such as intentionally portaled content.

## Database workflow

This project now uses the Supabase CLI for local database development and schema migrations.

- `supabase/migrations/` is the source of truth for schema changes moving forward.
- The legacy `database/` folder is being kept temporarily as historical reference only.
- Do not make new schema changes in the hosted Supabase dashboard.
- Do not add new schema changes to `database/`.

## Local database commands

- `pnpm db:start` starts the local Supabase stack.
- `pnpm db:stop` stops the local Supabase stack.
- `pnpm db:status` shows local URLs, keys, and connection details.
- `pnpm db:reset` rebuilds the local database from migrations and seed data.
- `pnpm db:pull` pulls the linked remote schema into a baseline migration.
- `pnpm db:push:local` applies pending migrations to the local database.
- `pnpm db:push:remote` applies pending migrations to the linked remote project.
- `pnpm db:diff -- -f <name>` creates a migration from local schema changes.
- `pnpm db:migration:new -- <name>` creates a blank migration file.
- `pnpm db:migration:list` lists migrations and applied status.
- `pnpm db:types` generates TypeScript database types from the local database into `src/types/database.types.ts`.
- `pnpm db:bootstrap:superuser -- --email you@example.com --password your-password --display-name "Your Name"` creates or updates a local auth user and promotes it to app role `superuser`.
- `pnpm db:bootstrap:visitors` creates the local fixture accounts, including authored-content accounts and visitor accounts with shared PIN `123456`.
- `pnpm db:bootstrap:fixtures` creates the local fixture accounts, then seeds authored blips, tags, and visitor reactions.
- `pnpm db:reset:fixtures` rebuilds the local DB from migrations and `seed.sql`, then bootstraps the authored and visitor fixture data.
- `pnpm dev` starts the app dev server only.
- `pnpm dev:local` is currently the same as `pnpm dev`.
- `pnpm dev:app` also starts only the app dev server.

## Notes

- The initial baseline migration still needs to be pulled from the current production project after `supabase login` and `supabase link`.
- Generated database types are optional but useful for typed `supabase-js` queries, inserts, updates, RPC calls, and views.
- `pnpm db:bootstrap:superuser` is intended for local development only and depends on the local Supabase stack already running.
- `supabase/seed.sql` now seeds auth-independent baseline data only, currently the production-derived tag set.
- Fixture auth accounts are created through the admin API, and authored blips are seeded afterward so they can use valid app-generated blip IDs and admin/superuser owners.
