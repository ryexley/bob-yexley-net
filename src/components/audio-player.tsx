import { Button as KobalteButton } from "@kobalte/core/button"
import {
  createEffect,
  createMemo,
  createSignal,
  mergeProps,
  on,
  onCleanup,
  Show,
  splitProps,
  type Component,
} from "solid-js"
import { isServer } from "solid-js/web"
import { Icon } from "@/components/icon"
import { IconButton } from "@/components/icon-button"
import { cx } from "@/util"
import { generateRandomRadialGradients } from "@/util/image"
import "./audio-player.css"

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000
/** How quickly the scrubber glides toward playback time (higher = snappier). */
const PROGRESS_GLIDE_RATE = 10
const DEFAULT_VOLUME = 0.5
export const DEFAULT_AUDIO_PLAYER_STORAGE_KEY = "bob-yexley-net:audio-player"

export type AudioPlayerPersistEntry = {
  currentTime: number
  volume: number
  showCover: boolean
  lastPlayed: number
}

type PersistStore = Record<string, AudioPlayerPersistEntry>

export type AudioPlayerProps = {
  src: string
  storageKey?: string
  coverImage?: string
  title?: string
  artist?: string
  album?: string
  series?: string
  scrubSeconds?: number
  volume?: number
  class?: string
}

function clampVolume(value: number): number {
  if (!Number.isFinite(value)) {
    return DEFAULT_VOLUME
  }
  return Math.min(1, Math.max(0, value))
}

function trimmedProp(value: string | undefined): string {
  if (typeof value !== "string") {
    return ""
  }
  return value.trim()
}

/**
 * Canonical key for persisted audio entries — MUST match SSR, CSR, HMR reloads,
 * and any legacy keys that differ only by trimming or hash / encoding quirks.
 */
function normalizePersistedMediaUrl(raw: string): string {
  const s = typeof raw === "string" ? raw.trim() : ""
  if (!s) {
    return ""
  }
  try {
    const resolved =
      typeof window !== "undefined"
        ? new URL(s, window.location.href).href
        : new URL(s).href
    const url = new URL(resolved)
    url.hash = ""
    return url.href
  } catch {
    const hashIdx = s.indexOf("#")
    return hashIdx === -1 ? s : s.slice(0, hashIdx)
  }
}

function findStoredUrlKey(store: PersistStore, canonicalHref: string): string | null {
  if (!canonicalHref) {
    return null
  }
  if (canonicalHref in store) {
    return canonicalHref
  }
  for (const k of Object.keys(store)) {
    if (normalizePersistedMediaUrl(k) === canonicalHref) {
      return k
    }
  }
  return null
}

function isPersistEntry(x: unknown): x is AudioPlayerPersistEntry {
  if (!x || typeof x !== "object") {
    return false
  }
  const o = x as Record<string, unknown>
  return (
    typeof o.currentTime === "number" &&
    typeof o.volume === "number" &&
    typeof o.showCover === "boolean" &&
    typeof o.lastPlayed === "number"
  )
}

function readStore(storageKey: string): PersistStore | null {
  try {
    const raw = localStorage.getItem(storageKey)
    if (raw == null) {
      return null
    }
    const parsed = JSON.parse(raw) as unknown
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return null
    }
    return parsed as PersistStore
  } catch {
    return null
  }
}

function writeStore(storageKey: string, store: PersistStore): void {
  try {
    localStorage.setItem(storageKey, JSON.stringify(store))
  } catch {
    /* silent */
  }
}

function pruneStale(storageKey: string): void {
  try {
    const store = readStore(storageKey)
    if (!store) {
      return
    }
    const cutoff = Date.now() - THIRTY_DAYS_MS
    const next: PersistStore = {}
    for (const [url, entry] of Object.entries(store)) {
      if (!isPersistEntry(entry)) {
        continue
      }
      if (entry.lastPlayed >= cutoff) {
        next[url] = entry
      }
    }
    writeStore(storageKey, next)
  } catch {
    /* silent */
  }
}

function readEntry(
  storageKey: string,
  canonicalHref: string,
): AudioPlayerPersistEntry | null {
  try {
    const store = readStore(storageKey)
    if (!store) {
      return null
    }
    const key = findStoredUrlKey(store, canonicalHref)
    if (key == null) {
      return null
    }
    const entry = store[key]
    return isPersistEntry(entry) ? entry : null
  } catch {
    return null
  }
}

