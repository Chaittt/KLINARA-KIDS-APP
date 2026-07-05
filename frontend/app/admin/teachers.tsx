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
import { useAuth } from '../../src/auth';
import { Button, Card, H2, H3, Input, Muted } from '../../src/ui';
import { colors, radii, spacing } from '../../src/theme';

type Teacher = { id: string; name: string; email: string; class_name?: string };

export default function AdminTeachers() {
  const { user } = useAuth();
  const isMD = user?.role === 'md';
  const [items, setItems] = useState<Teacher[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [klass, setKlass] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const t = await api<Teacher[]>('/teachers');
      setItems(t);
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

  async function add() {
    if (!name.trim() || !email.includes('@') || password.length < 6) {
      return Alert.alert('Required', 'Name, email and password (≥6 chars) are required');
    }
    setSaving(true);
    try {
      await api('/teachers', {
        method: 'POST',
        body: { name: name.trim(), email: email.trim().toLowerCase(), password, class_name: klass || null },
      });
      setShowAdd(false);
      setName('');
      setEmail('');
      setPassword('');
      setKlass('');
      await load();
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed');
    } finally {
      setSaving(false);
    }
  }

  async function del(t: Teacher) {
    Alert.alert('Delete teacher?', `Remove ${t.name}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await api(`/teachers/${t.id}`, { method: 'DELETE' });
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
          <H2>Teachers</H2>
          <Muted>{items.length} on staff</Muted>
        </View>
        <TouchableOpacity testID="add-teacher-btn" style={[styles.addBtn, !isMD && { opacity: 0.3 }]} onPress={() => {
          if (!isMD) return Alert.alert('MD only', 'Only the MD can add teachers.');
          setShowAdd(true);
        }}>
          <Ionicons name="add" size={22} color={colors.inverse} />
          <Text style={styles.addBtnText}>Add</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={items}
        keyExtractor={(t) => t.id}
        contentContainerStyle={{ padding: spacing.lg, paddingTop: 0 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        ListEmptyComponent={
          <Card>
            <Muted style={{ textAlign: 'center' }}>No teachers yet</Muted>
          </Card>
        }
        renderItem={({ item }) => (
          <Card style={styles.row} testID={`teacher-${item.id}`}>
            <View style={styles.avatar}>
              <Ionicons name="person" size={22} color={colors.inverse} />
            </View>
            <View style={{ flex: 1, marginLeft: spacing.md }}>
              <Text style={styles.name}>{item.name}</Text>
              <Muted style={{ fontSize: 12 }}>
                {item.email}
                {item.class_name ? ` · ${item.class_name}` : ''}
              </Muted>
            </View>
            <TouchableOpacity testID={`del-t-${item.id}`} onPress={() => {
              if (!isMD) return Alert.alert('MD only', 'Only the MD can delete teachers.');
              del(item);
            }} hitSlop={10}>
              <Ionicons name="trash-outline" size={20} color={isMD ? colors.danger : colors.textMuted} />
            </TouchableOpacity>
          </Card>
        )}
      />

      <Modal visible={showAdd} animationType="slide" transparent>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalBg}>
          <ScrollView contentContainerStyle={{ padding: spacing.lg }} keyboardShouldPersistTaps="handled">
            <Card>
              <H3>Add Teacher</H3>
              <Input testID="t-name" label="Name" value={name} onChangeText={setName} containerStyle={{ marginTop: spacing.md }} />
              <Input testID="t-email" label="Email" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" />
              <Input testID="t-password" label="Password" value={password} onChangeText={setPassword} secureTextEntry />
              <Input testID="t-class" label="Class (optional)" value={klass} onChangeText={setKlass} />
              <Button title="Add Teacher" onPress={add} loading={saving} testID="confirm-t" />
              <Button title="Cancel" variant="ghost" onPress={() => setShowAdd(false)} style={{ marginTop: 8 }} />
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
    backgroundColor: colors.golden,
    alignItems: 'center',
    justifyContent: 'center',
  },
  name: { fontSize: 16, fontWeight: '600', color: colors.text },
  modalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
});
