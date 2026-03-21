import React from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ThemeProvider, useTheme } from '@/src/context/ThemeContext';
import { ErrorBoundary } from '@/src/components/common/ErrorBoundary';

import { ThemeProvider as NavThemeProvider, DarkTheme, DefaultTheme } from '@react-navigation/native';

function RootLayoutNav() {
  const { colors, mode } = useTheme();

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
      <StatusBar style={mode === 'dark' ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.background },
          animation: 'none',
          gestureEnabled: true,
          gestureDirection: 'horizontal',
        }}
      />
    </NavThemeProvider>
  );
}

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
