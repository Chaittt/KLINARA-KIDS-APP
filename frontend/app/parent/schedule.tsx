import { useRouter } from 'expo-router';
import { useEffect, useState, useCallback } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../../src/api';
import { Card, H2, H3, Muted } from '../../src/ui';
import { colors, radii, shadow, spacing } from '../../src/theme';

type ScheduleItem = {
  id: string;
  class_name: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  activity: string;
  icon?: string;
};

type ScheduleResponse = {
  class_name: string | null;
  date: string;
  day_of_week: number;
  items: ScheduleItem[];
};

function nowMinutes() {
  const d = new Date();
  return d.getHours() * 60 + d.getMinutes();
}

function toMinutes(t: string) {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

export default function ParentSchedule() {
  const router = useRouter();
  const [data, setData] = useState<ScheduleResponse | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const d = await api<ScheduleResponse>('/schedule/today');
      setData(d);
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

  const cur = nowMinutes();

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.head}>
        <TouchableOpacity testID="schedule-back" style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <View>
          <H2>Today's Schedule</H2>
          {data ? (
            <Muted>
              {data.date} {data.class_name ? `· ${data.class_name}` : ''}
            </Muted>
          ) : null}
        </View>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxl }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      >
        {!data ? (
          <Card>
            <Muted style={{ textAlign: 'center' }}>Loading…</Muted>
          </Card>
        ) : data.items.length === 0 ? (
          <Card style={{ alignItems: 'center' }}>
            <Ionicons name="cafe" size={42} color={colors.golden} />
            <H3 style={{ marginTop: spacing.sm }}>Day Off!</H3>
            <Muted style={{ textAlign: 'center', marginTop: 4 }}>
              No classes scheduled today. Enjoy your time! 💛
            </Muted>
          </Card>
        ) : (
          data.items.map((it, idx) => {
            const start = toMinutes(it.start_time);
            const end = toMinutes(it.end_time);
            const isLive = cur >= start && cur < end;
            const isPast = cur >= end;
            return (
              <View key={it.id} style={styles.row} testID={`sched-${it.id}`}>
                <View style={styles.timeCol}>
                  <Text style={[styles.startTime, isPast && { color: colors.textMuted }]}>{it.start_time}</Text>
                  <View style={[styles.dot, isLive && styles.dotLive, isPast && styles.dotPast]} />
                  {idx !== data.items.length - 1 ? (
                    <View style={[styles.line, isPast && { backgroundColor: colors.border }]} />
                  ) : null}
                </View>
                <Card
                  style={[
                    styles.activityCard,
                    isLive && { backgroundColor: colors.primary, borderColor: colors.primary },
                    isPast && { opacity: 0.6 },
                  ]}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <View
                      style={[
                        styles.iconCircle,
                        { backgroundColor: isLive ? 'rgba(255,255,255,0.18)' : colors.background },
                      ]}
                    >
                      <Ionicons
                        name={(it.icon as any) || 'time'}
                        size={20}
                        color={isLive ? colors.inverse : colors.primary}
                      />
                    </View>
                    <View style={{ flex: 1, marginLeft: 12 }}>
                      <Text
                        style={[
                          styles.activityTitle,
                          { color: isLive ? colors.inverse : colors.text },
                        ]}
                      >
                        {it.activity}
                      </Text>
                      <Text
                        style={[
                          styles.activityTime,
                          { color: isLive ? 'rgba(255,255,255,0.85)' : colors.textSecondary },
                        ]}
                      >
                        {it.start_time} – {it.end_time}
                      </Text>
                    </View>
                    {isLive ? (
                      <View style={styles.livePill}>
                        <Text style={styles.liveText}>LIVE</Text>
                      </View>
                    ) : null}
                  </View>
                </Card>
              </View>
            );
          })
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
  row: { flexDirection: 'row', alignItems: 'stretch' },
  timeCol: { width: 60, alignItems: 'center', paddingTop: 12 },
  startTime: { fontSize: 12, fontWeight: '700', color: colors.text, marginBottom: 6 },
  dot: { width: 12, height: 12, borderRadius: 6, backgroundColor: colors.golden },
  dotLive: { backgroundColor: colors.primary, width: 16, height: 16, borderRadius: 8, ...shadow.soft },
  dotPast: { backgroundColor: colors.border },
  line: { width: 2, flex: 1, backgroundColor: colors.golden, marginTop: 4 },
  activityCard: { flex: 1, marginBottom: 14, padding: spacing.md },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activityTitle: { fontSize: 15, fontWeight: '700' },
  activityTime: { fontSize: 12, marginTop: 2 },
  livePill: {
    backgroundColor: colors.golden,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radii.pill,
  },
  liveText: { color: colors.inverse, fontSize: 10, fontWeight: '700', letterSpacing: 1 },
});
