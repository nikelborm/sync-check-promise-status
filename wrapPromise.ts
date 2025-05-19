import {
  newAlwaysPresentProperties,
  PENDING,
  REJECTED,
  RESOLVED,
  type FlagEnumValues,
  type SETTLED,
} from './consts.ts';
import type { Gen, Resolution } from './types.ts';

const IsWrappedPromiseSymbol = Symbol('Wrapped promise symbol');
const RawStatusOfWrappedPromiseSymbol = Symbol(
  'Raw status of wrapped promise symbol',
);
const RawValueOfWrappedPromiseSymbol = Symbol(
  'Raw value of wrapped promise symbol',
);

export const isThenable = (t: unknown): t is PromiseLike<unknown> => {
  return (
    typeof t === 'object' &&
    t !== null &&
    (('then' in t && typeof t.then === 'function') ||
      isWrappedPromise(t as PromiseLike<unknown>))
  );
};

export const isWrappedPromise = <Context = unknown, Result = never>(
  promise: PromiseLike<Result>,
): promise is Gen<Context, Result> => {
  try {
    return IsWrappedPromiseSymbol in promise;
  } catch (error) {
    return false;
  }
};

//  wrapPromise.ts |  93.88 |   93.88 |      184 |         0 |         12 |        0 |        5 |

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

  let wasErrorChannelSuppressed = false;

  const trackingPromise =
    is(parentChainLinkResolution, PENDING) && !externallyManagedResolution
      ? (() => {
          const { fulfill, reject } = getResolutionSetters<Result>(
            parentChainLinkResolution,
          );

          if (isWrappedPromise(promise)) {
            parentChainLinkResolution.status = (promise as any)[
              RawStatusOfWrappedPromiseSymbol
            ];
            parentChainLinkResolution.value = (promise as any)[
              RawValueOfWrappedPromiseSymbol
            ];
          }

          if (is(parentChainLinkResolution, PENDING)) {
            wasErrorChannelSuppressed = true;
            return promise.then(fulfill, reject);
          }
        })()
      : promise;

  // const prototype = {};

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
      if (key === IsWrappedPromiseSymbol) return true;

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

      if (accessedPromiseKey === RawStatusOfWrappedPromiseSymbol)
        return parentChainLinkResolution.status;

      if (accessedPromiseKey === RawValueOfWrappedPromiseSymbol)
        return parentChainLinkResolution.value;

      if (accessedPromiseKey === 'status')
        return getCurrentTextStatus(parentChainLinkResolution);

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
            + getCurrentTextStatus(parentChainLinkResolution)
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
          promise.then(
            () => {},
            () => {},
          );
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

          if (
            (accessedPromiseKey === 'catch' &&
              !isValidPromiseMethodCallback(promiseMethodCallArgArray[0])) ||
            (accessedPromiseKey === 'then' &&
              !isValidPromiseMethodCallback(promiseMethodCallArgArray[0]) &&
              !isValidPromiseMethodCallback(promiseMethodCallArgArray[1]))
          )
            return receiverProxy;

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
                : // it's always 'then' as fallback because of if (accessedPromiseKey !== 'catch' && accessedPromiseKey !== 'then') check above
                  promiseMethodCallArgArray[
                    +is(parentChainLinkResolution, REJECTED)
                  ];

            // if parent's resolution is rejected, the only thing that matters
            // is presence of onRejected callback. If CB is invalid (be it
            // undefined when user passes only the first param like
            // `.then(onFulfilled)`, or invalid for other reason), then
            // `.then` call is useless. Same logic for onFulfilled.
            if (!isValidPromiseMethodCallback(appropriatePromiseMethodCallback))
              return returnOnInvalid();

            try {
              removeUnhandledRejectionWarning();

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

          const safetyWrap = (cb: (v: unknown) => unknown) => (v: unknown) => {
            if (is(localResolutionOfNextChainStep, PENDING)) {
              return cb(v);
            } else if (is(localResolutionOfNextChainStep, RESOLVED)) {
              return localResolutionOfNextChainStep.value;
            } else {
              throw localResolutionOfNextChainStep.value;
            }
          };

          const fulfillAndReturn = safetyWrap(
            (result: unknown) => (
              localResolutionTracker.fulfill(result), result
            ),
          );

          const rejectAndThrow = safetyWrap((error: unknown) => {
            localResolutionTracker.reject(error);
            throw error;
          });

          const cb = () =>
            handleCallback({
              returnOnInvalid: () =>
                (is(parentChainLinkResolution, RESOLVED)
                  ? fulfillAndReturn
                  : rejectAndThrow)(parentChainLinkResolution.value),

              returnOnSyncExit: childChainLinkResult => {
                if (isThenable(childChainLinkResult)) {
                  const childPromise = childChainLinkResult.then(
                    fulfillAndReturn,
                    // TODO: add a custom test that breaks the ability of error to buble outside
                    rejectAndThrow, // it's important it rethrows here!
                    // localResolutionTracker.reject,
                  );

                  if (is(localResolutionOfNextChainStep, PENDING))
                    return childPromise;
                  // if it was resolved immediately inside, we can return this
                  // immediate resolution right inside this
                  // `trackingPromise.then(...)` call
                  else if (is(localResolutionOfNextChainStep, RESOLVED))
                    return localResolutionOfNextChainStep.value;
                  else {
                    // It's impossible for it to become rejected and reach
                    // here, but I'll leave it here for experiment
                    throw localResolutionOfNextChainStep.value;
                  }
                }

                // removeUnhandledRejectionWarning();
                return fulfillAndReturn(childChainLinkResult);
              },

              returnOnSyncFail: rejectAndThrow,
            });

          return _wrapPromiseInStatusMonitor(
            trackingPromise.then(cb, cb),
            undefined,
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
      } else {
        console.error(
          `Can't %s promise, that's already %s`,
          status === RESOLVED ? 'fulfill' : 'reject',
          resolution.status === RESOLVED ? 'fulfilled' : 'rejected',
        );
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

const getCurrentTextStatus = (resolution: Resolution<unknown>) =>
  is(resolution, RESOLVED)
    ? 'fulfilled'
    : is(resolution, REJECTED)
      ? 'rejected'
      : 'pending';

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
