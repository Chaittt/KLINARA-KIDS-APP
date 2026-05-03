import { useEffect, useState, useCallback } from 'react';
import { FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../../src/api';
import { Card, H2, Muted } from '../../src/ui';
import { colors, radii, spacing } from '../../src/theme';

type Payment = {
  id: string;
  student_id: string;
  amount: number;
  status: string;
  description?: string;
  transaction_id?: string;
  created_at: string;
  paid_at?: string;
};

export default function AdminFees() {
  const [items, setItems] = useState<Payment[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const p = await api<Payment[]>('/payments');
      setItems(p);
    } catch {}
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  async function onRefresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  const paid = items.filter((i) => i.status === 'paid').reduce((s, i) => s + i.amount, 0);
  const pending = items.filter((i) => i.status === 'pending').reduce((s, i) => s + i.amount, 0);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={{ padding: spacing.lg }}>
        <H2>Fee Tracking</H2>
        <View style={styles.summary}>
          <Card style={[styles.sumCard, { backgroundColor: colors.success + '22' }]}>
            <Ionicons name="checkmark-circle" size={20} color={colors.success} />
            <Text style={styles.sumLabel}>Collected</Text>
            <Text style={[styles.sumVal, { color: colors.success }]}>₹{paid.toLocaleString()}</Text>
          </Card>
          <Card style={[styles.sumCard, { backgroundColor: colors.danger + '22' }]}>
            <Ionicons name="time" size={20} color={colors.danger} />
            <Text style={styles.sumLabel}>Pending</Text>
            <Text style={[styles.sumVal, { color: colors.danger }]}>₹{pending.toLocaleString()}</Text>
          </Card>
        </View>
      </View>
      <FlatList
        data={items}
        keyExtractor={(i) => i.id}
        contentContainerStyle={{ padding: spacing.lg, paddingTop: 0 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        ListEmptyComponent={
          <Card>
            <Muted style={{ textAlign: 'center' }}>No payments yet</Muted>
          </Card>
        }
        renderItem={({ item }) => (
          <Card style={{ marginBottom: spacing.sm, padding: spacing.md }} testID={`pay-${item.id}`}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <View style={{ flex: 1 }}>
                <Text style={{ fontWeight: '600', color: colors.text }}>{item.description}</Text>
                <Muted style={{ fontSize: 12, marginTop: 2 }}>
                  {item.transaction_id || 'No txn yet'} · {new Date(item.created_at).toLocaleDateString()}
                </Muted>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={{ fontSize: 16, fontWeight: '700', color: colors.text }}>
                  ₹{item.amount.toLocaleString()}
                </Text>
                <View
                  style={[
                    styles.pill,
                    {
                      backgroundColor:
                        item.status === 'paid' ? colors.success + '22' : colors.danger + '22',
                    },
                  ]}
                >
                  <Text
                    style={{
                      color: item.status === 'paid' ? colors.success : colors.danger,
                      fontSize: 10,
                      fontWeight: '700',
                      letterSpacing: 0.5,
                    }}
                  >
                    {item.status.toUpperCase()}
                  </Text>
                </View>
              </View>
            </View>
          </Card>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  summary: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.md },
  sumCard: { flex: 1, padding: spacing.md, borderWidth: 0 },
  sumLabel: { fontSize: 12, color: colors.textSecondary, marginTop: 6 },
  sumVal: { fontSize: 22, fontWeight: '700', marginTop: 4 },
  pill: {
    marginTop: 6,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: radii.pill,
  },
});
