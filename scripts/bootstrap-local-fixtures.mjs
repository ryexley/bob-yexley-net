import { execFile } from "node:child_process"
import { promisify } from "node:util"
import { createClient } from "@supabase/supabase-js"
import { fileURLToPath } from "node:url"

const execFileAsync = promisify(execFile)
const projectRoot = fileURLToPath(new URL("..", import.meta.url))
const VISITOR_PIN = "123456"

const AUTHOR_ACCOUNTS = [
  {
    slug: "albus-dumbledore",
    displayName: "Albus Dumbledore",
    email: "albus.dumbledore@local.test",
    role: "superuser",
    notes: "Fixture superuser author account",
  },
  {
    slug: "minerva-mcgonagall",
    displayName: "Minerva McGonagall",
    email: "minerva.mcgonagall@local.test",
    role: "admin",
    notes: "Fixture admin author account",
  },
]

const VISITOR_ACCOUNTS = [
  { slug: "harry-potter", displayName: "Harry Potter", email: "harry.potter@local.test", role: "visitor", notes: "Gryffindor fixture account" },
  { slug: "hermione-granger", displayName: "Hermione Granger", email: "hermione.granger@local.test", role: "visitor", notes: "Gryffindor fixture account" },
  { slug: "ron-weasley", displayName: "Ron Weasley", email: "ron.weasley@local.test", role: "visitor", notes: "Gryffindor fixture account" },
  { slug: "ginny-weasley", displayName: "Ginny Weasley", email: "ginny.weasley@local.test", role: "visitor", notes: "Gryffindor fixture account" },
  { slug: "luna-lovegood", displayName: "Luna Lovegood", email: "luna.lovegood@local.test", role: "visitor", notes: "Ravenclaw fixture account" },
  { slug: "neville-longbottom", displayName: "Neville Longbottom", email: "neville.longbottom@local.test", role: "visitor", notes: "Gryffindor fixture account" },
  { slug: "draco-malfoy", displayName: "Draco Malfoy", email: "draco.malfoy@local.test", role: "visitor", notes: "Slytherin fixture account" },
  { slug: "cedric-diggory", displayName: "Cedric Diggory", email: "cedric.diggory@local.test", role: "visitor", notes: "Hufflepuff fixture account" },
]

function parseArguments(argv) {
  let mode = "all"
  for (const argument of argv) {
    if (argument.startsWith("--mode=")) {
      mode = argument.slice("--mode=".length)
    }
  }
  if (mode !== "all" && mode !== "visitors") {
    throw new Error(`Unsupported mode: ${mode}`)
  }
  return { mode }
}

function parseStatusEnv(stdout) {
  const values = new Map()
  for (const line of stdout.split("\n")) {
    const match = line.match(/^([A-Z0-9_]+)="(.*)"$/)
    if (match) {
      values.set(match[1], match[2])
    }
  }
  const apiUrl = values.get("API_URL") || ""
  const serviceRoleKey = values.get("SERVICE_ROLE_KEY") || ""
  if (!apiUrl || !serviceRoleKey) {
    throw new Error("Could not determine local Supabase API_URL and SERVICE_ROLE_KEY from `supabase status -o env`.")
  }
  return { apiUrl, serviceRoleKey }
}

async function getLocalSupabaseCredentials() {
  const { stdout } = await execFileAsync("pnpm", ["exec", "supabase", "status", "-o", "env"], {
    cwd: projectRoot,
    env: process.env,
  })
  return parseStatusEnv(stdout)
}

