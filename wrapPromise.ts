import { FLAG_ENUM, newAddedProperties, type FlagEnumKeys } from './consts.ts';
import type { Gen, Resolution } from './types.ts';

export const wrapPromiseInStatusMonitor = <Context = undefined, Result = never>(
  promise: PromiseLike<Result>,
  ctx?: Context,
  externallyManagedResolution?: Resolution<NoInfer<Result>>,
) => {
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

  let ifItIsErrorWasItSuppressed = false;

  const promiseHandlers = {
    has(target, p) {
      if ((newAddedProperties as Set<unknown>).has(p)) return true;
      return Reflect.has(target, p);
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
          targetPromiseMethod: Function,
          thisOfPromiseMethod,
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
                assertSanity(
                  `actOnSettled cannot act when parent is fucking pending!!!`,
                  () => !is(parentChainLinkResolution, 'PENDING'),
                );

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

          if (accessedPromiseKey === 'finally') {
            // onFinally is guaranteed to be valid by areAllMethodArgsGarbage,
            // because catch accepts only 1 parameter and if it were invalid,
            // we will get cleanArgs.filter(...).length === 0
            const [onFinally] = promiseMethodCallArgArray;
          }

          assertSanity(
            `How the fuck did you got here????`,
            () => !!trackingPromise,
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

const isThenable = (t: unknown): t is PromiseLike<unknown> =>
  typeof t === 'object' &&
  t !== null &&
  'then' in t &&
  typeof t.then === 'function';

const isPromise = (t: unknown): t is Promise<unknown> =>
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

const isValidPromiseMethodCallback = (t: unknown) => typeof t === 'function';

const is = <
  const FlagEnumKey extends FlagEnumKeys,
  TResolution extends Resolution<any>,
>(
  resolution: TResolution,
  statusToCheckFor: FlagEnumKey,
): resolution is ExtractSpecificResolutions<TResolution, FlagEnumKey> =>
  resolution.status === FLAG_ENUM[statusToCheckFor];

export const PromiseResolve = <T>(value: T) =>
  wrapPromiseInStatusMonitor(Promise.resolve(value) as Promise<T>, undefined, {
    status: FLAG_ENUM.FULFILLED,
    value,
  });

export const PromiseReject = <T>(value: T) =>
  wrapPromiseInStatusMonitor(Promise.reject(value), undefined, {
    status: FLAG_ENUM.REJECTED,
    value,
  });

const assertSanity = (message: string, isSane: () => boolean) => {
  if (isSane()) return;
  const tmp = Error.stackTraceLimit;
  Error.stackTraceLimit = 100;
  const err = new Error(`Sanity check failed! ${message}`);
  console.error(err, err.stack);
  Error.stackTraceLimit = tmp;
  throw err;
};
