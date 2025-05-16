export const isThenable = (t: unknown): t is PromiseLike<unknown> =>
  typeof t === 'object' && t !== null && typeof t?.then === 'function';
