import { assert, describe, expect, it, vi } from 'vitest';
import {
  PromiseReject,
  PromiseResolve,
  isThenable,
  wrapPromiseInStatusMonitor,
} from './wrapPromise.ts';

const initiallyLongPendingPromise = (w: any) =>
  new Promise(resolve =>
    setTimeout(
      () =>
        resolve({
          then(f: any) {
            f(w);
          },
        }),
      2,
    ),
  );

describe('primitive tests', async () => {
  it('Correctly handles custom PromiseResolve', async () => {
    const promise = PromiseResolve('ok');

    expect(promise).toHaveProperty('status', 'fulfilled');
    expect(promise).toHaveProperty('ctx', undefined);
    expect(promise).toHaveProperty('isPending', false);
    expect(promise).toHaveProperty('isSettled', true);
    expect(promise).toHaveProperty('isFulfilled', true);
    expect(promise).toHaveProperty('isRejected', false);

    // @ts-expect-error intentional
    expect(() => promise.error).toThrowErrorMatchingInlineSnapshot(
      `[Error: Can't get error of fulfilled promise. Did you mean to access .result?]`,
    );
    expect(promise).toHaveProperty('result', 'ok');
    assert(!('error' in promise));

    const result = await promise;

    expect(result).toBe('ok');

    expect(promise).toHaveProperty('status', 'fulfilled');

    expect(promise).toHaveProperty('result', 'ok');
    // @ts-expect-error intentional
    expect(() => promise.error).toThrowErrorMatchingInlineSnapshot(
      `[Error: Can't get error of fulfilled promise. Did you mean to access .result?]`,
    );
  });

  it('Correctly handles custom PromiseReject', async () => {
    const promise = PromiseReject('err message');

    expect(promise).toHaveProperty('status', 'rejected');
    expect(promise).toHaveProperty('ctx', undefined);
    expect(promise).toHaveProperty('isPending', false);
    expect(promise).toHaveProperty('isSettled', true);
    expect(promise).toHaveProperty('isFulfilled', false);
    expect(promise).toHaveProperty('isRejected', true);

    // @ts-expect-error intentional
    expect(() => promise.result).toThrowErrorMatchingInlineSnapshot(
      `[Error: Can't get result of rejected promise. Did you mean to access .error?]`,
    );
    expect(promise).toHaveProperty('error', 'err message');
    assert(!('result' in promise));

    let thrown = false;

    try {
      await promise;
    } catch (error) {
      thrown = true;
    }

    expect(thrown).toBe(true);

    expect(promise).toHaveProperty('status', 'rejected');

    expect(promise).toHaveProperty('error', 'err message');
    // @ts-expect-error intentional
    expect(() => promise.result).toThrowErrorMatchingInlineSnapshot(
      `[Error: Can't get result of rejected promise. Did you mean to access .error?]`,
    );
  });

  it("correctly handles Promise.resolve('ok')", async () => {
    const promise = wrapPromiseInStatusMonitor(Promise.resolve('ok'));

    expect(promise).toHaveProperty('status', 'pending');
    expect(promise).toHaveProperty('ctx', undefined);
    expect(promise).toHaveProperty('isPending', true);
    expect(promise).toHaveProperty('isSettled', false);
    expect(promise).toHaveProperty('isFulfilled', false);
    expect(promise).toHaveProperty('isRejected', false);
    // @ts-expect-error intentional
    expect(() => promise.result).toThrowErrorMatchingInlineSnapshot(
      `[Error: Can't get result of pending promise.]`,
    );
    // @ts-expect-error intentional
    expect(() => promise.error).toThrowErrorMatchingInlineSnapshot(
      `[Error: Can't get error of pending promise.]`,
    );
    assert(!('error' in promise));
    assert(!('result' in promise));

    const result = await promise;

    expect(result).toBe('ok');

    expect(promise).toHaveProperty('status', 'fulfilled');

    expect(promise).toHaveProperty('result', 'ok');
    // @ts-expect-error intentional
    expect(() => promise.error).toThrowErrorMatchingInlineSnapshot(
      `[Error: Can't get error of fulfilled promise. Did you mean to access .result?]`,
    );

    assert('result' in promise);
    assert(!('error' in promise));
  });

  it("correctly handles Promise.reject('err')", async () => {
    const promise = wrapPromiseInStatusMonitor(Promise.reject('err message'));

    expect(promise).toHaveProperty('status', 'pending');
    expect(promise).toHaveProperty('ctx', undefined);
    expect(promise).toHaveProperty('isPending', true);
    expect(promise).toHaveProperty('isSettled', false);
    expect(promise).toHaveProperty('isFulfilled', false);
    expect(promise).toHaveProperty('isRejected', false);
    // @ts-expect-error intentional
    expect(() => promise.result).toThrowErrorMatchingInlineSnapshot(
      `[Error: Can't get result of pending promise.]`,
    );
    // @ts-expect-error intentional
    expect(() => promise.error).toThrowErrorMatchingInlineSnapshot(
      `[Error: Can't get error of pending promise.]`,
    );

    assert(!('error' in promise));
    assert(!('result' in promise));

    let thrown = false;

    try {
      await promise;
    } catch (error) {
      thrown = true;
    }

    expect(thrown).toBe(true);

    expect(promise).toHaveProperty('status', 'rejected');

    expect(promise).toHaveProperty('error', 'err message');
    // @ts-expect-error intentional
    expect(() => promise.result).toThrowErrorMatchingInlineSnapshot(
      `[Error: Can't get result of rejected promise. Did you mean to access .error?]`,
    );

    assert('error' in promise);
    assert(!('result' in promise));
    assert(!('1231' in promise));
    assert(!('1235' in promise));
    assert('isFulfilled' in promise);
    assert('isPending' in promise);
    assert('isRejected' in promise);
    assert('isSettled' in promise);
    assert('status' in promise);
    assert('ctx' in promise);
  });

  it('correctly handles delayed Promise which resolves', async () => {
    const promise = wrapPromiseInStatusMonitor(
      new Promise((resolve, _reject) => {
        setTimeout(() => resolve('ok'), 2);
      }),
    );

    expect(promise).toHaveProperty('status', 'pending');
    // @ts-expect-error intentional
    expect(() => promise.result).toThrowErrorMatchingInlineSnapshot(
      `[Error: Can't get result of pending promise.]`,
    );
    // @ts-expect-error intentional
    expect(() => promise.error).toThrowErrorMatchingInlineSnapshot(
      `[Error: Can't get error of pending promise.]`,
    );

    const result = await promise;

    expect(result).toBe('ok');

    expect(promise).toHaveProperty('status', 'fulfilled');

    expect(promise).toHaveProperty('result', 'ok');
    // @ts-expect-error intentional
    expect(() => promise.error).toThrowErrorMatchingInlineSnapshot(
      `[Error: Can't get error of fulfilled promise. Did you mean to access .result?]`,
    );
  });

  it('correctly handles delayed Promise which throws', async () => {
    const err = new Error('err message');
    const promise = wrapPromiseInStatusMonitor(
      new Promise((_resolve, reject) => {
        setTimeout(() => reject(err), 2);
      }),
    );

    expect(promise).toHaveProperty('status', 'pending');
    // @ts-expect-error intentional
    expect(() => promise.result).toThrowErrorMatchingInlineSnapshot(
      `[Error: Can't get result of pending promise.]`,
    );
    // @ts-expect-error intentional
    expect(() => promise.error).toThrowErrorMatchingInlineSnapshot(
      `[Error: Can't get error of pending promise.]`,
    );

    let thrown = false;

    try {
      await promise;
    } catch (error) {
      thrown = true;
    }

    expect(thrown).toBe(true);

    expect(promise).toHaveProperty('status', 'rejected');

    expect(promise).toHaveProperty('error', err);
    // @ts-expect-error intentional
    expect(() => promise.result).toThrowErrorMatchingInlineSnapshot(
      `[Error: Can't get result of rejected promise. Did you mean to access .error?]`,
    );
  });

  it('correctly shows presence of methods', async () => {
    const promise = wrapPromiseInStatusMonitor(Promise.resolve(123));

    expect(promise).toHaveProperty('then');
    expect(promise).toHaveProperty('finally');
    expect(promise).toHaveProperty('catch');
    expect(promise[Symbol.toStringTag]).toBe('Promise');
  });
});

