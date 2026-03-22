import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  Pressable,
  Dimensions,
  FlatList,
  Image,
  Alert,
  BackHandler,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/src/context/ThemeContext';
import { dashboardStorage } from '@/src/services/storage';

const { width: screenWidth } = Dimensions.get('window');

interface RecentGeneratedImage {
  id: string;
  uri: string;
  timestamp: number;
}

interface DashboardItem {
  id: string;
  title: string;
  category: string;
  createdAt: number;
  updatedAt?: number;
  lastUsedAt?: number;
  usageCount?: number;
  isFavorite?: boolean;
  favoritedAt?: number;
}

interface CategoryStats {
  name: string;
  count: number;
  lastUpdated: number;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
}

interface ActivityLog {
  id: string;
  action: string;
  category: string;
  timestamp: number;
  icon: keyof typeof Ionicons.glyphMap;
}

interface Section {
  id: string;
  title: string;
  icon: keyof typeof Ionicons.glyphMap;
  route: string;
  color: string;
  storageKey: string;
}

interface MenuSection {
  id: string;
  title: string;
  icon: keyof typeof Ionicons.glyphMap;
  route: string;
  color: string;
  showCount?: boolean;
}

const sections: Section[] = [
  { id: 'ai-stack', title: 'AI Stack', icon: 'layers-outline', route: '/ai-stack', color: '#6366F1', storageKey: 'ai_stack' },
  { id: 'prompts', title: 'Prompts', icon: 'chatbubble-outline', route: '/prompts', color: '#8B5CF6', storageKey: 'prompts' },
  { id: 'tools', title: 'Tools', icon: 'construct-outline', route: '/tools', color: '#EC4899', storageKey: 'tools' },
  { id: 'tutorials', title: 'Tutorials', icon: 'play-circle-outline', route: '/tutorials', color: '#F59E0B', storageKey: 'tutorials' },
  { id: 'open-source', title: 'Open Source', icon: 'git-branch-outline', route: '/open-source', color: '#10B981', storageKey: 'open_source' },
  { id: 'lead-gen', title: 'Lead Gen', icon: 'people-outline', route: '/lead-generation', color: '#06B6D4', storageKey: 'lead_generation' },
  { id: 'business', title: 'Business', icon: 'briefcase-outline', route: '/business', color: '#EF4444', storageKey: 'business' },
  { id: 'content', title: 'Content', icon: 'create-outline', route: '/content-creation', color: '#84CC16', storageKey: 'content_creation' },
  { id: 'website', title: 'Website', icon: 'globe-outline', route: '/website', color: '#F97316', storageKey: 'website' },
  { id: 'reference', title: 'Reference', icon: 'book-outline', route: '/reference', color: '#0EA5E9', storageKey: 'reference' },
  { id: 'marketing', title: 'Marketing', icon: 'megaphone-outline', route: '/marketing', color: '#14B8A6', storageKey: 'marketing' },
  { id: 'notes', title: 'Notes', icon: 'document-text-outline', route: '/notes', color: '#A78BFA', storageKey: 'notes' },
];

const menuSections: MenuSection[] = [
  ...sections.map(({ storageKey, ...section }) => ({ ...section, showCount: true })),
  {
    id: 'settings',
    title: 'Settings',
    icon: 'settings-outline',
    route: '/settings',
    color: '#94A3B8',
    showCount: false,
  },
];

