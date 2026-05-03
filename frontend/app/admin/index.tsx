import { useEffect, useState, useCallback } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../../src/api';
import { useAuth } from '../../src/auth';
import { Card, H2, H3, Muted } from '../../src/ui';
import { colors, spacing } from '../../src/theme';

type Overview = {
  students: number;
  teachers: number;
  parents: number;
  revenue: number;
  pending_fees: number;
};

type FinancialReport = {
  total_revenue: number;
  pending_amount: number;
  paid_count: number;
  pending_count: number;
  monthly_revenue: { month: string; revenue: number }[];
};

export default function AdminDashboard() {
  const { user, logout } = useAuth();
  const [overview, setOverview] = useState<Overview | null>(null);
  const [fin, setFin] = useState<FinancialReport | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const o = await api<Overview>('/stats/overview');
      setOverview(o);
      const f = await api<FinancialReport>('/reports/financial');
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

  const isMD = user?.role === 'md';

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxl }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      >
        <View style={styles.headerRow}>
          <View style={{ flex: 1 }}>
            <Muted style={{ fontSize: 11, letterSpacing: 1, textTransform: 'uppercase' }}>
              {isMD ? 'Managing Director' : 'Administrator'}
            </Muted>
            <H2 style={{ marginTop: 2 }}>{user?.name}</H2>
          </View>
          <TouchableOpacity testID="logout-btn" onPress={logout} style={styles.iconBtn}>
            <Ionicons name="log-out-outline" size={22} color={colors.text} />
          </TouchableOpacity>
        </View>

        {isMD && fin ? (
          <Card style={[styles.heroCard, { backgroundColor: colors.primary }]} testID="financial-hero">
            <Muted style={{ color: 'rgba(255,255,255,0.7)', fontSize: 11, letterSpacing: 1, textTransform: 'uppercase' }}>
              Total Revenue
            </Muted>
            <Text style={styles.bigNumber}>₹{fin.total_revenue.toLocaleString()}</Text>
            <View style={{ flexDirection: 'row', marginTop: spacing.md, gap: spacing.lg }}>
              <View>
                <Text style={styles.heroSub}>Paid</Text>
                <Text style={styles.heroVal}>{fin.paid_count}</Text>
              </View>
              <View>
                <Text style={styles.heroSub}>Pending</Text>
                <Text style={styles.heroVal}>₹{fin.pending_amount.toLocaleString()}</Text>
              </View>
            </View>
          </Card>
        ) : null}

        {overview ? (
          <View style={styles.grid}>
            <StatCard icon="people" label="Students" value={overview.students} color={colors.primary} testID="stat-students" />
            <StatCard icon="school" label="Teachers" value={overview.teachers} color={colors.golden} testID="stat-teachers" />
            <StatCard icon="heart" label="Parents" value={overview.parents} color={colors.rose} testID="stat-parents" />
            <StatCard
              icon="cash"
              label="Pending"
              value={`₹${overview.pending_fees.toLocaleString()}`}
              color={colors.danger}
              testID="stat-pending"
            />
          </View>
        ) : null}

        {fin && fin.monthly_revenue.length > 0 ? (
          <Card style={{ marginTop: spacing.md }} testID="monthly-revenue">
            <H3>Monthly Revenue</H3>
            <View style={{ marginTop: spacing.md }}>
              {fin.monthly_revenue.map((m) => {
                const max = Math.max(...fin.monthly_revenue.map((x) => x.revenue), 1);
                const w = (m.revenue / max) * 100;
                return (
                  <View key={m.month} style={{ marginBottom: 12 }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                      <Text style={{ fontSize: 13, color: colors.textSecondary }}>{m.month}</Text>
                      <Text style={{ fontSize: 13, fontWeight: '700', color: colors.text }}>
                        ₹{m.revenue.toLocaleString()}
                      </Text>
                    </View>
                    <View style={styles.barTrack}>
                      <View style={[styles.barFill, { width: `${w}%`, backgroundColor: colors.golden }]} />
                    </View>
                  </View>
                );
              })}
            </View>
          </Card>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function StatCard({
  icon,
  label,
  value,
  color,
  testID,
}: {
  icon: any;
  label: string;
  value: number | string;
  color: string;
  testID?: string;
}) {
  return (
    <Card style={{ width: '48%', marginBottom: spacing.md }} testID={testID}>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <View
          style={{
            width: 40,
            height: 40,
            borderRadius: 20,
            backgroundColor: `${color}22`,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Ionicons name={icon} size={20} color={color} />
        </View>
      </View>
      <Text style={{ fontSize: 24, fontWeight: '700', color: colors.text, marginTop: 12 }}>{value}</Text>
      <Text style={{ fontSize: 12, color: colors.textSecondary, marginTop: 2 }}>{label}</Text>
    </Card>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  iconBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  heroCard: { marginBottom: spacing.md },
  bigNumber: { fontFamily: 'Georgia', color: colors.golden, fontSize: 36, fontWeight: '700', marginTop: 4 },
  heroSub: { color: 'rgba(255,255,255,0.6)', fontSize: 11, textTransform: 'uppercase', letterSpacing: 1 },
  heroVal: { color: colors.inverse, fontSize: 18, fontWeight: '700', marginTop: 2 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  barTrack: { height: 10, borderRadius: 999, backgroundColor: colors.border, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 999 },
});
