import { createMemo, splitProps } from "solid-js"
import { merge, cx } from "~/util"

export function Icon(props) {
  const [local, attrs] = splitProps(props, ["name", "outlined", "class"])
  const outlined = createMemo(() => local.outlined ?? true)
  const styles = createMemo(() =>
    merge(
      cx(
        "icon",
        outlined() ? "material-symbols-outlined" : "material-icons",
        "transition-all duration-250 ease-in-out text-[var(--colors-mono-07)] text-2xl",
      ),
      local.class,
    ),
  )

  return (
    <i
      class={styles()}
      aria-hidden="true"
      {...attrs}>
      {local.name}
    </i>
  )
}

export function ImagePlaceholder(props) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      height="24px"
      viewBox="0 -960 960 960"
      width="24px"
      fill="currentColor"
      {...props}>
      <path d="M200-120q-33 0-56.5-23.5T120-200v-560q0-33 23.5-56.5T200-840h560q33 0 56.5 23.5T840-760v560q0 33-23.5 56.5T760-120H200Zm0-80h560v-560H200v560Zm40-80h480L570-480 450-320l-90-120-120 160Zm-40 80v-560 560Zm140-360q25 0 42.5-17.5T400-620q0-25-17.5-42.5T340-680q-25 0-42.5 17.5T280-620q0 25 17.5 42.5T340-560Z" />
    </svg>
  )
}
