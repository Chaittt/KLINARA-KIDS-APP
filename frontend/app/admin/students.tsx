import { useEffect, useState, useCallback } from 'react';
import {
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
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
import { Button, Card, H2, H3, Input, Muted } from '../../src/ui';
import { colors, radii, spacing } from '../../src/theme';

type Student = { id: string; name: string; class_name: string; parent_phone: string; age?: number };

export default function AdminStudents() {
  const [items, setItems] = useState<Student[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [name, setName] = useState('');
  const [klass, setKlass] = useState('');
  const [parentPhone, setParentPhone] = useState('');
  const [age, setAge] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const s = await api<Student[]>('/students');
      setItems(s);
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

  async function addStudent() {
    if (!name.trim() || !klass.trim() || !/^\d{10}$/.test(parentPhone.trim())) {
      return Alert.alert('Required', 'Name, class, and 10-digit parent phone required');
    }
    setSaving(true);
    try {
      await api('/students', {
        method: 'POST',
        body: {
          name: name.trim(),
          class_name: klass.trim(),
          parent_phone: parentPhone.trim(),
          age: age ? parseInt(age, 10) : null,
        },
      });
      setShowAdd(false);
      setName('');
      setKlass('');
      setParentPhone('');
      setAge('');
      await load();
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed');
    } finally {
      setSaving(false);
    }
  }

  async function deleteStudent(s: Student) {
    Alert.alert('Delete student?', `Remove ${s.name}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await api(`/students/${s.id}`, { method: 'DELETE' });
            await load();
          } catch (e: any) {
            Alert.alert('Error', e.message || 'Failed');
          }
        },
      },
    ]);
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.head}>
        <View>
          <H2>Students</H2>
          <Muted>{items.length} total</Muted>
        </View>
        <TouchableOpacity testID="add-student-btn" style={styles.addBtn} onPress={() => setShowAdd(true)}>
          <Ionicons name="add" size={22} color={colors.inverse} />
          <Text style={styles.addBtnText}>Add</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={items}
        keyExtractor={(s) => s.id}
        contentContainerStyle={{ padding: spacing.lg, paddingTop: 0 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        ListEmptyComponent={
          <Card>
            <Muted style={{ textAlign: 'center' }}>No students yet</Muted>
          </Card>
        }
        renderItem={({ item }) => (
          <Card style={styles.row} testID={`student-${item.id}`}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>
                {item.name
                  .split(' ')
                  .map((p) => p[0])
                  .slice(0, 2)
                  .join('')}
              </Text>
            </View>
            <View style={{ flex: 1, marginLeft: spacing.md }}>
              <Text style={styles.name}>{item.name}</Text>
              <Muted style={{ fontSize: 12 }}>
                {item.class_name} · +91 {item.parent_phone}
              </Muted>
            </View>
            <TouchableOpacity testID={`del-${item.id}`} onPress={() => deleteStudent(item)} hitSlop={10}>
              <Ionicons name="trash-outline" size={20} color={colors.danger} />
            </TouchableOpacity>
          </Card>
        )}
      />

      <Modal visible={showAdd} animationType="slide" transparent>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalBg}>
          <ScrollView contentContainerStyle={{ padding: spacing.lg }} keyboardShouldPersistTaps="handled">
            <Card>
              <H3>Add Student</H3>
              <Input testID="add-name" label="Full Name" value={name} onChangeText={setName} placeholder="e.g. Aarav Reddy" containerStyle={{ marginTop: spacing.md }} />
              <Input testID="add-class" label="Class" value={klass} onChangeText={setKlass} placeholder="e.g. Sunshine" />
              <Input
                testID="add-phone"
                label="Parent Phone"
                value={parentPhone}
                onChangeText={(t) => setParentPhone(t.replace(/\D/g, '').slice(0, 10))}
                keyboardType="phone-pad"
                placeholder="10-digit number"
              />
              <Input testID="add-age" label="Age (optional)" value={age} onChangeText={setAge} keyboardType="number-pad" />
              <Button title="Add Student" onPress={addStudent} loading={saving} testID="confirm-add" />
              <Button
                title="Cancel"
                variant="ghost"
                onPress={() => setShowAdd(false)}
                style={{ marginTop: 8 }}
              />
            </Card>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  head: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.lg,
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    borderRadius: radii.pill,
    gap: 4,
  },
  addBtnText: { color: colors.inverse, fontWeight: '700', fontSize: 14 },
  row: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm, padding: spacing.md },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.beige,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontWeight: '700', color: colors.text },
  name: { fontSize: 16, fontWeight: '600', color: colors.text },
  modalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
});
