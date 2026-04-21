import { createMemo, For, mergeProps, splitProps } from "solid-js"
import "./blip-card-skeleton.css"

export function BlipCardSkeletonList(props: { count?: number; label?: string }) {
  const propsWithDefaults = mergeProps(
    {
      count: 8,
      label: "Loading blips",
    },
    props,
  )
  const [local] = splitProps(propsWithDefaults, ["count", "label"])
  const items = createMemo(() =>
    Array.from({ length: local.count }, (_, index) => index),
  )

  return (
    <div
      class="blip-card-skeleton-state"
      role="status"
      aria-live="polite"
      aria-label={local.label}>
      <ul class="blip-card-skeleton-list" aria-hidden="true">
        <For each={items()}>
          {() => (
            <li>
              <div class="blip-card-skeleton-item">
                <article class="blip-card-skeleton-card">
                  <header class="blip-card-skeleton-header">
                    <div class="blip-card-skeleton-block timestamp" />
                  </header>
                  <div class="blip-card-skeleton-content">
                    <div class="blip-card-skeleton-block line line-1" />
                    <div class="blip-card-skeleton-block line line-2" />
                    <div class="blip-card-skeleton-block line line-3" />
                    <div class="blip-card-skeleton-block read-more" />
                  </div>
                  <footer class="blip-card-skeleton-footer">
                    <div class="blip-card-skeleton-activity-pill count-pill">
                      <div class="blip-card-skeleton-block activity-icon count-icon" />
                      <div class="blip-card-skeleton-block activity-count" />
                    </div>
                    <div class="blip-card-skeleton-activity-pill count-pill">
                      <div class="blip-card-skeleton-block activity-icon count-icon" />
                      <div class="blip-card-skeleton-block activity-count" />
                    </div>
                    <div class="blip-card-skeleton-activity-pill trigger-pill">
                      <div class="blip-card-skeleton-block activity-icon trigger-icon" />
                    </div>
                  </footer>
                </article>
                <div class="blip-card-skeleton-reactions">
                  <div class="blip-card-skeleton-reaction-pill">
                    <div class="blip-card-skeleton-block reaction-emoji" />
                    <div class="blip-card-skeleton-block reaction-count" />
                  </div>
                  <div class="blip-card-skeleton-reaction-pill">
                    <div class="blip-card-skeleton-block reaction-emoji" />
                    <div class="blip-card-skeleton-block reaction-count" />
                  </div>
                </div>
              </div>
            </li>
          )}
        </For>
      </ul>
    </div>
  )
}
