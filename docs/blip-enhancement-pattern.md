# Blip Enhancement Pattern

This document defines the default pattern for adding new Blip enhancements (for example: tags, reactions, comments, photos, updates).

The goal is consistency:
- predictable schema and RLS
- predictable read/write data flow
- non-blocking editor behavior
- live UI updates without full page refresh

## Core Principles

1. Keep enhancements normalized.
2. Keep canonicalization at input boundaries.
3. Keep enhancement persistence non-transactional from core blip content save.
4. Keep reads graph-shaped (blip includes enhancement data in query results).
5. Keep writes resilient (best effort, retry on later save cycles).
6. Keep local state synchronized immediately after successful enhancement writes.

## Data Modeling Pattern

Use normalized tables per enhancement.

Typical shape:
- `blips` (core entity)
- enhancement table (`tags`, `reactions`, `photos`, etc.)
- join table (`blip_tags`, `blip_reactions`, `blip_photos`, etc.) when many-to-many

For enhancement entities, include:
- `id` (UUID unless there is a strong reason not to)
- canonical business value(s)
- optional metadata fields (for example, `description`)
- `created_at`, `updated_at`

For join tables:
- composite PK on relationship keys
- FK to `blips` with `on delete cascade`
- FK to enhancement entity with cascade or restrict based on feature lifecycle

## RLS Pattern

Public reads and protected writes:
- `SELECT`: `to public` when feature should be visible to non-authenticated users
- writes (`INSERT`, `UPDATE`, `DELETE`): restricted to authenticated users with ownership checks
- include `app_security.session_is_valid()` checks where applicable

Join-table write policy should validate ownership through the related `blips` row.

## Query Pattern (Read Path)

Prefer a single graph-shaped query for read models used by UI screens:
- `getBlips`: returns blips with enhancement data included
- `getBlip`: returns single blip with enhancement data included

Example shape:
- `Blip` includes optional enhancement fields (for example, `tags?: string[]`)

Map DB nested responses into UI-friendly fields in one place (query layer), not in leaf components.

## Store/Service Pattern (Write Path)

For each enhancement, add a focused store/service module with methods like:
- list options/entities
- load enhancement values for a blip
- upsert enhancement entities
- replace/reconcile blip associations

Methods should return structured results (`{ data, error }`) instead of throwing at call sites.

## Editor Integration Pattern

Integrate enhancement persistence into the same lifecycle as content saves:
- debounced save for background persistence
- close-time flush for unsaved enhancement changes
- explicit save/publish paths trigger immediate persistence attempts

Do not make enhancement persistence transactional with content persistence:
- content save success must not depend on enhancement save success
- enhancement failures should log/report separately and retry on future save cycles

## Local UI Synchronization Pattern

Realtime updates from `blips` do not include join-table payload by default.

After successful enhancement persistence:
- patch local blip store (`cacheOnly`) with updated enhancement field(s)
- this ensures list/detail UI reflects changes immediately without refresh

If an enhancement cannot be written yet (for example, blip not persisted), defer enhancement write until core entity persistence succeeds.

## Canonicalization Pattern

Perform canonicalization where user input enters the system (component boundary):
- normalize value shape
- enforce casing/format rules
- dedupe by canonical identity

Also normalize defensively in store/service before writes.

## UI Pattern

Enhancement UI should:
- render data from query/store model (never hard-coded values)
- support empty/loading/error states gracefully
- show overflow affordances for constrained lists where needed

## Suggested Implementation Checklist

For each new enhancement:

1. Add DB schema (entity + join table if needed).
2. Add/adjust RLS policies for public read and protected write.
3. Add TS schema/types in module data layer.
4. Add enhancement store/service methods.
5. Extend query layer to include enhancement graph data.
6. Wire editor save/hydration with debounced + flush behavior.
7. Add local store sync after successful enhancement write.
8. Verify list and detail views render enhancement data.
9. Validate non-authenticated read behavior if feature is public.
10. Validate failure behavior (enhancement failure does not break content save).

## Notes for Future Enhancements

- Reactions: may use aggregate counts in read model plus user-specific reaction state.
- Comments: may use separate pagination strategy from blip list payload.
- Photos: may include storage metadata and async upload lifecycle states.
- Updates/history: may require append-only table and timeline query model.

Keep these enhancements aligned with the same principles above, even if each feature has different UX needs.
