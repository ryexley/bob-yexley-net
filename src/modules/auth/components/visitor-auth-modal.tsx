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

const [openState, setOpenState] = createSignal(false)
const [pendingSuccessCallback, setPendingSuccessCallback] = createSignal<
  (() => void) | null
>(null)
const [authenticateHandler, setAuthenticateHandler] =
  createSignal<VisitorAuthModalProps["onAuthenticate"]>()

export function VisitorAuthModal(props: VisitorAuthModalProps) {
  let nameInputRef: HTMLInputElement | undefined
  const [email, setEmail] = createSignal("")
  const [pin, setPin] = createSignal("")
  const [displayName, setDisplayName] = createSignal("")
  const [submitting, setSubmitting] = createSignal(false)
  const [error, setError] = createSignal("")
  const [showHelpBack, setShowHelpBack] = createSignal(false)
  const modalBackground = createMemo(() => ({
    "background-image": generateRandomRadialGradients(),
  }))
  const disableSubmitButton = createMemo(() => submitting())

  const resetForm = () => {
    setEmail("")
    setPin("")
    setDisplayName("")
    setSubmitting(false)
    setError("")
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

    if (!nextEmail || !nextDisplayName || pin().length !== 6) {
      setError("Please provide email, display name, and a 6-digit PIN.")
      return
    }

    if (!props.onAuthenticate) {
      setError("Visitor auth flow is not wired yet.")
      return
    }

    setSubmitting(true)
    try {
      const result = await props.onAuthenticate({
        email: nextEmail,
        pin: pin(),
        displayName: nextDisplayName,
      })

      if (!result.success) {
        setError(result.error || "Unable to authenticate.")
        return
      }

      props.onSuccess?.()
      closeModal()
    } catch (submissionError) {
      console.error("Visitor auth submission failed:", submissionError)
      setError("Unable to authenticate right now.")
    } finally {
      setSubmitting(false)
    }
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
                    <h2>Login</h2>
                  </DialogTitle>
                  <button
                    type="button"
                    class="visitor-auth-help-inline"
                    onClick={() => setShowHelpBack(true)}>
                    <span>What's this?</span>
                    <Icon name="help" />
                  </button>
                </div>
                <DialogDescription class="visitor-auth-subtitle">
                  Enter your credentials to interact with the site.
                </DialogDescription>
              </DialogHeader>
              <DialogBody>
                <form
                  class="visitor-auth-form"
                  onSubmit={handleSubmit}
                  novalidate>
                  <Input
                    label="Email"
                    type="email"
                    autocomplete="off"
                    placeholder="name@email.com"
                    value={email()}
                    onInput={event => setEmail(event.currentTarget.value)}
                    inputClass="visitor-auth-input"
                  />
                  <Pin
                    label="PIN"
                    value={pin()}
                    onChange={setPin}
                    onComplete={() => {
                      queueMicrotask(() => {
                        nameInputRef?.focus()
                        nameInputRef?.select()
                      })
                    }}
                    class="visitor-auth-pin-field"
                    inputsClass="visitor-auth-pin"
                    inputClass="visitor-auth-pin-input"
                  />
                  <Input
                    label="Name"
                    type="text"
                    autocomplete="off"
                    placeholder="How should others see your name?"
                    value={displayName()}
                    ref={element => {
                      nameInputRef = element
                    }}
                    onInput={event => setDisplayName(event.currentTarget.value)}
                    inputClass="visitor-auth-input"
                    required
                  />
                  <Show when={isNotEmpty(error())}>
                    <p class="visitor-auth-error">{error()}</p>
                  </Show>
                  <DialogFooter class="visitor-auth-actions">
                    <Button
                      type="button"
                      variant="ghost"
                      label="Nevermind"
                      class="visitor-auth-cancel"
                      onClick={closeModal}
                    />
                    <Button
                      type="submit"
                      variant="primary"
                      label={submitting() ? "Logging in..." : "Login"}
                      disabled={disableSubmitButton()}
                      class="visitor-auth-submit"
                    />
                  </DialogFooter>
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
                  <span>Back</span>
                </button>
              </div>
              <p class="visitor-auth-help-back-content">
                We need to know who you are, and we want to not let other people
                pretend to be you. Enter your email address, a PIN number you
                want to authenticate with (you need to be able to remember this
                for later), and a name so others know who you are.
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
