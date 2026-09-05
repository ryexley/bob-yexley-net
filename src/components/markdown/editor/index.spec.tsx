import { render, screen } from "@solidjs/testing-library"
import { createSignal } from "solid-js"
import { describe, expect, it } from "vitest"
import {
  MarkdownEditor,
  type MarkdownEditorControlsProps,
} from "@/components/markdown/editor"

const StableControls = (ctx: MarkdownEditorControlsProps) => (
  <div data-testid="control-pill-scroll">
    <span data-testid="status-flag">{String(Boolean(ctx.showStatus))}</span>
    <span data-testid="can-save">{String(Boolean(ctx.statusContext?.canSave))}</span>
  </div>
)

describe("MarkdownEditor EditorControls lifetime", () => {
  it("does not remount EditorControls when status props change", () => {
    const [showStatus, setShowStatus] = createSignal(false)
    const [statusContext, setStatusContext] = createSignal({ canSave: false })

    render(() => (
      <MarkdownEditor
        instanceKey="controls-lifetime"
        EditorControls={StableControls}
        showStatus={showStatus()}
        statusContext={statusContext()}
        showStatusBar={false}
      />
    ))

    const firstNode = screen.getByTestId("control-pill-scroll")
    expect(screen.getByTestId("status-flag").textContent).toBe("false")
    expect(screen.getByTestId("can-save").textContent).toBe("false")

    setShowStatus(true)
    setStatusContext({ canSave: true })

    expect(screen.getByTestId("control-pill-scroll")).toBe(firstNode)
    expect(screen.getByTestId("status-flag").textContent).toBe("true")
    expect(screen.getByTestId("can-save").textContent).toBe("true")
  })
})
