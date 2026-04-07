import { spawn } from "node:child_process"

const pnpmCommand = process.platform === "win32" ? "pnpm.cmd" : "pnpm"
const nodeCommand = process.platform === "win32" ? "node.exe" : "node"

let appProcess = null
let shuttingDown = false

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: "inherit",
      env: process.env,
    })

    child.once("error", reject)
    child.once("exit", code => {
      if (code === 0) {
        resolve()
        return
      }

      reject(new Error(`${command} ${args.join(" ")} exited with code ${code ?? 1}`))
    })
  })
}

async function stopDatabase(exitCode = 0) {
  if (shuttingDown) {
    return
  }

  shuttingDown = true

  try {
    await run(pnpmCommand, ["db:stop"])
  } catch (error) {
    console.error("Failed to stop local Supabase cleanly:", error)
    process.exitCode = process.exitCode || 1
  } finally {
    process.exit(exitCode)
  }
}

function forwardSignal(signal) {
  if (appProcess && !appProcess.killed) {
    appProcess.kill(signal)
    return
  }

  void stopDatabase(signal === "SIGINT" ? 130 : 143)
}

process.on("SIGINT", () => {
  forwardSignal("SIGINT")
})

process.on("SIGTERM", () => {
  forwardSignal("SIGTERM")
})

try {
  await run(pnpmCommand, ["db:start"])
} catch (error) {
  console.error("Failed to start local Supabase:", error)
  process.exit(1)
}

appProcess = spawn(
  nodeCommand,
  [
    "--env-file=.env.local",
    "./node_modules/vinxi/bin/cli.mjs",
    "dev",
    "--port",
    "7808",
    "--host",
  ],
  {
    stdio: "inherit",
    env: process.env,
  },
)

appProcess.once("error", async error => {
  console.error("Failed to start app dev server:", error)
  await stopDatabase(1)
})

appProcess.once("exit", async code => {
  await stopDatabase(code ?? 0)
})