export default function HomeScreen() {
  const router = useRouter();
  const { colors, mode, toggleTheme } = useTheme();
  const cloudSyncEnabled =
    process.env.EXPO_PUBLIC_USE_POCKETBASE === 'true' &&
    !!process.env.EXPO_PUBLIC_POCKETBASE_URL;
  const [lastSyncedAt, setLastSyncedAt] = useState<number | null>(null);
  const [isManualSyncing, setIsManualSyncing] = useState(false);
  const [isMenuVisible, setIsMenuVisible] = useState(false);
  const [dateTime, setDateTime] = useState(new Date());

  // Dashboard data
  const [allItems, setAllItems] = useState<DashboardItem[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [weekCount, setWeekCount] = useState(0);
  const [categoryStats, setCategoryStats] = useState<CategoryStats[]>([]);
  const [recentItems, setRecentItems] = useState<DashboardItem[]>([]);
  const [favorites, setFavorites] = useState<DashboardItem[]>([]);
  const [activities, setActivities] = useState<ActivityLog[]>([]);
  const [topCategories, setTopCategories] = useState<CategoryStats[]>([]);
  const [lastActivityTime, setLastActivityTime] = useState<number>(0);
  const [recentGeneratedImages, setRecentGeneratedImages] = useState<RecentGeneratedImage[]>([]);
  const [syncToast, setSyncToast] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const syncToastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showSyncToast = useCallback((text: string, type: 'success' | 'error') => {
    if (syncToastTimerRef.current) {
      clearTimeout(syncToastTimerRef.current);
    }
    setSyncToast({ text, type });
    syncToastTimerRef.current = setTimeout(() => {
      setSyncToast(null);
      syncToastTimerRef.current = null;
    }, 2000);
  }, []);

  const formatDateTime = (date: Date) => {
    const options: Intl.DateTimeFormatOptions = { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' };
    const dateStr = date.toLocaleDateString('en-US', options);
    const timeStr = date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });
    return { date: dateStr, time: timeStr };
  };

  const formatRelativeTime = (timestamp: number): string => {
    const now = Date.now();
    const diff = now - timestamp;
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    const weeks = Math.floor(days / 7);

    if (seconds < 60) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    if (weeks < 4) return `${weeks}w ago`;
    return 'A while ago';
  };

  const loadAllData = useCallback(async () => {
    const now = Date.now();
    const weekAgo = now - 7 * 24 * 60 * 60 * 1000;

    let allItems: DashboardItem[] = [];
    const categoryMap: Record<string, CategoryStats> = {};
    const activityList: ActivityLog[] = [];
    const generatedImagesList: RecentGeneratedImage[] = [];
    let maxLastActivity = 0;
    let weeklyCount = 0;

    // Load data from all categories
    for (const section of sections) {
      try {
        const items = await dashboardStorage.getByStorageKey<any>(section.storageKey);

        const categoryItems: DashboardItem[] = items.map((item: any) => ({
          id: item.id,
          title: item.toolName || item.promptName || item.tutorialName || item.name || item.sectionName || 'Untitled',
          category: section.title,
          createdAt: item.createdAt || 0,
          updatedAt: item.updatedAt || item.createdAt || 0,
          lastUsedAt: item.lastUsedAt,
          usageCount: item.usageCount || 0,
          isFavorite: item.isFavorite || false,
          favoritedAt: item.favoritedAt || 0,
        }));

        allItems = [...allItems, ...categoryItems];

        // Track category stats
        const lastUpdate = items.length > 0 ? Math.max(...items.map((i: any) => i.updatedAt || i.createdAt || 0)) : 0;
        categoryMap[section.storageKey] = {
          name: section.title,
          count: items.length,
          lastUpdated: lastUpdate,
          icon: section.icon,
          color: section.color,
        };

        // Count items added this week
        const weeklyItems = items.filter((item: any) => (item.createdAt || 0) > weekAgo);
        weeklyCount += weeklyItems.length;

        // Track max last activity
        maxLastActivity = Math.max(maxLastActivity, lastUpdate);

        // Generate activity logs
        if (items.length > 0) {
          const recentItem = items[0];
          activityList.push({
            id: recentItem.id,
            action: `Added to ${section.title}`,
            category: section.title,
            timestamp: recentItem.createdAt || 0,
            icon: section.icon,
          });
        }

        // Pull ONLY generated images from Prompts
        if (section.storageKey === 'prompts') {
          for (const item of items) {
            const singleImageUri = item.generatedImages?.[0] || item.generatedImage;
            if (singleImageUri) {
               if (typeof singleImageUri === 'string' && singleImageUri.startsWith('{')) {
                 try {
                   const parsed = JSON.parse(singleImageUri);
                   if (parsed?.uri) {
                     generatedImagesList.push({
                       id: `${item.id}-single`,
                       uri: parsed.uri,
                       timestamp: item.createdAt || 0,
                     });
                   }
                 } catch {}
               } else {
                 generatedImagesList.push({
                   id: `${item.id}-single`,
                   uri: singleImageUri,
                   timestamp: item.createdAt || 0,
                 });
               }
            }
          }
        }
      } catch (error) {
        console.error(`Error loading ${section.storageKey}:`, error);
      }
    }

    // Sort and organize data
    const sortedItems = allItems.sort((a, b) => (b.updatedAt || b.createdAt) - (a.updatedAt || a.createdAt));
    const favoriteItems = allItems
      .filter(item => item.isFavorite)
      .sort((a, b) => {
        const timeA = a.favoritedAt || a.updatedAt || a.createdAt || 0;
        const timeB = b.favoritedAt || b.updatedAt || b.createdAt || 0;
        return timeB - timeA;
      })
      .slice(0, 5);
    const recentItemsList = sortedItems.slice(0, 3);
    const sortedActivities = activityList.sort((a, b) => b.timestamp - a.timestamp).slice(0, 5);
    const topCatsArray = Object.values(categoryMap)
      .filter(cat => cat.count > 0)
      .sort((a, b) => b.count - a.count)
      .slice(0, 3);
    const sortedGeneratedImages = generatedImagesList
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, 16);

    setAllItems(sortedItems);
    setTotalCount(allItems.length);
    setWeekCount(weeklyCount);
    setCategoryStats(Object.values(categoryMap).filter(cat => cat.count > 0));
    setRecentItems(recentItemsList);
    setFavorites(favoriteItems);
    setActivities(sortedActivities);
    setTopCategories(topCatsArray);
    setLastActivityTime(maxLastActivity);
    setRecentGeneratedImages(sortedGeneratedImages);
    if (cloudSyncEnabled) {
      setLastSyncedAt(Date.now());
    }
  }, [cloudSyncEnabled]);

  const formatRelativeSync = (timestamp: number): string => {
    const diff = Date.now() - timestamp;
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (seconds < 60) return 'just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return `${days}d ago`;
  };

  useFocusEffect(
    useCallback(() => {
      loadAllData();
    }, [loadAllData])
  );

  useFocusEffect(
    useCallback(() => {
      const onBackPress = () => {
        Alert.alert('Exit App', 'Are you sure you want to exit?', [
          { text: 'Cancel', style: 'cancel', onPress: () => null },
          { text: 'Exit', style: 'destructive', onPress: () => BackHandler.exitApp() },
        ]);
        return true;
      };

      const subscription = BackHandler.addEventListener('hardwareBackPress', onBackPress);
      return () => subscription.remove();
    }, [])
  );

  useEffect(() => {
    const timer = setInterval(() => {
      setDateTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    return () => {
      if (syncToastTimerRef.current) {
        clearTimeout(syncToastTimerRef.current);
      }
    };
  }, []);

  const navigateToSection = (route: string) => {
    setIsMenuVisible(false);
    router.push(route as any);
  };

  const handleManualSync = useCallback(async () => {
    if (!cloudSyncEnabled || isManualSyncing) return;
    setIsManualSyncing(true);
    try {
      await loadAllData();
      setLastSyncedAt(Date.now());
      showSyncToast('Synced successfully', 'success');
    } catch (error) {
      console.error('Manual dashboard sync failed:', error);
      showSyncToast('Sync failed', 'error');
    } finally {
      setIsManualSyncing(false);
    }
  }, [cloudSyncEnabled, isManualSyncing, loadAllData, showSyncToast]);

  const { date, time } = formatDateTime(dateTime);
  const getMostActiveCategory = (): string => {
    return topCategories[0]?.name || 'None';
  };

  const hasActivity = allItems.length > 0;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.greeting, { color: colors.textSecondary }]}>Welcome back!</Text>
          <Text style={[styles.lastActivity, { color: colors.textSecondary }]}>
            {lastActivityTime > 0 ? `Last activity: ${formatRelativeTime(lastActivityTime)}` : 'No activity yet'}
          </Text>
          <Text style={[styles.syncStatus, { color: colors.textSecondary }]}>
            {cloudSyncEnabled ? 'Sync: Local + PocketBase' : 'Sync: Local only'}
          </Text>
          {cloudSyncEnabled && (
            <Text style={[styles.syncMeta, { color: colors.textSecondary }]}>
              {lastSyncedAt ? `Last sync: ${formatRelativeSync(lastSyncedAt)}` : 'Last sync: pending'}
            </Text>
          )}
        </View>
        <View style={styles.headerActions}>
          {cloudSyncEnabled && (
            <TouchableOpacity
              style={[styles.headerButton, { backgroundColor: colors.surface }]}
              onPress={handleManualSync}
              disabled={isManualSyncing}
            >
              <Ionicons
                name={isManualSyncing ? 'sync' : 'sync-outline'}
                size={20}
                color={colors.text}
              />
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={[styles.headerButton, { backgroundColor: colors.surface }]}
            onPress={() => setIsMenuVisible(true)}
          >
            <Ionicons name="menu-outline" size={20} color={colors.text} />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.headerButton, { backgroundColor: colors.surface }]}
            onPress={toggleTheme}
          >
            <Ionicons name={mode === 'dark' ? 'sunny-outline' : 'moon-outline'} size={20} color={colors.text} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {/* Date & Time */}
        <View style={[styles.dateCard, { backgroundColor: colors.surface }]}>
          <Ionicons name="calendar" size={16} color={colors.primary} />
          <Text style={[styles.dateText, { color: colors.text }]}>{date}</Text>
          <Text style={[styles.timeSeparator, { color: colors.textSecondary }]}>•</Text>
          <Text style={[styles.timeText, { color: colors.text }]}>{time}</Text>
        </View>

        {/* Summary Stats Row */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Your Productivity</Text>
          <View style={styles.statsRow}>
            <View style={[styles.statMini, { backgroundColor: colors.card }]}>
              <Ionicons name="layers" size={18} color="#6366F1" />
              <Text style={[styles.statMiniNumber, { color: colors.text }]}>{totalCount}</Text>
              <Text style={[styles.statMiniLabel, { color: colors.textSecondary }]}>Total Items</Text>
            </View>
            <View style={[styles.statMini, { backgroundColor: colors.card }]}>
              <Ionicons name="trending-up" size={18} color="#10B981" />
              <Text style={[styles.statMiniNumber, { color: colors.text }]}>{weekCount}</Text>
              <Text style={[styles.statMiniLabel, { color: colors.textSecondary }]}>This Week</Text>
            </View>
            <View style={[styles.statMini, { backgroundColor: colors.card }]}>
              <Ionicons name="folder" size={18} color="#F59E0B" />
              <Text style={[styles.statMiniNumber, { color: colors.text }]}>{categoryStats.length}</Text>
              <Text style={[styles.statMiniLabel, { color: colors.textSecondary }]}>Categories</Text>
            </View>
            <View style={[styles.statMini, { backgroundColor: colors.card }]}>
              <Ionicons name="star" size={18} color="#EC4899" />
              <Text style={[styles.statMiniNumber, { color: colors.text }]}>{favorites.length}</Text>
              <Text style={[styles.statMiniLabel, { color: colors.textSecondary }]}>Favorites</Text>
            </View>
          </View>
        </View>

        {/* Focus Today */}
        {recentItems.length > 0 && (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Focus Today</Text>
            {recentItems.map((item) => (
              <View key={item.id} style={[styles.focusItem, { backgroundColor: colors.card }]}>
                <View style={[styles.focusIcon, { backgroundColor: colors.surface }]}>
                  <Ionicons name="star-outline" size={16} color={colors.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.focusTitle, { color: colors.text }]} numberOfLines={1}>{item.title}</Text>
                  <Text style={[styles.focusCategory, { color: colors.textSecondary }]}>{item.category}</Text>
                </View>
                <Text style={[styles.focusTime, { color: colors.textSecondary }]}>{formatRelativeTime(item.updatedAt || item.createdAt)}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Favorites */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Favorites</Text>
          {favorites.length > 0 ? (
            <View style={[styles.favoritesContainer, { backgroundColor: colors.card }]}>
              {favorites.map((item, idx) => (
                <View key={item.id}>
                  <View style={styles.favoriteItem}>
                    <Ionicons name="heart" size={16} color="#EC4899" />
                    <View style={{ flex: 1, marginLeft: 10 }}>
                      <Text style={[styles.favTitle, { color: colors.text }]} numberOfLines={1}>{item.title}</Text>
                      <Text style={[styles.favSubtitle, { color: colors.textSecondary }]}>{item.category}</Text>
                    </View>
                  </View>
                  {idx < favorites.length - 1 && <View style={[styles.divider, { backgroundColor: colors.border }]} />}
                </View>
              ))}
            </View>
          ) : (
            <View style={[styles.emptyState, { backgroundColor: colors.surface }]}>
              <Ionicons name="heart-outline" size={24} color={colors.textSecondary} />
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>No favorites yet</Text>
            </View>
          )}
        </View>

        {/* Quick Access - Horizontal Scroll */}
        {allItems.length > 0 && (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Quick Access</Text>
            <FlatList
              data={allItems.slice(0, 5)}
              keyExtractor={(item) => item.id}
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.quickAccessScroll}
              renderItem={({ item }) => (
                <View style={[styles.quickAccessCard, { backgroundColor: colors.card }]}>
                  <Text style={[styles.qaTitle, { color: colors.text }]} numberOfLines={2}>{item.title}</Text>
                  <Text style={[styles.qaCategory, { color: colors.textSecondary }]}>{item.category}</Text>
                  <Text style={[styles.qaTime, { color: colors.textSecondary }]}>{formatRelativeTime(item.updatedAt || item.createdAt)}</Text>
                </View>
              )}
            />
          </View>
        )}

        {/* Recent Generated Images */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Recent Generated Images</Text>
          {recentGeneratedImages.length > 0 ? (
            <View style={styles.recentImagesGrid}>
              {recentGeneratedImages.map((image) => (
                <Image
                  key={image.id}
                  source={{ uri: image.uri }}
                  style={[styles.recentImage, { backgroundColor: colors.surface }]}
                  resizeMode="cover"
                />
              ))}
            </View>
          ) : (
            <View style={[styles.recentImagesEmpty, { backgroundColor: colors.surface }]}>
              <Text style={[styles.recentImagesEmptyText, { color: colors.textSecondary }]}>No generated images yet</Text>
            </View>
          )}
        </View>

        {/* Top Categories */}
        {topCategories.length > 0 && (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Top Categories</Text>
            {topCategories.map((cat) => {
              const section = sections.find(s => s.title === cat.name);
              return (
                <View key={cat.name} style={[styles.topCatItem, { backgroundColor: colors.card }]}>
                  <View style={[styles.topCatIcon, { backgroundColor: cat.color + '20' }]}>
                    <Ionicons name={cat.icon} size={18} color={cat.color} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.topCatName, { color: colors.text }]}>{cat.name}</Text>
                    <Text style={[styles.topCatMeta, { color: colors.textSecondary }]}>
                      {cat.count} items • Updated {formatRelativeTime(cat.lastUpdated)}
                    </Text>
                  </View>
                  <TouchableOpacity onPress={() => section && navigateToSection(section.route)}>
                    <Ionicons name="chevron-forward" size={20} color={colors.primary} />
                  </TouchableOpacity>
                </View>
              );
            })}
          </View>
        )}

        {/* All Categories Grid */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>All Categories</Text>
          <View style={styles.gridContainer}>
            {sections.map((section) => {
              const stats = categoryStats.find(c => c.name === section.title);
              return (
                <TouchableOpacity
                  key={section.id}
                  style={[
                    styles.gridCard,
                    { backgroundColor: colors.card },
                  ]}
                  onPress={() => navigateToSection(section.route)}
                  activeOpacity={0.7}
                >
                  <View style={[styles.gridIcon, { backgroundColor: section.color + '15' }]}>
                    <Ionicons name={section.icon} size={20} color={section.color} />
                  </View>
                  <Text style={[styles.gridTitle, { color: colors.text }]}>{section.title}</Text>
                  <Text style={[styles.gridCount, { color: colors.textSecondary }]}>
                    {stats?.count || 0} items
                  </Text>
                  {stats && (
                    <Text style={[styles.gridTime, { color: colors.textSecondary }]}>
                      {formatRelativeTime(stats.lastUpdated)}
                    </Text>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Recent Activity */}
        {activities.length > 0 && (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Recent Activity</Text>
            <View style={[styles.activityContainer, { backgroundColor: colors.card }]}>
              {activities.map((activity, idx) => (
                <View key={activity.id}>
                  <View style={styles.activityRow}>
                    <View style={[styles.activityIcon, { backgroundColor: colors.surface }]}>
                      <Ionicons name={activity.icon} size={14} color={colors.primary} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.activityText, { color: colors.text }]}>{activity.action}</Text>
                      <Text style={[styles.activityCategory, { color: colors.textSecondary }]}>{formatRelativeTime(activity.timestamp)}</Text>
                    </View>
                  </View>
                  {idx < activities.length - 1 && <View style={[styles.divider, { backgroundColor: colors.border }]} />}
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Insights */}
        {hasActivity && (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Insights</Text>
            <View style={styles.insightsContainer}>
              <View style={[styles.insightCard, { backgroundColor: colors.card }]}>
                <Ionicons name="bulb" size={18} color="#F59E0B" />
                <View style={{ marginLeft: 10, flex: 1 }}>
                  <Text style={[styles.insightText, { color: colors.text }]}>
                    Most active: {getMostActiveCategory()}
                  </Text>
                </View>
              </View>
              <View style={[styles.insightCard, { backgroundColor: colors.card }]}>
                <Ionicons name="flame" size={18} color="#EF4444" />
                <View style={{ marginLeft: 10, flex: 1 }}>
                  <Text style={[styles.insightText, { color: colors.text }]}>
                    {weekCount} items added this week
                  </Text>
                </View>
              </View>
            </View>
          </View>
        )}

        {/* Empty State */}
        {totalCount === 0 && (
          <View style={[styles.emptyFullState, { backgroundColor: colors.surface }]}>
            <Ionicons name="file-tray-outline" size={48} color={colors.textSecondary} />
            <Text style={[styles.emptyTitle, { color: colors.text }]}>No items yet</Text>
            <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
              Start adding items to see your dashboard come alive
            </Text>
          </View>
        )}
      </ScrollView>

      {/* Menu Modal */}
      <Modal
        visible={isMenuVisible}
        animationType="fade"
        transparent
        onRequestClose={() => setIsMenuVisible(false)}
      >
        <Pressable style={styles.menuOverlay} onPress={() => setIsMenuVisible(false)}>
          <Pressable
            style={[styles.menuContainer, { backgroundColor: colors.card }]}
            onPress={() => {}}
          >
            <Text style={[styles.menuTitle, { color: colors.text }]}>All Sections</Text>
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 10 }}>
              {menuSections.map((section) => {
                const count = categoryStats.find(c => c.name === section.title)?.count || 0;
                return (
                  <TouchableOpacity
                    key={section.id}
                    style={[styles.menuItem, { borderBottomColor: colors.border }]}
                    onPress={() => navigateToSection(section.route)}
                    activeOpacity={0.7}
                  >
                    <View style={styles.menuItemLeft}>
                      <View style={[styles.menuIcon, { backgroundColor: section.color + '20' }]}>
                        <Ionicons name={section.icon} size={16} color={section.color} />
                      </View>
                      <Text style={[styles.menuItemText, { color: colors.text }]}>{section.title}</Text>
                    </View>
                    {section.showCount ? (
                      <Text style={[styles.menuCount, { color: colors.textSecondary }]}>{count}</Text>
                    ) : (
                      <Ionicons name="chevron-forward" size={16} color={colors.textSecondary} />
                    )}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Floating Action Button */}
      {syncToast && (
        <View
          style={[
            styles.syncToast,
            { backgroundColor: syncToast.type === 'success' ? '#16A34A' : colors.danger },
          ]}
        >
          <Text style={styles.syncToastText}>{syncToast.text}</Text>
        </View>
      )}

      <TouchableOpacity
        style={[styles.fab, { backgroundColor: colors.primary }]}
        onPress={() => setIsMenuVisible(true)}
      >
        <Ionicons name="add" size={28} color="#fff" />
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 100,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 24,
  },
  greeting: {
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  lastActivity: {
    fontSize: 13,
    marginTop: 6,
    fontWeight: '500',
    opacity: 0.8,
  },
  syncStatus: {
    fontSize: 11,
    marginTop: 4,
    fontWeight: '500',
    opacity: 0.7,
  },
  syncMeta: {
    fontSize: 10,
    marginTop: 2,
    fontWeight: '500',
    opacity: 0.65,
  },
  headerActions: {
    flexDirection: 'row',
    gap: 12,
  },
  headerButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
  },
  dateCard: {
    marginHorizontal: 24,
    marginBottom: 28,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 3,
    borderWidth: 0,
  },
  dateText: {
    fontSize: 13,
    fontWeight: '600',
  },
  timeSeparator: {
    fontSize: 12,
    opacity: 0.5,
  },
  timeText: {
    fontSize: 13,
    fontWeight: '700',
  },
  section: {
    marginBottom: 32,
    paddingHorizontal: 24,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '800',
    marginBottom: 16,
    letterSpacing: -0.5,
  },
  statsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 12,
  },
  statMini: {
    width: '48%', // Allow wrap easily
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderRadius: 20,
    alignItems: 'flex-start',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.06,
    shadowRadius: 14,
    elevation: 4,
    borderWidth: 0,
  },
  statMiniNumber: {
    fontSize: 24,
    fontWeight: '800',
    marginTop: 12,
    marginBottom: 4,
  },
  statMiniLabel: {
    fontSize: 12,
    fontWeight: '600',
    opacity: 0.8,
  },
  focusItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderRadius: 20,
    marginBottom: 12,
    gap: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 3,
    borderWidth: 0,
  },
  focusIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  focusTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  focusCategory: {
    fontSize: 12,
    marginTop: 4,
    fontWeight: '500',
    opacity: 0.7,
  },
  focusTime: {
    fontSize: 11,
    fontWeight: '600',
  },
  favoritesContainer: {
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 4,
    borderWidth: 0,
  },
  favoriteItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
    gap: 12,
  },
  favTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  favSubtitle: {
    fontSize: 12,
    marginTop: 4,
    fontWeight: '500',
    opacity: 0.7,
  },
  divider: {
    height: 1,
    opacity: 0.4,
    marginHorizontal: 16,
  },
  emptyState: {
    paddingVertical: 32,
    paddingHorizontal: 20,
    borderRadius: 20,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
    marginTop: 12,
    fontWeight: '600',
  },
  quickAccessScroll: {
    gap: 14,
    paddingRight: 24,
  },
  quickAccessCard: {
    width: 150,
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 3,
    borderWidth: 0,
  },
  qaTitle: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 6,
  },
  qaCategory: {
    fontSize: 11,
    fontWeight: '600',
    opacity: 0.8,
    marginBottom: 6,
  },
  qaTime: {
    fontSize: 10,
    fontWeight: '500',
    opacity: 0.5,
  },
  recentImagesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  recentImage: {
    width: Math.floor((screenWidth - 48 - 30) / 4), // adjusted for new padding 24
    height: Math.floor((screenWidth - 48 - 30) / 4),
    borderRadius: 14,
  },
  recentImagesEmpty: {
    borderRadius: 20,
    paddingVertical: 24,
    alignItems: 'center',
  },
  recentImagesEmptyText: {
    fontSize: 13,
    fontWeight: '600',
  },
  topCatItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 20,
    marginBottom: 12,
    gap: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 3,
    borderWidth: 0,
  },
  topCatIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  topCatName: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 4,
  },
  topCatMeta: {
    fontSize: 12,
    fontWeight: '500',
    opacity: 0.7,
  },
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 12,
  },
  gridCard: {
    width: '48%',
    paddingHorizontal: 16,
    paddingVertical: 20,
    borderRadius: 20,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 4,
    borderWidth: 0,
  },
  gridIcon: {
    width: 52,
    height: 52,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  gridTitle: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 6,
    textAlign: 'center',
  },
  gridCount: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 4,
    opacity: 0.8,
  },
  gridTime: {
    fontSize: 10,
    fontWeight: '500',
    opacity: 0.5,
  },
  activityContainer: {
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 4,
    borderWidth: 0,
  },
  activityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 14,
  },
  activityIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activityText: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
  },
  activityCategory: {
    fontSize: 11,
    fontWeight: '500',
    opacity: 0.6,
  },
  insightsContainer: {
    gap: 12,
  },
  insightCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 3,
    borderWidth: 0,
  },
  insightText: {
    fontSize: 14,
    fontWeight: '600',
  },
  emptyFullState: {
    paddingVertical: 60,
    paddingHorizontal: 24,
    alignItems: 'center',
    marginHorizontal: 24,
    borderRadius: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.04,
    shadowRadius: 14,
    elevation: 2,
    borderWidth: 0,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 13,
    textAlign: 'center',
    fontWeight: '500',
    opacity: 0.7,
    lineHeight: 20,
  },
  menuOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-start',
    alignItems: 'flex-end',
    paddingTop: 90,
    paddingHorizontal: 24,
    zIndex: 99,
  },
  menuContainer: {
    borderRadius: 20,
    paddingVertical: 8,
    maxHeight: '75%',
    minWidth: 220,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 10,
    borderWidth: 0,
    zIndex: 100,
  },
  menuTitle: {
    fontSize: 18,
    fontWeight: '800',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  menuItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  menuIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  menuItemText: {
    fontSize: 15,
    fontWeight: '600',
  },
  menuCount: {
    fontSize: 13,
    marginLeft: 10,
    fontWeight: '700',
    opacity: 0.5,
  },
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#6366F1',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 8,
  },
  syncToast: {
    position: 'absolute',
    left: 24,
    right: 24,
    bottom: 92,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    alignItems: 'center',
    zIndex: 10,
  },
  syncToastText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
});
