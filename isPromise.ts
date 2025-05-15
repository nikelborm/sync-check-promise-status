export const isThenable = (t: unknown): t is PromiseLike<unknown> =>
  typeof t === 'object' &&
  t !== null &&
  'then' in t &&
  typeof t.then === 'function';

export const isPromise = (t: unknown): t is Promise<unknown> =>
  isThenable(t) &&
  t.then.length === 2 &&
  Symbol.toStringTag in t &&
  t[Symbol.toStringTag] === 'Promise' &&
  'catch' in t &&
  typeof t.catch === 'function' &&
  t.catch.length === 1 &&
  'finally' in t &&
  typeof t.finally === 'function' &&
  t.finally.length === 1;
