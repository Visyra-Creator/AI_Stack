import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  RefreshControl,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { deleteItem, getItemsByCategory } from '../../services/api';

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

export default function CategoryScreen() {
  const { name } = useLocalSearchParams<{ name: string }>();
  const router = useRouter();
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchItems = async () => {
    try {
      const data = await getItemsByCategory(name);
      setItems(data);
    } catch (error) {
      console.error('Error fetching items:', error);
      Alert.alert('Error', 'Failed to load items');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchItems();
  }, [name]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchItems();
  }, [name]);

  const handleDeleteItem = (itemId: string) => {
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
              await deleteItem(itemId);
              fetchItems();
            } catch (error) {
              console.error('Error deleting item:', error);
              Alert.alert('Error', 'Failed to delete item');
            }
          },
        },
      ]
    );
  };

  const handleItemPress = (item: Item) => {
    router.push({
      pathname: '/item/[id]',
      params: { 
        id: item.id,
        category: name,
      }
    });
  };

  const handleAddPress = () => {
    router.push({
      pathname: '/item/select-category',
      params: { initialCategory: name },
    });
  };

  const renderItem = ({ item }: { item: Item }) => (
    <TouchableOpacity
      style={styles.itemCard}
      onPress={() => handleItemPress(item)}
      activeOpacity={0.7}
    >
      <View style={styles.itemContent}>
        <Text style={styles.itemTitle} numberOfLines={1}>{item.title}</Text>
        {item.description ? (
          <Text style={styles.itemDescription} numberOfLines={2}>
            {item.description}
          </Text>
        ) : null}
        <Text style={styles.itemDate}>
          {new Date(item.updatedAt).toLocaleDateString()}
        </Text>
      </View>
      <TouchableOpacity
        style={styles.deleteButton}
        onPress={() => handleDeleteItem(item.id)}
      >
        <Ionicons name="trash-outline" size={20} color="#FF6B6B" />
      </TouchableOpacity>
    </TouchableOpacity>
  );

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Ionicons name="folder-open-outline" size={64} color="#444444" />
      <Text style={styles.emptyText}>No items yet</Text>
      <Text style={styles.emptySubtext}>Tap + to add your first item</Text>
    </View>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#4ECDC4" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>{name}</Text>
        <View style={styles.placeholder} />
      </View>

      {/* List */}
      <FlatList
        data={items}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[
          styles.listContent,
          items.length === 0 && styles.listContentEmpty,
        ]}
        ListEmptyComponent={renderEmptyState}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#4ECDC4"
          />
        }
      />

      {/* FAB */}
      <TouchableOpacity style={styles.fab} onPress={handleAddPress}>
        <Ionicons name="add" size={32} color="#FFFFFF" />
      </TouchableOpacity>
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
  placeholder: {
    width: 32,
  },
  listContent: {
    padding: 16,
  },
  listContentEmpty: {
    flex: 1,
  },
  itemCard: {
    backgroundColor: '#1A1A1A',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
  itemContent: {
    flex: 1,
    marginRight: 12,
  },
  itemTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  itemDescription: {
    fontSize: 14,
    color: '#888888',
    marginBottom: 4,
  },
  itemDate: {
    fontSize: 12,
    color: '#666666',
  },
  deleteButton: {
    padding: 8,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 64,
  },
  emptyText: {
    fontSize: 20,
    fontWeight: '600',
    color: '#666666',
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#444444',
    marginTop: 8,
  },
  fab: {
    position: 'absolute',
    right: 24,
    bottom: 24,
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#4ECDC4',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
});
