/**
 * SetupWizard — Interactive AI Provider Setup
 *
 * Prompts the user to choose an AI provider and enter their API key.
 * Saves the result to ~/.linai/config.json for all future sessions.
 */

import inquirer from 'inquirer';
import chalk from 'chalk';
import { writeUserConfig, readUserConfig } from '../utils/UserConfigManager.js';
import { invalidateCache } from '../utils/config.js';

const PROVIDERS = [
  {
    name: `${chalk.bold.blue('Gemini')}       ${chalk.dim('(Google — gemini-1.5-flash)')}`,
    value: 'gemini',
    envKey: 'GEMINI_API_KEY',
    keyHint: 'Get yours at https://aistudio.google.com/app/apikey',
  },
  {
    name: `${chalk.bold.green('OpenAI')}       ${chalk.dim('(GPT-4o)')}`,
    value: 'openai',
    envKey: 'OPENAI_API_KEY',
    keyHint: 'Get yours at https://platform.openai.com/api-keys',
  },
  {
    name: `${chalk.bold.magenta('Claude')}       ${chalk.dim('(Anthropic — claude-3-5-sonnet)')}`,
    value: 'anthropic',
    envKey: 'ANTHROPIC_API_KEY',
    keyHint: 'Get yours at https://console.anthropic.com/',
  },
  {
    name: `${chalk.bold.yellow('Other')}        ${chalk.dim('(Custom OpenAI-compatible endpoint)')}`,
    value: 'other',
    envKey: 'CUSTOM_API_KEY',
    keyHint: 'Enter API key (or any text if your local model does not require one)',
  },
];

export class SetupWizard {
  async run() {
    console.log('\n' + chalk.bold.cyan('╔══════════════════════════════════╗'));
    console.log(chalk.bold.cyan('║') + '   ' + chalk.bold.white('LinAI — First-Time Setup') + '        ' + chalk.bold.cyan('║'));
    console.log(chalk.bold.cyan('╚══════════════════════════════════╝') + '\n');

    // Show existing config if any
    const existing = readUserConfig();
    if (existing.ai?.provider) {
      console.log(
        chalk.dim('  Current provider: ') +
        chalk.bold.yellow(existing.ai.provider) +
        chalk.dim('  API key: ') +
        chalk.dim(existing.ai.apiKey ? '●●●●●●●●' : 'not set') + '\n'
      );
    }

    // --- 1. Choose provider ---
    const { provider } = await inquirer.prompt([
      {
        type: 'list',
        name: 'provider',
        message: 'Choose your AI provider:',
        choices: PROVIDERS,
        default: existing.ai?.provider || 'gemini',
      },
    ]);

    const providerMeta = PROVIDERS.find(p => p.value === provider);

    // --- 2. Enter API key ---
    console.log('\n' + chalk.dim(`  ${providerMeta.keyHint}`));
    const { apiKey } = await inquirer.prompt([
      {
        type: 'password',
        name: 'apiKey',
        message: `Enter your ${providerMeta.value.toUpperCase()} API key:`,
        mask: '●',
        validate: (val) => {
          if (provider === 'other') return true; // Local models might not need keys
          return val.trim().length > 8 ? true : 'API key appears too short.';
        },
      },
    ]);

    // --- 2.5. Enter Base URL (only for 'other') ---
    let baseURL = '';
    if (provider === 'other') {
      const urlResp = await inquirer.prompt([
        {
          type: 'input',
          name: 'baseURL',
          message: 'Enter the Base URL (e.g., http://localhost:11434/v1):',
          validate: (val) => val.trim().length > 0 ? true : 'Base URL is required for custom providers.',
        },
      ]);
      baseURL = urlResp.baseURL.trim();
    }

    // --- 3. Choose model (optional) ---
    const modelDefaults = {
      gemini:    'gemini-2.0-flash', // Fallbacks to 1.5 if free isn't working
      openai:    'gpt-4o',
      anthropic: 'claude-3-5-sonnet-20241022',
      other:     'llama3',
    };

    const { model } = await inquirer.prompt([
      {
        type: 'input',
        name: 'model',
        message: 'Model name (press Enter for default):',
        default: modelDefaults[provider],
      },
    ]);

    // --- 4. Save ---
    const newConf = {
      ai: {
        provider,
        apiKey: apiKey.trim() || 'none', // Prevent empty string if skipped
        model: model.trim(),
      },
    };

    if (baseURL) {
      newConf.ai.baseURL = baseURL;
    }

    writeUserConfig(newConf);
    invalidateCache();

    console.log('\n' + chalk.green('  ✔ Configuration saved to ~/.linai/config.json'));
    console.log(chalk.dim(`    Provider: ${provider}`));
    if (baseURL) console.log(chalk.dim(`    Base URL: ${baseURL}`));
    console.log(chalk.dim(`    Model:    ${model}`));
    console.log(chalk.dim('    API key:  ●●●●●●●●') + '\n');
    console.log(chalk.bold.cyan('  Ready! Try: ') + chalk.green('linai "create a folder named test"') + '\n');
  }
}
