/**
 * InputSplitter — Multi-Command Sentence Splitter
 *
 * Splits a natural language instruction into multiple sub-instructions
 * when the user chains commands using:
 *   - "and"   →  "create folder then list it" ✗ / "mkdir foo and cd foo" ✓
 *   - "then"  →  "create folder then run app"
 *   - ","     →  "install nginx, start it, check status"
 *
 * Examples:
 *   "create folder project and install deps, then run tests"
 *   → ["create folder project", "install deps", "run tests"]
 *
 *   "list files, show disk usage and kill port 3000"
 *   → ["list files", "show disk usage", "kill port 3000"]
 *
 * Single-word guard: sub-instructions with fewer than 2 words are dropped.
 */

/**
 * Ordered list of split patterns.
 * Each entry is a regex that matches a separator to split on.
 * All patterns require at least one space on each side so we don't
 * split inside compound words like "find-and-replace".
 */
const SPLIT_PATTERNS = [
  /\s+then\s+/gi,   // " then "
  /\s+and\s+/gi,    // " and "
  /\s*,\s*/g,       // ", " or ","
];

/**
 * Splits a raw user instruction into an array of sub-instructions.
 *
 * @param {string} input - raw NL input from the user
 * @returns {string[]} array of trimmed sub-instructions (always >= 1 element)
 */
export function splitInput(input) {
  if (!input || !input.trim()) return [];

  let parts = [input.trim()];

  // Apply each splitter in sequence
  for (const pattern of SPLIT_PATTERNS) {
    parts = parts.flatMap((part) =>
      part.split(pattern).map((s) => s.trim()).filter(Boolean)
    );
    // Reset lastIndex for stateful global regexes
    pattern.lastIndex = 0;
  }

  // Drop any fragment that is too short to be meaningful (< 2 words)
  const meaningful = parts.filter((p) => p.split(/\s+/).length >= 2);

  // If everything got filtered out (e.g. single-word input), return original
  return meaningful.length > 0 ? meaningful : [input.trim()];
}

/**
 * Returns true if the input contains any split token.
 * Useful for deciding whether to show multi-command UI.
 *
 * @param {string} input
 * @returns {boolean}
 */
export function hasMultipleCommands(input) {
  return splitInput(input).length > 1;
}
