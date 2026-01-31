/**
 * Picky Command Parser
 * Parses messages to detect Picky bot commands like:
 * "Picky find top 3 events" or "picky find top 5 food"
 */

export type PickyCommandType = 'events' | 'food';

export interface PickyCommand {
  type: PickyCommandType;
  count: number; // 1-6
  rawMessage: string;
}

/**
 * Parse a message to detect Picky commands
 * Looks for patterns like: "Picky find top [X] events/food"
 * The keywords can appear in any order and are case-insensitive
 */
export function parsePickyCommand(message: string): PickyCommand | null {
  const text = message.toLowerCase().trim();
  
  // Check for required keywords
  const hasPickyKeyword = /\bpicky\b/.test(text);
  const hasFindKeyword = /\bfind\b/.test(text);
  const hasTopKeyword = /\btop\b/.test(text);
  
  // Check for type keywords
  const hasEventsKeyword = /\bevents?\b/.test(text);
  const hasFoodKeyword = /\bfood\b|restaurants?\b|eat(ing|s)?\b|dining\b/.test(text);
  
  // Must have "picky", "find", "top", and either events or food
  if (!hasPickyKeyword || !hasFindKeyword || !hasTopKeyword) {
    return null;
  }
  
  if (!hasEventsKeyword && !hasFoodKeyword) {
    return null;
  }
  
  // Extract the number (1-6)
  // Look for patterns like: "top 3", "top [3]", "top 3 of", etc.
  const numberMatch = text.match(/top\s*\[?(\d+)\]?/);
  let count = 3; // default to 3
  
  if (numberMatch) {
    const parsed = parseInt(numberMatch[1], 10);
    if (parsed >= 1 && parsed <= 6) {
      count = parsed;
    } else if (parsed > 6) {
      count = 6; // cap at 6
    } else {
      count = 1; // minimum 1
    }
  }
  
  // Determine the type - if both are present, prioritize based on position
  let type: PickyCommandType = 'events';
  
  if (hasEventsKeyword && hasFoodKeyword) {
    // Use the one that appears last (most likely the intended one)
    const eventsIndex = text.lastIndexOf('event');
    const foodIndex = Math.max(
      text.lastIndexOf('food'),
      text.lastIndexOf('restaurant'),
      text.lastIndexOf('eat'),
      text.lastIndexOf('dining')
    );
    type = foodIndex > eventsIndex ? 'food' : 'events';
  } else if (hasFoodKeyword) {
    type = 'food';
  }
  
  return {
    type,
    count,
    rawMessage: message,
  };
}

/**
 * Check if a message is a Picky command
 */
export function isPickyCommand(message: string): boolean {
  return parsePickyCommand(message) !== null;
}

/**
 * Generate a friendly message describing what Picky is searching for
 */
export function getPickySearchDescription(command: PickyCommand): string {
  const typeLabel = command.type === 'events' ? 'events' : 'places to eat';
  return `Finding the top ${command.count} ${typeLabel} for your group...`;
}
