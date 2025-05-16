export const isThenable = (t: unknown): t is PromiseLike<unknown> =>
  typeof t === 'object' &&
  t !== null &&
  'then' in t &&
  typeof t.then === 'function';
