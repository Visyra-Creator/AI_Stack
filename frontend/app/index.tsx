import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  Pressable,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/src/context/ThemeContext';
import AsyncStorage from '@react-native-async-storage/async-storage';

const { width: screenWidth } = Dimensions.get('window');
const CARD_WIDTH = Math.floor((screenWidth - 48) / 2);

interface Section {
  id: string;
  title: string;
  icon: keyof typeof Ionicons.glyphMap;
  route: string;
  color: string;
  count?: number;
}

const sections: Section[] = [
  { id: 'ai-stack', title: 'AI Stack', icon: 'layers-outline', route: '/ai-stack', color: '#6366F1' },
  { id: 'prompts', title: 'Prompts', icon: 'chatbubble-outline', route: '/prompts', color: '#8B5CF6' },
  { id: 'tools', title: 'Tools', icon: 'construct-outline', route: '/tools', color: '#EC4899' },
  { id: 'tutorials', title: 'Tutorials', icon: 'play-circle-outline', route: '/tutorials', color: '#F59E0B' },
  { id: 'open-source', title: 'Open Source', icon: 'git-branch-outline', route: '/open-source', color: '#10B981' },
  { id: 'lead-gen', title: 'Lead Gen', icon: 'people-outline', route: '/lead-generation', color: '#06B6D4' },
  { id: 'business', title: 'Business', icon: 'briefcase-outline', route: '/business', color: '#EF4444' },
  { id: 'content', title: 'Content', icon: 'create-outline', route: '/content-creation', color: '#84CC16' },
  { id: 'website', title: 'Website', icon: 'globe-outline', route: '/website', color: '#F97316' },
  { id: 'marketing', title: 'Marketing', icon: 'megaphone-outline', route: '/marketing', color: '#14B8A6' },
];

