import {
  newAlwaysPresentProperties,
  PENDING,
  REJECTED,
  RESOLVED,
  type FlagEnumValues,
  type SETTLED,
} from './consts.ts';
import type { Gen, Resolution } from './types.ts';

const WrappedPromiseSymbol = Symbol('WrappedPromiseSymbol');

export const isThenable = (t: unknown): t is PromiseLike<unknown> => {
  return (
    typeof t === 'object' &&
    t !== null &&
    (('then' in t && typeof t.then === 'function') ||
      isWrappedPromise(t as PromiseLike<unknown>))
  );
};

const isWrappedPromise = <Context = unknown, Result = never>(
  promise: PromiseLike<Result>,
): promise is Gen<Context, Result> => {
  try {
    return WrappedPromiseSymbol in promise;
  } catch (error) {
    return false;
  }
};

export const wrapPromiseInStatusMonitor = <Context = undefined, Result = never>(
  promise: PromiseLike<Result>,
  ctx?: Context,
) => _wrapPromiseInStatusMonitor(promise, ctx);

const _wrapPromiseInStatusMonitor = <Context = undefined, Result = never>(
  promise: PromiseLike<Result>,
  ctx?: Context,
  externallyManagedResolution?: Resolution<NoInfer<Result>>,
) => {
  let parentChainLinkResolution: Resolution<Result> =
    externallyManagedResolution ?? getNewPendingResolution();

  const trackingPromise =
    is(parentChainLinkResolution, PENDING) && !externallyManagedResolution
      ? (() => {
          const { fulfill, reject } = getResolutionSetters<Result>(
            parentChainLinkResolution,
          );
          return promise.then(fulfill, reject);
        })()
      : null;

  const getCurrentTextStatus = () =>
    is(parentChainLinkResolution, RESOLVED)
      ? 'fulfilled'
      : is(parentChainLinkResolution, REJECTED)
        ? 'rejected'
        : 'pending';

  // const prototype = {};

  let wasErrorChannelSuppressed = false;

  const promiseHandlers = {
    // getOwnPropertyDescriptor(target, key) {
    //   if (
    //     (key === 'error' && is(parentChainLinkResolution, REJECTED)) ||
    //     (key === 'result' && is(parentChainLinkResolution, RESOLVED))
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
      if (key === 'error') return is(parentChainLinkResolution, REJECTED);
      if (key === 'result') return is(parentChainLinkResolution, RESOLVED);
      if (key === WrappedPromiseSymbol) return true;

      if ((newAlwaysPresentProperties as Set<unknown>).has(key)) return true;

      return Reflect.has(target, key);
    },
    get(targetPromise, accessedPromiseKey, receiverProxy) {
      if (accessedPromiseKey === 'isPending')
        return is(parentChainLinkResolution, PENDING);

      if (accessedPromiseKey === 'isSettled')
        return !is(parentChainLinkResolution, PENDING);

      if (accessedPromiseKey === 'isFulfilled')
        return is(parentChainLinkResolution, RESOLVED);

      if (accessedPromiseKey === 'isRejected')
        return is(parentChainLinkResolution, REJECTED);

      if (accessedPromiseKey === 'status') return getCurrentTextStatus();

      if (accessedPromiseKey === 'error' || accessedPromiseKey === 'result') {
        if (
          is(parentChainLinkResolution, PENDING) ||
          // prettier-ignore
          (accessedPromiseKey === 'error') ===
            is(parentChainLinkResolution, RESOLVED)
        )
          // prettier-ignore
          throw new Error(
            "Can't get "
            + accessedPromiseKey
            + ' of '
            + getCurrentTextStatus()
            + ' promise.'
            + (is(parentChainLinkResolution, PENDING)
              ? ''
              : (' Did you mean to access '
                + (accessedPromiseKey === 'error' ? '.result?' : '.error?'))),
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

      const removeUnhandledRejectionWarning = () => {
        if (
          !wasErrorChannelSuppressed &&
          is(parentChainLinkResolution, REJECTED)
        ) {
          promise.then(void 0, () => {});
          wasErrorChannelSuppressed = true;
        }
      };

      return new Proxy(valueAtKeyInPromise, {
        apply(
          _targetPromiseMethod: Function,
          _thisOfPromiseMethod,
          promiseMethodCallArgArray,
        ) {
          if (accessedPromiseKey !== 'catch' && accessedPromiseKey !== 'then')
            throw new Error('finally is not supported');

          const handleCallback = ({
            returnOnSyncFail,
            returnOnSyncExit,
            returnOnInvalid,
          }: {
            returnOnInvalid: () => unknown;
            returnOnSyncExit: (result: unknown) => unknown;
            returnOnSyncFail: (err: unknown) => unknown;
          }) => {
            const appropriatePromiseMethodCallback =
              accessedPromiseKey === 'catch'
                ? is(parentChainLinkResolution, REJECTED)
                  ? promiseMethodCallArgArray[0]
                  : null
                : accessedPromiseKey === 'then'
                  ? promiseMethodCallArgArray[
                      +is(parentChainLinkResolution, REJECTED)
                    ]
                  : null;

            // if parent's resolution is rejected, the only thing that matters
            // is presence of onRejected callback. If CB is invalid (be it
            // undefined when user passes only the first param like
            // `.then(onFulfilled)`, or invalid for other reason), then
            // `.then` call is useless. Same logic for onFulfilled.
            if (!isValidPromiseMethodCallback(appropriatePromiseMethodCallback))
              return returnOnInvalid();

            // ????!
            removeUnhandledRejectionWarning();

            try {
              const childChainLinkResult = appropriatePromiseMethodCallback(
                parentChainLinkResolution.value,
              );
              // TODO: also maybe check for it returning WrappedPromise with
              // isWrappedPromise, to not add redundant status handlers

              return returnOnSyncExit(childChainLinkResult);
            } catch (error) {
              return returnOnSyncFail(error);
            }
          };

          if (!is(parentChainLinkResolution, PENDING))
            return handleCallback({
              returnOnInvalid: () => receiverProxy,
              returnOnSyncExit: PromiseResolve,
              returnOnSyncFail: PromiseReject,
            });

          let localResolutionOfNextChainStep =
            getNewPendingResolution() as Resolution<unknown>;

          const localResolutionTracker = getResolutionSetters<unknown>(
            localResolutionOfNextChainStep,
          );

          const fulfill = (result: unknown) => {
            localResolutionTracker.fulfill(result);
            return result;
          };

          const reject = (error: unknown) => {
            localResolutionTracker.reject(error);
            throw error;
          };

          return wrapPromiseInStatusMonitor(
            trackingPromise!.then(() =>
              handleCallback({
                returnOnInvalid: () =>
                  (is(parentChainLinkResolution, RESOLVED) ? fulfill : reject)(
                    parentChainLinkResolution.value,
                  ),
                returnOnSyncExit: childChainLinkResult => {
                  if (isThenable(childChainLinkResult)) {
                    const childPromise = childChainLinkResult.then(
                      fulfill,
                      reject,
                    );

                    if (is(localResolutionOfNextChainStep, PENDING))
                      return childPromise;
                    // if it was resolved immediately inside, we can return this
                    // immediate resolution right inside this
                    // `trackingPromise.then(...)` call
                    else if (is(localResolutionOfNextChainStep, RESOLVED))
                      return localResolutionOfNextChainStep.value;
                    else throw localResolutionOfNextChainStep.value;
                  }

                  return fulfill(childChainLinkResult);
                },
                returnOnSyncFail: reject,
              }),
            ),
            localResolutionOfNextChainStep,
          );

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
  FlagEnumValue extends FlagEnumValues,
> = Extract<TResolution, { status: FlagEnumValue }>;

type ResolutionSetter<FlagEnumValue extends FlagEnumValues, Result = never> = (
  value: ExtractSpecificResolutions<Resolution<Result>, FlagEnumValue>['value'],
) => void;

const getResolutionSetters = <Result = never>(
  resolution: Resolution<Result>,
) => {
  const setResolution =
    <const FlagEnumValue extends FlagEnumValues>(
      status: SETTLED,
    ): ResolutionSetter<FlagEnumValue, Result> =>
    value => {
      if (resolution.status === PENDING) {
        // @ts-ignore
        resolution.status = status;
        // @ts-ignore
        resolution.value = value;
      }
    };

  return {
    fulfill: setResolution(RESOLVED),
    reject: setResolution(REJECTED),
  };
};

const getNewPendingResolution = () => ({
  status: PENDING,
  value: undefined,
});

type PromiseMethods = 'then' | 'catch' | 'finally';

const isValidPromiseMethodCallback = (t: unknown) => typeof t === 'function';

const is = <const FlagEnumValue extends FlagEnumValues, Result = never>(
  resolution: Resolution<Result>,
  statusToCheckFor: FlagEnumValue,
): resolution is ExtractSpecificResolutions<
  Resolution<Result>,
  FlagEnumValue
> => resolution.status === statusToCheckFor;

export const PromiseResolve = (<T, Context>(value?: T, context?: Context) =>
  isThenable(value)
    ? _wrapPromiseInStatusMonitor(value, context)
    : _wrapPromiseInStatusMonitor(
        Promise.resolve(value) as Promise<T>,
        context,
        {
          status: RESOLVED,
          value: value!,
        },
      )) as PromiseResolve;

type PromiseResolve = {
  (): Promise<void>;
  <T, Context>(value: T, context?: Context): Gen<Context, Awaited<T>>;
  <T, Context>(
    value: T | PromiseLike<T>,
    context?: Context,
  ): Gen<Context, Awaited<T>>;
};

export const PromiseReject = <T, Context>(reason: any, context?: Context) =>
  _wrapPromiseInStatusMonitor(Promise.reject<T>(reason), context, {
    status: REJECTED,
    value: reason,
  });
