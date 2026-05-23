import { For, Match, Show, Switch, createMemo } from "solid-js"
import { ptr } from "@/i18n"
import {
  ESV_BIBLE_URL,
  stripEsvShortCopyright,
} from "@/lib/bible/strip-esv-short-copyright"
import { parsePassageVerseBlocks } from "@/lib/bible/parse-passage-verse-markers"
import "./scripture-passage-panel.css"

const tr = ptr("blips.components.scripturePassagePanel")

export type PassageState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "loaded"; text: string }
  | { status: "error" }

type ScripturePassagePanelProps = {
  state: PassageState
  reference: string
  showReference?: boolean
}

function PassageSkeleton() {
  return (
    <div
      class="scripture-passage-panel-skeleton"
      aria-hidden="true">
      <div class="line line-1" />
      <div class="line line-2" />
      <div class="line line-3" />
      <div class="line line-4" />
    </div>
  )
}

function ScripturePassageText(props: { text: string }) {
  const blocks = createMemo(() => parsePassageVerseBlocks(props.text))

  return (
    <p class="text">
      <For each={blocks()}>
        {block => {
          if (block.type === "text") {
            return block.value
          }

          if (!block.firstWord) {
            return <sup class="verse-number">{block.verse}</sup>
          }

          return (
            <span class="verse-block">
              <span class="verse-start">
                <sup class="verse-number">{block.verse}</sup> {block.firstWord}
              </span>
              {block.rest}
            </span>
          )
        }}
      </For>
    </p>
  )
}

function ScripturePassageCopyright() {
  return (
    <footer class="scripture-passage-copyright">
      {tr("copyright", {
        esvLink: () => (
          <a
            href={ESV_BIBLE_URL}
            target="_blank"
            rel="noopener noreferrer">
            {tr("esvLinkLabel")}
          </a>
        ),
      })}
    </footer>
  )
}

export function ScripturePassagePanel(props: ScripturePassagePanelProps) {
  return (
    <div class="scripture-passage-panel">
      <Show when={props.showReference ?? true}>
        <p class="reference">{props.reference}</p>
      </Show>
      <div class="scripture-passage-scroll-body thin-scrollbar">
        <div class="scripture-passage-scroll-content">
          <Switch>
            <Match
              when={
                props.state.status === "loading" ||
                props.state.status === "idle"
              }>
              <PassageSkeleton />
            </Match>
            <Match when={props.state.status === "loaded" ? props.state : false}>
              {loaded => (
                <ScripturePassageText
                  text={stripEsvShortCopyright(loaded().text)}
                />
              )}
            </Match>
            <Match when={props.state.status === "error"}>
              <p class="error">{tr("error")}</p>
            </Match>
          </Switch>
        </div>
      </div>
      <Show when={props.state.status === "loaded"}>
        <ScripturePassageCopyright />
      </Show>
    </div>
  )
}
