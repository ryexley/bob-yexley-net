# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/).

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
