import { useEffect, useState, useCallback } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../../src/api';
import { Card, H2, H3, Muted } from '../../src/ui';
import { colors, radii, spacing } from '../../src/theme';

type ScheduleItem = { id: string; start_time: string; end_time: string; activity: string; icon?: string };
type SR = { class_name: string | null; date: string; day_of_week: number; items: ScheduleItem[] };

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

export default function TeacherSchedule() {
  const [data, setData] = useState<SR | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try { setData(await api<SR>('/schedule/today')); } catch {}
  }, []);
  useEffect(() => { load(); }, [load]);
  async function onRefresh() { setRefreshing(true); await load(); setRefreshing(false); }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxl }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}>
        <H2>Class Schedule</H2>
        {data ? (
          <Muted style={{ marginBottom: spacing.md }}>
            {DAYS[data.day_of_week]} · {data.date}{data.class_name ? ` · ${data.class_name}` : ''}
          </Muted>
        ) : null}

        {!data || data.items.length === 0 ? (
          <Card style={{ alignItems: 'center' }}>
            <Ionicons name="cafe" size={36} color={colors.golden} />
            <H3 style={{ marginTop: 8 }}>No classes today</H3>
          </Card>
        ) : (
          data.items.map((it, i) => (
            <Card key={it.id} style={{ marginBottom: spacing.sm, padding: spacing.md }} testID={`sched-${it.id}`}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <View style={styles.iconWrap}>
                  <Ionicons name={(it.icon as any) || 'time'} size={20} color={colors.primary} />
                </View>
                <View style={{ flex: 1, marginLeft: spacing.md }}>
                  <Text style={styles.title}>{it.activity}</Text>
                  <Muted style={{ fontSize: 12, marginTop: 2 }}>{it.start_time} – {it.end_time}</Muted>
                </View>
                <Text style={styles.num}>#{i + 1}</Text>
              </View>
            </Card>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  iconWrap: {
    width: 44, height: 44, borderRadius: 22, backgroundColor: colors.background,
    alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.border,
  },
  title: { fontSize: 15, fontWeight: '700', color: colors.text },
  num: { fontSize: 12, fontWeight: '700', color: colors.textMuted },
});
