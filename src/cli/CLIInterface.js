/**
 * CLIInterface — Commander.js Command Definitions
 *
 * Routes user input to the appropriate engine/module.
 *
 * Direct NL input (via bin/linai.js default-command router):
 *   linai "create folder project"      → CommandChainEngine (ask)
 *   linai "create folder" --dry-run    → CommandChainEngine (dry-run)
 *   linai "create folder" --explain    → CommandChainEngine (with explain)
 *
 * Named subcommands:
 *   linai ask "<instruction>"          → CommandChainEngine
 *   linai run "<instruction>"          → CommandChainEngine (alias)
 *   linai explain "<command>"          → CommandExplainEngine
 *   linai simulate "<instruction>"     → CommandChainEngine (dry-run only)
 *   linai shell                        → InteractiveShellEngine
 *   linai setup                        → SetupWizard (AI provider selection)
 *   linai teach <phrase> <cmd>         → LearningEngine (corrections)
 *   linai history [-n N]               → LearningEngine
 *   linai config                       → config dump
 */

import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import inquirer from 'inquirer';

import { CommandChainEngine } from '../engine/CommandChainEngine.js';
import { CommandExplainEngine } from '../explain/CommandExplainEngine.js';
import { InteractiveShellEngine } from '../shell/InteractiveShellEngine.js';
import { LearningEngine } from '../learning/LearningEngine.js';
import { PluginLoader } from '../plugins/PluginLoader.js';
import { SetupWizard } from '../setup/SetupWizard.js';
import { getConfig } from '../utils/config.js';
import { splitInput } from '../utils/InputSplitter.js';
import * as UI from './UIRenderer.js';

// ─── Core run action (shared by ask / run / default) ─────────────────────────

/**
 * Runs a single instruction through the CommandChainEngine.
 * Handles safety confirmation and prints result via UIRenderer.
 * Returns false if chain should be aborted.
 */
async function runSingle(instruction, { dryRun, explain }, engine) {
  UI.printInstruction(instruction);

  const spinner = UI.createSpinner('Thinking…').start();

  let ctx;
  try {
    ctx = await engine.run(instruction);
    spinner.stop();
  } catch (err) {
    spinner.fail(chalk.red(`  Error: ${err.message}`));
    return false;
  }

  // Safety blocked
  if (ctx.safetyDecision === 'blocked') {
    UI.printBlocked(ctx);
    return false;
  }

  // Safety confirmation required
  if (ctx.safetyDecision === 'confirm' && !dryRun) {
    const proceed = await UI.confirmDangerousCommand(ctx.command, ctx.safetyScore);
    if (!proceed) {
      UI.printAborted('Command cancelled.');
      return false;
    }
    ctx.safetyDecision = 'safe';
  }

  UI.renderResult(ctx, { dryRun, explain });
  return true;
}

async function runAction(instruction, opts, plugins = []) {
  if (!instruction || !instruction.trim()) {
    console.error(chalk.red('\n  Please provide a natural language instruction.\n'));
    process.exit(1);
  }

  const config = getConfig();
  const dryRun = opts.dryRun ?? config.execution.dryRunByDefault;
  const explain = opts.explain ?? config.execution.explain;

  const parts = splitInput(instruction);
  const isChain = parts.length > 1;

  UI.printBanner();

  if (isChain) {
    UI.printChainStart(parts);
  }

  const engine = new CommandChainEngine({
    dryRun,
    explain,
    maxRetries: config.execution.maxRetries,
    plugins,
  });

  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];

    if (isChain) {
      UI.printStepHeader(i + 1, parts.length, part);
    }

    const ok = await runSingle(part, { dryRun, explain }, engine);

    if (!ok) {
      if (isChain && i < parts.length - 1) {
        UI.printAborted(`Chain stopped at step ${i + 1}. Remaining ${parts.length - i - 1} step(s) skipped.`);
      }
      break;
    }
  }

  if (isChain) {
    UI.printChainDone();
  }
}

// ─── createCLI ────────────────────────────────────────────────────────────────

