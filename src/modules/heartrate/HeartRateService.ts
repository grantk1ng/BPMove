import {BleManager, Device, Characteristic} from 'react-native-ble-plx';
import {eventBus} from '../../core/EventBus';
import type {
  HeartRateReading,
  BleDeviceInfo,
  ConnectionState,
  HeartRateServiceInterface,
} from './types';
import {parseHeartRateMeasurement} from './utils/heartRateParser';

const HR_SERVICE_UUID = '0000180d-0000-1000-8000-00805f9b34fb';
const HR_MEASUREMENT_UUID = '00002a37-0000-1000-8000-00805f9b34fb';

export class HeartRateService implements HeartRateServiceInterface {
  private manager: BleManager;
  private connectedDevice: Device | null = null;
  private connectionState: ConnectionState = 'disconnected';
  private lastReading: HeartRateReading | null = null;

  constructor() {
    this.manager = new BleManager();
  }

  startScan(): void {
    this.setConnectionState('scanning');
    this.manager.startDeviceScan(
      [HR_SERVICE_UUID],
      {allowDuplicates: false},
      (error, device) => {
        if (error) {
          eventBus.emit('hr:error', {
            message: error.message,
            code: error.errorCode?.toString() ?? null,
          });
          return;
        }
        if (device) {
          const info: BleDeviceInfo = {
            id: device.id,
            name: device.name ?? device.localName ?? null,
            rssi: device.rssi ?? -100,
          };
          eventBus.emit('hr:scanResult', info);
        }
      },
    );
  }

  stopScan(): void {
    this.manager.stopDeviceScan();
    if (this.connectionState === 'scanning') {
      this.setConnectionState('disconnected');
    }
  }

  async connect(deviceId: string): Promise<void> {
    this.stopScan();
    this.setConnectionState('connecting');

    try {
      const device = await this.manager.connectToDevice(deviceId);
      await device.discoverAllServicesAndCharacteristics();
      this.connectedDevice = device;

      const info: BleDeviceInfo = {
        id: device.id,
        name: device.name ?? device.localName ?? null,
        rssi: device.rssi ?? -100,
      };
      this.setConnectionState('connected');
      eventBus.emit('hr:connected', info);

      // Monitor disconnection
      this.manager.onDeviceDisconnected(deviceId, (error, _device) => {
        this.connectedDevice = null;
        this.setConnectionState('disconnected');
        eventBus.emit('hr:disconnected', {
          deviceId,
          reason: error?.message ?? 'Device disconnected',
        });
      });

      // Subscribe to HR measurements
      device.monitorCharacteristicForService(
        HR_SERVICE_UUID,
        HR_MEASUREMENT_UUID,
        (error, characteristic) => {
          if (error) {
            eventBus.emit('hr:error', {
              message: error.message,
              code: error.errorCode?.toString() ?? null,
            });
            return;
          }
          if (characteristic?.value) {
            this.handleCharacteristic(characteristic);
          }
        },
      );
    } catch (error) {
      this.setConnectionState('error');
      eventBus.emit('hr:error', {
        message:
          error instanceof Error ? error.message : 'Connection failed',
        code: null,
      });
    }
  }

  async disconnect(): Promise<void> {
    if (this.connectedDevice) {
      this.setConnectionState('disconnecting');
      try {
        await this.connectedDevice.cancelConnection();
      } catch {
        // Device may already be disconnected
      }
      this.connectedDevice = null;
      this.setConnectionState('disconnected');
    }
  }

  getConnectionState(): ConnectionState {
    return this.connectionState;
  }

  getLastReading(): HeartRateReading | null {
    return this.lastReading;
  }

  destroy(): void {
    this.disconnect();
    this.manager.destroy();
  }

  private setConnectionState(state: ConnectionState): void {
    this.connectionState = state;
    eventBus.emit('hr:connectionStateChanged', state);
  }

  private handleCharacteristic(characteristic: Characteristic): void {
    if (!characteristic.value) {
      return;
    }

    // Decode base64 to byte array
    const bytes = base64ToBytes(characteristic.value);
    const parsed = parseHeartRateMeasurement(bytes);

    const reading: HeartRateReading = {
      ...parsed,
      timestamp: Date.now(),
    };

    this.lastReading = reading;
    eventBus.emit('hr:reading', reading);
  }
}

function base64ToBytes(base64: string): number[] {
  const binaryString = atob(base64);
  const bytes: number[] = [];
  for (let i = 0; i < binaryString.length; i++) {
    bytes.push(binaryString.charCodeAt(i));
  }
  return bytes;
}
