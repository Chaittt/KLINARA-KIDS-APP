import { useRouter } from 'expo-router';
import { useState } from 'react';
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

export default function StaffLogin() {
  const router = useRouter();
  const { loginStaff } = useAuth();
  const [email, setEmail] = useState('admin@klinara.com');
  const [password, setPassword] = useState('Admin@123');
  const [showPwd, setShowPwd] = useState(false);
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleLogin() {
    setErr('');
    if (!email.includes('@')) return setErr('Enter a valid email');
    if (password.length < 4) return setErr('Enter your password');
    setLoading(true);
    try {
      await loginStaff(email.trim().toLowerCase(), password);
    } catch (e: any) {
      setErr(e.message || 'Login failed');
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
            <H2 style={{ textAlign: 'center' }}>Staff Login</H2>
            <Muted style={{ textAlign: 'center', marginTop: 6 }}>
              Sign in with your work email
            </Muted>
          </View>

          <Input
            testID="email-input"
            label="Email"
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            placeholder="you@klinara.com"
            value={email}
            onChangeText={setEmail}
          />

          <View style={{ position: 'relative' }}>
            <Input
              testID="password-input"
              label="Password"
              secureTextEntry={!showPwd}
              placeholder="••••••••"
              value={password}
              onChangeText={setPassword}
              error={err}
            />
            <TouchableOpacity
              testID="toggle-pwd"
              style={styles.eye}
              onPress={() => setShowPwd((v) => !v)}
            >
              <Ionicons
                name={showPwd ? 'eye-off-outline' : 'eye-outline'}
                size={20}
                color={colors.textMuted}
              />
            </TouchableOpacity>
          </View>

          <Button
            testID="login-btn"
            title="Login"
            onPress={handleLogin}
            loading={loading}
          />

          <TouchableOpacity
            testID="forgot-btn"
            style={{ marginTop: spacing.md, alignItems: 'center' }}
            onPress={() => router.push('/auth/forgot-password')}
          >
            <Text style={styles.link}>Forgot password?</Text>
          </TouchableOpacity>

          <View style={styles.hintBox}>
            <Muted style={{ fontSize: 12, textAlign: 'center' }}>
              Demo accounts:{'\n'}
              admin@klinara.com / Admin@123{'\n'}
              md@klinara.com / MD@123456{'\n'}
              teacher@klinara.com / Teacher@123
            </Muted>
          </View>
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
  eye: { position: 'absolute', right: 16, top: 38 },
  link: { color: colors.primary, fontWeight: '600', fontSize: 14 },
  hintBox: {
    marginTop: spacing.lg,
    padding: spacing.md,
    backgroundColor: '#f5f1e8',
    borderRadius: 16,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.border,
  },
});
