# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/).

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
