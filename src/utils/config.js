/**
 * config — Configuration Loader
 *
 * Loads config from:
 * 1. config/default.json (defaults)
 * 2. config/user.json (user overrides, gitignored)
 * 3. Environment variables (highest priority)
 *
 * Result is a deep-merged config object.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import 'dotenv/config';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CONFIG_DIR = path.resolve(__dirname, '../../config');

const DEFAULT_CONFIG = {
  ai: {
    provider: 'openai',
    model: 'gpt-4o',
    fallbackProviders: [],
    geminiModel: 'gemini-1.5-flash',
    ollamaModel: 'llama3',
    anthropicModel: 'claude-3-5-sonnet-20241022',
    temperature: 0.2,
  },
  safety: {
    level: 'strict',
    requireConfirmationAbove: 70,
    blockAbove: 95,
  },
  execution: {
    dryRunByDefault: false,
    timeout: 30000,
    explain: true,
    maxRetries: 2,
  },
  learning: {
    enabled: true,
    maxHistoryEntries: 1000,
  },
  plugins: {
    directory: null, // resolved at runtime
    autoLoad: true,
  },
};

function deepMerge(target, source) {
  const result = { ...target };
  for (const key of Object.keys(source)) {
    if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
      result[key] = deepMerge(target[key] || {}, source[key]);
    } else {
      result[key] = source[key];
    }
  }
  return result;
}

function loadJSON(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return {};
  }
}

import os from 'os';

let _cached = null;

export function invalidateCache() {
  _cached = null;
}

export function getConfig() {
  if (_cached) return _cached;

  const defaultConf  = loadJSON(path.join(CONFIG_DIR, 'default.json'));
  const userConf     = loadJSON(path.join(CONFIG_DIR, 'user.json'));
  const homeConf     = loadJSON(path.join(os.homedir(), '.linai', 'config.json'));

  // Merge: DEFAULT_CONFIG ← default.json ← user.json ← ~/.linai/config.json ← env
  let config = deepMerge(DEFAULT_CONFIG, defaultConf);
  config = deepMerge(config, userConf);
  config = deepMerge(config, homeConf);

  // Override from environment
  if (process.env.LINAI_AI_PROVIDER)  config.ai.provider  = process.env.LINAI_AI_PROVIDER;
  if (process.env.LINAI_AI_MODEL)     config.ai.model     = process.env.LINAI_AI_MODEL;
  if (process.env.LINAI_DRY_RUN === 'true') config.execution.dryRunByDefault = true;
  if (process.env.LINAI_LOG_LEVEL)    config.logLevel     = process.env.LINAI_LOG_LEVEL;

  // Transfer API keys from env if not already set by user config
  if (!config.ai.apiKey) {
    if (config.ai.provider === 'openai'    && process.env.OPENAI_API_KEY)    config.ai.apiKey = process.env.OPENAI_API_KEY;
    if (config.ai.provider === 'gemini'    && process.env.GEMINI_API_KEY)    config.ai.apiKey = process.env.GEMINI_API_KEY;
    if (config.ai.provider === 'anthropic' && process.env.ANTHROPIC_API_KEY) config.ai.apiKey = process.env.ANTHROPIC_API_KEY;
  }

  _cached = config;
  return config;
}
