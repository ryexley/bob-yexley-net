import { createContext, For, Show, useContext, type JSX } from "solid-js"
import { Portal } from "solid-js/web"
import { Toast, toaster } from "@kobalte/core/toast"
import { Icon } from "@/components/icon"
import { ptr, tr } from "@/i18n"
import { isEmpty, isNotEmpty } from "@/util"
import "./notification.css"

type NotificationVariant = "message" | "info" | "success" | "warn" | "error"
type NotificationType = "foreground" | "background"
type NotificationRenderable = string | JSX.Element | (() => JSX.Element)

type NotifyOptions = {
  variant?: NotificationVariant
  type?: NotificationType
  title?: string
  content?: NotificationRenderable
  actions?: Array<() => JSX.Element>
  actionsAltText?: string
  showCloseButton?: boolean
  duration?: number
  persistent?: boolean
}

type NotifyApi = {
  message: (options: NotifyOptions) => number
  info: (options: NotifyOptions) => number
  success: (options: NotifyOptions) => number
  warn: (options: NotifyOptions) => number
  error: (options: NotifyOptions) => number
  dismiss: (id: number) => void
  clear: () => void
}

const DEFAULT_DURATION = 10_000
const trNotification = ptr("shared.components.notification")
const missingProviderFallback: NotifyApi = {
  message: () => -1,
  info: () => -1,
  success: () => -1,
  warn: () => -1,
  error: () => -1,
  dismiss: () => undefined,
  clear: () => undefined,
}
const NotificationContext = createContext<NotifyApi>(missingProviderFallback)

const variantIconMap: Record<NotificationVariant, string> = {
  message: "notifications",
  info: "info",
  success: "check_circle",
  warn: "warning",
  error: "cancel",
}

const looksLikeTranslationKey = (value: string) => /\.(?!\s|$)/.test(value)

const resolveCopy = (value?: string): string => {
  if (isEmpty(value)) {
    return ""
  }

  if (!looksLikeTranslationKey(value!)) {
    return value!
  }

  return tr(value!) as string
}

const renderContentValue = (content?: NotificationRenderable) => {
  if (typeof content === "function") {
    return content()
  }

  if (typeof content === "string") {
    return resolveCopy(content)
  }

  return content ?? null
}

function NotificationToast(props: {
  toastId: number
  variant: NotificationVariant
  type: NotificationType
  title?: string
  content?: NotificationRenderable
  actions?: Array<() => JSX.Element>
  actionsAltText?: string
  showCloseButton?: boolean
  duration?: number
  persistent?: boolean
}) {
  const resolvedTitle = () => resolveCopy(props.title)
  const resolvedActionsLabel = () =>
    resolveCopy(
      props.actionsAltText ?? trNotification("actions.actionsGroupAriaLabel"),
    )

  return (
    <Toast
      toastId={props.toastId}
      class="notification"
      classList={{
        "no-title": isEmpty(resolvedTitle()),
        [`variant-${props.variant}`]: true,
      }}
      priority={props.type === "background" ? "low" : "high"}
      duration={props.duration ?? DEFAULT_DURATION}
      persistent={props.persistent}>
      <div class="notification-indicator">
        <Icon
          name={variantIconMap[props.variant]}
          class="notification-indicator-icon"
        />
      </div>
      <div class="notification-main">
        <Show when={isNotEmpty(resolvedTitle())}>
          <Toast.Title class="notification-title">{resolvedTitle()}</Toast.Title>
        </Show>
        <Toast.Description class="notification-content">
          {renderContentValue(props.content)}
        </Toast.Description>
        <Show when={(props.actions?.length ?? 0) > 0}>
          <div
            class="notification-actions"
            aria-label={resolvedActionsLabel()}>
            <For each={props.actions}>
              {action => <div class="notification-action">{action()}</div>}
            </For>
          </div>
        </Show>
      </div>
      <Show when={props.showCloseButton !== false}>
        <Toast.CloseButton
          class="notification-close"
          aria-label={trNotification("actions.closeAriaLabel")}>
          <Icon name="close" />
        </Toast.CloseButton>
      </Show>
    </Toast>
  )
}

export function NotificationProvider(props: { children: JSX.Element }) {
  const show = (options: NotifyOptions) =>
    toaster.show(
      toastProps => (
        <NotificationToast
          toastId={toastProps.toastId}
          variant={options.variant ?? "message"}
          type={options.type ?? "foreground"}
          title={options.title}
          content={options.content}
          actions={options.actions}
          actionsAltText={options.actionsAltText}
          showCloseButton={options.showCloseButton}
          duration={options.duration}
          persistent={options.persistent}
        />
      ),
    )

  const notify: NotifyApi = {
    message: options => show(options),
    info: options => show({ ...options, variant: "info" }),
    success: options => show({ ...options, variant: "success" }),
    warn: options => show({ ...options, variant: "warn" }),
    error: options => show({ ...options, variant: "error" }),
    dismiss: id => toaster.dismiss(id),
    clear: () => toaster.clear(),
  }

  return (
    <NotificationContext.Provider value={notify}>
      {props.children}
      <Portal>
        <Toast.Region
          class="notification-region"
          pauseOnInteraction
          pauseOnPageIdle
          swipeDirection="right"
          limit={5}
          aria-label={trNotification("region.ariaLabel", { hotkey: "Alt+T" })}>
          <Toast.List class="notification-list" />
        </Toast.Region>
      </Portal>
    </NotificationContext.Provider>
  )
}

export function useNotify() {
  const context = useContext(NotificationContext)

  if (context === missingProviderFallback) {
    console.warn("useNotify called outside NotificationProvider; using no-op.")
  }

  return context
}
