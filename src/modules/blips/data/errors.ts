export const REACTION_ERROR = {
  BLIP_ID_REQUIRED: "BLIP_ID_REQUIRED",
  AUTH_REQUIRED: "AUTH_REQUIRED",
  VISITOR_LOCKED: "VISITOR_LOCKED",
  LIMIT_REACHED: "LIMIT_REACHED",
  INVALID_EMOJI: "INVALID_EMOJI",
  UNKNOWN: "UNKNOWN",
} as const

export type ReactionErrorCode = (typeof REACTION_ERROR)[keyof typeof REACTION_ERROR]

export const REACTION_ERROR_I18N_KEY: Record<ReactionErrorCode, string> = {
  [REACTION_ERROR.BLIP_ID_REQUIRED]: "blips.reactions.errors.blipIdRequired",
  [REACTION_ERROR.AUTH_REQUIRED]: "blips.reactions.errors.authRequired",
  [REACTION_ERROR.VISITOR_LOCKED]: "blips.reactions.errors.visitorLocked",
  [REACTION_ERROR.LIMIT_REACHED]: "blips.reactions.errors.limitReached",
  [REACTION_ERROR.INVALID_EMOJI]: "blips.reactions.errors.invalidEmoji",
  [REACTION_ERROR.UNKNOWN]: "blips.reactions.errors.unknown",
}

const REACTION_ERROR_VALUES = new Set<string>(Object.values(REACTION_ERROR))

export const isReactionErrorCode = (value: string): value is ReactionErrorCode =>
  REACTION_ERROR_VALUES.has(value)
