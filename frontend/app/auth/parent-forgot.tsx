import { useRouter } from 'expo-router';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Button, H2, Muted } from '../../src/ui';
import { colors, radii, spacing } from '../../src/theme';

export default function ParentForgotPassword() {
  const router = useRouter();
  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <View style={styles.topBar}>
          <TouchableOpacity testID="parent-fp-back" onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="chevron-back" size={24} color={colors.text} />
          </TouchableOpacity>
        </View>

        <H2>Forgot Password</H2>
        <View style={styles.box} testID="parent-fp-message">
          <Ionicons name="call-outline" size={40} color={colors.primary} />
          <Text style={styles.title}>Contact the school office</Text>
          <Muted style={{ textAlign: 'center', marginTop: 6 }}>
            Please contact the school office. The MD will reset your password.
          </Muted>
          <Button
            testID="parent-fp-back-to-login"
            title="Back to Login"
            onPress={() => router.back()}
            style={{ marginTop: spacing.lg, alignSelf: 'stretch' }}
          />
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  container: { padding: spacing.lg, flex: 1 },
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
  box: {
    marginTop: spacing.lg,
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  title: { fontSize: 18, fontWeight: '700', color: colors.text, marginTop: spacing.sm },
});
