# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/).

## [0.47.3] - 2026-09-12

### Added

- A page-level error message with a retry, so a page whose data fails to load
  can be recovered in place instead of by reloading the browser

### Fixed

- A page still waiting on its data no longer takes the header and the dock down
  with it. The Suspense boundary wrapped the whole application, every provider
  included; it now wraps only the page, and shows a loading state rather than
  an empty screen

## [0.47.2] - 2026-09-12

### Fixed

- Publishing an update no longer blanks the screen. Saving puts the update on
  the page, which refetches the page's media, and reading a query mid-refetch
  suspends — with the app's only Suspense boundary at the root, that emptied
  everything until the request came back, or for good if it never did. The page
  keeps the media it already has while the new set loads

## [0.47.1] - 2026-09-12

### Fixed

- Staying signed in no longer depends on having a good connection. The session
  was revalidated on every tab focus, and a request that failed to arrive was
  read as the server rejecting the session — so an evening of posting live
  updates from a stadium signed the author out half a dozen times. Only a
  definite answer from the server ends a session now
- Losing `localStorage` no longer signs you out. A missing session-start
  timestamp read as "expired" even while the auth cookie was perfectly valid.
  The real seven-day limit is enforced against the session row in Postgres,
  which cannot be evicted

## [0.47.0] - 2026-09-12

### Added

- Attaching or removing media now counts as a change to the blip, so Save
  becomes available. A photo writes its own row and leaves the text untouched,
  so nothing used to mark the blip edited and there was no way to close out the
  action
- Attaching media reports itself through the save indicator once the row
  reaches the database, since nothing else acknowledged a media-only edit

### Fixed

- Media attached to an update is reachable again. The first attachment creates
  a stub update row to satisfy the foreign key, but that row was never recorded
  as persisted, so Publish and Delete stayed disabled and the update could
  never go out
- An upload whose variant generation never answers now fails instead of
  hanging. `fetch` has no timeout, so a dropped connection or a backgrounded
  tab left the file in `processing` forever: Publish stayed blocked and no
  media row was ever written

## [0.46.1] - 2026-09-12

### Fixed

- The paste target collapses in flow instead of overlaying the editor, so it
  cannot sit on top of the media button or the attachment strip. It no longer
  makes `.markdown-editor` a containing block either, which had moved where
  every absolutely positioned descendant of every editor anchors

## [0.46.0] - 2026-09-11

### Fixed

- Pasted photos, GIFs, and video now attach on iOS. Safari never puts them on
  the paste event's file list — it exposes them only as a `blob:` URL inside the
  pasted markup — so that markup is now read and fetched back into a file
- Toolbar Paste on phones opens a focused paste target to touch and hold,
  rather than depending on the async clipboard API. That API is unavailable
  outside a secure context (which left the button permanently disabled on the
  local dev server) and, where it does exist, hides behind a callout that any
  stray tap cancels
- Toolbar Paste is no longer ever disabled: whether the clipboard holds
  anything is unknowable on iOS without a user gesture

## [0.45.9] - 2026-09-11

### Fixed

- Toolbar Paste keeps the editor focused so Safari's Paste confirmation can
  land the GIF in the field instead of the toolbar button

## [0.45.8] - 2026-09-11

### Fixed

- Toolbar Paste on iOS reads the clipboard on click, not finger-down, so
  Safari's Paste confirmation is not cancelled by the same tap

## [0.45.7] - 2026-09-11

### Fixed

- Toolbar Paste on iOS reads the clipboard on the tap itself so Safari pastes
  instead of showing its own Paste chip, and a dismissed prompt no longer
  disables the button

## [0.45.6] - 2026-09-11

### Added

- A Paste control on the formatting toolbar so phones can paste without the
  native context menu, including images through the existing placement prompt

## [0.45.5] - 2026-09-11

### Fixed

- Card teaser GIFs keep their aspect ratio instead of stretching to a 6rem strip
- Pasting an inline image into an empty blip no longer leaves a dead blank
  line above it that phones cannot Backspace away

## [0.45.4] - 2026-09-11

### Fixed

- Pasted JPEGs load after save: the reader now finds `-original.jpeg` as well
  as `.jpg`, and the frame uses the image's real orientation instead of 16:9

## [0.45.3] - 2026-09-11

### Fixed

- The phone paste placement chooser is a nested top drawer so it no longer
  covers the editor toolbar or sits behind the iOS keyboard
- Editor formatting and control-pill buttons no longer keep focus after a tap

## [0.45.2] - 2026-09-11

### Fixed

- The phone paste placement chooser docks inside the composer so it stays
  above the iOS keyboard instead of opening behind it

## [0.45.1] - 2026-09-11

### Fixed

- Pasting images and GIFs into a blip on iOS actually attaches them, with the
  placement chooser on a bottom drawer on phones

## [0.45.0] - 2026-09-10

### Added

- Paste images, GIFs, and video into a blip as inline body embeds or gallery
  attachments, with size, alignment, and an optional image lightbox

## [0.44.1] - 2026-09-09

### Fixed

- Fenced code blocks no longer clip their top border on mobile
- The blip detail back link stays readable over scrolling text

## [0.44.0] - 2026-09-09

First tracked release. The 0.44 minor is one bump per `feature:` commit
since the repo re-init — the same 0.x cadence as if we had versioned from
the start.

### Changed

- The top loading bar follows Solid Router `useIsRouting()` only, with a
  350ms finish ease and a short minimum visible time

### Fixed

- The blips date-header corner no longer seams on iOS Safari
