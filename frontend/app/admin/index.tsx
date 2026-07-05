import { useEffect, useState, useCallback } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { api } from '../../src/api';
import { useAuth } from '../../src/auth';
import { Card, H2, H3, Muted } from '../../src/ui';
import { colors, radii, spacing } from '../../src/theme';

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

type StaffToday = { date: string; present: number; absent: number; unmarked: number; total: number };
type Complaint = { id: string; status: string };
type EventItem = { id: string; title: string; date: string; description: string };
type Announcement = { id: string; title: string; description: string; created_at: string };

export default function AdminDashboard() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const [overview, setOverview] = useState<Overview | null>(null);
  const [fin, setFin] = useState<FinancialReport | null>(null);
  const [staffToday, setStaffToday] = useState<StaffToday | null>(null);
  const [openComplaints, setOpenComplaints] = useState(0);
  const [events, setEvents] = useState<EventItem[]>([]);
  const [ann, setAnn] = useState<Announcement[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const r = await Promise.allSettled([
      api<Overview>('/stats/overview'),
      api<FinancialReport>('/reports/financial'),
      api<StaffToday>('/staff-attendance/today'),
      api<Complaint[]>('/complaints'),
      api<EventItem[]>('/events/this-week'),
      api<Announcement[]>('/announcements'),
    ]);
    if (r[0].status === 'fulfilled') setOverview(r[0].value);
    if (r[1].status === 'fulfilled') setFin(r[1].value);
    if (r[2].status === 'fulfilled') setStaffToday(r[2].value);
    if (r[3].status === 'fulfilled') setOpenComplaints(r[3].value.filter((c) => c.status === 'open').length);
    if (r[4].status === 'fulfilled') setEvents(r[4].value);
    if (r[5].status === 'fulfilled') setAnn(r[5].value.slice(0, 2));
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

        {/* Staff Attendance Today */}
        {staffToday ? (
          <Card style={{ marginBottom: spacing.md, backgroundColor: colors.primary }} testID="staff-hero">
            <Muted style={{ color: 'rgba(255,255,255,0.7)', fontSize: 11, letterSpacing: 1, textTransform: 'uppercase' }}>
              Staff Attendance Today
            </Muted>
            <View style={{ flexDirection: 'row', marginTop: spacing.md, gap: spacing.lg }}>
              <StaffStat label="Present" value={staffToday.present} color={colors.golden} />
              <StaffStat label="Absent" value={staffToday.absent} color="#ff9a8b" />
              <StaffStat label="Unmarked" value={staffToday.unmarked} color="rgba(255,255,255,0.7)" />
              <TouchableOpacity
                testID="manage-staff-attn"
                onPress={() => router.push('/admin/staff-attendance')}
                style={styles.manageBtn}
              >
                <Text style={styles.manageBtnText}>Manage</Text>
                <Ionicons name="chevron-forward" size={14} color={colors.inverse} />
              </TouchableOpacity>
            </View>
          </Card>
        ) : null}

        {overview ? (
          <View style={styles.grid}>
            <StatCard icon="people" label="Students" value={overview.students} color={colors.primary} testID="stat-students" onPress={() => router.push('/admin/students')} />
            <StatCard icon="school" label="Teachers" value={overview.teachers} color={colors.golden} testID="stat-teachers" onPress={() => router.push('/admin/teachers')} />
            <StatCard icon="heart" label="Parents" value={overview.parents} color={colors.rose} testID="stat-parents" />
            <StatCard
              icon="cash"
              label="Pending"
              value={`₹${overview.pending_fees.toLocaleString()}`}
              color={colors.danger}
              testID="stat-pending"
              onPress={() => router.push('/admin/fees')}
            />
          </View>
        ) : null}

        {/* Quick Nav: Open Complaints + Announcements counts */}
        <View style={styles.grid}>
          <StatCard
            icon="chatbubble-ellipses"
            label="Open Complaints"
            value={openComplaints}
            color={colors.danger}
            testID="stat-complaints"
            onPress={() => router.push('/admin/complaints')}
          />
          <StatCard
            icon="megaphone"
            label="Announcements"
            value={ann.length}
            color={colors.golden}
            testID="stat-anns"
            onPress={() => router.push('/admin/announcements')}
          />
        </View>

        {/* Events This Week */}
        <Card style={{ marginTop: spacing.md }} testID="events-card">
          <H3>Events This Week</H3>
          {events.length === 0 ? (
            <Muted style={{ marginTop: 8 }}>No events scheduled</Muted>
          ) : (
            events.map((e) => (
              <View key={e.id} style={styles.evRow}>
                <View style={styles.evDate}>
                  <Text style={styles.evDay}>{new Date(e.date).getDate()}</Text>
                  <Text style={styles.evMonth}>
                    {new Date(e.date).toLocaleDateString(undefined, { month: 'short' })}
                  </Text>
                </View>
                <View style={{ flex: 1, marginLeft: spacing.md }}>
                  <Text style={styles.evTitle}>{e.title}</Text>
                  <Muted style={{ fontSize: 12, marginTop: 2 }}>{e.description}</Muted>
                </View>
              </View>
            ))
          )}
        </Card>

        {/* Recent Announcements */}
        <Card style={{ marginTop: spacing.md }} testID="recent-announcements">
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <H3>Recent Announcements</H3>
            <TouchableOpacity onPress={() => router.push('/admin/announcements')}>
              <Text style={{ color: colors.primary, fontWeight: '700', fontSize: 12 }}>View all</Text>
            </TouchableOpacity>
          </View>
          {ann.length === 0 ? (
            <Muted style={{ marginTop: 8 }}>No announcements yet</Muted>
          ) : (
            ann.map((a) => (
              <View key={a.id} style={{ marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: colors.border }}>
                <Text style={{ fontWeight: '700', color: colors.text }}>{a.title}</Text>
                <Muted style={{ fontSize: 12, marginTop: 2 }}>{a.description}</Muted>
              </View>
            ))
          )}
        </Card>

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

function StaffStat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <View>
      <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 11, textTransform: 'uppercase', letterSpacing: 1 }}>{label}</Text>
      <Text style={{ color, fontSize: 24, fontWeight: '700', marginTop: 2 }}>{value}</Text>
    </View>
  );
}

