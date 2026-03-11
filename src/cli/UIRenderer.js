/**
 * UIRenderer — Modern CLI Output Engine
 *
 * Provides a centralized, Claude Code-inspired terminal UI:
 *   - Branded startup banner
 *   - Step-by-step execution sections
 *   - Live spinners during AI processing
 *   - Risk bars and safety indicators
 *   - Styled error, success, warning blocks
 *   - Confirmation prompts
 */

import chalk from 'chalk';
import ora from 'ora';
import inquirer from 'inquirer';

// ─── THEME ────────────────────────────────────────────────────────────────────

const T = {
  accent:  (s) => chalk.hex('#22D3EE')(s),    // bright cyan
  dim:     (s) => chalk.hex('#94A3B8')(s),    // slate
  success: (s) => chalk.hex('#4ADE80')(s),    // green
  warn:    (s) => chalk.hex('#FBBF24')(s),    // amber
  error:   (s) => chalk.hex('#F87171')(s),    // red
  cmd:     (s) => chalk.bold.hex('#FDE68A')(s), // pale yellow bold
  muted:   (s) => chalk.hex('#64748B')(s),    // muted slate
  white:   (s) => chalk.hex('#F8FAFC')(s),    // near white
  section: (s) => chalk.bold.hex('#C084FC')(s), // purple
  border:  (s) => chalk.hex('#334155')(s),    // dark border
};

const ICONS = {
  success: '✔',
  error:   '✖',
  warn:    '⚠',
  arrow:   '▸',
  ai:      '◆',
  lock:    '⊘',
  bolt:    '⚡',
  fix:     '⟳',
  explain: '≋',
  spark:   '✦',
  step:    '›',
};

// ─── BANNER ───────────────────────────────────────────────────────────────────

export function printBanner(version = '0.1.0') {
  const v = T.muted(`v${version}`);
  console.log();
  console.log(T.accent('  ┌─────────────────────────────────────────┐'));
  console.log(T.accent('  │') + '  ' + chalk.bold.white('LinAI') + '  ' + T.muted('·  Natural Language → Linux') + '  ' + T.accent('  │'));
  console.log(T.accent('  │') + '  ' + T.muted('AI-powered terminal assistant  ') + v + '         ' + T.accent('│'));
  console.log(T.accent('  └─────────────────────────────────────────┘'));
  console.log();
}

// ─── COMMAND HEADER ───────────────────────────────────────────────────────────

export function printCommandHeader(label) {
  console.log(
    '\n' + T.muted('  ') + T.accent('┌ ') + chalk.bold.white(label)
  );
}

export function printCommandFooter() {
  console.log(T.muted('  └') + T.accent('─'.repeat(40)));
}

// ─── INSTRUCTION DISPLAY ─────────────────────────────────────────────────────

export function printInstruction(instruction) {
  console.log();
  console.log(
    T.muted(`  ${ICONS.step} `) + T.dim('"') + T.white(instruction.slice(0, 80)) +
    (instruction.length > 80 ? T.muted('…') : '') + T.dim('"')
  );
}

// ─── SPINNERS ─────────────────────────────────────────────────────────────────

export function createSpinner(text) {
  return ora({
    text: T.dim(`  ${ICONS.ai}  ${text}`),
    color: 'cyan',
    spinner: {
      interval: 80,
      frames: ['⠋','⠙','⠹','⠸','⠼','⠴','⠦','⠧','⠇','⠏'],
    },
    indent: 2,
  });
}

// ─── COMMAND BOX ─────────────────────────────────────────────────────────────

export function printCommandBox(command, { fallback = false } = {}) {
  console.log();
  console.log(T.muted('  ┌────────────── ') + T.section('Command') + T.muted(' ─────────────────'));
  console.log(T.muted('  │  ') + T.cmd(`$ ${command}`));
  if (fallback) {
    console.log(T.muted('  │  ') + T.dim(`${ICONS.bolt} Generated via direct AI fallback`));
  }
  console.log(T.muted('  └──────────────────────────────────────────'));
}

// ─── SAFETY INDICATOR ────────────────────────────────────────────────────────

export function printSafetyIndicator(score, decision) {
  const bar = buildRiskBar(score);
  const label = {
    safe:    T.success(`${ICONS.success}  Safe`),
    confirm: T.warn(`${ICONS.warn}  Needs Review`),
    blocked: T.error(`${ICONS.lock}  Blocked`),
  }[decision] ?? T.muted('Unknown');

  console.log(T.muted('  │  ') + label + T.muted('  ') + bar + T.muted(`  ${score}/100`));
}

function buildRiskBar(score) {
  const filled = Math.round(score / 10);
  const barColor = score < 40 ? chalk.hex('#4ADE80') : score < 70 ? chalk.hex('#FBBF24') : chalk.hex('#F87171');
  return barColor('█'.repeat(filled)) + T.muted('░'.repeat(10 - filled));
}

// ─── RESULT BLOCKS ───────────────────────────────────────────────────────────

