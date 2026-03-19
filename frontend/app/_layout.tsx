import React from 'react';
import { Stack } from 'expo-router';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { LearningHeaderMenu } from '../components/LearningHeaderMenu';

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: '#0F0F0F' },
          animation: 'slide_from_right',
        }}
      >
        <Stack.Screen name="index" />
        <Stack.Screen
          name="learning/index"
          options={{
            headerShown: true,
            title: 'Learning',
            headerStyle: { backgroundColor: '#0F0F0F' },
            headerTintColor: '#FFFFFF',
            headerShadowVisible: false,
            headerRight: () => <LearningHeaderMenu />,
          }}
        />
        <Stack.Screen
          name="learning/tutorials"
          options={{
            headerShown: true,
            title: 'Tutorials',
            headerStyle: { backgroundColor: '#0F0F0F' },
            headerTintColor: '#FFFFFF',
            headerShadowVisible: false,
          }}
        />
        <Stack.Screen
          name="learning/guides"
          options={{
            headerShown: true,
            title: 'Guides',
            headerStyle: { backgroundColor: '#0F0F0F' },
            headerTintColor: '#FFFFFF',
            headerShadowVisible: false,
            headerRight: () => <LearningHeaderMenu />,
          }}
        />
        <Stack.Screen
          name="learning/tutorial/[id]"
          options={{
            headerShown: true,
            title: 'Tutorial',
            headerStyle: { backgroundColor: '#0F0F0F' },
            headerTintColor: '#FFFFFF',
            headerShadowVisible: false,
          }}
        />
        <Stack.Screen name="category/[name]" />
        <Stack.Screen name="item/[id]" />
        <Stack.Screen
          name="item/select-category"
          options={{
            presentation: 'modal',
            animation: 'slide_from_bottom',
          }}
        />
        <Stack.Screen
          name="item/add" 
          options={{
            presentation: 'modal',
            animation: 'slide_from_bottom',
          }}
        />
        <Stack.Screen
          name="item/file-viewer"
          options={{
            headerShown: true,
            title: 'Document Viewer',
            headerStyle: { backgroundColor: '#0F0F0F' },
            headerTintColor: '#FFFFFF',
            headerShadowVisible: false,
          }}
        />
        <Stack.Screen
          name="item/edit" 
          options={{
            presentation: 'modal',
            animation: 'slide_from_bottom',
          }}
        />
      </Stack>
    </GestureHandlerRootView>
  );
}
