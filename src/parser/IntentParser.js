/**
 * IntentParser — Natural Language → Structured Intent
 *
 * Sends user input to the AI and returns a structured intent object.
 *
 * Intent shape:
 * {
 *   action: string,        // e.g. 'delete', 'list', 'compress', 'find'
 *   target: string,        // e.g. 'files', 'process', 'directory'
 *   filters: object,       // e.g. { type: 'log', olderThan: '7d' }
 *   modifiers: string[],   // e.g. ['recursive', 'verbose']
 *   raw: string            // original user input
 * }
 */

import { AIExecutor } from '../ai/AIExecutor.js';
import { logger } from '../utils/logger.js';

const SYSTEM_PROMPT = `You are a Linux command intent parser.
Given a natural language instruction, respond ONLY with a valid JSON object with these fields:
- action (string): the primary action to perform (e.g., "create", "delete", "list", "install", "run")
- target (string): what the action operates on (e.g., "folder", "file", "package", "project")
- filters (object): optional key-value filters or constraints
- modifiers (string[]): optional behavioral modifiers like "recursive", "verbose", "force"
- raw (string): the original input

Here are examples of how you must map common intents:

Input: "create folder docs"
{"action": "create", "target": "folder", "filters": {"name": "docs"}, "modifiers": [], "raw": "create folder docs"}

Input: "create file index.js"
{"action": "create", "target": "file", "filters": {"name": "index.js"}, "modifiers": [], "raw": "create file index.js"}

Input: "list files"
{"action": "list", "target": "files", "filters": {}, "modifiers": [], "raw": "list files"}

Input: "delete file old.log"
{"action": "delete", "target": "file", "filters": {"name": "old.log"}, "modifiers": [], "raw": "delete file old.log"}

Input: "install package express"
{"action": "install", "target": "package", "filters": {"name": "express"}, "modifiers": [], "raw": "install package express"}

Input: "run project"
{"action": "run", "target": "project", "filters": {}, "modifiers": [], "raw": "run project"}

Always respond with ONLY the JSON, no markdown, no explanation.`;

export class IntentParser {
  constructor() {
    this.ai = new AIExecutor();
    this.customExamples = [];
  }

  /**
   * Adds a custom intent example for AI prompt.
   * @param {string} input - user-like input string
   * @param {object} intent - expected intent object
   */
  addExample(input, intent) {
    this.customExamples.push({ input, intent: JSON.stringify(intent) });
  }

  /**
   * Parses raw user input into a structured intent.
   * @param {string} rawInput
   * @param {object} envContext - environment context from ContextDetector
   * @returns {Promise<object>} intent
   */
  async parse(rawInput, envContext = {}) {
    logger.debug(`[IntentParser] Parsing: "${rawInput}"`);

    let dynamicPrompt = SYSTEM_PROMPT;
    if (this.customExamples.length > 0) {
      dynamicPrompt += '\n\nCustom Plugin Examples:\n';
      this.customExamples.forEach(ex => {
        dynamicPrompt += `Input: "${ex.input}"\n${ex.intent}\n\n`;
      });
    }

    const userMessage = `Environment: ${envContext.distro || 'Linux'}, Shell: ${envContext.shell || 'bash'}\nInstruction: ${rawInput}`;

    const response = await this.ai.complete({
      system: dynamicPrompt,
      user: userMessage,
    });

    try {
      const intent = JSON.parse(response);
      intent.raw = rawInput;
      logger.debug(`[IntentParser] Intent: ${JSON.stringify(intent)}`);
      return intent;
    } catch (err) {
      logger.warn(`[IntentParser] Failed to parse AI response as JSON: ${response}`);
      throw new Error(`IntentParser: Could not parse AI response into valid JSON.\nRaw response: ${response}`);
    }
  }
}
