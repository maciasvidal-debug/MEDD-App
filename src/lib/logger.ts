/**
 * Centralized logging utility.
 * Use this instead of direct console.* calls to allow for future
 * integration with error tracking services (e.g. Sentry) or filtering
 * log levels based on environments.
 */
export const logger = {
  info: (...args: unknown[]) => {
    console.info(...args)
  },
  warn: (...args: unknown[]) => {
    console.warn(...args)
  },
  error: (...args: unknown[]) => {
    console.error(...args)
  },
}
