import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { render, waitFor } from "@solidjs/testing-library"
import {
  PasteCatcher,
  isPasteCatcherEvent,
  type PasteCatcherHandle,
} from "./paste-catcher"

const originalFetch = globalThis.fetch
const blobStore = new Map<string, Blob>()

beforeEach(() => {
  blobStore.clear()
  globalThis.fetch = vi.fn(async (input: any) => {
    const blob = blobStore.get(String(input))
    if (!blob) {
      throw new Error("missing blob")
    }
    return { blob: async () => blob } as unknown as Response
  }) as unknown as typeof fetch
})

afterEach(() => {
  globalThis.fetch = originalFetch
})

const setup = (overrides: Partial<Parameters<typeof PasteCatcher>[0]> = {}) => {
  const onFiles = vi.fn()
  const onText = vi.fn()
  const onDismiss = vi.fn()
  let handle: PasteCatcherHandle | undefined

  const { container } = render(() => (
    <PasteCatcher
      title="Paste from your clipboard"
      hint="Touch and hold here, then tap Paste"
      cancelLabel="Cancel"
      onFiles={onFiles}
      onText={onText}
      onDismiss={onDismiss}
      onHandle={next => {
        handle = next
      }}
      {...overrides}
    />
  ))

  // Queried directly: the wrapper is aria-hidden while closed, which hides the
  // region from role queries.
  const region = container.querySelector<HTMLDivElement>(
    "[data-paste-catcher]",
  )!
  const cancel = container.querySelector<HTMLButtonElement>(".cancel")!

  return { onFiles, onText, onDismiss, region, cancel, handle: () => handle! }
}

const wrapper = (region: HTMLElement) =>
  region.closest(".paste-catcher") as HTMLElement

const pasteEvent = (data: Partial<Record<string, any>>) => {
  const event = new Event("paste", { bubbles: true, cancelable: true })
  Object.defineProperty(event, "clipboardData", {
    value: {
      files: data.files ?? [],
      items: data.items ?? [],
      types: data.types ?? [],
      getData: (type: string) =>
        type === "text/html" ? (data.html ?? "") : (data.text ?? ""),
    },
  })
  return event as ClipboardEvent
}

describe("PasteCatcher", () => {
  it("stays focusable while closed so the opening tap can focus it", () => {
    const { region, handle } = setup()

    // A `visibility: hidden` region could not take focus, and Solid has not
    // flipped the open class yet at the moment open() calls focus().
    expect(wrapper(region).classList.contains("open")).toBe(false)

    handle().open()

    expect(wrapper(region).classList.contains("open")).toBe(true)
    expect(document.activeElement).toBe(region)
  })

  it("hands over files the clipboard exposed directly", () => {
    const { onFiles, region, handle } = setup()
    const file = new File(["x"], "shot.png", { type: "image/png" })
    handle().open()

    const event = pasteEvent({ files: [file] })
    region.dispatchEvent(event)

    expect(event.defaultPrevented).toBe(true)
    expect(onFiles).toHaveBeenCalledWith([file])
  })

  it("recovers an image iOS only put in the pasted markup", async () => {
    const { onFiles, region, handle } = setup()
    blobStore.set(
      "blob:https://site/a",
      new Blob(["x"], { type: "image/jpeg" }),
    )
    handle().open()

    const event = pasteEvent({ html: `<img src="blob:https://site/a">` })
    region.dispatchEvent(event)

    // The default insert must run: on iOS it is what materializes the blob.
    expect(event.defaultPrevented).toBe(false)
    await waitFor(() => expect(onFiles).toHaveBeenCalled())
    expect(onFiles.mock.calls[0][0][0].type).toBe("image/jpeg")
  })

  it("recovers an image WebKit inserted straight into the region", async () => {
    const { onFiles, region, handle } = setup()
    blobStore.set("blob:https://site/b", new Blob(["x"], { type: "image/png" }))
    handle().open()

    region.dispatchEvent(pasteEvent({}))
    region.innerHTML = `<img src="blob:https://site/b">`

    await waitFor(() => expect(onFiles).toHaveBeenCalled())
    expect(onFiles.mock.calls[0][0][0].name).toBe("image.png")
  })

  it("forwards plain text to the editor and closes", async () => {
    const { onText, onFiles, region, handle } = setup()
    handle().open()

    region.dispatchEvent(pasteEvent({ text: "hello there" }))

    await waitFor(() => expect(onText).toHaveBeenCalledWith("hello there"))
    expect(onFiles).not.toHaveBeenCalled()
    expect(wrapper(region).classList.contains("open")).toBe(false)
  })

  it("dismisses back to the editor when nothing arrives", async () => {
    const { onDismiss, region, handle } = setup()
    handle().open()

    region.dispatchEvent(pasteEvent({}))

    await waitFor(() => expect(onDismiss).toHaveBeenCalled())
  })

  it("dismisses on Cancel", () => {
    const { onDismiss, handle, region, cancel } = setup()
    handle().open()

    cancel.click()

    expect(onDismiss).toHaveBeenCalled()
    expect(wrapper(region).classList.contains("open")).toBe(false)
  })

  it("clears harvested markup so the next paste starts empty", async () => {
    const { region, handle } = setup()
    blobStore.set("blob:https://site/c", new Blob(["x"], { type: "image/png" }))
    handle().open()

    region.dispatchEvent(pasteEvent({}))
    region.innerHTML = `<img src="blob:https://site/c">`

    await waitFor(() => expect(region.innerHTML).toBe(""))
  })
})

describe("isPasteCatcherEvent", () => {
  it("identifies pastes that originated in the catcher", () => {
    const { region } = setup()
    const event = pasteEvent({})
    Object.defineProperty(event, "target", { value: region })

    expect(isPasteCatcherEvent(event)).toBe(true)
  })

  it("leaves composer pastes alone", () => {
    const outside = document.createElement("div")
    document.body.append(outside)
    const event = pasteEvent({})
    Object.defineProperty(event, "target", { value: outside })

    expect(isPasteCatcherEvent(event)).toBe(false)
  })
})
