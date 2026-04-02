import React from 'react';
import { Stack, usePathname, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider, SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ThemeProvider, useTheme } from '@/src/context/ThemeContext';
import { ErrorBoundary } from '@/src/components/common/ErrorBoundary';

import { ThemeProvider as NavThemeProvider, DarkTheme, DefaultTheme } from '@react-navigation/native';



function RootLayoutNav() {
  const { colors, mode } = useTheme();
  const router = useRouter();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const hasLocalHomeControl =
    pathname === '/' ||
    pathname.startsWith('/notes') ||
    pathname.startsWith('/tutorials');

  const navTheme = mode === 'dark' ? {
    ...DarkTheme,
    colors: {
      ...DarkTheme.colors,
      background: colors.background,
      card: colors.card,
      primary: colors.primary,
      text: colors.text,
      border: colors.border,
      notification: colors.danger,
    }
  } : {
    ...DefaultTheme,
    colors: {
      ...DefaultTheme.colors,
      background: colors.background,
      card: colors.card,
      primary: colors.primary,
      text: colors.text,
      border: colors.border,
      notification: colors.danger,
    }
  };

  return (
    <NavThemeProvider value={navTheme}>
      <SafeAreaView
        style={[styles.container, { backgroundColor: colors.background }]}
        edges={['top', 'left', 'right', 'bottom']}
      >
        <StatusBar
          style={mode === 'dark' ? 'light' : 'dark'}
          translucent={false}
          backgroundColor={colors.background}
        />
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: colors.background },
            animation: 'none',
            gestureEnabled: true,
            gestureDirection: 'horizontal',
          }}
        />

        {!hasLocalHomeControl && (
          <TouchableOpacity
            onPress={() => router.push('/')}
            style={[
              styles.homeFab,
              {
                bottom: insets.bottom + 16,
                left: 16,
                backgroundColor: colors.primary,
              },
            ]}
            activeOpacity={0.9}
          >
            <Ionicons name="home" size={18} color="#FFFFFF" />
          </TouchableOpacity>
        )}
      </SafeAreaView>
    </NavThemeProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  homeFab: {
    position: 'absolute',
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
    zIndex: 999,
  },
});

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <ErrorBoundary
          onError={(error, errorInfo) => {
            console.error('🔴 App Error:', error);
            console.error('📍 Component Stack:', errorInfo.componentStack);
          }}
        >
          <RootLayoutNav />
        </ErrorBoundary>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
