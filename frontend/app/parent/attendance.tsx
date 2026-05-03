import { useEffect, useState, useCallback } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api } from '../../src/api';
import { Card, H2, H3, Muted } from '../../src/ui';
import { colors, radii, spacing } from '../../src/theme';

type Att = { id: string; date: string; status: string; student_id: string };
type Student = { id: string; name: string };

export default function ParentAttendance() {
  const [student, setStudent] = useState<Student | null>(null);
  const [records, setRecords] = useState<Att[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const s = (await api<Student[]>('/students'))[0];
      setStudent(s || null);
      if (s) {
        const att = await api<Att[]>(`/attendance/student/${s.id}`);
        setRecords(att);
      }
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

  const total = records.length;
  const present = records.filter((r) => r.status === 'present').length;
  const absent = records.filter((r) => r.status === 'absent').length;
  const late = records.filter((r) => r.status === 'late').length;
  const pct = total ? Math.round((present / total) * 100) : 0;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView
        contentContainerStyle={{ padding: spacing.lg }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      >
        <H2>Attendance</H2>
        {student ? <Muted style={{ marginBottom: spacing.md }}>{student.name}</Muted> : null}

        <View style={styles.statsRow}>
          <Card style={[styles.stat, { backgroundColor: colors.primary }]}>
            <Text style={[styles.statVal, { color: colors.inverse }]}>{pct}%</Text>
            <Text style={[styles.statLabel, { color: colors.inverse }]}>Overall</Text>
          </Card>
          <Card style={styles.stat}>
            <Text style={[styles.statVal, { color: colors.success }]}>{present}</Text>
            <Text style={styles.statLabel}>Present</Text>
          </Card>
          <Card style={styles.stat}>
            <Text style={[styles.statVal, { color: colors.danger }]}>{absent}</Text>
            <Text style={styles.statLabel}>Absent</Text>
          </Card>
          <Card style={styles.stat}>
            <Text style={[styles.statVal, { color: colors.golden }]}>{late}</Text>
            <Text style={styles.statLabel}>Late</Text>
          </Card>
        </View>

        <H3 style={{ marginTop: spacing.lg, marginBottom: spacing.sm }}>History</H3>
        {records.length === 0 ? (
          <Card>
            <Muted style={{ textAlign: 'center' }}>No attendance records yet.</Muted>
          </Card>
        ) : (
          records.map((r) => (
            <Card key={r.id} style={styles.row} testID={`att-${r.id}`}>
              <View style={{ flex: 1 }}>
                <Text style={styles.dateText}>
                  {new Date(r.date).toLocaleDateString(undefined, {
                    weekday: 'short',
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                  })}
                </Text>
              </View>
              <View
                style={[
                  styles.statusPill,
                  r.status === 'present'
                    ? { backgroundColor: '#e3f1ea' }
                    : r.status === 'absent'
                    ? { backgroundColor: '#fce0e0' }
                    : { backgroundColor: '#fbeacf' },
                ]}
              >
                <Text
                  style={[
                    styles.statusText,
                    {
                      color:
                        r.status === 'present'
                          ? colors.success
                          : r.status === 'absent'
                          ? colors.danger
                          : colors.golden,
                    },
                  ]}
                >
                  {r.status.toUpperCase()}
                </Text>
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
  statsRow: { flexDirection: 'row', gap: 8, marginTop: spacing.md, flexWrap: 'wrap' },
  stat: { flex: 1, minWidth: '22%', padding: spacing.md, alignItems: 'center' },
  statVal: { fontSize: 22, fontWeight: '700' },
  statLabel: { fontSize: 11, color: colors.textSecondary, marginTop: 2 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
    padding: spacing.md,
  },
  dateText: { fontSize: 15, color: colors.text, fontWeight: '500' },
  statusPill: { paddingHorizontal: 12, paddingVertical: 4, borderRadius: 999 },
  statusText: { fontSize: 11, fontWeight: '700', letterSpacing: 0.5 },
});
