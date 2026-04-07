import { execFile } from "node:child_process"
import { promisify } from "node:util"
import { createClient } from "@supabase/supabase-js"

const execFileAsync = promisify(execFile)
const projectRoot = new URL("..", import.meta.url)

function parseArguments(argv) {
  const options = {
    email: "",
    password: "",
    displayName: "",
  }

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index]
    const next = argv[index + 1] ?? ""

    if (argument === "--email") {
      options.email = next
      index += 1
      continue
    }

    if (argument === "--password") {
      options.password = next
      index += 1
      continue
    }

    if (argument === "--display-name") {
      options.displayName = next
      index += 1
      continue
    }
  }

  return {
    email: options.email.trim().toLowerCase(),
    password: options.password,
    displayName: options.displayName.trim(),
  }
}

function getDefaultDisplayName(email) {
  return email.split("@")[0] || "Local Superuser"
}

function parseStatusEnv(stdout) {
  const values = new Map()

  for (const line of stdout.split("\n")) {
    const match = line.match(/^([A-Z0-9_]+)="(.*)"$/)
    if (!match) {
      continue
    }

    values.set(match[1], match[2])
  }

  const apiUrl = values.get("API_URL") || ""
  const serviceRoleKey = values.get("SERVICE_ROLE_KEY") || ""

  if (!apiUrl || !serviceRoleKey) {
    throw new Error(
      "Could not determine local Supabase API_URL and SERVICE_ROLE_KEY from `supabase status -o env`.",
    )
  }

  return { apiUrl, serviceRoleKey }
}

async function getLocalSupabaseCredentials() {
  const { stdout } = await execFileAsync(
    "pnpm",
    ["exec", "supabase", "status", "-o", "env"],
    {
      cwd: projectRoot,
      env: process.env,
    },
  )

  return parseStatusEnv(stdout)
}

async function findUserByEmail(adminClient, email) {
  let page = 1

  while (true) {
    const { data, error } = await adminClient.auth.admin.listUsers({
      page,
      perPage: 200,
    })

    if (error) {
      throw error
    }

    const user = data.users.find(candidate => candidate.email?.toLowerCase() === email)
    if (user) {
      return user
    }

    if (data.users.length < 200) {
      return null
    }

    page += 1
  }
}

async function createOrUpdateUser(adminClient, { email, password, displayName }) {
  const existingUser = await findUserByEmail(adminClient, email)

  if (!existingUser) {
    const { data, error } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        display_name: displayName,
      },
    })

    if (error) {
      throw error
    }

    return {
      user: data.user,
      action: "created",
    }
  }

  const { data, error } = await adminClient.auth.admin.updateUserById(existingUser.id, {
    email,
    password,
    email_confirm: true,
    user_metadata: {
      ...(existingUser.user_metadata ?? {}),
      display_name: displayName,
    },
  })

  if (error) {
    throw error
  }

  return {
    user: data.user,
    action: "updated",
  }
}

async function promoteUser(serviceClient, { userId, displayName }) {
  const { error: roleError } = await serviceClient.from("user_roles").upsert(
    {
      user_id: userId,
      role: "superuser",
    },
    {
      onConflict: "user_id",
    },
  )

  if (roleError) {
    throw roleError
  }

  const { error: visitorError } = await serviceClient.from("visitors").upsert(
    {
      user_id: userId,
      display_name: displayName,
      status: "active",
      failed_login_attempts: 0,
    },
    {
      onConflict: "user_id",
    },
  )

  if (visitorError) {
    throw visitorError
  }
}

function printUsageAndExit() {
  console.error(
    [
      "Usage:",
      "  pnpm db:bootstrap:superuser -- --email you@example.com --password your-password --display-name \"Your Name\"",
      "",
      "Notes:",
      "  - The local Supabase stack must be running.",
      "  - The user will be created or updated, then promoted to app role `superuser`.",
    ].join("\n"),
  )

  process.exit(1)
}

async function main() {
  const options = parseArguments(process.argv.slice(2))

  if (!options.email || !options.password) {
    printUsageAndExit()
  }

  const displayName = options.displayName || getDefaultDisplayName(options.email)
  const { apiUrl, serviceRoleKey } = await getLocalSupabaseCredentials()
  const serviceClient = createClient(apiUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })

  const { user, action } = await createOrUpdateUser(serviceClient, {
    email: options.email,
    password: options.password,
    displayName,
  })

  if (!user?.id) {
    throw new Error("Supabase did not return a user id for the bootstrapped superuser.")
  }

  await promoteUser(serviceClient, {
    userId: user.id,
    displayName,
  })

  console.log(
    [
      `Local superuser ${action}: ${options.email}`,
      `Display name: ${displayName}`,
      `User id: ${user.id}`,
      "Role: superuser",
      "Visitor status: active",
    ].join("\n"),
  )
}

await main()
