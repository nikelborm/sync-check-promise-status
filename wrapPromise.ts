import { FLAG_ENUM, type FlagEnumKeys, type FlagEnumValues } from './consts.ts';
import type { Gen, Resolution } from './types.ts';

export const wrapPromiseInStatusMonitor = <Context = undefined, Result = never>(
  promise: PromiseLike<Result>,
  ctx?: Context,
  predefinedResolution: Resolution<NoInfer<Result>> = {
    status: FLAG_ENUM.PENDING,
    value: undefined,
  },
) => {
  let resolution: Resolution<Result> = predefinedResolution;

  const setResolution =
    <const T extends FlagEnumKeys>(status: T) =>
    (
      value: Extract<
        Resolution<Result>,
        { status: (typeof FLAG_ENUM)[T] }
      >['value'],
    ) => {
      // @ts-expect-error ts please be smarter
      resolution = { status: FLAG_ENUM[status as T], value };
    };

  const processSynchronously = (
    wrapInPrimitivePromise: boolean,
    promiseMethodCallback: Function,
  ) => {
    try {
      const result = promiseMethodCallback(resolution.value);

      if (isPromiseLike(result)) return wrapPromiseInStatusMonitor(result);
      else return wrapInPrimitivePromise ? PromiseResolve(result) : result;
    } catch (error) {
      if (wrapInPrimitivePromise) return PromiseReject(error);
      else throw error;
    }
  };

  const fulfill = setResolution('FULFILLED');
  const reject = setResolution('REJECTED');

  const trackingPromise = is(resolution, 'PENDING')
    ? promise.then(fulfill, reject)
    : null;

  const promiseHandlers = {
    get(targetPromise, accessedPromiseKey, receiverProxy) {
      if (accessedPromiseKey === 'isPending') return is(resolution, 'PENDING');

      if (accessedPromiseKey === 'isSettled') return !is(resolution, 'PENDING');

      if (accessedPromiseKey === 'isFulfilled')
        return is(resolution, 'FULFILLED');

      if (accessedPromiseKey === 'isRejected')
        return is(resolution, 'REJECTED');

      if (accessedPromiseKey === 'status')
        return is(resolution, 'FULFILLED')
          ? 'fulfilled'
          : is(resolution, 'REJECTED')
            ? 'rejected'
            : 'pending';

      if (accessedPromiseKey === 'error' || accessedPromiseKey === 'result') {
        if (is(resolution, 'PENDING'))
          throw new Error(`Can't get ${accessedPromiseKey} of pending promise`);
        else if (
          (accessedPromiseKey === 'error') ===
          is(resolution, 'FULFILLED')
        )
          throw new Error(
            `Can't get ${accessedPromiseKey} of rejected promise. Did you mean to access .${accessedPromiseKey === 'error' ? 'result' : 'error'}?`,
          );
        else return resolution.value;
      }

      if (accessedPromiseKey === 'ctx') return ctx;

      const valueAtKeyInPromise = Reflect.get(
        targetPromise,
        accessedPromiseKey,
        receiverProxy,
      );

      if (
        (accessedPromiseKey !== 'then' &&
          accessedPromiseKey !== 'catch' &&
          accessedPromiseKey !== 'finally') ||
        typeof valueAtKeyInPromise !== 'function'
      )
        return valueAtKeyInPromise;

      return new Proxy(valueAtKeyInPromise, {
        apply(
          targetPromiseMethod: Function,
          thisOfPromiseMethod,
          promiseMethodCallArgArray,
        ) {
          const cleanArgs = promiseMethodCallArgArray.slice(
            0,
            accessedPromiseKey === 'then' ? 2 : 1,
          );

          // if it's [], [undefined], [undefined, undefined] etc
          const areAllMethodArgsGarbage = !cleanArgs.filter(e =>
            isValidPromiseMethodCallback(e),
          ).length;

          if (areAllMethodArgsGarbage) return receiverProxy;

          if (
            isSpecificPromiseMethod(
              targetPromiseMethod,
              accessedPromiseKey,
              'catch',
            )
          ) {
            const actOnSettled = (wrapInPrimitivePromise: boolean) => () => {
              // if parent's resolution is resolved, setting `catch` is useless
              if (is(resolution, 'FULFILLED')) return receiverProxy;

              // onRejected is guaranteed to be valid by areAllMethodArgsGarbage,
              // because catch accepts only 1 parameter and if it were invalid,
              // we will get cleanArgs.length === 0
              return processSynchronously(wrapInPrimitivePromise, cleanArgs[0]);
            };

            if (is(resolution, 'PENDING'))
              return wrapPromiseInStatusMonitor(
                trackingPromise!.then(actOnSettled(false)),
              );

            return actOnSettled(true)();
          }
          if (
            isSpecificPromiseMethod(
              targetPromiseMethod,
              accessedPromiseKey,
              'then',
            )
          ) {
            const actOnSettled = (wrapInPrimitivePromise: boolean) => () => {
              const appropriateCallback =
                cleanArgs[+is(resolution, 'REJECTED')];

              // if parent's resolution is rejected, the only thing that matters
              // is presence of onRejected callback. If CB is invalid (be it
              // undefined when user passes only the first param like
              // `.then(onFulfilled)`, or invalid for other reason), then
              // `.then` call is useless. Same logic for onFulfilled.
              if (!isValidPromiseMethodCallback(appropriateCallback))
                return receiverProxy;

              return processSynchronously(
                wrapInPrimitivePromise,
                appropriateCallback,
              );
            };

            if (is(resolution, 'PENDING'))
              return wrapPromiseInStatusMonitor(
                trackingPromise!.then(actOnSettled(false)),
              );

            return actOnSettled(true)();
          }

          // if (
          //   isSpecificPromiseMethod(
          //     targetPromiseMethod,
          //     accessedPromiseKey,
          //     'finally',
          //   )
          // ) {
          //   // onFinally is guaranteed to be valid by areAllMethodArgsGarbage,
          //   // because catch accepts only 1 parameter and if it were invalid,
          //   // we will get cleanArgs.length === 0
          //   const [onFinally] = cleanArgs;
          // }
          return Reflect.apply(
            targetPromiseMethod.bind(targetPromise),
            thisOfPromiseMethod,
            cleanArgs,
          );
        },
      } satisfies ProxyHandler<Promise<unknown>[PromiseMethods]>);
    },
  } satisfies ProxyHandler<typeof promise>;

  return new Proxy(promise, promiseHandlers) as Gen<Context, Result>;
};

