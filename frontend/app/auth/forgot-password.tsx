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
import { colors, spacing } from '../../src/theme';

export default function ForgotPassword() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [token, setToken] = useState('');
  const [newPwd, setNewPwd] = useState('');
  const [step, setStep] = useState<'email' | 'reset'>('email');
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');

  async function sendReset() {
    setErr('');
    setMsg('');
    if (!email.includes('@')) return setErr('Enter a valid email');
    setLoading(true);
    try {
      const r = await api<{ message: string; debug_token?: string }>('/auth/forgot-password', {
        method: 'POST',
        body: { email: email.trim().toLowerCase() },
        auth: false,
      });
      setMsg(r.message);
      if (r.debug_token) {
        setToken(r.debug_token);
        setMsg(`${r.message}\nDemo reset token: ${r.debug_token}`);
      }
      setStep('reset');
    } catch (e: any) {
      setErr(e.message || 'Failed');
    } finally {
      setLoading(false);
    }
  }

  async function doReset() {
    setErr('');
    setMsg('');
    if (!token) return setErr('Enter reset token');
    if (newPwd.length < 6) return setErr('Password must be at least 6 characters');
    setLoading(true);
    try {
      await api('/auth/reset-password', {
        method: 'POST',
        body: { token, new_password: newPwd },
        auth: false,
      });
      setMsg('Password reset successfully. Please log in.');
      setTimeout(() => router.replace('/auth/staff-login'), 1200);
    } catch (e: any) {
      setErr(e.message || 'Reset failed');
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
            <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
              <Ionicons name="chevron-back" size={24} color={colors.text} />
            </TouchableOpacity>
          </View>

          <H2>Forgot Password</H2>
          <Muted style={{ marginTop: 6, marginBottom: spacing.xl }}>
            {step === 'email'
              ? 'Enter your email to receive a reset token'
              : 'Use the token to set a new password'}
          </Muted>

          {step === 'email' ? (
            <>
              <Input
                testID="forgot-email"
                label="Email"
                keyboardType="email-address"
                autoCapitalize="none"
                value={email}
                onChangeText={setEmail}
                error={err}
                placeholder="you@klinara.com"
              />
              <Button title="Send Reset Token" onPress={sendReset} loading={loading} testID="send-reset" />
            </>
          ) : (
            <>
              <Input
                testID="reset-token"
                label="Reset Token"
                value={token}
                onChangeText={setToken}
                autoCapitalize="none"
              />
              <Input
                testID="new-pwd"
                label="New Password"
                secureTextEntry
                value={newPwd}
                onChangeText={setNewPwd}
                error={err}
              />
              <Button title="Reset Password" onPress={doReset} loading={loading} testID="reset-btn" />
            </>
          )}

          {msg ? <Text style={styles.success}>{msg}</Text> : null}
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
  success: { color: colors.primary, marginTop: spacing.md, lineHeight: 20 },
});
