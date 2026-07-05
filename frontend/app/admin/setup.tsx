import { useEffect, useState, useCallback } from 'react';
import { Alert, KeyboardAvoidingView, Modal, Platform, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../../src/api';
import { useAuth } from '../../src/auth';
import { Button, Card, H2, H3, Input, Muted } from '../../src/ui';
import { colors, radii, spacing } from '../../src/theme';

type FeeItem = { class_name: string; monthly_amount: number };
type YearItem = { class_name: string; year_label: string; start_date: string; end_date: string; notes?: string };
type Salary = { user: any; monthly_amount: number | null; currency: string };
type Event = { id: string; title: string; description: string; date: string };
type ClassOcc = { class_name: string; count: number };

const CLASSES = ['Playgroup', 'Nursery', 'LKG', 'UKG', 'Sunshine'];

export default function MDSetup() {
  const { user } = useAuth();
  const [fees, setFees] = useState<FeeItem[]>([]);
  const [years, setYears] = useState<YearItem[]>([]);
  const [salaries, setSalaries] = useState<Salary[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [occ, setOcc] = useState<ClassOcc[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const [feeModal, setFeeModal] = useState<FeeItem | null>(null);
  const [feeVal, setFeeVal] = useState('');
  const [yearModal, setYearModal] = useState<YearItem | null>(null);
  const [yLabel, setYLabel] = useState('');
  const [yStart, setYStart] = useState('');
  const [yEnd, setYEnd] = useState('');
  const [salModal, setSalModal] = useState<Salary | null>(null);
  const [salVal, setSalVal] = useState('');
  const [evModal, setEvModal] = useState(false);
  const [evTitle, setEvTitle] = useState('');
  const [evDesc, setEvDesc] = useState('');
  const [evDate, setEvDate] = useState('');

  const load = useCallback(async () => {
    const r = await Promise.allSettled([
      api<FeeItem[]>('/fee-structure'),
      api<YearItem[]>('/academic-year'),
      api<Salary[]>('/salaries'),
      api<Event[]>('/events/this-week'),
      api<ClassOcc[]>('/stats/class-occupancy'),
    ]);
    if (r[0].status === 'fulfilled') setFees(r[0].value);
    if (r[1].status === 'fulfilled') setYears(r[1].value);
    if (r[2].status === 'fulfilled') setSalaries(r[2].value);
    if (r[3].status === 'fulfilled') setEvents(r[3].value);
    if (r[4].status === 'fulfilled') setOcc(r[4].value);
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

  async function saveYear() {
    if (!yearModal) return;
    if (!yLabel || !yStart || !yEnd) return Alert.alert('All fields required');
    try {
      await api(`/academic-year/${yearModal.class_name}`, {
        method: 'PUT',
        body: { year_label: yLabel, start_date: yStart, end_date: yEnd, notes: yearModal.notes || '' },
      });
      setYearModal(null); await load();
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

  const isMD = user?.role === 'md';

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxl }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}>
        <H2>Setup</H2>
        <Muted style={{ marginBottom: spacing.md }}>Manage school configuration</Muted>

        {/* Class Occupancy */}
        <Card style={{ marginBottom: spacing.md }} testID="class-occupancy">
          <H3>Class Strength</H3>
          {occ.length === 0 ? <Muted style={{ marginTop: 8 }}>No students yet</Muted> :
            occ.map((c) => (
              <View key={c.class_name} style={styles.row}>
                <Text style={styles.rowLabel}>{c.class_name}</Text>
                <View style={styles.chip}><Text style={styles.chipText}>{c.count} students</Text></View>
              </View>
            ))}
        </Card>

        {/* Fee Structure */}
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

        {/* Academic Year (per class) */}
        <Card style={{ marginBottom: spacing.md }} testID="academic-year-card">
          <H3>Academic Year</H3>
          <Muted style={{ marginTop: 4 }}>Configure per class</Muted>
          {CLASSES.map((cls) => {
            const item = years.find((y) => y.class_name === cls);
            return (
              <TouchableOpacity key={cls} style={styles.row} testID={`year-${cls}`}
                onPress={() => {
                  const i: YearItem = item || { class_name: cls, year_label: '2026-27', start_date: '2026-06-15', end_date: '2027-04-15' };
                  setYearModal(i); setYLabel(i.year_label); setYStart(i.start_date); setYEnd(i.end_date);
                }}>
                <Text style={styles.rowLabel}>{cls}</Text>
                <Text style={styles.rowValue}>{item ? item.year_label : 'Configure'}</Text>
                <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
              </TouchableOpacity>
            );
          })}
        </Card>

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

        {/* Add Principal (MD only) - REMOVED: role merged into admin */}
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

      {/* Year modal */}
      <Modal visible={!!yearModal} animationType="slide" transparent>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalBg}>
          <ScrollView contentContainerStyle={{ padding: spacing.lg }} keyboardShouldPersistTaps="handled">
            <Card>
              <H3>{yearModal?.class_name} — Academic Year</H3>
              <Input testID="year-label" label="Year Label" value={yLabel} onChangeText={setYLabel} placeholder="2026-27" containerStyle={{ marginTop: spacing.md }} />
              <Input testID="year-start" label="Start Date (YYYY-MM-DD)" value={yStart} onChangeText={setYStart} />
              <Input testID="year-end" label="End Date (YYYY-MM-DD)" value={yEnd} onChangeText={setYEnd} />
              <Button testID="save-year" title="Save" onPress={saveYear} />
              <Button title="Cancel" variant="ghost" onPress={() => setYearModal(null)} style={{ marginTop: 8 }} />
            </Card>
          </ScrollView>
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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  row: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: 12, gap: 8,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  rowLabel: { flex: 1, fontSize: 15, fontWeight: '600', color: colors.text },
  rowValue: { fontSize: 14, color: colors.textSecondary, fontWeight: '600' },
  chip: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: radii.pill, backgroundColor: colors.blush },
  chipText: { fontSize: 12, fontWeight: '600', color: colors.text },
  smallBtn: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: colors.primary,
    paddingHorizontal: 10, paddingVertical: 6, borderRadius: radii.pill, gap: 4,
  },
  modalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
});
