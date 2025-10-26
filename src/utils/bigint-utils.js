/**
 * Utility functions for BigInt conversion and result extraction
 */

/**
 * Converts a value to BigInt with comprehensive type handling
 * @param {any} value - The value to convert to BigInt
 * @returns {bigint} The converted BigInt value
 * @throws {TypeError} If the value cannot be converted to BigInt
 */
export const toBigInt = (value) => {
  if (typeof value === 'bigint') return value;
  if (typeof value === 'number') return BigInt(Math.trunc(value));
  if (typeof value === 'string' && value.length > 0) return BigInt(value);
  if (value === undefined || value === null) return 0n;
  if (typeof value === 'object' && value !== null) {
    if ('result' in value) return toBigInt(value.result);
    if (Array.isArray(value)) {
      return value.reduce((acc, item) => (toBigInt(item) ? toBigInt(item) : acc), 0n);
    }
  }
  throw new TypeError(`Unsupported BigInt conversion for value: ${value}`);
};

/**
 * Extracts the result from a contract call response object
 * @param {any} entry - The contract call response object
 * @returns {any} The extracted result or the original entry if no result property exists
 */
export const extractResult = (entry) => {
  if (entry === undefined || entry === null) return undefined;
  if (typeof entry === 'object' && entry !== null && 'result' in entry) {
    return entry.result;
  }
  return entry;
};

/**
 * Ensures a reserve value is positive by converting to BigInt and returning 1n if <= 0n
 * @param {any} value - The value to ensure is positive
 * @returns {bigint} The positive BigInt value (minimum 1n)
 */
export const ensurePositiveReserve = (value) => {
  const bigValue = toBigInt(value);
  return bigValue <= 0n ? 1n : bigValue;
};
