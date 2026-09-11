# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/).

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
