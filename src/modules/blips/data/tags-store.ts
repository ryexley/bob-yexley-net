import type { SupabaseClient } from "@supabase/supabase-js"
import type { OperationResult } from "@/lib/data/supa-store"
import type { Tag } from "@/modules/blips/data/tags-schema"
import { slugify } from "@/util/formatters"

const canonicalizeTagValues = (values: string[]): string[] => {
  const canonicalized = values
    .map(value => slugify(value).trim())
    .filter(Boolean)

  return [...new Set(canonicalized)].sort()
}

export function tagStore(supabaseClient: SupabaseClient) {
  const listTags = async (): Promise<OperationResult<Tag[]>> => {
    try {
      const { data, error } = await supabaseClient
        .from("tags")
        .select("id, name, description, created_at, updated_at")
        .order("name", { ascending: true })

      if (error) {
        throw new Error(error.message)
      }

      return { data: (data ?? []) as Tag[], error: null }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to list tags"
      return { data: null, error: message }
    }
  }

  const upsertTagsByName = async (
    tagValues: string[],
  ): Promise<OperationResult<Tag[]>> => {
    const canonicalValues = canonicalizeTagValues(tagValues)
    if (canonicalValues.length === 0) {
      return { data: [], error: null }
    }

    try {
      const payload = canonicalValues.map(name => ({ name }))
      const { data, error } = await supabaseClient
        .from("tags")
        .upsert(payload, { onConflict: "name" })
        .select("id, name, description, created_at, updated_at")

      if (error) {
        throw new Error(error.message)
      }

      return { data: (data ?? []) as Tag[], error: null }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to upsert tags"
      return { data: null, error: message }
    }
  }

  const getBlipTagValues = async (
    blipId: string,
  ): Promise<OperationResult<string[]>> => {
    if (!blipId) {
      return { data: [], error: null }
    }

    try {
      const { data: blipTagRows, error: blipTagError } = await supabaseClient
        .from("blip_tags")
        .select("tag_id")
        .eq("blip_id", blipId)

      if (blipTagError) {
        throw new Error(blipTagError.message)
      }

      const tagIds = [...new Set((blipTagRows ?? []).map(row => row.tag_id))]
      if (tagIds.length === 0) {
        return { data: [], error: null }
      }

      const { data: tagRows, error: tagsError } = await supabaseClient
        .from("tags")
        .select("name")
        .in("id", tagIds)
        .order("name", { ascending: true })

      if (tagsError) {
        throw new Error(tagsError.message)
      }

      return {
        data: canonicalizeTagValues((tagRows ?? []).map(row => row.name)),
        error: null,
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to load blip tags"
      return { data: null, error: message }
    }
  }

  const getBlipTagValuesByBlipIds = async (
    blipIds: string[],
  ): Promise<OperationResult<Record<string, string[]>>> => {
    const ids = [...new Set((blipIds ?? []).filter(Boolean))]
    if (ids.length === 0) {
      return { data: {}, error: null }
    }

    try {
      const { data: blipTagRows, error: blipTagsError } = await supabaseClient
        .from("blip_tags")
        .select("blip_id, tag_id")
        .in("blip_id", ids)

      if (blipTagsError) {
        throw new Error(blipTagsError.message)
      }

      const result: Record<string, string[]> = Object.fromEntries(
        ids.map(id => [id, []]),
      )
      const tagIds = [...new Set((blipTagRows ?? []).map(row => row.tag_id))]

      if (tagIds.length === 0) {
        return { data: result, error: null }
      }

      const { data: tags, error: tagsError } = await supabaseClient
        .from("tags")
        .select("id, name")
        .in("id", tagIds)

      if (tagsError) {
        throw new Error(tagsError.message)
      }

      const nameByTagId = new Map((tags ?? []).map(tag => [tag.id, tag.name]))

      for (const row of blipTagRows ?? []) {
        const tagName = nameByTagId.get(row.tag_id)
        if (!tagName) {
          continue
        }
        result[row.blip_id] ??= []
        result[row.blip_id].push(tagName)
      }

      for (const blipId of Object.keys(result)) {
        result[blipId] = [...new Set(result[blipId])].sort()
      }

      return { data: result, error: null }
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Failed to load blip tags by blip IDs"
      return { data: null, error: message }
    }
  }

  const replaceBlipTags = async (
    blipId: string,
    tagValues: string[],
  ): Promise<OperationResult<string[]>> => {
    if (!blipId) {
      return { data: null, error: "Blip ID is required" }
    }

    const canonicalValues = canonicalizeTagValues(tagValues)

    try {
      if (canonicalValues.length === 0) {
        const { error } = await supabaseClient
          .from("blip_tags")
          .delete()
          .eq("blip_id", blipId)

        if (error) {
          throw new Error(error.message)
        }

        return { data: [], error: null }
      }

      const upsertResult = await upsertTagsByName(canonicalValues)
      if (upsertResult.error || !upsertResult.data) {
        return { data: null, error: upsertResult.error ?? "Failed to upsert tags" }
      }

      const tagIds = upsertResult.data.map(tag => tag.id)

      const { data: existingRows, error: existingRowsError } = await supabaseClient
        .from("blip_tags")
        .select("tag_id")
        .eq("blip_id", blipId)

      if (existingRowsError) {
        throw new Error(existingRowsError.message)
      }

      const existingTagIds = new Set((existingRows ?? []).map(row => row.tag_id))
      const nextTagIds = new Set(tagIds)

      const tagIdsToDelete = [...existingTagIds].filter(id => !nextTagIds.has(id))
      if (tagIdsToDelete.length > 0) {
        const { error: deleteError } = await supabaseClient
          .from("blip_tags")
          .delete()
          .eq("blip_id", blipId)
          .in("tag_id", tagIdsToDelete)

        if (deleteError) {
          throw new Error(deleteError.message)
        }
      }

      const rowsToInsert = tagIds
        .filter(id => !existingTagIds.has(id))
        .map(tag_id => ({ blip_id: blipId, tag_id }))

      if (rowsToInsert.length > 0) {
        const { error: insertError } = await supabaseClient
          .from("blip_tags")
          .insert(rowsToInsert)

        if (insertError) {
          throw new Error(insertError.message)
        }
      }

      return { data: canonicalValues, error: null }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to persist blip tags"
      return { data: null, error: message }
    }
  }

  return {
    listTags,
    upsertTagsByName,
    getBlipTagValues,
    getBlipTagValuesByBlipIds,
    replaceBlipTags,
  }
}
