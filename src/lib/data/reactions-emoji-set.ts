/**
 * Canonical reaction emoji set shared across features.
 *
 * Keep this centralized so Blips, media, and future reaction-enabled
 * surfaces all consume the same maintained list.
 */
export const REACTION_EMOJI_GROUPS = [
  {
    label: "Common",
    emojis: ["👍", "❤️", "🔥", "⚡", "👏", "👎", "😄", "😂", "😮", "🤔", "🙌"],
  },
  {
    label: "Gestures",
    emojis: ["👊", "👌", "💪🏼", "🤘🏼", "☝🏼", "🙏", "🤝", "🫡"],
  },
  {
    label: "Celebrate",
    emojis: ["💯", "💥", "💫", "✨", "✅", "🎉", "🚀"],
  },
  {
    label: "Love",
    emojis: ["😘", "😍", "🤩", "🥺", "🧡", "💛", "💚", "💙", "💜", "🖤"],
  },
  {
    label: "Playful",
    emojis: ["😏", "👀", "🤗", "🤓", "🤑", "🤠", "🤯"],
  },
  {
    label: "Rough",
    emojis: ["😅", "😭", "🤢", "🤮", "🤧", "🥵", "🥶", "🥴"],
  },
  {
    label: "Upset",
    emojis: ["😔", "😕", "🙁", "☹️", "😣", "😖", "😫", "😡", "🤬", "😠"],
  },
  {
    label: "Sports",
    emojis: ["🏀", "🏈", "🎾", "🥎", "🏐", "🏓", "⛳️", "🏌"],
  },
  {
    label: "Weird",
    emojis: [
      "😇",
      "😈",
      "👿",
      "👹",
      "👺",
      "👻",
      "👽",
      "👾",
      "🤖",
      "🙈",
      "🙉",
      "🙊",
      "🥸",
    ],
  },
  {
    label: "Symbols",
    emojis: ["‼️", "⁉️"],
  },
  {
    label: "Colors",
    emojis: [
      "⚪️",
      "⚫️",
      "🔴",
      "🟠",
      "🟡",
      "🟢",
      "🔵",
      "🟣",
      "🟤",
      "🟥",
      "🟧",
      "🟨",
      "🟩",
      "🟪",
      "🟫",
      "🟦",
      "⬛️",
    ],
  },
  {
    label: "Cards",
    emojis: ["♠️", "♣️", "♥️", "♦️"],
  },
] as const

export const REACTION_EMOJI_SET = REACTION_EMOJI_GROUPS.flatMap(
  group => group.emojis,
)
