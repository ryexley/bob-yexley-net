type StoredValue = unknown
type PendingOperation = "set" | "remove"
type PendingResolver = {
  resolve: () => void
}

type IdleDeadlineLike = {
  didTimeout: boolean
  timeRemaining: () => number
}

type IdleCallbackHandle = number
type IdleCallback = (
  callback: (deadline: IdleDeadlineLike) => void,
  options?: { timeout?: number },
) => IdleCallbackHandle
type IdleCallbackCanceller = (handle: IdleCallbackHandle) => void

export type PersistedStorageAdapter = {
  getItem<T>(key: string): T | null
  setItem(key: string, value: StoredValue): Promise<void>
  removeItem(key: string): Promise<void>
  flush(key?: string): Promise<void>
}

const DEFAULT_FLUSH_DELAY_MS = 150
const IDLE_FLUSH_TIMEOUT_MS = 1000

class DeferredLocalStorageAdapter implements PersistedStorageAdapter {
  private hydratedKeys = new Set<string>()
  private memory = new Map<string, StoredValue>()
  private pendingOperations = new Map<string, PendingOperation>()
  private pendingResolvers = new Map<string, PendingResolver[]>()
  private flushTimeoutId: ReturnType<typeof setTimeout> | null = null
  private idleCallbackId: IdleCallbackHandle | null = null
  private globalListenersBound = false

  constructor() {
    this.bindGlobalListeners()
  }

  getItem<T>(key: string): T | null {
    this.hydrateKey(key)

    if (!this.memory.has(key)) {
      return null
    }

    return this.memory.get(key) as T
  }

  setItem(key: string, value: StoredValue): Promise<void> {
    this.hydratedKeys.add(key)
    this.memory.set(key, value)
    return this.queueOperation(key, "set")
  }

  removeItem(key: string): Promise<void> {
    this.hydratedKeys.add(key)
    this.memory.delete(key)
    return this.queueOperation(key, "remove")
  }

  async flush(key?: string): Promise<void> {
    this.clearScheduledFlush()

    const keys = key ? [key] : [...this.pendingOperations.keys()]
    for (const pendingKey of keys) {
      await this.flushKey(pendingKey)
    }
  }

  private isBrowser() {
    return typeof window !== "undefined"
  }

  private bindGlobalListeners() {
    if (!this.isBrowser() || this.globalListenersBound) {
      return
    }

    const flushAll = () => {
      void this.flush()
    }

    window.addEventListener("pagehide", flushAll)
    window.addEventListener("beforeunload", flushAll)
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden") {
        flushAll()
      }
    })

    this.globalListenersBound = true
  }

  private hydrateKey(key: string) {
    if (this.hydratedKeys.has(key)) {
      return
    }

    this.hydratedKeys.add(key)

    if (!this.isBrowser()) {
      return
    }

    try {
      const raw = window.localStorage.getItem(key)
      if (raw === null) {
        return
      }

      this.memory.set(key, JSON.parse(raw))
    } catch (error) {
      console.error(`Error loading persisted storage key "${key}":`, error)
      this.memory.delete(key)
    }
  }

  private queueOperation(key: string, operation: PendingOperation) {
    return new Promise<void>(resolve => {
      const resolvers = this.pendingResolvers.get(key) ?? []
      resolvers.push({ resolve })
      this.pendingResolvers.set(key, resolvers)
      this.pendingOperations.set(key, operation)
      this.scheduleFlush()
    })
  }

  private scheduleFlush() {
    if (!this.isBrowser()) {
      void this.flush()
      return
    }

    if (this.flushTimeoutId !== null || this.idleCallbackId !== null) {
      return
    }

    const runFlush = () => {
      this.flushTimeoutId = null
      this.idleCallbackId = null
      void this.flush()
    }

    const requestIdle = window.requestIdleCallback as IdleCallback | undefined
    if (typeof requestIdle === "function") {
      this.idleCallbackId = requestIdle(
        () => {
          runFlush()
        },
        { timeout: IDLE_FLUSH_TIMEOUT_MS },
      )
      return
    }

    this.flushTimeoutId = setTimeout(runFlush, DEFAULT_FLUSH_DELAY_MS)
  }

  private clearScheduledFlush() {
    if (!this.isBrowser()) {
      return
    }

    if (this.flushTimeoutId !== null) {
      clearTimeout(this.flushTimeoutId)
      this.flushTimeoutId = null
    }

    const cancelIdle = window.cancelIdleCallback as
      | IdleCallbackCanceller
      | undefined
    if (this.idleCallbackId !== null && typeof cancelIdle === "function") {
      cancelIdle(this.idleCallbackId)
    }

    this.idleCallbackId = null
  }

  private async flushKey(key: string) {
    const operation = this.pendingOperations.get(key)
    if (!operation || !this.isBrowser()) {
      this.resolvePending(key)
      return
    }

    this.pendingOperations.delete(key)

    try {
      if (operation === "remove") {
        window.localStorage.removeItem(key)
      } else {
        const value = this.memory.get(key)
        if (value === undefined) {
          window.localStorage.removeItem(key)
        } else {
          window.localStorage.setItem(key, JSON.stringify(value))
        }
      }

      this.resolvePending(key)
    } catch (error) {
      console.error(`Error persisting storage key "${key}":`, error)
      this.resolvePending(key)
    }
  }

  private resolvePending(key: string) {
    const resolvers = this.pendingResolvers.get(key) ?? []
    this.pendingResolvers.delete(key)
    for (const resolver of resolvers) {
      resolver.resolve()
    }
  }
}

// LocalStorage is the current backend, but this adapter intentionally owns the
// scheduling and serialization boundary so we can swap to IndexedDB later
// without rewriting store callers.
export const persistedStorage: PersistedStorageAdapter =
  new DeferredLocalStorageAdapter()
