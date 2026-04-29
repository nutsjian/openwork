/**
 * Greeting Utility Module
 *
 * Provides a simple greeting message generator with time-based context.
 */

/**
 * Get a greeting message based on the current time of day.
 * @param {string} name - The name of the person to greet.
 * @param {Date} [date] - Optional date object for testing.
 * @returns {string} A formatted greeting message.
 */
function getGreeting(name, date = new Date()) {
  if (!name || typeof name !== 'string') {
    throw new Error('A valid name string is required');
  }

  const hour = date.getHours();
  let period;

  if (hour >= 5 && hour < 12) {
    period = 'morning';
  } else if (hour >= 12 && hour < 17) {
    period = 'afternoon';
  } else if (hour >= 17 && hour < 21) {
    period = 'evening';
  } else {
    period = 'night';
  }

  const greetings = {
    morning: 'Good morning',
    afternoon: 'Good afternoon',
    evening: 'Good evening',
    night: 'Good night',
  };

  return `${greetings[period]}, ${name}!`;
}

/**
 * Generate a formal greeting for professional contexts.
 * @param {string} name - The name of the person.
 * @param {object} [options] - Optional settings.
 * @param {string} [options.title] - Professional title (e.g. "Dr.", "Prof.").
 * @param {string} [options.timezone] - Timezone identifier for localized greeting.
 * @returns {string} A formal greeting message.
 */
function getFormalGreeting(name, options = {}) {
  if (!name || typeof name !== 'string') {
    throw new Error('A valid name string is required');
  }

  const prefix = options.title ? `${options.title} ` : '';
  const greeting = getGreeting(name, options.timezone
    ? new Date(new Date().toLocaleString('en-US', { timeZone: options.timezone }))
    : undefined
  );

  return greeting.replace(name, `${prefix}${name}`);
}

module.exports = { getGreeting, getFormalGreeting };
