import {
  createSignal,
  createMemo,
  Show,
  type ParentProps,
} from "solid-js"
import { Button } from "@/components/button"
import {
  Dialog,
  DialogBody,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/dialog"
import { Icon } from "@/components/icon"
import { Input } from "@/components/input"
import { Pin } from "@/modules/auth/components/pin"
import { ptr } from "@/i18n"
import { generateRandomRadialGradients } from "@/util/image"
import { clsx as cx, isNotEmpty } from "@/util"
import "./visitor-auth-modal.css"

type VisitorAuthCredentials = {
  email: string
  pin: string
  displayName: string
}

type VisitorAuthResult = {
  success: boolean
  error?: string
}

type VisitorAuthModalProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: (() => void) | null
  onAuthenticate?: (
    credentials: VisitorAuthCredentials,
  ) => Promise<VisitorAuthResult> | VisitorAuthResult
}

type OpenVisitorAuthOptions = {
  onSuccess?: () => void
}

type VisitorAuthContextType = {
  open: (options?: OpenVisitorAuthOptions) => void
  close: () => void
  isOpen: () => boolean
}

type VisitorAuthMode = "login" | "signup"

const [openState, setOpenState] = createSignal(false)
const [pendingSuccessCallback, setPendingSuccessCallback] = createSignal<
  (() => void) | null
>(null)
const [authenticateHandler, setAuthenticateHandler] =
  createSignal<VisitorAuthModalProps["onAuthenticate"]>()
const tr = ptr("auth.components.visitorAuthModal")