type PromiseMethods = 'then' | 'catch' | 'finally';

const isSpecificPromiseMethod = <const ExpectedKey extends PromiseMethods>(
  method: Function,
  currentKey: PromiseMethods,
  expectedKey: ExpectedKey,
): method is Promise<any>[ExpectedKey] => currentKey === expectedKey;

const isPromiseLike = (t: unknown): t is PromiseLike<unknown> =>
  typeof t === 'object' &&
  t !== null &&
  'then' in t &&
  typeof t.then === 'function';

const isPromise = (t: unknown): t is Promise<unknown> =>
  isPromiseLike(t) &&
  t.then.length === 2 &&
  Symbol.toStringTag in t &&
  t[Symbol.toStringTag] === 'Promise' &&
  'catch' in t &&
  typeof t.catch === 'function' &&
  t.catch.length === 1 &&
  'finally' in t &&
  typeof t.finally === 'function' &&
  t.finally.length === 1;

const isValidPromiseMethodCallback = (t: unknown) => typeof t === 'function';

const is = <const T extends FlagEnumKeys, U extends { status: FlagEnumValues }>(
  // takes this argument only to make typescript hints
  _resolution: U,
  statusToCheckFor: T,
): _resolution is Extract<U, { status: (typeof FLAG_ENUM)[T] }> =>
  _resolution.status === FLAG_ENUM[statusToCheckFor];

const PromiseResolve = <T>(value: T) =>
  wrapPromiseInStatusMonitor(Promise.resolve(value) as Promise<T>, undefined, {
    status: FLAG_ENUM.FULFILLED,
    value,
  });

const PromiseReject = <T>(value: T) =>
  wrapPromiseInStatusMonitor(Promise.reject(value), undefined, {
    status: FLAG_ENUM.REJECTED,
    value,
  });
