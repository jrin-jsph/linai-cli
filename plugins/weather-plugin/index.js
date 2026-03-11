/**
 * Weather Plugin
 * 
 * Teaches LinAI how to parse "get weather for [city]"
 * and map it to a curl wttr.in/[city] command.
 */

export async function register({ logger }) {
  logger.info('[weather-plugin] Registered');
}

/**
 * Register custom intent examples.
 */
export function registerIntents(intentParser) {
  intentParser.addExample('get weather for London', {
    action: 'weather',
    target: 'city',
    filters: { city: 'London' }
  });
}

/**
 * Register custom command mappings.
 */
export function registerMappings(commandGenerator) {
  commandGenerator.addMapping('Intent action "weather" with target "city" -> use `curl wttr.in/[city]`');
}
