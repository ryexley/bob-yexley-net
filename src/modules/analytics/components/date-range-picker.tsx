import { createEffect, createMemo, createSignal, For, Show } from "solid-js"
import { DatePicker } from "@/components/date-time-picker"
import { Select } from "@/components/select"
import { Stack } from "@/components/stack"
import { ptr } from "@/i18n"
import type { AnalyticsRangePreset } from "@/modules/analytics/lib/date-range"
import "./date-range-picker.css"

const tr = ptr("analytics.components.dateRangePicker")

type AnalyticsDateRangePickerProps = {
  activePreset: AnalyticsRangePreset
  customPanelOpen: boolean
  customFrom: Date | null
  customTo: Date | null
  siteId: string
  siteOptions: Array<{ value: string; label: string }>
  onPresetSelect: (preset: AnalyticsRangePreset) => void
  onCustomFromChange: (value: Date | null) => void
  onCustomToChange: (value: Date | null) => void
  onSiteIdChange: (siteId: string) => void
}

const PRESET_OPTIONS: AnalyticsRangePreset[] = ["24h", "7d", "30d", "90d", "custom"]

export function AnalyticsDateRangePicker(props: AnalyticsDateRangePickerProps) {
  const customPanelVisible = createMemo(() => props.customPanelOpen)
  const [customPanelRendered, setCustomPanelRendered] = createSignal(false)
  const [customPanelShown, setCustomPanelShown] = createSignal(false)
  let customPanelHideTimeout: ReturnType<typeof setTimeout> | null = null
  let customPanelShowFrame: number | null = null

  createEffect(() => {
    if (props.customPanelOpen) {
      if (customPanelHideTimeout) {
        clearTimeout(customPanelHideTimeout)
        customPanelHideTimeout = null
      }

      if (customPanelShowFrame !== null) {
        cancelAnimationFrame(customPanelShowFrame)
        customPanelShowFrame = null
      }

      setCustomPanelRendered(true)
      setCustomPanelShown(false)
      customPanelShowFrame = requestAnimationFrame(() => {
        setCustomPanelShown(true)
        customPanelShowFrame = null
      })
      return
    }

    if (!customPanelRendered()) {
      return
    }

    setCustomPanelShown(false)
    customPanelHideTimeout = setTimeout(() => {
      setCustomPanelRendered(false)
      customPanelHideTimeout = null
    }, 200)
  })

  return (
    <div class="analytics-date-range-picker">
      <Stack
        orient="row"
        align="end"
        justify="end"
        fullWidth
        class="controls">
        <Show when={props.siteOptions.length > 1}>
          <Select
            label={tr("siteLabel")}
            options={props.siteOptions}
            value={props.siteId}
            onChange={value => {
              if (value) {
                props.onSiteIdChange(value)
              }
            }}
            containerClass="site-select"
          />
        </Show>
        <div
          class="quick-picks"
          role="group"
          aria-label={tr("rangeLabel")}>
          <For each={PRESET_OPTIONS}>
            {preset => (
              <button
                type="button"
                class="quick-pick"
                data-active={
                  preset === "custom"
                    ? props.customPanelOpen || props.activePreset === "custom"
                      ? ""
                      : undefined
                    : props.activePreset === preset
                      ? ""
                      : undefined
                }
                aria-pressed={
                  preset === "custom"
                    ? props.customPanelOpen || props.activePreset === "custom"
                    : props.activePreset === preset
                }
                onClick={() => props.onPresetSelect(preset)}>
                {tr(`presets.${preset}`)}
              </button>
            )}
          </For>
        </div>
      </Stack>
      <Show when={customPanelRendered()}>
        <div
          class="custom-range-panel"
          data-open={customPanelShown() ? "" : undefined}
          aria-hidden={!customPanelVisible()}>
          <div class="custom-range-panel-inner">
            <DatePicker
              label={tr("fromLabel")}
              value={props.customFrom}
              onChange={props.onCustomFromChange}
              maxDate={props.customTo ?? undefined}
              containerClass="custom-date"
            />
            <DatePicker
              label={tr("toLabel")}
              value={props.customTo}
              onChange={props.onCustomToChange}
              minDate={props.customFrom ?? undefined}
              maxDate={new Date()}
              containerClass="custom-date"
            />
          </div>
        </div>
      </Show>
    </div>
  )
}
