/**
 * CommandChainEngine — Core Pipeline Orchestrator
 *
 * Runs each module in sequence, passing a shared mutable
 * 'context' object through the pipeline.
 *
 * Pipeline:
 *   ContextDetector → IntentParser → ParameterExtractor
 *   → CommandGenerator → SafetyFilter → SimulationEngine
 *   → ExecutionEngine → LearningEngine → CommandExplainEngine
 */

import inquirer from 'inquirer';
import chalk from 'chalk';
import ora from 'ora';
import { ContextDetector } from '../context/ContextDetector.js';
import { IntentParser } from '../parser/IntentParser.js';
import { ParameterExtractor } from '../parser/ParameterExtractor.js';
import { CommandGenerator } from '../parser/CommandGenerator.js';
import { SafetyFilter } from '../safety/SafetyFilter.js';
import { SimulationEngine } from '../simulation/SimulationEngine.js';
import { ExecutionEngine } from '../execution/ExecutionEngine.js';
import { ErrorHandler } from '../execution/ErrorHandler.js';
import { AIAutoFixEngine } from '../autofix/AIAutoFixEngine.js';
import { CommandExplainEngine } from '../explain/CommandExplainEngine.js';
import { LearningEngine } from '../learning/LearningEngine.js';
import { AIExecutor } from '../ai/AIExecutor.js';
import { logger } from '../utils/logger.js';
import { eventBus } from '../utils/eventBus.js';

export class CommandChainEngine {
  constructor(options = {}) {
    this.contextDetector = new ContextDetector();
    this.intentParser = new IntentParser();
    this.paramExtractor = new ParameterExtractor();
    this.commandGenerator = new CommandGenerator();
    this.safetyFilter = new SafetyFilter();
    this.simulationEngine = new SimulationEngine();
    this.executionEngine = new ExecutionEngine();
    this.errorHandler = new ErrorHandler();
    this.autoFixEngine = new AIAutoFixEngine();
    this.explainEngine = new CommandExplainEngine();
    this.learningEngine = new LearningEngine();

    this.options = {
      dryRun: false,
      explain: true,
      maxRetries: 2,
      plugins: [],
      ...options,
    };

    // Initialize plugins with parsers
    this._initPlugins();
  }

  /**
   * Initializes plugins by calling their registration hooks.
   * @private
   */
  _initPlugins() {
    if (!this.options.plugins || !this.options.plugins.length) return;

    for (const plugin of this.options.plugins) {
      const mod = plugin.module;
      if (!mod) continue;

      // 1. Intent registration (custom examples)
      if (plugin.hooks.includes('intent-transform') && typeof mod.registerIntents === 'function') {
        mod.registerIntents(this.intentParser);
      }

      // 2. Mapping registration (custom generators)
      if (plugin.hooks.includes('custom-command') && typeof mod.registerMappings === 'function') {
        mod.registerMappings(this.commandGenerator);
      }
    }
  }

  /**
   * Creates a fresh pipeline context from raw user input.
   * @param {string} rawInput
   * @returns {object} context
   */
  createContext(rawInput) {
    return {
      rawInput,
      intent: null,
      params: null,
      command: null,
      context: null,
      safetyScore: 0,
      safetyDecision: null, // 'safe' | 'confirm' | 'blocked'
      simulationResult: null,
      executionResult: null,
      error: null,
      correctedCommand: null,
      explanation: null,
      pluginData: {},
      retryCount: 0,
    };
  }

