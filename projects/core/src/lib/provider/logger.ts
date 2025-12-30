import debug from 'debug';

/* ------------------------------------------------------------------
 * Library name
 * ------------------------------------------------------------------ */
const LIB_NAME = 'shig-core';

/* ------------------------------------------------------------------
 * Log-Level + Styles
 * ------------------------------------------------------------------ */
export const LOG_LEVELS = {
  error: 'color:red;font-weight:bold',
  warn:  'color:orange',
  info:  'color:deepskyblue',
  debug: 'color:gray',
  trace: 'color:lightgray',
} as const;

export type LogLevel = keyof typeof LOG_LEVELS;

/* ------------------------------------------------------------------
 * Logger-Interface
 * ------------------------------------------------------------------ */
export interface Logger {
  error: debug.Debugger;
  warn:  debug.Debugger;
  info:  debug.Debugger;
  debug: debug.Debugger;
  trace: debug.Debugger;
}

/* ------------------------------------------------------------------
 * Internal helper: wrap debug() with CSS style (Browser)
 * ------------------------------------------------------------------ */
function styled(
  logger: debug.Debugger,
  css: string
): debug.Debugger {
  const fn = ((...args: unknown[]) => {
    if (typeof args[0] === 'string') {
      logger(`%c${args[0]}`, css, ...args.slice(1));
    } else {
      logger('%c%o', css, args);
    }
  }) as debug.Debugger;

  Object.assign(fn, logger);
  return fn;
}

/* ------------------------------------------------------------------
 * Logger-Factory
 * ------------------------------------------------------------------ */
export function createLogger(scope: string): Logger {
  return {
    error: styled(
      debug(`${LIB_NAME}:${scope}:error`),
      LOG_LEVELS.error
    ),
    warn: styled(
      debug(`${LIB_NAME}:${scope}:warn`),
      LOG_LEVELS.warn
    ),
    info: styled(
      debug(`${LIB_NAME}:${scope}:info`),
      LOG_LEVELS.info
    ),
    debug: styled(
      debug(`${LIB_NAME}:${scope}:debug`),
      LOG_LEVELS.debug
    ),
    trace: styled(
      debug(`${LIB_NAME}:${scope}:trace`),
      LOG_LEVELS.trace
    ),
  };
}
