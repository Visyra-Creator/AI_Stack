import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AddContentCategory, addContentCategories, isAddContentCategory } from '../../data/add-content';
import { categories } from '../../data/categories';

const CATEGORY_STORAGE_KEY = 'aikeeper.category-selection.v1';

const defaultCategoryLabels: Record<string, string> = addContentCategories.reduce<Record<string, string>>(
  (acc, item) => {
    acc[item] = item;
    return acc;
  },
  {}
);

const defaultCategoryDescriptions: Record<string, string> = categories.reduce<Record<string, string>>(
  (acc, item) => {
    acc[item.title] = item.description;
    return acc;
  },
  {}
);

export default function CategorySelectScreen() {
  const { initialCategory } = useLocalSearchParams<{ initialCategory?: string }>();
  const router = useRouter();
  const preselectedCategory = useMemo(
    () => (initialCategory && isAddContentCategory(initialCategory) ? initialCategory : undefined),
    [initialCategory]
  );
  const [selectedCategory, setSelectedCategory] = useState<string | null>(
    preselectedCategory ?? null
  );
  const [categoryLabels, setCategoryLabels] = useState<Record<string, string>>(defaultCategoryLabels);
  const [categoryDescriptions, setCategoryDescriptions] = useState<Record<string, string>>(() =>
    defaultCategoryDescriptions
  );
  const [visibleCategories, setVisibleCategories] = useState<string[]>([...addContentCategories]);
  const [editingCategory, setEditingCategory] = useState<string | null>(null);
  const [draftLabel, setDraftLabel] = useState('');
  const [draftDescription, setDraftDescription] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newCategoryDescription, setNewCategoryDescription] = useState('');

  useEffect(() => {
    const hydrate = async () => {
      try {
        const raw = await AsyncStorage.getItem(CATEGORY_STORAGE_KEY);
        if (!raw) {
          return;
        }

        const parsed = JSON.parse(raw) as {
          visibleCategories?: string[];
          categoryLabels?: Record<string, string>;
          categoryDescriptions?: Record<string, string>;
        };

        if (parsed.visibleCategories && parsed.visibleCategories.length > 0) {
          setVisibleCategories(parsed.visibleCategories);
        }

        if (parsed.categoryLabels) {
          setCategoryLabels({ ...defaultCategoryLabels, ...parsed.categoryLabels });
        }

        if (parsed.categoryDescriptions) {
          setCategoryDescriptions({ ...defaultCategoryDescriptions, ...parsed.categoryDescriptions });
        }
      } catch (error) {
        console.error('Failed to load category settings:', error);
      }
    };

    hydrate();
  }, []);

  useEffect(() => {
    const persist = async () => {
      try {
        await AsyncStorage.setItem(
          CATEGORY_STORAGE_KEY,
          JSON.stringify({
            visibleCategories,
            categoryLabels,
            categoryDescriptions,
          })
        );
      } catch (error) {
        console.error('Failed to persist category settings:', error);
      }
    };

    persist();
  }, [visibleCategories, categoryLabels, categoryDescriptions]);

  useEffect(() => {
    if (selectedCategory && !visibleCategories.includes(selectedCategory)) {
      setSelectedCategory(null);
    }
  }, [selectedCategory, visibleCategories]);

  const handleSelectCategory = (category: string) => {
    setSelectedCategory(category);
  };

  const handleStartEdit = (category: string) => {
    setEditingCategory(category);
    setDraftLabel(categoryLabels[category]);
    setDraftDescription(categoryDescriptions[category] ?? 'Choose this category to continue');
  };

  const handleSaveEdit = () => {
    if (!editingCategory) {
      return;
    }

    const trimmed = draftLabel.trim();
    const trimmedDescription = draftDescription.trim();
    if (!trimmed) {
      Alert.alert('Invalid name', 'Category name cannot be empty.');
      return;
    }
    if (!trimmedDescription) {
      Alert.alert('Invalid description', 'Please add a one-line description.');
      return;
    }

    setCategoryLabels((current) => ({ ...current, [editingCategory]: trimmed }));
    setCategoryDescriptions((current) => ({ ...current, [editingCategory]: trimmedDescription }));
    setEditingCategory(null);
    setDraftLabel('');
    setDraftDescription('');
  };

  const handleDeleteCategory = (category: string) => {
    Alert.alert(
      'Delete Category',
      'This removes the category from this selection list. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            setVisibleCategories((current) => current.filter((item) => item !== category));
            if (selectedCategory === category) {
              setSelectedCategory(null);
            }
          },
        },
      ]
    );
  };

  const handleContinue = () => {
    if (!selectedCategory) {
      return;
    }

    const categoryValue = categoryLabels[selectedCategory] ?? selectedCategory;

    router.push({
      pathname: '/item/add',
      params: { category: categoryValue },
    });
  };

  const handleAddCategory = () => {
    const trimmed = newCategoryName.trim();
    const trimmedDescription = newCategoryDescription.trim();
    if (!trimmed) {
      Alert.alert('Invalid name', 'Category name cannot be empty.');
      return;
    }
    if (!trimmedDescription) {
      Alert.alert('Invalid description', 'Please add a one-line description.');
      return;
    }

    if (Object.values(categoryLabels).some((label) => label.toLowerCase() === trimmed.toLowerCase())) {
      Alert.alert('Duplicate category', 'A category with this name already exists.');
      return;
    }

    const internalKey = `custom:${Date.now()}`;
    setVisibleCategories((current) => [internalKey, ...current]);
    setCategoryLabels((current) => ({ ...current, [internalKey]: trimmed }));
    setCategoryDescriptions((current) => ({ ...current, [internalKey]: trimmedDescription }));
    setSelectedCategory(internalKey);
    setShowAddModal(false);
    setNewCategoryName('');
    setNewCategoryDescription('');
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Select Category</Text>
        <View style={styles.placeholder} />
      </View>

      <Text style={styles.headerHint}>Select one main category to continue to the form.</Text>

      <View style={styles.addBar}>
        <TouchableOpacity
          style={styles.addCategoryButton}
          onPress={() => setShowAddModal(true)}
          activeOpacity={0.86}
        >
          <Ionicons name="add-circle-outline" size={16} color="#D7E3FF" />
          <Text style={styles.addCategoryButtonText}>Add New Category</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.listScroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {visibleCategories.map((category) => {
          const categoryCard = categories.find((item) => item.title === category);
          const cardDescription = categoryDescriptions[category] || categoryCard?.description || 'Choose this category to continue';

          return (
            <TouchableOpacity
              key={category}
              style={[styles.card, selectedCategory === category && styles.cardActive]}
              onPress={() => handleSelectCategory(category)}
              activeOpacity={0.86}
            >
              <View style={[styles.iconWrap, { backgroundColor: categoryCard?.accent ?? '#2D7FF9' }]}>
                <Ionicons name={categoryCard?.icon ?? 'grid-outline'} size={20} color="#FFFFFF" />
              </View>
              <View style={styles.cardTextWrap}>
                <Text style={styles.cardTitle}>{categoryLabels[category]}</Text>
                <Text style={styles.cardSubtitle} numberOfLines={1}>{cardDescription}</Text>
              </View>
              <View style={styles.cardActions}>
                <TouchableOpacity
                  style={styles.actionButton}
                  onPress={() => handleStartEdit(category)}
                  activeOpacity={0.86}
                >
                  <Ionicons name="create-outline" size={16} color="#D6DEED" />
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.actionButton}
                  onPress={() => handleDeleteCategory(category)}
                  activeOpacity={0.86}
                >
                  <Ionicons name="trash-outline" size={16} color="#FF8C8C" />
                </TouchableOpacity>
                {selectedCategory === category ? (
                  <Ionicons name="checkmark-circle" size={20} color="#84A9FF" />
                ) : (
                  <Ionicons name="chevron-forward" size={18} color="#93A0B8" />
                )}
              </View>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <Modal
        visible={showAddModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowAddModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Add Category</Text>
            <TextInput
              style={styles.modalInput}
              value={newCategoryName}
              onChangeText={setNewCategoryName}
              placeholder="New category name"
              placeholderTextColor="#5E6879"
            />
            <TextInput
              style={styles.modalInput}
              value={newCategoryDescription}
              onChangeText={setNewCategoryDescription}
              placeholder="One-line description"
              placeholderTextColor="#5E6879"
              maxLength={100}
            />
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonSecondary]}
                onPress={() => setShowAddModal(false)}
                activeOpacity={0.86}
              >
                <Text style={styles.modalButtonTextSecondary}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalButton}
                onPress={handleAddCategory}
                activeOpacity={0.86}
              >
                <Text style={styles.modalButtonText}>Add</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={Boolean(editingCategory)}
        transparent
        animationType="fade"
        onRequestClose={() => setEditingCategory(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Edit Category</Text>
            <TextInput
              style={styles.modalInput}
              value={draftLabel}
              onChangeText={setDraftLabel}
              placeholder="Category name"
              placeholderTextColor="#5E6879"
            />
            <TextInput
              style={styles.modalInput}
              value={draftDescription}
              onChangeText={setDraftDescription}
              placeholder="One-line description"
              placeholderTextColor="#5E6879"
              maxLength={100}
            />
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonSecondary]}
                onPress={() => setEditingCategory(null)}
                activeOpacity={0.86}
              >
                <Text style={styles.modalButtonTextSecondary}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalButton}
                onPress={handleSaveEdit}
                activeOpacity={0.86}
              >
                <Text style={styles.modalButtonText}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.continueButton, !selectedCategory && styles.continueButtonDisabled]}
          onPress={handleContinue}
          disabled={!selectedCategory}
          activeOpacity={0.86}
        >
          <Text style={styles.continueButtonText}>Continue</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F0F0F',
  },
  header: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#1A1A1A',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 19,
    fontWeight: '700',
  },
  placeholder: {
    width: 28,
  },
  headerHint: {
    color: '#8D95A3',
    fontSize: 12,
    paddingHorizontal: 18,
    paddingTop: 10,
  },
  content: {
    padding: 18,
    gap: 10,
    paddingBottom: 28,
  },
  listScroll: {
    flex: 1,
  },
  addBar: {
    paddingHorizontal: 18,
    paddingTop: 12,
  },
  addCategoryButton: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#1A2440',
    borderWidth: 1,
    borderColor: '#3A7AFE',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  addCategoryButtonText: {
    color: '#D7E3FF',
    fontSize: 12,
    fontWeight: '700',
  },
  card: {
    backgroundColor: '#151A22',
    borderWidth: 1,
    borderColor: '#242B38',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
  cardActive: {
    borderColor: '#3A7AFE',
    backgroundColor: '#1A2440',
  },
  iconWrap: {
    width: 38,
    height: 38,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  cardTextWrap: {
    flex: 1,
    marginRight: 8,
  },
  cardActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  actionButton: {
    width: 28,
    height: 28,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#2D3646',
    backgroundColor: '#12161F',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTitle: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 3,
  },
  cardSubtitle: {
    color: '#8D95A3',
    fontSize: 12,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  modalCard: {
    width: '100%',
    borderRadius: 12,
    backgroundColor: '#151A22',
    borderWidth: 1,
    borderColor: '#242B38',
    padding: 14,
  },
  modalTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 10,
  },
  modalInput: {
    backgroundColor: '#10141C',
    borderWidth: 1,
    borderColor: '#2A3241',
    borderRadius: 10,
    color: '#FFFFFF',
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 12,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
  },
  modalButton: {
    backgroundColor: '#3A7AFE',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  modalButtonSecondary: {
    backgroundColor: '#1E2533',
    borderWidth: 1,
    borderColor: '#2A3241',
  },
  modalButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  modalButtonTextSecondary: {
    color: '#C2CAD9',
    fontSize: 13,
    fontWeight: '700',
  },
  footer: {
    paddingHorizontal: 18,
    paddingBottom: 18,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#1A1A1A',
  },
  continueButton: {
    backgroundColor: '#3A7AFE',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  continueButtonDisabled: {
    opacity: 0.5,
  },
  continueButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
});

