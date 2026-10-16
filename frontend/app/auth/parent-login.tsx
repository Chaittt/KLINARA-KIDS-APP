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

export default function ParentLogin() {
  const router = useRouter();
  const { loginParent } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleLogin() {
    setErr('');
    if (!username.trim()) return setErr('Enter your username');
    if (!password) return setErr('Enter your password');
    setLoading(true);
    try {
      await loginParent(username.trim().toLowerCase(), password);
      // Route guard handles redirection
    } catch (e: any) {
      setErr(e.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
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
              Sign in with the details shared by your school
            </Muted>
          </View>

          <Input
            testID="parent-username-input"
            label="Username"
            autoCapitalize="none"
            autoCorrect={false}
            placeholder="Your username"
            value={username}
            onChangeText={setUsername}
            returnKeyType="next"
          />

          <View style={{ position: 'relative' }}>
            <Input
              testID="parent-password-input"
              label="Password"
              secureTextEntry={!showPwd}
              autoCapitalize="none"
              autoCorrect={false}
              placeholder="••••••••"
              value={password}
              onChangeText={setPassword}
              onSubmitEditing={handleLogin}
              returnKeyType="go"
              error={err}
            />
            <TouchableOpacity
              testID="parent-toggle-pwd"
              style={styles.eye}
              hitSlop={10}
              onPress={() => setShowPwd((v) => !v)}
            >
              <Ionicons name={showPwd ? 'eye-off-outline' : 'eye-outline'} size={20} color={colors.textMuted} />
            </TouchableOpacity>
          </View>

          <Button testID="parent-login-btn" title="Login" onPress={handleLogin} loading={loading} />

          <TouchableOpacity
            testID="parent-forgot-btn"
            style={{ marginTop: spacing.md, alignItems: 'center', paddingVertical: 8 }}
            onPress={() => router.push('/auth/parent-forgot')}
          >
            <Text style={styles.link}>Forgot password?</Text>
          </TouchableOpacity>
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
});
