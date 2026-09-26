import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  Image,
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
import { Button, H2, Input, Muted } from '../../src/ui';
import { colors, LOGO_URL, spacing } from '../../src/theme';
import { useAuth } from '../../src/auth';

export default function ParentLogin() {
  const router = useRouter();
  const { sendOtp, verifyOtp } = useAuth();
  const [step, setStep] = useState<'phone' | 'otp'>('phone');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const [resendIn, setResendIn] = useState(30);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (step === 'otp') startResendTimer();
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [step]);

  function startResendTimer() {
    setResendIn(30);
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setResendIn((s) => {
        if (s <= 1) {
          if (timerRef.current) clearInterval(timerRef.current);
          return 0;
        }
        return s - 1;
      });
    }, 1000);
  }

  async function handleSend() {
    setErr('');
    if (!/^\d{10}$/.test(phone.trim())) {
      setErr('Enter a valid 10-digit phone number');
      return;
    }
    setLoading(true);
    try {
      await sendOtp(phone.trim());
      setStep('otp');
    } catch (e: any) {
      setErr(e.message || 'Failed to send OTP');
    } finally {
      setLoading(false);
    }
  }

  async function handleVerify() {
    setErr('');
    if (!/^\d{4,6}$/.test(otp.trim())) {
      setErr('Enter the OTP');
      return;
    }
    setLoading(true);
    try {
      await verifyOtp(phone.trim(), otp.trim());
      // Route guard handles redirection
    } catch (e: any) {
      setErr(e.message || 'Verification failed');
    } finally {
      setLoading(false);
    }
  }

  async function handleResend() {
    if (resendIn > 0) return;
    await handleSend();
  }

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={styles.container}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.topBar}>
            <TouchableOpacity testID="back-btn" onPress={() => router.back()} style={styles.backBtn}>
              <Ionicons name="chevron-back" size={24} color={colors.text} />
            </TouchableOpacity>
          </View>

          <View style={styles.head}>
            <Image source={{ uri: LOGO_URL }} style={styles.logo} resizeMode="contain" />
            <H2 style={{ textAlign: 'center' }}>Parent Login</H2>
            <Muted style={{ textAlign: 'center', marginTop: 6 }}>
              {step === 'phone'
                ? 'Enter your registered mobile number'
                : `OTP sent to +91 ${phone}`}
            </Muted>
          </View>

          {step === 'phone' ? (
            <View>
              <Input
                testID="phone-input"
                label="Mobile Number"
                keyboardType="phone-pad"
                placeholder="10-digit number"
                value={phone}
                onChangeText={(t) => setPhone(t.replace(/\D/g, '').slice(0, 10))}
                maxLength={10}
                error={err}
              />
              <Button
                testID="send-otp-btn"
                title="Send OTP"
                onPress={handleSend}
                loading={loading}
              />
            </View>
          ) : (
            <View>
              <Input
                testID="otp-input"
                label="Enter OTP"
                keyboardType="number-pad"
                placeholder="6-digit code"
                value={otp}
                onChangeText={(t) => setOtp(t.replace(/\D/g, '').slice(0, 6))}
                maxLength={6}
                error={err}
              />
              <Button
                testID="verify-otp-btn"
                title="Verify & Login"
                onPress={handleVerify}
                loading={loading}
              />
              <View style={styles.linkRow}>
                <TouchableOpacity testID="change-number-btn" onPress={() => setStep('phone')}>
                  <Text style={styles.link}>Change number</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  testID="resend-otp-btn"
                  disabled={resendIn > 0}
                  onPress={handleResend}
                >
                  <Text style={[styles.link, resendIn > 0 && { color: colors.textMuted }]}>
                    {resendIn > 0 ? `Resend in ${resendIn}s` : 'Resend OTP'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  container: { padding: spacing.lg, flexGrow: 1 },
  topBar: { flexDirection: 'row', marginBottom: spacing.md },
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
  head: { alignItems: 'center', marginBottom: spacing.xl },
  logo: { width: 80, height: 80, marginBottom: spacing.md },
  hintBox: {
    marginTop: spacing.lg,
    padding: spacing.md,
    backgroundColor: '#f5f1e8',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    borderStyle: 'dashed',
  },
  linkRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: spacing.lg },
  link: { color: colors.primary, fontWeight: '600', fontSize: 14 },
  hint: {
    color: colors.golden,
    fontSize: 13,
    marginBottom: spacing.md,
    textAlign: 'center',
    fontStyle: 'italic',
  },
});
