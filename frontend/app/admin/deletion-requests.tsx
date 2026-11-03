import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
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
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { api } from '../../src/api';
import { useAuth } from '../../src/auth';
import { Button, Card, H2, H3, Input, Muted } from '../../src/ui';
import { colors, radii, spacing } from '../../src/theme';

type Req = {
  id: string;
  source: 'app' | 'web';
  status: 'pending' | 'completed' | 'rejected';
  parent_name: string | null;
  username: string | null;
  phone: string | null;
  child_name: string | null;
  note: string | null;
  reject_reason: string | null;
  matched: boolean;
  created_at: string;
  resolved_at: string | null;
};

const STATUS_COLOR: Record<string, string> = {
  pending: colors.golden,
  completed: colors.success,
  rejected: colors.danger,
};

export default function DeletionRequests() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [items, setItems] = useState<Req[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [action, setAction] = useState<{ req: Req; kind: 'delete' | 'reject' } | null>(null);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [toast, setToast] = useState('');

  const load = useCallback(async () => {
    try {
      setItems(await api<Req[]>('/deletion-requests'));
    } catch {
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  function open(req: Req, kind: 'delete' | 'reject') {
    setAction({ req, kind });
    setReason('');
    setErr('');
  }

  async function confirm() {
    if (!action) return;
    if (action.kind === 'reject' && !reason.trim()) return setErr('Enter a reason for the parent');
    setBusy(true);
    setErr('');
    try {
      if (action.kind === 'delete') {
        await api(`/deletion-requests/${action.req.id}/complete`, { method: 'POST' });
        setToast(`${action.req.parent_name || 'Parent'}'s data was deleted`);
      } else {
        await api(`/deletion-requests/${action.req.id}/reject`, { method: 'POST', body: { reason: reason.trim() } });
        setToast('Request rejected');
      }
      setAction(null);
      await load();
      setTimeout(() => setToast(''), 3000);
    } catch (e: any) {
      setErr(e.message || 'Failed');
    } finally {
      setBusy(false);
    }
  }

  if (user?.role !== 'md') {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.centered}>
          <Ionicons name="lock-closed" size={36} color={colors.textMuted} />
          <H3 style={{ marginTop: spacing.md }}>MD access only</H3>
        </View>
      </SafeAreaView>
    );
  }

  const pending = items.filter((i) => i.status === 'pending').length;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity testID="dr-back" onPress={() => router.back()} style={styles.iconBtn} hitSlop={10}>
          <Ionicons name="chevron-back" size={22} color={colors.text} />
        </TouchableOpacity>
        <View style={{ flex: 1, marginLeft: spacing.md }}>
          <H2>Deletion Requests</H2>
          <Muted style={{ fontSize: 12 }} testID="dr-pending-count">{pending} pending · complete within 30 days</Muted>
        </View>
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: spacing.lg, paddingTop: spacing.sm, paddingBottom: insets.bottom + spacing.lg }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} tintColor={colors.primary} />}
        >
          {items.length === 0 ? (
            <Card testID="dr-empty">
              <Muted style={{ textAlign: 'center' }}>No deletion requests</Muted>
            </Card>
          ) : (
            items.map((r) => (
              <Card key={r.id} style={{ marginBottom: spacing.sm }} testID={`dr-${r.id}`}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.name}>{r.parent_name || 'Parent'}</Text>
                    <Muted style={{ fontSize: 12, marginTop: 2 }}>
                      {r.username ? `@${r.username} · ` : ''}{r.phone ? `+91 ${r.phone}` : ''}
                    </Muted>
                    {r.child_name ? <Muted style={{ fontSize: 12 }}>Child: {r.child_name}</Muted> : null}
                  </View>
                  <View style={[styles.badge, { backgroundColor: STATUS_COLOR[r.status] + '22' }]}>
                    <Text style={[styles.badgeText, { color: STATUS_COLOR[r.status] }]}>{r.status.toUpperCase()}</Text>
                  </View>
                </View>
                <Muted style={{ fontSize: 11, marginTop: 6 }}>
                  {r.source === 'app' ? 'From the app' : 'From the web form'} · {new Date(r.created_at).toLocaleString()}
                </Muted>
                {r.note ? <Text style={styles.note}>“{r.note}”</Text> : null}
                {r.status === 'pending' && !r.matched ? (
                  <View style={styles.warn}>
                    <Ionicons name="alert-circle-outline" size={16} color={colors.danger} />
                    <Text style={styles.warnText}>No parent account matches these details. Verify with the parent or reject.</Text>
                  </View>
                ) : null}
                {r.status === 'rejected' && r.reject_reason ? (
                  <Muted style={{ fontSize: 12, marginTop: 6 }}>Reason: {r.reject_reason}</Muted>
                ) : null}
                {r.status === 'pending' ? (
                  <View style={styles.actions}>
                    <TouchableOpacity testID={`dr-delete-${r.id}`} disabled={!r.matched} onPress={() => open(r, 'delete')} style={[styles.actBtn, styles.actDelete, !r.matched && { opacity: 0.4 }]}>
                      <Ionicons name="trash-outline" size={16} color={colors.inverse} />
                      <Text style={styles.actDeleteText}>Delete data</Text>
                    </TouchableOpacity>
                    <TouchableOpacity testID={`dr-reject-${r.id}`} onPress={() => open(r, 'reject')} style={[styles.actBtn, styles.actReject]}>
                      <Text style={styles.actRejectText}>Reject</Text>
                    </TouchableOpacity>
                  </View>
                ) : null}
              </Card>
            ))
          )}
        </ScrollView>
      )}

      {toast ? (
        <View style={[styles.toast, { bottom: insets.bottom + 16 }]} testID="dr-toast">
          <Ionicons name="checkmark-circle" size={18} color={colors.inverse} />
          <Text style={styles.toastText}>{toast}</Text>
        </View>
      ) : null}

      <Modal visible={!!action} transparent animationType="slide" onRequestClose={() => setAction(null)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalBg}>
          <View style={[styles.sheet, { paddingBottom: insets.bottom + spacing.lg }]} testID="dr-sheet">
            {action?.kind === 'delete' ? (
              <>
                <H3>Permanently delete data?</H3>
                <Muted style={{ marginTop: spacing.sm, lineHeight: 20 }}>
                  This erases {action.req.parent_name}’s login and their children’s profile, photos, attendance, activities,
                  complaints and Elthea results. Fee and payment records are kept for tax law. This can’t be undone.
                </Muted>
              </>
            ) : (
              <>
                <H3>Reject request</H3>
                <Input
                  testID="dr-reject-reason"
                  label="Reason (shown to the parent)"
                  value={reason}
                  onChangeText={setReason}
                  placeholder="e.g. Could not verify identity, please call the office"
                  containerStyle={{ marginTop: spacing.md }}
                />
              </>
            )}
            {err ? <Text style={styles.err}>{err}</Text> : null}
            <Button
              testID="dr-confirm"
              title={action?.kind === 'delete' ? 'Delete data' : 'Reject request'}
              onPress={confirm}
              loading={busy}
              style={{ marginTop: spacing.md, ...(action?.kind === 'delete' ? { backgroundColor: colors.danger } : {}) }}
            />
            <Button testID="dr-cancel" title="Cancel" variant="ghost" onPress={() => setAction(null)} style={{ marginTop: spacing.sm }} />
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  iconBtn: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: colors.surface,
    alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.border,
  },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.lg },
  name: { fontSize: 15, fontWeight: '700', color: colors.text },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: radii.pill },
  badgeText: { fontSize: 10, fontWeight: '700' },
  note: { fontSize: 13, color: colors.textSecondary, marginTop: 6, fontStyle: 'italic' },
  warn: { flexDirection: 'row', gap: 6, alignItems: 'flex-start', marginTop: spacing.sm },
  warnText: { flex: 1, fontSize: 12, color: colors.danger },
  actions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  actBtn: { flex: 1, minHeight: 44, borderRadius: radii.pill, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 6 },
  actDelete: { backgroundColor: colors.danger },
  actDeleteText: { color: colors.inverse, fontWeight: '700', fontSize: 14 },
  actReject: { borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  actRejectText: { color: colors.text, fontWeight: '700', fontSize: 14 },
  modalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: colors.surface, borderTopLeftRadius: radii.xl, borderTopRightRadius: radii.xl, padding: spacing.lg },
  err: { color: colors.danger, fontSize: 13, marginTop: spacing.sm },
  toast: {
    position: 'absolute', left: spacing.lg, right: spacing.lg, flexDirection: 'row', gap: 8, alignItems: 'center',
    backgroundColor: colors.primaryDark, padding: 14, borderRadius: radii.md,
  },
  toastText: { color: colors.inverse, fontWeight: '600', flex: 1 },
});
