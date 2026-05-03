import { useRouter } from 'expo-router';
import { useEffect, useState, useCallback } from 'react';
import {
  Image,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../../src/api';
import { useAuth } from '../../src/auth';
import { Body, Card, H2, H3, Muted } from '../../src/ui';
import { GrowBars } from '../../src/charts';
import { colors, radii, shadow, spacing } from '../../src/theme';

type Student = {
  id: string;
  name: string;
  class_name: string;
  age?: number;
  photo?: string;
  elthea_grow?: { G: number; R: number; O: number; W: number } | null;
  elthea_archetype_name?: string | null;
  elthea_archetype_description?: string | null;
  elthea_last_assessed_at?: string | null;
};

type Activity = {
  id: string;
  description: string;
  photo_base64?: string | null;
  uploader_name?: string;
  created_at: string;
};

type Payment = {
  id: string;
  amount: number;
  status: string;
  description?: string;
};

export default function ParentHome() {
  const router = useRouter();
  const { user, logout } = useAuth();
  const [student, setStudent] = useState<Student | null>(null);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [pendingFees, setPendingFees] = useState<Payment[]>([]);
  const [presentPct, setPresentPct] = useState<number | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const students = await api<Student[]>('/students');
      const s = students[0] || null;
      setStudent(s);
      const feed = await api<Activity[]>('/activities/feed');
      setActivities(feed.slice(0, 3));
      if (s) {
        const att = await api<{ status: string }[]>(`/attendance/student/${s.id}`);
        const total = att.length;
        const present = att.filter((a) => a.status === 'present').length;
        setPresentPct(total ? Math.round((present / total) * 100) : null);
        const pays = await api<Payment[]>(`/payments/student/${s.id}`);
        setPendingFees(pays.filter((p) => p.status === 'pending'));
      }
    } catch (e) {
      // ignore
    }
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
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      >
        <View style={styles.header}>
          <View>
            <Muted>Welcome back</Muted>
            <H2 style={{ marginTop: 2 }}>{user?.name?.split(' ')[0] || 'Parent'} 👋</H2>
          </View>
          <TouchableOpacity testID="logout-btn" onPress={logout} style={styles.iconBtn}>
            <Ionicons name="log-out-outline" size={22} color={colors.text} />
          </TouchableOpacity>
        </View>

        {student ? (
          <Card testID="child-card" style={styles.childCard}>
            <View style={styles.childRow}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>
                  {student.name
                    .split(' ')
                    .map((p) => p[0])
                    .slice(0, 2)
                    .join('')}
                </Text>
              </View>
              <View style={{ flex: 1, marginLeft: spacing.md }}>
                <H3>{student.name}</H3>
                <View style={styles.chipsRow}>
                  <View style={[styles.chip, { backgroundColor: colors.blush }]}>
                    <Text style={styles.chipText}>{student.class_name}</Text>
                  </View>
                  {student.age ? (
                    <View style={[styles.chip, { backgroundColor: colors.beige }]}>
                      <Text style={styles.chipText}>{student.age} yrs</Text>
                    </View>
                  ) : null}
                </View>
              </View>
            </View>
          </Card>
        ) : (
          <Card>
            <Muted>No child linked to your account yet.</Muted>
          </Card>
        )}

        <View style={styles.statsRow}>
          <Card style={styles.statCard}>
            <Ionicons name="checkmark-circle" size={22} color={colors.primary} />
            <Text style={styles.statValue}>{presentPct == null ? '—' : `${presentPct}%`}</Text>
            <Muted style={{ fontSize: 12 }}>Attendance</Muted>
          </Card>
          <TouchableOpacity
            testID="todays-schedule-btn"
            activeOpacity={0.8}
            onPress={() => router.push('/parent/schedule')}
            style={{ flex: 1 }}
          >
            <Card style={[styles.statCard, { backgroundColor: colors.golden, borderColor: colors.golden }]}>
              <Ionicons name="calendar-clear" size={22} color={colors.inverse} />
              <Text style={[styles.statValue, { color: colors.inverse }]}>Today</Text>
              <Text style={{ fontSize: 12, color: 'rgba(255,255,255,0.9)', fontWeight: '600' }}>Schedule →</Text>
            </Card>
          </TouchableOpacity>
        </View>

        {student?.elthea_grow ? (
          <Card style={{ marginTop: spacing.md }} testID="grow-card">
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <H3>Elthea GROW Profile</H3>
              <TouchableOpacity onPress={() => router.push('/parent/profile')}>
                <Text style={styles.link}>View →</Text>
              </TouchableOpacity>
            </View>
            <Muted style={{ marginTop: 4 }}>
              Archetype: <Text style={{ fontWeight: '700', color: colors.primary }}>{student.elthea_archetype_name}</Text>
            </Muted>
            <GrowBars scores={student.elthea_grow} />
          </Card>
        ) : student ? (
          <Card style={{ marginTop: spacing.md, alignItems: 'center' }}>
            <Ionicons name="sparkles" size={28} color={colors.golden} />
            <H3 style={{ marginTop: 8 }}>Elthea Assessment</H3>
            <Muted style={{ textAlign: 'center', marginTop: 6 }}>
              Discover your child's GROW profile
            </Muted>
            <TouchableOpacity
              testID="start-elthea-btn"
              style={[styles.startBtn]}
              onPress={() => router.push({ pathname: '/parent/elthea', params: { student_id: student.id } })}
            >
              <Text style={styles.startBtnText}>Start Assessment</Text>
            </TouchableOpacity>
          </Card>
        ) : null}

        <View style={styles.feedHead}>
          <H3>Recent Activities</H3>
          <TouchableOpacity onPress={() => router.push('/parent/activities')}>
            <Text style={styles.link}>See all →</Text>
          </TouchableOpacity>
        </View>

        {activities.length === 0 ? (
          <Card>
            <Muted style={{ textAlign: 'center' }}>No activities yet</Muted>
          </Card>
        ) : (
          activities.map((a) => (
            <Card key={a.id} style={{ marginBottom: spacing.md }} testID={`activity-${a.id}`}>
              {a.photo_base64 ? (
                <Image source={{ uri: a.photo_base64 }} style={styles.activityImg} />
              ) : null}
              <Body>{a.description}</Body>
              <Muted style={{ fontSize: 12, marginTop: 6 }}>
                {a.uploader_name} · {new Date(a.created_at).toLocaleDateString()}
              </Muted>
            </Card>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  scroll: { padding: spacing.lg, paddingBottom: spacing.xxl },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
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
  childCard: { marginBottom: spacing.md, backgroundColor: colors.primary },
  childRow: { flexDirection: 'row', alignItems: 'center' },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.golden,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: '#ffffff20',
  },
  avatarText: { color: colors.inverse, fontSize: 22, fontWeight: '700' },
  chipsRow: { flexDirection: 'row', gap: 8, marginTop: 8 },
  chip: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  chipText: { fontSize: 12, fontWeight: '600', color: colors.text },
  statsRow: { flexDirection: 'row', gap: spacing.md },
  statCard: { flex: 1, alignItems: 'flex-start', padding: spacing.md, gap: 4 },
  statValue: { fontSize: 22, fontWeight: '700', color: colors.text, marginTop: 4 },
  feedHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.lg,
    marginBottom: spacing.md,
  },
  link: { color: colors.primary, fontWeight: '600' },
  activityImg: {
    width: '100%',
    height: 180,
    borderRadius: radii.lg,
    marginBottom: spacing.sm,
    backgroundColor: colors.border,
  },
  startBtn: {
    marginTop: spacing.md,
    backgroundColor: colors.golden,
    paddingHorizontal: spacing.lg,
    paddingVertical: 12,
    borderRadius: radii.pill,
    ...shadow.soft,
  },
  startBtnText: { color: colors.inverse, fontWeight: '700', fontSize: 14 },
});

// Override H3 — RN style for the parent welcome card to be white
// (we use a separate H3-styled Text inside the dark card)
const _override = StyleSheet.create({
  whiteH3: { color: colors.inverse },
});
