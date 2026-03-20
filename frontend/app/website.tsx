import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  Alert,
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/src/context/ThemeContext';
import { Card } from '@/src/components/common/Card';
import { FormInput } from '@/src/components/common/FormInput';
import { Select } from '@/src/components/common/Select';
import { EmptyState } from '@/src/components/common/EmptyState';
import { websiteStorage, WebsiteItem } from '@/src/services/storage';

const CATEGORIES = [
  'AI Tool',
  'Productivity',
  'Design',
  'Development',
  'Marketing',
  'Social Media',
  'Analytics',
  'Communication',
  'Finance',
  'Other',
];

export default function WebsiteScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const [items, setItems] = useState<WebsiteItem[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingItem, setEditingItem] = useState<WebsiteItem | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [filterCategory, setFilterCategory] = useState('All');

  const [formData, setFormData] = useState({
    name: '',
    toolLink: '',
    description: '',
    category: '',
  });

  const loadItems = useCallback(async () => {
    const data = await websiteStorage.getAll();
    setItems(data);
  }, []);

  useEffect(() => {
    loadItems();
  }, [loadItems]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadItems();
    setRefreshing(false);
  };

  const resetForm = () => {
    setFormData({
      name: '',
      toolLink: '',
      description: '',
      category: '',
    });
    setEditingItem(null);
  };

  const openAddModal = () => {
    resetForm();
    setModalVisible(true);
  };

  const openEditModal = (item: WebsiteItem) => {
    setEditingItem(item);
    setFormData({
      name: item.name,
      toolLink: item.toolLink,
      description: item.description,
      category: item.category,
    });
    setModalVisible(true);
  };

  const handleSave = async () => {
    if (!formData.name.trim()) {
      Alert.alert('Error', 'Name is required');
      return;
    }

    if (editingItem) {
      await websiteStorage.update(editingItem.id, formData);
    } else {
      await websiteStorage.add(formData);
    }

    await loadItems();
    setModalVisible(false);
    resetForm();
  };

  const handleDelete = (item: WebsiteItem) => {
    Alert.alert('Delete', `Are you sure you want to delete "${item.name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await websiteStorage.delete(item.id);
          await loadItems();
        },
      },
    ]);
  };

  const filteredItems = filterCategory === 'All'
    ? items
    : items.filter(item => item.category === filterCategory);

  const uniqueCategories = ['All', ...new Set(items.map(item => item.category).filter(Boolean))];

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.text }]}>Website</Text>
        <TouchableOpacity onPress={openAddModal} style={[styles.addButton, { backgroundColor: colors.primary }]}>
          <Ionicons name="add" size={24} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      {items.length > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabsContainer}>
          {uniqueCategories.map(category => (
            <TouchableOpacity
              key={category}
              style={[
                styles.tab,
                filterCategory === category && { backgroundColor: colors.primary },
                { borderColor: colors.border },
              ]}
              onPress={() => setFilterCategory(category)}
            >
              <Text style={[styles.tabText, { color: filterCategory === category ? '#FFFFFF' : colors.text }]}>
                {category}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      {filteredItems.length === 0 ? (
        <EmptyState
          icon="globe-outline"
          title="No Websites Yet"
          description="Save useful websites and tools for quick access."
          actionLabel="Add Website"
          onAction={openAddModal}
        />
      ) : (
        <ScrollView
          style={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        >
          {filteredItems.map(item => (
            <Card
              key={item.id}
              title={item.name}
              subtitle={item.description}
              tags={item.category ? [item.category] : []}
              onEdit={() => openEditModal(item)}
              onDelete={() => handleDelete(item)}
            >
              {item.toolLink && (
                <Text style={[styles.link, { color: colors.primary }]} numberOfLines={1}>
                  {item.toolLink}
                </Text>
              )}
            </Card>
          ))}
        </ScrollView>
      )}

      <Modal visible={modalVisible} animationType="slide" presentationStyle="pageSheet">
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={[styles.modalContainer, { backgroundColor: colors.background }]}
        >
          <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
            <TouchableOpacity onPress={() => { setModalVisible(false); resetForm(); }}>
              <Text style={[styles.cancelText, { color: colors.textSecondary }]}>Cancel</Text>
            </TouchableOpacity>
            <Text style={[styles.modalTitle, { color: colors.text }]}>
              {editingItem ? 'Edit Website' : 'Add Website'}
            </Text>
            <TouchableOpacity onPress={handleSave}>
              <Text style={[styles.saveText, { color: colors.primary }]}>Save</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.form} showsVerticalScrollIndicator={false}>
            <FormInput
              label="Website Name *"
              placeholder="e.g., Notion, Figma"
              value={formData.name}
              onChangeText={(text) => setFormData({ ...formData, name: text })}
            />
            <FormInput
              label="Website Link"
              placeholder="https://..."
              value={formData.toolLink}
              onChangeText={(text) => setFormData({ ...formData, toolLink: text })}
              keyboardType="url"
              autoCapitalize="none"
            />
            <FormInput
              label="One Line Description"
              placeholder="Brief description of the website"
              value={formData.description}
              onChangeText={(text) => setFormData({ ...formData, description: text })}
            />
            <Select
              label="Category"
              options={CATEGORIES}
              value={formData.category}
              onChange={(category) => setFormData({ ...formData, category })}
            />
            <View style={styles.bottomPadding} />
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backButton: {
    padding: 8,
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
  },
  addButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabsContainer: {
    paddingHorizontal: 16,
    marginBottom: 16,
    maxHeight: 44,
  },
  tab: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 8,
    borderWidth: 1,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '500',
  },
  list: {
    flex: 1,
    paddingHorizontal: 16,
  },
  link: {
    fontSize: 12,
    marginTop: 8,
  },
  modalContainer: {
    flex: 1,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  cancelText: {
    fontSize: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  saveText: {
    fontSize: 16,
    fontWeight: '600',
  },
  form: {
    flex: 1,
    padding: 16,
  },
  bottomPadding: {
    height: 40,
  },
});
