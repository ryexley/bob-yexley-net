import {
  createContext,
  createEffect,
  createMemo,
  createSignal,
  onCleanup,
  Show,
  useContext,
  type Accessor,
  type ParentProps,
} from "solid-js"
import { BlipEditor } from "@/modules/blips/components/blip-editor"
import { BlipCommentEditor } from "@/modules/blips/components/blip-comment-editor"
import { BlipUpdateEditor } from "@/modules/blips/components/blip-update-editor"

type BlipComposerKind = "root" | "update" | "comment"

type BlipComposerContextValue = {
  activeKind: Accessor<BlipComposerKind | null>
  openNewRoot: () => void
  openEditRoot: (blipId: string) => void
  openNewUpdate: (rootBlipId: string) => void
  openEditUpdate: (rootBlipId: string, updateBlipId: string) => void
  openNewComment: (parentBlipId: string) => void
  openEditComment: (parentBlipId: string, commentBlipId: string) => void
  registerUpdateInlineMount: (
    rootBlipId: string,
    element: HTMLDivElement | null,
  ) => void
  requestCloseActive: () => void
  isUpdateOpenFor: (rootBlipId?: string | null) => boolean
  isCommentOpenFor: (parentBlipId?: string | null) => boolean
  closeActive: () => void
}

const BlipComposerContext = createContext<BlipComposerContextValue>()
export function BlipComposerProvider(props: ParentProps) {
  const [activeKind, setActiveKind] = createSignal<BlipComposerKind | null>(null)
  const [hasRootHost, setHasRootHost] = createSignal(false)
  const [hasUpdateHost, setHasUpdateHost] = createSignal(false)
  const [rootOpen, setRootOpen] = createSignal(false)
  const [rootTargetBlipId, setRootTargetBlipId] = createSignal<string | null>(
    null,
  )
  const [updateOpen, setUpdateOpen] = createSignal(false)
  const [updateRootBlipId, setUpdateRootBlipId] = createSignal<string | null>(
    null,
  )
  const [updateEditingUpdateId, setUpdateEditingUpdateId] = createSignal<
    string | null
  >(null)
  const [updateInlineMountRootBlipId, setUpdateInlineMountRootBlipId] =
    createSignal<string | null>(null)
  const [updateInlineMount, setUpdateInlineMount] =
    createSignal<HTMLDivElement | null>(null)
  const [updateFocusNonce, setUpdateFocusNonce] = createSignal(0)
  const [updateCloseRequestNonce, setUpdateCloseRequestNonce] = createSignal(0)
  const [commentOpen, setCommentOpen] = createSignal(false)
  const [commentParentBlipId, setCommentParentBlipId] = createSignal<string | null>(
    null,
  )
  const [commentEditingBlipId, setCommentEditingBlipId] = createSignal<string | null>(
    null,
  )
  const [commentFocusNonce, setCommentFocusNonce] = createSignal(0)

  createEffect(() => {
    if (typeof document === "undefined") {
      return
    }

    const isComposerOpen = rootOpen() || updateOpen() || commentOpen()
    document.body.classList.toggle("blip-composer-open", isComposerOpen)

    onCleanup(() => {
      document.body.classList.remove("blip-composer-open")
    })
  })

  const ensureRootHost = () => {
    if (!hasRootHost()) {
      setHasRootHost(true)
    }
  }

  const ensureUpdateHost = () => {
    if (!hasUpdateHost()) {
      setHasUpdateHost(true)
    }
  }

  const resetRootHostState = () => {
    setRootOpen(false)
  }

  const resetRootHostSessionState = () => {
    resetRootHostState()
    setRootTargetBlipId(null)
  }

  const resetUpdateHostState = () => {
    setUpdateOpen(false)
  }

  const resetUpdateHostSessionState = () => {
    resetUpdateHostState()
    setUpdateRootBlipId(null)
    setUpdateEditingUpdateId(null)
  }

  const clearUpdateInlineMountRegistry = () => {
    setUpdateInlineMountRootBlipId(null)
    setUpdateInlineMount(null)
  }

  const resetCommentHostSessionState = () => {
    setCommentOpen(false)
    setCommentParentBlipId(null)
    setCommentEditingBlipId(null)
  }

  const openNewRoot = () => {
    ensureRootHost()
    resetUpdateHostSessionState()
    resetCommentHostSessionState()
    setRootTargetBlipId(null)
    setActiveKind("root")
    setRootOpen(true)
  }

  const openEditRoot = (blipId: string) => {
    ensureRootHost()
    resetUpdateHostSessionState()
    resetCommentHostSessionState()
    setRootTargetBlipId(blipId)
    setActiveKind("root")
    setRootOpen(true)
  }

  const openNewUpdate = (rootBlipId: string) => {
    ensureUpdateHost()
    setRootOpen(false)
    setRootTargetBlipId(null)
    resetCommentHostSessionState()
    setUpdateRootBlipId(rootBlipId)
    setUpdateEditingUpdateId(null)
    setUpdateFocusNonce(previous => previous + 1)
    setActiveKind("update")
    setUpdateOpen(true)
  }

  const openEditUpdate = (rootBlipId: string, updateBlipId: string) => {
    ensureUpdateHost()
    setRootOpen(false)
    setRootTargetBlipId(null)
    resetCommentHostSessionState()
    setUpdateRootBlipId(rootBlipId)
    setUpdateEditingUpdateId(updateBlipId)
    setUpdateFocusNonce(previous => previous + 1)
    setActiveKind("update")
    setUpdateOpen(true)
  }

  const registerUpdateInlineMount = (
    rootBlipId: string,
    element: HTMLDivElement | null,
  ) => {
    if (!element && updateInlineMountRootBlipId() === rootBlipId) {
      setUpdateInlineMountRootBlipId(null)
      setUpdateInlineMount(null)
      return
    }

    if (element) {
      setUpdateInlineMountRootBlipId(rootBlipId)
      setUpdateInlineMount(element)
    }
  }

  const requestCloseActive = () => {
    const kind = activeKind()
    if (kind === "update") {
      setUpdateCloseRequestNonce(previous => previous + 1)
      return
    }

    closeActive()
  }

  const isUpdateOpenFor = (rootBlipId?: string | null) =>
    activeKind() === "update" &&
    updateOpen() &&
    Boolean(rootBlipId) &&
    updateRootBlipId() === rootBlipId

  const openNewComment = (parentBlipId: string) => {
    resetRootHostSessionState()
    resetUpdateHostSessionState()
    setCommentParentBlipId(parentBlipId)
    setCommentEditingBlipId(null)
    setCommentFocusNonce(previous => previous + 1)
    setActiveKind("comment")
    setCommentOpen(true)
  }

  const openEditComment = (parentBlipId: string, commentBlipId: string) => {
    resetRootHostSessionState()
    resetUpdateHostSessionState()
    setCommentParentBlipId(parentBlipId)
    setCommentEditingBlipId(commentBlipId)
    setCommentFocusNonce(previous => previous + 1)
    setActiveKind("comment")
    setCommentOpen(true)
  }

  const isCommentOpenFor = (parentBlipId?: string | null) =>
    activeKind() === "comment" &&
    commentOpen() &&
    Boolean(parentBlipId) &&
    commentParentBlipId() === parentBlipId

  const closeActive = () => {
    resetRootHostState()
    resetUpdateHostState()
    resetCommentHostSessionState()
    setActiveKind(null)
  }

  onCleanup(() => {
    setActiveKind(null)
    resetRootHostSessionState()
    resetUpdateHostSessionState()
    resetCommentHostSessionState()
    clearUpdateInlineMountRegistry()
  })

  const showRootHost = createMemo(() => hasRootHost())
  const showUpdateHost = createMemo(() => hasUpdateHost())

  return (
    <BlipComposerContext.Provider
      value={{
        activeKind,
        openNewRoot,
        openEditRoot,
        openNewUpdate,
        openEditUpdate,
        openNewComment,
        openEditComment,
        registerUpdateInlineMount,
        requestCloseActive,
        isUpdateOpenFor,
        isCommentOpenFor,
        closeActive,
      }}>
      {props.children}
      <Show when={showRootHost()}>
        <BlipEditor
          open={rootOpen()}
          blipId={rootTargetBlipId()}
          onPanelOpenChange={open => {
            if (open) {
              setActiveKind("root")
              setRootOpen(true)
              return
            }

            closeActive()
          }}
          close={closeActive}
        />
      </Show>
      <Show when={showUpdateHost()}>
        <BlipUpdateEditor
          open={updateOpen()}
          rootBlipId={updateRootBlipId()}
          editingUpdateId={updateEditingUpdateId()}
          desktopMount={
            updateRootBlipId() &&
            updateRootBlipId() === updateInlineMountRootBlipId()
              ? updateInlineMount()
              : null
          }
          focusNonce={updateFocusNonce()}
          closeRequestNonce={updateCloseRequestNonce()}
          onRequestClose={closeActive}
        />
      </Show>
      <Show when={commentOpen()}>
        <BlipCommentEditor
          open={commentOpen()}
          parentBlipId={commentParentBlipId()}
          editingCommentId={commentEditingBlipId()}
          focusNonce={commentFocusNonce()}
          onRequestClose={closeActive}
        />
      </Show>
    </BlipComposerContext.Provider>
  )
}

export function useBlipComposer() {
  const context = useOptionalBlipComposer()
  if (!context) {
    throw new Error("useBlipComposer must be used within a BlipComposerProvider")
  }

  return context
}

export function useOptionalBlipComposer() {
  const context = useContext(BlipComposerContext)
  return context
}
