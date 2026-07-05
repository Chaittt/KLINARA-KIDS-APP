import { useRouter } from 'expo-router';
import { useEffect, useState, useCallback } from 'react';
import { Alert, KeyboardAvoidingView, Platform, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../../src/api';
import { Button, Card, H2, H3, Input, Muted } from '../../src/ui';
import { colors, radii, spacing } from '../../src/theme';

type Student = { id: string; name: string };
type Complaint = { id: string; subject: string; description: string; status: string; created_at: string; resolved_at?: string; resolution_note?: string; student_name?: string };

export default function ParentComplaint() {
  const router = useRouter();
  const [students, setStudents] = useState<Student[]>([]);
  const [selId, setSelId] = useState<string | null>(null);
  const [subject, setSubject] = useState('');
  const [desc, setDesc] = useState('');
  const [saving, setSaving] = useState(false);
  const [past, setPast] = useState<Complaint[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const r = await Promise.allSettled([api<Student[]>('/students'), api<Complaint[]>('/complaints')]);
    if (r[0].status === 'fulfilled') {
      setStudents(r[0].value);
      if (r[0].value[0]) setSelId((prev) => prev ?? r[0].value[0].id);
    }
    if (r[1].status === 'fulfilled') setPast(r[1].value);
  }, []);
  useEffect(() => { load(); }, [load]);

  async function submit() {
    if (!selId || !subject.trim() || !desc.trim()) return Alert.alert('All fields required');
    setSaving(true);
    try {
      await api('/complaints', { method: 'POST', body: { student_id: selId, subject: subject.trim(), description: desc.trim() } });
      setSubject(''); setDesc('');
      Alert.alert('Submitted', 'Your complaint has been sent to the school administration.');
      await load();
    } catch (e: any) { Alert.alert('Error', e.message); }
    finally { setSaving(false); }
  }

  async function onRefresh() { setRefreshing(true); await load(); setRefreshing(false); }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.head}>
        <TouchableOpacity testID="back-btn" onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <H2>Feedback</H2>
        <View style={{ width: 44 }} />
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxl }}
          keyboardShouldPersistTaps="handled"
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}>

          <Card style={{ marginBottom: spacing.md }}>
            <H3>Raise a Concern</H3>
            <Muted style={{ marginTop: 4 }}>Share feedback with the school administration directly</Muted>

            {students.length > 1 ? (
              <>
                <Text style={styles.label}>Regarding</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                  {students.map((s) => (
                    <TouchableOpacity key={s.id} testID={`sel-${s.id}`}
                      onPress={() => setSelId(s.id)}
                      style={[styles.chipBtn, selId === s.id && { backgroundColor: colors.primary, borderColor: colors.primary }]}>
                      <Text style={[styles.chipBtnText, selId === s.id && { color: colors.inverse }]}>{s.name}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </>
            ) : null}

            <Input testID="c-subject" label="Subject" value={subject} onChangeText={setSubject} placeholder="e.g. Lunch not eaten" containerStyle={{ marginTop: spacing.md }} />
            <Input testID="c-desc" label="Details" value={desc} onChangeText={setDesc} multiline numberOfLines={5}
              style={{ minHeight: 120, textAlignVertical: 'top' } as any} placeholder="Please share details…" />
            <Button testID="submit-complaint" title="Submit" onPress={submit} loading={saving} />
          </Card>

          <H3 style={{ marginBottom: spacing.sm }}>Past Complaints</H3>
          {past.length === 0 ? (
            <Card><Muted style={{ textAlign: 'center' }}>No complaints yet</Muted></Card>
          ) : past.map((c) => (
            <Card key={c.id} style={{ marginBottom: spacing.sm }} testID={`past-${c.id}`}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text style={styles.cSubject}>{c.subject}</Text>
                <View style={[styles.pill, { backgroundColor: c.status === 'open' ? colors.danger + '22' : colors.success + '22' }]}>
                  <Text style={{ color: c.status === 'open' ? colors.danger : colors.success, fontSize: 10, fontWeight: '700' }}>
                    {c.status.toUpperCase()}
                  </Text>
                </View>
              </View>
              <Text style={styles.cDesc}>{c.description}</Text>
              <Muted style={{ fontSize: 11, marginTop: 4 }}>{new Date(c.created_at).toLocaleDateString()}</Muted>
            </Card>
          ))}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  head: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
  },
  backBtn: {
    width: 44, height: 44, borderRadius: 22, backgroundColor: colors.surface,
    alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.border,
  },
  label: { fontSize: 13, fontWeight: '600', color: colors.textSecondary, marginTop: 12, marginBottom: 8 },
  chipBtn: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: radii.pill,
    borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.surface,
  },
  chipBtnText: { fontSize: 13, fontWeight: '600', color: colors.text },
  cSubject: { fontSize: 15, fontWeight: '700', color: colors.text, flex: 1 },
  cDesc: { fontSize: 13, color: colors.text, marginTop: 6, lineHeight: 18 },
  pill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: radii.pill },
});
