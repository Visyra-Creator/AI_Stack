import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  TextInput,
  FlatList,
  ActivityIndicator,
  Modal,
  Pressable,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/src/context/ThemeContext';
import { dashboardStorage } from '@/src/services/storage';

interface AppSection {
  title: string;
  route: string;
  storageKey: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
}

interface AllItem {
  id: string;
  title: string;
  category: string;
  sectionTitle: string;
  sectionRoute: string;
  createdAt: number;
  updatedAt: number;
  isFavorite?: boolean;
  hasImage?: boolean;
  hasDocs?: boolean;
  hasLink?: boolean;
}

type SortOption = 'recent' | 'oldest' | 'name-asc' | 'name-desc';
type FilterOption = 'all' | 'favorites' | 'has-image' | 'has-docs' | 'has-link' | string;

const APP_SECTIONS: AppSection[] = [
  { title: 'AI Stack', route: '/ai-stack', storageKey: 'ai_stack', icon: 'layers-outline', color: '#6366F1' },
  { title: 'Prompts', route: '/prompts', storageKey: 'prompts', icon: 'chatbubble-outline', color: '#8B5CF6' },
  { title: 'Tools', route: '/tools', storageKey: 'tools', icon: 'construct-outline', color: '#EC4899' },
  { title: 'Tutorials', route: '/tutorials', storageKey: 'tutorials', icon: 'play-circle-outline', color: '#F59E0B' },
  { title: 'Open Source', route: '/open-source', storageKey: 'open_source', icon: 'git-branch-outline', color: '#10B981' },
  { title: 'Lead Gen', route: '/lead-generation', storageKey: 'lead_generation', icon: 'people-outline', color: '#06B6D4' },
  { title: 'Business', route: '/business', storageKey: 'business', icon: 'briefcase-outline', color: '#EF4444' },
  { title: 'Content', route: '/content-creation', storageKey: 'content_creation', icon: 'create-outline', color: '#84CC16' },
  { title: 'Website', route: '/website', storageKey: 'website', icon: 'globe-outline', color: '#F97316' },
  { title: 'Reference', route: '/reference', storageKey: 'reference', icon: 'book-outline', color: '#0EA5E9' },
  { title: 'Marketing', route: '/marketing', storageKey: 'marketing', icon: 'megaphone-outline', color: '#14B8A6' },
  { title: 'Notes', route: '/notes', storageKey: 'notes', icon: 'document-text-outline', color: '#A78BFA' },
];