describe('deduplication of Promises', () => {
  it('deduplicates resolved promise with `catch` having bad arguments', () => {
    const promise = PromiseResolve('ok');

    assert(promise === promise.catch(), 'Should be the same object');
    assert(promise === promise.catch(undefined), 'Should be the same object');

    assert(
      // @ts-expect-error intentional
      promise === promise.catch(undefined, undefined),
      'Should be the same object',
    );
    assert(
      // @ts-expect-error intentional
      promise === promise.catch(undefined, () => {}),
      'Should be the same object',
    );
    // @ts-expect-error intentional
    assert(promise === promise.catch(false), 'Should be the same object');
    assert(promise === promise.catch(null), 'Should be the same object');
    // @ts-expect-error intentional
    assert(promise === promise.catch('null'), 'Should be the same object');
    // @ts-expect-error intentional
    assert(promise === promise.catch(123), 'Should be the same object');
    assert(
      // @ts-expect-error intentional
      promise === promise.catch(new Promise(resolve => resolve('hello'))),
      'Should be the same object',
    );
    // @ts-expect-error intentional
    assert(promise === promise.catch(98n), 'Should be the same object');
  });

  it('deduplicates resolved promise with `then` having bad first argument', () => {
    const promise = PromiseResolve('ok');

    assert(promise === promise.then(), 'Should be the same object');
    assert(promise === promise.then(undefined), 'Should be the same object');
    assert(
      promise === promise.then(undefined, () => {}),
      'Should be the same object',
    );
    assert(
      promise === promise.then(undefined, undefined),
      'Should be the same object',
    );
    // @ts-expect-error intentional
    assert(promise === promise.then(false), 'Should be the same object');
    assert(promise === promise.then(null), 'Should be the same object');
    // @ts-expect-error intentional
    assert(promise === promise.then('null'), 'Should be the same object');
    // @ts-expect-error intentional
    assert(promise === promise.then(123), 'Should be the same object');
    assert(
      // @ts-expect-error intentional
      promise === promise.then(new Promise(resolve => resolve('hello'))),
      'Should be the same object',
    );
    // @ts-expect-error intentional
    assert(promise === promise.then(98n), 'Should be the same object');
  });

  it('deduplicates rejected promise with `then` having bad second argument', () => {
    const promise = PromiseReject('err');

    assert(promise === promise.then(), 'Should be the same object');
    assert(promise === promise.then(undefined), 'Should be the same object');
    assert(
      promise === promise.then(undefined, undefined),
      'Should be the same object',
    );
    assert(
      // @ts-expect-error intentional
      promise === promise.then(undefined, false),
      'Should be the same object',
    );
    assert(
      promise === promise.then(undefined, null),
      'Should be the same object',
    );
    assert(
      // @ts-expect-error intentional
      promise === promise.then(undefined, 'null'),
      'Should be the same object',
    );
    assert(
      // @ts-expect-error intentional
      promise === promise.then(undefined, 123),
      'Should be the same object',
    );
    assert(
      promise ===
        // @ts-expect-error intentional
        promise.then(undefined, new Promise(resolve => resolve('hello'))),
      'Should be the same object',
    );
    assert(
      // @ts-expect-error intentional
      promise === promise.then(undefined, 98n),
      'Should be the same object',
    );

    promise.then(undefined, () => {});
  });
});

