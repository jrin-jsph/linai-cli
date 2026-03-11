/**
 * logger — Structured Console Logger
 *
 * Wraps console with log levels: debug, info, warn, error.
 * Level is controlled by the LOG_LEVEL environment variable.
 *
 * Levels (ascending verbosity): error < warn < info < debug
 */

import chalk from 'chalk';

const LEVELS = { error: 0, warn: 1, info: 2, debug: 3 };
const currentLevel = LEVELS[process.env.LOG_LEVEL?.toLowerCase()] ?? LEVELS.warn;

const prefix = {
  debug: chalk.dim('[debug]'),
  info: chalk.cyan('[info] '),
  warn: chalk.yellow('[warn] '),
  error: chalk.red('[error]'),
};

function log(level, ...args) {
  if (LEVELS[level] <= currentLevel) {
    console.error(prefix[level], ...args);
  }
}

export const logger = {
  debug: (...a) => log('debug', ...a),
  info:  (...a) => log('info',  ...a),
  warn:  (...a) => log('warn',  ...a),
  error: (...a) => log('error', ...a),
};
