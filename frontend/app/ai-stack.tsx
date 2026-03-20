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
import { Button } from '@/src/components/common/Button';
import { MultiSelect } from '@/src/components/common/MultiSelect';
import { Select } from '@/src/components/common/Select';
import { EmptyState } from '@/src/components/common/EmptyState';
import { aiStackStorage, AIStackItem } from '@/src/services/storage';

const CATEGORIES = [
  'Image Generation',
  'Video Generation',
  'Text Generation',
  'Audio Generation',
  'Code Generation',
  'Data Analysis',
  'Automation',
  'Research',
  'Design',
  'Other',
];

const PRICING_OPTIONS = ['free', 'paid', 'freemium'];

export default function AIStackScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const [items, setItems] = useState<AIStackItem[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingItem, setEditingItem] = useState<AIStackItem | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const [formData, setFormData] = useState({
    toolName: '',
    url: '',
    categories: [] as string[],
    usedFor: '',
    keyFeatures: '',
    pricing: 'free' as 'free' | 'paid' | 'freemium',
    bestFor: '',
    guides: '',
    instructions: '',
  });

  const loadItems = useCallback(async () => {
    const data = await aiStackStorage.getAll();
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
      toolName: '',
      url: '',
      categories: [],
      usedFor: '',
      keyFeatures: '',
      pricing: 'free',
      bestFor: '',
      guides: '',
      instructions: '',
    });
    setEditingItem(null);
  };

  const openAddModal = () => {
    resetForm();
    setModalVisible(true);
  };

  const openEditModal = (item: AIStackItem) => {
    setEditingItem(item);
    setFormData({
      toolName: item.toolName,
      url: item.url,
      categories: item.categories,
      usedFor: item.usedFor,
      keyFeatures: item.keyFeatures,
      pricing: item.pricing,
      bestFor: item.bestFor,
      guides: item.guides,
      instructions: item.instructions,
    });
    setModalVisible(true);
  };

  const handleSave = async () => {
    if (!formData.toolName.trim()) {
      Alert.alert('Error', 'Tool name is required');
      return;
    }

    if (editingItem) {
      await aiStackStorage.update(editingItem.id, formData);
    } else {
      await aiStackStorage.add(formData);
    }

    await loadItems();
    setModalVisible(false);
    resetForm();
  };

  const handleDelete = (item: AIStackItem) => {
    Alert.alert('Delete', `Are you sure you want to delete "${item.toolName}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await aiStackStorage.delete(item.id);
          await loadItems();
        },
      },
    ]);
  };

  const filteredItems = items.filter(item =>
    item.toolName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.categories.some(c => c.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const getPricingColor = (pricing: string) => {
    switch (pricing) {
      case 'free': return colors.success;
      case 'paid': return colors.danger;
      case 'freemium': return colors.warning;
      default: return colors.textSecondary;
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.text }]}>AI Stack</Text>
        <TouchableOpacity onPress={openAddModal} style={[styles.addButton, { backgroundColor: colors.primary }]}>
          <Ionicons name="add" size={24} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      <View style={styles.searchContainer}>
        <View style={[styles.searchBox, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Ionicons name="search" size={20} color={colors.textSecondary} />
          <FormInput
            label=""
            placeholder="Search tools..."
            value={searchQuery}
            onChangeText={setSearchQuery}
            style={styles.searchInput}
          />
        </View>
      </View>

      {filteredItems.length === 0 ? (
        <EmptyState
          icon="layers-outline"
          title="No AI Tools Yet"
          description="Start building your AI stack by adding your favorite tools."
          actionLabel="Add Tool"
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
              title={item.toolName}
              subtitle={item.usedFor}
              tags={item.categories}
              onEdit={() => openEditModal(item)}
              onDelete={() => handleDelete(item)}
            >
              <View style={styles.cardFooter}>
                <View style={[styles.pricingBadge, { backgroundColor: getPricingColor(item.pricing) + '20' }]}>
                  <Text style={[styles.pricingText, { color: getPricingColor(item.pricing) }]}>
                    {item.pricing.charAt(0).toUpperCase() + item.pricing.slice(1)}
                  </Text>
                </View>
                {item.url && (
                  <Text style={[styles.url, { color: colors.primary }]} numberOfLines={1}>
                    {item.url}
                  </Text>
                )}
              </View>
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
              {editingItem ? 'Edit Tool' : 'Add Tool'}
            </Text>
            <TouchableOpacity onPress={handleSave}>
              <Text style={[styles.saveText, { color: colors.primary }]}>Save</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.form} showsVerticalScrollIndicator={false}>
            <FormInput
              label="Tool Name *"
              placeholder="e.g., ChatGPT, Midjourney"
              value={formData.toolName}
              onChangeText={(text) => setFormData({ ...formData, toolName: text })}
            />
            <FormInput
              label="URL"
              placeholder="https://..."
              value={formData.url}
              onChangeText={(text) => setFormData({ ...formData, url: text })}
              keyboardType="url"
              autoCapitalize="none"
            />
            <MultiSelect
              label="Categories"
              options={CATEGORIES}
              selected={formData.categories}
              onChange={(categories) => setFormData({ ...formData, categories })}
            />
            <FormInput
              label="What's It Used For"
              placeholder="Describe the main use case..."
              value={formData.usedFor}
              onChangeText={(text) => setFormData({ ...formData, usedFor: text })}
              multiline
              numberOfLines={3}
              style={styles.textArea}
            />
            <FormInput
              label="Key Features"
              placeholder="List the main features..."
              value={formData.keyFeatures}
              onChangeText={(text) => setFormData({ ...formData, keyFeatures: text })}
              multiline
              numberOfLines={3}
              style={styles.textArea}
            />
            <Select
              label="Pricing"
              options={PRICING_OPTIONS}
              value={formData.pricing}
              onChange={(pricing) => setFormData({ ...formData, pricing: pricing as any })}
            />
            <FormInput
              label="Best For"
              placeholder="Who would benefit most..."
              value={formData.bestFor}
              onChangeText={(text) => setFormData({ ...formData, bestFor: text })}
            />
            <FormInput
              label="Guides/Documents"
              placeholder="Links to guides, documentation..."
              value={formData.guides}
              onChangeText={(text) => setFormData({ ...formData, guides: text })}
              multiline
              numberOfLines={3}
              style={styles.textArea}
            />
            <FormInput
              label="Instructions"
              placeholder="Personal notes, tips..."
              value={formData.instructions}
              onChangeText={(text) => setFormData({ ...formData, instructions: text })}
              multiline
              numberOfLines={4}
              style={styles.textArea}
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
  searchContainer: {
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 10,
    paddingLeft: 12,
  },
  searchInput: {
    flex: 1,
    borderWidth: 0,
    marginBottom: 0,
  },
  list: {
    flex: 1,
    paddingHorizontal: 16,
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    gap: 12,
  },
  pricingBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  pricingText: {
    fontSize: 12,
    fontWeight: '500',
  },
  url: {
    fontSize: 12,
    flex: 1,
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
  textArea: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  bottomPadding: {
    height: 40,
  },
});
