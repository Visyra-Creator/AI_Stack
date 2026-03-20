import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  StatusBar,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CategoryCard } from '../components/CategoryCard';
import { QuickActionCard } from '../components/QuickActionCard';
import { DashboardCategory, categories, quickActions } from '../data/categories';

export default function Index() {
  const router = useRouter();

  const handleCategoryPress = (category: DashboardCategory) => {
    if (category.id === 'learning') {
      router.navigate('/learning');
      return;
    }

    router.navigate({
      pathname: '/category/[name]',
      params: { name: category.title }
    });
  };

  const handleQuickActionPress = (actionRoute: string) => {
    if (actionRoute.startsWith('/category/')) {
      const categoryName = actionRoute.replace('/category/', '');
      const category = categories.find((item) => item.title === categoryName);
      if (category) {
        handleCategoryPress(category);
      }
      return;
    }

    router.navigate(actionRoute as never);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar barStyle="light-content" />
      
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Mission Control</Text>
        <Text style={styles.headerSubtitle}>Your AI-powered growth system</Text>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
          <Text style={styles.sectionHint}>Execution first</Text>
        </View>

        <View style={styles.quickActionsGrid}>
          {quickActions.map((action) => (
            <QuickActionCard
              key={action.id}
              title={action.title}
              icon={action.icon}
              accent={action.accent}
              onPress={() => handleQuickActionPress(action.route)}
            />
          ))}
        </View>

        <View style={[styles.sectionHeaderRow, styles.categorySectionHeader]}>
          <Text style={styles.sectionTitle}>Main Categories</Text>
          <Text style={styles.sectionHint}>5 focused systems</Text>
        </View>

        <View style={styles.categoryGrid}>
          {categories.map((category) => (
            <CategoryCard
              key={category.id}
              title={category.title}
              description={category.description}
              icon={category.icon}
              accent={category.accent}
                      onPress={() => handleCategoryPress(category)}
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
  header: {
    paddingHorizontal: 24,
    paddingTop: 14,
    paddingBottom: 18,
  },
  headerTitle: {
    fontSize: 34,
    fontWeight: 'bold',
    color: '#FFFFFF',
    letterSpacing: 0.4,
    marginBottom: 6,
  },
  headerSubtitle: {
    fontSize: 16,
    color: '#9AA0AB',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 24,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  sectionHint: {
    fontSize: 13,
    color: '#7E8694',
  },
  quickActionsGrid: {
    marginBottom: 28,
    gap: 10,
  },
  categorySectionHeader: {
    marginBottom: 14,
  },
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: 12,
  },
});
