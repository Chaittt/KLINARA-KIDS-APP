import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../../src/api';
import { Button, H2, Input, Muted } from '../../src/ui';
import { colors, radii, spacing } from '../../src/theme';

export default function ForgotPassword() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [err, setErr] = useState('');

  async function requestReset() {
    setErr('');
    if (!email.includes('@')) return setErr('Enter a valid email');
    setLoading(true);
    try {
      // Records the request server-side; the Managing Director issues a new
      // temporary password from the User Management screen.
      await api('/auth/forgot-password', {
        method: 'POST',
        body: { email: email.trim().toLowerCase() },
        auth: false,
      });
      setDone(true);
    } catch (e: any) {
      setErr(e.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
          <View style={styles.topBar}>
            <TouchableOpacity testID="fp-back" onPress={() => router.back()} style={styles.backBtn}>
              <Ionicons name="chevron-back" size={24} color={colors.text} />
            </TouchableOpacity>
          </View>

          <H2>Reset Password</H2>
          <Muted style={{ marginTop: 6, marginBottom: spacing.xl }}>
            For your security, passwords are managed by your school. Request a reset and the
            Managing Director will issue you a new temporary password.
          </Muted>

          {done ? (
            <View style={styles.doneBox} testID="fp-done">
              <Ionicons name="shield-checkmark" size={40} color={colors.primary} />
              <Text style={styles.doneTitle}>Request received</Text>
              <Muted style={{ textAlign: 'center', marginTop: 6 }}>
                Please contact your Managing Director. They will generate a temporary password for
                you from the User Management screen. Sign in with it, then change it.
              </Muted>
              <Button
                testID="fp-back-to-login"
                title="Back to Login"
                onPress={() => router.replace('/auth/staff-login')}
                style={{ marginTop: spacing.lg, alignSelf: 'stretch' }}
              />
            </View>
          ) : (
            <>
              <Input
                testID="forgot-email"
                label="Your work email"
                keyboardType="email-address"
                autoCapitalize="none"
                value={email}
                onChangeText={setEmail}
                error={err}
                placeholder="you@klinara.com"
              />
              <Button
                testID="send-reset"
                title="Request Password Reset"
                onPress={requestReset}
                loading={loading}
              />
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  container: { padding: spacing.lg, flexGrow: 1 },
  topBar: { marginBottom: spacing.lg },
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
  doneBox: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  doneTitle: { fontSize: 18, fontWeight: '700', color: colors.text, marginTop: spacing.sm },
});
