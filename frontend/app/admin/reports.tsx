import { useEffect, useState, useCallback } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../../src/api';
import { Card, H2, H3, Muted } from '../../src/ui';
import { colors, spacing } from '../../src/theme';

type AttRep = {
  total_students: number;
  present_today: number;
  absent_today: number;
  late_today: number;
  unmarked: number;
};

type FinRep = {
  total_revenue: number;
  pending_amount: number;
  paid_count: number;
  pending_count: number;
};

type Heatmap = {
  dates: string[];
  rows: { class_name: string; student_count: number; cells: { date: string; pct: number | null; present: number; total: number }[] }[];
};

function pctColor(pct: number | null): string {
  if (pct == null) return colors.border;
  if (pct >= 90) return '#2f6b6b';
  if (pct >= 75) return '#5a9090';
  if (pct >= 50) return '#d4a574';
  if (pct >= 25) return '#c49898';
  return '#b85c5c';
}

export default function AdminReports() {
  const [att, setAtt] = useState<AttRep | null>(null);
  const [fin, setFin] = useState<FinRep | null>(null);
  const [heatmap, setHeatmap] = useState<Heatmap | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const results = await Promise.allSettled([
      api<AttRep>('/reports/attendance'),
      api<FinRep>('/reports/financial'),
      api<Heatmap>('/reports/heatmap?days=14'),
    ]);
    if (results[0].status === 'fulfilled') setAtt(results[0].value);
    if (results[1].status === 'fulfilled') setFin(results[1].value);
    if (results[2].status === 'fulfilled') setHeatmap(results[2].value);
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  async function onRefresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxl }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      >
        <H2>Reports</H2>
        <Muted style={{ marginBottom: spacing.md }}>Snapshot of school operations</Muted>

        {att ? (
          <Card style={{ marginBottom: spacing.md }} testID="attendance-report">
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Ionicons name="calendar" size={22} color={colors.primary} />
              <H3>Today's Attendance</H3>
            </View>
            <View style={styles.grid}>
              <Stat label="Total" value={att.total_students} color={colors.primary} />
              <Stat label="Present" value={att.present_today} color={colors.success} />
              <Stat label="Absent" value={att.absent_today} color={colors.danger} />
              <Stat label="Late" value={att.late_today} color={colors.golden} />
              <Stat label="Unmarked" value={att.unmarked} color={colors.textSecondary} />
            </View>
          </Card>
        ) : null}

        {fin ? (
          <Card testID="financial-report">
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Ionicons name="cash" size={22} color={colors.golden} />
              <H3>Financials</H3>
            </View>
            <View style={styles.grid}>
              <Stat label="Revenue" value={`₹${fin.total_revenue.toLocaleString()}`} color={colors.success} wide />
              <Stat label="Pending" value={`₹${fin.pending_amount.toLocaleString()}`} color={colors.danger} wide />
              <Stat label="Paid" value={fin.paid_count} color={colors.primary} />
              <Stat label="Due" value={fin.pending_count} color={colors.golden} />
            </View>
          </Card>
        ) : null}
        {heatmap && heatmap.rows.length > 0 ? (
          <Card style={{ marginTop: spacing.md }} testID="attendance-heatmap">
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Ionicons name="grid" size={22} color={colors.primary} />
              <H3>Class Attendance — Last 14 Days</H3>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: spacing.md }}>
              <View>
                {/* Date headers */}
                <View style={styles.heatRow}>
                  <View style={styles.heatLabel} />
                  {heatmap.dates.map((d) => (
                    <View key={d} style={styles.heatCellHeader}>
                      <Text style={styles.heatHeaderText}>
                        {new Date(d).getDate()}
                      </Text>
                    </View>
                  ))}
                </View>
                {/* Rows */}
                {heatmap.rows.map((r) => (
                  <View key={r.class_name} style={styles.heatRow} testID={`heat-${r.class_name}`}>
                    <View style={styles.heatLabel}>
                      <Text style={styles.heatLabelText} numberOfLines={1}>
                        {r.class_name}
                      </Text>
                      <Text style={styles.heatLabelMeta}>{r.student_count}</Text>
                    </View>
                    {r.cells.map((c) => (
                      <View
                        key={c.date}
                        style={[styles.heatCell, { backgroundColor: pctColor(c.pct) }]}
                      >
                        {c.pct != null ? (
                          <Text style={styles.heatCellText}>{c.pct}</Text>
                        ) : null}
                      </View>
                    ))}
                  </View>
                ))}
              </View>
            </ScrollView>
            {/* Legend */}
            <View style={styles.legend}>
              {[
                { label: '<25%', c: '#b85c5c' },
                { label: '25-49', c: '#c49898' },
                { label: '50-74', c: '#d4a574' },
                { label: '75-89', c: '#5a9090' },
                { label: '90+', c: '#2f6b6b' },
              ].map((l) => (
                <View key={l.label} style={styles.legendItem}>
                  <View style={[styles.legendSwatch, { backgroundColor: l.c }]} />
                  <Text style={styles.legendText}>{l.label}</Text>
                </View>
              ))}
            </View>
          </Card>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function Stat({
  label,
  value,
  color,
  wide,
}: {
  label: string;
  value: number | string;
  color: string;
  wide?: boolean;
}) {
  return (
    <View style={[styles.statBox, { width: wide ? '48%' : '31%' }]}>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', marginTop: spacing.md, gap: 8 },
  statBox: {
    backgroundColor: colors.background,
    padding: spacing.md,
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  statValue: { fontSize: 20, fontWeight: '700' },
  statLabel: { fontSize: 11, color: colors.textSecondary, marginTop: 2 },
  heatRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  heatLabel: { width: 90, paddingRight: 8 },
  heatLabelText: { fontSize: 12, fontWeight: '700', color: colors.text },
  heatLabelMeta: { fontSize: 10, color: colors.textMuted, marginTop: 1 },
  heatCellHeader: {
    width: 26,
    height: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 3,
  },
  heatHeaderText: { fontSize: 10, color: colors.textSecondary, fontWeight: '600' },
  heatCell: {
    width: 26,
    height: 26,
    borderRadius: 5,
    marginRight: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heatCellText: { fontSize: 9, color: colors.inverse, fontWeight: '700' },
  legend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: spacing.md,
    justifyContent: 'center',
  },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  legendSwatch: { width: 12, height: 12, borderRadius: 3 },
  legendText: { fontSize: 11, color: colors.textSecondary },
});
