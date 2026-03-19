import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  StatusBar,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';

interface Category {
  id: string;
  name: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
}

const categories: Category[] = [
  { id: '1', name: 'AI Stack Tracker', icon: 'layers-outline', color: '#FF6B6B' },
  { id: '2', name: 'Prompts', icon: 'chatbubbles-outline', color: '#4ECDC4' },
  { id: '3', name: 'Informations', icon: 'information-circle-outline', color: '#45B7D1' },
  { id: '4', name: 'Tools', icon: 'build-outline', color: '#FFA07A' },
  { id: '5', name: 'Tutorials', icon: 'school-outline', color: '#98D8C8' },
  { id: '6', name: 'Open Source', icon: 'code-slash-outline', color: '#6C5CE7' },
  { id: '7', name: 'Lead Generation', icon: 'people-outline', color: '#A29BFE' },
  { id: '8', name: 'Personal Prompts', icon: 'bookmark-outline', color: '#FD79A8' },
  { id: '9', name: 'Photography', icon: 'camera-outline', color: '#FDCB6E' },
  { id: '10', name: 'Content Creation', icon: 'create-outline', color: '#00B894' },
  { id: '11', name: 'Marketing', icon: 'trending-up-outline', color: '#E17055' },
  { id: '12', name: 'Video Generation AI', icon: 'videocam-outline', color: '#00CEC9' },
];

export default function Index() {
  const router = useRouter();

  const handleCategoryPress = (category: Category) => {
    router.push({
      pathname: '/category/[name]',
      params: { name: category.name }
    });
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar barStyle="light-content" />
      
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Mission Control</Text>
        <Text style={styles.headerSubtitle}>AI Stack Keeper</Text>
      </View>

      {/* Category Grid */}
      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.grid}
        showsVerticalScrollIndicator={false}
      >
        {categories.map((category) => (
          <TouchableOpacity
            key={category.id}
            style={styles.card}
            onPress={() => handleCategoryPress(category)}
            activeOpacity={0.7}
          >
            <View style={[styles.iconContainer, { backgroundColor: category.color }]}>
              <Ionicons name={category.icon} size={32} color="#FFFFFF" />
            </View>
            <Text style={styles.cardTitle}>{category.name}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F0F0F',
  },
  header: {
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 24,
  },
  headerTitle: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 16,
    color: '#888888',
  },
  scrollView: {
    flex: 1,
  },
  grid: {
    padding: 16,
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  card: {
    width: '48%',
    backgroundColor: '#1A1A1A',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 140,
  },
  iconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
    textAlign: 'center',
    lineHeight: 18,
  },
});