describe('Promise method calls', () => {
  it('calls then onFulfilled method in sync context', () => {
    const mockOnFulfilled = vi.fn();
    const mockOnRejected = vi.fn();

    PromiseResolve('ok').then(mockOnFulfilled, mockOnRejected);

    expect(mockOnFulfilled).toHaveBeenCalledWith('ok');
    expect(mockOnRejected).not.toHaveBeenCalled();
  });

  it('calls then onRejected method in sync context', () => {
    const mockOnFulfilled = vi.fn();
    const mockOnRejected = vi.fn();

    PromiseReject('err').then(mockOnFulfilled, mockOnRejected);

    expect(mockOnFulfilled).not.toHaveBeenCalled();
    expect(mockOnRejected).toHaveBeenCalledWith('err');
  });

  it('calls then onFulfilled method in async context', async () => {
    const mockOnFulfilled = vi.fn();
    const mockOnRejected = vi.fn();

    const promise = wrapPromiseInStatusMonitor(Promise.resolve('ok')).then(
      mockOnFulfilled,
      mockOnRejected,
    );

    expect(mockOnFulfilled).not.toHaveBeenCalled();
    expect(mockOnRejected).not.toHaveBeenCalled();

    await promise;

    expect(mockOnFulfilled).toHaveBeenCalledWith('ok');
    expect(mockOnRejected).not.toHaveBeenCalled();
  });

  it('calls then onRejected method in async context', async () => {
    const mockOnFulfilled = vi.fn();
    const mockOnRejected = vi.fn();

    const promise = wrapPromiseInStatusMonitor(Promise.reject('err')).then(
      mockOnFulfilled,
      mockOnRejected,
    );

    expect(mockOnFulfilled).not.toHaveBeenCalled();
    expect(mockOnRejected).not.toHaveBeenCalled();

    await promise;

    expect(mockOnFulfilled).not.toHaveBeenCalled();
    expect(mockOnRejected).toHaveBeenCalledWith('err');
  });

  it('calls catch onRejected method in sync context', () => {
    const mockOnRejected = vi.fn();

    PromiseReject('err').catch(mockOnRejected);

    expect(mockOnRejected).toHaveBeenCalledWith('err');
  });

  it('calls catch onRejected method in async context', async () => {
    const mockOnRejected = vi.fn();

    const promise = wrapPromiseInStatusMonitor(Promise.reject('err')).catch(
      mockOnRejected,
    );

    expect(mockOnRejected).not.toHaveBeenCalled();

    await promise;

    expect(mockOnRejected).toHaveBeenCalledWith('err');
  });

  it("doesn't call catch onRejected method on resolved promise in sync context", () => {
    const mockOnRejected = vi.fn();

    PromiseResolve('ok').catch(mockOnRejected);

    expect(mockOnRejected).not.toHaveBeenCalledWith('ok');
  });

  it("doesn't call catch onRejected method on resolved promise in async context", async () => {
    const mockOnRejected = vi.fn();

    const promise = wrapPromiseInStatusMonitor(Promise.resolve('ok')).catch(
      mockOnRejected,
    );

    expect(mockOnRejected).not.toHaveBeenCalled();

    await promise;

    expect(mockOnRejected).not.toHaveBeenCalledWith('ok');
  });
});

