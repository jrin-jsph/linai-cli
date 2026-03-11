#!/usr/bin/env node

/**
 * LinAI CLI — Entry Point
 *
 * Smart pre-parse router:
 *   linai "create folder project"  → treated as: linai ask "create folder project"
 *   linai explain "ls -la"         → routed to explain command
 *   linai shell                    → routed to shell command
 *   linai --help / -v              → standard Commander flags
 *
 * If argv[2] is NOT a known subcommand/flag, it is treated as a
 * natural language instruction and 'ask' is injected automatically.
 */

import { createCLI } from '../src/cli/CLIInterface.js';

const cli = await createCLI();

function resolveArgv(argv, program) {
  const rawArg = argv[2];
  if (rawArg === undefined) return argv;

  // Check if it's a built-in commander flag like --help or --version
  if (rawArg === '-h' || rawArg === '--help' || rawArg === '-v' || rawArg === '--version') return argv;

  // Check if it's a known subcommand (including those added by plugins)
  const isKnownCommand = program.commands.some(cmd => cmd.name() === rawArg || cmd.aliases().includes(rawArg));
  if (isKnownCommand) return argv;

  // It starts with '-' but isn't a known flag → let Commander handle it
  if (rawArg.startsWith('-')) return argv;

  // Bare string → inject 'ask' as subcommand
  return [argv[0], argv[1], 'ask', ...argv.slice(2)];
}

await cli.parseAsync(resolveArgv(process.argv, cli));

