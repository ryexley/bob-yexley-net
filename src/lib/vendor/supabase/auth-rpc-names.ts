export const AUTH_RPC = {
  openCurrentSession: "start_session",
  revokeCurrentSession: "revoke_current_session",
  isServerSessionValid: "session_is_valid",
  recordFailedVisitorLoginAttempt: "record_failed_visitor_login_attempt",
  resetCurrentVisitorFailedLoginAttempts: "sync_visitor_state",
  updateProfile: "update_profile",
} as const
