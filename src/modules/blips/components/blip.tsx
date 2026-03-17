import type { Blip as BlipType } from "@/modules/blips/data/schema"
import { A, usePreloadRoute } from "@solidjs/router"
import { createSignal, For, onMount, splitProps, Show } from "solid-js"
// import { Icon } from "@/components/icon"
import { Hashtag } from "@/components/icon"
import { MarkdownRenderer as Markdown } from "@/components/markdown/renderer"
import { Button } from "@/components/button"
import {
  Dialog,
  DialogBody,
  DialogCloseButton,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/dialog"
// import { Hashtag } from "@/components/icons"
import { Stack } from "@/components/stack"
import { BlipActions } from "@/modules/blips/components/blip-actions"
import { formatBlipTimestamp } from "@/modules/blips/util"
import { ptr } from "@/i18n"
import { pages } from "@/urls"
import { clsx as cx } from "@/util"
import "./blip.css"

const tr = ptr("blips.components.blip")

export function Blip(props: {
  blip: BlipType
  tags?: string[]
  onEdit?: (blipId: string) => void
  onView?: (blipId: string) => void
}) {
  const [local] = splitProps(props, ["blip", "tags", "onEdit", "onView"])
  const preloadRoute = usePreloadRoute()
  let contentRef: HTMLDivElement | undefined
  const [isClipped, setIsClipped] = createSignal(false)
  const [showReadMore, setShowReadMore] = createSignal(false)
  const canOpenDetails = () => isClipped() || typeof local.onView === "function"

  const preloadDetails = () => {
    if (typeof local.onView !== "function") {
      return
    }

    preloadRoute(pages.blip(local.blip.id), { preloadData: true })
  }

  const openDetails = () => {
    if (typeof local.onView === "function") {
      local.onView(local.blip.id)
      return
    }

    setShowReadMore(true)
  }

  const openDetailsIfNeeded = () => {
    if (!canOpenDetails()) {
      return
    }
    openDetails()
  }

  const onMainKeyDown = (event: KeyboardEvent) => {
    if (!canOpenDetails()) {
      return
    }
    if (event.key !== "Enter" && event.key !== " ") {
      return
    }
    event.preventDefault()
    openDetails()
  }

  onMount(() => {
    if (contentRef) {
      setIsClipped(contentRef.scrollHeight > contentRef.clientHeight)
    }
  })

  return (
    <li>
      <Stack>
        <div class="blip">
          <div
            class={cx("blip-main", { interactive: canOpenDetails() })}
            onPointerEnter={preloadDetails}
            onFocus={preloadDetails}
            onTouchStart={preloadDetails}
            onClick={openDetailsIfNeeded}
            onKeyDown={onMainKeyDown}
            role={canOpenDetails() ? "button" : undefined}
            tabIndex={canOpenDetails() ? 0 : undefined}>
            <header>
              <span class="timestamp">
                {/* TODO: wrap this in a tooltip that shows the full timestamp */}
                {formatBlipTimestamp(local.blip.created_at)}
              </span>
            </header>
            <div
              ref={contentRef}
              class={cx("blip-content", { preview: isClipped() })}>
              <Markdown content={local.blip.content} />
              <Show when={canOpenDetails()}>
                <Button
                  variant="ghost"
                  size="xs"
                  onClick={event => {
                    event.stopPropagation()
                    openDetails()
                  }}
                  class="read-more"
                  label={tr("actions.readMore")}
                  iconRight="arrow_forward"
                />
              </Show>
            </div>
          </div>
          <Show when={(local.tags?.length ?? 0) > 0}>
            <footer>
              <div class="tags">
                <Hashtag size="0.85rem" />
                <ul class="tag-list">
                  <For each={local.tags}>
                    {tag => (
                      <li class="tag">
                        <A href={pages.blipsTag(tag)}>{tag}</A>
                      </li>
                    )}
                  </For>
                </ul>
              </div>
            </footer>
          </Show>
        </div>
        <BlipActions
          blip={local.blip}
          onEdit={local.onEdit}
        />
        <Dialog
          open={showReadMore()}
          class="blip-readmore-dialog"
          overlayClass="blip-readmore-overlay"
          onOpenChange={setShowReadMore}>
          <DialogHeader class="blip-readmore-header">
            <DialogTitle class="blip-readmore-title">
              {formatBlipTimestamp(local.blip.created_at)}
            </DialogTitle>
            <DialogCloseButton
              class="blip-readmore-close"
              aria-label={tr("readMoreDialog.closeAriaLabel")}
            />
          </DialogHeader>
          <DialogBody class="blip-readmore-content">
            <DialogDescription>
              <Markdown content={local.blip.content} />
            </DialogDescription>
            <Show when={(local.tags?.length ?? 0) > 0}>
              <footer class="blip-readmore-footer">
                <div class="tags">
                  <Hashtag size="0.85rem" />
                  <ul class="tag-list">
                    <For each={local.tags}>
                      {tag => (
                        <li class="tag">
                          <A href={pages.blipsTag(tag)}>{tag}</A>
                        </li>
                      )}
                    </For>
                  </ul>
                </div>
              </footer>
            </Show>
          </DialogBody>
        </Dialog>
      </Stack>
    </li>
  )
}
