import { createIntl } from "@formatjs/intl"
import { messages as nestedMessages } from "./messages"

const flattenMessages = (nestedMessages, prefix = "") => {
  return Object.keys(nestedMessages).reduce((messages, key) => {
    const value = nestedMessages[key]
    const prefixedKey = prefix ? `${prefix}.${key}` : key

    if (typeof value === "string") {
      messages[prefixedKey] = value
    } else {
      Object.assign(messages, flattenMessages(value, prefixedKey))
    }

    return messages
  }, {})
}

export * from "@formatjs/intl"
export * from "@cookbook/solid-intl"
export { IntlProvider } from "@cookbook/solid-intl"
export const messages = flattenMessages(nestedMessages["en"])
export const intl = createIntl({ locale: "en", messages })
export const tr = (id: string, params: Record<string, any> = {}) =>
  intl.formatMessage({ id }, params)
