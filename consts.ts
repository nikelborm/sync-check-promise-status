export const INTERNAL_PROMISE_STATUS = {
  PENDING: 0b01,
  FULFILLED: 0b10,
  REJECTED: 0b00,
} as const;

export const PENDING = INTERNAL_PROMISE_STATUS.PENDING;
export const FULFILLED = INTERNAL_PROMISE_STATUS.FULFILLED;
export const REJECTED = INTERNAL_PROMISE_STATUS.REJECTED;

export type PENDING = typeof PENDING;
export type FULFILLED = typeof FULFILLED;
export type REJECTED = typeof REJECTED;
export type SETTLED = FULFILLED | REJECTED;

export type FlagEnumValues =
  (typeof INTERNAL_PROMISE_STATUS)[keyof typeof INTERNAL_PROMISE_STATUS];

export const newAlwaysPresentProperties = new Set([
  'isFulfilled',
  'isPending',
  'isRejected',
  'isSettled',
  'status',
  'ctx',
]);
