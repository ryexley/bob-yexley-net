/**
 * Canonical ESV book names and abbreviation lookup.
 *
 * Canonical names follow ESV API conventions (ported from legacy bible.js,
 * with numbered books using "1 Samuel" style rather than "1st Samuel").
 * Abbreviations cover every alternate captured by the scripture reference regex.
 */

export const CANONICAL_BOOK_NAMES = [
  "Genesis",
  "Exodus",
  "Leviticus",
  "Numbers",
  "Deuteronomy",
  "Joshua",
  "Judges",
  "Ruth",
  "1 Samuel",
  "2 Samuel",
  "1 Kings",
  "2 Kings",
  "1 Chronicles",
  "2 Chronicles",
  "Ezra",
  "Nehemiah",
  "Esther",
  "Job",
  "Psalm",
  "Proverbs",
  "Ecclesiastes",
  "Song of Solomon",
  "Isaiah",
  "Jeremiah",
  "Lamentations",
  "Ezekiel",
  "Daniel",
  "Hosea",
  "Joel",
  "Amos",
  "Obadiah",
  "Jonah",
  "Micah",
  "Nahum",
  "Habakkuk",
  "Zephaniah",
  "Haggai",
  "Zechariah",
  "Malachi",
  "Matthew",
  "Mark",
  "Luke",
  "John",
  "Acts",
  "Romans",
  "1 Corinthians",
  "2 Corinthians",
  "Galatians",
  "Ephesians",
  "Philippians",
  "Colossians",
  "1 Thessalonians",
  "2 Thessalonians",
  "1 Timothy",
  "2 Timothy",
  "Titus",
  "Philemon",
  "Hebrews",
  "James",
  "1 Peter",
  "2 Peter",
  "1 John",
  "2 John",
  "3 John",
  "Jude",
  "Revelation",
] as const

export type CanonicalBookName = (typeof CANONICAL_BOOK_NAMES)[number]

const NUMBER_PREFIXES: Record<1 | 2 | 3, string[]> = {
  1: ["1", "i", "first"],
  2: ["2", "ii", "second"],
  3: ["3", "iii", "third"],
}

function normalizeAliasKey(alias: string): string {
  return alias.trim().toLowerCase().replace(/\s+/g, " ")
}

function addAliases(
  target: Record<string, CanonicalBookName>,
  canonical: CanonicalBookName,
  aliases: string[],
) {
  for (const alias of aliases) {
    target[normalizeAliasKey(alias)] = canonical
  }
}

function addNumberedBookAliases(
  target: Record<string, CanonicalBookName>,
  number: 1 | 2 | 3,
  canonical: CanonicalBookName,
  names: string[],
) {
  for (const prefix of NUMBER_PREFIXES[number]) {
    for (const name of names) {
      addAliases(target, canonical, [
        `${prefix} ${name}`,
        `${prefix}${name}`,
      ])
    }
  }
}

