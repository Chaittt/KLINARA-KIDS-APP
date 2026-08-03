import { useCallback, useEffect, useState } from 'react';
import {
  Alert,
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
import { useRouter } from 'expo-router';
import { api } from '../../src/api';
import { Button, Card, H2, H3, Input, Muted } from '../../src/ui';
import { colors, radii, spacing } from '../../src/theme';

type StudentInfo = { name?: string; class_name?: string; parent_phone?: string };
type Pending = {
  id: string;
  student_id: string;
  amount: number;
  description?: string;
  utr?: string;
  submitted_at?: string;
  student: StudentInfo;
};

export default function PaymentVerifications() {
  const router = useRouter();
  const [items, setItems] = useState<Pending[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [rejectFor, setRejectFor] = useState<Pending | null>(null);
  const [reason, setReason] = useState('');

  const load = useCallback(async () => {
    try {
      const list = await api<Pending[]>('/payments/pending-verification');
      setItems(list);
    } catch {}
  }, []);

  useEffect(() => { load(); }, [load]);

  async function onRefresh() { setRefreshing(true); await load(); setRefreshing(false); }

  async function approve(p: Pending) {
    setBusy(p.id);
    try {
      await api(`/payments/${p.id}/verify`, { method: 'POST', body: { approve: true } });
      Alert.alert('Approved', `₹${p.amount.toLocaleString()} confirmed for ${p.student.name}.`);
      await load();
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Failed');
    } finally {
      setBusy(null);
    }
  }

  async function submitReject() {
    if (!rejectFor) return;
    setBusy(rejectFor.id);
    try {
      await api(`/payments/${rejectFor.id}/verify`, {
        method: 'POST',
        body: { approve: false, reason: reason.trim() || 'Verification failed' },
      });
      setRejectFor(null); setReason('');
      await load();
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Failed');
    } finally {
      setBusy(null);
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity testID="pv-back" onPress={() => router.back()} style={styles.iconBtn} hitSlop={10}>
          <Ionicons name="chevron-back" size={22} color={colors.text} />
        </TouchableOpacity>
        <View style={{ flex: 1, marginLeft: spacing.md }}>
          <H2>Verify Payments</H2>
          <Muted style={{ fontSize: 12 }}>{items.length} awaiting verification</Muted>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxl }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      >
        {items.length === 0 ? (
          <Card style={{ alignItems: 'center', paddingVertical: spacing.lg }}>
            <View style={styles.emptyIcon}>
              <Ionicons name="checkmark-circle" size={28} color={colors.success} />
            </View>
            <H3 style={{ marginTop: spacing.md }}>All caught up!</H3>
            <Muted style={{ marginTop: 4, textAlign: 'center' }}>No pending UPI payments to verify.</Muted>
          </Card>
        ) : (
          items.map((p) => (
            <Card key={p.id} style={styles.card} testID={`pv-${p.id}`}>
              <View style={styles.rowTop}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.name}>{p.student.name || 'Unknown Student'}</Text>
                  <Muted style={{ fontSize: 12 }}>
                    {p.student.class_name || '—'} · {p.student.parent_phone || '—'}
                  </Muted>
                </View>
                <Text style={styles.amount}>₹{p.amount.toLocaleString()}</Text>
              </View>

              <View style={styles.utrRow}>
                <View style={{ flex: 1 }}>
                  <Muted style={styles.metaLabel}>UTR / Reference</Muted>
                  <Text style={styles.utrText}>{p.utr || '—'}</Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Muted style={styles.metaLabel}>Submitted</Muted>
                  <Text style={styles.metaVal}>
                    {p.submitted_at ? new Date(p.submitted_at).toLocaleString() : '—'}
                  </Text>
                </View>
              </View>

              <Muted style={{ fontSize: 12, marginTop: 8 }}>{p.description}</Muted>

              <View style={styles.actionRow}>
                <TouchableOpacity
                  testID={`reject-${p.id}`}
                  onPress={() => { setRejectFor(p); setReason(''); }}
                  disabled={busy === p.id}
                  style={[styles.rejectBtn, busy === p.id && { opacity: 0.5 }]}
                >
                  <Ionicons name="close-circle-outline" size={16} color={colors.danger} />
                  <Text style={styles.rejectText}>Reject</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  testID={`approve-${p.id}`}
                  onPress={() => approve(p)}
                  disabled={busy === p.id}
                  style={[styles.approveBtn, busy === p.id && { opacity: 0.7 }]}
                >
                  <Ionicons name="checkmark-circle" size={16} color={colors.inverse} />
                  <Text style={styles.approveText}>{busy === p.id ? 'Working…' : 'Approve'}</Text>
                </TouchableOpacity>
              </View>
            </Card>
          ))
        )}
      </ScrollView>

      {/* Reject modal */}
      <Modal visible={!!rejectFor} animationType="slide" transparent>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalBg}>
          <ScrollView contentContainerStyle={{ padding: spacing.lg }} keyboardShouldPersistTaps="handled">
            <Card>
              <H3>Reject Payment</H3>
              <Muted style={{ marginTop: 4 }}>
                {rejectFor?.student?.name} · ₹{rejectFor?.amount?.toLocaleString()}
              </Muted>
              <Input
                testID="reject-reason"
                label="Reason (visible to parent)"
                value={reason}
                onChangeText={setReason}
                placeholder="e.g. UTR not found in bank statement"
                multiline
                numberOfLines={3}
                style={{ minHeight: 80, textAlignVertical: 'top' } as any}
                containerStyle={{ marginTop: spacing.md }}
              />
              <Button testID="confirm-reject" title="Reject Payment" onPress={submitReject} loading={!!busy} />
              <Button title="Cancel" variant="ghost" onPress={() => setRejectFor(null)} style={{ marginTop: 8 }} />
            </Card>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  iconBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: colors.border,
  },
  card: { marginBottom: spacing.md },
  rowTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  name: { fontSize: 16, fontWeight: '700', color: colors.text },
  amount: { fontSize: 20, fontWeight: '700', color: colors.primary },
  utrRow: {
    flexDirection: 'row', gap: spacing.md, marginTop: spacing.md,
    padding: spacing.md, backgroundColor: colors.background, borderRadius: radii.md,
  },
  metaLabel: { fontSize: 10, textTransform: 'uppercase', letterSpacing: 1 },
  metaVal: { fontSize: 12, color: colors.textSecondary, fontWeight: '600', marginTop: 2 },
  utrText: { fontSize: 15, fontWeight: '700', color: colors.text, marginTop: 2 },
  actionRow: { flexDirection: 'row', gap: 8, marginTop: spacing.md },
  approveBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    backgroundColor: colors.success, paddingVertical: 12, borderRadius: radii.md,
  },
  approveText: { color: colors.inverse, fontWeight: '700' },
  rejectBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingVertical: 12, borderRadius: radii.md,
    borderWidth: 1, borderColor: colors.danger,
  },
  rejectText: { color: colors.danger, fontWeight: '700' },
  emptyIcon: {
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: colors.blush, alignItems: 'center', justifyContent: 'center',
  },
  modalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
});
