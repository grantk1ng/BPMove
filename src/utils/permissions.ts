import {Platform, PermissionsAndroid} from 'react-native';

export type PermissionResult = 'granted' | 'denied' | 'blocked';

export async function requestBlePermissions(): Promise<PermissionResult> {
  if (Platform.OS === 'ios') {
    // iOS BLE permissions are handled via Info.plist declarations
    // and prompted automatically by the system on first BLE usage
    return 'granted';
  }

  // Android requires runtime permissions
  if (Platform.OS === 'android') {
    const apiLevel = Platform.Version;

    if (apiLevel >= 31) {
      // Android 12+ requires BLUETOOTH_SCAN and BLUETOOTH_CONNECT
      const results = await PermissionsAndroid.requestMultiple([
        PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
        PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
      ]);

      const allGranted = Object.values(results).every(
        r => r === PermissionsAndroid.RESULTS.GRANTED,
      );

      if (allGranted) {
        return 'granted';
      }

      const anyBlocked = Object.values(results).some(
        r => r === PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN,
      );

      return anyBlocked ? 'blocked' : 'denied';
    } else {
      // Android < 12 requires location permission for BLE scanning
      const result = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
      );

      if (result === PermissionsAndroid.RESULTS.GRANTED) {
        return 'granted';
      }
      return result === PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN
        ? 'blocked'
        : 'denied';
    }
  }

  return 'granted';
}

export async function requestNotificationPermission(): Promise<PermissionResult> {
  if (Platform.OS === 'android' && Platform.Version >= 33) {
    const result = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
    );

    if (result === PermissionsAndroid.RESULTS.GRANTED) {
      return 'granted';
    }
    return result === PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN
      ? 'blocked'
      : 'denied';
  }

  return 'granted';
}
