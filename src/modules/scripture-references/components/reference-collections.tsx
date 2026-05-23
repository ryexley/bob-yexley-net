import { splitProps } from "solid-js"
import { Combobox, type ComboboxProps } from "@/components/combobox"
import { cx } from "@/util"
import "./reference-collections.css"

export type ReferenceCollectionOption = {
  value: string
  label: string
}

export type ReferenceCollectionsProps = Omit<
  ComboboxProps<ReferenceCollectionOption>,
  | "multiple"
  | "optionValue"
  | "optionTextValue"
  | "optionLabel"
> & {
  class?: string
}

const normalizeCollectionName = (value: string) => value.trim()

export function ReferenceCollections(props: ReferenceCollectionsProps) {
  const [local, attrs] = splitProps(props, ["class"])

  return (
    <Combobox<ReferenceCollectionOption>
      multiple
      class={cx("reference-collections", local.class)}
      contentClass="reference-collections-content"
      openOnFocus
      optionValue="value"
      optionTextValue="label"
      optionLabel="label"
      onCreateOption={inputValue => {
        const value = normalizeCollectionName(inputValue)

        if (!value) {
          return null
        }

        return { value, label: value }
      }}
      isOptionEqual={(left, right) =>
        normalizeCollectionName(left.value).toLowerCase() ===
        normalizeCollectionName(right.value).toLowerCase()
      }
      {...attrs}
    />
  )
}
