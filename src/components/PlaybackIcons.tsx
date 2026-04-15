import React from 'react';
import Svg, {Path, Rect} from 'react-native-svg';

interface IconProps {
  size?: number;
  color: string;
}

export function MusicNoteIcon({size = 20, color}: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M14 3v10.55A4 4 0 1 1 12 10V6.2l8-1.78V15.5A4 4 0 1 1 18 12V7.03L14 7.9V3Z"
        fill={color}
      />
    </Svg>
  );
}

export function PlayIcon({size = 18, color}: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M8 5.14v13.72c0 .78.85 1.26 1.52.86l10.23-6.86a1 1 0 0 0 0-1.72L9.52 4.28A1 1 0 0 0 8 5.14Z" fill={color} />
    </Svg>
  );
}

export function PauseIcon({size = 18, color}: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Rect x="6" y="5" width="4" height="14" rx="1" fill={color} />
      <Rect x="14" y="5" width="4" height="14" rx="1" fill={color} />
    </Svg>
  );
}

export function SkipIcon({size = 18, color}: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M5 6.03v11.94c0 .8.9 1.27 1.55.82L15.3 12.8a.95.95 0 0 0 0-1.6L6.55 5.21A.96.96 0 0 0 5 6.03Z" fill={color} />
      <Rect x="17" y="5" width="2.5" height="14" rx="1" fill={color} />
    </Svg>
  );
}
