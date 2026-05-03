import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../../src/api';
import { Button, Card, H2, H3, Muted } from '../../src/ui';
import { colors, spacing } from '../../src/theme';

const ARCHETYPES = [
  { name: 'The Explorer', desc: 'Curious, energetic, and naturally drawn to discovery. Thrives when given space to explore new ideas.' },
  { name: 'The Nurturer', desc: 'Caring, empathetic, and emotionally attuned. Builds strong bonds and supports peers warmly.' },
  { name: 'The Creator', desc: 'Imaginative, expressive, and playful. Loves to invent stories, art, and new ways to solve problems.' },
  { name: 'The Thinker', desc: 'Observant, analytical, and patient. Enjoys puzzles, patterns and figuring out how things work.' },
];

export default function EltheaScreen() {
  const params = useLocalSearchParams<{ student_id: string }>();
  const router = useRouter();
  const [launchUrl, setLaunchUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [completing, setCompleting] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const r = await api<{ launch_url: string; session_id: string }>(
          `/elthea/launch?student_id=${params.student_id}`,
          { method: 'POST' }
        );
        setLaunchUrl(r.launch_url);
      } catch (e: any) {
        Alert.alert('Error', e.message || 'Failed to start assessment');
      } finally {
        setLoading(false);
      }
    })();
  }, [params.student_id]);

  async function completeMock() {
    setCompleting(true);
    try {
      const arch = ARCHETYPES[Math.floor(Math.random() * ARCHETYPES.length)];
      const grow_scores = {
        G: 60 + Math.floor(Math.random() * 35),
        R: 55 + Math.floor(Math.random() * 40),
        O: 60 + Math.floor(Math.random() * 35),
        W: 55 + Math.floor(Math.random() * 40),
      };
      await api('/elthea/complete', {
        method: 'POST',
        body: {
          student_id: params.student_id,
          grow_scores,
          archetype_name: arch.name,
          archetype_description: arch.desc,
        },
      });
      Alert.alert('Assessment Complete!', `Archetype: ${arch.name}`, [
        { text: 'View Results', onPress: () => router.replace('/parent/profile') },
      ]);
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed');
    } finally {
      setCompleting(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.head}>
        <TouchableOpacity testID="elthea-back" style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <H3>Elthea Assessment</H3>
        <View style={{ width: 44 }} />
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} size="large" />
          <Muted style={{ marginTop: 12 }}>Preparing assessment...</Muted>
        </View>
      ) : Platform.OS === 'web' || !launchUrl ? (
        // On web preview, WebView doesn't render external assessments; show mock UI
        <View style={{ flex: 1, padding: spacing.lg }}>
          <Card style={{ alignItems: 'center', marginTop: spacing.lg }}>
            <Ionicons name="sparkles" size={48} color={colors.golden} />
            <H2 style={{ marginTop: spacing.md, textAlign: 'center' }}>GROW Assessment</H2>
            <Muted style={{ textAlign: 'center', marginTop: spacing.sm, lineHeight: 20 }}>
              Your child completes a 10-15 min interactive activity. We measure four dimensions:{'\n\n'}
              <Text style={{ fontWeight: '700', color: colors.text }}>Grow</Text> · Independence & confidence{'\n'}
              <Text style={{ fontWeight: '700', color: colors.text }}>Relate</Text> · Social & emotional bonding{'\n'}
              <Text style={{ fontWeight: '700', color: colors.text }}>Observe</Text> · Focus & analytical thinking{'\n'}
              <Text style={{ fontWeight: '700', color: colors.text }}>Wonder</Text> · Imagination & curiosity
            </Muted>
            <Button
              testID="complete-elthea"
              title={completing ? 'Submitting…' : 'Complete Demo Assessment'}
              loading={completing}
              onPress={completeMock}
              style={{ marginTop: spacing.lg, alignSelf: 'stretch' }}
            />
            {launchUrl ? (
              <Text style={styles.urlHint} numberOfLines={1}>
                Launch URL: {launchUrl}
              </Text>
            ) : null}
          </Card>
        </View>
      ) : (
        <>
          <WebView
            source={{ uri: launchUrl }}
            style={{ flex: 1 }}
            startInLoadingState
            renderLoading={() => (
              <View style={styles.center}>
                <ActivityIndicator color={colors.primary} size="large" />
              </View>
            )}
          />
          <View style={styles.bottomBar}>
            <Button
              testID="complete-elthea"
              title="Mark Complete (Demo)"
              variant="secondary"
              loading={completing}
              onPress={completeMock}
            />
          </View>
        </>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  backBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background },
  bottomBar: {
    padding: spacing.md,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  urlHint: { color: colors.textMuted, fontSize: 11, marginTop: spacing.md },
});
