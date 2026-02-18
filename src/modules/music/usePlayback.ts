import {useState, useEffect, useCallback} from 'react';
import {eventBus} from '../../core/EventBus';
import {ServiceRegistry} from '../../core/ServiceRegistry';
import type {TrackMetadata, PlaybackState as PlaybackStateType} from './types';
import type {MusicPlayerService} from './MusicPlayerService';

export function usePlayback() {
  const [currentTrack, setCurrentTrack] = useState<TrackMetadata | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(0);
  const [targetBPM, setTargetBPM] = useState<number | null>(null);

  useEffect(() => {
    const unsubs = [
      eventBus.on('music:changed', (track: TrackMetadata) => {
        setCurrentTrack(track);
      }),
      eventBus.on(
        'music:playbackStateChanged',
        (state: PlaybackStateType) => {
          setIsPlaying(state.isPlaying);
          setPosition(state.positionSeconds);
          setDuration(state.durationSeconds);
          setTargetBPM(state.targetBPM);
          if (state.currentTrack) {
            setCurrentTrack(state.currentTrack);
          }
        },
      ),
    ];

    return () => unsubs.forEach(unsub => unsub());
  }, []);

  const play = useCallback(async () => {
    const service = ServiceRegistry.get<MusicPlayerService>('music');
    await service.play();
  }, []);

  const pause = useCallback(async () => {
    const service = ServiceRegistry.get<MusicPlayerService>('music');
    await service.pause();
  }, []);

  const skip = useCallback(async () => {
    const service = ServiceRegistry.get<MusicPlayerService>('music');
    await service.skip();
  }, []);

  return {
    currentTrack,
    isPlaying,
    position,
    duration,
    targetBPM,
    play,
    pause,
    skip,
  };
}
