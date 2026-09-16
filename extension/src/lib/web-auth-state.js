export function validWebCallbackState(expected, received) {
  return typeof expected === 'string'
    && expected.length >= 16
    && typeof received === 'string'
    && received === expected;
}
