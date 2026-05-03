import { useLocalSearchParams, useRouter } from 'expo-router';
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
import { Card, H2, H3, Muted } from '../../src/ui';
import { GrowRadarChart } from '../../src/charts';
import { colors, radii, spacing } from '../../src/theme';

type Student = {
  id: string;
  name: string;
  class_name: string;
  parent_phone: string;
  age?: number;
  photo?: string;
  elthea_grow?: { G: number; R: number; O: number; W: number } | null;
  elthea_archetype_name?: string | null;
  elthea_archetype_description?: string | null;
  elthea_last_assessed_at?: string | null;
  created_at?: string;
};

type Activity = {
  id: string;
  description: string;
  photo_base64?: string | null;
  uploader_name?: string;
  created_at: string;
};

type Att = { id: string; date: string; status: string };

type TimelineItem =
  | { kind: 'activity'; date: string; data: Activity }
  | { kind: 'attendance'; date: string; data: Att }
  | { kind: 'milestone'; date: string; title: string; subtitle: string; icon: string };

const STATUS_META: Record<string, { color: string; label: string; icon: any }> = {
  present: { color: colors.success, label: 'Present', icon: 'checkmark-circle' },
  absent: { color: colors.danger, label: 'Absent', icon: 'close-circle' },
  late: { color: colors.golden, label: 'Late', icon: 'time' },
};

