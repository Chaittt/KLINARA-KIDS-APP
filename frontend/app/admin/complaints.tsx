import { useEffect, useState, useCallback } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../../src/api';
import { Card, H2, Muted } from '../../src/ui';
import { colors, radii, spacing } from '../../src/theme';

type Complaint = {
  id: string;
  parent_name?: string;
  student_name?: string;
  subject: string;
  description: string;
  status: string;
  created_at: string;
  resolved_at?: string;
  resolution_note?: string;
};

export default function PrincipalComplaints() {
  const [items, setItems] = useState<Complaint[]>([]);
  const [filter, setFilter] = useState<'all' | 'open' | 'resolved'>('open');
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const r = await api<Complaint[]>('/complaints');
      setItems(r);
    } catch {}
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  async function resolve(c: Complaint) {
    Alert.alert('Mark as resolved?', `Complaint: ${c.subject}`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Resolve',
        onPress: async () => {
          try {
            await api(`/complaints/${c.id}/resolve?note=Addressed`, { method: 'POST' });
            await load();
          } catch (e: any) {
            Alert.alert('Error', e.message || 'Failed');
          }
        },
      },
    ]);
  }

  async function onRefresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  const filtered = items.filter((c) => (filter === 'all' ? true : c.status === filter));

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={{ padding: spacing.lg }}>
        <H2>Parent Complaints</H2>
        <Muted>Feedback and concerns from parents</Muted>
        <View style={styles.tabs}>
          {(['open', 'resolved', 'all'] as const).map((f) => (
            <TouchableOpacity
              key={f}
              testID={`filter-${f}`}
              onPress={() => setFilter(f)}
              style={[styles.tab, filter === f && styles.tabActive]}
            >
              <Text style={[styles.tabText, filter === f && styles.tabTextActive]}>
                {f.charAt(0).toUpperCase() + f.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: spacing.lg, paddingTop: 0, paddingBottom: spacing.xxl }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      >
        {filtered.length === 0 ? (
          <Card>
            <Muted style={{ textAlign: 'center' }}>No complaints in this view</Muted>
          </Card>
        ) : (
          filtered.map((c) => (
            <Card key={c.id} style={{ marginBottom: spacing.md }} testID={`complaint-${c.id}`}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.cSubject}>{c.subject}</Text>
                  <Muted style={{ fontSize: 12, marginTop: 2 }}>
                    {c.parent_name} · about {c.student_name} · {new Date(c.created_at).toLocaleDateString()}
                  </Muted>
                </View>
                <View style={[styles.pill, { backgroundColor: c.status === 'open' ? colors.danger + '22' : colors.success + '22' }]}>
                  <Text style={{ color: c.status === 'open' ? colors.danger : colors.success, fontSize: 10, fontWeight: '700', letterSpacing: 0.5 }}>
                    {c.status.toUpperCase()}
                  </Text>
                </View>
              </View>
              <Text style={styles.cDesc}>{c.description}</Text>
              {c.status === 'open' ? (
                <TouchableOpacity
                  testID={`resolve-${c.id}`}
                  style={styles.resolveBtn}
                  onPress={() => resolve(c)}
                >
                  <Ionicons name="checkmark-circle" size={18} color={colors.inverse} />
                  <Text style={{ color: colors.inverse, fontWeight: '700' }}>Mark Resolved</Text>
                </TouchableOpacity>
              ) : (
                <Muted style={{ fontSize: 12, marginTop: 8 }}>
                  Resolved {c.resolved_at ? new Date(c.resolved_at).toLocaleDateString() : ''}
                </Muted>
              )}
            </Card>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  tabs: { flexDirection: 'row', gap: 8, marginTop: spacing.md },
  tab: {
    paddingHorizontal: 16, paddingVertical: 8, borderRadius: radii.pill,
    borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.surface,
  },
  tabActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  tabText: { fontSize: 13, fontWeight: '600', color: colors.text },
  tabTextActive: { color: colors.inverse },
  cSubject: { fontSize: 15, fontWeight: '700', color: colors.text },
  cDesc: { fontSize: 14, color: colors.text, marginTop: 8, lineHeight: 20 },
  pill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: radii.pill },
  resolveBtn: {
    marginTop: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, backgroundColor: colors.success, paddingVertical: 10, borderRadius: radii.pill,
  },
});
