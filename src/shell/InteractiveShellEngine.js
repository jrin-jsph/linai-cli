/**
 * InteractiveShellEngine — REPL-style Interactive Shell
 *
 * Provides a readline-based interactive prompt with:
 * - Command history (up/down arrows)
 * - Multi-command chaining via "and", "then", comma
 * - Inline status display via ora spinner
 * - Exit commands (.exit, .quit, Ctrl+C)
 */

import readline from 'readline';
import chalk from 'chalk';
import ora from 'ora';
import { CommandChainEngine } from '../engine/CommandChainEngine.js';
import { splitInput } from '../utils/InputSplitter.js';
import { logger } from '../utils/logger.js';

const asciiArt = `
  ██╗     ██╗███╗   ██╗ █████╗ ██╗    ██████╗ ██╗     ██╗
  ██║     ██║████╗  ██║██╔══██╗██║   ██╔════╝ ██║     ██║
  ██║     ██║██╔██╗ ██║███████║██║   ██║      ██║     ██║
  ██║     ██║██║╚██╗██║██╔══██║██║   ██║      ██║     ██║
  ███████╗██║██║ ╚████║██║  ██║██║   ╚██████╗ ███████╗██║
  ╚══════╝╚═╝╚═╝  ╚═══╝╚═╝  ╚═╝╚═╝    ╚═════╝ ╚══════╝╚═╝`;

const BANNER = `
${chalk.hex('#525252')('  ╭────────────────────────────────────────────────╮')}
${chalk.hex('#525252')('  │')} ❋ Welcome to the ${chalk.bold.white('LinAI')} interactive shell!      ${chalk.hex('#525252')('│')}
${chalk.hex('#525252')('  ╰────────────────────────────────────────────────╯')}

${chalk.hex('#D97757')(asciiArt)}

  ✨ ${chalk.dim('Ready. Type an instruction and press Enter to continue')}
  ${chalk.dim('Type')} ${chalk.yellow('exit')} ${chalk.dim('to quit. Type')} ${chalk.yellow('help')} ${chalk.dim('for commands.')}
`;

export class InteractiveShellEngine {
  constructor(options = {}) {
    this.engineOptions = {
      plugins: [],
      ...options,
    };
    this.engine = new CommandChainEngine(this.engineOptions);
    this.rl = null;
  }