function StatCard({
  icon,
  label,
  value,
  color,
  testID,
  onPress,
}: {
  icon: any;
  label: string;
  value: number | string;
  color: string;
  testID?: string;
  onPress?: () => void;
}) {
  const Body = (
    <>
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
    </>
  );
  if (onPress) {
    return (
      <TouchableOpacity activeOpacity={0.8} onPress={onPress} testID={testID} style={{ width: '48%', marginBottom: spacing.md }}>
        <Card style={{ marginBottom: 0 }}>{Body}</Card>
      </TouchableOpacity>
    );
  }
  return (
    <Card style={{ width: '48%', marginBottom: spacing.md }} testID={testID}>
      {Body}
    </Card>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  headerRow: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.lg },
  iconBtn: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: colors.border,
  },
  heroCard: { marginBottom: spacing.md },
  bigNumber: { fontFamily: 'Georgia', color: colors.golden, fontSize: 36, fontWeight: '700', marginTop: 4 },
  heroSub: { color: 'rgba(255,255,255,0.6)', fontSize: 11, textTransform: 'uppercase', letterSpacing: 1 },
  heroVal: { color: colors.inverse, fontSize: 18, fontWeight: '700', marginTop: 2 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  barTrack: { height: 10, borderRadius: 999, backgroundColor: colors.border, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 999 },
  evRow: { flexDirection: 'row', alignItems: 'center', marginTop: 12 },
  evDate: {
    width: 44, height: 52, borderRadius: 10, backgroundColor: colors.background,
    alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.border,
  },
  evDay: { fontSize: 18, fontWeight: '700', color: colors.primary },
  evMonth: { fontSize: 10, color: colors.textSecondary, textTransform: 'uppercase', fontWeight: '700' },
  evTitle: { fontSize: 15, fontWeight: '700', color: colors.text },
  manageBtn: {
    marginLeft: 'auto', flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: 'rgba(255,255,255,0.18)', paddingHorizontal: 10, paddingVertical: 6,
    borderRadius: radii.pill,
  },
  manageBtnText: { color: colors.inverse, fontWeight: '700', fontSize: 12 },
});