type InitialPlayerState = {
  volume: number
  showCover: boolean
  pendingSeek: number | null
}

function clampPlaybackTime(time: number, duration: number): number {
  if (!Number.isFinite(time) || time < 0) {
    return 0
  }
  if (!Number.isFinite(duration) || duration <= 0) {
    return time
  }
  return Math.min(time, Math.max(0, duration - 0.25))
}

function formatPlaybackClock(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) {
    return "0:00"
  }
  const totalSeconds = Math.floor(seconds)
  const minutes = Math.floor(totalSeconds / 60)
  const secs = totalSeconds % 60
  return `${minutes}:${String(secs).padStart(2, "0")}`
}

function mergeEntry(
  storageKey: string,
  canonicalHref: string,
  patch: Partial<AudioPlayerPersistEntry>,
): void {
  try {
    const canon = canonicalHref.trim()
    if (!canon) {
      return
    }
    const store = readStore(storageKey) ?? {}
    const existingKey = findStoredUrlKey(store, canon)
    const prev =
      existingKey != null && isPersistEntry(store[existingKey])
        ? store[existingKey]
        : null
    const base: AudioPlayerPersistEntry = prev ?? {
      currentTime: 0,
      volume: DEFAULT_VOLUME,
      showCover: false,
      lastPlayed: Date.now(),
    }
    if (existingKey != null && existingKey !== canon) {
      delete store[existingKey]
    }
    store[canon] = {
      ...base,
      ...patch,
      lastPlayed: Date.now(),
    }
    writeStore(storageKey, store)
  } catch {
    /* silent */
  }
}

