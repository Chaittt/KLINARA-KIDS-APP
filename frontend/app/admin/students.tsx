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
import { Button, Card, H2, H3, Input, Muted } from '../../src/ui';
import { colors, radii, spacing } from '../../src/theme';

type Student = {
  id: string;
  name: string;
  class_name: string;
  parent_phone: string;
  age?: number;
  total_fees?: number | null;
  plan_type?: 'single' | 'term' | null;
};

type PlanType = 'single' | 'term';

function splitThree(total: number): [string, string, string] {
  if (!total || total <= 0) return ['', '', ''];
  const base = Math.floor(total / 3);
  return [String(total - 2 * base), String(base), String(base)];
}

/** Shared fee-plan editor used by both Add Student and Set-Plan flows. */
function PlanFields({
  totalFees,
  setTotalFees,
  planType,
  setPlanType,
  terms,
  setTerms,
}: {
  totalFees: string;
  setTotalFees: (v: string) => void;
  planType: PlanType;
  setPlanType: (v: PlanType) => void;
  terms: [string, string, string];
  setTerms: (v: [string, string, string]) => void;
}) {
  const total = parseInt(totalFees || '0', 10) || 0;
  const termSum = terms.reduce((a, t) => a + (parseInt(t || '0', 10) || 0), 0);
  const mismatch = planType === 'term' && total > 0 && termSum !== total;

  // Prefill term split when total or plan type changes
  useEffect(() => {
    if (planType === 'term') setTerms(splitThree(total));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [totalFees, planType]);

  return (
    <>
      <Input
        testID="add-total-fees"
        label="Total Fees (₹)"
        value={totalFees}
        onChangeText={(t) => setTotalFees(t.replace(/\D/g, '').slice(0, 8))}
        keyboardType="number-pad"
        placeholder="e.g. 30000"
      />

      <Muted style={{ fontSize: 12, marginBottom: 6, marginTop: 4 }}>Payment Plan</Muted>
      <View style={styles.planRow}>
        {(['single', 'term'] as PlanType[]).map((pt) => {
          const on = planType === pt;
          return (
            <TouchableOpacity
              key={pt}
              testID={`plan-${pt}`}
              onPress={() => setPlanType(pt)}
              style={[styles.planOption, on ? styles.planOn : styles.planOff]}
            >
              <Ionicons
                name={pt === 'single' ? 'cash-outline' : 'calendar-outline'}
                size={18}
                color={on ? colors.inverse : colors.textSecondary}
              />
              <Text style={[styles.planLabel, on && { color: colors.inverse }]}>
                {pt === 'single' ? 'Single' : 'Term (x3)'}
              </Text>
              <Text style={[styles.planSub, on && { color: colors.inverse }]}>
                {pt === 'single' ? 'One-time' : '3 installments'}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {planType === 'term' ? (
        <View style={{ marginTop: spacing.sm }}>
          {[0, 1, 2].map((i) => (
            <Input
              key={i}
              testID={`add-term-${i + 1}`}
              label={`Term ${i + 1} amount (₹)`}
              value={terms[i]}
              onChangeText={(t) => {
                const next = [...terms] as [string, string, string];
                next[i] = t.replace(/\D/g, '').slice(0, 8);
                setTerms(next);
              }}
              keyboardType="number-pad"
            />
          ))}
          <View style={[styles.sumRow, mismatch ? styles.sumBad : styles.sumGood]}>
            <Ionicons
              name={mismatch ? 'alert-circle' : 'checkmark-circle'}
              size={16}
              color={mismatch ? colors.danger : colors.success}
            />
            <Text style={{ fontSize: 12, color: mismatch ? colors.danger : colors.success, fontWeight: '600' }}>
              Installments total ₹{termSum.toLocaleString()}
              {mismatch ? ` — must equal ₹${total.toLocaleString()}` : ' ✓'}
            </Text>
          </View>
        </View>
      ) : (
        <Muted style={{ fontSize: 12, marginTop: 4 }}>
          Parent owes the full ₹{(total || 0).toLocaleString()} in a single payment, due on admission.
        </Muted>
      )}
    </>
  );
}

export default function AdminStudents() {
  const router = useRouter();
  const { user } = useAuth();
  const isMD = user?.role === 'md';
  const [items, setItems] = useState<Student[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  // Add-student modal state
  const [showAdd, setShowAdd] = useState(false);
  const [name, setName] = useState('');
  const [klass, setKlass] = useState('');
  const [parentName, setParentName] = useState('');
  const [parentPhone, setParentPhone] = useState('');
  const [age, setAge] = useState('');
  const [totalFees, setTotalFees] = useState('');
  const [planType, setPlanType] = useState<PlanType>('single');
  const [terms, setTerms] = useState<[string, string, string]>(['', '', '']);
  const [saving, setSaving] = useState(false);

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

  function resetAdd() {
    setName('');
    setKlass('');
    setParentName('');
    setParentPhone('');
    setAge('');
    setTotalFees('');
    setPlanType('single');
    setTerms(['', '', '']);
  }

  function validatePlanInput(total: number, type: PlanType, t: [string, string, string]): string | null {
    if (!total || total <= 0) return 'Enter total fees';
    if (type === 'term') {
      const nums = t.map((x) => parseInt(x || '0', 10) || 0);
      if (nums.some((n) => n <= 0)) return 'Enter all 3 term amounts';
      if (nums.reduce((a, b) => a + b, 0) !== total) return 'Term amounts must add up to the total';
    }
    return null;
  }

  async function addStudent() {
    const total = parseInt(totalFees || '0', 10) || 0;
    if (!name.trim() || !klass.trim() || !parentName.trim() || !/^\d{10}$/.test(parentPhone.trim())) {
      return Alert.alert('Required', 'Student name, class, parent name and a 10-digit parent phone are required');
    }
    const planErr = validatePlanInput(total, planType, terms);
    if (planErr) return Alert.alert('Fee plan', planErr);

    setSaving(true);
    try {
      await api('/students', {
        method: 'POST',
        body: {
          name: name.trim(),
          class_name: klass.trim(),
          parent_name: parentName.trim(),
          parent_phone: parentPhone.trim(),
          age: age ? parseInt(age, 10) : null,
          total_fees: total,
          plan_type: planType,
          term_amounts: planType === 'term' ? terms.map((t) => parseInt(t, 10)) : null,
        },
      });
      setShowAdd(false);
      resetAdd();
      await load();
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed');
    } finally {
      setSaving(false);
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
          style={[styles.addBtn, !isMD && { opacity: 0.3 }]}
          onPress={() => {
            if (!isMD) return Alert.alert('MD only', 'Only the MD can add new students.');
            setShowAdd(true);
          }}
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
                </View>
                <TouchableOpacity
                  testID={`del-${item.id}`}
                  onPress={() => {
                    if (!isMD) return Alert.alert('MD only', 'Only the MD can delete students.');
                    deleteStudent(item);
                  }}
                  hitSlop={10}
                >
                  <Ionicons name="trash-outline" size={20} color={isMD ? colors.danger : colors.textMuted} />
                </TouchableOpacity>
              </Card>
            </TouchableOpacity>
          );
        }}
      />

      {/* Add Student */}
      <Modal visible={showAdd} animationType="slide" transparent>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalBg}>
          <ScrollView contentContainerStyle={{ padding: spacing.lg }} keyboardShouldPersistTaps="handled">
            <Card>
              <H3>Add Student</H3>
              <Input testID="add-name" label="Student Full Name" value={name} onChangeText={setName} placeholder="e.g. Aarav Reddy" containerStyle={{ marginTop: spacing.md }} />
              <Input testID="add-class" label="Class" value={klass} onChangeText={setKlass} placeholder="e.g. Sunshine" />
              <Input testID="add-parent-name" label="Parent Name" value={parentName} onChangeText={setParentName} placeholder="e.g. Anjali Reddy" />
              <Input
                testID="add-phone"
                label="Parent Phone"
                value={parentPhone}
                onChangeText={(t) => setParentPhone(t.replace(/\D/g, '').slice(0, 10))}
                keyboardType="phone-pad"
                placeholder="10-digit number"
              />
              <Input testID="add-age" label="Age (optional)" value={age} onChangeText={setAge} keyboardType="number-pad" />

              <View style={styles.divider} />
              <PlanFields
                totalFees={totalFees}
                setTotalFees={setTotalFees}
                planType={planType}
                setPlanType={setPlanType}
                terms={terms}
                setTerms={setTerms}
              />

              <Button title="Add Student" onPress={addStudent} loading={saving} testID="confirm-add" style={{ marginTop: spacing.md }} />
              <Button title="Cancel" variant="ghost" onPress={() => setShowAdd(false)} style={{ marginTop: 8 }} />
            </Card>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>

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
  divider: { height: 1, backgroundColor: colors.border, marginVertical: spacing.md },
  planRow: { flexDirection: 'row', gap: spacing.sm },
  planOption: {
    flex: 1,
    borderRadius: radii.md,
    borderWidth: 1,
    paddingVertical: 12,
    paddingHorizontal: 10,
    gap: 2,
  },
  planOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  planOff: { backgroundColor: colors.surface, borderColor: colors.border },
  planLabel: { fontSize: 14, fontWeight: '700', color: colors.text, marginTop: 4 },
  planSub: { fontSize: 11, color: colors.textSecondary },
  sumRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    padding: 10,
    borderRadius: radii.md,
    marginTop: 4,
  },
  sumGood: { backgroundColor: colors.success + '18' },
  sumBad: { backgroundColor: colors.danger + '18' },
});
