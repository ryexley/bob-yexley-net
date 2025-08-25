import { format } from "date-fns/format"
import { fromUnixTime } from "date-fns/fromUnixTime"
import { parseISO } from "date-fns/parseISO"
import { generateSlug } from "@/util/slugify"
import { isEmpty } from "@/util"

export const isoLocaleDate = () => new Date().toISOString().toLocaleString()

export function formatDate(dateString, formatString = "MM/dd/yyyy") {
  if (isEmpty(dateString)) {
    return
  }

  try {
    return format(parseISO(dateString), formatString)
  } catch {
    return dateString
  }
}

export function formatShortDate(dateString, formatString = "EEEE, LLL do") {
  if (isEmpty(dateString)) {
    return
  }

  try {
    return format(parseISO(dateString), formatString)
  } catch {
    return dateString
  }
}

export function formatLongDate(
  dateString,
  formatString = "MM/dd/yyyy @ h:mmaaa",
) {
  if (isEmpty(dateString)) {
    return
  }

  try {
    return format(parseISO(dateString), formatString)
  } catch {
    return dateString
  }
}

export function formatMoney(value = 0) {
  if (isEmpty(value)) {
    return
  }

  const formatter = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  })
  return formatter.format(value)
}

export const unixToIsoLocaleDate = unixTimestamp =>
  fromUnixTime(unixTimestamp).toISOString().toLocaleString()

export function cleanPhoneNumber(value) {
  return value.replace(/[+\-()\s]/g, "")
}

export function formatPhoneNumber(value) {
  if (isEmpty(value)) {
    return
  }

  const format = number => {
    const areaCode = number.slice(0, 3)
    const firstThree = number.slice(3, 6)
    const lastFour = number.slice(-4)

    return `(${areaCode}) ${firstThree}-${lastFour}`
  }

  const cleanValue = cleanPhoneNumber(value)

  return format(cleanValue.startsWith("1") ? cleanValue.slice(1) : cleanValue)
}

export function slugify(source) {
  return generateSlug(source, { lower: true, remove: /[*+~.()'"!:@]/g })
}