function buildBookAliases(): Record<string, CanonicalBookName> {
  const aliases: Record<string, CanonicalBookName> = {}

  addAliases(aliases, "Genesis", ["gen", "genesis"])
  addAliases(aliases, "Exodus", ["ex", "exo", "exod", "exodus"])
  addAliases(aliases, "Leviticus", ["lev", "leviticus"])
  addAliases(aliases, "Numbers", ["num", "numbers"])
  addAliases(aliases, "Deuteronomy", ["deut", "deuteronomy"])
  addAliases(aliases, "Joshua", ["josh", "joshua"])
  addAliases(aliases, "Judges", ["judg", "judges"])
  addAliases(aliases, "Ruth", ["ruth"])

  addNumberedBookAliases(aliases, 1, "1 Samuel", ["samuel", "sam"])
  addNumberedBookAliases(aliases, 2, "2 Samuel", ["samuel", "sam"])
  addNumberedBookAliases(aliases, 1, "1 Kings", ["kings", "king", "kgs", "kg"])
  addNumberedBookAliases(aliases, 2, "2 Kings", ["kings", "king", "kgs", "kg"])
  addNumberedBookAliases(aliases, 1, "1 Chronicles", ["chronicles", "chron"])
  addNumberedBookAliases(aliases, 2, "2 Chronicles", ["chronicles", "chron"])

  addAliases(aliases, "Ezra", ["ezra"])
  addAliases(aliases, "Nehemiah", ["neh", "nehemiah"])
  addAliases(aliases, "Esther", ["esth", "esther"])
  addAliases(aliases, "Job", ["job"])
  addAliases(aliases, "Psalm", ["psalm", "psalms", "psa", "ps"])
  addAliases(aliases, "Proverbs", ["prov", "proverbs"])
  addAliases(aliases, "Ecclesiastes", ["eccles", "ecc", "ecclesiastes"])
  addAliases(aliases, "Song of Solomon", [
    "song of solomon",
    "song of songs",
    "song of song",
    "songs",
    "sos",
  ])
  addAliases(aliases, "Isaiah", ["isa", "isaiah"])
  addAliases(aliases, "Jeremiah", ["jer", "jeremiah"])
  addAliases(aliases, "Lamentations", ["lam", "lamentations"])
  addAliases(aliases, "Ezekiel", ["ezek", "ezekiel"])
  addAliases(aliases, "Daniel", ["dan", "daniel"])
  addAliases(aliases, "Hosea", ["hos", "hosea"])
  addAliases(aliases, "Joel", ["joel"])
  addAliases(aliases, "Amos", ["amos"])
  addAliases(aliases, "Obadiah", ["obad", "obadiah"])
  addAliases(aliases, "Jonah", ["jon", "jonah"])
  addAliases(aliases, "Micah", ["mic", "micah"])
  addAliases(aliases, "Nahum", ["nah", "nahum"])
  addAliases(aliases, "Habakkuk", ["hab", "habakkuk"])
  addAliases(aliases, "Zephaniah", ["zeph", "zephaniah"])
  addAliases(aliases, "Haggai", ["hag", "haggai"])
  addAliases(aliases, "Zechariah", ["zech", "zechariah"])
  addAliases(aliases, "Malachi", ["mal", "malachi"])
  addAliases(aliases, "Matthew", ["matt", "matthew"])
  addAliases(aliases, "Mark", ["mark"])
  addAliases(aliases, "Luke", ["luke"])
  addAliases(aliases, "John", ["john", "jn"])
  addAliases(aliases, "Acts", ["act", "acts"])
  addAliases(aliases, "Romans", ["rom", "romans"])

  addNumberedBookAliases(aliases, 1, "1 Corinthians", ["corinthians", "cor"])
  addNumberedBookAliases(aliases, 2, "2 Corinthians", ["corinthians", "cor"])
  addAliases(aliases, "Galatians", ["gal", "galatians"])
  addAliases(aliases, "Ephesians", ["eph", "ephesians"])
  addAliases(aliases, "Philippians", ["phil", "philippians"])
  addAliases(aliases, "Colossians", ["col", "colossians"])

  addNumberedBookAliases(aliases, 1, "1 Thessalonians", ["thessalonians", "thess"])
  addNumberedBookAliases(aliases, 2, "2 Thessalonians", ["thessalonians", "thess"])
  addNumberedBookAliases(aliases, 1, "1 Timothy", ["timothy", "tim"])
  addNumberedBookAliases(aliases, 2, "2 Timothy", ["timothy", "tim"])

  addAliases(aliases, "Titus", ["tit", "titus"])
  addAliases(aliases, "Philemon", ["philem", "phlm", "philemon"])
  addAliases(aliases, "Hebrews", ["heb", "hebrews"])
  addAliases(aliases, "James", ["jas", "james"])

  addNumberedBookAliases(aliases, 1, "1 Peter", ["peter", "pet"])
  addNumberedBookAliases(aliases, 2, "2 Peter", ["peter", "pet"])
  addNumberedBookAliases(aliases, 1, "1 John", ["john", "jn"])
  addNumberedBookAliases(aliases, 2, "2 John", ["john", "jn"])
  addNumberedBookAliases(aliases, 3, "3 John", ["john", "jn"])

  addAliases(aliases, "Jude", ["jude"])
  addAliases(aliases, "Revelation", ["rev", "revelation"])

  for (const canonical of CANONICAL_BOOK_NAMES) {
    addAliases(aliases, canonical, [canonical])
  }

  return aliases
}

export const bookAliases: Record<string, CanonicalBookName> = buildBookAliases()

export function resolveBookAlias(alias: string): CanonicalBookName | null {
  return bookAliases[normalizeAliasKey(alias)] ?? null
}
