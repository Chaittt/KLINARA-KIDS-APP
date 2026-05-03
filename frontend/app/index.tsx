import { useRouter } from 'expo-router';
import { Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Body, Button, H1, H2, Muted } from '../src/ui';
import { colors, LOGO_URL, radii, shadow, spacing } from '../src/theme';

export default function Index() {
  const router = useRouter();
  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Image source={{ uri: LOGO_URL }} style={styles.logo} resizeMode="contain" />
          <H1 style={styles.brand}>Klinara Kids</H1>
          <Text style={styles.tagline}>Raising Little Stars</Text>
        </View>

        <View style={styles.welcome}>
          <H2 style={{ textAlign: 'center' }}>Welcome</H2>
          <Muted style={{ textAlign: 'center', marginTop: 8 }}>
            Choose how you'd like to continue
          </Muted>
        </View>

        <View style={styles.grid}>
          <TouchableOpacity
            testID="role-parent"
            activeOpacity={0.85}
            style={[styles.roleCard, { backgroundColor: colors.primary }]}
            onPress={() => router.push('/auth/parent-login')}
          >
            <View style={styles.iconWrap}>
              <Ionicons name="heart" size={28} color={colors.inverse} />
            </View>
            <Text style={styles.roleTitle}>Parent</Text>
            <Text style={styles.roleSubtitle}>View your child's updates</Text>
          </TouchableOpacity>

          <TouchableOpacity
            testID="role-staff"
            activeOpacity={0.85}
            style={[styles.roleCard, { backgroundColor: colors.golden }]}
            onPress={() => router.push('/auth/staff-login')}
          >
            <View style={styles.iconWrap}>
              <Ionicons name="school" size={28} color={colors.inverse} />
            </View>
            <Text style={styles.roleTitle}>School Staff</Text>
            <Text style={styles.roleSubtitle}>Manage classes and students</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.footer}>
          <Body style={{ textAlign: 'center', color: colors.textMuted, fontSize: 13 }}>
            By continuing you agree to our Terms & Privacy Policy
          </Body>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  container: {
    flexGrow: 1,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
  },
  header: {
    alignItems: 'center',
    marginTop: spacing.lg,
    marginBottom: spacing.xl,
  },
  logo: { width: 110, height: 110, marginBottom: spacing.md },
  brand: { textAlign: 'center', fontSize: 32 },
  tagline: {
    fontFamily: 'Georgia',
    fontStyle: 'italic',
    color: colors.golden,
    fontSize: 16,
    marginTop: 4,
  },
  welcome: { marginBottom: spacing.xl },
  grid: { gap: spacing.md, marginBottom: spacing.xl },
  roleCard: {
    borderRadius: radii.xl,
    padding: spacing.lg,
    minHeight: 150,
    justifyContent: 'space-between',
    ...shadow.card,
  },
  iconWrap: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  roleTitle: {
    fontFamily: 'Georgia',
    fontSize: 24,
    fontWeight: '700',
    color: colors.inverse,
    marginBottom: 4,
  },
  roleSubtitle: { color: 'rgba(255,255,255,0.9)', fontSize: 14 },
  footer: { marginTop: 'auto', paddingTop: spacing.lg },
});
