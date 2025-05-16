import type { FULFILLED, PENDING, REJECTED } from './consts.ts';

export type Gen<Context = undefined, Result = never> = Promise<Result> & {
  ctx?: Context | undefined;
} & Readonly<
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
  >;

export type Resolution<Result = never> =
  | { status: PENDING; value: undefined }
  | { status: FULFILLED; value: Result }
  | { status: REJECTED; value: unknown };
