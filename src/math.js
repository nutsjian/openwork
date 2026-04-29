/**
 * Math Utility Module
 *
 * Provides common math helper functions.
 */

/**
 * Calculate the factorial of a non-negative integer.
 * @param {number} n - Non-negative integer
 * @returns {number} Factorial of n
 * @throws {Error} If n is negative or not an integer
 */
function factorial(n) {
  if (!Number.isInteger(n) || n < 0) {
    throw new Error('Input must be a non-negative integer');
  }
  if (n === 0 || n === 1) return 1;
  let result = 1;
  for (let i = 2; i <= n; i++) {
    result *= i;
  }
  return result;
}

/**
 * Calculate the Fibonacci number at position n (0-indexed).
 * @param {number} n - Position in the Fibonacci sequence
 * @returns {number} The nth Fibonacci number
 * @throws {Error} If n is negative or not an integer
 */
function fibonacci(n) {
  if (!Number.isInteger(n) || n < 0) {
    throw new Error('Input must be a non-negative integer');
  }
  if (n === 0) return 0;
  if (n === 1) return 1;
  let prev = 0;
  let curr = 1;
  for (let i = 2; i <= n; i++) {
    const next = prev + curr;
    prev = curr;
    curr = next;
  }
  return curr;
}

module.exports = { factorial, fibonacci };
