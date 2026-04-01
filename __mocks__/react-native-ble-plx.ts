export class BleManager {
  startDeviceScan = jest.fn();
  stopDeviceScan = jest.fn();
  connectToDevice = jest.fn();
  cancelDeviceConnection = jest.fn();
  discoverAllServicesAndCharacteristicsForDevice = jest.fn();
  monitorCharacteristicForDevice = jest.fn();
  destroy = jest.fn();
  state = jest.fn(async () => 'PoweredOn');
  onStateChange = jest.fn(() => ({remove: jest.fn()}));
}

export class BleError extends Error {
  errorCode: number;
  constructor(message: string, errorCode: number) {
    super(message);
    this.errorCode = errorCode;
  }
}

export const BleErrorCode = {};
export const BleAndroidErrorCode = {};
export const BleIOSErrorCode = {};
export const BleATTErrorCode = {};
