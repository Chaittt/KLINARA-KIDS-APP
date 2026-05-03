import { useEffect, useState, useCallback } from 'react';
import { Alert, Linking, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../../src/api';
import { Button, Card, H2, H3, Muted } from '../../src/ui';
import { colors, spacing } from '../../src/theme';

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
type Student = { id: string; name: string };

export default function ParentFees() {
  const [student, setStudent] = useState<Student | null>(null);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [paying, setPaying] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const s = (await api<Student[]>('/students'))[0];
      setStudent(s || null);
      if (s) {
        const p = await api<Payment[]>(`/payments/student/${s.id}`);
        setPayments(p);
      }
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

  async function payNow(p: Payment) {
    setPaying(p.id);
    try {
      const init = await api<{ payment: Payment; upi_url: string }>('/payments/initiate', {
        method: 'POST',
        body: { student_id: p.student_id, amount: p.amount, description: p.description },
      });
      // Try opening UPI app; else mock-mark paid
      const can = await Linking.canOpenURL(init.upi_url);
      if (can) {
        await Linking.openURL(init.upi_url);
      }
      // Mock: mark the original pending payment as paid
      await api('/payments/mark-paid', {
        method: 'POST',
        body: { payment_id: p.id },
      });
      Alert.alert('Payment Successful', `Paid ₹${p.amount.toLocaleString()} for ${p.description || 'fees'}.`);
      await load();
    } catch (e: any) {
      Alert.alert('Payment Error', e.message || 'Failed');
    } finally {
      setPaying(null);
    }
  }

  const pending = payments.filter((p) => p.status === 'pending');
  const paid = payments.filter((p) => p.status === 'paid');

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView
        contentContainerStyle={{ padding: spacing.lg }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      >
        <H2>Fees</H2>
        {student ? <Muted style={{ marginBottom: spacing.md }}>{student.name}</Muted> : null}

        {pending.length > 0 ? (
          <>
            <H3 style={{ marginTop: spacing.md, marginBottom: spacing.sm }}>Pending</H3>
            {pending.map((p) => (
              <Card key={p.id} style={{ marginBottom: spacing.md, backgroundColor: colors.primary }} testID={`pay-${p.id}`}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <View>
                    <Text style={{ color: colors.inverse, fontSize: 18, fontWeight: '700' }}>
                      {p.description}
                    </Text>
                    <Text style={{ color: colors.inverse, opacity: 0.8, marginTop: 4 }}>
                      Due {new Date(p.created_at).toLocaleDateString()}
                    </Text>
                  </View>
                  <Text style={{ color: colors.golden, fontSize: 24, fontWeight: '700' }}>
                    ₹{p.amount.toLocaleString()}
                  </Text>
                </View>
                <Button
                  testID={`pay-now-${p.id}`}
                  title="Pay via UPI"
                  variant="secondary"
                  loading={paying === p.id}
                  onPress={() => payNow(p)}
                  style={{ marginTop: spacing.md }}
                />
              </Card>
            ))}
          </>
        ) : (
          <Card style={{ alignItems: 'center' }}>
            <Ionicons name="checkmark-circle" size={42} color={colors.success} />
            <H3 style={{ marginTop: 8 }}>All Clear!</H3>
            <Muted>No pending dues</Muted>
          </Card>
        )}

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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
});
