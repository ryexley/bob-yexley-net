import { isFuture } from "date-fns/isFuture"
import { isPast } from "date-fns/isPast"
import { parseISO } from "date-fns/parseISO"

export function sortEvents(eventData) {
  const pastEvents = eventData
    .filter(event => isPast(parseISO(event.start_date)))
    .sort((a, b) => +parseISO(b.start_date) - +parseISO(a.start_date))
  const futureEvents = eventData
    .filter(event => isFuture(parseISO(event.start_date)))
    .sort((a, b) => +parseISO(a.start_date) - +parseISO(b.start_date))

  return [...futureEvents, ...pastEvents]
}
