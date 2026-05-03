import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, G, Line, Polygon, Text as SvgText } from 'react-native-svg';
import { colors, spacing } from './theme';

type GrowScores = { G: number; R: number; O: number; W: number };

export function GrowRadarChart({ scores, size = 240 }: { scores: GrowScores; size?: number }) {
  const cx = size / 2;
  const cy = size / 2;
  const radius = size / 2 - 30;

  const labels: { key: keyof GrowScores; label: string; color: string }[] = [
    { key: 'G', label: 'Grow', color: colors.golden },
    { key: 'R', label: 'Relate', color: colors.rose },
    { key: 'O', label: 'Observe', color: colors.primary },
    { key: 'W', label: 'Wonder', color: colors.blush },
  ];

  // 4 axes at 0°, 90°, 180°, 270° (top, right, bottom, left)
  const angles = [-90, 0, 90, 180]; // degrees
  const toXY = (angleDeg: number, r: number) => {
    const a = (angleDeg * Math.PI) / 180;
    return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) };
  };

  // Grid rings
  const rings = [0.25, 0.5, 0.75, 1.0];

  // Data polygon
  const dataPoints = labels.map((l, i) => {
    const v = Math.max(0, Math.min(100, scores[l.key] ?? 0));
    const r = (v / 100) * radius;
    const p = toXY(angles[i], r);
    return `${p.x},${p.y}`;
  });

  return (
    <View style={{ alignItems: 'center' }}>
      <Svg width={size} height={size}>
        {/* Grid rings */}
        {rings.map((r, i) => {
          const pts = angles.map((a) => {
            const p = toXY(a, radius * r);
            return `${p.x},${p.y}`;
          });
          return (
            <Polygon
              key={`ring-${i}`}
              points={pts.join(' ')}
              stroke={colors.border}
              strokeWidth={1}
              fill="none"
            />
          );
        })}
        {/* Axes */}
        {angles.map((a, i) => {
          const p = toXY(a, radius);
          return (
            <Line
              key={`axis-${i}`}
              x1={cx}
              y1={cy}
              x2={p.x}
              y2={p.y}
              stroke={colors.border}
              strokeWidth={1}
            />
          );
        })}
        {/* Data polygon */}
        <Polygon
          points={dataPoints.join(' ')}
          fill={colors.primary}
          fillOpacity={0.25}
          stroke={colors.primary}
          strokeWidth={2}
        />
        {/* Data points */}
        {labels.map((l, i) => {
          const v = Math.max(0, Math.min(100, scores[l.key] ?? 0));
          const r = (v / 100) * radius;
          const p = toXY(angles[i], r);
          return (
            <G key={`pt-${i}`}>
              <Circle cx={p.x} cy={p.y} r={5} fill={l.color} />
            </G>
          );
        })}
        {/* Labels */}
        {labels.map((l, i) => {
          const p = toXY(angles[i], radius + 16);
          return (
            <SvgText
              key={`lbl-${i}`}
              x={p.x}
              y={p.y + 4}
              fill={colors.text}
              fontSize={12}
              fontWeight="700"
              textAnchor="middle"
            >
              {l.label}
            </SvgText>
          );
        })}
      </Svg>
      <View style={styles.legend}>
        {labels.map((l) => (
          <View key={l.key} style={styles.legendItem}>
            <View style={[styles.dot, { backgroundColor: l.color }]} />
            <Text style={styles.legendText}>
              {l.label}: <Text style={{ fontWeight: '700' }}>{scores[l.key]}</Text>
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

export function GrowBars({ scores }: { scores: GrowScores }) {
  const items: { key: keyof GrowScores; label: string; color: string }[] = [
    { key: 'G', label: 'Grow', color: colors.golden },
    { key: 'R', label: 'Relate', color: colors.rose },
    { key: 'O', label: 'Observe', color: colors.primary },
    { key: 'W', label: 'Wonder', color: colors.blush },
  ];
  return (
    <View style={{ marginTop: spacing.md }}>
      {items.map((it) => {
        const v = Math.max(0, Math.min(100, scores[it.key] ?? 0));
        return (
          <View key={it.key} style={{ marginBottom: 12 }}>
            <View style={styles.barRow}>
              <Text style={styles.barLabel}>{it.label}</Text>
              <Text style={styles.barValue}>{v}</Text>
            </View>
            <View style={styles.barTrack}>
              <View style={[styles.barFill, { width: `${v}%`, backgroundColor: it.color }]} />
            </View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  legend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    marginTop: spacing.md,
    gap: 12,
  },
  legendItem: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 6 },
  dot: { width: 10, height: 10, borderRadius: 5, marginRight: 6 },
  legendText: { fontSize: 13, color: colors.textSecondary },
  barRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  barLabel: { fontSize: 14, fontWeight: '600', color: colors.text },
  barValue: { fontSize: 14, fontWeight: '700', color: colors.textSecondary },
  barTrack: {
    height: 12,
    borderRadius: 999,
    backgroundColor: colors.border,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: 999,
  },
});
