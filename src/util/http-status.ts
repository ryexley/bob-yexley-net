import { isEmpty } from "~/util"

export const HttpStatus = {
  OK: 200,
  Created: 201,
  NoContent: 204,
  SeeOther: 303,
  BadRequest: 400,
  NotFound: 404,
  MethodNotAllowed: 405,
  InternalServerError: 500,
  NotImplemented: 501,

  class: {
    "1xx": "INFORMATIONAL",
    "2xx": "SUCCESSFUL",
    "3xx": "REDIRECTION",
    "4xx": "CLIENT_ERROR",
    "5xx": "SERVER_ERROR",

    INFORMATIONAL: "INFORMATIONAL",
    SUCCESSFUL: "SUCCESSFUL",
    REDIRECTION: "REDIRECTION",
    CLIENT_ERROR: "CLIENT_ERROR",
    SERVER_ERROR: "SERVER_ERROR",
  },

  statusClass: status => {
    if (isEmpty(status)) {
      return null
    }

    // default to CLIENT_ERROR status class prefix (4) here if/when this fails
    const statusPrefix = String(status).split("")[0] || 4
    const statusClassCode = `${statusPrefix}xx`

    return HttpStatus.class[statusClassCode]
  },

  isSuccessStatus: status => {
    if (isEmpty(status)) {
      return false
    }

    return HttpStatus.statusClass(status) === HttpStatus.class.SUCCESSFUL
  },
}
