import { useEffect, useState, useCallback } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../../src/api';
import { Card, H2, Muted } from '../../src/ui';
import { colors, radii, spacing } from '../../src/theme';

type Student = { id: string; name: string; class_name: string };
type Att = { id: string; student_id: string; date: string; status: string };

const TODAY = new Date().toISOString().slice(0, 10);
const STATUSES: Array<'present' | 'absent' | 'late'> = ['present', 'absent', 'late'];

export default function TeacherAttendance() {
  const [students, setStudents] = useState<Student[]>([]);
  const [att, setAtt] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const s = await api<Student[]>('/students');
      setStudents(s);
      // Load today's attendance for each
      const map: Record<string, string> = {};
      await Promise.all(
        s.map(async (st) => {
          try {
            const recs = await api<Att[]>(`/attendance/student/${st.id}`);
            const today = recs.find((r) => r.date === TODAY);
            if (today) map[st.id] = today.status;
          } catch {}
        })
      );
      setAtt(map);
    } catch {}
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function mark(student: Student, status: string) {
    setSaving(student.id);
    try {
      await api('/attendance', {
        method: 'POST',
        body: { student_id: student.id, date: TODAY, status },
      });
      setAtt((prev) => ({ ...prev, [student.id]: status }));
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed');
    } finally {
      setSaving(null);
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxl }}>
        <H2>Mark Attendance</H2>
        <Muted style={{ marginBottom: spacing.md }}>
          {new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })}
        </Muted>

        {students.map((s) => (
          <Card key={s.id} style={{ marginBottom: spacing.sm }} testID={`mark-${s.id}`}>
            <Text style={styles.name}>{s.name}</Text>
            <View style={styles.btnRow}>
              {STATUSES.map((st) => {
                const active = att[s.id] === st;
                const bg =
                  st === 'present' ? colors.success : st === 'absent' ? colors.danger : colors.golden;
                return (
                  <TouchableOpacity
                    key={st}
                    testID={`status-${s.id}-${st}`}
                    onPress={() => mark(s, st)}
                    disabled={saving === s.id}
                    style={[
                      styles.statusBtn,
                      active && { backgroundColor: bg, borderColor: bg },
                    ]}
                  >
                    <Text
                      style={[
                        styles.statusBtnText,
                        active && { color: colors.inverse },
                      ]}
                    >
                      {st === 'present' ? 'Present' : st === 'absent' ? 'Absent' : 'Late'}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </Card>
        ))}
        {students.length === 0 ? (
          <Card>
            <Muted style={{ textAlign: 'center' }}>No students assigned to your class</Muted>
          </Card>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  name: { fontSize: 16, fontWeight: '600', color: colors.text, marginBottom: 10 },
  btnRow: { flexDirection: 'row', gap: 8 },
  statusBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: radii.pill,
    borderWidth: 1.5,
    borderColor: colors.border,
    alignItems: 'center',
    backgroundColor: colors.background,
  },
  statusBtnText: { fontSize: 13, fontWeight: '700', color: colors.textSecondary },
});
