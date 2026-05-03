import { useRouter } from 'expo-router';
import { useEffect, useState, useCallback } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../../src/api';
import { useAuth } from '../../src/auth';
import { Button, Card, H2, H3, Muted } from '../../src/ui';
import { GrowRadarChart } from '../../src/charts';
import { colors, spacing } from '../../src/theme';

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
  const { user, logout } = useAuth();
  const [student, setStudent] = useState<Student | null>(null);

  const load = useCallback(async () => {
    try {
      const s = (await api<Student[]>('/students'))[0];
      setStudent(s || null);
    } catch {}
  }, []);
  useEffect(() => {
    load();
  }, [load]);

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
            <Button
              testID="reassess-btn"
              title="Re-assess"
              variant="outline"
              onPress={() => router.push({ pathname: '/parent/elthea', params: { student_id: student.id } })}
              style={{ marginTop: spacing.md }}
            />
          </Card>
        ) : student ? (
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

        <Button
          title="Logout"
          variant="outline"
          onPress={logout}
          testID="logout-btn"
          style={{ marginTop: spacing.md }}
        />
      </ScrollView>
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
});
