import BackgroundService from 'react-native-background-actions';
import {Platform} from 'react-native';

const BACKGROUND_TASK_OPTIONS = {
  taskName: 'BPMoveSession',
  taskTitle: 'BPMove Active Session',
  taskDesc: 'Heart rate monitoring and adaptive music playback',
  taskIcon: {
    name: 'ic_launcher',
    type: 'mipmap',
  },
  color: '#1976D2',
  linkingURI: 'bpmove://session',
};

async function backgroundTask(): Promise<void> {
  // Keep-alive loop — actual work happens in services via EventBus.
  // This task just prevents the OS from killing the app.
  await new Promise<void>(() => {
    // Intentionally never resolves while session is active.
    // BackgroundService.stop() will terminate this.
  });
}

export async function startBackgroundSession(): Promise<void> {
  if (BackgroundService.isRunning()) {
    return;
  }

  await BackgroundService.start(backgroundTask, BACKGROUND_TASK_OPTIONS);
}

export async function stopBackgroundSession(): Promise<void> {
  if (!BackgroundService.isRunning()) {
    return;
  }

  await BackgroundService.stop();
}

export async function updateBackgroundNotification(
  heartRate: number,
  trackTitle: string | null,
): Promise<void> {
  if (Platform.OS !== 'android' || !BackgroundService.isRunning()) {
    return;
  }

  await BackgroundService.updateNotification({
    taskTitle: `HR: ${heartRate} bpm`,
    taskDesc: trackTitle ? `Playing: ${trackTitle}` : 'BPMove Active Session',
  });
}