export function VisitorAuthModal(props: VisitorAuthModalProps) {
  let nameInputRef: HTMLInputElement | undefined
  const [email, setEmail] = createSignal("")
  const [pin, setPin] = createSignal("")
  const [displayName, setDisplayName] = createSignal("")
  const [submitting, setSubmitting] = createSignal(false)
  const [error, setError] = createSignal("")
  const [mode, setMode] = createSignal<VisitorAuthMode>("login")
  const [showHelpBack, setShowHelpBack] = createSignal(false)
  const modalBackground = createMemo(() => ({
    "background-image": generateRandomRadialGradients(),
  }))
  const isSignupMode = createMemo(() => mode() === "signup")
  const disableSubmitButton = createMemo(() => submitting())
  const title = createMemo(() =>
    isSignupMode() ? tr("signup.title") : tr("login.title"),
  )
  const subtitle = createMemo(() =>
    isSignupMode() ? tr("signup.subtitle") : tr("login.subtitle"),
  )
  const submitLabel = createMemo(() => {
    if (submitting()) {
      return isSignupMode()
        ? tr("actions.signUp.submitting")
        : tr("actions.login.submitting")
    }
    return isSignupMode() ? tr("actions.signUp.default") : tr("actions.login.default")
  })

  const resetForm = () => {
    setEmail("")
    setPin("")
    setDisplayName("")
    setSubmitting(false)
    setError("")
    setMode("login")
    setShowHelpBack(false)
  }

  const closeModal = () => {
    props.onOpenChange(false)
    resetForm()
  }

  const handleSubmit = async (event: SubmitEvent) => {
    event.preventDefault()
    event.stopPropagation()
    setError("")

    const nextEmail = email().trim()
    const nextDisplayName = displayName().trim()

    if (!nextEmail || pin().length !== 6 || (isSignupMode() && !nextDisplayName)) {
      setError(
        isSignupMode()
          ? tr("errors.validation.signupRequired")
          : tr("errors.validation.loginRequired"),
      )
      return
    }

    setSubmitting(true)
    try {
      const payload = {
        mode: mode(),
        email: nextEmail,
        pin: pin(),
        displayName: isSignupMode() ? nextDisplayName : "",
      }

      // Step 4 verification flow: log captured values by mode.
      console.log("[visitor-auth] submit", payload)

      // If a real auth handler is provided, still run it and honor failures.
      if (props.onAuthenticate) {
        const result = await props.onAuthenticate({
          email: payload.email,
          pin: payload.pin,
          displayName: payload.displayName,
        })

        if (!result.success) {
          setError(result.error || tr("errors.authFailed"))
          return
        }
      }

      console.log("[visitor-auth] onSuccess callback fired")
      props.onSuccess?.()
      closeModal()
    } catch (submissionError) {
      console.error("Visitor auth submission failed:", submissionError)
      setError(tr("errors.unexpected"))
    } finally {
      setSubmitting(false)
    }
  }

  const toggleMode = () => {
    setMode(previous => (previous === "login" ? "signup" : "login"))
    setError("")
    setShowHelpBack(false)
  }

  return (
    <Dialog
      open={props.open}
      onOpenChange={open => {
        props.onOpenChange(open)
        if (!open) {
          resetForm()
        }
      }}
      class="visitor-auth-modal"
      overlayClass="visitor-auth-overlay"
      style={modalBackground()}>
      <div class="visitor-auth-shell">
        <div class="visitor-auth-card">
          <div
            class={cx("visitor-auth-flip-card", {
              "is-flipped": showHelpBack(),
            })}>
            <section class="visitor-auth-face visitor-auth-face-front">
              <DialogHeader class="visitor-auth-header">
                <div class="visitor-auth-header-row">
                  <DialogTitle class="visitor-auth-title">
                    <Icon name="shield_lock" />
                    <h2>{title()}</h2>
                  </DialogTitle>
                  <button
                    type="button"
                    class="visitor-auth-help-inline"
                    onClick={() => setShowHelpBack(true)}>
                    <span>{tr("help.trigger")}</span>
                    <Icon name="help" />
                  </button>
                </div>
                <DialogDescription class="visitor-auth-subtitle">
                  {subtitle()}
                </DialogDescription>
              </DialogHeader>
              <DialogBody>
                <form
                  class="visitor-auth-form"
                  data-mode={mode()}
                  onSubmit={handleSubmit}
                  novalidate>
                  <Input
                    label={tr("fields.email.label")}
                    type="email"
                    autocomplete="off"
                    placeholder={tr("fields.email.placeholder")}
                    value={email()}
                    onInput={event => setEmail(event.currentTarget.value)}
                    inputClass="visitor-auth-input"
                  />
                  <Pin
                    label={tr("fields.pin.label")}
                    value={pin()}
                    onChange={setPin}
                    onComplete={() => {
                      if (!isSignupMode()) {
                        return
                      }
                      queueMicrotask(() => {
                        nameInputRef?.focus()
                        nameInputRef?.select()
                      })
                    }}
                    class="visitor-auth-pin-field"
                    inputsClass="visitor-auth-pin"
                    inputClass="visitor-auth-pin-input"
                  />
                  <div
                    class={cx("visitor-auth-signup-row", {
                      "is-active": isSignupMode(),
                    })}
                    aria-hidden={!isSignupMode()}>
                    <div class="visitor-auth-signup-row-inner">
                    <Input
                      label={tr("fields.name.label")}
                      type="text"
                      autocomplete="off"
                      placeholder={tr("fields.name.placeholder")}
                      value={displayName()}
                      ref={element => {
                        nameInputRef = element
                      }}
                      onInput={event => setDisplayName(event.currentTarget.value)}
                      inputClass="visitor-auth-input"
                      required={isSignupMode()}
                      disabled={!isSignupMode()}
                    />
                    </div>
                  </div>
                  <Show when={isNotEmpty(error())}>
                    <p class="visitor-auth-error">{error()}</p>
                  </Show>
                  <DialogFooter class="visitor-auth-actions">
                    <Button
                      type="button"
                      variant="ghost"
                      label={tr("actions.cancel")}
                      class="visitor-auth-cancel"
                      onClick={closeModal}
                    />
                    <Button
                      type="submit"
                      variant="primary"
                      label={submitLabel()}
                      disabled={disableSubmitButton()}
                      class="visitor-auth-submit"
                    />
                  </DialogFooter>
                  <p class="visitor-auth-mode-switch">
                    {isSignupMode()
                      ? tr("modeSwitch.signup.prefix")
                      : tr("modeSwitch.login.prefix")}
                    <button
                      type="button"
                      class="visitor-auth-mode-switch-link"
                      onClick={toggleMode}>
                      {isSignupMode()
                        ? tr("modeSwitch.signup.link")
                        : tr("modeSwitch.login.link")}
                    </button>
                  </p>
                </form>
              </DialogBody>
            </section>
            <section class="visitor-auth-face visitor-auth-face-back">
              <div class="visitor-auth-help-back-header">
                <button
                  type="button"
                  class="visitor-auth-help-back-button"
                  onClick={() => setShowHelpBack(false)}>
                  <Icon name="arrow_back" />
                  <span>{tr("help.backAction")}</span>
                </button>
              </div>
              <p class="visitor-auth-help-back-content">
                {isSignupMode() ? tr("help.signupContent") : tr("help.loginContent")}
              </p>
            </section>
          </div>
        </div>
      </div>
    </Dialog>
  )
}

export function VisitorAuthProvider(props: ParentProps) {
  return (
    <>
      {props.children}
      <VisitorAuthModal
        open={openState()}
        onOpenChange={open => {
          setOpenState(open)
          if (!open) {
            setPendingSuccessCallback(null)
          }
        }}
        onSuccess={() => {
          pendingSuccessCallback()?.()
          setPendingSuccessCallback(null)
        }}
        onAuthenticate={authenticateHandler()}
      />
    </>
  )
}

export const useVisitorAuth = (): VisitorAuthContextType => {
  return {
    open: options => {
      setPendingSuccessCallback(() => options?.onSuccess ?? null)
      setOpenState(true)
    },
    close: () => {
      setOpenState(false)
      setPendingSuccessCallback(null)
    },
    isOpen: () => openState(),
  }
}

export const setVisitorAuthenticateHandler = (
  handler?: VisitorAuthModalProps["onAuthenticate"],
) => {
  setAuthenticateHandler(() => handler)
}
