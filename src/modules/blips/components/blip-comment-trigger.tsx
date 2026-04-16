import { Icon } from "@/components/icon"
import { useAuth } from "@/context/auth-context"
import { useVisitorAuth } from "@/modules/auth/components/visitor-auth-modal"
import { ptr } from "@/i18n"

type BlipCommentTriggerProps = {
  disabled?: boolean
  onCompose: () => void
}

const tr = ptr("blips.components.commentThread")

export function BlipCommentTrigger(props: BlipCommentTriggerProps) {
  const auth = useAuth()
  const visitorAuth = useVisitorAuth()
  const compose = () => props.onCompose()

  const handleClick = () => {
    if (props.disabled) {
      return
    }

    if (!auth.isAuthenticated()) {
      visitorAuth.open({
        onSuccess: () => {
          queueMicrotask(compose)
        },
      })
      return
    }

    compose()
  }

  return (
    <button
      type="button"
      class="reaction-trigger comment-trigger"
      aria-label={tr("actions.addComment")}
      title={tr("actions.addComment")}
      disabled={props.disabled}
      onClick={handleClick}>
      <Icon name="add_comment" />
    </button>
  )
}