async function findUserByEmail(adminClient, email) {
  let page = 1
  while (true) {
    const { data, error } = await adminClient.auth.admin.listUsers({ page, perPage: 200 })
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

function formatBlipId(isoString) {
  return isoString.replaceAll(/[-:.TZ]/g, "").slice(0, 17)
}

function repeatSentence(sentence, count) {
  return Array.from({ length: count }, () => sentence).join(" ")
}

function buildAuthoredFixtureData() {
  const roots = []
  const updates = []
  const tagAssignments = []
  const tagSets = [
    ["technology", "ai", "software-development", "web"],
    ["family", "parenting", "kids", "lessons-learned"],
    ["football", "sports", "hunter", "7-on-7"],
    ["baseball", "softball", "charis", "kids"],
    ["faith", "scripture", "church-notes", "quotes"],
    ["books", "reading", "culture", "personal"],
    ["music", "lyrics", "movies", "random"],
    ["basketball", "college-sports", "go-vols", "tennessee"],
  ]

  for (let index = 0; index < 72; index += 1) {
    const createdAt = new Date(Date.UTC(2026, 0, 1, 14, 0, 0) + index * 8 * 60 * 60 * 1000).toISOString()
    const updatedAt = new Date(new Date(createdAt).getTime() + ((index % 5) + 1) * 7 * 60 * 1000).toISOString()
    const ownerSlug = index % 2 === 0 ? "albus-dumbledore" : "minerva-mcgonagall"
    const id = formatBlipId(createdAt)
    const title = (index + 1) % 9 === 0 ? `Fixture note ${index + 1}` : null
    const content = [
      `Fixture blip ${index + 1}. Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.`,
      index % 2 === 0
        ? repeatSentence("Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.", 2 + (index % 3))
        : null,
      index % 3 === 0
        ? repeatSentence("Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur.", 2 + (index % 4))
        : null,
      index % 5 === 0
        ? repeatSentence("Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.", 3)
        : null,
    ].filter(Boolean).join("\n\n")

    roots.push({
      id,
      ownerSlug,
      parentId: null,
      title,
      content,
      createdAt,
      updatedAt,
      blipType: "root",
    })

    tagAssignments.push({
      blipId: id,
      tags: tagSets[index % tagSets.length],
      createdAt,
    })
  }

  for (let index = 0; index < 24; index += 1) {
    const createdAt = new Date(Date.UTC(2026, 1, 15, 10, 0, 0) + index * 5 * 60 * 60 * 1000).toISOString()
    const updatedAt = new Date(new Date(createdAt).getTime() + ((index % 4) + 1) * 5 * 60 * 1000).toISOString()
    const ownerSlug = index % 2 === 0 ? "albus-dumbledore" : "minerva-mcgonagall"
    const parent = roots[index]
    const id = formatBlipId(createdAt)
    const content = [
      `Update ${index + 1} for the seeded fixture set. Lorem ipsum dolor sit amet, consectetur adipiscing elit.`,
      repeatSentence("Integer nec odio. Praesent libero. Sed cursus ante dapibus diam. Sed nisi.", 1 + (index % 3)),
      index % 4 === 0
        ? repeatSentence("Nulla quis sem at nibh elementum imperdiet. Duis sagittis ipsum. Praesent mauris.", 2)
        : null,
    ].filter(Boolean).join("\n\n")

    updates.push({
      id,
      ownerSlug,
      parentId: parent.id,
      title: null,
      content,
      createdAt,
      updatedAt,
      blipType: "update",
    })

    tagAssignments.push({
      blipId: id,
      tags: [["daily-muster", "blips"], ["personal", "life"], ["sports", "family"], ["phoenix", "technology"], ["faith", "quotes"], ["random", "culture"]][index % 6],
      createdAt,
    })
  }

  const extraThreadedUpdates = [
    {
      parentIndex: 0,
      ownerSlug: "minerva-mcgonagall",
      createdAt: "2026-02-15T12:30:00.000Z",
      updatedAt: "2026-02-15T12:36:00.000Z",
      content:
        "A second seeded update gives this thread a little more history so testing multi-update rendering feels more realistic.",
      tags: ["daily-muster", "personal"],
    },
    {
      parentIndex: 1,
      ownerSlug: "albus-dumbledore",
      createdAt: "2026-02-15T17:20:00.000Z",
      updatedAt: "2026-02-15T17:26:00.000Z",
      content:
        "This follow-up update exists specifically to give another root blip more than one child update in the local fixture set.",
      tags: ["personal", "life"],
    },
    {
      parentIndex: 2,
      ownerSlug: "minerva-mcgonagall",
      createdAt: "2026-02-15T22:10:00.000Z",
      updatedAt: "2026-02-15T22:18:00.000Z",
      content:
        "A later update on the same root helps exercise sorting, counts, and thread affordances in the UI.",
      tags: ["sports", "family"],
    },
    {
      parentIndex: 3,
      ownerSlug: "albus-dumbledore",
      createdAt: "2026-02-16T03:40:00.000Z",
      updatedAt: "2026-02-16T03:46:00.000Z",
      content:
        "This extra child blip gives one more seeded thread enough depth to test expand-and-collapse interactions.",
      tags: ["phoenix", "technology"],
    },
    {
      parentIndex: 4,
      ownerSlug: "minerva-mcgonagall",
      createdAt: "2026-02-16T08:25:00.000Z",
      updatedAt: "2026-02-16T08:31:00.000Z",
      content:
        "Another follow-up update rounds out the multi-update examples among the larger lorem ipsum fixture roots.",
      tags: ["faith", "quotes"],
    },
    {
      parentIndex: 5,
      ownerSlug: "albus-dumbledore",
      createdAt: "2026-02-16T13:15:00.000Z",
      updatedAt: "2026-02-16T13:21:00.000Z",
      content:
        "This additional seeded update is mostly here to make sure several roots visibly have more than one update.",
      tags: ["random", "culture"],
    },
  ].map(update => ({
    id: formatBlipId(update.createdAt),
    parentId: roots[update.parentIndex].id,
    ownerSlug: update.ownerSlug,
    title: null,
    content: update.content,
    createdAt: update.createdAt,
    updatedAt: update.updatedAt,
    blipType: "update",
    tags: update.tags,
  }))

  updates.push(...extraThreadedUpdates)
  for (const update of extraThreadedUpdates) {
    tagAssignments.push({
      blipId: update.id,
      tags: update.tags,
      createdAt: update.createdAt,
    })
  }

  const visitorRoots = [
    {
      ownerSlug: "albus-dumbledore",
      createdAt: "2026-04-01T15:00:00.000Z",
      updatedAt: "2026-04-01T15:20:00.000Z",
      content: "Albus is using the local fixture set to make sure the app has realistic authored content for development.",
      tags: ["blips", "personal", "random"],
    },
    {
      ownerSlug: "minerva-mcgonagall",
      createdAt: "2026-04-01T18:00:00.000Z",
      updatedAt: "2026-04-01T18:18:00.000Z",
      content: "Minerva cares about deterministic fixtures, reproducible environments, and making sure every reset starts cleanly.",
      tags: ["technology", "software-development", "books"],
    },
    {
      ownerSlug: "albus-dumbledore",
      createdAt: "2026-04-02T12:00:00.000Z",
      updatedAt: "2026-04-02T12:11:00.000Z",
      content: "This authored fixture gives the local environment more realistic public content to browse, filter, and react to.",
      tags: ["family", "personal", "kids"],
    },
    {
      ownerSlug: "minerva-mcgonagall",
      createdAt: "2026-04-02T15:00:00.000Z",
      updatedAt: "2026-04-02T15:14:00.000Z",
      content: "Another authored fixture post with a different tag mix helps exercise the editor and feed views during local development.",
      tags: ["sports", "culture", "random"],
    },
    {
      ownerSlug: "albus-dumbledore",
      createdAt: "2026-04-03T09:00:00.000Z",
      updatedAt: "2026-04-03T09:16:00.000Z",
      content: "This fixture exists mostly so the local environment does not feel too uniform when browsing around the app.",
      tags: ["quotes", "life", "personal"],
    },
    {
      ownerSlug: "minerva-mcgonagall",
      createdAt: "2026-04-03T16:00:00.000Z",
      updatedAt: "2026-04-03T16:22:00.000Z",
      content: "This final authored fixture rounds out the local seed set with one more straightforward published blip.",
      tags: ["family", "lessons-learned", "life"],
    },
  ].map(blip => ({
    id: formatBlipId(blip.createdAt),
    parentId: null,
    title: null,
    content: blip.content,
    createdAt: blip.createdAt,
    updatedAt: blip.updatedAt,
    blipType: "root",
    ownerSlug: blip.ownerSlug,
    tags: blip.tags,
  }))

  const visitorUpdates = [
    {
      ownerSlug: "albus-dumbledore",
      parentId: visitorRoots[0].id,
      createdAt: "2026-04-01T16:10:00.000Z",
      updatedAt: "2026-04-01T16:10:00.000Z",
      content: "This update gives the fixture set at least one authored root blip with a nested update thread.",
    },
    {
      ownerSlug: "minerva-mcgonagall",
      parentId: visitorRoots[1].id,
      createdAt: "2026-04-01T19:05:00.000Z",
      updatedAt: "2026-04-01T19:08:00.000Z",
      content: "A follow-up update keeps the local graph views interesting and tests update ordering.",
    },
    {
      ownerSlug: "albus-dumbledore",
      parentId: visitorRoots[2].id,
      createdAt: "2026-04-02T12:45:00.000Z",
      updatedAt: "2026-04-02T12:47:00.000Z",
      content: "This authored update exists mainly to prove the local reset/bootstrap flow still leaves update content available.",
    },
    {
      ownerSlug: "minerva-mcgonagall",
      parentId: visitorRoots[4].id,
      createdAt: "2026-04-03T10:15:00.000Z",
      updatedAt: "2026-04-03T10:20:00.000Z",
      content: "One more authored update gives the local environment a small but useful variety of threaded content.",
    },
    {
      ownerSlug: "minerva-mcgonagall",
      parentId: visitorRoots[0].id,
      createdAt: "2026-04-01T17:05:00.000Z",
      updatedAt: "2026-04-01T17:09:00.000Z",
      content: "A second authored update on this root makes the spotlight fixture thread feel more like a real ongoing conversation.",
    },
    {
      ownerSlug: "albus-dumbledore",
      parentId: visitorRoots[1].id,
      createdAt: "2026-04-01T20:10:00.000Z",
      updatedAt: "2026-04-01T20:14:00.000Z",
      content: "This extra follow-up gives another featured root multiple updates for testing summary counts and ordering.",
    },
    {
      ownerSlug: "minerva-mcgonagall",
      parentId: visitorRoots[2].id,
      createdAt: "2026-04-02T13:25:00.000Z",
      updatedAt: "2026-04-02T13:28:00.000Z",
      content: "Another child update here helps verify that the authored spotlight cards can surface deeper thread history too.",
    },
    {
      ownerSlug: "albus-dumbledore",
      parentId: visitorRoots[4].id,
      createdAt: "2026-04-03T11:05:00.000Z",
      updatedAt: "2026-04-03T11:08:00.000Z",
      content: "Adding one more update to this featured root provides a cleaner proof case for multi-update tooltip and detail testing.",
    },
  ].map(blip => ({
    id: formatBlipId(blip.createdAt),
    title: null,
    blipType: "update",
    ...blip,
  }))

  const allRoots = [...roots, ...visitorRoots]
  const allBlips = [...allRoots, ...updates, ...visitorUpdates]
  const rootIds = allRoots.map(blip => blip.id)
  const reactions = [
    { blipId: rootIds[0], ownerSlug: "harry-potter", emoji: "👍" },
    { blipId: rootIds[0], ownerSlug: "hermione-granger", emoji: "👍" },
    { blipId: rootIds[0], ownerSlug: "ron-weasley", emoji: "👍" },
    { blipId: rootIds[0], ownerSlug: "harry-potter", emoji: "🔥" },
    { blipId: rootIds[0], ownerSlug: "ginny-weasley", emoji: "⚡" },
    { blipId: rootIds[1], ownerSlug: "hermione-granger", emoji: "🔥" },
    { blipId: rootIds[1], ownerSlug: "luna-lovegood", emoji: "🤔" },
    { blipId: rootIds[1], ownerSlug: "neville-longbottom", emoji: "🙌" },
    { blipId: rootIds[2], ownerSlug: "ron-weasley", emoji: "👍" },
    { blipId: rootIds[2], ownerSlug: "harry-potter", emoji: "🏈" },
    { blipId: rootIds[2], ownerSlug: "draco-malfoy", emoji: "👎" },
    { blipId: rootIds[3], ownerSlug: "ginny-weasley", emoji: "🔥" },
    { blipId: rootIds[3], ownerSlug: "ginny-weasley", emoji: "💯" },
    { blipId: rootIds[3], ownerSlug: "cedric-diggory", emoji: "🔥" },
    { blipId: rootIds[3], ownerSlug: "harry-potter", emoji: "🔥" },
    { blipId: rootIds[4], ownerSlug: "luna-lovegood", emoji: "👏" },
    { blipId: rootIds[4], ownerSlug: "hermione-granger", emoji: "✨" },
    { blipId: rootIds[4], ownerSlug: "neville-longbottom", emoji: "💚" },
    { blipId: rootIds[5], ownerSlug: "neville-longbottom", emoji: "👍" },
    { blipId: rootIds[5], ownerSlug: "ron-weasley", emoji: "😄" },
    { blipId: rootIds[6], ownerSlug: "draco-malfoy", emoji: "😏" },
    { blipId: rootIds[6], ownerSlug: "draco-malfoy", emoji: "👀" },
    { blipId: rootIds[6], ownerSlug: "luna-lovegood", emoji: "🤯" },
    { blipId: rootIds[7], ownerSlug: "cedric-diggory", emoji: "👏" },
    { blipId: rootIds[7], ownerSlug: "ginny-weasley", emoji: "🎉" },
    { blipId: visitorRoots[0].id, ownerSlug: "hermione-granger", emoji: "🔥" },
    { blipId: visitorRoots[0].id, ownerSlug: "ron-weasley", emoji: "🔥" },
    { blipId: visitorRoots[0].id, ownerSlug: "luna-lovegood", emoji: "🔥" },
    { blipId: visitorRoots[0].id, ownerSlug: "harry-potter", emoji: "⚡" },
    { blipId: visitorRoots[1].id, ownerSlug: "harry-potter", emoji: "👏" },
    { blipId: visitorRoots[1].id, ownerSlug: "harry-potter", emoji: "🤔" },
    { blipId: visitorRoots[1].id, ownerSlug: "cedric-diggory", emoji: "👏" },
    { blipId: visitorRoots[2].id, ownerSlug: "ginny-weasley", emoji: "🔥" },
    { blipId: visitorRoots[2].id, ownerSlug: "draco-malfoy", emoji: "😮" },
    { blipId: visitorRoots[4].id, ownerSlug: "neville-longbottom", emoji: "👍" },
    { blipId: visitorRoots[4].id, ownerSlug: "hermione-granger", emoji: "👍" },
    { blipId: visitorRoots[5].id, ownerSlug: "cedric-diggory", emoji: "👏" },
    { blipId: visitorRoots[5].id, ownerSlug: "ron-weasley", emoji: "👏" },
  ]

  return { allBlips, tagAssignments, reactions, allFixtureBlipIds: allBlips.map(blip => blip.id) }
}

const FIXTURE_DATA = buildAuthoredFixtureData()

async function createOrUpdateAccounts(serviceClient, accounts, password) {
  const usersBySlug = new Map()
  for (const account of accounts) {
    const existingUser = await findUserByEmail(serviceClient, account.email)
    const payload = {
      email: account.email,
      password,
      email_confirm: true,
      user_metadata: {
        display_name: account.displayName,
      },
    }
    const result = existingUser
      ? await serviceClient.auth.admin.updateUserById(existingUser.id, payload)
      : await serviceClient.auth.admin.createUser(payload)
    if (result.error) {
      throw result.error
    }
    const user = result.data.user
    if (!user?.id) {
      throw new Error(`Missing user id for ${account.email}`)
    }
    usersBySlug.set(account.slug, { ...account, userId: user.id })
  }
  return usersBySlug
}

async function hydrateProfilesAndRoles(serviceClient, accountsBySlug) {
  const visitorRows = [...accountsBySlug.values()].map(account => ({
    user_id: account.userId,
    display_name: account.displayName,
    status: "active",
    failed_login_attempts: 0,
    notes: account.notes,
  }))
  const { error: visitorsError } = await serviceClient.from("visitors").upsert(visitorRows, { onConflict: "user_id" })
  if (visitorsError) {
    throw visitorsError
  }

  const roleRows = [...accountsBySlug.values()].map(account => ({
    user_id: account.userId,
    role: account.role,
  }))
  const { error: rolesError } = await serviceClient.from("user_roles").upsert(roleRows, { onConflict: "user_id" })
  if (rolesError) {
    throw rolesError
  }

  const { data: visitors, error: visitorLookupError } = await serviceClient
    .from("visitors")
    .select("id, user_id")
    .in("user_id", [...accountsBySlug.values()].map(account => account.userId))
  if (visitorLookupError) {
    throw visitorLookupError
  }

  const visitorIdByUserId = new Map((visitors ?? []).map(visitor => [visitor.user_id, visitor.id]))
  for (const account of accountsBySlug.values()) {
    account.visitorId = visitorIdByUserId.get(account.userId) ?? null
  }
}

async function getTagIdByName(serviceClient) {
  const { data, error } = await serviceClient.from("tags").select("id, name")
  if (error) {
    throw error
  }
  return new Map((data ?? []).map(tag => [tag.name, tag.id]))
}

async function clearFixtureData(serviceClient) {
  const ids = FIXTURE_DATA.allFixtureBlipIds
  await serviceClient.from("reactions").delete().in("blip_id", ids)
  await serviceClient.from("blip_tags").delete().in("blip_id", ids)
  await serviceClient.from("blips").delete().in("id", ids)
}

async function upsertFixtureBlips(serviceClient, accountsBySlug) {
  const rows = FIXTURE_DATA.allBlips.map(blip => {
    const owner = accountsBySlug.get(blip.ownerSlug)
    if (!owner?.userId) {
      throw new Error(`Missing owner for fixture blip ${blip.id}`)
    }
    return {
      id: blip.id,
      parent_id: blip.parentId,
      user_id: owner.userId,
      title: blip.title,
      content: blip.content,
      published: true,
      moderation_status: "approved",
      created_at: blip.createdAt,
      updated_at: blip.updatedAt,
      blip_type: blip.blipType,
    }
  })
  const { error } = await serviceClient.from("blips").upsert(rows, { onConflict: "id" })
  if (error) {
    throw error
  }
}

async function insertFixtureTags(serviceClient, tagIdByName) {
  const rows = FIXTURE_DATA.tagAssignments.flatMap(assignment =>
    assignment.tags.map(tagName => {
      const tagId = tagIdByName.get(tagName)
      if (!tagId) {
        throw new Error(`Missing tag id for ${tagName}`)
      }
      return {
        blip_id: assignment.blipId,
        tag_id: tagId,
        created_at: assignment.createdAt,
      }
    }),
  )
  const { error } = await serviceClient.from("blip_tags").insert(rows)
  if (error) {
    throw error
  }
}

async function upsertFixtureReactions(serviceClient, visitorAccountsBySlug) {
  const rows = FIXTURE_DATA.reactions.map(reaction => {
    const owner = visitorAccountsBySlug.get(reaction.ownerSlug)
    if (!owner?.visitorId) {
      throw new Error(`Missing visitor id for reaction owner ${reaction.ownerSlug}`)
    }
    return {
      blip_id: reaction.blipId,
      visitor_id: owner.visitorId,
      emoji: reaction.emoji,
    }
  })
  const { error } = await serviceClient.from("reactions").upsert(rows, {
    onConflict: "blip_id,visitor_id,emoji",
  })
  if (error) {
    throw error
  }
}

function printSummary(authorAccountsBySlug, visitorAccountsBySlug, mode) {
  console.log("")
  console.log(`Local fixtures are ready (mode: ${mode}).`)
  console.log(`Shared visitor PIN: ${VISITOR_PIN}`)
  console.log("")
  console.log("Author accounts:")
  for (const account of AUTHOR_ACCOUNTS) {
    const hydrated = authorAccountsBySlug.get(account.slug)
    console.log(`${account.displayName} <${account.email}>`)
    console.log(`  role: ${account.role}`)
    console.log(`  user_id: ${hydrated?.userId ?? "missing"}`)
  }
  console.log("")
  console.log("Visitor accounts:")
  for (const account of VISITOR_ACCOUNTS) {
    const hydrated = visitorAccountsBySlug.get(account.slug)
    console.log(`${account.displayName} <${account.email}>`)
    console.log(`  user_id: ${hydrated?.userId ?? "missing"}`)
    console.log(`  visitor_id: ${hydrated?.visitorId ?? "missing"}`)
  }
}

async function main() {
  const { mode } = parseArguments(process.argv.slice(2))
  const { apiUrl, serviceRoleKey } = await getLocalSupabaseCredentials()
  const serviceClient = createClient(apiUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })

  const authorAccountsBySlug = await createOrUpdateAccounts(serviceClient, AUTHOR_ACCOUNTS, VISITOR_PIN)
  const visitorAccountsBySlug = await createOrUpdateAccounts(serviceClient, VISITOR_ACCOUNTS, VISITOR_PIN)
  await hydrateProfilesAndRoles(serviceClient, new Map([...authorAccountsBySlug, ...visitorAccountsBySlug]))

  if (mode === "all") {
    const tagIdByName = await getTagIdByName(serviceClient)
    await clearFixtureData(serviceClient)
    await upsertFixtureBlips(serviceClient, authorAccountsBySlug)
    await insertFixtureTags(serviceClient, tagIdByName)
    await upsertFixtureReactions(serviceClient, visitorAccountsBySlug)
  }

  printSummary(authorAccountsBySlug, visitorAccountsBySlug, mode)
}

await main()
