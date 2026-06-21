// @vitest-environment node
//
// Real-`exifr` integration: proves the readExifTimestamp wiring against actual
// HEIC bytes (no mocks), and pins the assumption that exifr encodes an EXIF
// capture time into the Date's UTC fields so `formatExifTimestamp` reproduces the
// original digits. Runs in the node environment because the unit suite mocks
// exifr; this file deliberately uses the real library + on-disk fixtures.
import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"
import { formatExifTimestamp, readExifTimestamp } from "./filename"

const fixture = (name: string): Uint8Array =>
  readFileSync(fileURLToPath(new URL(`./__fixtures__/${name}`, import.meta.url)))

describe("readExifTimestamp (real exifr)", () => {
  it("reads DateTimeOriginal from a real iPhone HEIC and formats it as-is", async () => {
    const date = await readExifTimestamp(fixture("iphone-gainmap.heic"))

    expect(date).toBeInstanceOf(Date)
    // The fixture's EXIF DateTimeOriginal is 2026:06:20 15:12:34.
    expect(formatExifTimestamp(date as Date)).toBe("20260620151234")
  })

  it("returns null for a HEIC with no EXIF capture time", async () => {
    const date = await readExifTimestamp(fixture("sample-hevc.heic"))
    expect(date).toBeNull()
  })
})
