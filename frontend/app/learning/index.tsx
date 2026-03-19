import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LearningCard } from '../../components/LearningCard';
import {
  featuredTutorials,
  guidesAndResources,
  recentlyViewed,
} from '../../data/learning';

export default function LearningScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.title}>Learning</Text>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Featured Tutorials</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.horizontalList}
          >
            {featuredTutorials.map((item) => (
              <LearningCard
                key={item.id}
                title={item.title}
                description={item.description}
                compact
                onPress={() => router.push(item.route)}
              />
            ))}
          </ScrollView>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Guides & Resources</Text>
          <View style={styles.verticalList}>
            {guidesAndResources.map((item) => (
              <LearningCard
                key={item.id}
                title={item.title}
                description={item.description}
                onPress={() => router.push(item.route)}
              />
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Recently Viewed</Text>
          <View style={styles.verticalList}>
            {recentlyViewed.map((item) => (
              <LearningCard
                key={item.id}
                title={item.title}
                description={item.description}
                onPress={() => router.push(item.route)}
              />
            ))}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F0F0F',
  },
  scrollView: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 28,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 30,
    fontWeight: '700',
    marginBottom: 18,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 10,
  },
  horizontalList: {
    paddingRight: 8,
  },
  verticalList: {
    gap: 10,
  },
});

