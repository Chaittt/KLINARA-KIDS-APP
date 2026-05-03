import { Stack, useRouter, useSegments } from 'expo-router';
import { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StatusBar } from 'expo-status-bar';
import { AuthProvider, useAuth } from '../src/auth';
import { colors } from '../src/theme';

function RouteGuard() {
  const { user, loading } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    const seg0 = segments[0] as string | undefined;
    const inAuth = seg0 === 'auth';
    const inApp = seg0 === 'parent' || seg0 === 'teacher' || seg0 === 'admin';

    if (!user) {
      if (inApp) router.replace('/');
      return;
    }
    // Logged in
    if (!inApp) {
      if (user.role === 'parent') router.replace('/parent/home');
      else if (user.role === 'teacher') router.replace('/teacher/students');
      else router.replace('/admin');
    } else {
      // role mismatch protection
      if (user.role === 'parent' && seg0 !== 'parent') router.replace('/parent/home');
      if (user.role === 'teacher' && seg0 !== 'teacher') router.replace('/teacher/students');
      if ((user.role === 'admin' || user.role === 'md') && seg0 !== 'admin') router.replace('/admin');
    }
  }, [user, loading, segments]);

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background }}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }
  return null;
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <AuthProvider>
          <RouteGuard />
          <StatusBar style="dark" />
          <Stack
            screenOptions={{
              headerShown: false,
              contentStyle: { backgroundColor: colors.background },
            }}
          />
        </AuthProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