export default function AllScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [items, setItems] = useState<AllItem[]>([]);
  const [sortBy, setSortBy] = useState<SortOption>('recent');
  const [filterBy, setFilterBy] = useState<FilterOption>('all');
  const [sortVisible, setSortVisible] = useState(false);
  const [filterVisible, setFilterVisible] = useState(false);

  const loadAllItems = useCallback(async () => {
    setLoading(true);
    try {
      const collected: AllItem[] = [];

      for (const section of APP_SECTIONS) {
        try {
          const sectionItems = await dashboardStorage.getByStorageKey<any>(section.storageKey);
          for (const item of sectionItems) {
            const hasImage = Boolean(
              item.image ||
                item.images?.length ||
                item.inputImage ||
                item.inputImages?.length ||
                item.generatedImage ||
                item.generatedImages?.length
            );
            const hasDocs = Boolean(
              item.files?.length ||
                item.documents?.length ||
                item.docFiles?.length ||
                item.uploadedDocs?.length
            );
            const hasLink = Boolean(
              item.url ||
                item.link ||
                item.videoLink ||
                item.websiteLink ||
                item.sourceLink ||
                item.projectLink
            );

            collected.push({
              id: item.id,
              title: item.toolName || item.promptName || item.tutorialName || item.name || item.sectionName || item.title || 'Untitled',
              category: item.category || (Array.isArray(item.categories) ? item.categories.join(', ') : '') || section.title,
              sectionTitle: section.title,
              sectionRoute: section.route,
              createdAt: item.createdAt || 0,
              updatedAt: item.updatedAt || item.createdAt || 0,
              isFavorite: item.isFavorite || false,
              hasImage,
              hasDocs,
              hasLink,
            });
          }
        } catch (error) {
          console.error(`Failed to load ${section.storageKey}:`, error);
        }
      }

      collected.sort((a, b) => (b.updatedAt || b.createdAt) - (a.updatedAt || a.createdAt));
      setItems(collected);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadAllItems();
    }, [loadAllItems])
  );

  const filteredItems = useMemo(() => {
    const q = search.trim().toLowerCase();
    let nextItems = items.filter(
      (item) =>
        item.title.toLowerCase().includes(q) ||
        item.category.toLowerCase().includes(q) ||
        item.sectionTitle.toLowerCase().includes(q)
    );

    if (filterBy === 'favorites') {
      nextItems = nextItems.filter((item) => item.isFavorite);
    } else if (filterBy === 'has-image') {
      nextItems = nextItems.filter((item) => item.hasImage);
    } else if (filterBy === 'has-docs') {
      nextItems = nextItems.filter((item) => item.hasDocs);
    } else if (filterBy === 'has-link') {
      nextItems = nextItems.filter((item) => item.hasLink);
    } else if (filterBy !== 'all') {
      nextItems = nextItems.filter((item) => item.sectionTitle === filterBy);
    }

    nextItems = [...nextItems].sort((a, b) => {
      const aTime = a.updatedAt || a.createdAt || 0;
      const bTime = b.updatedAt || b.createdAt || 0;
      const aName = a.title.toLowerCase();
      const bName = b.title.toLowerCase();

      switch (sortBy) {
        case 'oldest':
          return aTime - bTime;
        case 'name-asc':
          return aName.localeCompare(bName);
        case 'name-desc':
          return bName.localeCompare(aName);
        case 'recent':
        default:
          return bTime - aTime;
      }
    });

    return nextItems;
  }, [items, search, filterBy, sortBy]);

  const filterLabelMap: Record<string, string> = {
    all: 'All',
    favorites: 'Favorites',
    'has-image': 'Image',
    'has-docs': 'Docs',
    'has-link': 'Link',
  };
  const filterLabel = filterLabelMap[filterBy] || filterBy;
  const sortLabelMap: Record<SortOption, string> = {
    recent: 'Recent',
    oldest: 'Oldest',
    'name-asc': 'A-Z',
    'name-desc': 'Z-A',
  };

  const stats = useMemo(() => {
    const total = items.length;
    const favorites = items.filter((item) => item.isFavorite).length;
    const sectionsCount = new Set(items.map((item) => item.sectionTitle)).size;
    const lastUpdated = items[0]?.updatedAt || items[0]?.createdAt || 0;
    return { total, favorites, sectionsCount, lastUpdated };
  }, [items]);

  const formatTime = (timestamp: number) => {
    if (!timestamp) return 'No time';
    const diff = Date.now() - timestamp;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (minutes < 1) return 'Just now';
    if (hours < 1) return `${minutes}m ago`;
    if (days < 1) return `${hours}h ago`;
    return `${days}d ago`;
  };

  return (
    <>
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={[styles.backButton, { backgroundColor: colors.card }]}>
          <Ionicons name="arrow-back" size={20} color={colors.text} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={[styles.title, { color: colors.text }]}>All</Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>Everything in one place</Text>
        </View>
      </View>

      <View style={[styles.searchBar, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Ionicons name="search-outline" size={18} color={colors.textSecondary} />
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Search all items..."
          placeholderTextColor={colors.textSecondary}
          style={[styles.searchInput, { color: colors.text }]}
        />
        {search ? (
          <TouchableOpacity onPress={() => setSearch('')}>
            <Ionicons name="close-outline" size={18} color={colors.textSecondary} />
          </TouchableOpacity>
        ) : null}
        <TouchableOpacity
          onPress={() => setFilterBy(filterBy === 'favorites' ? 'all' : 'favorites')}
          style={[
            styles.actionPill,
            { backgroundColor: filterBy === 'favorites' ? colors.primary : colors.background },
          ]}
        >
          <Ionicons
            name={filterBy === 'favorites' ? 'heart' : 'heart-outline'}
            size={14}
            color={filterBy === 'favorites' ? '#FFFFFF' : '#EC4899'}
          />
          <Text
            style={[
              styles.actionPillText,
              { color: filterBy === 'favorites' ? '#FFFFFF' : colors.textSecondary },
            ]}
            numberOfLines={1}
          >
            Fav
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => setFilterVisible(true)}
          style={[styles.actionPill, { backgroundColor: colors.background }]}
        >
          <Ionicons name="filter-outline" size={14} color={colors.textSecondary} />
          <Text style={[styles.actionPillText, { color: colors.textSecondary }]} numberOfLines={1}>
            {filterLabel}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => setSortVisible(true)}
          style={[styles.actionPill, { backgroundColor: colors.background }]}
        >
          <Ionicons name="swap-vertical-outline" size={14} color={colors.textSecondary} />
          <Text style={[styles.actionPillText, { color: colors.textSecondary }]} numberOfLines={1}>
            {sortLabelMap[sortBy]}
          </Text>
        </TouchableOpacity>
      </View>

      <View style={styles.statsRow}>
        <View style={[styles.statCard, { backgroundColor: colors.card }]}>
          <Ionicons name="layers-outline" size={18} color={colors.primary} />
          <Text style={[styles.statValue, { color: colors.text }]}>{stats.total}</Text>
          <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Total Items</Text>
        </View>
        <View style={[styles.statCard, { backgroundColor: colors.card }]}>
          <Ionicons name="heart-outline" size={18} color="#EC4899" />
          <Text style={[styles.statValue, { color: colors.text }]}>{stats.favorites}</Text>
          <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Favorites</Text>
        </View>
        <View style={[styles.statCard, { backgroundColor: colors.card }]}>
          <Ionicons name="folder-outline" size={18} color="#F59E0B" />
          <Text style={[styles.statValue, { color: colors.text }]}>{stats.sectionsCount}</Text>
          <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Sections</Text>
        </View>
        <View style={[styles.statCard, { backgroundColor: colors.card }]}>
          <Ionicons name="time-outline" size={18} color="#10B981" />
          <Text style={[styles.statValue, { color: colors.text }]}>{formatTime(stats.lastUpdated)}</Text>
          <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Last Updated</Text>
        </View>
      </View>

      {loading ? (
        <View style={styles.loader}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : filteredItems.length === 0 ? (
        <View style={[styles.emptyState, { backgroundColor: colors.card }]}>
          <Ionicons name="search-outline" size={42} color={colors.textSecondary} />
          <Text style={[styles.emptyTitle, { color: colors.text }]}>No items found</Text>
          <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>Try a different keyword.</Text>
        </View>
      ) : (
        <FlatList
          data={filteredItems}
          keyExtractor={(item) => `${item.sectionTitle}-${item.id}`}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => {
            const section = APP_SECTIONS.find((s) => s.title === item.sectionTitle);
            return (
              <TouchableOpacity
                style={[styles.itemCard, { backgroundColor: colors.card }]}
                activeOpacity={0.8}
                onPress={() => router.push(item.sectionRoute as any)}
              >
                <View style={[styles.itemIcon, { backgroundColor: `${section?.color || colors.primary}20` }]}>
                  <Ionicons name={section?.icon || 'grid-outline'} size={18} color={section?.color || colors.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.itemTitle, { color: colors.text }]} numberOfLines={1}>
                    {item.title}
                  </Text>
                  <Text style={[styles.itemMeta, { color: colors.textSecondary }]} numberOfLines={1}>
                    {item.sectionTitle}{item.category ? ` • ${item.category}` : ''}
                  </Text>
                </View>
                <View style={[styles.timeBadge, { backgroundColor: colors.background }]}>
                  <Text style={[styles.timeText, { color: colors.textSecondary }]}>{formatTime(item.updatedAt || item.createdAt)}</Text>
                </View>
              </TouchableOpacity>
            );
          }}
        />
      )}
      </SafeAreaView>

      <Modal visible={filterVisible} transparent animationType="fade" onRequestClose={() => setFilterVisible(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setFilterVisible(false)}>
          <Pressable style={[styles.modalCard, { backgroundColor: colors.card }]} onPress={() => {}}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>Filter by</Text>
            {([
              ['all', 'All'],
              ['favorites', 'Favorites'],
              ['has-image', 'Has Image'],
              ['has-docs', 'Has Docs'],
              ['has-link', 'Has Link'],
            ] as const).map(([value, label]) => (
              <TouchableOpacity
                key={value}
                style={styles.modalItem}
                onPress={() => {
                  setFilterBy(value);
                  setFilterVisible(false);
                }}
              >
                <Text style={[styles.modalItemText, { color: colors.text }]}>{label}</Text>
              </TouchableOpacity>
            ))}
            {APP_SECTIONS.map((section) => (
              <TouchableOpacity
                key={section.title}
                style={styles.modalItem}
                onPress={() => {
                  setFilterBy(section.title);
                  setFilterVisible(false);
                }}
              >
                <Text style={[styles.modalItemText, { color: colors.text }]}>{section.title}</Text>
              </TouchableOpacity>
            ))}
          </Pressable>
        </Pressable>
      </Modal>

      <Modal visible={sortVisible} transparent animationType="fade" onRequestClose={() => setSortVisible(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setSortVisible(false)}>
          <Pressable style={[styles.modalCard, { backgroundColor: colors.card }]} onPress={() => {}}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>Sort by</Text>
            {([
              ['recent', 'Recent'],
              ['oldest', 'Oldest'],
              ['name-asc', 'A-Z'],
              ['name-desc', 'Z-A'],
            ] as const).map(([value, label]) => (
              <TouchableOpacity
                key={value}
                style={styles.modalItem}
                onPress={() => {
                  setSortBy(value);
                  setSortVisible(false);
                }}
              >
                <Text style={[styles.modalItemText, { color: colors.text }]}>{label}</Text>
              </TouchableOpacity>
            ))}
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 10,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: { fontSize: 26, fontWeight: '800' },
  subtitle: { fontSize: 13, marginTop: 2, fontWeight: '500' },
  searchBar: {
    marginHorizontal: 16,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  searchInput: { flex: 1, fontSize: 14, fontWeight: '500' },
  actionPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 999,
    maxWidth: 78,
  },
  actionPillText: {
    fontSize: 11,
    fontWeight: '600',
    flexShrink: 1,
  },
  statsRow: {
    flexDirection: 'row',
    flexWrap: 'nowrap',
    gap: 6,
    paddingHorizontal: 12,
    marginBottom: 12,
  },
  statCard: {
    flex: 1,
    minWidth: 0,
    maxWidth: '24%',
    borderRadius: 16,
    paddingHorizontal: 8,
    paddingVertical: 10,
    minHeight: 78,
    alignItems: 'center',
  },
  statValue: { fontSize: 14, fontWeight: '800', marginTop: 8, textAlign: 'center' },
  statLabel: { fontSize: 10, fontWeight: '600', marginTop: 3, textAlign: 'center', lineHeight: 12 },
  loader: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyState: {
    margin: 16,
    paddingVertical: 36,
    paddingHorizontal: 20,
    borderRadius: 18,
    alignItems: 'center',
  },
  emptyTitle: { fontSize: 16, fontWeight: '700', marginTop: 12 },
  emptySubtitle: { fontSize: 13, marginTop: 6 },
  listContent: { paddingHorizontal: 16, paddingBottom: 24 },
  itemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 14,
    marginBottom: 10,
  },
  itemIcon: {
    width: 42,
    height: 42,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  itemTitle: { fontSize: 15, fontWeight: '700' },
  itemMeta: { fontSize: 12, marginTop: 4, fontWeight: '500' },
  timeBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  timeText: { fontSize: 11, fontWeight: '600' },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  modalCard: {
    width: '100%',
    maxWidth: 360,
    borderRadius: 18,
    padding: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 10,
  },
  modalItem: {
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#ffffff22',
  },
  modalItemText: {
    fontSize: 14,
    fontWeight: '600',
  },
});

