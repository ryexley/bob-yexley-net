/* Official Lucide SVG children (ISC). Copyright (c) Lucide Contributors.
   https://lucide.dev — downloaded unchanged from lucide-static@1.55.0.
   Keep these camelCase names. Do not convert circle / rect / line to paths.
   Do not import Lucide React/Solid packages.

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
  | "settings2"
  | "upload"
  | "skipForward"
  | "arrowUpDown"
  | "faceSlightlySmilingPlus"
  | "badgeMinus"
  | "loaderCircle"
  | "alignLeft"
  | "alignCenter"
  | "alignRight";

export type IconSvgNode =
  | { tag: "path"; d: string }
  | { tag: "circle"; cx: string; cy: string; r: string; fill?: string }
  | { tag: "rect"; width: string; height: string; x?: string; y?: string; rx?: string; ry?: string }
  | { tag: "line"; x1: string; y1: string; x2: string; y2: string }

export type IconGlyph = {
  nodes: IconSvgNode[]
  filled?: boolean
}

export const iconGlyphs: Record<IconName, IconGlyph> = {
  /* x */
  x: {
    nodes: [
      { tag: "path", d: "M18 6 6 18" },
      { tag: "path", d: "m6 6 12 12" },
    ],
  },

  /* arrow-left */
  arrowLeft: {
    nodes: [
      { tag: "path", d: "m12 19-7-7 7-7" },
      { tag: "path", d: "M19 12H5" },
    ],
  },

  /* arrow-right */
  arrowRight: {
    nodes: [
      { tag: "path", d: "M5 12h14" },
      { tag: "path", d: "m12 5 7 7-7 7" },
    ],
  },

  /* arrow-up */
  arrowUp: {
    nodes: [
      { tag: "path", d: "m5 12 7-7 7 7" },
      { tag: "path", d: "M12 19V5" },
    ],
  },

  /* arrow-down */
  arrowDown: {
    nodes: [
      { tag: "path", d: "M12 5v14" },
      { tag: "path", d: "m19 12-7 7-7-7" },
    ],
  },

  /* chevron-left */
  chevronLeft: {
    nodes: [
      { tag: "path", d: "m15 18-6-6 6-6" },
    ],
  },

  /* chevron-right */
  chevronRight: {
    nodes: [
      { tag: "path", d: "m9 18 6-6-6-6" },
    ],
  },

  /* chevron-down */
  chevronDown: {
    nodes: [
      { tag: "path", d: "m6 9 6 6 6-6" },
    ],
  },

  /* chevron-up */
  chevronUp: {
    nodes: [
      { tag: "path", d: "m18 15-6-6-6 6" },
    ],
  },

  /* circle-chevron-down */
  circleChevronDown: {
    nodes: [
      { tag: "circle", cx: "12", cy: "12", r: "10" },
      { tag: "path", d: "m16 10-4 4-4-4" },
    ],
  },

  /* check */
  check: {
    nodes: [
      { tag: "path", d: "M20 6 9 17l-5-5" },
    ],
  },

  /* circle-check */
  circleCheck: {
    nodes: [
      { tag: "circle", cx: "12", cy: "12", r: "10" },
      { tag: "path", d: "m16 9-5.5 5.5L8 12" },
    ],
  },

  /* circle-x */
  circleX: {
    nodes: [
      { tag: "circle", cx: "12", cy: "12", r: "10" },
      { tag: "path", d: "m15 9-6 6" },
      { tag: "path", d: "m9 9 6 6" },
    ],
  },

  /* trash */
  trash: {
    nodes: [
      { tag: "path", d: "M10 11v6" },
      { tag: "path", d: "M14 11v6" },
      { tag: "path", d: "M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" },
      { tag: "path", d: "M3 6h18" },
      { tag: "path", d: "M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" },
    ],
  },

  /* house */
  house: {
    nodes: [
      { tag: "path", d: "M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8" },
      { tag: "path", d: "M3 10a2 2 0 0 1 .709-1.528l7-6a2 2 0 0 1 2.582 0l7 6A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" },
    ],
  },

  /* menu */
  menu: {
    nodes: [
      { tag: "path", d: "M4 5h16" },
      { tag: "path", d: "M4 12h16" },
      { tag: "path", d: "M4 19h16" },
    ],
  },

  /* panel-left-open */
  panelLeftOpen: {
    nodes: [
      { tag: "rect", x: "3", y: "3", width: "18", height: "18", rx: "2" },
      { tag: "path", d: "M9 3v18" },
      { tag: "path", d: "m14 9 3 3-3 3" },
    ],
  },

  /* panel-right-open */
  panelRightOpen: {
    nodes: [
      { tag: "rect", x: "3", y: "3", width: "18", height: "18", rx: "2" },
      { tag: "path", d: "M15 3v18" },
      { tag: "path", d: "m10 15-3-3 3-3" },
    ],
  },

  /* panel-top-open */
  panelTopOpen: {
    nodes: [
      { tag: "rect", x: "3", y: "3", width: "18", height: "18", rx: "2" },
      { tag: "path", d: "M3 9h18" },
      { tag: "path", d: "m15 14-3 3-3-3" },
    ],
  },

  /* ellipsis */
  ellipsis: {
    nodes: [
      { tag: "circle", cx: "12", cy: "12", r: "1" },
      { tag: "circle", cx: "19", cy: "12", r: "1" },
      { tag: "circle", cx: "5", cy: "12", r: "1" },
    ],
  },

  /* ellipsis-vertical */
  ellipsisVertical: {
    nodes: [
      { tag: "circle", cx: "12", cy: "12", r: "1" },
      { tag: "circle", cx: "12", cy: "5", r: "1" },
      { tag: "circle", cx: "12", cy: "19", r: "1" },
    ],
  },

  /* lock */
  lock: {
    nodes: [
      { tag: "rect", x: "3", y: "11", width: "18", height: "11", rx: "2", ry: "2" },
      { tag: "path", d: "M7 11V7a5 5 0 0 1 10 0v4" },
    ],
  },

  /* eye */
  eye: {
    nodes: [
      { tag: "path", d: "M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0" },
      { tag: "circle", cx: "12", cy: "12", r: "3" },
    ],
  },

  /* eye-off */
  eyeOff: {
    nodes: [
      { tag: "path", d: "M10.733 5.076a10.744 10.744 0 0 1 11.205 6.575 1 1 0 0 1 0 .696 10.747 10.747 0 0 1-1.444 2.49" },
      { tag: "path", d: "M14.084 14.158a3 3 0 0 1-4.242-4.242" },
      { tag: "path", d: "M17.479 17.499a10.75 10.75 0 0 1-15.417-5.151 1 1 0 0 1 0-.696 10.75 10.75 0 0 1 4.446-5.143" },
      { tag: "path", d: "m2 2 20 20" },
    ],
  },

  /* circle-question-mark */
  circleQuestionMark: {
    nodes: [
      { tag: "circle", cx: "12", cy: "12", r: "10" },
      { tag: "path", d: "M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" },
      { tag: "path", d: "M12 17h.01" },
    ],
  },

  /* info */
  info: {
    nodes: [
      { tag: "circle", cx: "12", cy: "12", r: "10" },
      { tag: "path", d: "M12 16v-4" },
      { tag: "path", d: "M12 8h.01" },
    ],
  },

  /* triangle-alert */
  triangleAlert: {
    nodes: [
      { tag: "path", d: "m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3" },
      { tag: "path", d: "M12 9v4" },
      { tag: "path", d: "M12 17h.01" },
    ],
  },

  /* bell */
  bell: {
    nodes: [
      { tag: "path", d: "M10.268 21a2 2 0 0 0 3.464 0" },
      { tag: "path", d: "M3.262 15.326A1 1 0 0 0 4 17h16a1 1 0 0 0 .74-1.673C19.41 13.956 18 12.499 18 8A6 6 0 0 0 6 8c0 4.499-1.411 5.956-2.738 7.326" },
    ],
  },

  /* circle-user */
  circleUser: {
    nodes: [
      { tag: "circle", cx: "12", cy: "12", r: "10" },
      { tag: "circle", cx: "12", cy: "10", r: "3" },
      { tag: "path", d: "M7 20.662V19a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v1.662" },
    ],
  },

  /* log-out */
  logOut: {
    nodes: [
      { tag: "path", d: "m16 17 5-5-5-5" },
      { tag: "path", d: "M21 12H9" },
      { tag: "path", d: "M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" },
    ],
  },

  /* user-round-pen */
  userRoundPen: {
    nodes: [
      { tag: "path", d: "M2 21a8 8 0 0 1 10.821-7.487" },
      { tag: "path", d: "M21.378 16.626a1 1 0 0 0-3.004-3.004l-4.01 4.012a2 2 0 0 0-.506.854l-.837 2.87a.5.5 0 0 0 .62.62l2.87-.837a2 2 0 0 0 .854-.506z" },
      { tag: "circle", cx: "10", cy: "8", r: "5" },
    ],
  },

  /* shield-lock */
  shieldLock: {
    nodes: [
      { tag: "path", d: "M20 9.807V6a1 1 0 00-1-1c-2 0-4.49-1.19-6.24-2.72a1.17 1.17 0 00-1.52 0C9.5 3.8 7 5 5 5a1 1 0 00-1 1v7c0 3.88 2.107 6.254 5 7.796" },
      { tag: "path", d: "M19 17v-2a2 2 0 00-4 0v2" },
      { tag: "rect", x: "13", y: "17", width: "8", height: "5", rx: "1" },
    ],
  },

  /* shield-user */
  shieldUser: {
    nodes: [
      { tag: "path", d: "M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" },
      { tag: "path", d: "M6.376 18.91a6 6 0 0 1 11.249.003" },
      { tag: "circle", cx: "12", cy: "11", r: "4" },
    ],
  },

  /* badge-check */
  badgeCheck: {
    nodes: [
      { tag: "path", d: "M3.85 8.62a4 4 0 0 1 4.78-4.77 4 4 0 0 1 6.74 0 4 4 0 0 1 4.78 4.78 4 4 0 0 1 0 6.74 4 4 0 0 1-4.77 4.78 4 4 0 0 1-6.75 0 4 4 0 0 1-4.78-4.77 4 4 0 0 1 0-6.76Z" },
      { tag: "path", d: "m16 9-5.5 5.5L8 12" },
    ],
  },

  /* users */
  users: {
    nodes: [
      { tag: "path", d: "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" },
      { tag: "path", d: "M16 3.128a4 4 0 0 1 0 7.744" },
      { tag: "path", d: "M22 21v-2a4 4 0 0 0-3-3.87" },
      { tag: "circle", cx: "9", cy: "7", r: "4" },
    ],
  },

  /* tag */
  tag: {
    nodes: [
      { tag: "path", d: "M12.586 2.586A2 2 0 0 0 11.172 2H4a2 2 0 0 0-2 2v7.172a2 2 0 0 0 .586 1.414l8.704 8.704a2.426 2.426 0 0 0 3.42 0l6.58-6.58a2.426 2.426 0 0 0 0-3.42z" },
      { tag: "circle", cx: "7.5", cy: "7.5", r: ".5", fill: "currentColor" },
    ],
  },

  /* bookmark */
  bookmark: {
    nodes: [
      { tag: "path", d: "M17 3a2 2 0 0 1 2 2v15a1 1 0 0 1-1.496.868l-4.512-2.578a2 2 0 0 0-1.984 0l-4.512 2.578A1 1 0 0 1 5 20V5a2 2 0 0 1 2-2z" },
    ],
  },

  /* book-open */
  bookOpen: {
    nodes: [
      { tag: "path", d: "M12 5v16" },
      { tag: "path", d: "M20.001 19A2 2 0 0022 17V5a2 2 0 00-1.999-2L16 3.002A5 5 0 0012 5a5 5 0 00-4-2H4a2 2 0 00-2 2v12a2 2 0 001.999 2H8a5 5 0 014 2 5 5 0 014-2z" },
    ],
  },

  /* chart-column */
  chartColumn: {
    nodes: [
      { tag: "path", d: "M3 3v16a2 2 0 0 0 2 2h16" },
      { tag: "path", d: "M18 17V9" },
      { tag: "path", d: "M13 17V5" },
      { tag: "path", d: "M8 17v-3" },
    ],
  },

  /* file-text */
  fileText: {
    nodes: [
      { tag: "path", d: "M6 22a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h8a2.4 2.4 0 0 1 1.704.706l3.588 3.588A2.4 2.4 0 0 1 20 8v12a2 2 0 0 1-2 2z" },
      { tag: "path", d: "M14 2v5a1 1 0 0 0 1 1h5" },
      { tag: "path", d: "M10 9H8" },
      { tag: "path", d: "M16 13H8" },
      { tag: "path", d: "M16 17H8" },
    ],
  },

  /* calendar */
  calendar: {
    nodes: [
      { tag: "path", d: "M8 2v3" },
      { tag: "path", d: "M16 2v3" },
      { tag: "rect", x: "3", y: "3", width: "18", height: "18", rx: "2" },
      { tag: "path", d: "M3 9h18" },
    ],
  },

  /* clock */
  clock: {
    nodes: [
      { tag: "circle", cx: "12", cy: "12", r: "10" },
      { tag: "path", d: "M12 6v6l4 2" },
    ],
  },

  /* save */
  save: {
    nodes: [
      { tag: "path", d: "M15.2 3a2 2 0 0 1 1.4.6l3.8 3.8a2 2 0 0 1 .6 1.4V19a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z" },
      { tag: "path", d: "M17 21v-7a1 1 0 0 0-1-1H8a1 1 0 0 0-1 1v7" },
      { tag: "path", d: "M7 3v4a1 1 0 0 0 1 1h7" },
    ],
  },

  /* refresh-cw */
  refreshCw: {
    nodes: [
      { tag: "path", d: "M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" },
      { tag: "path", d: "M21 3v5h-5" },
      { tag: "path", d: "M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" },
      { tag: "path", d: "M8 16H3v5" },
    ],
  },

  /* cloud-upload */
  cloudUpload: {
    nodes: [
      { tag: "path", d: "M12 13v8" },
      { tag: "path", d: "M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242" },
      { tag: "path", d: "m8 17 4-4 4 4" },
    ],
  },

  /* image */
  image: {
    nodes: [
      { tag: "rect", x: "3", y: "3", width: "18", height: "18", rx: "2", ry: "2" },
      { tag: "circle", cx: "9", cy: "9", r: "2" },
      { tag: "path", d: "m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" },
    ],
  },

  /* images */
  images: {
    nodes: [
      { tag: "path", d: "m22 11-1.296-1.296a2.4 2.4 0 0 0-3.408 0L11 16" },
      { tag: "path", d: "M4 8a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2" },
      { tag: "circle", cx: "13", cy: "7", r: "1", fill: "currentColor" },
      { tag: "rect", x: "8", y: "2", width: "14", height: "14", rx: "2" },
    ],
  },

  /* play */
  play: {
    nodes: [
      { tag: "path", d: "M5 5a2 2 0 0 1 3.008-1.728l11.997 6.998a2 2 0 0 1 .003 3.458l-12 7A2 2 0 0 1 5 19z" },
    ],
  },

  /* pause */
  pause: {
    nodes: [
      { tag: "rect", x: "14", y: "3", width: "5", height: "18", rx: "1" },
      { tag: "rect", x: "5", y: "3", width: "5", height: "18", rx: "1" },
    ],
  },

  /* volume-2 */
  volume2: {
    nodes: [
      { tag: "path", d: "M11 4.702a.705.705 0 0 0-1.203-.498L6.413 7.587A1.4 1.4 0 0 1 5.416 8H3a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h2.416a1.4 1.4 0 0 1 .997.413l3.383 3.384A.705.705 0 0 0 11 19.298z" },
      { tag: "path", d: "M16 9a5 5 0 0 1 0 6" },
      { tag: "path", d: "M19.364 18.364a9 9 0 0 0 0-12.728" },
    ],
  },

  /* gauge */
  gauge: {
    nodes: [
      { tag: "path", d: "m12 14 4-4" },
      { tag: "path", d: "M3.34 19a10 10 0 1 1 17.32 0" },
    ],
  },

  /* rotate-ccw */
  rotateCcw: {
    nodes: [
      { tag: "path", d: "M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" },
      { tag: "path", d: "M3 3v5h5" },
    ],
  },

  /* link */
  link: {
    nodes: [
      { tag: "path", d: "M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" },
      { tag: "path", d: "M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" },
    ],
  },

  /* unlink */
  unlink: {
    nodes: [
      { tag: "path", d: "m18.84 12.25 1.72-1.71h-.02a5.004 5.004 0 0 0-.12-7.07 5.006 5.006 0 0 0-6.95 0l-1.72 1.71" },
      { tag: "path", d: "m5.17 11.75-1.71 1.71a5.004 5.004 0 0 0 .12 7.07 5.006 5.006 0 0 0 6.95 0l1.71-1.71" },
      { tag: "line", x1: "8", y1: "2", x2: "8", y2: "5" },
      { tag: "line", x1: "2", y1: "8", x2: "5", y2: "8" },
      { tag: "line", x1: "16", y1: "19", x2: "16", y2: "22" },
      { tag: "line", x1: "19", y1: "16", x2: "22", y2: "16" },
    ],
  },

  /* undo-2 */
  undo2: {
    nodes: [
      { tag: "path", d: "M9 14 4 9l5-5" },
      { tag: "path", d: "M4 9h10.5a5.5 5.5 0 0 1 5.5 5.5a5.5 5.5 0 0 1-5.5 5.5H11" },
    ],
  },

  /* redo-2 */
  redo2: {
    nodes: [
      { tag: "path", d: "m15 14 5-5-5-5" },
      { tag: "path", d: "M20 9H9.5A5.5 5.5 0 0 0 4 14.5A5.5 5.5 0 0 0 9.5 20H13" },
    ],
  },

  /* bold */
  bold: {
    nodes: [
      { tag: "path", d: "M6 12h9a4 4 0 0 1 0 8H7a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h7a4 4 0 0 1 0 8" },
    ],
  },

  /* italic */
  italic: {
    nodes: [
      { tag: "line", x1: "19", y1: "4", x2: "10", y2: "4" },
      { tag: "line", x1: "14", y1: "20", x2: "5", y2: "20" },
      { tag: "line", x1: "15", y1: "4", x2: "9", y2: "20" },
    ],
  },

  /* underline */
  underline: {
    nodes: [
      { tag: "path", d: "M6 4v6a6 6 0 0 0 12 0V4" },
      { tag: "line", x1: "4", y1: "20", x2: "20", y2: "20" },
    ],
  },

  /* quote */
  quote: {
    nodes: [
      { tag: "path", d: "M16 3a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2 1 1 0 0 1 1 1v1a2 2 0 0 1-2 2 1 1 0 0 0-1 1v2a1 1 0 0 0 1 1 6 6 0 0 0 6-6V5a2 2 0 0 0-2-2z" },
      { tag: "path", d: "M5 3a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2 1 1 0 0 1 1 1v1a2 2 0 0 1-2 2 1 1 0 0 0-1 1v2a1 1 0 0 0 1 1 6 6 0 0 0 6-6V5a2 2 0 0 0-2-2z" },
    ],
  },

  /* list */
  list: {
    nodes: [
      { tag: "path", d: "M3 5h.01" },
      { tag: "path", d: "M3 12h.01" },
      { tag: "path", d: "M3 19h.01" },
      { tag: "path", d: "M8 5h13" },
      { tag: "path", d: "M8 12h13" },
      { tag: "path", d: "M8 19h13" },
    ],
  },

  /* list-ordered */
  listOrdered: {
    nodes: [
      { tag: "path", d: "M11 5h10" },
      { tag: "path", d: "M11 12h10" },
      { tag: "path", d: "M11 19h10" },
      { tag: "path", d: "M4 4h1v5" },
      { tag: "path", d: "M4 9h2" },
      { tag: "path", d: "M6.5 20H3.4c0-1 2.6-1.925 2.6-3.5a1.5 1.5 0 0 0-2.6-1.02" },
    ],
  },

  /* list-indent-increase */
  listIndentIncrease: {
    nodes: [
      { tag: "path", d: "M21 5H11" },
      { tag: "path", d: "M21 12H11" },
      { tag: "path", d: "M21 19H11" },
      { tag: "path", d: "m3 8 4 4-4 4" },
    ],
  },

  /* list-indent-decrease */
  listIndentDecrease: {
    nodes: [
      { tag: "path", d: "M21 5H11" },
      { tag: "path", d: "M21 12H11" },
      { tag: "path", d: "M21 19H11" },
      { tag: "path", d: "m7 8-4 4 4 4" },
    ],
  },

  /* minus */
  minus: {
    nodes: [
      { tag: "path", d: "M5 12h14" },
    ],
  },

  /* highlighter */
  highlighter: {
    nodes: [
      { tag: "path", d: "m9 11-6 6v3h9l3-3" },
      { tag: "path", d: "m22 12-4.6 4.6a2 2 0 0 1-2.8 0l-5.2-5.2a2 2 0 0 1 0-2.8L14 4" },
    ],
  },

  /* clipboard-paste */
  clipboardPaste: {
    nodes: [
      { tag: "path", d: "M11 14h10" },
      { tag: "path", d: "M16 4h2a2 2 0 0 1 2 2v1.344" },
      { tag: "path", d: "m17 18 4-4-4-4" },
      { tag: "path", d: "M8 4H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 1.793-1.113" },
      { tag: "rect", x: "8", y: "2", width: "8", height: "4", rx: "1" },
    ],
  },

  /* maximize */
  maximize: {
    nodes: [
      { tag: "path", d: "M8 3H5a2 2 0 0 0-2 2v3" },
      { tag: "path", d: "M21 8V5a2 2 0 0 0-2-2h-3" },
      { tag: "path", d: "M3 16v3a2 2 0 0 0 2 2h3" },
      { tag: "path", d: "M16 21h3a2 2 0 0 0 2-2v-3" },
    ],
  },

  /* funnel */
  funnel: {
    nodes: [
      { tag: "path", d: "M10 20a1 1 0 0 0 .553.895l2 1A1 1 0 0 0 14 21v-7a2 2 0 0 1 .517-1.341L21.74 4.67A1 1 0 0 0 21 3H3a1 1 0 0 0-.742 1.67l7.225 7.989A2 2 0 0 1 10 14z" },
    ],
  },

  /* funnel-x */
  funnelX: {
    nodes: [
      { tag: "path", d: "M12.531 3H3a1 1 0 0 0-.742 1.67l7.225 7.989A2 2 0 0 1 10 14v6a1 1 0 0 0 .553.895l2 1A1 1 0 0 0 14 21v-7a2 2 0 0 1 .517-1.341l.427-.473" },
      { tag: "path", d: "m16.5 3.5 5 5" },
      { tag: "path", d: "m21.5 3.5-5 5" },
    ],
  },

  /* messages-square */
  messagesSquare: {
    nodes: [
      { tag: "path", d: "M16 10a2 2 0 0 1-2 2H6.828a2 2 0 0 0-1.414.586l-2.202 2.202A.71.71 0 0 1 2 14.286V4a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" },
      { tag: "path", d: "M20 9a2 2 0 0 1 2 2v10.286a.71.71 0 0 1-1.212.502l-2.202-2.202A2 2 0 0 0 17.172 19H10a2 2 0 0 1-2-2v-1" },
    ],
  },

  /* message-circle */
  messageCircle: {
    nodes: [
      { tag: "path", d: "M2.992 16.342a2 2 0 0 1 .094 1.167l-1.065 3.29a1 1 0 0 0 1.236 1.168l3.413-.998a2 2 0 0 1 1.099.092 10 10 0 1 0-4.777-4.719" },
    ],
  },

  /* message-square-plus */
  messageSquarePlus: {
    nodes: [
      { tag: "path", d: "M22 17a2 2 0 0 1-2 2H6.828a2 2 0 0 0-1.414.586l-2.202 2.202A.71.71 0 0 1 2 21.286V5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2z" },
      { tag: "path", d: "M12 8v6" },
      { tag: "path", d: "M9 11h6" },
    ],
  },

  /* message-square-text */
  messageSquareText: {
    nodes: [
      { tag: "path", d: "M22 17a2 2 0 0 1-2 2H6.828a2 2 0 0 0-1.414.586l-2.202 2.202A.71.71 0 0 1 2 21.286V5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2z" },
      { tag: "path", d: "M7 11h10" },
      { tag: "path", d: "M7 15h6" },
      { tag: "path", d: "M7 7h8" },
    ],
  },

  /* message-circle-plus */
  messageCirclePlus: {
    nodes: [
      { tag: "path", d: "M2.992 16.342a2 2 0 0 1 .094 1.167l-1.065 3.29a1 1 0 0 0 1.236 1.168l3.413-.998a2 2 0 0 1 1.099.092 10 10 0 1 0-4.777-4.719" },
      { tag: "path", d: "M8 12h8" },
      { tag: "path", d: "M12 8v8" },
    ],
  },

  /* rocket */
  rocket: {
    nodes: [
      { tag: "path", d: "M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5" },
      { tag: "path", d: "M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09" },
      { tag: "path", d: "M9 12a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.4 22.4 0 0 1-4 2z" },
      { tag: "path", d: "M9 12H4s.55-3.03 2-4c1.62-1.08 5 .05 5 .05" },
    ],
  },

  /* file-pen-line */
  filePenLine: {
    nodes: [
      { tag: "path", d: "M14.364 13.634a2 2 0 0 0-.506.854l-.837 2.87a.5.5 0 0 0 .62.62l2.87-.837a2 2 0 0 0 .854-.506l4.013-4.009a1 1 0 0 0-3.004-3.004z" },
      { tag: "path", d: "M14.487 7.858A1 1 0 0 1 14 7V2" },
      { tag: "path", d: "M20 19.645V20a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h8a2.4 2.4 0 0 1 1.704.706l2.516 2.516" },
      { tag: "path", d: "M8 18h1" },
    ],
  },

  /* radar */
  radar: {
    nodes: [
      { tag: "path", d: "M19.07 4.93A10 10 0 0 0 6.99 3.34" },
      { tag: "path", d: "M4 6h.01" },
      { tag: "path", d: "M2.29 9.62A10 10 0 1 0 21.31 8.35" },
      { tag: "path", d: "M16.24 7.76A6 6 0 1 0 8.23 16.67" },
      { tag: "path", d: "M12 18h.01" },
      { tag: "path", d: "M17.99 11.66A6 6 0 0 1 15.77 16.67" },
      { tag: "circle", cx: "12", cy: "12", r: "2" },
      { tag: "path", d: "m13.41 10.59 5.66-5.66" },
    ],
  },

  /* hash */
  hash: {
    nodes: [
      { tag: "line", x1: "4", y1: "9", x2: "20", y2: "9" },
      { tag: "line", x1: "4", y1: "15", x2: "20", y2: "15" },
      { tag: "line", x1: "10", y1: "3", x2: "8", y2: "21" },
      { tag: "line", x1: "16", y1: "3", x2: "14", y2: "21" },
    ],
  },

  /* settings-2 */
  settings2: {
    nodes: [
      { tag: "path", d: "M14 17H5" },
      { tag: "path", d: "M19 7h-9" },
      { tag: "circle", cx: "17", cy: "17", r: "3" },
      { tag: "circle", cx: "7", cy: "7", r: "3" },
    ],
  },

  /* upload */
  upload: {
    nodes: [
      { tag: "path", d: "M12 3v12" },
      { tag: "path", d: "m17 8-5-5-5 5" },
      { tag: "path", d: "M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" },
    ],
  },

  /* skip-forward */
  skipForward: {
    nodes: [
      { tag: "path", d: "M21 4v16" },
      { tag: "path", d: "M6.029 4.285A2 2 0 0 0 3 6v12a2 2 0 0 0 3.029 1.715l9.997-5.998a2 2 0 0 0 .003-3.432z" },
    ],
  },

  /* arrow-up-down */
  arrowUpDown: {
    nodes: [
      { tag: "path", d: "m21 16-4 4-4-4" },
      { tag: "path", d: "M17 20V4" },
      { tag: "path", d: "m3 8 4-4 4 4" },
      { tag: "path", d: "M7 4v16" },
    ],
  },

  /* face-slightly-smiling-plus */
  faceSlightlySmilingPlus: {
    nodes: [
      { tag: "path", d: "M13.267 2.08a10 10 0 108.653 8.653" },
      { tag: "path", d: "M15 10V9" },
      { tag: "path", d: "M16 5h6" },
      { tag: "path", d: "M16.472 15a6 6 0 01-8.943 0" },
      { tag: "path", d: "M19 2v6" },
      { tag: "path", d: "M9 10V9" },
    ],
  },

  /* badge-minus */
  badgeMinus: {
    nodes: [
      { tag: "path", d: "M3.85 8.62a4 4 0 0 1 4.78-4.77 4 4 0 0 1 6.74 0 4 4 0 0 1 4.78 4.78 4 4 0 0 1 0 6.74 4 4 0 0 1-4.77 4.78 4 4 0 0 1-6.75 0 4 4 0 0 1-4.78-4.77 4 4 0 0 1 0-6.76Z" },
      { tag: "line", x1: "8", y1: "12", x2: "16", y2: "12" },
    ],
  },

  /* loader-circle */
  loaderCircle: {
    nodes: [
      { tag: "path", d: "M21 12a9 9 0 1 1-6.219-8.56" },
    ],
  },

  /* align-left */
  alignLeft: {
    nodes: [
      { tag: "path", d: "M21 5H3" },
      { tag: "path", d: "M15 12H3" },
      { tag: "path", d: "M17 19H3" },
    ],
  },

  /* align-center */
  alignCenter: {
    nodes: [
      { tag: "path", d: "M21 5H3" },
      { tag: "path", d: "M17 12H7" },
      { tag: "path", d: "M19 19H5" },
    ],
  },

  /* align-right */
  alignRight: {
    nodes: [
      { tag: "path", d: "M21 5H3" },
      { tag: "path", d: "M21 12H9" },
      { tag: "path", d: "M21 19H7" },
    ],
  },
};
