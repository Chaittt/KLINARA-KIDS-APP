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

export default function AdminReports() {
  const [att, setAtt] = useState<AttRep | null>(null);
  const [fin, setFin] = useState<FinRep | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const [a, f] = await Promise.all([
        api<AttRep>('/reports/attendance'),
        api<FinRep>('/reports/financial'),
      ]);
      setAtt(a);
      setFin(f);
    } catch {}
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
});
