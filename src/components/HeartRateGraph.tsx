import React, {useMemo} from 'react';
import {View, Text, StyleSheet} from 'react-native';
import Svg, {Polyline, Line, Rect, Text as SvgText} from 'react-native-svg';
import type {HRDataPoint} from '../modules/heartrate/useHRHistory';

interface Props {
  data: HRDataPoint[];
  /** Zone min BPM — draws a horizontal band */
  zoneMin: number;
  /** Zone max BPM — draws a horizontal band */
  zoneMax: number;
  zoneColor: string;
  /** Whether the BLE connection is active */
  connected?: boolean;
  /** Graph width (default: fills container via onLayout) */
  width?: number;
  /** Graph height */
  height?: number;
}

const PADDING_TOP = 16;
const PADDING_BOTTOM = 20;
const PADDING_LEFT = 32;
const PADDING_RIGHT = 8;
const DEFAULT_HEIGHT = 160;

// Fixed Y-axis range for heart rate
const Y_MIN = 40;
const Y_MAX = 200;

export function HeartRateGraph({
  data,
  zoneMin,
  zoneMax,
  zoneColor,
  connected = true,
  height = DEFAULT_HEIGHT,
}: Props) {
  const [layoutWidth, setLayoutWidth] = React.useState(300);

  const chartWidth = layoutWidth - PADDING_LEFT - PADDING_RIGHT;
  const chartHeight = height - PADDING_TOP - PADDING_BOTTOM;

  const toY = React.useCallback((bpm: number) => {
    const ratio = (bpm - Y_MIN) / (Y_MAX - Y_MIN);
    return PADDING_TOP + chartHeight * (1 - ratio);
  }, [chartHeight]);

  const points = useMemo(() => {
    if (data.length === 0) {
      return '';
    }

    const now = Date.now();
    const windowMs = 60_000; // 60-second window

    return data
      .map(p => {
        const age = now - p.timestamp;
        const x =
          PADDING_LEFT + chartWidth * (1 - age / windowMs);
        const y = toY(Math.max(Y_MIN, Math.min(Y_MAX, p.bpm)));
        return `${x},${y}`;
      })
      .join(' ');
  }, [data, chartWidth, toY]);

  // Y-axis tick marks
  const yTicks = [60, 80, 100, 120, 140, 160, 180];

  // Zone band Y coordinates
  const zoneBandTop = toY(Math.min(zoneMax, Y_MAX));
  const zoneBandBottom = toY(Math.max(zoneMin, Y_MIN));
  const zoneBandHeight = zoneBandBottom - zoneBandTop;

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Heart Rate</Text>
      <View
        style={[styles.graphContainer, {height}]}
        onLayout={e => setLayoutWidth(e.nativeEvent.layout.width)}>
        <Svg width={layoutWidth} height={height}>
          {/* Zone band */}
          <Rect
            x={PADDING_LEFT}
            y={zoneBandTop}
            width={chartWidth}
            height={Math.max(0, zoneBandHeight)}
            fill={zoneColor}
            opacity={0.15}
          />

          {/* Horizontal grid lines + labels */}
          {yTicks.map(tick => {
            const y = toY(tick);
            if (y < PADDING_TOP || y > height - PADDING_BOTTOM) {
              return null;
            }
            return (
              <React.Fragment key={tick}>
                <Line
                  x1={PADDING_LEFT}
                  y1={y}
                  x2={PADDING_LEFT + chartWidth}
                  y2={y}
                  stroke="#333"
                  strokeWidth={0.5}
                />
                <SvgText
                  x={PADDING_LEFT - 4}
                  y={y + 4}
                  fill="#666"
                  fontSize={10}
                  textAnchor="end">
                  {tick}
                </SvgText>
              </React.Fragment>
            );
          })}

          {/* Zone boundary lines */}
          <Line
            x1={PADDING_LEFT}
            y1={toY(zoneMin)}
            x2={PADDING_LEFT + chartWidth}
            y2={toY(zoneMin)}
            stroke={zoneColor}
            strokeWidth={1}
            strokeDasharray="4,3"
            opacity={0.6}
          />
          <Line
            x1={PADDING_LEFT}
            y1={toY(zoneMax)}
            x2={PADDING_LEFT + chartWidth}
            y2={toY(zoneMax)}
            stroke={zoneColor}
            strokeWidth={1}
            strokeDasharray="4,3"
            opacity={0.6}
          />

          {/* HR data line */}
          {data.length >= 2 && (
            <Polyline
              points={points}
              fill="none"
              stroke="#fff"
              strokeWidth={2}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          )}

          {/* Current value dot */}
          {data.length > 0 && (() => {
            const last = data[data.length - 1];
            const now = Date.now();
            const age = now - last.timestamp;
            const x = PADDING_LEFT + chartWidth * (1 - age / 60_000);
            const y = toY(Math.max(Y_MIN, Math.min(Y_MAX, last.bpm)));
            return (
              <React.Fragment>
                <Rect
                  x={x - 3}
                  y={y - 3}
                  width={6}
                  height={6}
                  rx={3}
                  fill="#fff"
                />
              </React.Fragment>
            );
          })()}

          {/* Time labels */}
          <SvgText
            x={PADDING_LEFT}
            y={height - 4}
            fill="#666"
            fontSize={10}
            textAnchor="start">
            -60s
          </SvgText>
          <SvgText
            x={PADDING_LEFT + chartWidth / 2}
            y={height - 4}
            fill="#666"
            fontSize={10}
            textAnchor="middle">
            -30s
          </SvgText>
          <SvgText
            x={PADDING_LEFT + chartWidth}
            y={height - 4}
            fill="#666"
            fontSize={10}
            textAnchor="end">
            now
          </SvgText>
        </Svg>

        {/* Empty / disconnected state */}
        {(data.length === 0 || !connected) && (
          <View style={styles.emptyOverlay}>
            <Text style={styles.emptyDashes}>{!connected ? '--' : ''}</Text>
            <Text style={styles.emptyText}>
              {!connected
                ? 'No heart rate detected'
                : 'Waiting for HR data…'}
            </Text>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 4,
  },
  title: {
    fontSize: 12,
    color: '#888',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  graphContainer: {
    backgroundColor: '#222',
    borderRadius: 8,
    overflow: 'hidden',
  },
  emptyOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyDashes: {
    color: '#555',
    fontSize: 32,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  emptyText: {
    color: '#555',
    fontSize: 14,
  },
});