export async function createCLI() {
  const program = new Command();
  const config = getConfig();

  // Load plugins first so they can register syntax/commands
  const pluginLoader = new PluginLoader();
  const plugins = await pluginLoader.load();

  // Allow plugins to register custom CLI commands
  for (const plugin of plugins) {
    if (plugin.hooks.includes('custom-command') && typeof plugin.module?.registerCommands === 'function') {
      plugin.module.registerCommands(program);
    }
  }

  program
    .name('linai')
    .description(
      chalk.bold.cyan('LinAI CLI') + ' ' +
      chalk.dim('— Natural language → Linux commands, powered by AI')
    )
    .version('0.1.0', '-v, --version')
    .addHelpText('afterAll', `
${chalk.bold('Examples:')}
  ${chalk.dim('$')} ${chalk.cyan('linai')} setup
  ${chalk.dim('$')} ${chalk.cyan('linai')} ${chalk.green('"create a folder called project"')}
  ${chalk.dim('$')} ${chalk.cyan('linai')} ${chalk.green('"list all files larger than 100MB"')} ${chalk.dim('--dry-run')}
  ${chalk.dim('$')} ${chalk.cyan('linai')} explain ${chalk.green('"find /var/log -mtime +7 -delete"')}
  ${chalk.dim('$')} ${chalk.cyan('linai')} teach ${chalk.green('"start server"')} ${chalk.green('"node server.js"')}
  ${chalk.dim('$')} ${chalk.cyan('linai')} shell
    `);

  // ─── ask ─────────────────────────────────────────────────────────────────
  program
    .command('ask <instruction>')
    .description('Convert a natural language instruction to a Linux command and run it')
    .option('-d, --dry-run',    'Simulate without executing')
    .option('-s, --simulate',   'Show execution plan without running commands (alias for --dry-run)')
    .option('-e, --explain',    'Show plain-English explanation after execution')
    .option('--no-explain',     'Skip explanation')
    .action((instruction, opts) => {
      // Map --simulate to --dry-run
      if (opts.simulate) opts.dryRun = true;
      runAction(instruction, opts, plugins);
    });

  // ─── run (alias) ─────────────────────────────────────────────────────────
  program
    .command('run <instruction>')
    .description('Alias for ask')
    .option('-d, --dry-run',    'Simulate without executing')
    .option('-s, --simulate',   'Show execution plan without running commands (alias for --dry-run)')
    .option('-e, --explain',    'Show explanation after execution')
    .action((instruction, opts) => {
      if (opts.simulate) opts.dryRun = true;
      runAction(instruction, opts, plugins);
    });

  // ─── explain ─────────────────────────────────────────────────────────────
  program
    .command('explain <command>')
    .description('Explain what a Linux shell command does in plain English')
    .action(async (command) => {
      UI.printBanner();
      UI.printInstruction(command);

      const spinner = UI.createSpinner(`Explaining ${command.slice(0, 40)}…`).start();

      const engine = new CommandExplainEngine();
      try {
        const explanation = await engine.explain(command);
        spinner.stop();
        UI.printExplanation(explanation);
        console.log();
      } catch (err) {
        spinner.fail(chalk.red(`  Error: ${err.message}`));
        process.exit(1);
      }
    });

  // ─── teach ───────────────────────────────────────────────────────────────
  program
    .command('teach <instruction> <command>')
    .description('Teach LinAI a specific Linux command for a given natural language instruction')
    .action(async (instruction, command) => {
      UI.printCommandHeader('teach');
      const engine = new LearningEngine();
      try {
        await engine.correct(instruction, command);
        console.log(chalk.green(`  ✔ Taught LinAI:`));
        console.log(chalk.dim(`    When I say: `) + chalk.cyan(instruction));
        console.log(chalk.dim(`    You run:    `) + chalk.yellow(command) + '\n');
      } catch (err) {
        console.log(chalk.red(`  ✖ Error saving correction: ${err.message}\n`));
      }
    });

  // ─── simulate ────────────────────────────────────────────────────────────
  program
    .command('simulate <instruction>')
    .description('Predict effects of a natural language instruction without executing')
    .action(async (instruction) => {
      printHeader('simulate');

      const spinner = ora({
        text: chalk.dim(`  Simulating "${instruction.slice(0, 60)}"  `),
        color: 'cyan',
        indent: 2,
      }).start();

      const engine = new CommandChainEngine({ dryRun: true, explain: false, plugins });
      const ctx = await engine.run(instruction);
      spinner.stop();

      printResult(ctx, { dryRun: true, explain: false });
      console.log();
    });

  // ─── shell ───────────────────────────────────────────────────────────────
  program
    .command('shell')
    .description('Start an interactive LinAI REPL shell')
    .option('-d, --dry-run', 'Simulate all commands in this shell session')
    .action(async (opts) => {
      const shell = new InteractiveShellEngine({ 
        dryRun: opts.dryRun ?? false,
        plugins 
      });
      shell.start();
    });

  // ─── history ─────────────────────────────────────────────────────────────
  program
    .command('history')
    .description('Show recent command history')
    .option('-n, --count <n>', 'Number of entries to show', '20')
    .action((opts) => {
      const learner = new LearningEngine();
      const entries = learner.getRecentHistory(parseInt(opts.count, 10));

      if (!entries.length) {
        console.log(chalk.dim('\n  No history yet.\n'));
        return;
      }

      UI.printCommandHeader('history');
      entries.forEach((e, i) => {
        const num = chalk.dim(String(i + 1).padStart(3) + '.');
        const cmd = chalk.bold.yellow(e.command ?? '—');
        const input = chalk.dim(e.rawInput);
        const date = chalk.dim(new Date(e.timestamp).toLocaleString());
        console.log(`  ${num}  ${cmd}`);
        console.log(`         ${chalk.dim('└')} input: ${input}  ${date}`);
      });
      console.log();
    });

  // ─── config ──────────────────────────────────────────────────────────────
  program
    .command('config')
    .description('Show current LinAI configuration')
    .action(() => {
      UI.printCommandHeader('config');
      const freshConfig = getConfig();
      const display = JSON.parse(JSON.stringify(freshConfig));
      if (display.ai?.apiKey) display.ai.apiKey = '●●●●●●●●';  // mask key
      console.log(JSON.stringify(display, null, 2));
      console.log();
    });

  // ─── setup ───────────────────────────────────────────────────────────────
  program
    .command('setup')
    .description('Choose AI provider and save your API key')
    .action(async () => {
      const wizard = new SetupWizard();
      await wizard.run();
    });

  return program;
}

