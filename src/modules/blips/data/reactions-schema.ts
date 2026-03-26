import { z } from "zod"

export const reactionSchema = z.object({
  id: z.string().uuid(),
  blip_id: z.string(),
  visitor_id: z.string().uuid(),
  emoji: z.string().min(1),
  created_at: z.string(),
  // `reactions` table has no updated_at; optional for supaStore compatibility.
  updated_at: z.string().optional(),
})

export const blipReactionSummarySchema = z.object({
  emoji: z.string().min(1),
  count: z.number().int().nonnegative(),
  reacted_by_current_user: z.boolean(),
  display_names: z.array(z.string()),
})

export type Reaction = z.infer<typeof reactionSchema>
export type BlipReactionSummary = z.infer<typeof blipReactionSummarySchema>

export const validateReaction = reactionSchema.parse
export const validateBlipReactionSummary = blipReactionSummarySchema.parse
