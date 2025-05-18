export const isThenable = (t: unknown): t is PromiseLike<unknown> =>
  typeof t === 'object' &&
  t !== null &&
  'then' in t && // do I need to keep it?
  typeof t.then === 'function';
