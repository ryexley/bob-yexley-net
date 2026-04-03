import { describe, expect, it } from "vitest"
import {
  TOOLBAR_VISIBLE_STORAGE_KEY,
  getMarkdownEditorContentMetrics,
  readToolbarVisiblePreference,
  writeToolbarVisiblePreference,
} from "@/components/markdown/editor"

type StorageState = Record<string, string>

const createStorage = (initial: StorageState = {}) => {
  const state: StorageState = { ...initial }

  return {
    get length() {
      return Object.keys(state).length
    },
    key(index: number) {
      return Object.keys(state)[index] ?? null
    },
    getItem(key: string) {
      return state[key] ?? null
    },
    setItem(key: string, value: string) {
      state[key] = value
    },
    removeItem(key: string) {
      delete state[key]
    },
    dump() {
      return { ...state }
    },
  }
}

describe("markdown editor toolbar visibility preference", () => {
  it("uses the shared key when present and removes legacy per-instance keys", () => {
    const storage = createStorage({
      [TOOLBAR_VISIBLE_STORAGE_KEY]: "false",
      "markdown-editor:blip-editor:toolbar-visible": "true",
      "markdown-editor:blip-update-editor:update-1:toolbar-visible": "true",
    })

    expect(readToolbarVisiblePreference(storage, true)).toBe(false)
    expect(storage.dump()).toEqual({
      [TOOLBAR_VISIBLE_STORAGE_KEY]: "false",
    })
  })

  it("migrates a legacy per-instance key into the shared key", () => {
    const storage = createStorage({
      "markdown-editor:blip-update-editor:update-1:toolbar-visible": "false",
      "markdown-editor:blip-editor:toolbar-visible": "true",
    })

    expect(readToolbarVisiblePreference(storage, true)).toBe(false)
    expect(storage.dump()).toEqual({
      [TOOLBAR_VISIBLE_STORAGE_KEY]: "false",
    })
  })

  it("falls back to the provided default when nothing is stored", () => {
    const storage = createStorage()

    expect(readToolbarVisiblePreference(storage, true)).toBe(true)
    expect(readToolbarVisiblePreference(storage, false)).toBe(false)
    expect(storage.dump()).toEqual({})
  })

  it("writes only the shared key and clears legacy per-instance keys", () => {
    const storage = createStorage({
      "markdown-editor:blip-editor:toolbar-visible": "true",
      "markdown-editor:blip-update-editor:update-1:toolbar-visible": "false",
    })

    writeToolbarVisiblePreference(storage, true)

    expect(storage.dump()).toEqual({
      [TOOLBAR_VISIBLE_STORAGE_KEY]: "true",
    })
  })
})

describe("getMarkdownEditorContentMetrics", () => {
  it("returns zeroed metrics for empty content", () => {
    expect(getMarkdownEditorContentMetrics("   ")).toEqual({
      characterCount: 0,
      wordCount: 0,
      paragraphCount: 0,
    })
  })

  it("counts characters, words, and paragraphs from normalized markdown", () => {
    expect(
      getMarkdownEditorContentMetrics(
        "First paragraph with a few words.\n\nSecond paragraph\non two lines.",
      ),
    ).toEqual({
      characterCount: 65,
      wordCount: 11,
      paragraphCount: 2,
    })
  })
})
