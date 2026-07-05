import { useEffect, useState, useCallback } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api } from '../../src/api';
import { Card, H2, Muted } from '../../src/ui';
import { colors, radii, spacing } from '../../src/theme';

type Staff = {
  id: string;
  name: string;
  email: string;
  role: string;
  class_name?: string;
  status?: string | null;
};

const TODAY = new Date().toISOString().slice(0, 10);

export default function PrincipalStaff() {
  const [data, setData] = useState<{ present: number; absent: number; unmarked: number; total: number; staff: Staff[] } | null>(null);
  const [saving, setSaving] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const r = await api<any>('/staff-attendance/today');
      setData(r);
    } catch {}
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  async function mark(s: Staff, status: 'present' | 'absent') {
    setSaving(s.id);
    try {
      await api('/staff-attendance', { method: 'POST', body: { user_id: s.id, date: TODAY, status } });
      await load();
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed');
    } finally {
      setSaving(null);
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxl }}>
        <H2>Staff Attendance</H2>
        <Muted style={{ marginBottom: spacing.md }}>
          {new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })}
        </Muted>

        {data ? (
          <View style={styles.summary}>
            <Card style={[styles.sumCard, { backgroundColor: '#e3f1ea' }]}>
              <Text style={styles.sumLabel}>Present</Text>
              <Text style={[styles.sumVal, { color: colors.success }]}>{data.present}</Text>
            </Card>
            <Card style={[styles.sumCard, { backgroundColor: '#fce0e0' }]}>
              <Text style={styles.sumLabel}>Absent</Text>
              <Text style={[styles.sumVal, { color: colors.danger }]}>{data.absent}</Text>
            </Card>
            <Card style={[styles.sumCard, { backgroundColor: colors.background }]}>
              <Text style={styles.sumLabel}>Total</Text>
              <Text style={[styles.sumVal, { color: colors.primary }]}>{data.total}</Text>
            </Card>
          </View>
        ) : null}

        {data?.staff.map((s) => (
          <Card key={s.id} style={{ marginBottom: spacing.sm }} testID={`staff-${s.id}`}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>{s.name}</Text>
                <Muted style={{ fontSize: 12 }}>
                  {s.role.toUpperCase()} {s.class_name ? `· ${s.class_name}` : ''}
                </Muted>
              </View>
            </View>
            <View style={styles.btnRow}>
              {(['present', 'absent'] as const).map((st) => {
                const active = s.status === st;
                const bg = st === 'present' ? colors.success : colors.danger;
                return (
                  <TouchableOpacity
                    key={st}
                    testID={`staff-${s.id}-${st}`}
                    disabled={saving === s.id}
                    onPress={() => mark(s, st)}
                    style={[styles.statusBtn, active && { backgroundColor: bg, borderColor: bg }]}
                  >
                    <Text style={[styles.statusText, active && { color: colors.inverse }]}>
                      {st === 'present' ? 'Present' : 'Absent'}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </Card>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  summary: { flexDirection: 'row', gap: 8, marginBottom: spacing.md },
  sumCard: { flex: 1, padding: spacing.md, alignItems: 'center', borderWidth: 0 },
  sumLabel: { fontSize: 11, color: colors.textSecondary, marginBottom: 4 },
  sumVal: { fontSize: 22, fontWeight: '700' },
  name: { fontSize: 15, fontWeight: '700', color: colors.text },
  btnRow: { flexDirection: 'row', gap: 8, marginTop: 12 },
  statusBtn: {
    flex: 1, paddingVertical: 10, borderRadius: radii.pill, borderWidth: 1.5,
    borderColor: colors.border, alignItems: 'center', backgroundColor: colors.background,
  },
  statusText: { fontSize: 13, fontWeight: '700', color: colors.textSecondary },
});
