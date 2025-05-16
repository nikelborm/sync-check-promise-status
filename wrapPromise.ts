import {
  FLAG_ENUM,
  newAlwaysPresentProperties,
  type FlagEnumKeys,
} from './consts.ts';
import { isThenable } from './isThenable.ts';
import type { Gen, Resolution } from './types.ts';

const WrappedPromiseSymbol = Symbol('WrappedPromiseSymbol');

// const isWrappedPromise = <Context = unknown, Result = never>(
//   promise: PromiseLike<Result>,
// ): promise is Gen<Context, Result> => WrappedPromiseSymbol in promise;

export const wrapPromiseInStatusMonitor = <Context = undefined, Result = never>(
  promise: PromiseLike<Result>,
  ctx?: Context,
  externallyManagedResolution?: Resolution<NoInfer<Result>>,
) => {
  // if (isThenable(promise) && externallyManagedResolution) {
  // }

  let parentChainLinkResolution: Resolution<Result> =
    externallyManagedResolution ?? getNewPendingResolution();

  const trackingPromise =
    is(parentChainLinkResolution, 'PENDING') && !externallyManagedResolution
      ? (() => {
          const { fulfill, reject } = getResolutionSetters<Result>(
            parentChainLinkResolution,
          );
          return promise.then(fulfill, reject);
        })()
      : null;

  // const prototype = {};

  let ifItIsErrorWasItSuppressed = false;

  const promiseHandlers = {
    // getOwnPropertyDescriptor(target, key) {
    //   if (
    //     (key === 'error' && is(parentChainLinkResolution, 'REJECTED')) ||
    //     (key === 'result' && is(parentChainLinkResolution, 'FULFILLED'))
    //   )
    //     return {
    //       value: parentChainLinkResolution.value,
    //       configurable: false,
    //       enumerable: true,
    //       writable: false,
    //     };

    //   if (key === 'isFulfilled')
    //     return Reflect.getOwnPropertyDescriptor(target, key);
    //   if (key === 'isPending')
    //     return Reflect.getOwnPropertyDescriptor(target, key);
    //   if (key === 'isRejected')
    //     return Reflect.getOwnPropertyDescriptor(target, key);
    //   if (key === 'isSettled')
    //     return Reflect.getOwnPropertyDescriptor(target, key);
    //   if (key === 'status')
    //     return Reflect.getOwnPropertyDescriptor(target, key);
    //   if (key === 'ctx') return Reflect.getOwnPropertyDescriptor(target, key);
    //   return Reflect.getOwnPropertyDescriptor(target, key);
    // },

    // getPrototypeOf(target) {
    //   return {};
    // },

    has(target, key) {
      if (key === 'error') return is(parentChainLinkResolution, 'REJECTED');
      if (key === 'result') return is(parentChainLinkResolution, 'FULFILLED');
      if (key === WrappedPromiseSymbol) return true;

      if ((newAlwaysPresentProperties as Set<unknown>).has(key)) return true;

      return Reflect.has(target, key);
    },
    get(targetPromise, accessedPromiseKey, receiverProxy) {
      if (accessedPromiseKey === 'isPending')
        return is(parentChainLinkResolution, 'PENDING');

      if (accessedPromiseKey === 'isSettled')
        return !is(parentChainLinkResolution, 'PENDING');

      if (accessedPromiseKey === 'isFulfilled')
        return is(parentChainLinkResolution, 'FULFILLED');

      if (accessedPromiseKey === 'isRejected')
        return is(parentChainLinkResolution, 'REJECTED');

      const getCurrentTextStatus = () =>
        is(parentChainLinkResolution, 'FULFILLED')
          ? 'fulfilled'
          : is(parentChainLinkResolution, 'REJECTED')
            ? 'rejected'
            : 'pending';

      if (accessedPromiseKey === 'status') return getCurrentTextStatus();

      if (accessedPromiseKey === 'error' || accessedPromiseKey === 'result') {
        if (is(parentChainLinkResolution, 'PENDING'))
          throw new Error(`Can't get ${accessedPromiseKey} of pending promise`);
        else if (
          (accessedPromiseKey === 'error') ===
          is(parentChainLinkResolution, 'FULFILLED')
        )
          throw new Error(
            `Can't get ${accessedPromiseKey} of ${getCurrentTextStatus()} promise. Did you mean to access .${accessedPromiseKey === 'error' ? 'result' : 'error'}?`,
          );
        else return parentChainLinkResolution.value;
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
          _targetPromiseMethod: Function,
          _thisOfPromiseMethod,
          promiseMethodCallArgArray,
        ) {
          const buildReturnValue = (
            buildAppropriateCallback: () => Function,
          ) => {
            const actOnSettled =
              (asyncContext?: {
                fulfill: (value: unknown) => void;
                reject: (value: unknown) => void;
              }) =>
              () => {
                const removeWarning = () => {
                  if (
                    !ifItIsErrorWasItSuppressed &&
                    is(parentChainLinkResolution, 'REJECTED')
                  ) {
                    promise.then(void 0, () => {});
                    ifItIsErrorWasItSuppressed = true;
                  }
                };

                const appropriatePromiseMethodCallback =
                  buildAppropriateCallback();

                const fulfill = (result: unknown) => {
                  removeWarning();
                  asyncContext!.fulfill(result);
                  return result;
                };

                const reject = (error: unknown) => {
                  asyncContext!.reject(error);
                  throw error;
                };
                // if parent's resolution is rejected, the only thing that matters is
                // presence of onRejected callback. If CB is invalid (be it undefined when
                // user passes only the first param like `.then(onFulfilled)`, or invalid
                // for other reason), then `.then` call is useless. Same logic for
                // onFulfilled.
                if (
                  !isValidPromiseMethodCallback(
                    appropriatePromiseMethodCallback,
                  )
                ) {
                  if (!asyncContext) return receiverProxy;

                  if (is(parentChainLinkResolution, 'FULFILLED'))
                    return fulfill(parentChainLinkResolution.value);
                  reject(parentChainLinkResolution.value);
                }

                try {
                  const childChainLinkResult = appropriatePromiseMethodCallback(
                    parentChainLinkResolution.value,
                  );

                  // TODO: also check for it returning WrappedPromise with isWrappedPromise, to not add redundant status handlers

                  if (asyncContext) {
                    if (isThenable(childChainLinkResult)) {
                      // TODO: why the fuck removal of this .then shit doesn't change anything
                      return childChainLinkResult.then(fulfill, reject);
                    }

                    return fulfill(childChainLinkResult);
                  }

                  removeWarning();
                  return isThenable(childChainLinkResult)
                    ? wrapPromiseInStatusMonitor(childChainLinkResult)
                    : PromiseResolve(childChainLinkResult);
                } catch (error) {
                  if (asyncContext) reject(error);
                  removeWarning();
                  return PromiseReject(error);
                }
              };

            if (!is(parentChainLinkResolution, 'PENDING'))
              return actOnSettled()();

            let localResolutionOfNextChainStep = getNewPendingResolution();

            return wrapPromiseInStatusMonitor(
              trackingPromise!.then(
                actOnSettled(
                  getResolutionSetters<unknown>(localResolutionOfNextChainStep),
                ),
              ),
              localResolutionOfNextChainStep,
            );
          };

          if (accessedPromiseKey === 'catch') {
            return buildReturnValue(() =>
              is(parentChainLinkResolution, 'REJECTED')
                ? promiseMethodCallArgArray[0]
                : null,
            );
          }

          if (accessedPromiseKey === 'then') {
            return buildReturnValue(
              () =>
                promiseMethodCallArgArray[
                  +is(parentChainLinkResolution, 'REJECTED')
                ],
            );
          }

          throw new Error('finally is not supported');

          // if (accessedPromiseKey === 'finally') {
          //   // onFinally is guaranteed to be valid by areAllMethodArgsGarbage,
          //   // because catch accepts only 1 parameter and if it were invalid,
          //   // we will get cleanArgs.filter(...).length === 0
          //   const [onFinally] = promiseMethodCallArgArray;
          // }
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

const getNewPendingResolution = () => ({
  status: FLAG_ENUM.PENDING,
  value: undefined,
});

type PromiseMethods = 'then' | 'catch' | 'finally';

const isValidPromiseMethodCallback = (t: unknown) => typeof t === 'function';

const is = <
  const FlagEnumKey extends FlagEnumKeys,
  TResolution extends Resolution<any>,
>(
  resolution: TResolution,
  statusToCheckFor: FlagEnumKey,
): resolution is ExtractSpecificResolutions<TResolution, FlagEnumKey> =>
  resolution.status === FLAG_ENUM[statusToCheckFor];

export const PromiseResolve = <T, Context>(value: T, context?: Context) =>
  wrapPromiseInStatusMonitor(Promise.resolve(value) as Promise<T>, context, {
    status: FLAG_ENUM.FULFILLED,
    value,
  });

export const PromiseReject = <T, Context>(value: T, context?: Context) =>
  wrapPromiseInStatusMonitor(Promise.reject(value), context, {
    status: FLAG_ENUM.REJECTED,
    value,
  });
