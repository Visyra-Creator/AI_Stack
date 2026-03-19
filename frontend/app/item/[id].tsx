import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

interface Item {
  id: string;
  category: string;
  title: string;
  description: string;
  notes?: string;
  url?: string;
  createdAt: string;
  updatedAt: string;
}

export default function ItemDetailScreen() {
  const { id, category } = useLocalSearchParams<{ id: string; category: string }>();
  const router = useRouter();
  const [item, setItem] = useState<Item | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchItem();
  }, [id]);

  const fetchItem = async () => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/items/${id}`);
      if (!response.ok) throw new Error('Failed to fetch item');
      const data = await response.json();
      setItem(data);
    } catch (error) {
      console.error('Error fetching item:', error);
      Alert.alert('Error', 'Failed to load item');
      router.back();
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = () => {
    router.push({
      pathname: '/item/edit',
      params: { 
        id: item?.id,
        category: category,
      }
    });
  };

  const handleDelete = () => {
    Alert.alert(
      'Delete Item',
      'Are you sure you want to delete this item?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const response = await fetch(`${BACKEND_URL}/api/items/${id}`, {
                method: 'DELETE',
              });
              if (!response.ok) throw new Error('Failed to delete item');
              router.back();
            } catch (error) {
              console.error('Error deleting item:', error);
              Alert.alert('Error', 'Failed to delete item');
            }
          },
        },
      ]
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#4ECDC4" />
      </View>
    );
  }

  if (!item) {
    return null;
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Details</Text>
        <View style={styles.headerActions}>
          <TouchableOpacity onPress={handleEdit} style={styles.headerButton}>
            <Ionicons name="create-outline" size={24} color="#FFFFFF" />
          </TouchableOpacity>
          <TouchableOpacity onPress={handleDelete} style={styles.headerButton}>
            <Ionicons name="trash-outline" size={24} color="#FF6B6B" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Content */}
      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
        <View style={styles.section}>
          <Text style={styles.label}>Category</Text>
          <View style={styles.categoryBadge}>
            <Text style={styles.categoryText}>{item.category}</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>Title</Text>
          <Text style={styles.value}>{item.title}</Text>
        </View>

        {item.description ? (
          <View style={styles.section}>
            <Text style={styles.label}>Description</Text>
            <Text style={styles.value}>{item.description}</Text>
          </View>
        ) : null}

        {item.notes ? (
          <View style={styles.section}>
            <Text style={styles.label}>Notes</Text>
            <Text style={styles.value}>{item.notes}</Text>
          </View>
        ) : null}

        {item.url ? (
          <View style={styles.section}>
            <Text style={styles.label}>URL</Text>
            <Text style={[styles.value, styles.urlText]}>{item.url}</Text>
          </View>
        ) : null}

        <View style={styles.metaSection}>
          <View style={styles.metaItem}>
            <Text style={styles.metaLabel}>Created</Text>
            <Text style={styles.metaValue}>
              {new Date(item.createdAt).toLocaleString()}
            </Text>
          </View>
          <View style={styles.metaItem}>
            <Text style={styles.metaLabel}>Updated</Text>
            <Text style={styles.metaValue}>
              {new Date(item.updatedAt).toLocaleString()}
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
    backgroundColor: '#0F0F0F',
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: '#0F0F0F',
    alignItems: 'center',
    justifyContent: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#1A1A1A',
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFFFFF',
    flex: 1,
    textAlign: 'center',
    marginHorizontal: 8,
  },
  headerActions: {
    flexDirection: 'row',
    gap: 8,
  },
  headerButton: {
    padding: 4,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 24,
  },
  section: {
    marginBottom: 24,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#888888',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  value: {
    fontSize: 16,
    color: '#FFFFFF',
    lineHeight: 24,
  },
  categoryBadge: {
    backgroundColor: '#4ECDC4',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    alignSelf: 'flex-start',
  },
  categoryText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  urlText: {
    color: '#4ECDC4',
  },
  metaSection: {
    marginTop: 16,
    paddingTop: 24,
    borderTopWidth: 1,
    borderTopColor: '#1A1A1A',
  },
  metaItem: {
    marginBottom: 12,
  },
  metaLabel: {
    fontSize: 12,
    color: '#666666',
    marginBottom: 4,
  },
  metaValue: {
    fontSize: 14,
    color: '#888888',
  },
});
