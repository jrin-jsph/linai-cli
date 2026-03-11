/**
 * PluginLoader — Plugin Discovery, Validation & Registration
 *
 * Scans the plugins directory, validates plugin.json manifests,
 * and registers lifecycle hooks that plugins can subscribe to.
 *
 * Plugin Hook Points:
 *   - pre-execute: runs before ExecutionEngine
 *   - post-execute: runs after ExecutionEngine
 *   - custom-command: adds new CLI commands
 *   - intent-transform: can mutate the parsed intent
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { eventBus } from '../utils/eventBus.js';
import { logger } from '../utils/logger.js';
import { getConfig } from '../utils/config.js';

const VALID_HOOKS = ['pre-execute', 'post-execute', 'custom-command', 'intent-transform'];

export class PluginLoader {
  constructor() {
    this.config = getConfig();
    this.plugins = [];
  }

  /**
   * Discovers and loads all plugins from the plugins directory.
   * @returns {Promise<object[]>} loaded plugins
   */
  async load() {
    const __dirname = path.dirname(fileURLToPath(import.meta.url));
    const defaultPluginsDir = path.join(__dirname, '../../plugins');
    const pluginsDir = this.config.plugins?.directory || defaultPluginsDir;

    if (!fs.existsSync(pluginsDir)) {
      logger.debug(`[PluginLoader] No plugins directory found at ${pluginsDir}. Skipping.`);
      return [];
    }

    const entries = fs.readdirSync(pluginsDir, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const pluginDir = path.join(pluginsDir, entry.name);
      await this._loadPlugin(pluginDir);
    }

    logger.info(`[PluginLoader] Loaded ${this.plugins.length} plugin(s).`);
    return this.plugins;
  }

  /**
   * Loads and validates a single plugin.
   * @param {string} pluginDir
   */
  async _loadPlugin(pluginDir) {
    const manifestPath = path.join(pluginDir, 'plugin.json');
    const entryPath = path.join(pluginDir, 'index.js');

    if (!fs.existsSync(manifestPath) || !fs.existsSync(entryPath)) {
      logger.warn(`[PluginLoader] Skipping ${pluginDir} — missing plugin.json or index.js`);
      return;
    }

    let manifest;
    try {
      manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    } catch (err) {
      logger.warn(`[PluginLoader] Invalid plugin.json in ${pluginDir}: ${err.message}`);
      return;
    }

    if (!manifest.name || !manifest.version) {
      logger.warn(`[PluginLoader] Plugin at ${pluginDir} missing required fields (name, version).`);
      return;
    }

    // Validate hooks
    const hooks = (manifest.hooks || []).filter((h) => {
      if (!VALID_HOOKS.includes(h)) {
        logger.warn(`[PluginLoader] Unknown hook '${h}' in plugin '${manifest.name}'.`);
        return false;
      }
      return true;
    });

    // Load and initialize plugin
    try {
      // On Windows, absolute paths for dynamic imports must be prefixed with file://
      const entryUrl = path.sep === '\\' ? `file://${entryPath.replace(/\\/g, '/')}` : entryPath;
      const mod = await import(entryUrl);
      
      if (typeof mod.register === 'function') {
        await mod.register({ eventBus, hooks, logger });
      }

      this.plugins.push({ manifest, hooks, dir: pluginDir, module: mod });
      logger.info(`[PluginLoader] Loaded plugin: ${manifest.name}@${manifest.version}`);
    } catch (err) {
      logger.error(`[PluginLoader] Failed to load plugin '${manifest.name}': ${err.message}`);
    }
  }
}
