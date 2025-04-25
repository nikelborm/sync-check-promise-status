export const FLAG_ENUM = {
  PENDING: 0b01,
  FULFILLED: 0b10,
  REJECTED: 0b00,
} as const;

export type FlagEnumKeys = keyof typeof FLAG_ENUM;
export type FlagEnumValues = (typeof FLAG_ENUM)[FlagEnumKeys];