export default function HomeScreen() {
  const router = useRouter();
  const { colors, mode, toggleTheme } = useTheme();
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [isMenuVisible, setIsMenuVisible] = useState(false);
  const [dateTime, setDateTime] = useState(new Date());

  const formatDateTime = (date: Date) => {
    const options: Intl.DateTimeFormatOptions = { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' };
    const dateStr = date.toLocaleDateString('en-US', options);
    const timeStr = date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });
    return { date: dateStr, time: timeStr };
  };

  useEffect(() => {
    loadCounts();
    const timer = setInterval(() => {
      setDateTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const loadCounts = async () => {
    const keys = [
      'ai_stack', 'prompts', 'tools', 'tutorials', 'open_source',
      'lead_generation', 'business', 'content_creation', 'website', 'marketing'
    ];
    const newCounts: Record<string, number> = {};
    for (const key of keys) {
      try {
        const data = await AsyncStorage.getItem(key);
        const items = data ? JSON.parse(data) : [];
        newCounts[key] = items.length;
      } catch {
        newCounts[key] = 0;
      }
    }
    setCounts(newCounts);
  };

  const getCount = (id: string): number => {
    const keyMap: Record<string, string> = {
      'ai-stack': 'ai_stack',
      'prompts': 'prompts',
      'tools': 'tools',
      'tutorials': 'tutorials',
      'open-source': 'open_source',
      'lead-gen': 'lead_generation',
      'business': 'business',
      'content': 'content_creation',
      'website': 'website',
      'marketing': 'marketing',
    };
    return counts[keyMap[id]] || 0;
  };

  const navigateToSection = (route: string) => {
    setIsMenuVisible(false);
    router.push(route as any);
  };

  const { date, time } = formatDateTime(dateTime);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <View>
          <Text style={[styles.greeting, { color: colors.textSecondary }]}>Welcome to</Text>
          <Text style={[styles.title, { color: colors.text }]}>AI Stack Keeper</Text>
          <View style={styles.dateTimeContainer}>
            <Ionicons name="calendar-outline" size={14} color={colors.textSecondary} />
            <Text style={[styles.dateTimeText, { color: colors.textSecondary }]}>{date}</Text>
            <Text style={[styles.separator, { color: colors.textSecondary }]}>•</Text>
            <Text style={[styles.dateTimeText, { color: colors.textSecondary }]}>{time}</Text>
          </View>
        </View>
        <View style={styles.headerActions}>
          <TouchableOpacity
            style={[styles.themeButton, { backgroundColor: colors.surface }]}
            onPress={() => setIsMenuVisible(true)}
          >
            <Ionicons name="menu-outline" size={22} color={colors.text} />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.themeButton, { backgroundColor: colors.surface }]}
            onPress={toggleTheme}
          >
            <Ionicons
              name={mode === 'dark' ? 'sunny-outline' : 'moon-outline'}
              size={22}
              color={colors.text}
            />
          </TouchableOpacity>
        </View>
      </View>

      <Modal
        visible={isMenuVisible}
        animationType="fade"
        transparent
        onRequestClose={() => setIsMenuVisible(false)}
      >
        <Pressable style={styles.menuOverlay} onPress={() => setIsMenuVisible(false)}>
          <Pressable
            style={[
              styles.menuContainer,
              { backgroundColor: colors.card, borderColor: colors.border },
            ]}
            onPress={() => {}}
          >
            <Text style={[styles.menuTitle, { color: colors.text }]}>All Sections</Text>
            {sections.map((section) => (
              <TouchableOpacity
                key={section.id}
                style={[styles.menuItem, { borderBottomColor: colors.border }]}
                onPress={() => navigateToSection(section.route)}
                activeOpacity={0.7}
              >
                <View style={styles.menuItemLeft}>
                  <View style={[styles.menuIconWrap, { backgroundColor: section.color + '20' }]}>
                    <Ionicons name={section.icon} size={18} color={section.color} />
                  </View>
                  <Text style={[styles.menuItemText, { color: colors.text }]}>{section.title}</Text>
                </View>
                <Text style={[styles.menuItemCount, { color: colors.textSecondary }]}>
                  {getCount(section.id)}
                </Text>
              </TouchableOpacity>
            ))}
          </Pressable>
        </Pressable>
      </Modal>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        <View style={styles.grid}>
          {sections.map((section) => (
            <TouchableOpacity
              key={section.id}
              style={[
                styles.card,
                {
                  backgroundColor: colors.card,
                  borderColor: colors.border,
                  width: CARD_WIDTH,
                },
              ]}
              onPress={() => router.push(section.route as any)}
              activeOpacity={0.7}
            >
              <View style={[styles.iconContainer, { backgroundColor: section.color + '20' }]}>
                <Ionicons name={section.icon} size={28} color={section.color} />
              </View>
              <Text style={[styles.cardTitle, { color: colors.text }]}>{section.title}</Text>
              <Text style={[styles.cardCount, { color: colors.textSecondary }]}>
                {getCount(section.id)} items
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={[styles.infoCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Ionicons name="information-circle-outline" size={24} color={colors.primary} />
          <View style={styles.infoContent}>
            <Text style={[styles.infoTitle, { color: colors.text }]}>Local Storage</Text>
            <Text style={[styles.infoText, { color: colors.textSecondary }]}>
              All your data is stored locally on this device.
            </Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 8,
  },
  greeting: {
    fontSize: 14,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
  },
  dateTimeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  dateTimeText: {
    fontSize: 12,
  },
  separator: {
    fontSize: 12,
  },
  headerActions: {
    flexDirection: 'row',
    gap: 10,
  },
  themeButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContent: {
    padding: 16,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  card: {
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    marginBottom: 16,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  cardCount: {
    fontSize: 13,
  },
  infoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    marginTop: 20,
    borderWidth: 1,
  },
  infoContent: {
    marginLeft: 12,
    flex: 1,
  },
  infoTitle: {
    fontSize: 15,
    fontWeight: '600',
  },
  infoText: {
    fontSize: 13,
    marginTop: 2,
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
  menuIconWrap: {
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
  menuItemCount: {
    fontSize: 13,
    marginLeft: 10,
  },
});

