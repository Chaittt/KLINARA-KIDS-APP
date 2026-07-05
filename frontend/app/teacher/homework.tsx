import { useEffect, useState, useCallback } from 'react';
import { Alert, KeyboardAvoidingView, Modal, Platform, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../../src/api';
import { Button, Card, H2, H3, Input, Muted } from '../../src/ui';
import { colors, radii, spacing } from '../../src/theme';

type Homework = {
  id: string;
  class_name: string;
  title: string;
  description: string;
  due_date?: string;
  uploader_name?: string;
  created_at: string;
};

export default function TeacherHomework() {
  const [items, setItems] = useState<Homework[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [show, setShow] = useState(false);
  const [title, setTitle] = useState('');
  const [desc, setDesc] = useState('');
  const [due, setDue] = useState('');
  const [saving, setSaving] = useState(false);
  const [className, setClassName] = useState('Sunshine');

  const load = useCallback(async () => {
    try {
      const r = await api<Homework[]>('/homework');
      setItems(r);
    } catch {}
  }, []);
  useEffect(() => { load(); }, [load]);

  async function submit() {
    if (!title.trim() || !desc.trim()) return Alert.alert('Title and description required');
    setSaving(true);
    try {
      await api('/homework', {
        method: 'POST',
        body: { class_name: className, title: title.trim(), description: desc.trim(), due_date: due || null },
      });
      setShow(false); setTitle(''); setDesc(''); setDue(''); await load();
    } catch (e: any) { Alert.alert('Error', e.message); }
    finally { setSaving(false); }
  }

  async function del(h: Homework) {
    Alert.alert('Delete?', h.title, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => { try { await api(`/homework/${h.id}`, { method: 'DELETE' }); await load(); } catch {} } },
    ]);
  }

  async function onRefresh() { setRefreshing(true); await load(); setRefreshing(false); }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.head}>
        <View>
          <H2>Homework</H2>
          <Muted>Assign & review class homework</Muted>
        </View>
        <TouchableOpacity testID="new-hw" onPress={() => setShow(true)} style={styles.addBtn}>
          <Ionicons name="add" size={22} color={colors.inverse} />
          <Text style={styles.addBtnText}>New</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingTop: 0 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}>
        {items.length === 0 ? (
          <Card><Muted style={{ textAlign: 'center' }}>No homework assigned yet.</Muted></Card>
        ) : items.map((h) => (
          <Card key={h.id} style={{ marginBottom: spacing.md }} testID={`hw-${h.id}`}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <View style={{ flex: 1 }}>
                <Text style={styles.hTitle}>{h.title}</Text>
                <Muted style={{ fontSize: 12, marginTop: 2 }}>
                  {h.class_name}{h.due_date ? ` · Due ${h.due_date}` : ''}
                </Muted>
              </View>
              <TouchableOpacity onPress={() => del(h)} hitSlop={10}>
                <Ionicons name="trash-outline" size={18} color={colors.danger} />
              </TouchableOpacity>
            </View>
            <Text style={styles.hDesc}>{h.description}</Text>
            <Muted style={{ fontSize: 11, marginTop: 6 }}>{h.uploader_name} · {new Date(h.created_at).toLocaleDateString()}</Muted>
          </Card>
        ))}
      </ScrollView>

      <Modal visible={show} animationType="slide" transparent>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalBg}>
          <ScrollView contentContainerStyle={{ padding: spacing.lg }} keyboardShouldPersistTaps="handled">
            <Card>
              <H3>New Homework</H3>
              <Input testID="hw-class" label="Class" value={className} onChangeText={setClassName} containerStyle={{ marginTop: spacing.md }} />
              <Input testID="hw-title" label="Title" value={title} onChangeText={setTitle} placeholder="Color the Rainbow" />
              <Input testID="hw-desc" label="Instructions" value={desc} onChangeText={setDesc} multiline numberOfLines={4} style={{ minHeight: 100, textAlignVertical: 'top' } as any} />
              <Input testID="hw-due" label="Due date (YYYY-MM-DD, optional)" value={due} onChangeText={setDue} />
              <Button testID="post-hw" title="Assign" onPress={submit} loading={saving} />
              <Button title="Cancel" variant="ghost" onPress={() => setShow(false)} style={{ marginTop: 8 }} />
            </Card>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: spacing.lg },
  addBtn: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: colors.primary,
    paddingHorizontal: spacing.md, paddingVertical: 10, borderRadius: radii.pill, gap: 4,
  },
  addBtnText: { color: colors.inverse, fontWeight: '700', fontSize: 14 },
  hTitle: { fontSize: 15, fontWeight: '700', color: colors.text },
  hDesc: { fontSize: 14, color: colors.text, marginTop: 8, lineHeight: 20 },
  modalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
});
