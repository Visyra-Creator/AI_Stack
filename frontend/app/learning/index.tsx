import React, { useCallback, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { LearningCard } from '../../components/LearningCard';
import { parseAddContentMeta } from '../../data/add-content';
import { getItemsByCategory } from '../../services/api';

const RECENTLY_VIEWED_KEY = 'aikeeper.learning.recently-viewed.v1';

interface BackendItem {
  id: string;
  title: string;
  description: string;
  notes?: string;
  updatedAt?: string;
}

interface LearningListItem {
  id: string;
  title: string;
  description: string;
  itemId: string;
  notes?: string;
  isFavorite: boolean;
  sectionType: 'tutorials' | 'guides' | 'other';
  updatedAt?: string;
}

export default function LearningScreen() {
  const router = useRouter();
  const [items, setItems] = useState<LearningListItem[]>([]);
  const [recentlyViewedIds, setRecentlyViewedIds] = useState<string[]>([]);

  const loadRecentlyViewed = useCallback(async () => {
    try {
      const stored = await AsyncStorage.getItem(RECENTLY_VIEWED_KEY);
      if (!stored) {
        setRecentlyViewedIds([]);
        return;
      }

      const parsed = JSON.parse(stored) as string[];
      setRecentlyViewedIds(Array.isArray(parsed) ? parsed : []);
    } catch (error) {
      console.error('Failed to load recently viewed items:', error);
      setRecentlyViewedIds([]);
    }
  }, []);

  const loadLearningItems = useCallback(async () => {
    try {
      const response: BackendItem[] = await getItemsByCategory('Learning');
      const mapped: LearningListItem[] = response.map((item) => {
        const metadata = parseAddContentMeta(item.notes);
        const subcategories = metadata?.subcategories ?? (metadata?.subcategory ? [metadata.subcategory] : []);
        const hasTutorial = subcategories.some((value) => value.toLowerCase().includes('tutorial'));
        const hasGuide = subcategories.some((value) => value.toLowerCase().includes('guide'));

        return {
          id: `learning-${item.id}`,
          itemId: item.id,
          title: item.title,
          description: item.description || 'Uploaded learning content',
          notes: item.notes,
          isFavorite: Boolean(metadata?.isFavorite),
          sectionType: hasTutorial ? 'tutorials' : hasGuide ? 'guides' : 'other',
          updatedAt: item.updatedAt,
        };
      });

      setItems(mapped);
    } catch (error) {
      console.error('Failed to load learning items:', error);
      setItems([]);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadRecentlyViewed();
      loadLearningItems();
    }, [loadLearningItems, loadRecentlyViewed])
  );

  const recentlyViewedItems = useMemo(() => {
    const mapById = new Map(items.map((item) => [item.itemId, item]));
    return recentlyViewedIds
      .map((id) => mapById.get(id))
      .filter((item): item is LearningListItem => Boolean(item));
  }, [items, recentlyViewedIds]);

  const favoriteItems = useMemo(
    () => items.filter((item) => item.isFavorite),
    [items]
  );

  const notFavoriteItems = useMemo(
    () => items.filter((item) => !item.isFavorite),
    [items]
  );

  const getSourceLabel = (item: LearningListItem) => {
    if (item.sectionType === 'tutorials') {
      return 'Tutorials';
    }

    if (item.sectionType === 'guides') {
      return 'Guides';
    }

    return 'Miscellaneous';
  };

  const openItem = async (item: LearningListItem) => {
    const nextRecentlyViewed = [item.itemId, ...recentlyViewedIds.filter((id) => id !== item.itemId)].slice(0, 30);
    setRecentlyViewedIds(nextRecentlyViewed);

    try {
      await AsyncStorage.setItem(RECENTLY_VIEWED_KEY, JSON.stringify(nextRecentlyViewed));
    } catch (error) {
      console.error('Failed to save recently viewed items:', error);
    }

    router.navigate({
      pathname: '/item/[id]',
      params: {
        id: item.itemId,
        category: 'Learning',
        returnTo: '/learning',
      },
    });
  };

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Recently Viewed</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.horizontalList}>
            {recentlyViewedItems.map((item) => (
              <LearningCard
                key={item.id}
                title={item.title}
                description={item.description}
                sourceLabel={getSourceLabel(item)}
                compact
                onPress={() => openItem(item)}
              />
            ))}
            {recentlyViewedItems.length === 0 ? <Text style={styles.emptyText}>No recently viewed content.</Text> : null}
          </ScrollView>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Favorites</Text>
          <View style={styles.verticalList}>
            {favoriteItems.map((item) => (
              <LearningCard
                key={item.id}
                title={item.title}
                description={item.description}
                sourceLabel={getSourceLabel(item)}
                onPress={() => openItem(item)}
              />
            ))}
            {favoriteItems.length === 0 ? <Text style={styles.emptyText}>No favorite content yet.</Text> : null}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Not Favorites</Text>
          <View style={styles.verticalList}>
            {notFavoriteItems.map((item) => (
              <LearningCard
                key={item.id}
                title={item.title}
                description={item.description}
                sourceLabel={getSourceLabel(item)}
                onPress={() => openItem(item)}
              />
            ))}
            {notFavoriteItems.length === 0 ? <Text style={styles.emptyText}>No non-favorite content.</Text> : null}
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
    paddingTop: 18,
    paddingBottom: 28,
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
  emptyText: {
    color: '#7F8797',
    fontSize: 13,
    marginTop: 4,
  },
});

