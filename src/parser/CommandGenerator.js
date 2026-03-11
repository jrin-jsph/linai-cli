/**
 * CommandGenerator — Intent + Params → Shell Command String
 *
 * Builds the final Linux shell command using the intent and extracted parameters.
 * Uses AI for complex generation; falls back to template matching for common patterns.
 */

import { AIExecutor } from '../ai/AIExecutor.js';
import { logger } from '../utils/logger.js';

const SYSTEM_PROMPT = `You are a Linux shell command generator.
Given an intent object, parameters, and environment context, produce the exact Linux shell command to execute.
Rules:
- Respond with ONLY the command string, no markdown, no explanation, no backticks.
- Prefer POSIX-compatible commands unless the distro requires otherwise.
- If multiple commands are needed, separate them with " && ".
- Never include sudo unless absolutely necessary.

MANDATORY MAPPINGS:
- Intent "create folder" -> use \`mkdir\` (e.g., \`mkdir folder_name\`)
- Intent "create file" -> use \`touch\` (e.g., \`touch file_name\`)
- Intent "list files" -> use \`ls\` (e.g., \`ls\` or \`ls -la\`)

Example 1 (create folder):
Intent: {"action": "create", "target": "folder"}
Params: {"folderName": "project"}
Output: mkdir project

Example 2 (create file):
Intent: {"action": "create", "target": "file"}
Params: {"fileName": "index.js"}
Output: touch index.js

Example 3 (list files):
Intent: {"action": "list", "target": "files"}
Params: {}
Output: ls -la

Example 4 (complex):
Intent: {"action": "find", "target": "files", "filters": {"type": "log", "mtime": "+7"}}
Output: find /var/log -name '*.log' -mtime +7 -delete`;

export class CommandGenerator {
  constructor() {
    this.ai = new AIExecutor();
    this.customMappings = [];
  }

  /**
   * Adds a custom command mapping for AI prompt.
   * @param {string} rule - plain-english description of the mapping rule
   */
  addMapping(rule) {
    this.customMappings.push(rule);
  }

  /**
   * Generates a shell command string from intent and params.
   * @param {object} intent
   * @param {object} params
   * @param {object} envContext
   * @returns {Promise<string>} command
   */
  async generate(intent, params, envContext = {}) {
    logger.debug(`[CommandGenerator] Generating for intent: ${intent.action} ${intent.target}`);

    let dynamicPrompt = SYSTEM_PROMPT;
    if (this.customMappings.length > 0) {
      const mappingSection = '\n\nCUSTOM PLUGIN MAPPINGS:\n' + this.customMappings.map(m => `- ${m}`).join('\n');
      dynamicPrompt += mappingSection;
    }

    const userMessage = [
      `Intent: ${JSON.stringify(intent)}`,
      `Parameters: ${JSON.stringify(params)}`,
      `Environment: distro=${envContext.distro}, shell=${envContext.shell}, cwd=${envContext.cwd}`,
      `Available tools: ${(envContext.availableTools || []).join(', ')}`,
    ].join('\n');

    const command = await this.ai.complete({
      system: dynamicPrompt,
      user: userMessage,
    });

    const cleaned = command.trim().replace(/^`+|`+$/g, '');
    logger.debug(`[CommandGenerator] Generated: ${cleaned}`);
    return cleaned;
  }
}
