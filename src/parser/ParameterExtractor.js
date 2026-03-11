/**
 * ParameterExtractor — Intent → Typed Parameters
 *
 * Converts a structured Intent into concrete, typed parameters
 * ready for use by CommandGenerator.
 *
 * Output shape:
 * {
 *   path: string,
 *   pattern: string,
 *   user: string,
 *   port: number,
 *   mtime: string,
 *   permissions: string,
 *   extra: object   // any other extracted params
 * }
 */

import { AIExecutor } from '../ai/AIExecutor.js';
import { logger } from '../utils/logger.js';

const SYSTEM_PROMPT = `You are a Linux command parameter extractor.
Given a structured intent object and environment context, extract concrete shell-ready parameters.
Respond ONLY with a valid JSON object containing any relevant parameters. 
Crucially, extract specific names/targets into these fields if present in the intent filters or raw string:
- folderName (string): name of a folder/directory to create, delete, or target
- fileName (string): name of a file to create, delete, or target
- packageName (string): name of a package to install, update, or remove
- targetName (string): general fallback for the primary target (e.g. project name)
- path (string): filesystem path if applicable
- pattern (string): glob/regex pattern if applicable
- user (string): username if applicable
- port (number): port number if applicable
- mtime (string): find-style time modifier, e.g. "+7"
- permissions (string): chmod-style permissions e.g. "755"
- extra (object): any other parameters not covered above

Example 1: Intent to create folder "project"
{"folderName": "project"}

Example 2: Intent to install package "express"
{"packageName": "express"}

Example 3: Intent to delete file "old.log" in "/var/log"
{"fileName": "old.log", "path": "/var/log"}

Always respond with ONLY the JSON, no markdown, no explanation.`;

export class ParameterExtractor {
  constructor() {
    this.ai = new AIExecutor();
  }

  /**
   * Extracts typed parameters from a parsed intent.
   * @param {object} intent
   * @param {object} envContext
   * @returns {Promise<object>} params
   */
  async extract(intent, envContext = {}) {
    logger.debug(`[ParameterExtractor] Extracting from intent: ${JSON.stringify(intent)}`);

    const userMessage = `Intent: ${JSON.stringify(intent)}\nEnvironment: cwd=${envContext.cwd}, shell=${envContext.shell}, distro=${envContext.distro}`;

    const response = await this.ai.complete({
      system: SYSTEM_PROMPT,
      user: userMessage,
    });

    try {
      const params = JSON.parse(response);
      logger.debug(`[ParameterExtractor] Params: ${JSON.stringify(params)}`);
      return params;
    } catch (err) {
      logger.warn(`[ParameterExtractor] Could not parse AI response: ${response}`);
      return { extra: {} };
    }
  }
}
