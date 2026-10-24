import { useRouter } from 'expo-router';
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
import { Button, Card, H2, H3, Muted } from '../../src/ui';
import { colors, radii, spacing } from '../../src/theme';
import { AddStudentModal, LoginFields, loginInputError, PlanFields, PlanType, validatePlanInput } from '../../src/components/StudentForm';

type Student = {
  id: string;
  name: string;
  class_name: string;
  parent_phone: string;
  age?: number;
  total_fees?: number | null;
  plan_type?: 'single' | 'term' | null;
  parent_id?: string | null;
  parent_username?: string | null;
  parent_has_login?: boolean;
};

export default function AdminStudents() {
  const router = useRouter();
  const { user } = useAuth();
  const isMD = user?.role === 'md';
  const [items, setItems] = useState<Student[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  // Add-student modal state
  const [showAdd, setShowAdd] = useState(false);

  // Set-login (existing parent) modal state
  const [loginStudent, setLoginStudent] = useState<Student | null>(null);
  const [lUsername, setLUsername] = useState('');
  const [lPassword, setLPassword] = useState('');
  const [lErr, setLErr] = useState('');
  const [lSaving, setLSaving] = useState(false);

  // Set-plan (existing student) modal state
  const [planStudent, setPlanStudent] = useState<Student | null>(null);
  const [pTotal, setPTotal] = useState('');
  const [pType, setPType] = useState<PlanType>('single');
  const [pTerms, setPTerms] = useState<[string, string, string]>(['', '', '']);
  const [pSaving, setPSaving] = useState(false);

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

  function openSetLogin(s: Student) {
    setLoginStudent(s);
    setLUsername('');
    setLPassword('');
    setLErr('');
  }

  async function saveSetLogin() {
    if (!loginStudent?.parent_id) return;
    const v = loginInputError(lUsername, lPassword);
    if (v) return setLErr(v);
    setLErr('');
    setLSaving(true);
    try {
      await api(`/users/${loginStudent.parent_id}/parent-login`, {
        method: 'POST',
        body: { username: lUsername.trim().toLowerCase(), password: lPassword },
      });
      setLoginStudent(null);
      await load();
    } catch (e: any) {
      setLErr(e.message || 'Could not save login');
    } finally {
      setLSaving(false);
    }
  }

  function openSetPlan(s: Student) {
    setPlanStudent(s);
    setPTotal(s.total_fees ? String(s.total_fees) : '');
    setPType((s.plan_type as PlanType) || 'single');
    setPTerms(['', '', '']);
  }

  async function saveSetPlan() {
    if (!planStudent) return;
    const total = parseInt(pTotal || '0', 10) || 0;
    const planErr = validatePlanInput(total, pType, pTerms);
    if (planErr) return Alert.alert('Fee plan', planErr);
    setPSaving(true);
    try {
      await api(`/students/${planStudent.id}/fee-plan`, {
        method: 'POST',
        body: {
          total_fees: total,
          plan_type: pType,
          term_amounts: pType === 'term' ? pTerms.map((t) => parseInt(t, 10)) : null,
        },
      });
      setPlanStudent(null);
      await load();
      Alert.alert('Fee plan set', 'The fee(s) are now visible to the parent.');
    } catch (e: any) {
      Alert.alert('Could not set plan', e.message || 'Failed');
    } finally {
      setPSaving(false);
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
        <TouchableOpacity
          testID="add-student-btn"
          style={styles.addBtn}
          onPress={() => setShowAdd(true)}
        >
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
        renderItem={({ item }) => {
          const hasPlan = !!item.plan_type;
          return (
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={() => router.push(`/student/${item.id}`)}
              testID={`student-${item.id}`}
            >
              <Card style={styles.row}>
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
                  {hasPlan ? (
                    <View style={styles.planTag}>
                      <Ionicons name="pricetag" size={11} color={colors.primary} />
                      <Text style={styles.planTagText}>
                        ₹{(item.total_fees || 0).toLocaleString()} · {item.plan_type === 'term' ? '3 terms' : 'One-time'}
                      </Text>
                    </View>
                  ) : isMD ? (
                    <TouchableOpacity testID={`setplan-${item.id}`} onPress={() => openSetPlan(item)} style={styles.setPlanBtn}>
                      <Ionicons name="add-circle-outline" size={13} color={colors.golden} />
                      <Text style={styles.setPlanText}>Set fee plan</Text>
                    </TouchableOpacity>
                  ) : null}
                  {isMD && item.parent_id && !item.parent_has_login ? (
                    <TouchableOpacity testID={`setlogin-${item.id}`} onPress={() => openSetLogin(item)} style={styles.setPlanBtn}>
                      <Ionicons name="key-outline" size={13} color={colors.golden} />
                      <Text style={styles.setPlanText}>Set login</Text>
                    </TouchableOpacity>
                  ) : null}
                </View>
                {isMD ? (
                  <TouchableOpacity testID={`del-${item.id}`} onPress={() => deleteStudent(item)} hitSlop={10}>
                    <Ionicons name="trash-outline" size={20} color={colors.danger} />
                  </TouchableOpacity>
                ) : null}
              </Card>
            </TouchableOpacity>
          );
        }}
      />

      <AddStudentModal visible={showAdd} onClose={() => setShowAdd(false)} onSaved={load} />

      {/* Set Fee Plan for an existing student */}
      <Modal visible={!!planStudent} animationType="slide" transparent>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalBg}>
          <ScrollView contentContainerStyle={{ padding: spacing.lg }} keyboardShouldPersistTaps="handled">
            <Card>
              <H3>Set Fee Plan</H3>
              <Muted style={{ marginTop: 4, marginBottom: spacing.sm }}>
                {planStudent?.name} · {planStudent?.class_name}
              </Muted>
              <PlanFields
                totalFees={pTotal}
                setTotalFees={setPTotal}
                planType={pType}
                setPlanType={setPType}
                terms={pTerms}
                setTerms={setPTerms}
              />
              <Button title="Save Fee Plan" onPress={saveSetPlan} loading={pSaving} testID="confirm-set-plan" style={{ marginTop: spacing.md }} />
              <Button title="Cancel" variant="ghost" onPress={() => setPlanStudent(null)} style={{ marginTop: 8 }} />
            </Card>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>

      {/* Set Parent Login for an existing parent */}
      <Modal visible={!!loginStudent} animationType="slide" transparent onRequestClose={() => setLoginStudent(null)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalBg}>
          <ScrollView contentContainerStyle={{ padding: spacing.lg }} keyboardShouldPersistTaps="handled">
            <Card>
              <H3>Set Parent Login</H3>
              <Muted style={{ marginTop: 4, marginBottom: spacing.md }}>
                Parent of {loginStudent?.name} · +91 {loginStudent?.parent_phone}
              </Muted>
              <LoginFields
                prefix="setlogin"
                username={lUsername}
                setUsername={setLUsername}
                password={lPassword}
                setPassword={setLPassword}
                error={lErr}
              />
              <Button title="Save Login" onPress={saveSetLogin} loading={lSaving} testID="confirm-set-login" style={{ marginTop: spacing.sm }} />
              <Button title="Cancel" variant="ghost" onPress={() => setLoginStudent(null)} style={{ marginTop: 8 }} testID="cancel-set-login" />
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
  planTag: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  planTagText: { fontSize: 11, color: colors.primary, fontWeight: '700' },
  setPlanBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  setPlanText: { fontSize: 12, color: colors.golden, fontWeight: '700' },
  modalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
});
