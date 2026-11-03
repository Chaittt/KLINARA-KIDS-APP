import { useRouter } from 'expo-router';
import { useEffect, useState, useCallback } from 'react';
import { Linking, Modal, ScrollView, StyleSheet, Switch, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../../src/api';
import { useAuth } from '../../src/auth';
import { Button, Card, H2, H3, Muted } from '../../src/ui';
import { GrowRadarChart } from '../../src/charts';
import { colors, radii, spacing } from '../../src/theme';
import { PRIVACY_URL } from '../../src/components/PrivacyConsent';

type DeletionRequest = { id: string; status: 'pending' | 'completed' | 'rejected'; reject_reason?: string | null; created_at: string };

type Student = {
  id: string;
  name: string;
  class_name: string;
  age?: number;
  elthea_grow?: { G: number; R: number; O: number; W: number } | null;
  elthea_archetype_name?: string | null;
  elthea_archetype_description?: string | null;
  elthea_last_assessed_at?: string | null;
};

export default function ParentProfile() {
  const router = useRouter();
  const { user, logout, refreshUser } = useAuth();
  const [student, setStudent] = useState<Student | null>(null);
  const [delReq, setDelReq] = useState<DeletionRequest | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [eltheaSaving, setEltheaSaving] = useState(false);
  const [msg, setMsg] = useState('');

  const load = useCallback(async () => {
    try {
      const s = (await api<Student[]>('/students'))[0];
      setStudent(s || null);
    } catch {}
    try {
      setDelReq(await api<DeletionRequest | null>('/me/deletion-request'));
    } catch {}
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  async function toggleElthea(v: boolean) {
    setEltheaSaving(true);
    setMsg('');
    try {
      await api('/me/consent', { method: 'POST', body: { elthea: v } });
      await refreshUser();
    } catch (e: any) {
      setMsg(e.message || 'Could not update');
    } finally {
      setEltheaSaving(false);
    }
  }

  async function requestDeletion() {
    setDeleting(true);
    try {
      setDelReq(await api<DeletionRequest>('/me/deletion-request', { method: 'POST', body: {} }));
      setConfirmDelete(false);
    } catch (e: any) {
      setMsg(e.message || 'Could not send request');
      setConfirmDelete(false);
    } finally {
      setDeleting(false);
    }
  }

  const canAssess = !!user?.elthea_consent;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxl }}>
        <H2>Profile</H2>

        <Card style={{ marginTop: spacing.md, marginBottom: spacing.md }}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <View style={styles.avatar}>
              <Ionicons name="person" size={28} color={colors.inverse} />
            </View>
            <View style={{ marginLeft: spacing.md, flex: 1 }}>
              <H3>{user?.name}</H3>
              <Muted style={{ marginTop: 2 }}>+91 {user?.phone}</Muted>
            </View>
          </View>
        </Card>

        {student ? (
          <Card style={{ marginBottom: spacing.md }} testID="student-info-card">
            <H3>Child Profile</H3>
            <View style={{ marginTop: spacing.sm, gap: 8 }}>
              <Row icon="person" label="Name" value={student.name} />
              <Row icon="school" label="Class" value={student.class_name} />
              {student.age ? <Row icon="happy" label="Age" value={`${student.age} years`} /> : null}
            </View>
          </Card>
        ) : null}

        {student?.elthea_grow ? (
          <Card style={{ marginBottom: spacing.md }} testID="elthea-card">
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <H3>Elthea GROW Profile</H3>
              <Ionicons name="sparkles" color={colors.golden} size={20} />
            </View>
            <Muted style={{ marginTop: 4 }}>
              Last assessed{' '}
              {student.elthea_last_assessed_at
                ? new Date(student.elthea_last_assessed_at).toLocaleDateString()
                : '—'}
            </Muted>
            <View style={{ alignItems: 'center', marginTop: spacing.md }}>
              <GrowRadarChart scores={student.elthea_grow} size={260} />
            </View>
            <View style={styles.archetypeBox}>
              <Text style={styles.archetypeLabel}>Archetype</Text>
              <Text style={styles.archetypeName}>{student.elthea_archetype_name}</Text>
              <Text style={styles.archetypeDesc}>{student.elthea_archetype_description}</Text>
            </View>
            {canAssess ? (
              <Button
                testID="reassess-btn"
                title="Re-assess"
                variant="outline"
                onPress={() => router.push({ pathname: '/parent/elthea', params: { student_id: student.id } })}
                style={{ marginTop: spacing.md }}
              />
            ) : null}
          </Card>
        ) : student && canAssess ? (
          <Card style={{ alignItems: 'center', marginBottom: spacing.md }}>
            <Ionicons name="sparkles" size={32} color={colors.golden} />
            <H3 style={{ marginTop: 8 }}>Elthea AI Assessment</H3>
            <Muted style={{ textAlign: 'center', marginTop: 6 }}>
              Discover your child's developmental archetype with the GROW framework.
            </Muted>
            <Button
              testID="start-assessment"
              title="Start Assessment"
              onPress={() => router.push({ pathname: '/parent/elthea', params: { student_id: student.id } })}
              style={{ marginTop: spacing.md, alignSelf: 'stretch' }}
            />
          </Card>
        ) : null}

        {/* Privacy & consent */}
        <Card style={{ marginBottom: spacing.md }} testID="privacy-card">
          <H3>Privacy</H3>
          <View style={styles.switchRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.switchTitle}>Elthea AI assessment</Text>
              <Muted style={{ fontSize: 12, marginTop: 2 }}>
                Optional third-party GROW check. Turn off to stop new assessments.
              </Muted>
            </View>
            <Switch
              testID="profile-elthea-switch"
              value={!!user?.elthea_consent}
              disabled={eltheaSaving}
              onValueChange={toggleElthea}
              trackColor={{ true: colors.primary, false: colors.textMuted }}
              thumbColor={colors.inverse}
            />
          </View>
          {user?.privacy_consent_at ? (
            <Muted style={{ fontSize: 12, marginTop: spacing.sm }} testID="consent-date">
              Privacy notice accepted on {new Date(user.privacy_consent_at).toLocaleDateString()}
            </Muted>
          ) : null}
          <TouchableOpacity testID="open-privacy-policy" onPress={() => Linking.openURL(PRIVACY_URL)} style={styles.linkRow}>
            <Ionicons name="document-text-outline" size={18} color={colors.primary} />
            <Text style={styles.linkText}>Privacy policy</Text>
            <Ionicons name="open-outline" size={16} color={colors.textMuted} />
          </TouchableOpacity>
          {msg ? <Text style={styles.err}>{msg}</Text> : null}
        </Card>

        {/* Account deletion */}
        <Card style={{ marginBottom: spacing.md }} testID="delete-account-card">
          <H3>Delete my account</H3>
          {delReq?.status === 'pending' ? (
            <View style={styles.statusBox} testID="deletion-pending">
              <Ionicons name="time-outline" size={18} color={colors.golden} />
              <Text style={styles.statusText}>
                Request received on {new Date(delReq.created_at).toLocaleDateString()}. The school will complete it within 30 days.
              </Text>
            </View>
          ) : (
            <>
              {delReq?.status === 'rejected' ? (
                <Muted style={{ fontSize: 12, marginTop: 6 }} testID="deletion-rejected">
                  Your last request was not completed: {delReq.reject_reason}
                </Muted>
              ) : null}
              <Muted style={{ fontSize: 13, marginTop: 6 }}>
                Permanently erase your login and your child’s app data (profile, photos, attendance, Elthea results).
              </Muted>
              <TouchableOpacity testID="delete-account-btn" onPress={() => setConfirmDelete(true)} style={styles.deleteBtn}>
                <Ionicons name="trash-outline" size={18} color={colors.danger} />
                <Text style={styles.deleteText}>Delete my account</Text>
              </TouchableOpacity>
            </>
          )}
        </Card>

        <Button
          title="Logout"
          variant="outline"
          onPress={logout}
          testID="logout-btn"
          style={{ marginTop: spacing.md }}
        />
      </ScrollView>

      <Modal visible={confirmDelete} transparent animationType="slide" onRequestClose={() => setConfirmDelete(false)}>
        <View style={styles.modalBg}>
          <View style={styles.sheet} testID="delete-confirm-sheet">
            <H3>Delete your account?</H3>
            <Muted style={{ marginTop: spacing.sm, lineHeight: 20 }}>
              The school will permanently erase your parent login and your child’s profile, photos, attendance,
              activities, complaints and Elthea results within 30 days. Fee and payment records are kept, as Indian tax
              law requires. This can’t be undone.
            </Muted>
            <Button
              testID="confirm-delete-account"
              title="Yes, request deletion"
              onPress={requestDeletion}
              loading={deleting}
              style={{ marginTop: spacing.lg, backgroundColor: colors.danger }}
            />
            <Button testID="cancel-delete-account" title="Cancel" variant="ghost" onPress={() => setConfirmDelete(false)} style={{ marginTop: spacing.sm }} />
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function Row({ icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
      <Ionicons name={icon} size={16} color={colors.textMuted} style={{ width: 22 }} />
      <Text style={{ color: colors.textSecondary, fontSize: 13, width: 70 }}>{label}</Text>
      <Text style={{ color: colors.text, fontSize: 14, fontWeight: '600', flex: 1 }}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  archetypeBox: {
    marginTop: spacing.md,
    padding: spacing.md,
    backgroundColor: colors.background,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  archetypeLabel: {
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  archetypeName: {
    fontFamily: 'Georgia',
    fontSize: 22,
    fontWeight: '700',
    color: colors.primary,
    marginTop: 4,
  },
  archetypeDesc: { color: colors.text, fontSize: 14, marginTop: 6, lineHeight: 20 },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginTop: spacing.sm },
  switchTitle: { fontSize: 15, fontWeight: '700', color: colors.text },
  linkRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: spacing.md, minHeight: 44,
    borderTopWidth: 1, borderTopColor: colors.border,
  },
  linkText: { flex: 1, color: colors.primary, fontWeight: '700', fontSize: 14 },
  err: { color: colors.danger, fontSize: 13, marginTop: spacing.sm },
  statusBox: {
    flexDirection: 'row', gap: 8, alignItems: 'flex-start', marginTop: spacing.sm,
    padding: 12, borderRadius: radii.md, backgroundColor: colors.golden + '22',
  },
  statusText: { flex: 1, fontSize: 13, color: colors.text, lineHeight: 19 },
  deleteBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: spacing.md,
    minHeight: 48, borderRadius: radii.pill, borderWidth: 1, borderColor: colors.danger + '66',
    backgroundColor: colors.danger + '10',
  },
  deleteText: { color: colors.danger, fontWeight: '700', fontSize: 15 },
  modalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.surface, borderTopLeftRadius: radii.xl, borderTopRightRadius: radii.xl,
    padding: spacing.lg, paddingBottom: spacing.xl,
  },
});
