/**
 * Example Plugin — Git Shortcuts
 *
 * Demonstrates the LinAI plugin system.
 * Registers a 'post-execute' hook to log every execution.
 */

export async function register({ eventBus, hooks, logger }) {
  logger.info('[example-plugin] Registered');

  if (hooks.includes('post-execute')) {
    eventBus.on('command.executed', (ctx) => {
      logger.info(`[example-plugin] Command ran: ${ctx.command} (exit ${ctx.executionResult?.exitCode})`);
    });
  }
}

export function registerCommands(program) {
  program
    .command('hello-plugin')
    .description('A simple test command added by example-plugin')
    .action(() => {
      console.log('Hello from the example plugin!');
    });
}