  /**
   * Starts the interactive REPL loop.
   */
  start() {
    console.log(BANNER);

    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      prompt: chalk.bold.cyan('linai') + chalk.bold.white('>') + ' ',
      historySize: 200,
    });

    this.rl.prompt();

    this.rl.on('line', async (line) => {
      const input = line.trim();
      if (!input) { this.rl.prompt(); return; }

      // Built-in shell commands (accept both `exit` and `.exit` styles)
      const cmd = input.toLowerCase();
      if (cmd === 'exit' || cmd === 'quit' || cmd === '.exit' || cmd === '.quit') {
        console.log(chalk.dim('\n  Goodbye! 👋\n'));
        this.rl.close();
        process.exit(0);
      }
      if (cmd === 'help' || cmd === '.help') {
        this._printHelp();
        this.rl.prompt();
        return;
      }
      if (cmd === 'clear' || cmd === '.clear') {
        console.clear();
        console.log(BANNER);
        this.rl.prompt();
        return;
      }

      // Pause readline while processing
      this.rl.pause();

      try {
        await this._handleInput(input);
      } catch (err) {
        console.log(chalk.red(`\n  Error: ${err.message}\n`));
        logger.error(err);
      }

      this.rl.resume();
      this.rl.prompt();
    });

    this.rl.on('close', () => {
      console.log(chalk.dim('\nSession ended.'));
      process.exit(0);
    });
  }

  /**
   * Handles a line of input — extracts flags, splits into sub-commands and runs each.
   * @param {string} input
   */
  async _handleInput(input) {
    let raw = input;
    let dryRun = this.engineOptions.dryRun || false;
    let explain = this.engineOptions.explain || false;

    // Detect and strip flags
    if (/(^|\s)(--simulate|-s|--dry-run|-d)(\s|$)/.test(raw)) {
      dryRun = true;
      raw = raw.replace(/(^|\s)(--simulate|-s|--dry-run|-d)(\s|$)/g, ' ').trim();
    }
    if (/(^|\s)(--explain|-e)(\s|$)/.test(raw)) {
      explain = true;
      raw = raw.replace(/(^|\s)(--explain|-e)(\s|$)/g, ' ').trim();
    }

    const scopedEngine = new CommandChainEngine({
      ...this.engineOptions,
      dryRun,
      explain,
    });

    const parts = splitInput(raw);
    const isChain = parts.length > 1;

    if (isChain) {
      console.log(
        '\n' + chalk.dim('  Chain: ') +
        chalk.bold.white(String(parts.length)) +
        chalk.dim(' commands') +
        (dryRun ? chalk.yellow(' (Simulation)') : '')
      );
      parts.forEach((p, i) => {
        console.log(chalk.dim(`    ${String(i + 1).padStart(2)}.`) + ' ' + chalk.cyan(p));
      });
      console.log();
    } else if (dryRun) {
      console.log(chalk.yellow('\n  Simulation Mode: No commands will be executed.\n'));
    }

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];

      if (isChain) {
        console.log(
          chalk.bold.cyan(`  ┌─ Step ${i + 1}/${parts.length} `) +
          chalk.dim(`▸ ${part}`)
        );
      }

      const ok = await this._runOne(part, scopedEngine);
      console.log();

      if (!ok) {
        if (isChain && i < parts.length - 1) {
          console.log(
            chalk.yellow(`  ⚠  Chain stopped at step ${i + 1}.`) +
            chalk.dim(` ${parts.length - i - 1} step(s) skipped.\n`)
          );
        }
        break;
      }
    }

    if (isChain) {
      console.log(chalk.dim('  ─────────────────────────────────'));
      console.log(chalk.dim('  Chain complete.\n'));
    }
  }

  /**
   * Runs a single sub-instruction through the scoped engine.
   * @param {string} instruction
   * @param {CommandChainEngine} engine
   * @returns {Promise<boolean>} true = ok to continue chain
   */
  async _runOne(instruction, engine) {
    const spinner = ora({
      text: chalk.dim(`  ▸ "${instruction.slice(0, 65)}${instruction.length > 65 ? '...' : ''}"  `),
      color: 'cyan',
      indent: 2,
    }).start();

    let ctx;
    try {
      ctx = await engine.run(instruction);
      spinner.stop();
    } catch (err) {
      spinner.fail(chalk.red(`  Error: ${err.message}`));
      return false;
    }

    if (ctx.safetyDecision === 'blocked') {
      console.log(chalk.red(`\n  ✖  Blocked`) + chalk.dim(` — risk ${ctx.safetyScore}/100\n`));
      return false;
    }

    if (ctx.command) {
      console.log(chalk.dim('\n  Command:   ') + chalk.bold.yellow(ctx.command));
    }
    if (ctx.explanation) {
      console.log(chalk.dim('  Explain:   ') + chalk.white(ctx.explanation.split('\n')[0]));
    }
    if (ctx.error) {
      console.log(chalk.red(`\n  ✖  ${ctx.error.type}: ${ctx.error.message}`));
      console.log(chalk.dim(`     Hint: ${ctx.error.hint}`));
    }

    return true;
  }

  _printHelp() {
    console.log(`
${chalk.bold('Session Commands:')}
  ${chalk.yellow('exit')}  ${chalk.dim('or')} ${chalk.yellow('quit')}   Exit the LinAI shell
  ${chalk.yellow('help')}              Show this help
  ${chalk.yellow('clear')}             Clear the screen

${chalk.bold('Multi-command chaining:')}
  Use ${chalk.cyan('"and"')}, ${chalk.cyan('"then"')}, or a ${chalk.cyan('comma')} to chain commands:
  ${chalk.dim('linai>')} ${chalk.green('create folder logs, then list files')}

${chalk.bold('Inline flags:')}
  ${chalk.yellow('--simulate')} / ${chalk.yellow('--dry-run')}   Show what would run without executing
  ${chalk.yellow('--explain')}             Show plain-English explanation

${chalk.bold('Examples:')}
  ${chalk.dim('linai>')} ${chalk.green('create a folder called project')}
  ${chalk.dim('linai>')} ${chalk.green('install express --simulate')}
  ${chalk.dim('linai>')} ${chalk.green('list all files larger than 10MB and delete them')}
`);
  }
}

