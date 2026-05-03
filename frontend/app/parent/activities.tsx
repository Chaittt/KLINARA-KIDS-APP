import { useEffect, useState, useCallback } from 'react';
import {
  FlatList,
  Image,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api } from '../../src/api';
import { Body, Card, H2, Muted } from '../../src/ui';
import { colors, radii, spacing } from '../../src/theme';

type Activity = {
  id: string;
  description: string;
  photo_base64?: string | null;
  uploader_name?: string;
  created_at: string;
};

export default function ParentActivities() {
  const [items, setItems] = useState<Activity[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const f = await api<Activity[]>('/activities/feed');
      setItems(f);
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

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.head}>
        <H2>Activity Feed</H2>
        <Muted>Daily updates from your child's class</Muted>
      </View>
      <FlatList
        data={items}
        keyExtractor={(i) => i.id}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        ListEmptyComponent={
          <Card>
            <Muted style={{ textAlign: 'center' }}>No activities yet. Pull to refresh.</Muted>
          </Card>
        }
        renderItem={({ item }) => (
          <Card style={{ marginBottom: spacing.md, padding: 0, overflow: 'hidden' }} testID={`activity-${item.id}`}>
            {item.photo_base64 ? (
              <Image source={{ uri: item.photo_base64 }} style={styles.img} />
            ) : (
              <View style={styles.imgPlaceholder}>
                <Text style={{ fontSize: 32 }}>🎨</Text>
              </View>
            )}
            <View style={{ padding: spacing.md }}>
              <Body>{item.description}</Body>
              <Muted style={{ fontSize: 12, marginTop: 8 }}>
                {item.uploader_name} · {new Date(item.created_at).toLocaleString()}
              </Muted>
            </View>
          </Card>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  head: { paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  list: { padding: spacing.lg, paddingTop: 0 },
  img: { width: '100%', height: 220, backgroundColor: colors.border },
  imgPlaceholder: {
    width: '100%',
    height: 140,
    backgroundColor: colors.blush,
    alignItems: 'center',
    justifyContent: 'center',
    borderTopLeftRadius: radii.xl,
    borderTopRightRadius: radii.xl,
  },
});
