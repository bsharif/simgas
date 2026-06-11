import type { ErrorCode } from '../../shared/protocol'

/**
 * Translate server error codes into actionable, human-readable messages
 * (review: "Join and create errors are not visible enough").
 */
export function describeServerError(code: ErrorCode, message?: string): string {
  if (message) return message
  switch (code) {
    case 'not_found':
      return 'Session not found. Check the 6-character code with your trainer — the room may also have expired.'
    case 'session_full':
      return 'This session is full. Ask the trainer to start another room.'
    case 'unauthorized':
      return 'You are not authorized for this session. Try rejoining with the session code.'
    case 'invalid_payload':
    case 'bad_json':
    case 'unknown_message_type':
    case 'message_too_large':
      return 'The server rejected the request. Refresh the page and try again.'
    case 'internal_error':
      return 'The server hit an internal error. Try again in a moment.'
  }
}
