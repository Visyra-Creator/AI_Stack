import React, { useState, useEffect, useCallback } from 'react';
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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/src/context/ThemeContext';
import AsyncStorage from '@react-native-async-storage/async-storage';

const { width: screenWidth } = Dimensions.get('window');

interface DashboardItem {
  id: string;
  title: string;
  category: string;
  createdAt: number;
  updatedAt?: number;
  lastUsedAt?: number;
  usageCount?: number;
  isFavorite?: boolean;
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
  { id: 'marketing', title: 'Marketing', icon: 'megaphone-outline', route: '/marketing', color: '#14B8A6', storageKey: 'marketing' },
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

  const loadAllData = async () => {
    const now = Date.now();
    const weekAgo = now - 7 * 24 * 60 * 60 * 1000;

    let allItems: DashboardItem[] = [];
    const categoryMap: Record<string, CategoryStats> = {};
    const activityList: ActivityLog[] = [];
    let maxLastActivity = 0;
    let weeklyCount = 0;

    // Load data from all categories
    for (const section of sections) {
      try {
        const data = await AsyncStorage.getItem(section.storageKey);
        const items = data ? JSON.parse(data) : [];

        const categoryItems: DashboardItem[] = items.map((item: any) => ({
          id: item.id,
          title: item.toolName || item.promptName || item.tutorialName || item.name || item.sectionName || 'Untitled',
          category: section.title,
          createdAt: item.createdAt || 0,
          updatedAt: item.updatedAt || item.createdAt || 0,
          lastUsedAt: item.lastUsedAt,
          usageCount: item.usageCount || 0,
          isFavorite: item.isFavorite || false,
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
      } catch (error) {
        console.error(`Error loading ${section.storageKey}:`, error);
      }
    }

    // Sort and organize data
    const sortedItems = allItems.sort((a, b) => (b.updatedAt || b.createdAt) - (a.updatedAt || a.createdAt));
    const favoriteItems = sortedItems.filter(item => item.isFavorite).slice(0, 5);
    const recentItemsList = sortedItems.slice(0, 3);
    const sortedActivities = activityList.sort((a, b) => b.timestamp - a.timestamp).slice(0, 5);
    const topCatsArray = Object.values(categoryMap)
      .filter(cat => cat.count > 0)
      .sort((a, b) => b.count - a.count)
      .slice(0, 3);

    setAllItems(sortedItems);
    setTotalCount(allItems.length);
    setWeekCount(weeklyCount);
    setCategoryStats(Object.values(categoryMap).filter(cat => cat.count > 0));
    setRecentItems(recentItemsList);
    setFavorites(favoriteItems);
    setActivities(sortedActivities);
    setTopCategories(topCatsArray);
    setLastActivityTime(maxLastActivity);
  };

  useFocusEffect(
    useCallback(() => {
      loadAllData();
    }, [])
  );

  useEffect(() => {
    const timer = setInterval(() => {
      setDateTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const navigateToSection = (route: string) => {
    setIsMenuVisible(false);
    router.push(route as any);
  };

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
        </View>
        <View style={styles.headerActions}>
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
        <View style={[styles.dateCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Ionicons name="calendar" size={16} color={colors.primary} />
          <Text style={[styles.dateText, { color: colors.text }]}>{date}</Text>
          <Text style={[styles.timeSeparator, { color: colors.textSecondary }]}>•</Text>
          <Text style={[styles.timeText, { color: colors.text }]}>{time}</Text>
        </View>

        {/* Summary Stats Row */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Your Productivity</Text>
          <View style={styles.statsRow}>
            <View style={[styles.statMini, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Ionicons name="layers" size={18} color="#6366F1" />
              <Text style={[styles.statMiniNumber, { color: colors.text }]}>{totalCount}</Text>
              <Text style={[styles.statMiniLabel, { color: colors.textSecondary }]}>Total Items</Text>
            </View>
            <View style={[styles.statMini, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Ionicons name="trending-up" size={18} color="#10B981" />
              <Text style={[styles.statMiniNumber, { color: colors.text }]}>{weekCount}</Text>
              <Text style={[styles.statMiniLabel, { color: colors.textSecondary }]}>This Week</Text>
            </View>
            <View style={[styles.statMini, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Ionicons name="folder" size={18} color="#F59E0B" />
              <Text style={[styles.statMiniNumber, { color: colors.text }]}>{categoryStats.length}</Text>
              <Text style={[styles.statMiniLabel, { color: colors.textSecondary }]}>Categories</Text>
            </View>
            <View style={[styles.statMini, { backgroundColor: colors.card, borderColor: colors.border }]}>
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
              <View key={item.id} style={[styles.focusItem, { backgroundColor: colors.card, borderColor: colors.border }]}>
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
            <View style={[styles.favoritesContainer, { backgroundColor: colors.card, borderColor: colors.border }]}>
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
                <View style={[styles.quickAccessCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  <Text style={[styles.qaTitle, { color: colors.text }]} numberOfLines={2}>{item.title}</Text>
                  <Text style={[styles.qaCategory, { color: colors.textSecondary }]}>{item.category}</Text>
                  <Text style={[styles.qaTime, { color: colors.textSecondary }]}>{formatRelativeTime(item.updatedAt || item.createdAt)}</Text>
                </View>
              )}
            />
          </View>
        )}

        {/* Top Categories */}
        {topCategories.length > 0 && (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Top Categories</Text>
            {topCategories.map((cat) => {
              const section = sections.find(s => s.title === cat.name);
              return (
                <View key={cat.name} style={[styles.topCatItem, { backgroundColor: colors.card, borderColor: colors.border }]}>
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
                    { backgroundColor: colors.card, borderColor: colors.border },
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
            <View style={[styles.activityContainer, { backgroundColor: colors.card, borderColor: colors.border }]}>
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
              <View style={[styles.insightCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Ionicons name="bulb" size={18} color="#F59E0B" />
                <View style={{ marginLeft: 10, flex: 1 }}>
                  <Text style={[styles.insightText, { color: colors.text }]}>
                    Most active: {getMostActiveCategory()}
                  </Text>
                </View>
              </View>
              <View style={[styles.insightCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
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
            style={[styles.menuContainer, { backgroundColor: colors.card, borderColor: colors.border }]}
            onPress={() => {}}
          >
            <Text style={[styles.menuTitle, { color: colors.text }]}>All Sections</Text>
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
          </Pressable>
        </Pressable>
      </Modal>

      {/* Floating Action Button */}
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
    paddingBottom: 80,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 16,
  },
  greeting: {
    fontSize: 16,
    fontWeight: '600',
  },
  lastActivity: {
    fontSize: 12,
    marginTop: 4,
  },
  headerActions: {
    flexDirection: 'row',
    gap: 8,
  },
  headerButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dateCard: {
    marginHorizontal: 20,
    marginBottom: 20,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dateText: {
    fontSize: 12,
    fontWeight: '500',
  },
  timeSeparator: {
    fontSize: 10,
  },
  timeText: {
    fontSize: 12,
    fontWeight: '500',
  },
  section: {
    marginBottom: 24,
    paddingHorizontal: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 12,
  },
  statsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 10,
  },
  statMini: {
    width: (screenWidth - 60) / 2,
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statMiniNumber: {
    fontSize: 18,
    fontWeight: '700',
    marginTop: 4,
    marginBottom: 2,
  },
  statMiniLabel: {
    fontSize: 10,
    fontWeight: '500',
  },
  focusItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 8,
    gap: 10,
  },
  focusIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  focusTitle: {
    fontSize: 13,
    fontWeight: '600',
  },
  focusCategory: {
    fontSize: 11,
    marginTop: 2,
  },
  focusTime: {
    fontSize: 10,
  },
  favoritesContainer: {
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
  },
  favoriteItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
  },
  favTitle: {
    fontSize: 13,
    fontWeight: '600',
  },
  favSubtitle: {
    fontSize: 11,
    marginTop: 2,
  },
  divider: {
    height: 1,
  },
  emptyState: {
    paddingVertical: 20,
    paddingHorizontal: 16,
    borderRadius: 10,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 12,
    marginTop: 8,
    fontWeight: '500',
  },
  quickAccessScroll: {
    gap: 10,
    paddingRight: 20,
  },
  quickAccessCard: {
    width: 140,
    paddingHorizontal: 10,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
  },
  qaTitle: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 4,
  },
  qaCategory: {
    fontSize: 10,
    marginBottom: 4,
  },
  qaTime: {
    fontSize: 9,
  },
  topCatItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 8,
    gap: 10,
  },
  topCatIcon: {
    width: 36,
    height: 36,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  topCatName: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 2,
  },
  topCatMeta: {
    fontSize: 11,
  },
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 10,
  },
  gridCard: {
    width: (screenWidth - 60) / 2,
    paddingHorizontal: 12,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
  },
  gridIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  gridTitle: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 4,
    textAlign: 'center',
  },
  gridCount: {
    fontSize: 11,
    marginBottom: 2,
  },
  gridTime: {
    fontSize: 10,
  },
  activityContainer: {
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
  },
  activityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
  },
  activityIcon: {
    width: 28,
    height: 28,
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activityText: {
    fontSize: 12,
    fontWeight: '500',
    marginBottom: 2,
  },
  activityCategory: {
    fontSize: 10,
  },
  insightsContainer: {
    gap: 10,
  },
  insightCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
  },
  insightText: {
    fontSize: 12,
    fontWeight: '500',
  },
  emptyFullState: {
    paddingVertical: 40,
    paddingHorizontal: 20,
    alignItems: 'center',
    marginHorizontal: 20,
    borderRadius: 14,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginTop: 12,
    marginBottom: 4,
  },
  emptySubtitle: {
    fontSize: 12,
    textAlign: 'center',
  },
  menuOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'flex-start',
    alignItems: 'flex-end',
    paddingTop: 90,
    paddingHorizontal: 20,
  },
  menuContainer: {
    borderRadius: 14,
    borderWidth: 1,
    paddingVertical: 6,
    maxHeight: '75%',
    minWidth: 200,
  },
  menuTitle: {
    fontSize: 16,
    fontWeight: '700',
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  menuItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  menuIcon: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  menuItemText: {
    fontSize: 14,
    fontWeight: '600',
  },
  menuCount: {
    fontSize: 13,
    marginLeft: 10,
  },
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
});

