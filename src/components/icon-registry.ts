/* Curated Lucide outline paths (ISC). Copyright (c) Lucide Contributors.
   https://lucide.dev — download the nearest SVG and copy path `d` values here.
   Convert `circle` / `rect` / `line` to an equivalent path. Do not import
   Lucide React/Solid packages. Keep these camelCase names.

   Material Design Icons paths (Apache-2.0) for brand marks noted with filled.
   Copyright (c) Pictogrammers. https://pictogrammers.com/library/mdi

   Migrated from Material Symbols/Icons webfonts 2026-10-06. */

export type IconName =
  | "x"
  | "arrowLeft"
  | "arrowRight"
  | "arrowUp"
  | "arrowDown"
  | "chevronLeft"
  | "chevronRight"
  | "chevronDown"
  | "chevronUp"
  | "circleChevronDown"
  | "check"
  | "circleCheck"
  | "circleX"
  | "trash"
  | "house"
  | "menu"
  | "panelLeftOpen"
  | "panelRightOpen"
  | "panelTopOpen"
  | "ellipsis"
  | "ellipsisVertical"
  | "lock"
  | "eye"
  | "eyeOff"
  | "circleQuestionMark"
  | "info"
  | "triangleAlert"
  | "bell"
  | "circleUser"
  | "logOut"
  | "userRoundPen"
  | "shieldLock"
  | "shieldUser"
  | "badgeCheck"
  | "users"
  | "tag"
  | "bookmark"
  | "bookOpen"
  | "chartColumn"
  | "fileText"
  | "calendar"
  | "clock"
  | "save"
  | "refreshCw"
  | "cloudUpload"
  | "image"
  | "images"
  | "play"
  | "pause"
  | "volume2"
  | "gauge"
  | "rotateCcw"
  | "link"
  | "unlink"
  | "undo2"
  | "redo2"
  | "bold"
  | "italic"
  | "underline"
  | "quote"
  | "list"
  | "listOrdered"
  | "listIndentIncrease"
  | "listIndentDecrease"
  | "minus"
  | "highlighter"
  | "clipboardPaste"
  | "maximize"
  | "funnel"
  | "funnelX"
  | "messagesSquare"
  | "messageCircle"
  | "messageSquarePlus"
  | "messageSquareText"
  | "messageCirclePlus"
  | "rocket"
  | "filePenLine"
  | "radar"
  | "hash"
  | "badgeInfo"
  | "upload"
  | "skipForward"
  | "arrowUpDown"
  | "faceSlightlySmilingPlus"
  | "badgeMinus"
  | "loaderCircle"
  | "alignLeft"
  | "alignCenter"
  | "alignRight";

export type IconGlyph = {
  paths: string[];
  filled?: boolean;
};

