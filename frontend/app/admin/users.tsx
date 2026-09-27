import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
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
import * as Clipboard from 'expo-clipboard';
import { api } from '../../src/api';
import { useAuth } from '../../src/auth';
import { Button, Card, H2, H3, Muted } from '../../src/ui';
import { colors, radii, spacing } from '../../src/theme';

type ManagedUser = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  role: 'parent' | 'teacher' | 'admin' | 'md';
  class_name?: string | null;
  active: boolean;
};

const FILTERS: { key: string; label: string; role?: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'parent', label: 'Parents', role: 'parent' },
  { key: 'teacher', label: 'Teachers', role: 'teacher' },
  { key: 'admin', label: 'Admins', role: 'admin' },
  { key: 'md', label: 'MD', role: 'md' },
];

const ROLE_META: Record<string, { icon: any; color: string }> = {
  parent: { icon: 'heart', color: colors.rose },
  teacher: { icon: 'person', color: colors.golden },
  admin: { icon: 'shield-checkmark', color: colors.primary },
  md: { icon: 'star', color: colors.primaryDark },
};

export default function UserManagement() {
  const router = useRouter();
  const { user } = useAuth();
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [filter, setFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selected, setSelected] = useState<ManagedUser | null>(null);
  const [busy, setBusy] = useState(false);
  const [tempPwd, setTempPwd] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const list = await api<ManagedUser[]>('/users');
      setUsers(list);
    } catch {
      // ignore
    } finally {
      setLoading(false);
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

  const visible = users.filter((u) => (filter === 'all' ? true : u.role === filter));

  async function toggleActive(u: ManagedUser) {
    setBusy(true);
    try {
      const updated = await api<ManagedUser>(`/users/${u.id}/status`, {
        method: 'PATCH',
        body: { active: !u.active },
      });
      setUsers((prev) => prev.map((x) => (x.id === u.id ? { ...x, active: updated.active } : x)));
      setSelected((s) => (s ? { ...s, active: updated.active } : s));
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Could not update account');
    } finally {
      setBusy(false);
    }
  }

  async function resetPassword(u: ManagedUser) {
    setBusy(true);
    try {
      const r = await api<{ temp_password: string }>(`/users/${u.id}/reset-password`, { method: 'POST' });
      setTempPwd(r.temp_password);
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Could not reset password');
    } finally {
      setBusy(false);
    }
  }

  async function copyTemp() {
    if (!tempPwd) return;
    await Clipboard.setStringAsync(tempPwd);
    Alert.alert('Copied', 'Temporary password copied. Share it securely with the user.');
  }

  if (user?.role !== 'md') {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.centered}>
          <Ionicons name="lock-closed" size={36} color={colors.textMuted} />
          <H3 style={{ marginTop: spacing.md }}>MD access only</H3>
          <Button title="Go Back" variant="ghost" onPress={() => router.back()} style={{ marginTop: spacing.md }} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity testID="um-back" onPress={() => router.back()} style={styles.iconBtn} hitSlop={10}>
          <Ionicons name="chevron-back" size={22} color={colors.text} />
        </TouchableOpacity>
        <View style={{ flex: 1, marginLeft: spacing.md }}>
          <H2>User Management</H2>
          <Muted style={{ fontSize: 12 }}>Manage logins & account access</Muted>
        </View>
      </View>

      {/* Role filter chips */}
      <View style={styles.chipWrap}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipRow}
        >
          {FILTERS.map((f) => {
            const on = filter === f.key;
            return (
              <TouchableOpacity
                key={f.key}
                testID={`filter-${f.key}`}
                onPress={() => setFilter(f.key)}
                style={[styles.chip, on ? styles.chipOn : styles.chipOff]}
              >
                <Text style={[styles.chipText, on && { color: colors.inverse }]}>{f.label}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: spacing.lg, paddingTop: spacing.sm, paddingBottom: spacing.xxl }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        >
          {visible.length === 0 ? (
            <Card>
              <Muted style={{ textAlign: 'center' }}>No users in this category</Muted>
            </Card>
          ) : (
            visible.map((u) => {
              const meta = ROLE_META[u.role] || ROLE_META.parent;
              const login = u.email || (u.phone ? `+91 ${u.phone}` : '—');
              return (
                <TouchableOpacity
                  key={u.id}
                  testID={`user-${u.id}`}
                  activeOpacity={0.85}
                  onPress={() => { setSelected(u); setTempPwd(null); }}
                >
                  <Card style={[styles.userCard, !u.active && styles.userCardInactive]}>
                    <View style={[styles.avatar, { backgroundColor: `${meta.color}22` }]}>
                      <Ionicons name={meta.icon} size={18} color={meta.color} />
                    </View>
                    <View style={{ flex: 1, marginLeft: spacing.md }}>
                      <Text style={styles.userName}>{u.name}</Text>
                      <Muted style={{ fontSize: 12, marginTop: 2 }}>{login}</Muted>
                      {u.class_name ? <Muted style={{ fontSize: 11, marginTop: 1 }}>Class · {u.class_name}</Muted> : null}
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={styles.roleTag}>{u.role.toUpperCase()}</Text>
                      <View style={[styles.statusBadge, { backgroundColor: u.active ? colors.success + '22' : colors.danger + '22' }]}>
                        <Text style={{ fontSize: 10, fontWeight: '700', color: u.active ? colors.success : colors.danger }}>
                          {u.active ? 'ACTIVE' : 'DISABLED'}
                        </Text>
                      </View>
                    </View>
                  </Card>
                </TouchableOpacity>
              );
            })
          )}
        </ScrollView>
      )}

      {/* Action sheet */}
      <Modal visible={!!selected} animationType="slide" transparent onRequestClose={() => setSelected(null)}>
        <View style={styles.modalBg}>
          <View style={styles.sheet}>
            {selected ? (
              <>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <View style={{ flex: 1 }}>
                    <H3>{selected.name}</H3>
                    <Muted style={{ fontSize: 12, marginTop: 2 }}>
                      {selected.email || (selected.phone ? `+91 ${selected.phone}` : '—')} · {selected.role.toUpperCase()}
                    </Muted>
                  </View>
                  <TouchableOpacity onPress={() => setSelected(null)} hitSlop={10}>
                    <Ionicons name="close" size={24} color={colors.textMuted} />
                  </TouchableOpacity>
                </View>

                {tempPwd ? (
                  <View style={styles.tempBox} testID="temp-pwd-box">
                    <Muted style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 1 }}>Temporary Password</Muted>
                    <Text style={styles.tempPwd}>{tempPwd}</Text>
                    <TouchableOpacity testID="copy-temp-pwd" onPress={copyTemp} style={styles.copyBtn}>
                      <Ionicons name="copy-outline" size={16} color={colors.primary} />
                      <Text style={styles.copyText}>Copy</Text>
                    </TouchableOpacity>
                    <Muted style={{ fontSize: 11, marginTop: spacing.sm, textAlign: 'center' }}>
                      Share securely. The user should change it after signing in.
                    </Muted>
                  </View>
                ) : (
                  <>
                    <TouchableOpacity
                      testID="toggle-active-btn"
                      onPress={() => toggleActive(selected)}
                      disabled={busy || selected.id === user?.id}
                      style={[styles.actionRow, (busy || selected.id === user?.id) && { opacity: 0.5 }]}
                    >
                      <Ionicons
                        name={selected.active ? 'pause-circle-outline' : 'play-circle-outline'}
                        size={22}
                        color={selected.active ? colors.danger : colors.success}
                      />
                      <Text style={styles.actionText}>
                        {selected.active ? 'Deactivate account' : 'Activate account'}
                      </Text>
                    </TouchableOpacity>

                    {selected.role !== 'parent' ? (
                      <TouchableOpacity
                        testID="reset-pwd-btn"
                        onPress={() => resetPassword(selected)}
                        disabled={busy}
                        style={[styles.actionRow, busy && { opacity: 0.5 }]}
                      >
                        <Ionicons name="key-outline" size={22} color={colors.primary} />
                        <Text style={styles.actionText}>Reset password (generate temporary)</Text>
                      </TouchableOpacity>
                    ) : (
                      <View style={styles.infoRow}>
                        <Ionicons name="information-circle-outline" size={18} color={colors.textMuted} />
                        <Muted style={{ flex: 1, fontSize: 12 }}>
                          Parents sign in with phone + OTP — no password to reset.
                        </Muted>
                      </View>
                    )}

                    {selected.id === user?.id ? (
                      <Muted style={{ fontSize: 11, marginTop: spacing.sm }}>
                        You cannot deactivate your own account.
                      </Muted>
                    ) : null}
                  </>
                )}

                <Button
                  title="Done"
                  variant="ghost"
                  onPress={() => setSelected(null)}
                  style={{ marginTop: spacing.md }}
                />
              </>
            ) : null}
          </View>
        </View>
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
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.lg },
  chipWrap: { height: 56, justifyContent: 'center' },
  chipRow: { paddingHorizontal: spacing.lg, gap: spacing.sm, alignItems: 'center' },
  chip: {
    flexShrink: 0, height: 36, paddingHorizontal: 16, borderRadius: radii.pill,
    alignItems: 'center', justifyContent: 'center', borderWidth: 1,
  },
  chipOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipOff: { backgroundColor: colors.surface, borderColor: colors.border },
  chipText: { fontSize: 13, fontWeight: '700', color: colors.textSecondary },
  userCard: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm },
  userCardInactive: { opacity: 0.7 },
  avatar: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  userName: { fontSize: 15, fontWeight: '700', color: colors.text },
  roleTag: { fontSize: 10, fontWeight: '700', color: colors.textMuted, letterSpacing: 0.5 },
  statusBadge: { marginTop: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: radii.pill },
  modalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radii.xl, borderTopRightRadius: radii.xl,
    padding: spacing.lg, paddingBottom: spacing.xl,
  },
  actionRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  actionText: { fontSize: 15, fontWeight: '600', color: colors.text, flex: 1 },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 14 },
  tempBox: {
    marginTop: spacing.md, padding: spacing.lg, borderRadius: radii.md,
    backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border,
    alignItems: 'center',
  },
  tempPwd: { fontSize: 24, fontWeight: '700', color: colors.text, letterSpacing: 2, marginTop: 6 },
  copyBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: spacing.md,
    backgroundColor: colors.blush, paddingHorizontal: 14, paddingVertical: 8, borderRadius: radii.pill,
  },
  copyText: { color: colors.primary, fontWeight: '700', fontSize: 13 },
});
