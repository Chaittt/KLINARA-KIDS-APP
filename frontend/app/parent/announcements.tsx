import { useEffect, useState, useCallback } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { api } from '../../src/api';
import { Card, H2, H3, Muted } from '../../src/ui';
import { colors, spacing, radii } from '../../src/theme';

type Announcement = {
  id: string;
  title: string;
  description: string;
  created_at: string;
  audience?: string;
};

export default function ParentAnnouncements() {
  const router = useRouter();
  const [items, setItems] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const list = await api<Announcement[]>('/announcements');
      const sorted = [...list].sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''));
      setItems(sorted);
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

  function fmt(iso: string) {
    if (!iso) return '';
    const d = new Date(iso);
    const now = new Date();
    const diff = (now.getTime() - d.getTime()) / 1000;
    if (diff < 60) return 'Just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
    return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity testID="ann-back" onPress={() => router.back()} style={styles.iconBtn} hitSlop={10}>
          <Ionicons name="chevron-back" size={22} color={colors.text} />
        </TouchableOpacity>
        <View style={{ flex: 1, marginLeft: spacing.md }}>
          <H2>Notifications</H2>
          <Muted style={{ fontSize: 12 }}>{items.length} announcement{items.length === 1 ? '' : 's'}</Muted>
        </View>
      </View>

      {loading ? (
        <View style={{ padding: spacing.xl, alignItems: 'center' }}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxl }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        >
          {items.length === 0 ? (
            <Card testID="empty-ann">
              <View style={{ alignItems: 'center', paddingVertical: spacing.lg }}>
                <View style={styles.emptyIcon}>
                  <Ionicons name="notifications-off-outline" size={28} color={colors.textMuted} />
                </View>
                <H3 style={{ marginTop: spacing.md }}>No announcements yet</H3>
                <Muted style={{ marginTop: 4, textAlign: 'center' }}>Updates from the school will appear here.</Muted>
              </View>
            </Card>
          ) : (
            items.map((a) => (
              <Card key={a.id} style={styles.item} testID={`ann-${a.id}`}>
                <View style={styles.itemHead}>
                  <View style={styles.dot} />
                  <Text style={styles.title}>{a.title}</Text>
                  <Muted style={{ fontSize: 11, marginLeft: 8 }}>{fmt(a.created_at)}</Muted>
                </View>
                <Text style={styles.desc}>{a.description}</Text>
                {a.audience ? (
                  <View style={styles.audChip}>
                    <Ionicons name="people-outline" size={12} color={colors.primary} />
                    <Text style={styles.audChipText}>{a.audience}</Text>
                  </View>
                ) : null}
              </Card>
            ))
          )}
        </ScrollView>
      )}
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
  item: { marginBottom: spacing.md },
  itemHead: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.primary, marginRight: 8 },
  title: { flex: 1, fontSize: 15, fontWeight: '700', color: colors.text },
  desc: { fontSize: 14, color: colors.textSecondary, lineHeight: 20 },
  audChip: {
    alignSelf: 'flex-start',
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: colors.blush, paddingHorizontal: 8, paddingVertical: 4,
    borderRadius: radii.pill, marginTop: 8,
  },
  audChipText: { fontSize: 11, fontWeight: '700', color: colors.primary },
  emptyIcon: {
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: colors.blush, alignItems: 'center', justifyContent: 'center',
  },
});
