import { useEffect, useState, useCallback } from 'react';
import { Alert, KeyboardAvoidingView, Modal, Platform, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { api } from '../../src/api';
import { useAuth } from '../../src/auth';
import { Button, Card, H2, H3, Input, Muted } from '../../src/ui';
import { colors, radii, spacing } from '../../src/theme';
import { AddStudentModal } from '../../src/components/StudentForm';

type FeeItem = { class_name: string; monthly_amount: number };
type Salary = { user: any; monthly_amount: number | null; currency: string };
type EventItem = { id: string; title: string; description: string; date: string };
type ClassOcc = { class_name: string; count: number };
type Curriculum = { class_name: string; year_label: string; content: string };
type AdminUser = { id: string; name: string; email: string };
type TeacherUser = { id: string; name: string; email: string; class_name?: string };

const CLASSES = ['Playgroup', 'Nursery', 'LKG', 'UKG', 'Sunshine'];

export default function AdminSetup() {
  const { user } = useAuth();
  const router = useRouter();
  const isMD = user?.role === 'md';

  const [fees, setFees] = useState<FeeItem[]>([]);
  const [salaries, setSalaries] = useState<Salary[]>([]);
  const [events, setEvents] = useState<EventItem[]>([]);
  const [occ, setOcc] = useState<ClassOcc[]>([]);
  const [curricula, setCurricula] = useState<Curriculum[]>([]);
  const [admins, setAdmins] = useState<AdminUser[]>([]);
  const [teachers, setTeachers] = useState<TeacherUser[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  // Modals
  const [feeModal, setFeeModal] = useState<FeeItem | null>(null);
  const [feeVal, setFeeVal] = useState('');
  const [salModal, setSalModal] = useState<Salary | null>(null);
  const [salVal, setSalVal] = useState('');
  const [evModal, setEvModal] = useState(false);
  const [evTitle, setEvTitle] = useState(''); const [evDesc, setEvDesc] = useState(''); const [evDate, setEvDate] = useState('');
  const [curModal, setCurModal] = useState<Curriculum | null>(null);
  const [curYear, setCurYear] = useState(''); const [curContent, setCurContent] = useState('');

  const [staffModal, setStaffModal] = useState<null | 'teacher' | 'admin'>(null);
  const [showAddStudent, setShowAddStudent] = useState(false);
  const [sName, setSName] = useState('');
  const [sEmail, setSEmail] = useState('');
  const [sPwd, setSPwd] = useState('');
  const [sClass, setSClass] = useState('');
  const [saving, setSaving] = useState(false);

  const [upiId, setUpiId] = useState('');
  const [upiName, setUpiName] = useState('');
  const [upiModal, setUpiModal] = useState(false);
  const [savingUpi, setSavingUpi] = useState(false);

  const load = useCallback(async () => {
    const r = await Promise.allSettled([
      api<FeeItem[]>('/fee-structure'),
      api<Salary[]>('/salaries'),
      api<EventItem[]>('/events/this-week'),
      api<ClassOcc[]>('/stats/class-occupancy'),
      api<Curriculum[]>('/curriculum'),
      api<AdminUser[]>('/admins'),
      api<TeacherUser[]>('/teachers'),
      api<{ upi_id: string; upi_name: string }>('/settings/upi'),
    ]);
    if (r[0].status === 'fulfilled') setFees(r[0].value);
    if (r[1].status === 'fulfilled') setSalaries(r[1].value);
    if (r[2].status === 'fulfilled') setEvents(r[2].value);
    if (r[3].status === 'fulfilled') setOcc(r[3].value);
    if (r[4].status === 'fulfilled') setCurricula(r[4].value);
    if (r[5].status === 'fulfilled') setAdmins(r[5].value);
    if (r[6].status === 'fulfilled') setTeachers(r[6].value);
    if (r[7].status === 'fulfilled') { setUpiId(r[7].value.upi_id); setUpiName(r[7].value.upi_name); }
  }, []);
  useEffect(() => { load(); }, [load]);

  async function onRefresh() { setRefreshing(true); await load(); setRefreshing(false); }

  async function saveFee() {
    if (!feeModal) return;
    const amt = parseFloat(feeVal);
    if (isNaN(amt) || amt < 0) return Alert.alert('Invalid amount');
    try {
      await api(`/fee-structure/${feeModal.class_name}`, { method: 'PUT', body: { monthly_amount: amt } });
      setFeeModal(null); await load();
    } catch (e: any) { Alert.alert('Error', e.message); }
  }

  async function saveSalary() {
    if (!salModal) return;
    const amt = parseFloat(salVal);
    if (isNaN(amt) || amt < 0) return Alert.alert('Invalid amount');
    try {
      await api(`/salaries/${salModal.user.id}`, { method: 'PUT', body: { monthly_amount: amt, currency: 'INR' } });
      setSalModal(null); await load();
    } catch (e: any) { Alert.alert('Error', e.message); }
  }

  async function saveEvent() {
    if (!evTitle || !evDate) return Alert.alert('Title and date required');
    try {
      await api('/events', { method: 'POST', body: { title: evTitle, description: evDesc, date: evDate } });
      setEvModal(false); setEvTitle(''); setEvDesc(''); setEvDate(''); await load();
    } catch (e: any) { Alert.alert('Error', e.message); }
  }

  async function saveCurriculum() {
    if (!curModal) return;
    if (!curYear.trim()) return Alert.alert('Year required', 'e.g. 2026-27');
    try {
      await api(`/curriculum/${curModal.class_name}`, { method: 'PUT', body: { year_label: curYear.trim(), content: curContent } });
      setCurModal(null); await load();
    } catch (e: any) { Alert.alert('Error', e.message); }
  }

  function resetStaffForm() { setSName(''); setSEmail(''); setSPwd(''); setSClass(''); }

  async function saveUpi() {
    if (!upiId.includes('@') || upiId.length < 5) return Alert.alert('Invalid UPI ID', 'Should look like name@bank');
    setSavingUpi(true);
    try {
      await api('/settings/upi', { method: 'PUT', body: { upi_id: upiId.trim(), upi_name: upiName.trim() || 'Klinara Kids' } });
      setUpiModal(false);
      Alert.alert('Saved', 'UPI details updated. Parents will use these for fee payments.');
      await load();
    } catch (e: any) { Alert.alert('Error', e?.message || 'Failed'); } finally { setSavingUpi(false); }
  }

  async function saveStaff() {
    if (!staffModal) return;
    setSaving(true);
    try {
      if (staffModal === 'teacher') {
        if (!sName.trim() || !sEmail.includes('@') || sPwd.length < 6) throw new Error('Name, valid email, password (6+) required');
        await api('/teachers', { method: 'POST', body: { name: sName.trim(), email: sEmail.toLowerCase().trim(), password: sPwd, class_name: sClass || null } });
      } else {
        if (!sName.trim() || !sEmail.includes('@') || sPwd.length < 6) throw new Error('Name, valid email, password (6+) required');
        await api('/admins', { method: 'POST', body: { name: sName.trim(), email: sEmail.toLowerCase().trim(), password: sPwd } });
      }
      Alert.alert('Success', 'Account created. Share credentials with the user.');
      setStaffModal(null); resetStaffForm(); await load();
    } catch (e: any) { Alert.alert('Error', e.message || 'Failed'); } finally { setSaving(false); }
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxl }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}>
        <H2>Setup</H2>
        <Muted style={{ marginBottom: spacing.md }}>{isMD ? 'Manage school configuration & credentials' : 'Manage curriculum, staff attendance & events'}</Muted>

        {/* Quick actions */}
        <View style={{ flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md }}>
          <QuickAction icon="clipboard" label={'Mark Staff\nAttendance'} onPress={() => router.push('/admin/staff-attendance')} testID="qa-staff-attn" />
          <QuickAction icon="megaphone" label={'Post\nAnnouncement'} onPress={() => router.push('/admin/announcements')} testID="qa-announce" />
        </View>

        {/* Class Occupancy */}
        <Card style={{ marginBottom: spacing.md }} testID="class-occupancy">
          <H3>Class Strength</H3>
          {occ.length === 0 ? <Muted style={{ marginTop: 8 }}>No students yet</Muted> :
            occ.map((c) => (
              <View key={c.class_name} style={styles.row}>
                <Text style={styles.rowLabel}>{c.class_name}</Text>
                <View style={styles.chip}><Text style={styles.chipText}>{c.count} {c.count === 1 ? 'student' : 'students'}</Text></View>
              </View>
            ))}
        </Card>

        {/* Curriculum (admin + MD) */}
        <Card style={{ marginBottom: spacing.md }} testID="curriculum-card">
          <H3>Curriculum</H3>
          <Muted style={{ marginTop: 4 }}>Manage yearly curriculum per class</Muted>
          {CLASSES.map((cls) => {
            const item = curricula.find((c) => c.class_name === cls);
            return (
              <TouchableOpacity key={cls} style={styles.row} testID={`cur-${cls}`}
                onPress={() => {
                  const i: Curriculum = item || { class_name: cls, year_label: '2026-27', content: '' };
                  setCurModal(i); setCurYear(i.year_label || '2026-27'); setCurContent(i.content || '');
                }}>
                <Text style={styles.rowLabel}>{cls}</Text>
                <Text style={styles.rowValue} numberOfLines={1}>
                  {item?.content ? `${item.year_label} · Set` : 'Configure'}
                </Text>
                <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
              </TouchableOpacity>
            );
          })}
        </Card>

        {/* Events */}
        <Card style={{ marginBottom: spacing.md }} testID="events-card">
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <H3>Events This Week</H3>
            <TouchableOpacity testID="add-event" onPress={() => setEvModal(true)} style={styles.smallBtn}>
              <Ionicons name="add" size={16} color={colors.inverse} />
              <Text style={{ color: colors.inverse, fontWeight: '700', fontSize: 12 }}>Add</Text>
            </TouchableOpacity>
          </View>
          {events.length === 0 ? <Muted style={{ marginTop: 8 }}>No events</Muted> :
            events.map((e) => (
              <View key={e.id} style={styles.row}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.rowLabel}>{e.title}</Text>
                  <Muted style={{ fontSize: 11 }}>{e.date} · {e.description}</Muted>
                </View>
              </View>
            ))}
        </Card>

        {/* Admin: Add Student only */}
        {!isMD ? (
          <Card style={{ marginBottom: spacing.md }} testID="students-card">
            <H3>Students</H3>
            <Muted style={{ marginTop: 4, marginBottom: 8 }}>Register a new student and create the parent&apos;s login</Muted>
            <Button testID="btn-add-student" title="+ Add Student" onPress={() => setShowAddStudent(true)} />
          </Card>
        ) : null}

        {/* MD-only: Staff & Students */}
        {isMD ? (
          <Card style={{ marginBottom: spacing.md }} testID="staff-mgmt-card">
            <H3>Staff & Students</H3>
            <Muted style={{ marginTop: 4, marginBottom: 8 }}>Create accounts — credentials controlled by MD</Muted>
            <TouchableOpacity testID="open-user-management" onPress={() => router.push('/admin/users')} style={styles.manageRow}>
              <Ionicons name="people-circle-outline" size={22} color={colors.primary} />
              <View style={{ flex: 1 }}>
                <Text style={styles.rowLabel}>User & Login Management</Text>
                <Muted style={{ fontSize: 11 }}>Activate, deactivate & reset credentials</Muted>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
            </TouchableOpacity>
            <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
              <Button testID="btn-add-teacher" title="+ Add Teacher" onPress={() => { resetStaffForm(); setStaffModal('teacher'); }} style={{ flex: 1, minWidth: 140 }} />
              <Button testID="btn-add-admin" title="+ Add Admin" variant="secondary" onPress={() => { resetStaffForm(); setStaffModal('admin'); }} style={{ flex: 1, minWidth: 140 }} />
            </View>
            <Button testID="btn-add-student" title="+ Add Student" onPress={() => setShowAddStudent(true)} style={{ marginTop: 8 }} />

            <View style={styles.divider} />
            <Muted style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>Existing Admins ({admins.length})</Muted>
            {admins.length === 0 ? <Muted style={{ fontSize: 12 }}>None</Muted> : admins.map((a) => (
              <View key={a.id} style={styles.miniRow}>
                <Ionicons name="shield-checkmark-outline" size={16} color={colors.primary} />
                <Text style={styles.miniText}>{a.name}</Text>
                <Muted style={{ fontSize: 11 }}>{a.email}</Muted>
              </View>
            ))}
            <View style={styles.divider} />
            <Muted style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>Existing Teachers ({teachers.length})</Muted>
            {teachers.length === 0 ? <Muted style={{ fontSize: 12 }}>None</Muted> : teachers.map((t) => (
              <View key={t.id} style={styles.miniRow}>
                <Ionicons name="person-outline" size={16} color={colors.golden} />
                <Text style={styles.miniText}>{t.name}</Text>
                <Muted style={{ fontSize: 11 }}>{t.class_name || t.email}</Muted>
              </View>
            ))}
          </Card>
        ) : null}

        {/* Fee Structure — MD only */}
        {isMD ? (
          <Card style={{ marginBottom: spacing.md }} testID="upi-settings-card">
            <H3>UPI Payment Settings</H3>
            <Muted style={{ marginTop: 4 }}>Parents will pay to this UPI ID for fees</Muted>
            <View style={styles.upiRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.upiIdText}>{upiId || 'Not set'}</Text>
                <Muted style={{ fontSize: 11 }}>{upiName || 'Klinara Kids'}</Muted>
              </View>
              <TouchableOpacity testID="edit-upi" onPress={() => setUpiModal(true)} style={styles.smallBtn}>
                <Ionicons name="pencil" size={14} color={colors.inverse} />
                <Text style={{ color: colors.inverse, fontWeight: '700', fontSize: 12 }}>Edit</Text>
              </TouchableOpacity>
            </View>
          </Card>
        ) : null}

        {/* Fee Structure — MD only */}
        {isMD ? (
          <Card style={{ marginBottom: spacing.md }} testID="fee-structure-card">
            <H3>Fee Structure</H3>
            <Muted style={{ marginTop: 4 }}>Monthly amount per class</Muted>
            {CLASSES.map((cls) => {
              const item = fees.find((f) => f.class_name === cls);
              return (
                <TouchableOpacity key={cls} style={styles.row} testID={`fee-${cls}`}
                  onPress={() => { setFeeModal({ class_name: cls, monthly_amount: item?.monthly_amount || 0 }); setFeeVal(String(item?.monthly_amount || '')); }}>
                  <Text style={styles.rowLabel}>{cls}</Text>
                  <Text style={styles.rowValue}>{item ? `₹${item.monthly_amount.toLocaleString()}` : 'Set'}</Text>
                  <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
                </TouchableOpacity>
              );
            })}
          </Card>
        ) : null}

        {/* Staff Salaries (MD only) */}
        {isMD ? (
          <Card style={{ marginBottom: spacing.md }} testID="salaries-card">
            <H3>Staff Salaries</H3>
            <Muted style={{ marginTop: 4 }}>Tap to edit monthly salary</Muted>
            {salaries.length === 0 ? <Muted style={{ marginTop: 8 }}>Loading…</Muted> :
              salaries.map((s) => (
                <TouchableOpacity key={s.user.id} style={styles.row} testID={`sal-${s.user.id}`}
                  onPress={() => { setSalModal(s); setSalVal(String(s.monthly_amount || '')); }}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.rowLabel}>{s.user.name}</Text>
                    <Muted style={{ fontSize: 11 }}>{s.user.role.toUpperCase()}</Muted>
                  </View>
                  <Text style={styles.rowValue}>{s.monthly_amount ? `₹${s.monthly_amount.toLocaleString()}` : 'Set'}</Text>
                  <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
                </TouchableOpacity>
              ))}
          </Card>
        ) : null}
      </ScrollView>

      {/* Fee modal */}
      <Modal visible={!!feeModal} animationType="slide" transparent>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalBg}>
          <View style={{ padding: spacing.lg }}>
            <Card>
              <H3>{feeModal?.class_name} — Monthly Fee</H3>
              <Input testID="fee-input" label="Amount (₹)" keyboardType="number-pad" value={feeVal} onChangeText={setFeeVal} containerStyle={{ marginTop: spacing.md }} />
              <Button testID="save-fee" title="Save" onPress={saveFee} />
              <Button title="Cancel" variant="ghost" onPress={() => setFeeModal(null)} style={{ marginTop: 8 }} />
            </Card>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Salary modal */}
      <Modal visible={!!salModal} animationType="slide" transparent>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalBg}>
          <View style={{ padding: spacing.lg }}>
            <Card>
              <H3>{salModal?.user?.name} — Salary</H3>
              <Muted>{salModal?.user?.role?.toUpperCase()}</Muted>
              <Input testID="sal-input" label="Monthly Amount (₹)" keyboardType="number-pad" value={salVal} onChangeText={setSalVal} containerStyle={{ marginTop: spacing.md }} />
              <Button testID="save-sal" title="Save" onPress={saveSalary} />
              <Button title="Cancel" variant="ghost" onPress={() => setSalModal(null)} style={{ marginTop: 8 }} />
            </Card>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Event modal */}
      <Modal visible={evModal} animationType="slide" transparent>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalBg}>
          <ScrollView contentContainerStyle={{ padding: spacing.lg }} keyboardShouldPersistTaps="handled">
            <Card>
              <H3>New Event</H3>
              <Input testID="ev-title" label="Title" value={evTitle} onChangeText={setEvTitle} containerStyle={{ marginTop: spacing.md }} />
              <Input testID="ev-date" label="Date (YYYY-MM-DD)" value={evDate} onChangeText={setEvDate} />
              <Input testID="ev-desc" label="Description" value={evDesc} onChangeText={setEvDesc} multiline numberOfLines={3} style={{ minHeight: 80, textAlignVertical: 'top' } as any} />
              <Button testID="save-event" title="Add Event" onPress={saveEvent} />
              <Button title="Cancel" variant="ghost" onPress={() => setEvModal(false)} style={{ marginTop: 8 }} />
            </Card>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>

      {/* Curriculum modal */}
      <Modal visible={!!curModal} animationType="slide" transparent>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalBg}>
          <ScrollView contentContainerStyle={{ padding: spacing.lg }} keyboardShouldPersistTaps="handled">
            <Card>
              <H3>{curModal?.class_name} — Curriculum</H3>
              <Input testID="cur-year" label="Academic Year" value={curYear} onChangeText={setCurYear} placeholder="2026-27" containerStyle={{ marginTop: spacing.md }} />
              <Input
                testID="cur-content"
                label="Curriculum Details"
                value={curContent}
                onChangeText={setCurContent}
                multiline
                numberOfLines={8}
                placeholder="Describe the topics, themes, learning outcomes, term-wise plan, etc."
                style={{ minHeight: 160, textAlignVertical: 'top' } as any}
              />
              <Button testID="save-cur" title="Save Curriculum" onPress={saveCurriculum} />
              <Button title="Cancel" variant="ghost" onPress={() => setCurModal(null)} style={{ marginTop: 8 }} />
            </Card>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>

      {/* Shared Add Student form (MD + Admin) */}
      <AddStudentModal visible={showAddStudent} onClose={() => setShowAddStudent(false)} onSaved={load} />

      {/* Staff modal (MD only) */}
      <Modal visible={!!staffModal} animationType="slide" transparent>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalBg}>
          <ScrollView contentContainerStyle={{ padding: spacing.lg }} keyboardShouldPersistTaps="handled">
            <Card>
              <H3>{staffModal === 'teacher' ? 'Add Teacher' : 'Add Admin'}</H3>
              <Muted style={{ marginTop: 4 }}>The staff member will log in using this email + password.</Muted>
              <Input testID="s-name" label="Full Name" value={sName} onChangeText={setSName} containerStyle={{ marginTop: spacing.md }} />
              <Input testID="s-email" label="Email" value={sEmail} onChangeText={setSEmail} keyboardType="email-address" autoCapitalize="none" />
              <Input testID="s-pwd" label="Password (min 6)" value={sPwd} onChangeText={setSPwd} secureTextEntry />
              {staffModal === 'teacher' ? (
                <Input testID="s-class" label="Class (optional)" value={sClass} onChangeText={setSClass} placeholder="e.g. Sunshine" />
              ) : null}
              <Button testID="save-staff" title="Create" onPress={saveStaff} loading={saving} />
              <Button title="Cancel" variant="ghost" onPress={() => { setStaffModal(null); resetStaffForm(); }} style={{ marginTop: 8 }} />
            </Card>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>

      {/* UPI Settings modal */}
      <Modal visible={upiModal} animationType="slide" transparent>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalBg}>
          <ScrollView contentContainerStyle={{ padding: spacing.lg }} keyboardShouldPersistTaps="handled">
            <Card>
              <H3>UPI Payment Settings</H3>
              <Muted style={{ marginTop: 4 }}>Parents will scan a QR / see this ID when paying school fees.</Muted>
              <Input
                testID="upi-id-input"
                label="UPI ID"
                value={upiId}
                onChangeText={setUpiId}
                autoCapitalize="none"
                placeholder="e.g. klinarakids@upi"
                containerStyle={{ marginTop: spacing.md }}
              />
              <Input
                testID="upi-name-input"
                label="Payee Name"
                value={upiName}
                onChangeText={setUpiName}
                placeholder="Klinara Kids"
              />
              <Button testID="save-upi" title="Save UPI Details" onPress={saveUpi} loading={savingUpi} />
              <Button title="Cancel" variant="ghost" onPress={() => setUpiModal(false)} style={{ marginTop: 8 }} />
            </Card>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