  /**
   * Main entry point — runs the full pipeline for a given natural language input.
   * @param {string} rawInput
   * @returns {Promise<object>} final context
   */
  async run(rawInput) {
    const ctx = this.createContext(rawInput);
    logger.debug(`[Chain] Starting pipeline for: "${rawInput}"`);

    try {
      // 1. Detect environment context
      ctx.context = await this.contextDetector.detect();
      eventBus.emit('context.detected', ctx);

      // 2–4. Parse intent → extract params → generate command
      //       Falls back to direct AI generation if any step fails.
      try {
        ctx.intent = await this.intentParser.parse(ctx.rawInput, ctx.context);
        eventBus.emit('intent.parsed', ctx);

        ctx.params = await this.paramExtractor.extract(ctx.intent, ctx.context);
        eventBus.emit('params.extracted', ctx);

        ctx.command = await this.commandGenerator.generate(ctx.intent, ctx.params, ctx.context);
        eventBus.emit('command.generated', ctx);
      } catch (parseErr) {
        logger.warn(`[Chain] Intent pipeline failed (${parseErr.message}) — using direct AI fallback.`);
        ctx.usedFallback = true;
        ctx.command = await this._directFallback(ctx.rawInput, ctx.context);
        eventBus.emit('command.generated', ctx);
      }

      // 5. Safety check
      const safetyResult = await this.safetyFilter.check(ctx.command, ctx.context);
      ctx.safetyScore = safetyResult.score;
      ctx.safetyDecision = safetyResult.decision;
      eventBus.emit('command.safety.checked', ctx);

      if (ctx.safetyDecision === 'blocked') {
        logger.warn(`[Safety] Command blocked (score: ${ctx.safetyScore}): ${ctx.command}`);
        return ctx;
      }

      // 6. Simulate (dry-run) if requested
      if (this.options.dryRun) {
        ctx.simulationResult = await this.simulationEngine.simulate(ctx.command, ctx.context);
        eventBus.emit('command.simulated', ctx);
        return ctx;
      }

      // 7. Execute
      await this._executeWithRetry(ctx);

      // 8. Log successful command to learning engine
      if (!ctx.error) {
        await this.learningEngine.log(ctx);
        eventBus.emit('command.executed', ctx);
      }

      // 9. Explain the command
      if (this.options.explain && ctx.command) {
        ctx.explanation = await this.explainEngine.explain(ctx.command);
        eventBus.emit('command.explained', ctx);
      }

    } catch (err) {
      logger.error(`[Chain] Unhandled error: ${err.message}`);
      ctx.error = err;
    }

    return ctx;
  }

  /**
   * Executes the command, retrying with AI auto-fix on failure after user confirmation.
   * @param {object} ctx
   */
  async _executeWithRetry(ctx) {
    ctx.executionResult = await this.executionEngine.execute(ctx.command);

    if (ctx.executionResult.exitCode !== 0 && ctx.retryCount < this.options.maxRetries) {
      ctx.error = this.errorHandler.handle(ctx.executionResult);
      eventBus.emit('command.failed', ctx);

      // Print the error out early so the user sees what went wrong before the autofix prompt
      console.log(chalk.red(`\n  ✖  Command failed: ${ctx.error.message}`));

      const spinner = ora({ text: chalk.dim('  AI analyzing error...'), color: 'cyan', indent: 2 }).start();
      const fixed = await this.autoFixEngine.fix(ctx.command, ctx.executionResult.stderr, ctx.context);
      spinner.stop();

      if (fixed && fixed !== ctx.command) {
        console.log(chalk.yellow(`\n  ⚠  AI suggested fix:`));
        console.log(chalk.dim('  Original: ') + chalk.red(ctx.command));
        console.log(chalk.dim('  Fixed:    ') + chalk.green(fixed) + '\n');

        const { proceed } = await inquirer.prompt([
          {
            type: 'confirm',
            name: 'proceed',
            message: '  Run suggested fix?',
            default: true,
          },
        ]);

        if (proceed) {
          ctx.correctedCommand = fixed;
          ctx.command = fixed;
          ctx.retryCount++;
          console.log(); // Spacing for retry output
          await this._executeWithRetry(ctx);
        } else {
          console.log(chalk.dim('  Auto-fix skipped.'));
        }
      }
    } else if (ctx.executionResult.exitCode === 0) {
      ctx.error = null;
    }
  }

  /**
   * Direct AI fallback: bypasses intent/param pipeline.
   * Sends the raw user input to AI with a minimal system prompt
   * and returns a clean Linux command string.
   *
   * @param {string} rawInput
   * @param {object} envContext
   * @returns {Promise<string>} shell command
   */
  async _directFallback(rawInput, envContext = {}) {
    logger.debug(`[Chain] _directFallback for: "${rawInput}"`);

    const ai = new AIExecutor();
    const response = await ai.complete({
      system: `You are a Linux command generator.
Given a natural language instruction, respond with ONLY the exact shell command to run.
No explanation, no markdown, no backticks — just the command.
If multiple commands are needed, separate them with " && ".
Environment: distro=${envContext.distro || 'Linux'}, shell=${envContext.shell || 'bash'}`,
      user: rawInput,
    });

    const command = response.trim().replace(/^`+|`+$/g, '');
    logger.debug(`[Chain] Direct fallback generated: ${command}`);
    return command;
  }
}