export default function StudentDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [student, setStudent] = useState<Student | null>(null);
  const [timeline, setTimeline] = useState<TimelineItem[]>([]);
  const [stats, setStats] = useState<{ pct: number; present: number; absent: number; late: number; total: number } | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    try {
      const s = await api<Student>(`/students/${id}`);
      setStudent(s);
      const [acts, atts] = await Promise.all([
        api<Activity[]>(`/activities/student/${id}`),
        api<Att[]>(`/attendance/student/${id}`),
      ]);
      // Stats
      const total = atts.length;
      const present = atts.filter((a) => a.status === 'present').length;
      const absent = atts.filter((a) => a.status === 'absent').length;
      const late = atts.filter((a) => a.status === 'late').length;
      setStats({ pct: total ? Math.round((present / total) * 100) : 0, present, absent, late, total });
      // Build timeline (activities + Elthea milestone + enrollment milestone)
      const items: TimelineItem[] = [];
      acts.forEach((a) => items.push({ kind: 'activity', date: a.created_at, data: a }));
      atts
        .filter((a) => a.status !== 'present')
        .slice(0, 10)
        .forEach((a) => items.push({ kind: 'attendance', date: a.date + 'T09:00:00Z', data: a }));
      if (s.elthea_last_assessed_at && s.elthea_archetype_name) {
        items.push({
          kind: 'milestone',
          date: s.elthea_last_assessed_at,
          title: `Elthea Assessment: ${s.elthea_archetype_name}`,
          subtitle: 'Developmental archetype identified',
          icon: 'sparkles',
        });
      }
      if (s.created_at) {
        items.push({
          kind: 'milestone',
          date: s.created_at,
          title: 'Joined Klinara Kids',
          subtitle: `Enrolled in ${s.class_name}`,
          icon: 'school',
        });
      }
      items.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      setTimeline(items);
    } catch {}
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  async function onRefresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  if (!student) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.head}>
          <TouchableOpacity testID="detail-back" style={styles.backBtn} onPress={() => router.back()}>
            <Ionicons name="chevron-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <H2>Student</H2>
          <View style={{ width: 44 }} />
        </View>
        <View style={{ padding: spacing.lg }}>
          <Card>
            <Muted style={{ textAlign: 'center' }}>Loading…</Muted>
          </Card>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.head}>
        <TouchableOpacity testID="detail-back" style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <H2>Profile</H2>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxl }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      >
        {/* Hero */}
        <Card style={[styles.hero, { backgroundColor: colors.primary }]} testID="student-hero">
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
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
              <Text style={styles.name}>{student.name}</Text>
              <View style={{ flexDirection: 'row', gap: 8, marginTop: 6 }}>
                <View style={styles.chip}>
                  <Text style={styles.chipText}>{student.class_name}</Text>
                </View>
                {student.age ? (
                  <View style={styles.chip}>
                    <Text style={styles.chipText}>{student.age} yrs</Text>
                  </View>
                ) : null}
              </View>
              <Text style={styles.metaLine}>+91 {student.parent_phone}</Text>
            </View>
          </View>
        </Card>

        {/* Quick stats */}
        {stats ? (
          <View style={styles.statsRow}>
            <Card style={styles.statCard}>
              <Text style={[styles.statValue, { color: colors.primary }]}>{stats.pct}%</Text>
              <Muted style={{ fontSize: 11 }}>Attendance</Muted>
            </Card>
            <Card style={styles.statCard}>
              <Text style={[styles.statValue, { color: colors.success }]}>{stats.present}</Text>
              <Muted style={{ fontSize: 11 }}>Present</Muted>
            </Card>
            <Card style={styles.statCard}>
              <Text style={[styles.statValue, { color: colors.danger }]}>{stats.absent}</Text>
              <Muted style={{ fontSize: 11 }}>Absent</Muted>
            </Card>
            <Card style={styles.statCard}>
              <Text style={[styles.statValue, { color: colors.golden }]}>{stats.late}</Text>
              <Muted style={{ fontSize: 11 }}>Late</Muted>
            </Card>
          </View>
        ) : null}

        {/* GROW */}
        {student.elthea_grow ? (
          <Card style={{ marginTop: spacing.md }} testID="grow-section">
            <H3>GROW Profile</H3>
            <Muted style={{ marginTop: 4 }}>
              Last assessed{' '}
              {student.elthea_last_assessed_at
                ? new Date(student.elthea_last_assessed_at).toLocaleDateString()
                : '—'}
            </Muted>
            <View style={{ alignItems: 'center', marginTop: spacing.md }}>
              <GrowRadarChart scores={student.elthea_grow} size={240} />
            </View>
            {student.elthea_archetype_name ? (
              <View style={styles.archetypeBox}>
                <Text style={styles.archetypeLabel}>ARCHETYPE</Text>
                <Text style={styles.archetypeName}>{student.elthea_archetype_name}</Text>
                <Text style={styles.archetypeDesc}>{student.elthea_archetype_description}</Text>
              </View>
            ) : null}
          </Card>
        ) : null}

        {/* Progress timeline */}
        <H3 style={{ marginTop: spacing.lg, marginBottom: spacing.md }}>Progress Timeline</H3>
        {timeline.length === 0 ? (
          <Card>
            <Muted style={{ textAlign: 'center' }}>No history yet</Muted>
          </Card>
        ) : (
          timeline.map((it, idx) => (
            <View key={`${it.kind}-${idx}`} style={styles.timelineRow} testID={`tl-${idx}`}>
              <View style={styles.tlGutter}>
                <View
                  style={[
                    styles.tlDot,
                    {
                      backgroundColor:
                        it.kind === 'milestone'
                          ? colors.golden
                          : it.kind === 'attendance'
                          ? STATUS_META[(it.data as Att).status]?.color || colors.primary
                          : colors.primary,
                    },
                  ]}
                >
                  <Ionicons
                    name={
                      it.kind === 'milestone'
                        ? (it.icon as any)
                        : it.kind === 'attendance'
                        ? (STATUS_META[(it.data as Att).status]?.icon as any) || 'calendar'
                        : 'image'
                    }
                    size={14}
                    color={colors.inverse}
                  />
                </View>
                {idx !== timeline.length - 1 ? <View style={styles.tlLine} /> : null}
              </View>
              <View style={{ flex: 1, marginLeft: 12, marginBottom: spacing.md }}>
                <Text style={styles.tlDate}>
                  {new Date(it.date).toLocaleDateString(undefined, {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                  })}
                </Text>
                {it.kind === 'activity' ? (
                  <Card style={{ marginTop: 6, padding: spacing.md }}>
                    {(it.data as Activity).photo_base64 ? (
                      <Image
                        source={{ uri: (it.data as Activity).photo_base64! }}
                        style={styles.actImg}
                      />
                    ) : null}
                    <Text style={styles.tlText}>{(it.data as Activity).description}</Text>
                    <Muted style={{ fontSize: 11, marginTop: 4 }}>
                      by {(it.data as Activity).uploader_name}
                    </Muted>
                  </Card>
                ) : it.kind === 'attendance' ? (
                  <Card style={{ marginTop: 6, padding: spacing.md }}>
                    <Text style={styles.tlText}>
                      Marked{' '}
                      <Text style={{ fontWeight: '700', color: STATUS_META[(it.data as Att).status]?.color }}>
                        {STATUS_META[(it.data as Att).status]?.label || (it.data as Att).status}
                      </Text>
                    </Text>
                  </Card>
                ) : (
                  <Card style={{ marginTop: 6, padding: spacing.md, backgroundColor: '#fef8ec', borderColor: colors.golden }}>
                    <Text style={[styles.tlText, { fontWeight: '700' }]}>{(it as any).title}</Text>
                    <Muted style={{ fontSize: 12, marginTop: 2 }}>{(it as any).subtitle}</Muted>
                  </Card>
                )}
              </View>
            </View>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  backBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  hero: { marginBottom: spacing.md },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.golden,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.18)',
  },
  avatarText: { color: colors.inverse, fontSize: 24, fontWeight: '700' },
  name: { color: colors.inverse, fontFamily: 'Georgia', fontSize: 22, fontWeight: '700' },
  chip: { backgroundColor: 'rgba(255,255,255,0.18)', paddingHorizontal: 10, paddingVertical: 3, borderRadius: 999 },
  chipText: { color: colors.inverse, fontSize: 12, fontWeight: '600' },
  metaLine: { color: 'rgba(255,255,255,0.7)', marginTop: 8, fontSize: 12 },
  statsRow: { flexDirection: 'row', gap: 8 },
  statCard: { flex: 1, alignItems: 'center', padding: spacing.md },
  statValue: { fontSize: 20, fontWeight: '700' },
  archetypeBox: {
    marginTop: spacing.md,
    padding: spacing.md,
    backgroundColor: colors.background,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  archetypeLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textSecondary,
    letterSpacing: 1,
  },
  archetypeName: {
    fontFamily: 'Georgia',
    fontSize: 20,
    fontWeight: '700',
    color: colors.primary,
    marginTop: 2,
  },
  archetypeDesc: { color: colors.text, fontSize: 13, marginTop: 6, lineHeight: 18 },
  timelineRow: { flexDirection: 'row' },
  tlGutter: { width: 28, alignItems: 'center' },
  tlDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  tlLine: { width: 2, flex: 1, backgroundColor: colors.border, marginTop: 4, marginBottom: -4 },
  tlDate: { fontSize: 11, color: colors.textMuted, fontWeight: '600', marginTop: 6, letterSpacing: 0.5 },
  tlText: { fontSize: 14, color: colors.text, lineHeight: 20 },
  actImg: { width: '100%', height: 160, borderRadius: radii.md, marginBottom: 8, backgroundColor: colors.border },
});