function QuickAction({ icon, label, onPress, testID }: { icon: any; label: string; onPress: () => void; testID?: string }) {
  return (
    <TouchableOpacity activeOpacity={0.85} onPress={onPress} testID={testID} style={styles.qa}>
      <Ionicons name={icon} size={22} color={colors.primary} />
      <Text style={styles.qaText}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  row: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: 12, gap: 8,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  rowLabel: { flex: 1, fontSize: 15, fontWeight: '600', color: colors.text },
  rowValue: { fontSize: 14, color: colors.textSecondary, fontWeight: '600', maxWidth: 160 },
  chip: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: radii.pill, backgroundColor: colors.blush },
  chipText: { fontSize: 12, fontWeight: '600', color: colors.text },
  smallBtn: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: colors.primary,
    paddingHorizontal: 10, paddingVertical: 6, borderRadius: radii.pill, gap: 4,
  },
  modalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  divider: { height: 1, backgroundColor: colors.border, marginVertical: spacing.md },
  miniRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 4 },
  manageRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    paddingVertical: 12, marginBottom: spacing.sm,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  miniText: { flex: 1, fontSize: 13, fontWeight: '600', color: colors.text },
  qa: {
    flex: 1, backgroundColor: colors.surface, borderRadius: radii.md,
    padding: spacing.md, alignItems: 'center', gap: 6,
    borderWidth: 1, borderColor: colors.border,
  },
  qaText: { fontSize: 12, fontWeight: '700', color: colors.text, textAlign: 'center' },
  upiRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    marginTop: spacing.md, padding: spacing.md,
    backgroundColor: colors.background, borderRadius: radii.md,
    borderWidth: 1, borderColor: colors.border,
  },
  upiIdText: { fontSize: 16, fontWeight: '700', color: colors.text },
});
