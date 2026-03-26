import { splitProps } from "solid-js"
import { Combobox, type ComboboxProps } from "@/components/combobox"
import { slugify } from "@/util/formatters"
import { cx } from "@/util"
import "./blip-tags.css"

export type BlipTagOption = {
  value: string
  label: string
  disabled?: boolean
}

export type BlipTagsProps = Omit<
  ComboboxProps<BlipTagOption>,
  | "multiple"
  | "optionValue"
  | "optionTextValue"
  | "optionLabel"
  | "optionDisabled"
> & {
  class?: string
}

export function BlipTags(props: BlipTagsProps) {
  const [local, attrs] = splitProps(props, ["class"])
  const toCanonicalTag = (value: string) => slugify(value).trim()

  return (
    <Combobox<BlipTagOption>
      multiple
      class={cx("blip-tags", local.class)}
      contentClass="blip-tags-content"
      openOnFocus
      optionValue="value"
      optionTextValue="value"
      optionLabel="value"
      optionDisabled="disabled"
      onCreateOption={inputValue => {
        const value = toCanonicalTag(inputValue)

        if (!value) {
          return null
        }

        return { value, label: value }
      }}
      isOptionEqual={(left, right) =>
        toCanonicalTag(left.value) === toCanonicalTag(right.value)
      }
      {...attrs}
    />
  )
}
