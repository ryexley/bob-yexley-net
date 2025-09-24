import { createMemo, createSignal } from "solid-js"
import { useNavigate } from "@solidjs/router"
import { Title } from "@solidjs/meta"
import { supabase } from "~/lib/vendor/supabase"
import { Card } from "@/components/card"
import { Input } from "@/components/input"
import { Stack } from "@/components/stack"
import { Button } from "@/components/button"
import { Callout } from "@/components/callout"
import { ptr } from "@/i18n"
import { pages } from "@/urls"
import { generateRandomRadialGradients } from "@/util/image"
import { isEmpty, isNotEmpty } from "@/util"

const tr = ptr("auth.views.login")

export function Login() {
  const navigate = useNavigate()
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

  const handleSubmit = async (e: Event) => {
    e?.preventDefault()
    e?.stopPropagation()

    if (
      isEmpty(email()) ||
      email() !== "bob@yexley.net" ||
      isEmpty(password())
    ) {
      setError("Invalid credentials")
    }

    setSubmitting(true)
    try {
      const { data: user, error } = await supabase.login(email(), password())

      if (isNotEmpty(error)) {
        throw error
      }

      navigate(pages.home)
    } catch {
      setError(tr("loginFailedError"))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
      <Title>{tr("pageTitle")}</Title>
      <main
        class="h-screen w-screen flex items-center justify-center"
        style={pageBackground()}>
        <Stack
          gap="1rem"
          class="items-center w-[24rem]">
          <Card
            icon="shield_lock"
            title={tr("loginFormCardTitle")}
            subtitle={tr("loginFormCardDescription")}
            class="p-8 bg-black/25 backdrop-blur-md">
            {isNotEmpty(error()) ? (
              <Callout
                variant="error"
                content={error()}
                class="mb-2"
              />
            ) : null}
            <form
              onSubmit={handleSubmit}
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
                  inputClass="tracking-[0.25rem]"
                />
                <Stack class="mt-4 w-full">
                  <Button
                    type="submit"
                    disabled={disableSubmitButton()}
                    class="w-full"
                    label={submitButtonLabel()}
                  />
                </Stack>
              </Stack>
            </form>
          </Card>
          <a
            href={pages.home}
            class="text-sm text-[var(--colors-mono-09)]! hover:text-[var(--colors-links)]! transition-[var(--transitions-primary)] flex p-2!">
            {tr("returnHomeLink")}
          </a>
        </Stack>
      </main>
    </>
  )
}