export const iconGlyphs: Record<IconName, IconGlyph> = {
  /* x (close) */
  x: {
    paths: ["M18 6 6 18", "m6 6 12 12"],
  },

  /* arrow-left (arrow_back) */
  arrowLeft: {
    paths: ["M12 19l-7-7 7-7", "M19 12H5"],
  },

  /* arrow-right (arrow_forward) */
  arrowRight: {
    paths: ["m12 5 7 7-7 7", "M19 12H5"],
  },

  /* arrow-up (north) */
  arrowUp: {
    paths: ["m5 12 7-7 7 7", "M12 19V5"],
  },

  /* arrow-down (south) */
  arrowDown: {
    paths: ["M12 5v14", "m19 12-7 7-7-7"],
  },

  /* chevron-left */
  chevronLeft: {
    paths: ["m15 18-6-6 6-6"],
  },

  /* chevron-right */
  chevronRight: {
    paths: ["m9 18 6-6-6-6"],
  },

  /* chevron-down (expand_more, keyboard_arrow_down) */
  chevronDown: {
    paths: ["m6 9 6 6 6-6"],
  },

  /* chevron-up (keyboard_arrow_up) */
  chevronUp: {
    paths: ["m18 15-6-6-6 6"],
  },

  /* circle-chevron-down (expand_circle_down) */
  circleChevronDown: {
    paths: [
      "M2 12a10 10 0 1 0 20 0a10 10 0 1 0-20 0",
      "m8 12 4 4 4-4",
    ],
  },

  /* check */
  check: {
    paths: ["M20 6 9 17l-5-5"],
  },

  /* circle-check (check_circle) */
  circleCheck: {
    paths: [
      "M22 12A10 10 0 1 1 2 12a10 10 0 0 1 20 0",
      "m9 12 2 2 4-4",
    ],
  },

  /* circle-x (cancel) */
  circleX: {
    paths: [
      "M2 12a10 10 0 1 0 20 0a10 10 0 1 0-20 0",
      "m15 9-6 6",
      "m9 9 6 6",
    ],
  },

  /* trash (delete) */
  trash: {
    paths: [
      "M3 6h18",
      "M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6",
      "M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2",
    ],
  },

  /* house (home) */
  house: {
    paths: [
      "M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8",
      "M3 10a2 2 0 0 1 .709-1.528l7-6a2 2 0 0 1 2.582 0l7 6A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z",
    ],
  },

  /* menu */
  menu: {
    paths: ["M4 5h16", "M4 12h16", "M4 19h16"],
  },

  /* panel-left-open (menu_open left) */
  panelLeftOpen: {
    paths: [
      "M18 6l-6 6 6 6",
      "M3 3h18a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z",
      "M9 3v18",
    ],
  },

  /* panel-right-open (menu_open right) */
  panelRightOpen: {
    paths: [
      "M6 6l6 6-6 6",
      "M3 3h18a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z",
      "M15 3v18",
    ],
  },

  /* panel-top-open (top_panel_open) */
  panelTopOpen: {
    paths: [
      "M6 6l6 6 6-6",
      "M3 3h18a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z",
      "M3 9h18",
    ],
  },

  /* ellipsis (more_horiz) */
  ellipsis: {
    paths: [
      "M5 12a1 1 0 1 0 2 0a1 1 0 1 0-2 0",
      "M11 12a1 1 0 1 0 2 0a1 1 0 1 0-2 0",
      "M17 12a1 1 0 1 0 2 0a1 1 0 1 0-2 0",
    ],
  },

  /* ellipsis-vertical (more_vert) */
  ellipsisVertical: {
    paths: [
      "M12 5a1 1 0 1 0 0 2a1 1 0 1 0 0-2",
      "M12 11a1 1 0 1 0 0 2a1 1 0 1 0 0-2",
      "M12 17a1 1 0 1 0 0 2a1 1 0 1 0 0-2",
    ],
  },

  /* lock */
  lock: {
    paths: [
      "M5 11h14a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2z",
      "M7 11V7a5 5 0 0 1 10 0v4",
    ],
  },

  /* eye (visibility) */
  eye: {
    paths: [
      "M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0",
      "M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0z",
    ],
  },

  /* eye-off (visibility_off) */
  eyeOff: {
    paths: [
      "m10.733 5.076a10.744 10.744 0 0 1 11.205 7.27 1 1 0 0 1 0 .696 10.747 10.747 0 0 1-1.444 2.49",
      "M14.084 14.158a3 3 0 0 1-4.242-4.242",
      "M17.479 17.499a10.75 10.75 0 0 1-15.417-5.151 1 1 0 0 1 0-.696 10.75 10.75 0 0 1 4.446-5.143",
      "m2 2 20 20",
    ],
  },

  /* circle-question-mark (help) */
  circleQuestionMark: {
    paths: [
      "M2 12a10 10 0 1 0 20 0a10 10 0 1 0-20 0",
      "M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3",
      "M12 17h.01",
    ],
  },

  /* info */
  info: {
    paths: [
      "M22 12A10 10 0 1 1 2 12a10 10 0 0 1 20 0",
      "M12 16v-4",
      "M12 8h.01",
    ],
  },

  /* triangle-alert (warning) */
  triangleAlert: {
    paths: [
      "m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3",
      "M12 9v4",
      "M12 17h.01",
    ],
  },

  /* bell (notifications) */
  bell: {
    paths: [
      "M10.268 21a2 2 0 0 0 3.464 0",
      "M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9",
    ],
  },

  /* circle-user (account_circle) */
  circleUser: {
    paths: [
      "M22 12A10 10 0 1 1 2 12a10 10 0 0 1 20 0",
      "M15 10A3 3 0 1 1 9 10a3 3 0 0 1 6 0",
      "M7 20.662V19a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v1.662",
    ],
  },

  /* log-out (logout) */
  logOut: {
    paths: [
      "m16 17 5-5-5-5",
      "M21 12H9",
      "M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4",
    ],
  },

  /* user-round-pen (person_edit) */
  userRoundPen: {
    paths: [
      "M10 19H5a2 2 0 0 1-2-2v-1a4 4 0 0 1 4-4h4",
      "M2 8a5 5 0 1 0 10 0A5 5 0 1 0 2 8",
      "M21.378 12.626a1 1 0 0 0-3.004-3.004l-4.01 4.012a2 2 0 0 0-.506.854l-.837 2.87a.5.5 0 0 0 .62.62l2.87-.837a2 2 0 0 0 .854-.506z",
    ],
  },

  /* shield-lock */
  shieldLock: {
    paths: [
      "M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z",
      "M8 10h8a2 2 0 0 1 2 2v2a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2v-2a2 2 0 0 1 2-2z",
      "M10 10V8a2 2 0 1 1 4 0v2",
    ],
  },

  /* shield-user (shield_person) */
  shieldUser: {
    paths: [
      "M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z",
      "M9 12a3 3 0 1 0 6 0a3 3 0 1 0-6 0",
      "M16 19c0-2.21-1.79-4-4-4s-4 1.79-4 4",
    ],
  },

  /* badge-check (verified) */
  badgeCheck: {
    paths: [
      "M3.85 8.62a4 4 0 0 1 4.78-4.77 4 4 0 0 1 6.74 0 4 4 0 0 1 4.78 4.78 4 4 0 0 1 0 6.74 4 4 0 0 1-4.77 4.78 4 4 0 0 1-6.75 0 4 4 0 0 1-4.78-4.77 4 4 0 0 1 0-6.76z",
      "m9 12 2 2 4-4",
    ],
  },

  /* users (group) */
  users: {
    paths: [
      "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2",
      "M16 3.128a4 4 0 0 1 0 7.744",
      "M22 21v-2a4 4 0 0 0-3-3.87",
      "M5 7a4 4 0 1 0 8 0a4 4 0 1 0-8 0",
    ],
  },

  /* tag (label) */
  tag: {
    paths: [
      "M12.586 2.586A2 2 0 0 0 11.172 2H4a2 2 0 0 0-2 2v7.172a2 2 0 0 0 .586 1.414l8.704 8.704a2.426 2.426 0 0 0 3.42 0l6.58-6.58a2.426 2.426 0 0 0 0-3.42z",
      "M7.5 8a.5.5 0 1 0 0-1 .5.5 0 1 0 0 1",
    ],
  },

  /* bookmark */
  bookmark: {
    paths: ["m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z"],
  },

  /* book-open (menu_book) */
  bookOpen: {
    paths: [
      "M12 7v14",
      "M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4",
      "M21 18a1 1 0 0 0 1-1V4a1 1 0 0 0-1-1h-5a4 4 0 0 0-4 4",
    ],
  },

  /* chart-column (bar_chart) */
  chartColumn: {
    paths: [
      "M3 3v16a2 2 0 0 0 2 2h16",
      "M18 17V9",
      "M13 17V5",
      "M8 17v-3",
    ],
  },

  /* file-text (description) */
  fileText: {
    paths: [
      "M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z",
      "M14 2v4a2 2 0 0 0 2 2h4",
      "M10 9H8",
      "M16 13H8",
      "M16 17H8",
    ],
  },

  /* calendar (calendar_month) */
  calendar: {
    paths: [
      "M8 2v4",
      "M16 2v4",
      "M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z",
      "M3 10h18",
    ],
  },

  /* clock (schedule) */
  clock: {
    paths: [
      "M2 12a10 10 0 1 0 20 0a10 10 0 1 0-20 0",
      "M12 6v6l4 2",
    ],
  },

  /* save */
  save: {
    paths: [
      "M15.2 3a2 2 0 0 1 1.4.6l3.8 3.8a2 2 0 0 1 .6 1.4V19a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z",
      "M17 21v-7a1 1 0 0 0-1-1H8a1 1 0 0 0-1 1v7",
      "M7 3v4a1 1 0 0 0 1 1h3",
    ],
  },

  /* refresh-cw (refresh, autorenew) */
  refreshCw: {
    paths: [
      "M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8",
      "M21 3v5h-5",
      "M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16",
      "M8 16H3v5",
    ],
  },

  /* cloud-upload */
  cloudUpload: {
    paths: [
      "M12 13v8",
      "M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242",
      "m8 17 4-4 4 4",
    ],
  },

  /* image */
  image: {
    paths: [
      "M3 5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z",
      "M11 9A2 2 0 1 1 7 9a2 2 0 0 1 4 0",
      "m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21",
    ],
  },

  /* images (photo_library, perm_media) */
  images: {
    paths: [
      "M18 22H4a2 2 0 0 1-2-2V6",
      "M22 13V6a2 2 0 0 0-2-2H9a2 2 0 0 0-2 2v7",
      "m17 21-5-5-5 5",
      "M14 10.5a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0z",
    ],
  },

  /* play (play_arrow) */
  play: {
    paths: ["M6 4l15 8-15 8Z"],
  },

  /* pause */
  pause: {
    paths: ["M10 4H6v16h4z", "M18 4h-4v16h4z"],
  },

  /* volume-2 (volume_up) */
  volume2: {
    paths: [
      "M11 4.702a.705.705 0 0 0-1.203-.498L6.413 7.587A1.4 1.4 0 0 1 5.416 8H3a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h2.416a1.4 1.4 0 0 1 .997.413l3.383 3.384A.705.705 0 0 0 11 19.298z",
      "M15.5 8.5a5 5 0 0 1 0 7",
      "M19 6a9 9 0 0 1 0 12",
    ],
  },

  /* gauge (speed) */
  gauge: {
    paths: [
      "m12 14 4-4",
      "M3.34 19a10 10 0 1 1 17.32 0",
    ],
  },

  /* rotate-ccw (replay) */
  rotateCcw: {
    paths: [
      "M3 12a9 9 0 1 0 3-6.718",
      "M3 4v6h6",
    ],
  },

  /* link */
  link: {
    paths: [
      "M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71",
      "M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71",
    ],
  },

  /* unlink (link_off) */
  unlink: {
    paths: [
      "m18.84 12.25 1.72-1.71a5 5 0 0 0-7.07-7.07l-1.71 1.71",
      "m8.59 13.51-1.72 1.71a5 5 0 0 0 7.07 7.07l1.71-1.71",
      "M14 11l-5 5",
      "M21 3l-6 6",
      "m15 9 6 6",
      "m9 3-6 6",
    ],
  },

  /* undo-2 (undo) */
  undo2: {
    paths: [
      "M9 14 4 9l5-5",
      "M4 9h10.5a5.5 5.5 0 0 1 5.5 5.5a5.5 5.5 0 0 1-5.5 5.5H11",
    ],
  },

  /* redo-2 (redo) */
  redo2: {
    paths: [
      "m15 14 5-5-5-5",
      "M20 9H9.5A5.5 5.5 0 0 0 4 14.5A5.5 5.5 0 0 0 9.5 20H13",
    ],
  },

  /* bold (format_bold) */
  bold: {
    paths: [
      "M6 12h9a4 4 0 0 1 0 8H7a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h7a4 4 0 0 1 0 8",
    ],
  },

  /* italic (format_italic) */
  italic: {
    paths: ["M19 4H10", "M14 20H5", "M15 4 9 20"],
  },

  /* underline (format_underlined) */
  underline: {
    paths: ["M6 4v6a6 6 0 0 0 12 0V4", "M4 20h16"],
  },

  /* quote (format_quote) */
  quote: {
    paths: [
      "M16 3a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2 1 1 0 0 1 1 1v1a2 2 0 0 1-2 2 1 1 0 0 0-1 1v2a1 1 0 0 0 1 1 6 6 0 0 0 6-6V5a2 2 0 0 0-2-2z",
      "M5 3a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2 1 1 0 0 1 1 1v1a2 2 0 0 1-2 2 1 1 0 0 0-1 1v2a1 1 0 0 0 1 1 6 6 0 0 0 6-6V5a2 2 0 0 0-2-2z",
    ],
  },

  /* list (format_list_bulleted) */
  list: {
    paths: [
      "M3 5h.01",
      "M3 12h.01",
      "M3 19h.01",
      "M8 5h13",
      "M8 12h13",
      "M8 19h13",
    ],
  },

  /* list-ordered (format_list_numbered) */
  listOrdered: {
    paths: [
      "M11 5h10",
      "M11 12h10",
      "M11 19h10",
      "M4 4h1v5",
      "M4 9h2",
      "M6.5 20H3.4c0-1 2.6-1.925 2.6-3.5a1.5 1.5 0 0 0-2.6-1.02",
    ],
  },

  /* list-indent-increase (format_indent_increase) */
  listIndentIncrease: {
    paths: ["M21 5H11", "M21 12H11", "M21 19H11", "m3 8 4 4-4 4"],
  },

  /* list-indent-decrease (format_indent_decrease) */
  listIndentDecrease: {
    paths: ["M21 5H11", "M21 12H11", "M21 19H11", "m7 8-4 4 4 4"],
  },

  /* minus (horizontal_rule) */
  minus: {
    paths: ["M5 12h14"],
  },

  /* highlighter (stylus_highlighter) */
  highlighter: {
    paths: [
      "m9 11-6 6v3h9l3-3",
      "m22 12-4.6 4.6a2 2 0 0 1-2.8 0l-5.2-5.2a2 2 0 0 1 0-2.8L14 4",
    ],
  },

  /* clipboard-paste (content_paste) */
  clipboardPaste: {
    paths: [
      "M11 14h10",
      "M16 4h2a2 2 0 0 1 2 2v1.344",
      "m17 18 4-4-4-4",
      "M8 4H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 1.793-1.113",
      "M9 2h6a1 1 0 0 1 1 1v2a1 1 0 0 1-1 1H9a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1z",
    ],
  },

  /* maximize (fit_screen) */
  maximize: {
    paths: [
      "M8 3H5a2 2 0 0 0-2 2v3",
      "M21 8V5a2 2 0 0 0-2-2h-3",
      "M3 16v3a2 2 0 0 0 2 2h3",
      "M16 21h3a2 2 0 0 0 2-2v-3",
    ],
  },

  /* funnel (filter_alt) */
  funnel: {
    paths: [
      "M10 20a1 1 0 0 0 .553.895l2 1A1 1 0 0 0 14 21v-7a2 2 0 0 1 .517-1.341L21.74 4.67A1 1 0 0 0 21 3H3a1 1 0 0 0-.742 1.67l7.225 7.989A2 2 0 0 1 10 14z",
    ],
  },

  /* filter-x (filter_alt_off) */
  funnelX: {
    paths: [
      "M12.531 3H3a1 1 0 0 0-.742 1.67l7.225 7.989A2 2 0 0 1 10 14v6a1 1 0 0 0 .553.895l2 1A1 1 0 0 0 14 21v-7a2 2 0 0 1 .517-1.341l.427-.473",
      "m16.5 3.5 5 5",
      "m21.5 3.5-5 5",
    ],
  },

  /* messages-square (forum) */
  messagesSquare: {
    paths: [
      "M14 9a2 2 0 0 1-2 2H6l-4 4V4c0-1.1.9-2 2-2h8a2 2 0 0 1 2 2z",
      "M18 9h2a2 2 0 0 1 2 2v11l-4-4h-6a2 2 0 0 1-2-2v-1",
    ],
  },

  /* message-circle (chat) */
  messageCircle: {
    paths: [
      "M7.9 20A9 9 0 1 0 4 16.1L2 22z",
    ],
  },

  /* message-square-plus (add_comment) */
  messageSquarePlus: {
    paths: [
      "M22 17a2 2 0 0 1-2 2H6.828a2 2 0 0 0-1.414.586l-2.202 2.202A.71.71 0 0 1 2 21.286V5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2z",
      "M12 8v6",
      "M9 11h6",
    ],
  },

  /* message-square-text (update) */
  messageSquareText: {
    paths: [
      "M22 17a2 2 0 0 1-2 2H6.828a2 2 0 0 0-1.414.586l-2.202 2.202A.71.71 0 0 1 2 21.286V5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2z",
      "M7 11h10",
      "M7 15h6",
      "M7 7h8",
    ],
  },

  /* message-circle-plus (chat_add_on) */
  messageCirclePlus: {
    paths: [
      "M7.9 20A9 9 0 1 0 4 16.1L2 22z",
      "M12 7v6",
      "M9 10h6",
    ],
  },

  /* rocket (rocket_launch) */
  rocket: {
    paths: [
      "M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z",
      "m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z",
      "M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0",
      "M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5",
    ],
  },

  /* file-pen-line (edit_note) */
  filePenLine: {
    paths: [
      "M14.364 13.634a2 2 0 0 0-.506.854l-.837 2.87a.5.5 0 0 0 .62.62l2.87-.837a2 2 0 0 0 .854-.506l4.013-4.009a1 1 0 0 0-3.004-3.004z",
      "M14.487 7.858A1 1 0 0 1 14 7V2",
      "M20 19.645V20a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h8a2.4 2.4 0 0 1 1.704.706l2.516 2.516",
      "M8 18h1",
    ],
  },

  /* radar (Blip custom icon) */
  radar: {
    paths: [
      "M19.07 4.93A10 10 0 0 0 6.99 3.34",
      "M4 6h.01",
      "M2.29 9.62A10 10 0 1 0 21.31 8.35",
      "M16.24 7.76A6 6 0 1 0 8.23 16.67",
      "M12 18h.01",
      "M17.99 11.66A6 6 0 0 1 15.77 16.67",
      "M12 12m-2 0a2 2 0 1 0 4 0a2 2 0 1 0-4 0",
      "m13.41 10.59 5.66-5.66",
    ],
  },

  /* hash (Hashtag custom icon) */
  hash: {
    paths: [
      "M4 9h16",
      "M4 15h16",
      "M10 3 8 21",
      "M16 3l-2 18",
    ],
  },

  /* badge-info (page_info close alternative) */
  badgeInfo: {
    paths: [
      "M3.85 8.62a4 4 0 0 1 4.78-4.77 4 4 0 0 1 6.74 0 4 4 0 0 1 4.78 4.78 4 4 0 0 1 0 6.74 4 4 0 0 1-4.77 4.78 4 4 0 0 1-6.75 0 4 4 0 0 1-4.78-4.77 4 4 0 0 1 0-6.76z",
      "M12 16v-4",
      "M12 8h.01",
    ],
  },

  /* upload (arrow_upload_ready) */
  upload: {
    paths: [
      "M12 3v12",
      "m17 8-5-5-5 5",
      "M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4",
    ],
  },

  /* skip-forward (forward_media close alternative) */
  skipForward: {
    paths: [
      "M6 4l10 8-10 8Z",
      "M19 5v14",
    ],
  },

  /* arrow-up-down (list_arrow close alternative) */
  arrowUpDown: {
    paths: [
      "m21 16-4 4-4-4",
      "M17 20V4",
      "m3 8 4-4 4 4",
      "M7 4v16",
    ],
  },

  /* smile-plus (add_reaction) */
  faceSlightlySmilingPlus: {
    paths: [
      "M22 11v1a10 10 0 1 1-9-10",
      "M8 14s1.5 2 4 2 4-2 4-2",
      "M9 9h.01",
      "M15 9h.01",
      "M16 5h6",
      "M19 2v6",
    ],
  },

  /* badge-minus (verified_off close alternative) */
  badgeMinus: {
    paths: [
      "M3.85 8.62a4 4 0 0 1 4.78-4.77 4 4 0 0 1 6.74 0 4 4 0 0 1 4.78 4.78 4 4 0 0 1 0 6.74 4 4 0 0 1-4.77 4.78 4 4 0 0 1-6.75 0 4 4 0 0 1-4.78-4.77 4 4 0 0 1 0-6.76z",
      "M8 12h8",
    ],
  },

  /* loader-circle (LoadingSpinner close alternative) */
  loaderCircle: {
    paths: ["M12 2a10 10 0 1 0 10 10"],
  },

  /* align-left (format_align_left) */
  alignLeft: {
    paths: ["M21 5H3", "M15 12H3", "M17 19H3"],
  },

  /* align-center (format_align_center) */
  alignCenter: {
    paths: ["M21 5H3", "M17 12H7", "M19 19H5"],
  },

  /* align-right (format_align_right) */
  alignRight: {
    paths: ["M21 5H3", "M21 12H9", "M21 19H7"],
  },
};
