import {eventBus} from '../EventBus';

// Reset EventBus between tests
afterEach(() => {
  eventBus.removeAllListeners();
});

describe('EventBus', () => {
  it('delivers events to subscribers', () => {
    const handler = jest.fn();
    eventBus.on('hr:reading', handler);

    const reading = {
      bpm: 72,
      timestamp: Date.now(),
      sensorContact: true,
      rrIntervals: [],
      energyExpended: null,
    };

    eventBus.emit('hr:reading', reading);

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith(reading);
  });

  it('supports multiple subscribers for same event', () => {
    const handler1 = jest.fn();
    const handler2 = jest.fn();

    eventBus.on('hr:reading', handler1);
    eventBus.on('hr:reading', handler2);

    eventBus.emit('hr:reading', {
      bpm: 80,
      timestamp: Date.now(),
      sensorContact: true,
      rrIntervals: [],
      energyExpended: null,
    });

    expect(handler1).toHaveBeenCalledTimes(1);
    expect(handler2).toHaveBeenCalledTimes(1);
  });

  it('unsubscribe function removes only that handler', () => {
    const handler1 = jest.fn();
    const handler2 = jest.fn();

    const unsub1 = eventBus.on('hr:reading', handler1);
    eventBus.on('hr:reading', handler2);

    unsub1();

    eventBus.emit('hr:reading', {
      bpm: 80,
      timestamp: Date.now(),
      sensorContact: true,
      rrIntervals: [],
      energyExpended: null,
    });

    expect(handler1).not.toHaveBeenCalled();
    expect(handler2).toHaveBeenCalledTimes(1);
  });

  it('does not throw when emitting with no listeners', () => {
    expect(() => {
      eventBus.emit('hr:reading', {
        bpm: 80,
        timestamp: Date.now(),
        sensorContact: true,
        rrIntervals: [],
        energyExpended: null,
      });
    }).not.toThrow();
  });

  it('removeAllListeners clears all handlers', () => {
    const handler = jest.fn();
    eventBus.on('hr:reading', handler);
    eventBus.on('algo:target', jest.fn());

    eventBus.removeAllListeners();

    eventBus.emit('hr:reading', {
      bpm: 80,
      timestamp: Date.now(),
      sensorContact: true,
      rrIntervals: [],
      energyExpended: null,
    });

    expect(handler).not.toHaveBeenCalled();
  });

  it('delivers events synchronously in subscription order', () => {
    const order: number[] = [];

    eventBus.on('hr:reading', () => order.push(1));
    eventBus.on('hr:reading', () => order.push(2));
    eventBus.on('hr:reading', () => order.push(3));

    eventBus.emit('hr:reading', {
      bpm: 80,
      timestamp: Date.now(),
      sensorContact: true,
      rrIntervals: [],
      energyExpended: null,
    });

    expect(order).toEqual([1, 2, 3]);
  });
});