export function printSimulationResult(ctx) {
  console.log();
  console.log(T.muted('  ┌────────────── ') + T.section('Simulation') + T.muted(' ──────────────'));
  console.log(T.muted('  │'));
  console.log(T.muted('  │  ') + T.muted('Command:    ') + T.cmd(ctx.command));
  if (ctx.simulationResult?.prediction) {
    console.log(T.muted('  │  ') + T.muted('Prediction: ') + T.white(ctx.simulationResult.prediction));
  }
  if (ctx.simulationResult?.affectedPaths?.length) {
    console.log(T.muted('  │  ') + T.muted('Paths:      ') + chalk.cyan(ctx.simulationResult.affectedPaths.join(', ')));
  }
  if (ctx.simulationResult?.isDestructive) {
    console.log(T.muted('  │'));
    console.log(T.muted('  │  ') + T.error(`${ICONS.warn}  Destructive — data may be permanently lost.`));
  }
  console.log(T.muted('  └──────────────────────────────────────────'));
}

export function printSuccess() {
  console.log();
  console.log(T.success(`  ${ICONS.success}  `) + T.dim('Command completed successfully.'));
}

export function printError(err) {
  console.log();
  console.log(T.muted('  ┌────────────── ') + T.error(`${ICONS.error}  Error`) + T.muted(' ──────────────────────'));
  console.log(T.muted('  │  ') + T.error(err.message || String(err)));
  if (err.hint) {
    console.log(T.muted('  │  ') + T.dim('Hint: ') + T.muted(err.hint));
  }
  console.log(T.muted('  └──────────────────────────────────────────'));
}

export function printBlocked(ctx) {
  console.log();
  console.log(T.muted('  ┌────────────── ') + T.error(`${ICONS.lock}  Command Blocked`) + T.muted(' ───────────'));
  console.log(T.muted('  │  ') + T.muted('Risk score: ') + T.error(`${ctx.safetyScore}/100`));
  if (ctx.safetyReason) {
    console.log(T.muted('  │  ') + T.muted('Reason: ') + T.error(ctx.safetyReason));
  }
  console.log(T.muted('  └──────────────────────────────────────────'));
}

export function printAutoFix(original, fixed) {
  console.log();
  console.log(T.muted('  ┌────────────── ') + T.warn(`${ICONS.fix}  AI Suggested Fix`) + T.muted(' ──────────'));
  console.log(T.muted('  │  ') + T.muted('Original: ') + T.error(original));
  console.log(T.muted('  │  ') + T.muted('Fixed:    ') + T.success(fixed));
  console.log(T.muted('  └──────────────────────────────────────────'));
}

export function printExplanation(explanation) {
  console.log();
  console.log(T.muted('  ┌────────────── ') + T.section(`${ICONS.explain}  Explanation`) + T.muted(' ─────────────'));
  explanation.split('\n').forEach(line => {
    if (line.trim()) console.log(T.muted('  │  ') + T.white(line));
  });
  console.log(T.muted('  └──────────────────────────────────────────'));
}

export function printAborted(reason = 'Operation aborted.') {
  console.log();
  console.log(T.muted(`  ${ICONS.arrow}  ${reason}`));
  console.log();
}

// ─── PROMPTS ─────────────────────────────────────────────────────────────────

export async function confirmDangerousCommand(command, score) {
  console.log();
  console.log(T.warn(`  ${ICONS.warn}  High-Risk Command`) + T.muted(` — risk score ${score}/100`));
  console.log(T.muted('  ┌──────────────────────────────────────────'));
  console.log(T.muted('  │  ') + T.cmd(`$ ${command}`));
  console.log(T.muted('  └──────────────────────────────────────────'));
  console.log();
  const { proceed } = await inquirer.prompt([{
    type: 'confirm',
    name: 'proceed',
    message: chalk.yellow('  Execute this command?'),
    default: false,
  }]);
  return proceed;
}

export async function confirmAutoFix() {
  const { proceed } = await inquirer.prompt([{
    type: 'confirm',
    name: 'proceed',
    message: chalk.yellow('  Apply AI suggested fix?'),
    default: true,
  }]);
  return proceed;
}

// ─── CHAIN DISPLAY ────────────────────────────────────────────────────────────

export function printChainStart(parts) {
  console.log();
  console.log(T.muted('  ') + T.section('Chain') + T.dim(` — ${parts.length} steps`));
  parts.forEach((p, i) => {
    console.log(T.muted(`    ${String(i + 1).padStart(2)}.`) + ' ' + T.dim(p));
  });
  console.log();
}

export function printStepHeader(index, total, instruction) {
  console.log(
    '\n  ' + T.accent(`[${index}/${total}]`) + ' ' + T.dim(instruction.slice(0, 65))
  );
}

export function printChainDone() {
  console.log();
  console.log(T.muted('  ─────────────────────────────────────────'));
  console.log(T.success(`  ${ICONS.success}  `) + T.dim('All steps complete.'));
  console.log();
}

// ─── FULL RESULT PRINTER ─────────────────────────────────────────────────────

/**
 * Top-level helper — renders the complete pipeline result.
 * Used by CLIInterface to render the final ctx after the engine runs.
 */
export function renderResult(ctx, { dryRun = false, explain = false } = {}) {
  if (ctx.safetyDecision === 'blocked') {
    printBlocked(ctx);
    return;
  }

  if (dryRun && ctx.simulationResult) {
    printSimulationResult(ctx);
    return;
  }

  if (ctx.command) printCommandBox(ctx.command, { fallback: ctx.usedFallback });

  if (ctx.error) {
    printError(ctx.error);
  } else {
    printSuccess();
  }

  if (ctx.correctedCommand) {
    printAutoFix(ctx.command, ctx.correctedCommand);
  }

  if (explain && ctx.explanation) {
    printExplanation(ctx.explanation);
  }
}
