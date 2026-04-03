const enterMark = function (this: any, token: any) {
  this.enter({ type: "mark", children: [] }, token)
}

const exitMark = function (this: any, token: any) {
  this.exit(token)
}

const handleMark = function (node: any, _: any, context: any, info: any) {
  const exit = (context as any).enter("mark")
  const tracker = context.createTracker(info)
  let value = tracker.move("==")
  value += tracker.move(
    context.containerPhrasing(node, {
      after: "==",
      before: value,
      ...tracker.current(),
    }),
  )
  value += tracker.move("==")
  exit()
  return value
}

export const highlightFromMarkdown = {
  canContainEols: ["mark"],
  enter: { mark: enterMark },
  exit: { mark: exitMark },
}

export const highlightToMarkdown = {
  unsafe: [{ character: "=", inConstruct: "phrasing" }],
  handlers: { mark: handleMark },
}
