# Agent & Developer Guide — bob.yexley.net

This document captures development conventions and patterns for AI agents and future maintainers working on this codebase.

## Icon System

**No icon font webfonts.** This project uses a curated Lucide SVG path registry instead of the old Material Symbols/Icons webfonts (migrated 2026-10-06). Icons are inline SVGs rendered at `1em` with `currentColor` for optimal performance and zero font-loading overhead.

### Architecture

- **Icon component**: `src/components/icon.tsx` — renders `<Icon name="iconName" />` as inline SVG (24×24 viewBox, 1em size)
- **Registry**: `src/components/icon-registry.ts` — typed `IconName` union + `iconGlyphs` Record mapping names to official Lucide SVG children
- **No npm package**: do NOT install `lucide-react` or `lucide-solid` — the registry is hand-curated for this site's actual icon needs

### Icon Names

**camelCase**: all icon names use camelCase (`arrowLeft`, `circleCheck`, `fileText`). The old Material snake_case names (`arrow_back`, `check_circle`, `description`) were migrated to Lucide equivalents.

**Type safety**: `IconName` is a union of all registered icon names. Invalid icon names are type errors at build time.

### How to Add an Icon

1. **Find the icon** at [lucide.dev](https://lucide.dev) or [https://lucide.dev/icons](https://lucide.dev/icons)
2. **Download the SVG** (or view source)
3. **Copy the SVG children unchanged** (`path`, `circle`, `rect`, `line`) into `iconGlyphs` in `icon-registry.ts`. Do not rewrite shapes as paths.
4. **Add to the `IconName` union** at the top of `icon-registry.ts`
5. **Brand marks**: if adding a brand logo (e.g. social media icon), set `filled: true` in the glyph entry. Most Lucide icons are outline-stroked (filled: false, the default).

**Example** — adding `heart`:

```ts
// In icon-registry.ts IconName union:
export type IconName =
  | "arrowLeft"
  | "heart"  // ← add here
  | "trash"
  // ...

// In iconGlyphs Record:
export const iconGlyphs: Record<IconName, IconGlyph> = {
  // ...
  heart: {
    nodes: [
      { tag: "path", d: "M2 9.5a5.5 5.5 0 0 1 9.591-3.676.56.56 0 0 0 .818 0A5.49 5.49 0 0 1 22 9.5c0 2.29-1.5 4-3 5.5l-5.492 5.313a2 2 0 0 1-3 .019L5 15c-1.5-1.5-3-3.2-3-5.5" },
    ],
  },
  // ...
}
```

### Icon Licensing

- **Lucide** paths are ISC licensed (permissive). Copyright Lucide Contributors. Attribution comment is in `icon-registry.ts` header.
- **Material Design Icons** (for filled brand marks not in Lucide) are Apache-2.0. Copyright Pictogrammers. Noted per-icon in registry.

### Rules

- **Never reintroduce Material webfonts.** Do NOT add back `fonts.googleapis.com/icon?family=Material+Icons` or `Material+Symbols+Outlined` stylesheet links.
- **Keep the registry minimal.** Only add icons the site actually uses. If an icon becomes unused, consider removing it (check with `grep -r "iconName"` first).
- **Prefer existing registry icons** over adding new ones when a close semantic match exists.

---

## UI Styling Conventions

- **Root class + nested CSS**: prefer a normal root class for each component and nested CSS for child styling.
- **Short child classes**: when nesting is not enough, use short underscore-prefixed names like `._panel`, `._trigger`, or `._day` scoped beneath the root selector.
- **No long BEM chains**: avoid `component-name-child-subchild-modifier`. Scope with nesting instead.

## Sizing Units

**rem/em only for sizing** — see `.cursor/rules/css-units.mdc`. All lengths (widths, heights, padding, margin, gap, font sizes, border widths, border radii, media/container query breakpoints) use `rem` or `em`. Never `px` except for:

- pointer/gesture math and transforms (`translateX(${dragX}px)`)
- `IntersectionObserver` `rootMargin`
- canvas/image pixel dimensions
- image variant width hints (server-side)
- viewport sizes measured at runtime (scrollbar compensation, tooltip offsets, visual-viewport insets)

## Database Workflow

- **Supabase CLI** for local development and schema migrations.
- `supabase/migrations/` is the source of truth for schema changes.
- `database/` is legacy reference only; do NOT add new schema changes there.
- Do NOT make schema changes in the hosted Supabase dashboard.

### Quick start

1. `pnpm db:start` — starts local Supabase stack (requires Docker)
2. `pnpm db:bootstrap:fixtures` — applies migrations and seeds fixture accounts + blips
3. Copy local credentials from `pnpm db:status` into `.env.local`
4. `pnpm build && pnpm start` — production build + server

See [README.md](./README.md) for full database command reference.

---

## Testing & Linting

- **oxlint**: `pnpm run lint:oxlint` (must pass before PR merge)
- **build**: `pnpm build` (must succeed)
- **tests**: `pnpm test` (Vitest + Playwright; ensure tests pass or are intentionally skipped)

---

## Notes for Agents

- This is a **Solid.js** app (not React) with SolidStart, Tailwind CSS, and TypeScript.
- Icon strings like `<Icon name="trash" />` are now **typed** — invalid icon names are type errors.
- Icon props on `Button`, `IconButton`, `Card`, `Drawer`, `Menu`, etc. accept `IconName`, not `string`.
- **No icon font flicker**: icons render immediately (inline SVG) with no FOIT/FOUT.
- The old `FontFaceObserver` handling for Material fonts is removed; `handleIconsReady()` in `src/util/fonts.ts` is now a no-op.