describe('channel switches', () => {
  it('properly flows from then to then in sync context', () => {
    const mockOnFulfilled1 = vi.fn(e => e);
    const mockOnFulfilled2 = vi.fn();

    PromiseResolve('ok')
      .then(mockOnFulfilled1)

      .then(e => e)
      .catch()
      .catch()
      .then()
      .then()

      .then(mockOnFulfilled2);
    expect(mockOnFulfilled1).toHaveBeenCalledBefore(mockOnFulfilled2);
    expect(mockOnFulfilled1).toHaveBeenCalledWith('ok');
    expect(mockOnFulfilled2).toHaveBeenCalledWith('ok');
  });

  it('properly flows from then to then in async context', async () => {
    const mockOnFulfilled1 = vi.fn(e => e);
    const mockOnFulfilled2 = vi.fn();

    const promise = wrapPromiseInStatusMonitor(Promise.resolve('ok'))
      .then(mockOnFulfilled1)
      .then()
      .catch()
      .catch()
      .then()
      .then()
      .then(mockOnFulfilled2);

    await promise;

    expect(mockOnFulfilled1).toHaveBeenCalledBefore(mockOnFulfilled2);
    expect(mockOnFulfilled1).toHaveBeenCalledWith('ok');
    expect(mockOnFulfilled2).toHaveBeenCalledWith('ok');
  });

  it('properly flows from then to catch in sync context', () => {
    const mockOnFulfilled1 = vi.fn(() => {
      throw 'err';
    });
    const mockOnRejected2 = vi.fn();

    PromiseResolve('ok')
      .then(mockOnFulfilled1)
      .then()
      .catch()
      .catch()
      .then()
      .then()
      .catch(mockOnRejected2);

    expect(mockOnFulfilled1).toHaveBeenCalledBefore(mockOnRejected2);
    expect(mockOnFulfilled1).toHaveBeenCalledWith('ok');
    expect(mockOnRejected2).toHaveBeenCalledWith('err');
  });

  it('properly flows from then to catch in async context', async () => {
    const mockOnFulfilled1 = vi.fn(() => {
      throw 'err';
    });
    const mockOnRejected2 = vi.fn();

    const promise = wrapPromiseInStatusMonitor(Promise.resolve('ok'))
      .then(mockOnFulfilled1)
      .then()
      .catch()
      .catch()
      .then()
      .then()
      .catch(mockOnRejected2);

    await promise;

    expect(mockOnFulfilled1).toHaveBeenCalledBefore(mockOnRejected2);
    expect(mockOnFulfilled1).toHaveBeenCalledWith('ok');
    expect(mockOnRejected2).toHaveBeenCalledWith('err');
  });

  it('properly flows from catch to then in sync context', () => {
    const mockOnRejected1 = vi.fn(() => {
      return 'ok';
    });
    const mockOnFulfilled2 = vi.fn();

    PromiseReject('err')
      .catch(mockOnRejected1)
      .then()
      .catch()
      .catch()
      .then()
      .then()
      .then(mockOnFulfilled2);

    expect(mockOnRejected1).toHaveBeenCalledBefore(mockOnFulfilled2);
    expect(mockOnRejected1).toHaveBeenCalledWith('err');
    expect(mockOnFulfilled2).toHaveBeenCalledWith('ok');
  });

  it('properly flows from catch to then in async context', async () => {
    const mockOnRejected1 = vi.fn(() => {
      return 'ok';
    });
    const mockOnFulfilled2 = vi.fn();

    const promise = wrapPromiseInStatusMonitor(Promise.reject('err'))
      .catch(mockOnRejected1)
      .then()
      .catch()
      .catch()
      .then()
      .then()
      .then(mockOnFulfilled2);

    await promise;

    expect(mockOnRejected1).toHaveBeenCalledBefore(mockOnFulfilled2);
    expect(mockOnRejected1).toHaveBeenCalledWith('err');
    expect(mockOnFulfilled2).toHaveBeenCalledWith('ok');
  });

  it('properly flows from catch to catch in sync context', () => {
    const mockOnRejected1 = vi.fn(() => {
      throw 'err1';
    });
    const mockOnRejected2 = vi.fn(() => {
      throw 'err2';
    });

    const mockOnRejected3 = vi.fn(() => {
      throw 'err3';
    });

    const mockOnRejected4 = vi.fn(() => {
      throw 'err4';
    });

    const promise = PromiseReject('err0')
      .catch(mockOnRejected1)
      .catch(mockOnRejected2)
      .catch(mockOnRejected3)
      .catch(mockOnRejected4);

    expect(mockOnRejected1).toHaveBeenCalledBefore(mockOnRejected2);
    expect(mockOnRejected1).toHaveBeenCalledWith('err0');
    expect(mockOnRejected2).toHaveBeenCalledWith('err1');
    expect(mockOnRejected3).toHaveBeenCalledWith('err2');
    expect(mockOnRejected4).toHaveBeenCalledWith('err3');

    promise.then(void 0, _arg => {});
  });

  it('properly flows from catch to catch in async context', async () => {
    const mockOnRejected1 = vi.fn(() => {
      throw 'err1';
    });
    const mockOnRejected2 = vi.fn();

    const promise = wrapPromiseInStatusMonitor(Promise.reject('err2'))
      .catch(mockOnRejected1)
      .then()
      .catch()
      .catch()
      .then()
      .then()
      .catch(mockOnRejected2);

    await promise;

    expect(mockOnRejected1).toHaveBeenCalledBefore(mockOnRejected2);
    expect(mockOnRejected1).toHaveBeenCalledWith('err2');
    expect(mockOnRejected2).toHaveBeenCalledWith('err1');
  });
});

