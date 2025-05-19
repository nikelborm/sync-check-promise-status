import { assert, describe, expect, it, vi } from 'vitest';
import {
  PromiseReject,
  PromiseResolve,
  isThenable,
  isWrappedPromise,
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
  it('when rejected promises are returned from catches, they flow and being interpreted', async () => {
    const mock1 = vi.fn();
    const mock2 = vi.fn();
    const mock3 = vi.fn();
    const promise = wrapPromiseInStatusMonitor(
      new Promise((_resolve, reject) => {
        setTimeout(() => reject('err message1'), 2);
      }),
    );

    const result1 = promise.catch().catch(async err => {
      return new Promise((_resolve, reject) => {
        mock1();
        setTimeout(() => reject(err + '=> err message2'), 2);
      });
    });

    const result2 = result1
      .catch(err => {
        return new Promise((_resolve, reject) => {
          mock1();
          setTimeout(() => reject(err + '=> err message3'), 2);
        });
      })
      .catch(
        err =>
          new Promise((_resolve, reject) => {
            mock1();
            setTimeout(() => reject(err + '=> err message4'), 2);
          }),
      )
      .then(
        () => {},
        v => {
          mock2(v);
          return v;
        },
      )

      .catch()
      .then(e => {
        mock3(e);
        return e;
      });

    let result1Err;

    try {
      await result1;
    } catch (error) {
      result1Err = error;
    }
    expect(result1Err).toBe('err message1=> err message2');

    const result = await result2;

    expect(mock1).toBeCalledTimes(3);
    expect(mock2).toHaveBeenCalledExactlyOnceWith(
      'err message1=> err message2=> err message3=> err message4',
    );
    expect(mock3).toHaveBeenCalledExactlyOnceWith(
      'err message1=> err message2=> err message3=> err message4',
    );
    expect(result).toBe(
      'err message1=> err message2=> err message3=> err message4',
    );
  });

  it("when rejected promises are thrown from catches, they don't flow and NOT being interpreted", async () => {
    const mock1 = vi.fn();
    const mock2 = vi.fn();
    const mock3 = vi.fn();
    const promise = wrapPromiseInStatusMonitor(
      new Promise((_resolve, reject) => {
        setTimeout(() => reject('err message1'), 2);
      }),
    );
    const prom = new Promise((_resolve, reject) => {
      mock1();
      setTimeout(() => reject('err message1=> err message2'), 10);
    });

    const result1 = promise.catch().catch(err => {
      throw prom;
    });

    const result2 = result1
      .catch(err => {
        mock1();
        throw err;
      })
      .catch(err => {
        mock1();
        throw err;
      })
      .then(
        () => {},
        v => {
          mock2(v);
          return v;
        },
      )

      .catch()
      .then(
        () => {},
        e => {
          mock3(e);
          return e;
        },
      );

    let result1Err;

    try {
      await result1;
    } catch (error) {
      result1Err = error;
    }
    expect(result1Err).toBe(prom);
    expect(result1.error).toBe(prom);

    const result = await result2;

    expect(mock1).toBeCalledTimes(3);
    expect(mock2).toHaveBeenCalledExactlyOnceWith(prom);
    expect(mock3).toHaveBeenCalledExactlyOnceWith(
      'err message1=> err message2',
    );

    expect(result2.result).toBe('err message1=> err message2');
    expect(result).toBe('err message1=> err message2');
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
    } else
      expect.unreachable('promise.status of PromiseReject should be rejected');
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

    const promise2 = promise.then(() => thenable);

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

    const initiallyLongPendingPromiseThatRejectsWith = (_: any) =>
      new Promise((_, reject) => setTimeout(() => reject(anotherThenable), 2));
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

    const promise2 = promise.catch(() => thenable);

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

    promise2.catch(() => {});
  });

  it('correctly handles ambiguous resolutions in the context of status tracking initialization', async () => {
    const spyConsole = vi.spyOn(console, 'error');

    const err = new Error('wtf');

    const mock1 = vi.fn();
    const mock2 = vi.fn();

    class FuckedUpPromise {
      then(
        onFulfilled: (v: unknown) => void,
        onRejected: (v: unknown) => void,
      ) {
        mock1();
        onFulfilled('Good!');
        onRejected(err);
      }
    }

    const fuckedUpPromise = new FuckedUpPromise();

    const promise = wrapPromiseInStatusMonitor(
      fuckedUpPromise as Promise<unknown>,
    );

    await promise;

    expect(promise.isFulfilled).toBe(true);

    if (promise.isFulfilled) expect(promise.result).toBe('Good!');

    expect(mock1).toHaveBeenCalledOnce();

    expect(spyConsole).toHaveBeenCalledExactlyOnceWith(
      `Can't %s promise, that's already %s`,
      'reject',
      'fulfilled',
    );

    class FuckedUpPromise2 {
      then(
        onFulfilled: (v: unknown) => void,
        onRejected: (v: unknown) => void,
      ) {
        mock2();
        try {
          onRejected(err);
        } catch (error) {}
        onFulfilled('Good!');
      }
    }

    const fuckedUpPromise2 = new FuckedUpPromise2();

    const promise2 = wrapPromiseInStatusMonitor(
      fuckedUpPromise2 as Promise<unknown>,
    );
    // once to set the internal state tracker
    expect(mock2).toHaveBeenCalledOnce();

    await initiallyLongPendingPromise('s');
    await initiallyLongPendingPromise('s');

    try {
      await promise2;
    } catch (error) {}

    expect(promise2.isRejected).toBe(true);

    if (promise2.isRejected) expect(promise2.error).toBe(err);

    // once to set the internal state tracker and the second time to await
    expect(mock2).toHaveBeenCalledOnce();

    expect(spyConsole).toHaveBeenNthCalledWith(
      2,
      `Can't %s promise, that's already %s`,
      'fulfill',
      'rejected',
    );
  });

  it('correctly handles ambiguous resolutions in the context of setting immediate then on Pending promise', async () => {
    const mock1 = vi.fn();
    const mock2 = vi.fn();

    const err = new Error('wtf');

    class FuckedUpPromise {
      then(
        onFulfilled: (v: unknown) => void,
        onRejected: (v: unknown) => void,
      ) {
        try {
          onFulfilled('Good!');
          onRejected(err);
        } catch (error) {}
        mock1();
      }
    }

    const fuckedUpPromise = new FuckedUpPromise();

    const promise = wrapPromiseInStatusMonitor(Promise.resolve('yeah')).then(
      () => fuckedUpPromise,
    );

    await promise;

    expect(promise.isFulfilled).toBe(true);

    if (promise.isFulfilled) expect(promise.result).toBe('Good!');

    expect(mock1).toHaveBeenCalledOnce();

    class FuckedUpPromise2 {
      then(
        onFulfilled: (v: unknown) => void,
        onRejected: (v: unknown) => void,
      ) {
        try {
          onRejected(err);
        } catch (error) {}
        onFulfilled('Good!');

        mock2();
      }
    }

    const fuckedUpPromise2 = new FuckedUpPromise2();

    const promise2 = wrapPromiseInStatusMonitor(
      fuckedUpPromise2 as Promise<unknown>,
    );

    try {
      await promise2;
    } catch (error) {}

    expect(promise2.isRejected).toBe(true);

    if (promise2.isRejected) expect(promise2.error).toBe(err);

    expect(mock2).toHaveBeenCalledOnce();
  });

  it("Doesn't call setting trackingPromise when not needed", async () => {
    const mock1 = vi.fn();
    class CustomPromise {
      fn: () => void;
      constructor(fn: () => void) {
        this.fn = fn;
      }

      then(onFulfilled: () => void, onRejected: () => void) {
        mock1(onFulfilled, onRejected);
      }
    }

    const asd = PromiseReject(new CustomPromise(mock1));

    expect(mock1).toHaveBeenCalledTimes(0);

    asd.then(void 0, () => {});
  });

  it('Calls setting trackingPromise when needed', async () => {
    const mock1 = vi.fn();
    const mock2 = vi.fn();
    class CustomPromise {
      fn: () => void;
      constructor(fn: () => void) {
        this.fn = fn;
      }

      then(onFulfilled: (asd: string) => void, onRejected: () => void) {
        mock1(onFulfilled, onRejected);
        onFulfilled('sad');
        return {
          then() {
            mock2();
            return {};
          },
        };
      }
    }

    const asd = PromiseResolve(new CustomPromise(mock1));
    expect(mock1).toHaveBeenCalledTimes(1);
    expect(mock2).toHaveBeenCalledTimes(0);
    await asd;

    expect(mock1).toHaveBeenCalledTimes(1);
    expect(mock2).toHaveBeenCalledTimes(0);

    const obj = PromiseResolve('123');

    expect(obj.status).toBe('fulfilled');
    expect(obj.result).toBe('123');

    const spy = vi.spyOn(obj, 'then');

    expect(spy).toHaveBeenCalledTimes(0);

    const asd2 = PromiseResolve(obj);

    expect(asd2.status).toBe('fulfilled');
    expect(asd2.result).toBe('123');

    expect(spy).toHaveBeenCalledTimes(0);

    const res = await asd2;

    expect(mock1).toHaveBeenCalledTimes(1);
    expect(res).toBe('123');
    expect(asd2.status).toBe('fulfilled');
    expect(asd2.result).toBe('123');
  });

  it('case fuck it', async () => {
    const mock1 = vi.fn();
    const mock2 = vi.fn();

    class CustomPromise {
      marker = true;
      then(onFulfilled: (asd: string) => void, onRejected: () => void) {
        mock1(onFulfilled, onRejected);
        onFulfilled('sad');
        return {
          then(onFulfilled: (asd: string) => void) {
            onFulfilled('sad');
            mock2();
            return {};
          },
        };
      }
    }

    const asd = PromiseReject(new CustomPromise());
    expect(mock1).toHaveBeenCalledTimes(0);
    expect(mock2).toHaveBeenCalledTimes(0);

    try {
      await asd;
      expect.unreachable();
    } catch (error) {
      expect(error.marker).toBe(true);
    }

    expect(mock1).toHaveBeenCalledTimes(0);
    expect(mock2).toHaveBeenCalledTimes(0);
  });

  it('case fuck it 2', async () => {
    const mock1 = vi.fn();
    const newProm = new Promise((resolve, reject) => {
      setTimeout(() => {
        mock1();
        resolve(123);
      }, 10);
    });

    const spy = vi.spyOn(newProm, 'then');
    const spyConsole = vi.spyOn(console, 'error');

    const asd = PromiseResolve(newProm);

    expect(mock1).toHaveBeenCalledTimes(0);
    expect(spy).toHaveBeenCalledTimes(1);

    await asd;

    expect(mock1).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalledTimes(1);
    await new Promise((resolve, reject) => {
      setTimeout(() => {
        mock1();
        resolve(123);
      }, 10);
    });

    expect(spyConsole).not.toHaveBeenCalledWith(
      `Can't %s promise, that's already %s`,
      'fulfill',
      'fulfilled',
    );
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

describe('isWrappedPromise', () => {
  it('returns correct answers', () => {
    // @ts-ignore
    expect(isWrappedPromise(123)).toBe(false);
    // @ts-ignore
    expect(isWrappedPromise('123')).toBe(false);
    // @ts-ignore
    expect(isWrappedPromise(undefined)).toBe(false);
    // @ts-ignore
    expect(isWrappedPromise({ then() {} })).toBe(false);
    // @ts-ignore
    expect(isWrappedPromise({ then: {} })).toBe(false);
    // @ts-ignore
    expect(isWrappedPromise({ then: null })).toBe(false);
    // @ts-ignore
    expect(isWrappedPromise({ then: 'null' })).toBe(false);
    // @ts-ignore
    expect(isWrappedPromise({ then: () => {} })).toBe(false);
    // @ts-ignore
    expect(isWrappedPromise(PromiseResolve(123))).toBe(true);
    expect(isWrappedPromise(Promise.resolve(123))).toBe(false);
  });
});
