import { FLAG_ENUM, type FlagEnumKeys } from './consts.ts';
import type { Gen, Resolution } from './types.ts';

export const wrapPromiseInStatusMonitor = <Context = undefined, Result = never>(
  promise: PromiseLike<Result>,
  ctx?: Context,
  externallyManagedResolution?: Resolution<NoInfer<Result>>,
) => {
  let resolution: Resolution<Result> =
    externallyManagedResolution ?? getNewPendingResolution();

  const trackingPromise =
    is(resolution, 'PENDING') && !externallyManagedResolution
      ? (() => {
          const { fulfill, reject } = getResolutionSetters<Result>(resolution);
          return promise.then(fulfill, reject);
        })()
      : null;

  const scopedProcessSynchronously = processSynchronously(resolution);

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
            const actOnSettled =
              (isItPassedAsPromiseCallback?: boolean) => () => {
                // if parent's resolution is resolved, setting `catch` is useless
                if (is(resolution, 'FULFILLED'))
                  return isItPassedAsPromiseCallback
                    ? resolution.value
                    : receiverProxy;

                // onRejected is guaranteed to be valid by areAllMethodArgsGarbage,
                // because catch accepts only 1 parameter and if it were invalid,
                // we will get cleanArgs.filter(...).length === 0
                return scopedProcessSynchronously(
                  cleanArgs[0],
                  !isItPassedAsPromiseCallback,
                );
              };

            if (is(resolution, 'PENDING')) {
              let localResolutionOfNextChainStep = getNewPendingResolution();
              let { fulfill, reject } = getResolutionSetters<unknown>(
                localResolutionOfNextChainStep,
              );

              return wrapPromiseInStatusMonitor(
                trackingPromise!.then(actOnSettled(true)),
                localResolutionOfNextChainStep,
              );
            }

            return actOnSettled(false)();
          }

          if (
            isSpecificPromiseMethod(
              targetPromiseMethod,
              accessedPromiseKey,
              'then',
            )
          ) {
            const actOnSettled = (isItPromiseCallback?: boolean) => () => {
              const appropriateCallback =
                cleanArgs[+is(resolution, 'REJECTED')];

              // if parent's resolution is rejected, the only thing that matters
              // is presence of onRejected callback. If CB is invalid (be it
              // undefined when user passes only the first param like
              // `.then(onFulfilled)`, or invalid for other reason), then
              // `.then` call is useless. Same logic for onFulfilled.
              if (!isValidPromiseMethodCallback(appropriateCallback)) {
                return receiverProxy;
              }

              return scopedProcessSynchronously(
                appropriateCallback,
                !isItPromiseCallback,
              );
            };

            if (is(resolution, 'PENDING'))
              return wrapPromiseInStatusMonitor(
                trackingPromise!.then(actOnSettled(true)),
              );

            return actOnSettled()();
          }

          if (
            isSpecificPromiseMethod(
              targetPromiseMethod,
              accessedPromiseKey,
              'finally',
            )
          ) {
            // onFinally is guaranteed to be valid by areAllMethodArgsGarbage,
            // because catch accepts only 1 parameter and if it were invalid,
            // we will get cleanArgs.filter(...).length === 0
            const [onFinally] = cleanArgs;
          }
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

type ExtractSpecificResolutions<
  TResolution extends Resolution<any>,
  FlagEnumKey extends FlagEnumKeys,
> = Extract<TResolution, { status: (typeof FLAG_ENUM)[FlagEnumKey] }>;

type ResolutionSetter<FlagEnumKey extends FlagEnumKeys, Result = never> = (
  value: ExtractSpecificResolutions<Resolution<Result>, FlagEnumKey>['value'],
) => void;

const getResolutionSetters = <Result = never>(
  resolution: Resolution<Result>,
) => {
  const setResolution =
    <const FlagEnumKey extends FlagEnumKeys>(
      status: FlagEnumKey,
    ): ResolutionSetter<FlagEnumKey, Result> =>
    value => {
      resolution.status = FLAG_ENUM[status];
      resolution.value = value;
    };

  const fulfill = setResolution('FULFILLED');
  const reject = setResolution('REJECTED');

  return { fulfill, reject };
};

const processSynchronously =
  <Result = never>(resolution: Resolution<Result>) =>
  (promiseMethodCallback: Function, wrapInPrimitivePromise?: boolean) => {
    if (!wrapInPrimitivePromise) return promiseMethodCallback(resolution.value);

    try {
      const result = promiseMethodCallback(resolution.value);

      // TODO: experimentally test removing those wrappers for performance reasons
      return isPromiseLike(result)
        ? wrapPromiseInStatusMonitor(result)
        : PromiseResolve(result);
    } catch (error) {
      return PromiseReject(error);
    }
  };

const getNewPendingResolution = () => ({
  status: FLAG_ENUM.PENDING,
  value: undefined,
});

type PromiseMethods = 'then' | 'catch' | 'finally';

const isSpecificPromiseMethod = <const ExpectedKey extends PromiseMethods>(
  // takes this argument only to make typescript hints
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

const is = <
  const FlagEnumKey extends FlagEnumKeys,
  TResolution extends Resolution<any>,
>(
  resolution: TResolution,
  statusToCheckFor: FlagEnumKey,
): resolution is ExtractSpecificResolutions<TResolution, FlagEnumKey> =>
  resolution.status === FLAG_ENUM[statusToCheckFor];

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