describe('specific rare branches', () => {
  it('branch1', async () => {
    const mock1 = vi.fn();
    const promise = wrapPromiseInStatusMonitor(
      new Promise((_resolve, reject) => {
        setTimeout(() => reject('err message1'), 2);
      }),
    );

    const result = await promise
      .catch()
      .catch(
        err =>
          new Promise((_resolve, reject) => {
            mock1();
            setTimeout(() => reject(err + '=> err message2'), 2);
          }),
      )
      .catch(
        err =>
          new Promise((_resolve, reject) => {
            mock1();
            setTimeout(() => reject(err + '=> err message3'), 2);
          }),
      )
      .catch(
        err =>
          new Promise((_resolve, reject) => {
            mock1();
            setTimeout(() => reject(err + '=> err message4'), 2);
          }),
      )
      .then(
        () => {},
        e => {
          mock1();
          return e;
        },
      )
      .catch()
      .then(e => e);

    expect(mock1).toBeCalledTimes(4);

    expect(result).toMatchInlineSnapshot(
      `"err message1=> err message2=> err message3=> err message4"`,
    );
  });

  it('branch2', async () => {
    const mock1 = vi.fn();
    const promise = wrapPromiseInStatusMonitor(
      new Promise((resolve, _reject) => {
        setTimeout(() => resolve('ok message1'), 2);
      }),
    );

    const result = await promise
      .catch()
      .then(
        ok =>
          new Promise((resolve, _reject) => {
            mock1();
            setTimeout(() => resolve(ok + '=> ok message2'), 2);
          }),
      )
      .then(
        ok =>
          new Promise((_resolve, reject) => {
            mock1();
            setTimeout(() => reject(ok + '=> err message3'), 2);
          }),
      )
      .then(
        undefined,
        err =>
          new Promise((_resolve, reject) => {
            mock1();
            setTimeout(() => reject(err + '=> err message4'), 2);
          }),
      )
      .then(
        undefined,
        err =>
          new Promise((_resolve, reject) => {
            mock1();
            setTimeout(() => reject(err + '=> err message5'), 2);
          }),
      )
      .catch(
        err =>
          new Promise((_resolve, reject) => {
            mock1();
            setTimeout(() => reject(err + '=> err message6'), 2);
          }),
      )
      .catch(
        err =>
          new Promise((_resolve, reject) => {
            mock1();
            setTimeout(() => reject(err + '=> err message7'), 2);
          }),
      )
      .then(
        undefined,
        err =>
          new Promise((resolve, _reject) => {
            mock1();
            setTimeout(() => resolve(err + '=> ok message8'), 2);
          }),
      )
      .then(
        e => {
          mock1();
          return e;
        },
        e => {
          return e + 'ssssssss';
        },
      )
      .catch()
      .then(e => e);

    expect(mock1).toBeCalledTimes(8);

    expect(result).toMatchInlineSnapshot(
      `"ok message1=> ok message2=> err message3=> err message4=> err message5=> err message6=> err message7=> ok message8"`,
    );
  });

  it('branch3', async () => {
    const mock1 = vi.fn();

    const result = await PromiseResolve('ok')
      .then(
        v =>
          new Promise((_resolve, reject) => {
            mock1();
            setTimeout(() => reject(v + 'val'), 2);
          }),
      )
      .catch(e => e + 's');

    expect(result).toBe('okvals');
  });

  it("Doesn't interpret non thenables in async context", async () => {
    const value1 = await wrapPromiseInStatusMonitor(
      new Promise(resolve => {
        setTimeout(() => resolve(null), 2);
      }),
    );

    expect(value1).toBe(null);

    const obj2 = {};
    const value2 = await wrapPromiseInStatusMonitor(
      new Promise(resolve => {
        setTimeout(() => resolve(obj2), 2);
      }),
    );

    assert(value2 === obj2);

    const obj3 = { then: 'string' };
    const value3 = await wrapPromiseInStatusMonitor(
      new Promise(resolve => {
        setTimeout(() => resolve(obj3), 2);
      }),
    );

    assert(value3 === obj3);

    const obj4 = { then: null };
    const value4 = await wrapPromiseInStatusMonitor(
      new Promise(resolve => {
        setTimeout(() => resolve(obj4), 2);
      }),
    );

    assert(value4 === obj4);

    const obj5 = {
      catch: (onRejected: (val: unknown) => void) => {
        onRejected(123);
      },
    };

    const value5 = await wrapPromiseInStatusMonitor(
      new Promise(resolve => {
        setTimeout(() => resolve(obj5), 2);
      }),
    );

    assert(value5 === obj5);

    const obj6 = {
      then: (onResolved: (val: unknown) => void) => {
        onResolved(123);
      },
    };

    const value6 = await wrapPromiseInStatusMonitor(
      new Promise(resolve => {
        setTimeout(() => resolve(obj6), 2);
      }),
    );

    assert(value6 === 123);
  });

  it("Doesn't interpret non thenables in sync context", async () => {
    const value1 = await PromiseResolve(null);

    expect(value1).toBe(null);

    const obj2 = {};
    const value2 = await PromiseResolve(obj2);

    assert(value2 === obj2);

    const obj3 = { then: 'string' };
    const value3 = await PromiseResolve(obj3);

    assert(value3 === obj3);

    const obj4 = { then: null };
    const value4 = await PromiseResolve(obj4);

    assert(value4 === obj4);

    const obj5 = {
      catch: (onRejected: (val: unknown) => void) => {
        onRejected(123);
      },
    };

    const value5 = await PromiseResolve(obj5);

    assert(value5 === obj5);

    const obj6 = {
      then: (onResolved: (val: unknown) => void) => {
        onResolved(123);
      },
    };

    const value6 = await PromiseResolve(obj6);

    assert(value6 === 123);
  });

  it('correctly shows context', () => {
    const promise = PromiseResolve(123, { context: 'cool' });
    expect(promise.ctx).toStrictEqual({ context: 'cool' });

    const promise2 = PromiseResolve(123, null);
    expect(promise2.ctx).toStrictEqual(null);

    const promise3 = PromiseResolve(123, false);
    expect(promise3.ctx).toStrictEqual(false);
  });

  it('correctly handles `in` keyword ', () => {
    const promise = PromiseResolve(123, { context: 'cool' });
    expect(promise).not.toHaveProperty('context');
    expect(promise).not.toHaveProperty('sadf');
    assert(Symbol.toStringTag in promise);
  });

  it('correctly handles values of PromiseResolve and PromiseReject', () => {
    const promise = PromiseResolve(123, { context: 'cool' });
    if (promise.status === 'fulfilled') {
      expect(promise.result).toEqual(123);
    } else
      assert(false, 'promise.status of PromiseResolve should be fulfilled');

    const promise2 = PromiseReject(123, { context: 'cool' });
    if (promise2.status === 'rejected') {
      expect(promise2.error).toEqual(123);
      promise2.catch(() => {});
    } else assert(false, 'promise.status of PromiseReject should be rejected');
  });

  it('passes as Promise when converted to string', () => {
    assert(
      Promise.resolve(123)[Symbol.toStringTag] ===
        PromiseResolve(123)[Symbol.toStringTag],
    );
    const [a, b] = [Promise.reject(123), PromiseReject(123)];
    assert(a[Symbol.toStringTag] === b[Symbol.toStringTag]);

    a.catch(() => {});
    b.catch(() => {});
  });

  it.skip("doesn't automatically call `.then(...)` to track promises when externally managed", async () => {
    //  wrapPromise.ts |  93.44 |   93.44 |      169 |         2 |         12 |        0 |        6 |
    const usualResolvedPromiseArgsLengths = {
      '0': 0,
      '1': 0,
      '2': 0,
    };
    const usualThenable = new Proxy(
      {},
      {
        get(target, p, receiver) {
          let valSource = Reflect.get(target, p, receiver);
          if (p !== 'then') return valSource;
          // @ts-ignore
          let val = f => {
            console.log('usualThenable called with stack: ', new Error().stack);
            f(999);
          };

          return new Proxy(val, {
            apply(target, thisArg, argArray) {
              // @ts-ignore
              usualResolvedPromiseArgsLengths[argArray.length] += 1;

              return Reflect.apply(val, thisArg, argArray);
            },
          });
        },
      },
    ) as any;

    console.log('usualResolvedPromise preinit');
    const usualResolvedPromise = Promise.resolve(usualThenable);
    console.log('usualResolvedPromise postinit');

    expect(usualResolvedPromiseArgsLengths).toEqual({
      '0': 0,
      '1': 0,
      '2': 0,
    });

    console.log('pre long tick');
    await initiallyLongPendingPromise('2');
    console.log('post long tick');
    // Promise.resolve will call it, but not internal mechanism of value tracking

    expect(usualResolvedPromiseArgsLengths).toEqual({
      '0': 0,
      '1': 0,
      '2': 1,
    });

    console.log('usualResolvedPromise pre await result');
    console.log('result: ', await usualResolvedPromise);
    console.log('usualResolvedPromise post await result');

    expect(usualResolvedPromiseArgsLengths).toEqual({
      '0': 0,
      '1': 0,
      '2': 1,
    });

    console.log('pre long tick');
    await initiallyLongPendingPromise('2');
    console.log('post long tick');
    // Promise.resolve will call it, but not internal mechanism of value tracking

    expect(usualResolvedPromiseArgsLengths).toEqual({
      '0': 0,
      '1': 0,
      '2': 1,
    });

    console.log('usualResolvedPromise pre await result');
    console.log('result: ', await usualResolvedPromise);
    console.log('usualResolvedPromise post await result');

    expect(usualResolvedPromiseArgsLengths).toEqual({
      '0': 0,
      '1': 0,
      '2': 1,
    });

    // /////////////////////////////////////////////

    const myResolvedPromiseArgsLengths = {
      '0': 0,
      '1': 0,
      '2': 0,
    };

    const gen = () => {
      let r:
        | { status: 'pending' }
        | { status: 'fulfilled'; v: unknown }
        | { status: 'rejected'; v: unknown } = { status: 'pending' };

      // WeakSet?
      const consumersOnRejected = new Set<(v: unknown) => void>();
      const consumersOnResolved = new Set<(v: unknown) => void>();

      setTimeout(() => {
        r = { status: 'fulfilled', v: 'yay' };

        if (r.status === 'fulfilled') {
          for (const cb of consumersOnResolved) {
            try {
              cb(r.v);
            } catch (error) {
              // ?????
            }
          }
        } else {
          for (const cb of consumersOnRejected) {
            try {
              // @ts-ignore
              cb(r.v);
            } catch (error) {
              // ?????
            }
          }
        }
      }, 2000);

      const myThenable = new Proxy(
        { then: () => {} },
        {
          get(target, p, receiver) {
            let valSource = Reflect.get(target, p, receiver);

            if (p !== 'then') return valSource;

            return new Proxy(valSource, {
              getPrototypeOf(target) {
                return Function;
              },
              apply(valSource, thisArg, argArray) {
                // @ts-ignore
                myResolvedPromiseArgsLengths[argArray.length] += 1;

                if (r.status === 'fulfilled') {
                  return argArray[0](r.v);
                } else if (r.status === 'rejected') {
                  return argArray[1](r.v);
                } else {
                  consumersOnResolved.add(argArray[0]);
                  consumersOnRejected.add(argArray[1]);
                  return;
                }
              },
            });
          },
        },
      ) as any;
      return myThenable;
    };

    const myThenable = gen();
    console.log('myResolvedPromise preinit');
    const myPromise = myThenable;
    console.log('myResolvedPromise postinit');

    expect(myResolvedPromiseArgsLengths).toEqual({
      '0': 0,
      '1': 0,
      '2': 0,
    });

    console.log('pre long tick');
    await initiallyLongPendingPromise('2');
    console.log('post long tick');
    // Promise.resolve will call it, but not internal mechanism of value tracking
    // expect(myResolvedPromiseArgsLengths).toEqual({
    //   '0': 0,
    //   '1': 0,
    //   '2': 1,
    // });

    console.log('myResolvedPromise pre await result');
    const result = await myPromise;
    console.log('result: ', result);
    console.log('myResolvedPromise post await result');

    expect(myResolvedPromiseArgsLengths).toEqual({
      '0': 0,
      '1': 0,
      '2': 1,
    });

    // Promise.resolve consumed it
  });

  it('throws when called with finally', () => {
    expect(() =>
      PromiseResolve('hello').finally(() => {}),
    ).toThrowErrorMatchingInlineSnapshot(`[Error: finally is not supported]`);
  });

  it('calls second then in async context but synchronously sets new state', async () => {
    const promise = wrapPromiseInStatusMonitor(
      initiallyLongPendingPromise('right'),
    );

    assert(promise.status === 'pending');

    const promise2 = promise.then(e => '2' + e);

    expect(await promise).toBe('right');
    // @ts-ignore
    expect(promise2.result).toBe('2right');
    // @ts-ignore
    expect(promise.result).toBe('right');
  });

  it('calls second then in async context but synchronously sets new state and also with thenable: then path', async () => {
    const thenable = {
      then(f: Function, r: Function) {
        f('fffff');
        return [f, r].filter(e => typeof e === 'function').length;
      },
    };

    const thenSpy = vi.spyOn(thenable, 'then');

    const promise = wrapPromiseInStatusMonitor(
      initiallyLongPendingPromise('right'),
    );

    assert(promise.status === 'pending');

    const promise2 = promise.then(e => thenable);

    expect(await promise).toBe('right');
    expect(thenSpy).toHaveBeenCalledOnce();
    expect(thenSpy).toHaveReturnedWith(2);

    // @ts-ignore
    expect(promise2.result).toBe('fffff');
    // @ts-ignore
    expect(promise.result).toBe('right');
  });

  it('calls second then in async context but synchronously sets new state and also with thenable: catch path', async () => {
    const anotherThenable = {
      then(f: any) {
        f('lllllll');
      },
    };

    const initiallyLongPendingPromiseThatRejectsWith = (w: any) =>
      new Promise((resolve, reject) =>
        setTimeout(() => reject(anotherThenable), 2),
      );
    const err = new Error('fffff');
    const haveThrownMarker = vi.fn();

    const thenable = {
      then(_: Function, r: Function) {
        try {
          r(err);
        } catch (error) {
          haveThrownMarker(error);
          throw error;
        }
      },
    };

    const promise = wrapPromiseInStatusMonitor(
      initiallyLongPendingPromiseThatRejectsWith('err message'),
    );

    assert(promise.status === 'pending');

    const promise2 = promise.catch(e => thenable);

    let rejectedWith: unknown = Symbol('undefined');

    try {
      await promise;
    } catch (error) {
      rejectedWith = error;
    }

    expect(rejectedWith).toBe(anotherThenable);
    expect(haveThrownMarker).toHaveBeenCalledExactlyOnceWith(err);
    // @ts-ignore
    expect(promise2.error).toBe(err);
    // @ts-ignore
    expect(promise.error).toBe(anotherThenable);
  });
});

describe('isThenable', () => {
  it('returns correct answers', () => {
    expect(isThenable(123)).toBe(false);
    expect(isThenable('123')).toBe(false);
    expect(isThenable(undefined)).toBe(false);
    expect(isThenable({ then() {} })).toBe(true);
    expect(isThenable({ then: {} })).toBe(false);
    expect(isThenable({ then: null })).toBe(false);
    expect(isThenable({ then: 'null' })).toBe(false);
    expect(isThenable({ then: () => {} })).toBe(true);
    expect(isThenable(PromiseResolve(123))).toBe(true);
    expect(isThenable(Promise.resolve(123))).toBe(true);
  });
});
