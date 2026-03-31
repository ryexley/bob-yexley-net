import type { SupabaseClient } from "@supabase/supabase-js"
import {
  createSignal,
  createEffect,
  onCleanup,
  Accessor,
  Setter,
} from "solid-js"
import { isAfter, subMinutes } from "date-fns"
import { persistedStorage } from "@/lib/data/persisted-storage"

// Generic types for any entity
export type BaseEntity = {
  id: string
  created_at: string
  updated_at?: string
}

// Types for operation results
export type OperationResult<T> = {
  data: T | null
  error: string | null
}

export type DeleteResult = {
  error: string | null
}

// Store options type
export type StoreOptions = {
  limit?: number
  offset?: number
  subscribe?: boolean
  cacheMinutes?: number
  autoSaveInterval?: number
  orderBy?: string
  orderDirection?: "asc" | "desc"
}

// Upsert options type
export type UpsertOptions = {
  cacheOnly?: boolean
}

// Cache data structure
type CacheData<T> = {
  data: T[]
  timestamp: string
}

// Draft data structure - hash/map by entity ID
type DraftHash<T> = {
  [entityId: string]: {
    entity: T
    savedAt: string
  }
}

// Factory function to create a store for any entity type
export function supaStore<T extends BaseEntity>(
  tableName: string,
  generateId?: () => string,
) {
  const [entities, setEntities] = createSignal<T[]>([])
  const [isLoading, setIsLoading] = createSignal(false)
  const [error, setError] = createSignal<string | null>(null)
  const [lastFetch, setLastFetch] = createSignal<Date | null>(null)

  // Individual operation loading states
  const [isCreating, setIsCreating] = createSignal(false)
  const [isUpdating, setIsUpdating] = createSignal(false)
  const [isDeleting, setIsDeleting] = createSignal(false)
  const [isUpserting, setIsUpserting] = createSignal(false)

  // Individual operation error states
  const [createError, setCreateError] = createSignal<string | null>(null)
  const [updateError, setUpdateError] = createSignal<string | null>(null)
  const [deleteError, setDeleteError] = createSignal<string | null>(null)
  const [upsertError, setUpsertError] = createSignal<string | null>(null)

  // Editor state
  const [selectedEntity, setSelectedEntity] = createSignal<T | null>(null)
  const [isEditing, setIsEditing] = createSignal(false)

  let subscriptionCount = 0
  let activeSubscription: ReturnType<SupabaseClient["channel"]> | null = null
  let autoSaveTimer: number | undefined

  const CACHE_MINUTES = 5
  const STORAGE_KEY = `${tableName}-cache`
  const DRAFT_STORAGE_KEY = `${tableName}-drafts`
  const HYDRATION_KEY = `${tableName}-hydrated`

  const readDrafts = (): DraftHash<T> =>
    persistedStorage.getItem<DraftHash<T>>(DRAFT_STORAGE_KEY) ?? {}

  // Centralized cache management
  const cache = {
    load(): boolean {
      // NEVER auto-load cache - only use setInitialData for SSR hydration
      // Cache will only be used via isValid() check in fetchAll()
      return false
    },

    save(data: T[]): void {
      const now = new Date()
      setLastFetch(now)

      void persistedStorage.setItem(STORAGE_KEY, {
        data,
        timestamp: now.toISOString(),
      } satisfies CacheData<T>)
    },

    clear(): void {
      setLastFetch(null)
      void persistedStorage.removeItem(STORAGE_KEY)
    },

    isValid(cacheMinutes: number): boolean {
      const cached = persistedStorage.getItem<CacheData<T>>(STORAGE_KEY)
      if (!cached?.timestamp) {
        return false
      }

      const cacheDate = new Date(cached.timestamp)
      const expiryDate = subMinutes(new Date(), cacheMinutes)

      return isAfter(cacheDate, expiryDate)
    },
  }

  // Draft management - hash based
  const draft = {
    save(entity: T): void {
      if (!entity.id) {
        console.warn(`Cannot save ${tableName} draft without ID`)
        return
      }

      const drafts = readDrafts()
      void persistedStorage.setItem(DRAFT_STORAGE_KEY, {
        ...drafts,
        [entity.id]: {
          entity,
          savedAt: new Date().toISOString(),
        },
      } satisfies DraftHash<T>)
    },

    load(entityId: string): T | null {
      const drafts = readDrafts()
      return drafts[entityId]?.entity || null
    },

    loadAll(): DraftHash<T> {
      return { ...readDrafts() }
    },

    clear(entityId: string): void {
      const drafts = readDrafts()
      if (!(entityId in drafts)) {
        return
      }

      const nextDrafts = { ...drafts }
      delete nextDrafts[entityId]

      if (Object.keys(nextDrafts).length === 0) {
        void persistedStorage.removeItem(DRAFT_STORAGE_KEY)
        return
      }

      void persistedStorage.setItem(DRAFT_STORAGE_KEY, nextDrafts)
    },

    clearAll(): void {
      void persistedStorage.removeItem(DRAFT_STORAGE_KEY)
    },

    exists(entityId: string): boolean {
      const drafts = readDrafts()
      return !!drafts[entityId]
    },

    hasAny(): boolean {
      const drafts = readDrafts()
      return Object.keys(drafts).length > 0
    },

    count(): number {
      const drafts = readDrafts()
      return Object.keys(drafts).length
    },

    getAllIds(): string[] {
      const drafts = readDrafts()
      return Object.keys(drafts)
    },
  }

  // Centralized state update helper
  const dedupeById = (items: T[]): T[] => {
    const seen = new Set<string>()
    const deduped: T[] = []

    for (const item of items) {
      if (!item?.id || seen.has(item.id)) {
        continue
      }

      seen.add(item.id)
      deduped.push(item)
    }

    return deduped
  }

  const updateEntitiesState = (updater: (current: T[]) => T[]): T[] => {
    const updatedEntities = updater(entities())
    const dedupedEntities = dedupeById(updatedEntities)
    setEntities(dedupedEntities)
    cache.save(dedupedEntities)
    return dedupedEntities
  }

  // Generic async operation wrapper
  const withAsyncHandler = async <R>(
    operation: () => Promise<R>,
    setLoadingState: Setter<boolean>,
    setErrorState: Setter<string | null>,
    errorPrefix: string = "Operation failed",
  ): Promise<R> => {
    setLoadingState(true)
    setErrorState(null)

    try {
      const result = await operation()
      return result
    } catch (err) {
      const errorMessage =
        err instanceof Error
          ? err.message
          : `${errorPrefix}: An unexpected error occurred`
      setErrorState(errorMessage)
      console.error(`${errorPrefix}:`, err)
      throw err
    } finally {
      setLoadingState(false)
    }
  }

  // Don't initialize cache on module load - let SSR hydration handle it
  // Cache will only be used for subsequent client-side fetches

  // Return the hook factory
  return function useStore(
    supabaseClient: SupabaseClient,
    options: StoreOptions = {},
  ) {
    const {
      limit,
      offset = 0,
      subscribe = true,
      cacheMinutes = CACHE_MINUTES,
      autoSaveInterval = 30000,
      orderBy = "created_at",
      orderDirection = "desc",
    } = options

    // Build query helper
    const buildQuery = () => {
      let query = supabaseClient
        .from(tableName)
        .select("*")
        .order(orderBy, { ascending: orderDirection === "asc" })

      if (limit) {
        query = query.limit(limit)
      }
      if (offset > 0) {
        query = query.range(offset, offset + (limit || 20) - 1)
      }

      return query
    }

    const fetchAll = async (
      force: boolean = false,
    ): Promise<OperationResult<T[]>> => {
      // Check if we have valid cache and current data matches it
      if (!force && cache.isValid(cacheMinutes) && entities().length > 0) {
        return { data: entities(), error: null }
      }

      return withAsyncHandler(
        async () => {
          const { data, error: fetchError } = await buildQuery()

          if (fetchError) {
            throw new Error(
              fetchError.message || `Failed to fetch ${tableName}`,
            )
          }

          const entityData = (data || []) as T[]
          setEntities(entityData)
          cache.save(entityData)

          return { data: entityData, error: null }
        },
        setIsLoading,
        setError,
        `Error fetching ${tableName}`,
      )
    }

    // Method to set initial data (e.g., from SSR)
    const setInitialData = (data: T[]): void => {
      setEntities(data)
      cache.save(data)
    }

    const create = async (
      entityData: Partial<T>,
    ): Promise<OperationResult<T>> => {
      if (!entityData) {
        const errorMessage = `${tableName} data is required`
        setCreateError(errorMessage)
        return { data: null, error: errorMessage }
      }

      return withAsyncHandler(
        async () => {
          // Generate ID if not provided and generator exists
          const dataToInsert = {
            ...entityData,
            id: entityData.id || (generateId ? generateId() : undefined),
          }

          const { data, error: createError } = await supabaseClient
            .from(tableName)
            .insert([dataToInsert])
            .select()
            .single()

          if (createError || !data) {
            throw new Error(
              createError?.message || `Failed to create ${tableName}`,
            )
          }

          const newEntity = data as T
          updateEntitiesState(current => [newEntity, ...current])

          return { data: newEntity, error: null }
        },
        setIsCreating,
        setCreateError,
        `Error creating ${tableName}`,
      )
    }

    const update = async (
      id: string,
      updates: Partial<T>,
    ): Promise<OperationResult<T>> => {
      if (!id) {
        const errorMessage = `${tableName} ID is required`
        setUpdateError(errorMessage)
        return { data: null, error: errorMessage }
      }

      if (!updates || Object.keys(updates).length === 0) {
        const errorMessage = "Update data is required"
        setUpdateError(errorMessage)
        return { data: null, error: errorMessage }
      }

      return withAsyncHandler(
        async () => {
          const { data, error: updateError } = await supabaseClient
            .from(tableName)
            .update(updates)
            .eq("id", id)
            .select()
            .single()

          if (updateError || !data) {
            throw new Error(
              updateError?.message || `Failed to update ${tableName}`,
            )
          }

          const updatedEntity = data as T
          updateEntitiesState(current =>
            current.map(e => (e.id === id ? updatedEntity : e)),
          )

          return { data: updatedEntity, error: null }
        },
        setIsUpdating,
        setUpdateError,
        `Error updating ${tableName}`,
      )
    }

    const upsert = async (
      entityData: Partial<T>,
      options: UpsertOptions = {},
    ): Promise<OperationResult<T>> => {
      const { cacheOnly = false } = options

      if (!entityData) {
        const errorMessage = `${tableName} data is required`
        setUpsertError(errorMessage)
        return { data: null, error: errorMessage }
      }

      // If cacheOnly, skip database and only update local state
      if (cacheOnly) {
        try {
          // Ensure we have an ID
          const id = entityData.id || (generateId ? generateId() : undefined)
          if (!id) {
            const errorMessage = "Cannot upsert without ID"
            setUpsertError(errorMessage)
            return { data: null, error: errorMessage }
          }

          // Add timestamps
          const now = new Date().toISOString()
          const existing = entities().find(e => e.id === id)

          const updatedEntity = {
            ...existing, // Spread existing entity FIRST
            ...entityData, // Then spread updates on top
            id,
            created_at: existing?.created_at || entityData.created_at || now,
            updated_at: now,
          } as T

          // Update local state
          const existingIndex = entities().findIndex(e => e.id === id)
          if (existingIndex >= 0) {
            // Update existing
            updateEntitiesState(current =>
              current.map(e => (e.id === id ? updatedEntity : e)),
            )
          } else {
            // Add new
            updateEntitiesState(current => [updatedEntity, ...current])
          }

          return { data: updatedEntity, error: null }
        } catch (err) {
          const errorMessage =
            err instanceof Error ? err.message : "Failed to update cache"
          setUpsertError(errorMessage)
          console.error(`Error in cacheOnly upsert for ${tableName}:`, err)
          return { data: null, error: errorMessage }
        }
      }

      // Normal upsert - use Supabase's native upsert
      return withAsyncHandler(
        async () => {
          // Ensure we have an ID
          const id = entityData.id || (generateId ? generateId() : undefined)
          if (!id) {
            throw new Error("Cannot upsert without ID")
          }

          const dataToUpsert = {
            ...entityData,
            id,
          }

          // Use Supabase's native upsert
          const { data, error: upsertError } = await supabaseClient
            .from(tableName)
            .upsert(dataToUpsert, { onConflict: "id" })
            .select()
            .single()

          if (upsertError || !data) {
            throw new Error(
              upsertError?.message || `Failed to upsert ${tableName}`,
            )
          }

          const upsertedEntity = data as T

          // Update local state
          const existingIndex = entities().findIndex(
            e => e.id === upsertedEntity.id,
          )
          if (existingIndex >= 0) {
            updateEntitiesState(current =>
              current.map(e =>
                e.id === upsertedEntity.id ? upsertedEntity : e,
              ),
            )
          } else {
            updateEntitiesState(current => [upsertedEntity, ...current])
          }

          return { data: upsertedEntity, error: null }
        },
        setIsUpserting,
        setUpsertError,
        `Error upserting ${tableName}`,
      )
    }

    const remove = async (id: string): Promise<DeleteResult> => {
      if (!id) {
        const errorMessage = `${tableName} ID is required`
        setDeleteError(errorMessage)
        return { error: errorMessage }
      }

      return withAsyncHandler(
        async () => {
          const { error: deleteError } = await supabaseClient
            .from(tableName)
            .delete()
            .eq("id", id)

          if (deleteError) {
            throw new Error(
              deleteError.message || `Failed to delete ${tableName}`,
            )
          }

          updateEntitiesState(current => current.filter(e => e.id !== id))

          return { error: null }
        },
        setIsDeleting,
        setDeleteError,
        `Error deleting ${tableName}`,
      )
    }

    // Helper: Generic update with timestamp
    const updateWithTimestamp = (
      id: string,
      updates: Partial<T>,
    ): Promise<OperationResult<T>> => {
      return update(id, {
        ...updates,
        updated_at: new Date().toISOString(),
      } as Partial<T>)
    }

    // Helper to clear all errors
    const clearErrors = (): void => {
      setError(null)
      setCreateError(null)
      setUpdateError(null)
      setDeleteError(null)
      setUpsertError(null)
    }

    // Editor functions
    const select = (entity: T | null): void => {
      setSelectedEntity(() => entity)
      setIsEditing(!!entity)
      if (entity && entity.id) {
        draft.save(entity)
      }
    }

    const clearSelection = (): void => {
      setSelectedEntity(() => null)
      setIsEditing(false)
    }

    const updateSelected = (updates: Partial<T>): void => {
      const current = selectedEntity()
      if (current) {
        const updated = { ...current, ...updates } as T
        setSelectedEntity(() => updated)
        if (updated.id) {
          draft.save(updated)
        }
      }
    }

    const saveSelected = async (): Promise<OperationResult<T>> => {
      const current = selectedEntity()
      if (!current) {
        return { data: null, error: `No ${tableName} selected` }
      }

      let result: OperationResult<T>

      // If it has an ID and exists in our collection, update it
      if (current.id && entities().some(e => e.id === current.id)) {
        result = await update(current.id, current)
      } else {
        // Create new - generate ID first if needed
        const entityToCreate = {
          ...current,
          id: current.id || (generateId ? generateId() : undefined),
        }
        result = await create(entityToCreate as Partial<T>)
      }

      if (result.data) {
        draft.clear(result.data.id)
        clearSelection()
      }

      return result
    }

    const loadDraft = (entityId: string): T | null => {
      return draft.load(entityId)
    }

    const hasDraft = (entityId: string): boolean => {
      return draft.exists(entityId)
    }

    const hasAnyDrafts = (): boolean => {
      return draft.hasAny()
    }

    const getDraftCount = (): number => {
      return draft.count()
    }

    const getAllDrafts = (): DraftHash<T> => {
      return draft.loadAll()
    }

    const clearDraft = (entityId: string): void => {
      draft.clear(entityId)
    }

    const clearAllDrafts = (): void => {
      draft.clearAll()
    }

    // Auto-save to Supabase
    const enableAutoSave = (): void => {
      if (autoSaveTimer) {
        return
      }

      autoSaveTimer = setInterval(async () => {
        const current = selectedEntity()
        if (current && isEditing()) {
          if (current.id && entities().some(e => e.id === current.id)) {
            await update(current.id, current)
          } else if (Object.keys(current).length > 3) {
            const result = await create(current)
            if (result.data) {
              setSelectedEntity(() => result.data)
              draft.save(result.data)
            }
          }
        }
      }, autoSaveInterval) as unknown as number
    }

    const disableAutoSave = (): void => {
      if (autoSaveTimer) {
        clearInterval(autoSaveTimer)
        autoSaveTimer = undefined
      }
    }

    // Realtime event handlers
    const realtimeHandlers = {
      INSERT: (payload: { new: T }): void => {
        try {
          updateEntitiesState(current => {
            const existingIndex = current.findIndex(e => e.id === payload.new.id)
            if (existingIndex >= 0) {
              return current.map(e =>
                e.id === payload.new.id ? ({ ...e, ...payload.new } as T) : e,
              )
            }

            return [payload.new, ...current]
          })
        } catch (err) {
          console.error(`Error handling realtime INSERT for ${tableName}:`, err)
        }
      },

      UPDATE: (payload: { new: T }): void => {
        try {
          updateEntitiesState(current =>
            current.map(e =>
              e.id === payload.new.id ? ({ ...e, ...payload.new } as T) : e,
            ),
          )
        } catch (err) {
          console.error(`Error handling realtime UPDATE for ${tableName}:`, err)
        }
      },

      DELETE: (payload: { old: { id: string } }): void => {
        try {
          updateEntitiesState(current =>
            current.filter(e => e.id !== payload.old.id),
          )
        } catch (err) {
          console.error(`Error handling realtime DELETE for ${tableName}:`, err)
        }
      },
    }

    // Set up realtime subscription (client-side only)
    if (subscribe && typeof window !== "undefined") {
      createEffect(() => {
        subscriptionCount++

        if (subscriptionCount === 1 && !activeSubscription) {
          if (typeof supabaseClient.channel !== "function") {
            console.warn(
              `Realtime not available for ${tableName} - supabaseClient.channel is not a function`,
            )
            return
          }

          try {
            activeSubscription = supabaseClient
              .channel(`${tableName}-changes`)
              .on(
                "postgres_changes" as any,
                { event: "INSERT", schema: "public", table: tableName },
                realtimeHandlers.INSERT as any,
              )
              .on(
                "postgres_changes" as any,
                { event: "UPDATE", schema: "public", table: tableName },
                realtimeHandlers.UPDATE as any,
              )
              .on(
                "postgres_changes" as any,
                { event: "DELETE", schema: "public", table: tableName },
                realtimeHandlers.DELETE as any,
              )
              .subscribe((status: any) => {
                if (status === "SUBSCRIPTION_ERROR") {
                  console.error(`Realtime subscription error for ${tableName}`)
                  setError("Failed to establish realtime connection")
                }
              })
          } catch (err) {
            console.error(
              `Error setting up realtime subscription for ${tableName}:`,
              err,
            )
            setError("Failed to set up realtime updates")
          }
        }

        onCleanup(() => {
          subscriptionCount--
          if (subscriptionCount === 0 && activeSubscription) {
            try {
              void activeSubscription.unsubscribe?.()
              supabaseClient.removeChannel(activeSubscription)
              activeSubscription = null
            } catch (err) {
              console.error(
                `Error cleaning up subscription for ${tableName}:`,
                err,
              )
            }
          }
        })
      })
    }

    // Cleanup auto-save on unmount
    onCleanup(() => {
      disableAutoSave()
    })

    return {
      // State
      entities: entities as Accessor<T[]>,
      lastFetch: lastFetch as Accessor<Date | null>,

      // Loading states
      isLoading: isLoading as Accessor<boolean>,
      isCreating: isCreating as Accessor<boolean>,
      isUpdating: isUpdating as Accessor<boolean>,
      isDeleting: isDeleting as Accessor<boolean>,
      isUpserting: isUpserting as Accessor<boolean>,

      // Error states
      error: error as Accessor<string | null>,
      createError: createError as Accessor<string | null>,
      updateError: updateError as Accessor<string | null>,
      deleteError: deleteError as Accessor<string | null>,
      upsertError: upsertError as Accessor<string | null>,

      // Core operations
      fetchAll,
      setInitialData,
      create,
      update,
      upsert,
      remove,
      updateWithTimestamp,

      // Editor state
      selectedEntity: selectedEntity as Accessor<T | null>,
      isEditing: isEditing as Accessor<boolean>,
      select,
      clearSelection,
      updateSelected,
      saveSelected,

      // Draft management
      loadDraft,
      hasDraft,
      hasAnyDrafts,
      getDraftCount,
      getAllDrafts,
      clearDraft,
      clearAllDrafts,

      // Auto-save
      enableAutoSave,
      disableAutoSave,

      // Utilities
      invalidateCache: cache.clear,
      clearErrors,
    }
  }
}
