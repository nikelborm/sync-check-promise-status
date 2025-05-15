import { assert, describe, expect, it, vi } from 'vitest';
import {
  PromiseReject,
  PromiseResolve,
  wrapPromiseInStatusMonitor,
} from './wrapPromise.ts';

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
      `[Error: Can't get result of pending promise]`,
    );
    // @ts-expect-error intentional
    expect(() => promise.error).toThrowErrorMatchingInlineSnapshot(
      `[Error: Can't get error of pending promise]`,
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
      `[Error: Can't get result of pending promise]`,
    );
    // @ts-expect-error intentional
    expect(() => promise.error).toThrowErrorMatchingInlineSnapshot(
      `[Error: Can't get error of pending promise]`,
    );

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

  it('correctly handles delayed Promise which resolves', async () => {
    const promise = wrapPromiseInStatusMonitor(
      new Promise((resolve, _reject) => {
        setTimeout(() => resolve('ok'), 2);
      }),
    );

    expect(promise).toHaveProperty('status', 'pending');
    // @ts-expect-error intentional
    expect(() => promise.result).toThrowErrorMatchingInlineSnapshot(
      `[Error: Can't get result of pending promise]`,
    );
    // @ts-expect-error intentional
    expect(() => promise.error).toThrowErrorMatchingInlineSnapshot(
      `[Error: Can't get error of pending promise]`,
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
    const promise = wrapPromiseInStatusMonitor(
      new Promise((_resolve, reject) => {
        setTimeout(() => reject('err message'), 2);
      }),
    );

    expect(promise).toHaveProperty('status', 'pending');
    // @ts-expect-error intentional
    expect(() => promise.result).toThrowErrorMatchingInlineSnapshot(
      `[Error: Can't get result of pending promise]`,
    );
    // @ts-expect-error intentional
    expect(() => promise.error).toThrowErrorMatchingInlineSnapshot(
      `[Error: Can't get error of pending promise]`,
    );

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
});
