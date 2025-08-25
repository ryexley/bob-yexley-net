const MILLISECOND = 1
const SECOND = 1000 * MILLISECOND
const MINUTE = 60 * SECOND
const HOUR = 60 * MINUTE
export const TIME = {
  QUARTER_SECOND: MILLISECOND * 250,
  HALF_SECOND: MILLISECOND * 500,
  ONE_SECOND: SECOND,
  TWO_POINT_FIVE_SECONDS: MILLISECOND * 2500,
  FIVE_SECONDS: SECOND * 5,
  TEN_SECONDS: SECOND * 10,
  TWENTY_SECONDS: SECOND * 20,
  ONE_MINUTE: MINUTE,
  TWO_MINUTES: MINUTE * 2,
  THREE_MINUTES: MINUTE * 3,
  FOUR_MINUTES: MINUTE * 4,
  FIVE_MINUTES: MINUTE * 5,
  TEN_MINUTES: MINUTE * 10,
  TWENTY_MINUTES: MINUTE * 20,
  THIRTY_MINUTES: MINUTE * 30,
  FORTY_MINUTES: MINUTE * 40,
  FIFTY_MINUTES: MINUTE * 50,
  ONE_HOUR: HOUR,
}

export const EVENT_REGISTRATION_TYPE = {
  ONLINE: "Online",
  MANUAL: "Manual",
}

export const WAIVERS = {
  HARVEST_ARCHERY: {
    typeId: 1,
    typeKey: "harvest-archery",
    name: "Harvest Archery Liability Waiver",
  },
  QUARRY_ROCK: {
    typeId: 2,
    typeKey: "quarry-rock",
    name: "Quarry Rock Liability Waiver",
  },
}
