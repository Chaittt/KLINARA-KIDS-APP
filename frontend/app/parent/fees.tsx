import { useEffect, useState, useCallback } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Linking,
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
import * as Clipboard from 'expo-clipboard';
import QRCode from 'react-native-qrcode-svg';
import { api } from '../../src/api';
import { Button, Card, H2, H3, Input, Muted } from '../../src/ui';
import { colors, radii, spacing } from '../../src/theme';

type Payment = {
  id: string;
  student_id: string;
  amount: number;
  status: string;
  description?: string;
  transaction_id?: string;
  utr?: string;
  method?: string;
  submitted_at?: string;
  reject_reason?: string;
  created_at: string;
  paid_at?: string;
  due_date?: string | null;
};
type Student = { id: string; name: string };
type UpiSettings = { upi_id: string; upi_name: string };

export default function ParentFees() {
  const [student, setStudent] = useState<Student | null>(null);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [upi, setUpi] = useState<UpiSettings | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const [modalPay, setModalPay] = useState<Payment | null>(null);
  const [utr, setUtr] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    try {
      const s = (await api<Student[]>('/students'))[0];
      setStudent(s || null);
      const [pays, u] = await Promise.all([
        s ? api<Payment[]>(`/payments/student/${s.id}`) : Promise.resolve([] as Payment[]),
        api<UpiSettings>('/settings/upi').catch(() => null),
      ]);
      setPayments(pays as Payment[]);
      setUpi((u as UpiSettings) || { upi_id: 'klinarakids@upi', upi_name: 'Klinara Kids' });
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function onRefresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  function upiUri(p: Payment) {
    if (!upi) return '';
    const pn = encodeURIComponent(upi.upi_name || 'Klinara Kids');
    const tn = encodeURIComponent(`Fee-${p.id.slice(0, 8)}-${student?.name?.split(' ')[0] || ''}`);
    return `upi://pay?pa=${encodeURIComponent(upi.upi_id)}&pn=${pn}&am=${p.amount}&tn=${tn}&cu=INR`;
  }

  function openPayModal(p: Payment) {
    setModalPay(p);
    setUtr('');
  }

  async function openUpiApp() {
    if (!modalPay) return;
    const uri = upiUri(modalPay);
    try {
      const ok = await Linking.canOpenURL(uri);
      if (ok) await Linking.openURL(uri);
      else Alert.alert('No UPI app', 'Please open your UPI app manually and pay to the ID above.');
    } catch {
      Alert.alert('Unable to open UPI app', 'Please open your UPI app manually and pay to the ID above.');
    }
  }

  async function copyUpi() {
    if (!upi) return;
    await Clipboard.setStringAsync(upi.upi_id);
    Alert.alert('Copied', `UPI ID "${upi.upi_id}" copied to clipboard.`);
  }

  async function submitUtr() {
    if (!modalPay) return;
    const clean = utr.trim().toUpperCase().replace(/\s/g, '');
    if (clean.length < 6 || !/^[A-Z0-9]+$/.test(clean)) {
      return Alert.alert('Invalid Reference', 'UTR/Reference must be at least 6 alphanumeric characters.');
    }
    setSubmitting(true);
    try {
      await api(`/payments/${modalPay.id}/submit-upi`, { method: 'POST', body: { utr: clean } });
      Alert.alert('Submitted', 'Your payment reference has been submitted. School will verify and confirm shortly.');
      setModalPay(null); setUtr('');
      await load();
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Failed to submit');
    } finally {
      setSubmitting(false);
    }
  }

  const pending = payments.filter((p) => p.status === 'pending');
  const awaiting = payments.filter((p) => p.status === 'pending_verification');
  const paid = payments.filter((p) => p.status === 'paid');

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxl }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      >
        <H2>Fees</H2>
        {student ? <Muted style={{ marginBottom: spacing.md }}>{student.name}</Muted> : null}

        {pending.length === 0 && awaiting.length === 0 ? (
          <Card style={{ alignItems: 'center' }}>
            <Ionicons name="checkmark-circle" size={42} color={colors.success} />
            <H3 style={{ marginTop: 8 }}>All Clear!</H3>
            <Muted>No pending dues</Muted>
          </Card>
        ) : null}

        {pending.length > 0 ? (
          <>
            <H3 style={{ marginTop: spacing.md, marginBottom: spacing.sm }}>Pending</H3>
            {pending.map((p) => (
              <Card key={p.id} style={{ marginBottom: spacing.md, backgroundColor: colors.primary }} testID={`pay-${p.id}`}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.payTitle}>{p.description}</Text>
                    <Text style={styles.paySub}>Due {new Date(p.due_date || p.created_at).toLocaleDateString()}</Text>
                    {p.reject_reason ? (
                      <View style={styles.rejectBox}>
                        <Ionicons name="alert-circle" size={14} color={colors.inverse} />
                        <Text style={styles.rejectText}>Previous attempt rejected: {p.reject_reason}</Text>
                      </View>
                    ) : null}
                  </View>
                  <Text style={styles.payAmount}>₹{p.amount.toLocaleString()}</Text>
                </View>
                <Button
                  testID={`pay-now-${p.id}`}
                  title="Pay via UPI"
                  variant="secondary"
                  onPress={() => openPayModal(p)}
                  style={{ marginTop: spacing.md }}
                />
              </Card>
            ))}
          </>
        ) : null}

        {awaiting.length > 0 ? (
          <>
            <H3 style={{ marginTop: spacing.md, marginBottom: spacing.sm }}>Awaiting Verification</H3>
            {awaiting.map((p) => (
              <Card key={p.id} style={styles.awaitCard} testID={`await-${p.id}`}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontWeight: '700', color: colors.text }}>{p.description}</Text>
                    <Muted style={{ fontSize: 12, marginTop: 2 }}>
                      Ref: {p.utr} · Submitted {p.submitted_at ? new Date(p.submitted_at).toLocaleString() : '—'}
                    </Muted>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={{ fontWeight: '700', color: colors.text }}>₹{p.amount.toLocaleString()}</Text>
                    <View style={styles.awaitBadge}>
                      <Ionicons name="hourglass-outline" size={11} color={colors.golden} />
                      <Text style={styles.awaitBadgeText}>Pending</Text>
                    </View>
                  </View>
                </View>
              </Card>
            ))}
          </>
        ) : null}

        <H3 style={{ marginTop: spacing.lg, marginBottom: spacing.sm }}>History</H3>
        {paid.length === 0 ? (
          <Card>
            <Muted style={{ textAlign: 'center' }}>No payment history</Muted>
          </Card>
        ) : (
          paid.map((p) => (
            <Card key={p.id} style={{ marginBottom: spacing.sm, padding: spacing.md }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontWeight: '600', color: colors.text }}>{p.description}</Text>
                  <Muted style={{ fontSize: 12, marginTop: 2 }}>
                    {p.paid_at ? new Date(p.paid_at).toLocaleDateString() : '—'} · {p.transaction_id}
                  </Muted>
                </View>
                <Text style={{ color: colors.success, fontWeight: '700', fontSize: 16 }}>
                  ₹{p.amount.toLocaleString()}
                </Text>
              </View>
            </Card>
          ))
        )}
      </ScrollView>

      {/* UPI Payment Modal */}
      <Modal visible={!!modalPay} animationType="slide" transparent>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalBg}>
          <ScrollView contentContainerStyle={{ padding: spacing.lg }} keyboardShouldPersistTaps="handled">
            <Card>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <H3>Pay via UPI</H3>
                <TouchableOpacity onPress={() => setModalPay(null)} hitSlop={10}>
                  <Ionicons name="close" size={24} color={colors.textMuted} />
                </TouchableOpacity>
              </View>

              {modalPay && upi ? (
                <>
                  <View style={styles.amountBox}>
                    <Muted style={styles.amountLabel}>Amount</Muted>
                    <Text style={styles.amountVal}>₹{modalPay.amount.toLocaleString()}</Text>
                    <Muted style={{ fontSize: 12, marginTop: 2 }}>{modalPay.description}</Muted>
                  </View>

                  <View style={styles.qrBox}>
                    <QRCode value={upiUri(modalPay)} size={180} backgroundColor={colors.surface} color={colors.text} />
                    <Muted style={{ fontSize: 11, marginTop: 8, textAlign: 'center' }}>
                      Scan with any UPI app
                    </Muted>
                  </View>

                  <View style={styles.upiIdRow}>
                    <View style={{ flex: 1 }}>
                      <Muted style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 1 }}>School UPI ID</Muted>
                      <Text style={styles.upiIdText}>{upi.upi_id}</Text>
                      <Muted style={{ fontSize: 11 }}>{upi.upi_name}</Muted>
                    </View>
                    <TouchableOpacity testID="copy-upi" onPress={copyUpi} style={styles.copyBtn}>
                      <Ionicons name="copy-outline" size={16} color={colors.primary} />
                      <Text style={styles.copyText}>Copy</Text>
                    </TouchableOpacity>
                  </View>

                  <TouchableOpacity testID="open-upi-app" onPress={openUpiApp} style={styles.openAppBtn}>
                    <Ionicons name="open-outline" size={18} color={colors.primary} />
                    <Text style={styles.openAppText}>Open UPI App</Text>
                  </TouchableOpacity>

                  <View style={styles.divider} />

                  <H3 style={{ fontSize: 14 }}>After Payment</H3>
                  <Muted style={{ fontSize: 12, marginTop: 2 }}>
                    Enter the UPI Transaction Reference (UTR) shown in your payment confirmation. School will verify and mark the payment as paid.
                  </Muted>
                  <Input
                    testID="utr-input"
                    label="UTR / Transaction Reference"
                    value={utr}
                    onChangeText={(t) => setUtr(t.toUpperCase())}
                    placeholder="e.g. 412834729834"
                    autoCapitalize="characters"
                    containerStyle={{ marginTop: spacing.sm }}
                  />
                  <Button
                    testID="submit-utr"
                    title="I've Paid — Submit for Verification"
                    onPress={submitUtr}
                    loading={submitting}
                  />
                  <Button
                    title="Cancel"
                    variant="ghost"
                    onPress={() => setModalPay(null)}
                    style={{ marginTop: 8 }}
                  />
                </>
              ) : null}
            </Card>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  payTitle: { color: colors.inverse, fontSize: 18, fontWeight: '700' },
  paySub: { color: colors.inverse, opacity: 0.85, marginTop: 4, fontSize: 12 },
  payAmount: { color: colors.golden, fontSize: 24, fontWeight: '700' },
  rejectBox: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: 'rgba(255,255,255,0.15)', paddingHorizontal: 8, paddingVertical: 6,
    borderRadius: radii.sm, marginTop: 8,
  },
  rejectText: { color: colors.inverse, fontSize: 12, flex: 1 },
  awaitCard: { marginBottom: spacing.sm, borderLeftWidth: 4, borderLeftColor: colors.golden },
  awaitBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: colors.blush, paddingHorizontal: 8, paddingVertical: 3,
    borderRadius: radii.pill, marginTop: 4,
  },
  awaitBadgeText: { fontSize: 10, fontWeight: '700', color: colors.golden },
  modalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  amountBox: {
    marginTop: spacing.md, backgroundColor: colors.blush, padding: spacing.md,
    borderRadius: radii.md, alignItems: 'center',
  },
  amountLabel: { fontSize: 11, textTransform: 'uppercase', letterSpacing: 1 },
  amountVal: { fontSize: 28, fontWeight: '700', color: colors.text, marginTop: 4 },
  qrBox: {
    alignItems: 'center', marginTop: spacing.md, padding: spacing.md,
    backgroundColor: colors.surface, borderRadius: radii.md,
    borderWidth: 1, borderColor: colors.border,
  },
  upiIdRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    marginTop: spacing.md, padding: spacing.md,
    backgroundColor: colors.background, borderRadius: radii.md,
    borderWidth: 1, borderColor: colors.border,
  },
  upiIdText: { fontSize: 16, fontWeight: '700', color: colors.text, marginTop: 2 },
  copyBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: colors.blush, paddingHorizontal: 12, paddingVertical: 8,
    borderRadius: radii.pill,
  },
  copyText: { color: colors.primary, fontWeight: '700', fontSize: 12 },
  openAppBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingVertical: 10, marginTop: spacing.sm,
    borderRadius: radii.md, borderWidth: 1, borderColor: colors.primary,
  },
  openAppText: { color: colors.primary, fontWeight: '700', fontSize: 14 },
  divider: { height: 1, backgroundColor: colors.border, marginVertical: spacing.md },
});