export const AudioPlayer: Component<AudioPlayerProps> = rawProps => {
  const props = mergeProps(
    {
      scrubSeconds: 10,
      volume: DEFAULT_VOLUME,
      storageKey: DEFAULT_AUDIO_PLAYER_STORAGE_KEY,
    },
    rawProps,
  )
  const [local] = splitProps(props, [
    "src",
    "storageKey",
    "coverImage",
    "title",
    "artist",
    "album",
    "series",
    "scrubSeconds",
    "volume",
    "class",
  ])

  const defaultVolume = createMemo(() => clampVolume(local.volume))

  const normalizedUrl = createMemo(() => normalizePersistedMediaUrl(local.src))

  /** Non-empty trimmed URL — whitespace-only props stay falsy so UI state cannot disagree. */
  const trimmedCoverSrc = createMemo(() => trimmedProp(local.coverImage))

  const trimmedTitle = createMemo(() => trimmedProp(local.title))
  const trimmedArtist = createMemo(() => trimmedProp(local.artist))
  const trimmedAlbum = createMemo(() => trimmedProp(local.album))
  const trimmedSeries = createMemo(() => trimmedProp(local.series))

  const albumOrSeries = createMemo(() => {
    const album = trimmedAlbum()
    if (album) {
      return album
    }
    return trimmedSeries()
  })

  const albumSeriesLine = createMemo(() => {
    const grouping = albumOrSeries()
    if (!grouping) {
      return ""
    }
    const artist = trimmedArtist()
    if (artist) {
      return `${artist} / ${grouping}`
    }
    return grouping
  })

  const coverArtDescription = createMemo(() => {
    const episodeTitle = trimmedTitle()
    const line = albumSeriesLine()
    const parts: string[] = []
    if (episodeTitle) {
      parts.push(episodeTitle)
    }
    if (line) {
      parts.push(line)
    }
    return parts.join(" — ")
  })

  const coverArtAlt = createMemo(() => {
    const description = coverArtDescription()
    if (!description) {
      return "Cover artwork"
    }
    return `${description} artwork`
  })

  const coverArtTitle = createMemo(() => {
    const description = coverArtDescription()
    return description.length > 0 ? description : undefined
  })

  const hasPlayerMetadata = createMemo(
    () => albumSeriesLine().length > 0 || trimmedTitle().length > 0,
  )

  const playerBackground = createMemo(() => ({
    "background-image": generateRandomRadialGradients(),
  }))

  /** SSR-safe defaults — persisted state is restored in the client-only effect below. */
  const initial: InitialPlayerState = {
    volume: defaultVolume(),
    showCover: false,
    pendingSeek: null,
  }

  const [audioRef, setAudioRef] = createSignal<HTMLAudioElement | null>(null)
  const audioElBox = { current: null as HTMLAudioElement | null }
  const progressRangeRef = { current: null as HTMLInputElement | null }

  function bindAudioEl(el: HTMLAudioElement | null): void {
    audioElBox.current = el
    setAudioRef(el)
  }
  const [playing, setPlaying] = createSignal(false)
  const [volume, setVolume] = createSignal(initial.volume)
  const [showCover, setShowCover] = createSignal(initial.showCover)
  const [showVolume, setShowVolume] = createSignal(false)
  const [pendingSeek, setPendingSeek] = createSignal<number | null>(
    initial.pendingSeek,
  )
  const [duration, setDuration] = createSignal(0)
  const [currentTimeSig, setCurrentTimeSig] = createSignal(0)
  const [smoothTime, setSmoothTime] = createSignal(0)
  const [isScrubbing, setIsScrubbing] = createSignal(false)
  const [scrubTime, setScrubTime] = createSignal<number | null>(null)
  const persistSnapshot = {
    volume: initial.volume,
    showCover: initial.showCover,
  }

  const displayTime = createMemo(() => {
    const scrub = scrubTime()
    if (scrub != null) {
      return scrub
    }
    if (playing() && !isScrubbing()) {
      return smoothTime()
    }
    return currentTimeSig()
  })

  function snapSmoothTime(time: number): void {
    if (Number.isFinite(time) && time >= 0) {
      setSmoothTime(time)
    }
  }

  const safeDuration = createMemo(() => {
    const d = duration()
    if (!Number.isFinite(d) || d <= 0) {
      return 0
    }
    return d
  })

  const progressFillPercent = createMemo(() => {
    const d = safeDuration()
    if (!d) {
      return 0
    }
    return (displayTime() / d) * 100
  })

  const progressRangeValue = createMemo(() => {
    const d = safeDuration()
    if (!d) {
      return 0
    }
    return Math.min(displayTime(), d)
  })

  const elapsedClock = createMemo(() => formatPlaybackClock(displayTime()))

  const remainingClock = createMemo(() => {
    const d = safeDuration()
    if (!d) {
      return "0:00"
    }
    return formatPlaybackClock(Math.max(0, d - displayTime()))
  })

  const totalClock = createMemo(() => formatPlaybackClock(safeDuration()))

  const volumeFillPercent = createMemo(() => volume() * 100)

  const coverArtDisplayed = createMemo(
    () => showCover() && trimmedCoverSrc().length > 0,
  )

  function applyMediaSession(): void {
    if (typeof navigator === "undefined" || !("mediaSession" in navigator)) {
      return
    }
    try {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: trimmedTitle(),
        artist: albumSeriesLine() || trimmedArtist(),
        album: albumOrSeries(),
        artwork: trimmedCoverSrc()
          ? [{ src: trimmedCoverSrc(), sizes: "512x512", type: "image/jpeg" }]
          : [],
      })
    } catch {
      /* silent */
    }
  }

  const lastPrunedStorageKey = { current: null as string | null }
  const lastMediaRestoreKey = { current: null as string | null }

  function persistPlaybackPosition(): void {
    const el = audioElBox.current
    if (!el || isServer) {
      return
    }
    mergeEntry(local.storageKey, normalizedUrl(), {
      currentTime: el.currentTime,
      volume: persistSnapshot.volume,
      showCover: persistSnapshot.showCover,
    })
  }

  function syncDurationFromElement(el: HTMLAudioElement): void {
    const d = el.duration
    if (Number.isFinite(d) && d > 0) {
      setDuration(d)
    }
  }

  function syncProgressFromElement(el: HTMLAudioElement): void {
    if (!isScrubbing()) {
      const t = el.currentTime
      setCurrentTimeSig(t)
      if (!playing()) {
        snapSmoothTime(t)
      }
    }
  }

  function syncProgressRangeInput(): void {
    const input = progressRangeRef.current
    const d = safeDuration()
    if (!input || !d) {
      return
    }
    const v = Math.min(displayTime(), d)
    input.max = String(d)
    input.value = String(v)
  }

  function applyPendingSeekToElement(el: HTMLAudioElement): boolean {
    const seek = pendingSeek()
    if (seek == null || !Number.isFinite(seek)) {
      return false
    }
    const d = el.duration
    if (!Number.isFinite(d) || d <= 0) {
      return false
    }
    const t = clampPlaybackTime(seek, d)
    if (Math.abs(el.currentTime - t) > 0.05) {
      el.currentTime = t
    }
    syncProgressFromElement(el)
    syncDurationFromElement(el)
    snapSmoothTime(el.currentTime)
    setPendingSeek(null)
    return true
  }

  createEffect(
    on(
      () =>
        [
          local.storageKey,
          normalizedUrl(),
          trimmedCoverSrc(),
        ] as const,
      ([key, url, coverSrc]) => {
        if (isServer) {
          return
        }
        if (lastPrunedStorageKey.current !== key) {
          pruneStale(key)
          lastPrunedStorageKey.current = key
        }
        const mediaKey = `${key}::${url}`
        const mediaChanged = lastMediaRestoreKey.current !== mediaKey
        const hasArt = coverSrc.length > 0
        const entry = readEntry(key, url)
        if (entry) {
          setVolume(entry.volume)
          setShowCover(hasArt && entry.showCover)
          if (mediaChanged) {
            setPendingSeek(entry.currentTime)
            setCurrentTimeSig(entry.currentTime)
            snapSmoothTime(entry.currentTime)
          }
        } else {
          setVolume(defaultVolume())
          setShowCover(false)
          if (mediaChanged) {
            setPendingSeek(null)
            setCurrentTimeSig(0)
            snapSmoothTime(0)
          }
        }
        if (mediaChanged) {
          lastMediaRestoreKey.current = mediaKey
        }
      },
    ),
  )

  /** Push scrubber value to the DOM — WebKit often ignores reactive range `value` alone. */
  createEffect(() => {
    displayTime()
    safeDuration()
    syncProgressRangeInput()
  })

  /** Apply restored seek once metadata is ready — handles loadedmetadata racing ahead of storage restore. */
  createEffect(() => {
    if (isServer) {
      return
    }
    const el = audioRef()
    if (el == null || pendingSeek() == null) {
      return
    }

    if (applyPendingSeekToElement(el)) {
      return
    }

    const onDurationReady = () => {
      if (pendingSeek() != null) {
        applyPendingSeekToElement(el)
      }
    }
    el.addEventListener("loadedmetadata", onDurationReady)
    el.addEventListener("durationchange", onDurationReady)
    onCleanup(() => {
      el.removeEventListener("loadedmetadata", onDurationReady)
      el.removeEventListener("durationchange", onDurationReady)
    })
  })

  /** Glide the scrubber while playing — avoids jumpy timeupdate steps. */
  createEffect(() => {
    if (!playing() || isServer) {
      return
    }
    const el = audioRef()
    if (!el) {
      return
    }
    let frame = 0
    let lastTick = performance.now()
    const tick = (now: number) => {
      const dt = Math.min((now - lastTick) / 1000, 0.1)
      lastTick = now
      const target = el.currentTime
      setCurrentTimeSig(target)
      setSmoothTime(prev => {
        const diff = target - prev
        if (Math.abs(diff) < 0.02) {
          return target
        }
        return prev + diff * Math.min(1, PROGRESS_GLIDE_RATE * dt)
      })
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    onCleanup(() => {
      cancelAnimationFrame(frame)
      snapSmoothTime(el.currentTime)
    })
  })

  createEffect(() => {
    const el = audioRef()
    const v = volume()
    if (el) {
      el.volume = v
    }
  })

  createEffect(() => {
    trimmedTitle()
    trimmedArtist()
    albumOrSeries()
    albumSeriesLine()
    trimmedCoverSrc()
    if (playing()) {
      applyMediaSession()
    }
  })

  createEffect(() => {
    persistSnapshot.volume = volume()
    persistSnapshot.showCover = showCover()
  })

  createEffect(() => {
    if (!playing()) {
      return
    }
    const key = local.storageKey
    const url = normalizedUrl()
    const id = window.setInterval(() => {
      const el = audioElBox.current
      if (!el) {
        return
      }
      mergeEntry(key, url, {
        currentTime: el.currentTime,
        volume: persistSnapshot.volume,
        showCover: persistSnapshot.showCover,
      })
    }, 5000)
    onCleanup(() => window.clearInterval(id))
  })

  function persistUiState(patch: {
    volume?: number
    showCover?: boolean
  }): void {
    mergeEntry(local.storageKey, normalizedUrl(), {
      ...(patch.volume !== undefined ? { volume: patch.volume } : {}),
      ...(patch.showCover !== undefined ? { showCover: patch.showCover } : {}),
    })
  }

  function togglePlay(): void {
    const el = audioRef()
    if (!el) {
      return
    }
    if (el.paused) {
      void el.play().catch(() => {
        /* autoplay or transient errors — ignore */
      })
    } else {
      el.pause()
    }
  }

  function seekBy(deltaSeconds: number): void {
    const el = audioRef()
    if (!el || !Number.isFinite(el.duration)) {
      return
    }
    const next = Math.min(
      Math.max(0, el.currentTime + deltaSeconds),
      Math.max(0, el.duration - 0.001),
    )
    el.currentTime = next
    setCurrentTimeSig(next)
    snapSmoothTime(next)
  }

  function replaySeekIconSpin(
    e: MouseEvent | TouchEvent,
    direction: "back" | "forward",
  ): void {
    if (
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      return
    }
    const root = e.currentTarget
    if (!(root instanceof HTMLElement)) {
      return
    }
    const icon = root.querySelector(".icon")
    if (!(icon instanceof HTMLElement)) {
      return
    }

    const spinClass = direction === "back" ? "spin-back" : "spin-forward"
    const onEnd = () => {
      icon.classList.remove(spinClass)
      icon.style.transform = ""
      icon.style.willChange = ""
      icon.removeEventListener("animationend", onEnd)
    }

    icon.removeEventListener("animationend", onEnd)
    icon.classList.remove(spinClass)
    icon.style.transform = ""
    requestAnimationFrame(() => {
      icon.classList.add(spinClass)
      icon.addEventListener("animationend", onEnd)
    })
  }

  function seekBack(): void {
    requestAnimationFrame(() => seekBy(-local.scrubSeconds))
  }

  function seekForward(): void {
    requestAnimationFrame(() => seekBy(local.scrubSeconds))
  }

  function onScrubPointerUp(
    e: PointerEvent & { currentTarget: HTMLInputElement },
  ): void {
    const el = audioRef()
    const t = Number(e.currentTarget.value)
    if (el && Number.isFinite(t)) {
      el.currentTime = t
      setCurrentTimeSig(t)
      snapSmoothTime(t)
    }
    setScrubTime(null)
    setIsScrubbing(false)
    persistPlaybackPosition()
    try {
      e.currentTarget.releasePointerCapture(e.pointerId)
    } catch {
      /* ignore */
    }
  }

  return (
    <div
      class={cx(
        "audio-player",
        showVolume() && "is-volume-open",
        coverArtDisplayed() && "is-cover-open",
        local.class,
      )}
      style={playerBackground()}
      role="region"
      aria-label={local.title ?? "Audio player"}>
      {/* eslint-disable-next-line jsx-a11y/media-has-caption -- podcast-style audio; no caption track supplied */}
      <audio
        ref={bindAudioEl}
        src={local.src}
        preload="metadata"
        onPlay={() => {
          setPlaying(true)
          applyMediaSession()
        }}
        onPause={() => {
          setPlaying(false)
          persistPlaybackPosition()
        }}
        onEnded={() => {
          setPlaying(false)
          const el = audioElBox.current
          if (el) {
            el.currentTime = 0
          }
          setCurrentTimeSig(0)
          snapSmoothTime(0)
          persistPlaybackPosition()
        }}
        onLoadStart={() => setDuration(0)}
        onTimeUpdate={e => syncProgressFromElement(e.currentTarget)}
        onSeeked={e => syncProgressFromElement(e.currentTarget)}
        onLoadedMetadata={e => {
          const el = e.currentTarget
          syncDurationFromElement(el)
          applyPendingSeekToElement(el)
        }}
        onDurationChange={e => {
          const el = e.currentTarget
          syncDurationFromElement(el)
        }}
      />

      <Show when={trimmedCoverSrc().length > 0}>
        <div
          class={cx(
            "cover-shell",
            showCover() && "cover-shell-open",
          )}
          aria-hidden={!showCover()}>
          <div class="cover-shell-inner">
            <img
              class="cover-art"
              src={trimmedCoverSrc()}
              alt={coverArtAlt()}
              attr:title={coverArtTitle()}
              decoding="async"
            />
          </div>
        </div>
      </Show>

      <Show when={hasPlayerMetadata()}>
        <div class="player-metadata">
          <Show when={albumSeriesLine()}>
            <p class="album-series">{albumSeriesLine()}</p>
          </Show>
          <Show when={trimmedTitle()}>
            <p class="title">{trimmedTitle()}</p>
          </Show>
        </div>
      </Show>

      <div class="player-controls">
        <IconButton
          class="rail-side volume-toggle"
          size="sm"
          icon="volume_up"
          aria-label={showVolume() ? "Hide volume" : "Show volume"}
          onClick={() => setShowVolume(v => !v)}
        />

        <div class="transport">
          <IconButton
            class="seek-action"
            size="sm"
            icon="replay"
            aria-label={`Rewind ${local.scrubSeconds} seconds`}
            onClick={seekBack}
            onMouseDown={e => replaySeekIconSpin(e, "back")}
          />
          <KobalteButton
            type="button"
            class={cx(
              "transport-play",
              playing() && "transport-play-playing",
            )}
            onClick={togglePlay}
            aria-label={playing() ? "Pause" : "Play"}>
            <Icon name={playing() ? "pause" : "play_arrow"} />
          </KobalteButton>
          <IconButton
            class="seek-action"
            size="sm"
            icon="forward_media"
            aria-label={`Forward ${local.scrubSeconds} seconds`}
            onClick={seekForward}
            onMouseDown={e => replaySeekIconSpin(e, "forward")}
          />
        </div>

        <IconButton
          class="rail-side cover-toggle"
          size="sm"
          icon="image"
          aria-label={
            coverArtDisplayed() ? "Hide cover image" : "Show cover image"
          }
          disabled={!trimmedCoverSrc()}
          onClick={() =>
            setShowCover(c => {
              const next = !c
              persistUiState({ showCover: next })
              return next
            })
          }
        />
      </div>

      <div class="player-progress">
        <input
          ref={el => {
            progressRangeRef.current = el
          }}
          class="player-range"
          type="range"
          min={0}
          max={Math.max(safeDuration(), 0.0001)}
          step="any"
          value={progressRangeValue()}
          style={{ "--slider-fill": `${progressFillPercent()}%` }}
          disabled={!safeDuration()}
          aria-label="Playback progress"
          aria-valuetext={`${elapsedClock()} elapsed, ${remainingClock()} remaining of ${totalClock()}`}
          onPointerDown={e => {
            e.currentTarget.setPointerCapture(e.pointerId)
            setIsScrubbing(true)
          }}
          onInput={e => setScrubTime(Number(e.currentTarget.value))}
          onPointerUp={onScrubPointerUp}
          onPointerCancel={onScrubPointerUp}
        />
        <Show when={safeDuration() > 0}>
          <div
            class="player-time"
            aria-hidden="true">
            <span class="elapsed">{elapsedClock()}</span>
            <span class="remaining">
              {remainingClock()} / {totalClock()}
            </span>
          </div>
        </Show>
      </div>

      <div
        class={cx("volume-panel", showVolume() && "volume-panel-open")}
        aria-hidden={!showVolume()}>
        <div class="volume-panel-inner">
          <input
            class="player-range volume-range"
            type="range"
            min={0}
            max={1}
            step="any"
            value={volume()}
            style={{ "--slider-fill": `${volumeFillPercent()}%` }}
            aria-label="Volume"
            tabIndex={showVolume() ? 0 : -1}
            onInput={e => {
              const v = Number(e.currentTarget.value)
              setVolume(v)
              const el = audioRef()
              if (el) {
                el.volume = v
              }
              persistUiState({ volume: v })
            }}
          />
          <p
            class="volume-panel-label"
            aria-hidden="true">
            volume
          </p>
        </div>
      </div>
    </div>
  )
}
