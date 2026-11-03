import { useState } from 'react';
import { Linking, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../api';
import { useAuth } from '../auth';
import { Button, Card, H2, Muted } from '../ui';
import { colors, radii, spacing } from '../theme';

export const PRIVACY_URL = `${process.env.EXPO_PUBLIC_BACKEND_URL}/api/privacy`;
export const DELETE_URL = `${process.env.EXPO_PUBLIC_BACKEND_URL}/api/delete-account`;

const POINTS: { icon: any; text: string }[] = [
  { icon: 'person-outline', text: 'Your name, phone and username, and your child’s name, age, class and photo' },
  { icon: 'calendar-outline', text: 'Attendance, activity photos, homework and fee records shared by the school' },
  { icon: 'eye-outline', text: 'Seen only by you and school staff, by role. No ads, no selling data, no tracking' },
  { icon: 'trash-outline', text: 'Ask for deletion any time from Profile. Done within 30 days' },
];

/** First-login privacy notice for parents. Records consent and the separate Elthea opt-in. */
export function PrivacyConsent() {
  const insets = useSafeAreaInsets();
  const { refreshUser, logout } = useAuth();
  const [elthea, setElthea] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  async function agree() {
    setSaving(true);
    setErr('');
    try {
      await api('/me/consent', { method: 'POST', body: { accept_privacy: true, elthea } });
      await refreshUser();
    } catch (e: any) {
      setErr(e.message || 'Could not save. Please try again.');
      setSaving(false);
    }
  }

  return (
    <View style={[styles.root, { paddingTop: insets.top }]} testID="privacy-consent-screen">
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: insets.bottom + spacing.lg }}>
        <View style={styles.iconWrap}>
          <Ionicons name="shield-checkmark" size={32} color={colors.primary} />
        </View>
        <H2>Your privacy</H2>
        <Muted style={{ marginTop: 6, marginBottom: spacing.md }}>
          Klinara Kids Pre-School uses this app to share your child’s school day with you. Here is what we collect.
        </Muted>

        <Card>
          {POINTS.map((p) => (
            <View key={p.text} style={styles.point}>
              <Ionicons name={p.icon} size={18} color={colors.primary} />
              <Text style={styles.pointText}>{p.text}</Text>
            </View>
          ))}
          <Text testID="consent-read-policy" style={styles.link} onPress={() => Linking.openURL(PRIVACY_URL)}>
            Read the full privacy policy
          </Text>
        </Card>

        <Card style={{ marginTop: spacing.md }}>
          <View style={styles.switchRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.switchTitle}>Elthea AI assessment (optional)</Text>
              <Muted style={{ fontSize: 12, marginTop: 2 }}>
                A third-party GROW development check. Answers may be processed outside India. You can change this later in Profile.
              </Muted>
            </View>
            <Switch
              testID="consent-elthea-switch"
              value={elthea}
              onValueChange={setElthea}
              trackColor={{ true: colors.primary, false: colors.textMuted }}
              thumbColor={colors.inverse}
            />
          </View>
        </Card>

        {err ? <Text style={styles.err}>{err}</Text> : null}
        <Button testID="consent-agree-btn" title="I agree" onPress={agree} loading={saving} style={{ marginTop: spacing.lg }} />
        <Button testID="consent-logout-btn" title="Not now, log out" variant="ghost" onPress={logout} style={{ marginTop: spacing.sm }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  iconWrap: {
    width: 56, height: 56, borderRadius: radii.lg, backgroundColor: colors.surface,
    alignItems: 'center', justifyContent: 'center', marginBottom: spacing.md,
    borderWidth: 1, borderColor: colors.border,
  },
  point: { flexDirection: 'row', gap: 12, alignItems: 'flex-start', marginBottom: 14 },
  pointText: { flex: 1, fontSize: 14, color: colors.text, lineHeight: 20 },
  link: { color: colors.primary, fontWeight: '700', fontSize: 14, paddingVertical: 6 },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  switchTitle: { fontSize: 15, fontWeight: '700', color: colors.text },
  err: { color: colors.danger, marginTop: spacing.md, fontSize: 13 },
});
