import {useState, useEffect, useCallback} from 'react';
import {eventBus} from '../../core/EventBus';
import {ServiceRegistry} from '../../core/ServiceRegistry';
import type {HeartRateReading, BleDeviceInfo, ConnectionState} from './types';
import type {HeartRateService} from './HeartRateService';

export function useHeartRate() {
  const [currentHR, setCurrentHR] = useState<number | null>(null);
  const [connectionState, setConnectionState] =
    useState<ConnectionState>('disconnected');
  const [lastReading, setLastReading] = useState<HeartRateReading | null>(null);
  const [devices, setDevices] = useState<BleDeviceInfo[]>([]);

  useEffect(() => {
    const unsubs = [
      eventBus.on('hr:reading', (reading: HeartRateReading) => {
        setCurrentHR(reading.bpm);
        setLastReading(reading);
      }),
      eventBus.on(
        'hr:connectionStateChanged',
        (state: ConnectionState) => {
          setConnectionState(state);
          if (state === 'scanning') {
            setDevices([]);
          }
        },
      ),
      eventBus.on('hr:scanResult', (device: BleDeviceInfo) => {
        setDevices(prev => {
          if (prev.some(d => d.id === device.id)) {
            return prev.map(d => (d.id === device.id ? device : d));
          }
          return [...prev, device];
        });
      }),
    ];

    return () => unsubs.forEach(unsub => unsub());
  }, []);

  const startScan = useCallback(() => {
    const service = ServiceRegistry.get<HeartRateService>('heartrate');
    service.startScan();
  }, []);

  const stopScan = useCallback(() => {
    const service = ServiceRegistry.get<HeartRateService>('heartrate');
    service.stopScan();
  }, []);

  const connect = useCallback(async (deviceId: string) => {
    const service = ServiceRegistry.get<HeartRateService>('heartrate');
    await service.connect(deviceId);
  }, []);

  const disconnect = useCallback(async () => {
    const service = ServiceRegistry.get<HeartRateService>('heartrate');
    await service.disconnect();
  }, []);

  return {
    currentHR,
    connectionState,
    lastReading,
    devices,
    startScan,
    stopScan,
    connect,
    disconnect,
  };
}
