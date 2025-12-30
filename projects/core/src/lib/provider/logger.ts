import debug from 'debug';

/* ------------------------------------------------------------------
 * Log-Level + Styles
 * ------------------------------------------------------------------ */
export const LOG_LEVELS = {
  error: 'color:red;font-weight:bold',
  warn: 'color:orange',
  info: 'color:deepskyblue',
  debug: 'color:gray',
  trace: 'color:lightgray',
} as const;

export type LogLevel = keyof typeof LOG_LEVELS;

/* ------------------------------------------------------------------
 * Logger-Interface
 * ------------------------------------------------------------------ */
export interface Logger {
  error: debug.Debugger;
  warn: debug.Debugger;
  info: debug.Debugger;
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
function createLoggerFactory(libName: string, scope: string): Logger {
  return {
    error: styled(
      debug(`${libName}:${scope}:error`),
      LOG_LEVELS.error
    ),
    warn: styled(
      debug(`${libName}:${scope}:warn`),
      LOG_LEVELS.warn
    ),
    info: styled(
      debug(`${libName}:${scope}:info`),
      LOG_LEVELS.info
    ),
    debug: styled(
      debug(`${libName}:${scope}:debug`),
      LOG_LEVELS.debug
    ),
    trace: styled(
      debug(`${libName}:${scope}:trace`),
      LOG_LEVELS.trace
    ),
  };
}

const LIB_NAME = 'shig-core';
const APP_NAME = 'shig-app';


export function createLogger(scope: string): Logger {
  return createLoggerFactory(LIB_NAME, scope);
}

export function createAppLogger(scope: string): Logger {
  return createLoggerFactory(APP_NAME, scope);
}


export enum LEVEL {
  ERROR = 'error',
  WARN = 'warn',
  INFO = 'info',
  DEBUG = 'debug',
  TRACE = 'trace',
  ALL = 'all'
}

export function enableLogger(level: LEVEL) {
  if (level === LEVEL.ALL) {
    debug.enable(`${LIB_NAME}:*,${APP_NAME}:*`);
    return;
  }
  let enableLibStr = enableLoggerLevel(LIB_NAME, level);
  let enableAppStr = enableLoggerLevel(APP_NAME, level);
  debug.enable(`${enableLibStr},${enableAppStr}`);
}

function enableLoggerLevel(libName: string, level: LEVEL): string {
  switch (level) {
    case LEVEL.ERROR: {
      return `${libName}:*,-${libName}:*:warn,-${libName}:*:info,-${libName}:*:debug,-${libName}:*:trace`;
    }
    case LEVEL.WARN: {
      return `${libName}:*,-${libName}:*:info,-${libName}:*:debug,-${libName}:*:trace`;
    }
    case LEVEL.INFO: {
      return `${libName}:*,-${libName}:*:debug,-${libName}:*:trace`;
    }
    case LEVEL.DEBUG: {
      return `${libName}:*,-${libName}:*:trace`;
    }
    case LEVEL.TRACE: {
      return `${libName}:*,-${libName}:*:debug`;
    }
  }
  return '*:*';
}
