import type { FLAG_ENUM } from './consts.ts';

export type Gen<Context = undefined, Result = never> = Promise<Result> & {
  ctx?: Context | undefined;
} & (
    | {
        status: 'pending';
        isPending: true;
        isSettled: false;
        isFulfilled: false;
        isRejected: false;
      }
    | {
        status: 'fulfilled';
        isPending: false;
        isSettled: true;
        isFulfilled: true;
        isRejected: false;
        result: Result;
      }
    | {
        status: 'rejected';
        isPending: false;
        isSettled: true;
        isFulfilled: false;
        isRejected: true;
        error: unknown;
      }
  );

export type Resolution<Result = never> =
  | { status: typeof FLAG_ENUM.PENDING; value: undefined }
  | { status: typeof FLAG_ENUM.FULFILLED; value: Result }
  | { status: typeof FLAG_ENUM.REJECTED; value: unknown };
