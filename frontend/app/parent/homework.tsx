import { useEffect, useState, useCallback } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../../src/api';
import { Card, H2, Muted } from '../../src/ui';
import { colors, spacing } from '../../src/theme';

type Homework = { id: string; title: string; description: string; due_date?: string; uploader_name?: string; created_at: string; class_name: string };

export default function ParentHomework() {
  const [items, setItems] = useState<Homework[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try { setItems(await api<Homework[]>('/homework')); } catch {}
  }, []);
  useEffect(() => { load(); }, [load]);
  async function onRefresh() { setRefreshing(true); await load(); setRefreshing(false); }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={{ padding: spacing.lg }}>
        <H2>Homework</H2>
        <Muted>Assigned by your child's teacher</Muted>
      </View>
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingTop: 0 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}>
        {items.length === 0 ? (
          <Card><Muted style={{ textAlign: 'center' }}>No homework assigned yet</Muted></Card>
        ) : items.map((h) => (
          <Card key={h.id} style={{ marginBottom: spacing.md }} testID={`hw-${h.id}`}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Ionicons name="book" size={20} color={colors.golden} />
              <Text style={styles.title}>{h.title}</Text>
            </View>
            <Text style={styles.desc}>{h.description}</Text>
            <View style={{ flexDirection: 'row', gap: 12, marginTop: 8 }}>
              {h.due_date ? (
                <View style={styles.chip}><Ionicons name="calendar" size={12} color={colors.danger} /><Text style={styles.chipText}>Due {h.due_date}</Text></View>
              ) : null}
              <Muted style={{ fontSize: 12 }}>{h.uploader_name}</Muted>
            </View>
          </Card>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  title: { fontSize: 16, fontWeight: '700', color: colors.text, flex: 1 },
  desc: { fontSize: 14, color: colors.text, marginTop: 8, lineHeight: 20 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  chipText: { fontSize: 11, color: colors.danger, fontWeight: '600' },
});
