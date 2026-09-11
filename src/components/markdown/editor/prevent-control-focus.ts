/** Keep editor selection/keyboard; toolbar chrome should never take focus. */
export function preventControlFocus(event: Event) {
  event.preventDefault()
}

export function blurControl(event: Event) {
  const target = event.currentTarget
  if (target instanceof HTMLElement) {
    target.blur()
  }
}
