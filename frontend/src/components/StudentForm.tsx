import { useEffect, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../api';
import { Button, Card, H3, Input, Muted } from '../ui';
import { colors, radii, spacing } from '../theme';

export type PlanType = 'single' | 'term';

/** Username + password fields used by Add Student and Set Login. */
export function LoginFields({
  username,
  setUsername,
  password,
  setPassword,
  prefix,
  error,
}: {
  username: string;
  setUsername: (v: string) => void;
  password: string;
  setPassword: (v: string) => void;
  prefix: string;
  error?: string;
}) {
  const [show, setShow] = useState(false);
  return (
    <>
      <Input
        testID={`${prefix}-username`}
        label="Username"
        value={username}
        onChangeText={(t) => setUsername(t.replace(/\s/g, '').toLowerCase())}
        autoCapitalize="none"
        autoCorrect={false}
        placeholder="e.g. anjali.reddy"
      />
      <View style={{ position: 'relative' }}>
        <Input
          testID={`${prefix}-password`}
          label="Password (min 6 characters)"
          value={password}
          onChangeText={setPassword}
          secureTextEntry={!show}
          autoCapitalize="none"
          autoCorrect={false}
          placeholder="••••••"
          error={error}
        />
        <TouchableOpacity testID={`${prefix}-toggle-pwd`} style={styles.eye} hitSlop={10} onPress={() => setShow((v) => !v)}>
          <Ionicons name={show ? 'eye-off-outline' : 'eye-outline'} size={20} color={colors.textMuted} />
        </TouchableOpacity>
      </View>
    </>
  );
}

export function loginInputError(username: string, password: string): string | null {
  if (!/^[a-z0-9._@+-]{3,50}$/.test(username.trim().toLowerCase()))
    return 'Username must be 3-50 characters: letters, numbers, . _ - @ +';
  if (password.length < 6) return 'Password must be at least 6 characters';
  return null;
}

export function validatePlanInput(total: number, type: PlanType, t: [string, string, string]): string | null {
  if (!total || total <= 0) return 'Enter total fees';
  if (type === 'term') {
    const nums = t.map((x) => parseInt(x || '0', 10) || 0);
    if (nums.some((n) => n <= 0)) return 'Enter all 3 term amounts';
    if (nums.reduce((a, b) => a + b, 0) !== total) return 'Term amounts must add up to the total';
  }
  return null;
}

function splitThree(total: number): [string, string, string] {
  if (!total || total <= 0) return ['', '', ''];
  const base = Math.floor(total / 3);
  return [String(total - 2 * base), String(base), String(base)];
}

/** Shared fee-plan editor used by both Add Student and Set-Plan flows. */
export function PlanFields({
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

/** The single Add Student form used by the Students and Setup pages (MD + Admin). */
export function AddStudentModal({
  visible,
  onClose,
  onSaved,
}: {
  visible: boolean;
  onClose: () => void;
  onSaved: () => void | Promise<void>;
}) {
  const [name, setName] = useState('');
  const [klass, setKlass] = useState('');
  const [parentName, setParentName] = useState('');
  const [parentPhone, setParentPhone] = useState('');
  const [age, setAge] = useState('');
  const [pUsername, setPUsername] = useState('');
  const [pPassword, setPPassword] = useState('');
  const [existingLogin, setExistingLogin] = useState<string | null>(null);
  const [totalFees, setTotalFees] = useState('');
  const [planType, setPlanType] = useState<PlanType>('single');
  const [terms, setTerms] = useState<[string, string, string]>(['', '', '']);
  const [saving, setSaving] = useState(false);

  // When a full phone is entered, check whether this parent already has a login (sibling)
  useEffect(() => {
    setExistingLogin(null);
    if (!/^\d{10}$/.test(parentPhone)) return;
    let cancelled = false;
    api<{ exists: boolean; username: string | null }>(`/parents/lookup?phone=${parentPhone}`)
      .then((r) => {
        if (!cancelled) setExistingLogin(r.exists && r.username ? r.username : null);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [parentPhone]);

  function reset() {
    setName('');
    setKlass('');
    setParentName('');
    setParentPhone('');
    setAge('');
    setPUsername('');
    setPPassword('');
    setExistingLogin(null);
    setTotalFees('');
    setPlanType('single');
    setTerms(['', '', '']);
  }

  function close() {
    reset();
    onClose();
  }

  async function addStudent() {
    const total = parseInt(totalFees || '0', 10) || 0;
    if (!name.trim() || !klass.trim() || !parentName.trim() || !/^\d{10}$/.test(parentPhone.trim())) {
      return Alert.alert('Required', 'Student name, class, parent name and a 10-digit parent phone are required');
    }
    if (!existingLogin) {
      const loginErr = loginInputError(pUsername, pPassword);
      if (loginErr) return Alert.alert('Parent login', loginErr);
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
          parent_username: existingLogin ? null : pUsername.trim().toLowerCase(),
          parent_password: existingLogin ? null : pPassword,
        },
      });
      reset();
      onClose();
      await onSaved();
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={close}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalBg}>
        <ScrollView contentContainerStyle={{ padding: spacing.lg }} keyboardShouldPersistTaps="handled">
          <Card testID="add-student-form">
            <H3>Add Student</H3>
            <Input testID="add-name" label="Student Full Name" value={name} onChangeText={setName} placeholder="e.g. Aarav Reddy" containerStyle={{ marginTop: spacing.md }} />
            <Input testID="add-class" label="Class" value={klass} onChangeText={setKlass} placeholder="e.g. Sunshine" />
            <Input testID="add-age" label="Age (optional)" value={age} onChangeText={(t) => setAge(t.replace(/\D/g, '').slice(0, 2))} keyboardType="number-pad" />
            <Input testID="add-parent-name" label="Parent Name" value={parentName} onChangeText={setParentName} placeholder="e.g. Anjali Reddy" />
            <Input
              testID="add-phone"
              label="Parent Phone"
              value={parentPhone}
              onChangeText={(t) => setParentPhone(t.replace(/\D/g, '').slice(0, 10))}
              keyboardType="phone-pad"
              placeholder="10-digit number"
            />

            <View style={styles.divider} />
            <Text style={styles.sectionTitle}>Parent Login</Text>
            {existingLogin ? (
              <View style={styles.existingBox} testID="existing-login-box">
                <Ionicons name="checkmark-circle" size={16} color={colors.success} />
                <Text style={styles.existingText}>Existing login: {existingLogin}</Text>
              </View>
            ) : (
              <LoginFields
                prefix="add-parent"
                username={pUsername}
                setUsername={setPUsername}
                password={pPassword}
                setPassword={setPPassword}
              />
            )}

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
            <Button title="Cancel" variant="ghost" onPress={close} style={{ marginTop: 8 }} testID="cancel-add" />
          </Card>
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  divider: { height: 1, backgroundColor: colors.border, marginVertical: spacing.md },
  sectionTitle: { fontSize: 14, fontWeight: '700', color: colors.text, marginBottom: spacing.sm },
  eye: { position: 'absolute', right: 4, top: 26, width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  existingBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    padding: 12,
    borderRadius: radii.md,
    backgroundColor: colors.success + '18',
  },
  existingText: { fontSize: 13, fontWeight: '600', color: colors.success, flex: 1 },
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
