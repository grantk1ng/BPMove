import {eventBus} from '../../../core/EventBus';
import {AdaptiveBPMEngine} from '../AdaptiveBPMEngine';
import {createDefaultConfig, HR_ZONE_PRESETS} from '../presets';
import type {HeartRateReading} from '../../heartrate/types';
import type {BPMTarget} from '../types';

function makeReading(bpm: number, timestamp: number): HeartRateReading {
  return {
    bpm,
    timestamp,
    sensorContact: true,
    rrIntervals: [],
    energyExpended: null,
  };
}

describe('AdaptiveBPMEngine', () => {
  beforeEach(() => {
    eventBus.removeAllListeners();
  });

  afterEach(() => {
    eventBus.removeAllListeners();
  });

  it('emits an initial target again after a session restart', () => {
    const engine = new AdaptiveBPMEngine(createDefaultConfig(HR_ZONE_PRESETS[0]));
    const targets: BPMTarget[] = [];
    eventBus.on('algo:target', target => targets.push(target));

    engine.start();
    eventBus.emit('hr:reading', makeReading(140, 1_000));
    engine.stop();

    engine.start();
    eventBus.emit('hr:reading', makeReading(140, 2_000));

    expect(targets).toHaveLength(2);
    expect(targets[0].targetBPM).toBe(targets[1].targetBPM);

    engine.destroy();
  });
});
