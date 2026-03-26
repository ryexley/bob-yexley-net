import { createEffect, createMemo, createSignal, onCleanup } from "solid-js"
import { useNavigate } from "@solidjs/router"
import { Title } from "@solidjs/meta"
import { supabase } from "@/lib/vendor/supabase/browser"
import { Button } from "@/components/button"
import { Card } from "@/components/card"
import { Input } from "@/components/input"
import { Stack } from "@/components/stack"
import { Callout } from "@/components/callout"
import { useAuth } from "@/context/auth-context"
import { ptr } from "@/i18n"
import { pages } from "@/urls"
import { generateRandomRadialGradients } from "@/util/image"
import { isEmpty, isNotEmpty } from "@/util"
import "./login.css"

const tr = ptr("auth.views.login")

export function Login() {
  const navigate = useNavigate()
  const { isAdmin, loading } = useAuth()
  const pageBackground = createMemo(() => ({
    background: generateRandomRadialGradients(),
  }))

  const [email, setEmail] = createSignal("")
  const [password, setPassword] = createSignal("")
  const [error, setError] = createSignal("")
  const [submitting, setSubmitting] = createSignal(false)
  const disableSubmitButton = createMemo(() => {
    return submitting()
  })
  const submitButtonLabel = createMemo(() => {
    if (submitting()) {
      return tr("submitButton.submitting.label")
    }

    return disableSubmitButton()
      ? tr("submitButton.disabled.label")
      : tr("submitButton.enabled.label")
  })
  const showLoginPage = createMemo(() => {
    return !isAdmin()
  })

  createEffect(() => {
    if (loading() || !isAdmin()) {
      return
    }

    navigate(pages.home, { replace: true })
  })

  // Keep zoom behavior unchanged across the rest of the site, but lock it on
  // the login route to avoid mobile/password-manager auto-zoom persistence.
  createEffect(() => {
    if (!showLoginPage()) {
      return
    }

    if (typeof document === "undefined") {
      return
    }

    const viewport = document.querySelector("meta[name=\"viewport\"]")
    if (!(viewport instanceof HTMLMetaElement)) {
      return
    }

    const previousViewportContent = viewport.getAttribute("content")
    viewport.setAttribute(
      "content",
      "width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no",
    )

    onCleanup(() => {
      if (previousViewportContent == null) {
        viewport.removeAttribute("content")
        return
      }

      viewport.setAttribute("content", previousViewportContent)
    })
  })

  const handleSubmit = async (event?: Event) => {
    event?.preventDefault()
    event?.stopPropagation()
    setError("")
    const normalizedEmail = email().trim()
    const passwordValue = password()

    if (isEmpty(normalizedEmail) || isEmpty(passwordValue)) {
      setError(tr("loginFailedError"))
      return
    }

    setSubmitting(true)
    try {
      const { error } = await supabase.login(normalizedEmail, passwordValue)

      if (isNotEmpty(error)) {
        throw error
      }

      navigate(pages.home)
    } catch (error) {
      setError(typeof error === "string" ? error : tr("loginFailedError"))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
      <Title>{tr("pageTitle")}</Title>
      {showLoginPage() ? (
        <main
          class="login-page"
          style={pageBackground()}>
          <Stack
            gap="1rem"
            class="login-shell">
            <Card
              icon="shield_lock"
              title={tr("loginFormCardTitle")}
              subtitle={tr("loginFormCardDescription")}
              class="login-card">
              {isNotEmpty(error()) ? (
                <Callout
                  variant="error"
                  content={error()}
                  class="login-error"
                />
              ) : null}
              <form
                method="post"
                onSubmit={event => void handleSubmit(event)}
                novalidate>
                <Stack fullWidth>
                  <Input
                    label={tr("emailFieldLabel")}
                    type="email"
                    autocomplete="username"
                    placeholder={tr("emailFieldPlaceholder")}
                    value={email()}
                    onInput={e => setEmail(e.currentTarget.value)}
                  />
                  <Input
                    label={tr("passwordFieldLabel")}
                    type="password"
                    autocomplete="current-password"
                    placeholder={tr("passwordFieldPlaceholder")}
                    value={password()}
                    onInput={e => setPassword(e.currentTarget.value)}
                    inputClass="login-password-input"
                  />
                  <Stack class="login-form-actions">
                    <Button
                      type="submit"
                      disabled={disableSubmitButton()}
                      variant="primary"
                      size="md"
                      label={submitButtonLabel()}
                      class="login-submit-button"
                    />
                  </Stack>
                </Stack>
              </form>
            </Card>
            <a
              href={pages.home}
              class="login-home-link">
              {tr("returnHomeLink")}
            </a>
          </Stack>
        </main>
      ) : null}
    </>
  )
}
