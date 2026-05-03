import { useRouter } from 'expo-router';
import { useEffect, useState, useCallback } from 'react';
import { FlatList, RefreshControl, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../../src/api';
import { useAuth } from '../../src/auth';
import { Card, H2, Muted } from '../../src/ui';
import { colors, spacing } from '../../src/theme';

type Student = { id: string; name: string; class_name: string; age?: number };

export default function TeacherStudents() {
  const router = useRouter();
  const { logout } = useAuth();
  const [students, setStudents] = useState<Student[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const s = await api<Student[]>('/students');
      setStudents(s);
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
        <View>
          <H2>My Class</H2>
          <Muted>{students.length} students enrolled</Muted>
        </View>
        <TouchableOpacity testID="logout-btn" onPress={logout} style={styles.iconBtn}>
          <Ionicons name="log-out-outline" size={22} color={colors.text} />
        </TouchableOpacity>
      </View>
      <FlatList
        data={students}
        keyExtractor={(s) => s.id}
        contentContainerStyle={{ padding: spacing.lg }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        ListEmptyComponent={
          <Card>
            <Muted style={{ textAlign: 'center' }}>No students yet</Muted>
          </Card>
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={() => router.push(`/student/${item.id}`)}
            testID={`student-${item.id}`}
          >
            <Card style={styles.row}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>
                  {item.name
                    .split(' ')
                    .map((p) => p[0])
                    .slice(0, 2)
                    .join('')}
                </Text>
              </View>
              <View style={{ flex: 1, marginLeft: spacing.md }}>
                <Text style={styles.name}>{item.name}</Text>
                <Muted style={{ fontSize: 12 }}>
                  {item.class_name}
                  {item.age ? ` · ${item.age} yrs` : ''}
                </Muted>
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
            </Card>
          </TouchableOpacity>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  head: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.lg,
    paddingBottom: 0,
  },
  iconBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
    padding: spacing.md,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.blush,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontWeight: '700', color: colors.text },
  name: { fontSize: 16, fontWeight: '600', color: colors.text },
});
