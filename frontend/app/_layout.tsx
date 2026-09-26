import { Stack, useRouter, useSegments } from 'expo-router';
import { useEffect } from 'react';
import { ActivityIndicator, Alert, Platform, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StatusBar } from 'expo-status-bar';
import * as Notifications from 'expo-notifications';
import * as Linking from 'expo-linking';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AuthProvider, useAuth } from '../src/auth';
import { api } from '../src/api';
import { colors } from '../src/theme';

// 1. Foreground notification behavior — module scope, native only
if (Platform.OS !== 'web') {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
}

// 2. Android channel — module scope, before any push arrives
if (Platform.OS === 'android') {
  Notifications.setNotificationChannelAsync('default', {
    name: 'Default',
    importance: Notifications.AndroidImportance.MAX,
    sound: 'default',
  });
}

async function maybeNudge(status: string, canAskAgain: boolean) {
  if (status !== 'denied' || canAskAgain) return;
  const last = await AsyncStorage.getItem('pushNudgeAt');
  const week = 7 * 24 * 60 * 60 * 1000;
  if (last && Date.now() - Number(last) <= week) return;
  Alert.alert(
    'Turn on notifications',
    'Get instant alerts for announcements, daily activities and fee updates.',
    [
      { text: 'Later', style: 'cancel', onPress: () => AsyncStorage.setItem('pushNudgeAt', String(Date.now())) },
      {
        text: 'Open Settings',
        onPress: () => {
          AsyncStorage.setItem('pushNudgeAt', String(Date.now()));
          Linking.openSettings();
        },
      },
    ]
  );
}

function PushManager() {
  const { user } = useAuth();
  const router = useRouter();

  // Register this device for push whenever a user is signed in
  useEffect(() => {
    if (Platform.OS === 'web' || !user) return;
    (async () => {
      try {
        const { status, canAskAgain } = await Notifications.requestPermissionsAsync();
        if (status !== 'granted') {
          await maybeNudge(status, canAskAgain);
          return;
        }
        const tokenResp = await Notifications.getDevicePushTokenAsync();
        await api('/register-push', {
          method: 'POST',
          body: { user_id: user.id, platform: Platform.OS, device_token: String(tokenResp.data) },
        });
      } catch {
        // Expo Go / simulator / no native FCM-APNs — push works only in a real build
      }
    })();
  }, [user]);

  // Handle notification taps → open the relevant existing screen
  useEffect(() => {
    if (Platform.OS === 'web') return;
    const route = (data: any) => {
      const url = data?.deeplink || data?.action_url;
      if (!url) return;
      if (String(url).startsWith('http')) Linking.openURL(String(url));
      else router.push(String(url) as any);
    };
    const sub = Notifications.addNotificationResponseReceivedListener((r) =>
      route(r.notification.request.content.data || {})
    );
    Notifications.getLastNotificationResponseAsync().then((r) => {
      if (r) route(r.notification.request.content.data || {});
    });
    return () => {
      sub.remove();
    };
  }, []);

  return null;
}

function RouteGuard() {
  const { user, loading } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    const seg0 = segments[0] as string | undefined;
    const inApp = seg0 === 'parent' || seg0 === 'teacher' || seg0 === 'admin';

    if (!user) {
      if (inApp) router.replace('/');
      return;
    }
    // Logged in
    const isStaff = user.role === 'teacher' || user.role === 'admin' || user.role === 'md';
    const allowStudentRoute = isStaff && seg0 === 'student';
    if (!inApp && !allowStudentRoute) {
      if (user.role === 'parent') router.replace('/parent/home');
      else if (user.role === 'teacher') router.replace('/teacher/students');
      else router.replace('/admin');
    } else if (inApp) {
      // role mismatch protection
      if (user.role === 'parent' && seg0 !== 'parent') router.replace('/parent/home');
      if (user.role === 'teacher' && seg0 !== 'teacher' && seg0 !== 'student') router.replace('/teacher/students');
      if ((user.role === 'admin' || user.role === 'md') && seg0 !== 'admin' && seg0 !== 'student') router.replace('/admin');
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
          <PushManager />
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
