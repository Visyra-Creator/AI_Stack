import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LearningCard } from '../../components/LearningCard';
import { guidesAndResources } from '../../data/learning';

export default function GuidesScreen() {
  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.title}>Guides</Text>
        <Text style={styles.subtitle}>Deep dives and strategy references for your workflow.</Text>

        <View style={styles.listWrap}>
          {guidesAndResources.map((guide) => (
            <LearningCard
              key={guide.id}
              title={guide.title}
              description={guide.description}
              onPress={() => {}}
            />
          ))}
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
    marginBottom: 6,
  },
  subtitle: {
    color: '#9AA0AB',
    fontSize: 14,
    marginBottom: 18,
  },
  listWrap: {
    gap: 10,
  },
});

