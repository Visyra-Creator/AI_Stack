import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Modal,
  Alert,
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
  FlatList,
  useWindowDimensions,
  Image,
  GestureResponderEvent,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/src/context/ThemeContext';
import { Card } from '@/src/components/common/Card';
import { FormInput } from '@/src/components/common/FormInput';
import { Select } from '@/src/components/common/Select';
import { MultiSelect } from '@/src/components/common/MultiSelect';
import { EmptyState } from '@/src/components/common/EmptyState';
import * as ImagePicker from 'expo-image-picker';
import { businessStorage, businessCategoryStorage, BusinessItem } from '@/src/services/storage';

const SORT_OPTIONS = [
  { label: 'Recent', value: 'recent' },
  { label: 'Name', value: 'name' },
  { label: 'Section', value: 'section' },
] as const;

type SortValue = (typeof SORT_OPTIONS)[number]['value'];
type ViewMode = 'normal' | 'gallery';

export default function BusinessScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const galleryColumns = windowWidth > windowHeight ? 4 : 3;
  const galleryCardWidth = (windowWidth - 32 - (galleryColumns - 1) * 8) / galleryColumns;
  const [items, setItems] = useState<BusinessItem[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingItem, setEditingItem] = useState<BusinessItem | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [sections, setSections] = useState<string[]>(['General']);
  const [activeSection, setActiveSection] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeSort, setActiveSort] = useState<SortValue>('recent');
  const [viewMode, setViewMode] = useState<ViewMode>('normal');
  const [filterModalVisible, setFilterModalVisible] = useState(false);
  const [sortModalVisible, setSortModalVisible] = useState(false);
  const [newSection, setNewSection] = useState('');
  const [sectionModalVisible, setSectionModalVisible] = useState(false);
  const [categories, setCategories] = useState<string[]>([]);
  const [activeFilter, setActiveFilter] = useState('All');
  const [categoriesModalVisible, setCategoriesModalVisible] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [editingCategory, setEditingCategory] = useState<string | null>(null);
  const [editingCategoryName, setEditingCategoryName] = useState('');
  const [images, setImages] = useState<string[]>([]);

  const [formData, setFormData] = useState({
    sectionName: 'General',
    name: '',
    description: '',
    link: '',
    instructions: '',
    categories: [] as string[],
    images: [] as string[],
  });

  const loadItems = useCallback(async () => {
    const data = await businessStorage.getAll();
    setItems(data);
    // Extract unique sections
    const uniqueSections = [...new Set(data.map(item => item.sectionName))];
    if (uniqueSections.length > 0) {
      setSections(prev => [...new Set([...prev, ...uniqueSections])]);
    }
  }, []);

  const loadCategories = useCallback(async () => {
    const data = await businessCategoryStorage.getAll();
    setCategories(data);
  }, []);

  useEffect(() => {
    loadItems();
    loadCategories();
  }, [loadItems, loadCategories]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadItems();
    setRefreshing(false);
  };

  const resetForm = () => {
    setFormData({
      sectionName: sections[0] || 'General',
      name: '',
      description: '',
      link: '',
      instructions: '',
      categories: [],
      images: [],
    });
    setEditingItem(null);
  };

  const openAddModal = () => {
    resetForm();
    setModalVisible(true);
  };

  const openEditModal = (item: BusinessItem) => {
    setEditingItem(item);
    setFormData({
      sectionName: item.sectionName,
      name: item.name,
      description: item.description,
      link: item.link,
      instructions: item.instructions,
      categories: item.categories || [],
      images: item.images || [],
    });
    setModalVisible(true);
  };

  const handleSave = async () => {
    if (!formData.name.trim()) {
      Alert.alert('Error', 'Name is required');
      return;
    }

    if (editingItem) {
      await businessStorage.update(editingItem.id, formData);
    } else {
      await businessStorage.add(formData);
    }

    await loadItems();
    setModalVisible(false);
    resetForm();
  };

  const pickImage = async () => {
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permissionResult.granted) {
      Alert.alert('Permission required', 'Permission to access media library is required!');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [4, 3],
      quality: 1,
    });

    if (!result.canceled && result.assets && result.assets.length > 0) {
      const newImages = [...formData.images, result.assets[0].uri];
      setFormData({ ...formData, images: newImages });
    }
  };

  const removeImage = (imageUri: string) => {
    const newImages = formData.images.filter(uri => uri !== imageUri);
    setFormData({ ...formData, images: newImages });
  };

  const handleDelete = (item: BusinessItem) => {
    Alert.alert('Delete', `Are you sure you want to delete "${item.name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await businessStorage.delete(item.id);
          await loadItems();
        },
      },
    ]);
  };

  const addSection = () => {
    if (newSection.trim() && !sections.includes(newSection.trim())) {
      setSections([...sections, newSection.trim()]);
      setNewSection('');
      setSectionModalVisible(false);
    }
  };

  const normalizeCategory = (value: string) => value.trim();

  const addCategory = async () => {
    const value = normalizeCategory(newCategoryName);
    if (!value) {
      Alert.alert('Error', 'Category name cannot be empty');
      return;
    }

    if (categories.some(category => category.toLowerCase() === value.toLowerCase())) {
      Alert.alert('Error', 'Category already exists');
      return;
    }

    const updatedCategories = [...categories, value];
    await businessCategoryStorage.saveAll(updatedCategories);
    setCategories(updatedCategories);
    setNewCategoryName('');
  };

  const startEditCategory = (category: string) => {
    setEditingCategory(category);
    setEditingCategoryName(category);
  };

  const saveEditedCategory = async () => {
    if (!editingCategory) return;

    const value = normalizeCategory(editingCategoryName);
    if (!value) {
      Alert.alert('Error', 'Category name cannot be empty');
      return;
    }

    if (
      categories.some(
        category =>
          category.toLowerCase() === value.toLowerCase() &&
          category.toLowerCase() !== editingCategory.toLowerCase(),
      )
    ) {
      Alert.alert('Error', 'Category already exists');
      return;
    }

    const updatedCategories = categories.map(category =>
      category === editingCategory ? value : category,
    );
    await businessCategoryStorage.saveAll(updatedCategories);
    setCategories(updatedCategories);

    const allItems = await businessStorage.getAll();
    const affectedItems = allItems.filter(item => item.categories?.includes(editingCategory));
    await Promise.all(
      affectedItems.map(item =>
        businessStorage.update(item.id, {
          categories: item.categories?.map(category =>
            category === editingCategory ? value : category,
          ),
        }),
      ),
    );

    if (activeFilter === editingCategory) {
      setActiveFilter(value);
    }

    setFormData(prev => ({
      ...prev,
      categories: prev.categories.map(category =>
        category === editingCategory ? value : category,
      ),
    }));

    setEditingCategory(null);
    setEditingCategoryName('');
    await loadItems();
  };

  const deleteCategory = (categoryToDelete: string) => {
    Alert.alert(
      'Delete Category',
      `Delete "${categoryToDelete}"? This removes it from existing items too.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            const updatedCategories = categories.filter(category => category !== categoryToDelete);
            await businessCategoryStorage.saveAll(updatedCategories);
            setCategories(updatedCategories);

            const allItems = await businessStorage.getAll();
            const affectedItems = allItems.filter(item => item.categories?.includes(categoryToDelete));
            await Promise.all(
              affectedItems.map(item =>
                businessStorage.update(item.id, {
                  categories: item.categories?.filter(category => category !== categoryToDelete),
                }),
              ),
            );

            if (activeFilter === categoryToDelete) {
              setActiveFilter('All');
            }

            setFormData(prev => ({
              ...prev,
              categories: prev.categories.filter(category => category !== categoryToDelete),
            }));

            if (editingCategory === categoryToDelete) {
              setEditingCategory(null);
              setEditingCategoryName('');
            }

            await loadItems();
          },
        },
      ],
    );
  };

  const filteredItems = items.filter(item => {
    const matchesQuery =
      item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.sectionName.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesFilter = activeSection === 'All' || item.sectionName === activeSection;
    return matchesQuery && matchesFilter;
  });

  const displayedItems = [...filteredItems].sort((a, b) => {
    if (activeSort === 'name') {
      return a.name.localeCompare(b.name);
    }
    if (activeSort === 'section') {
      return a.sectionName.localeCompare(b.sectionName);
    }
    return b.createdAt - a.createdAt;
  });

  const filterOptions = ['All', ...sections];

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.text }]}>Business</Text>
        <View style={styles.headerActions}>
          <TouchableOpacity onPress={() => setSectionModalVisible(true)} style={styles.sectionButton}>
            <Ionicons name="folder-outline" size={22} color={colors.primary} />
          </TouchableOpacity>
          <TouchableOpacity onPress={openAddModal} style={[styles.addButton, { backgroundColor: colors.primary }]}>
            <Ionicons name="add" size={24} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.searchContainer}>
        <View style={styles.searchRow}>
          <View style={[styles.searchBox, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Ionicons name="search" size={20} color={colors.textSecondary} />
            <TextInput
              placeholder="Search items..."
              value={searchQuery}
              onChangeText={setSearchQuery}
              style={[styles.searchInput, { color: colors.text }]}
              placeholderTextColor={colors.textSecondary}
            />
          </View>
          <TouchableOpacity
            style={[styles.controlButton, { backgroundColor: colors.surface, borderColor: colors.border }]}
            onPress={() => setFilterModalVisible(true)}
          >
            <Ionicons name="funnel-outline" size={16} color={colors.textSecondary} />
            <Text style={[styles.controlButtonText, { color: colors.text }]} numberOfLines={1}>
              {activeSection}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.controlButton, { backgroundColor: colors.surface, borderColor: colors.border }]}
            onPress={() => setSortModalVisible(true)}
          >
            <Ionicons name="swap-vertical-outline" size={16} color={colors.textSecondary} />
            <Text style={[styles.controlButtonText, { color: colors.text }]} numberOfLines={1}>
              {SORT_OPTIONS.find(option => option.value === activeSort)?.label}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.controlButton, { backgroundColor: colors.surface, borderColor: colors.border }]}
            onPress={() => setViewMode(prev => (prev === 'normal' ? 'gallery' : 'normal'))}
          >
            <Ionicons
              name={viewMode === 'normal' ? 'grid-outline' : 'list-outline'}
              size={16}
              color={colors.textSecondary}
            />
            <Text style={[styles.controlButtonText, { color: colors.text }]} numberOfLines={1}>
              {viewMode === 'normal' ? 'Gallery' : 'List'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabsContainer}>
        <TouchableOpacity
          style={[
            styles.tab,
            activeSection === 'All' && { backgroundColor: colors.primary },
            { borderColor: colors.border },
          ]}
          onPress={() => setActiveSection('All')}
        >
          <Text style={[styles.tabText, { color: activeSection === 'All' ? '#FFFFFF' : colors.text }]}>
            All
          </Text>
        </TouchableOpacity>
        {sections.map(section => (
          <TouchableOpacity
            key={section}
            style={[
              styles.tab,
              activeSection === section && { backgroundColor: colors.primary },
              { borderColor: colors.border },
            ]}
            onPress={() => setActiveSection(section)}
          >
            <Text style={[styles.tabText, { color: activeSection === section ? '#FFFFFF' : colors.text }]}>
              {section}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {displayedItems.length === 0 ? (
        <EmptyState
          icon="briefcase-outline"
          title="No Business Items"
          description="Add business tools, resources, and notes."
          actionLabel="Add Item"
          onAction={openAddModal}
        />
      ) : viewMode === 'normal' ? (
        <ScrollView
          style={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        >
          {displayedItems.map(item => (
            <Card
              key={item.id}
              title={item.name}
              subtitle={item.description}
              tags={[item.sectionName]}
              onEdit={() => openEditModal(item)}
              onDelete={() => handleDelete(item)}
            >
              {item.link && (
                <Text style={[styles.link, { color: colors.primary }]} numberOfLines={1}>
                  {item.link}
                </Text>
              )}
            </Card>
          ))}
        </ScrollView>
      ) : (
        <FlatList
          key={`gallery-${galleryColumns}`}
          style={styles.list}
          data={displayedItems}
          keyExtractor={(item) => item.id}
          numColumns={galleryColumns}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.galleryListContent}
          columnWrapperStyle={styles.galleryColumnWrapper}
          renderItem={({ item }) => {
            const uri = item.images && item.images.length > 0 ? item.images[0] : undefined;
            return (
              <TouchableOpacity
                style={[
                  styles.galleryCard,
                  { width: galleryCardWidth, backgroundColor: colors.card, borderColor: colors.border },
                ]}
                onPress={() => openEditModal(item)}
                activeOpacity={0.85}
              >
                {uri ? (
                  <Image source={{ uri }} style={styles.galleryImage} resizeMode="cover" />
                ) : (
                  <View style={[styles.galleryPlaceholder, { backgroundColor: colors.surface }]}>
                    <Ionicons name="briefcase-outline" size={24} color={colors.textSecondary} />
                  </View>
                )}
                <View style={styles.galleryOverlay}>
                  <Text style={styles.galleryTitle} numberOfLines={1}>{item.name}</Text>
                  <Text style={styles.gallerySubtitle} numberOfLines={1}>
                    {item.description || 'No description'}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          }}
        />
      )}

      <Modal visible={filterModalVisible} transparent animationType="fade">
        <View style={styles.overlay}>
          <View style={[styles.optionSheet, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.optionTitle, { color: colors.text }]}>Filter by Section</Text>
            <ScrollView>
              {filterOptions.map(option => (
                <TouchableOpacity
                  key={option}
                  style={styles.optionRow}
                  onPress={() => {
                    setActiveSection(option);
                    setFilterModalVisible(false);
                  }}
                >
                  <Text style={[styles.optionText, { color: colors.text }]}>{option}</Text>
                  {activeSection === option && <Ionicons name="checkmark" size={18} color={colors.primary} />}
                </TouchableOpacity>
              ))}
            </ScrollView>
            <TouchableOpacity onPress={() => setFilterModalVisible(false)} style={styles.optionClose}>
              <Text style={[styles.optionCloseText, { color: colors.textSecondary }]}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={sortModalVisible} transparent animationType="fade">
        <View style={styles.overlay}>
          <View style={[styles.optionSheet, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.optionTitle, { color: colors.text }]}>Sort by</Text>
            {SORT_OPTIONS.map(option => (
              <TouchableOpacity
                key={option.value}
                style={styles.optionRow}
                onPress={() => {
                  setActiveSort(option.value);
                  setSortModalVisible(false);
                }}
              >
                <Text style={[styles.optionText, { color: colors.text }]}>{option.label}</Text>
                {activeSort === option.value && <Ionicons name="checkmark" size={18} color={colors.primary} />}
              </TouchableOpacity>
            ))}
            <TouchableOpacity onPress={() => setSortModalVisible(false)} style={styles.optionClose}>
              <Text style={[styles.optionCloseText, { color: colors.textSecondary }]}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Add/Edit Item Modal */}
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
              {editingItem ? 'Edit Item' : 'Add Item'}
            </Text>
            <TouchableOpacity onPress={handleSave}>
              <Text style={[styles.saveText, { color: colors.primary }]}>Save</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.form} showsVerticalScrollIndicator={false}>
            <Select
              label="Section"
              options={sections}
              value={formData.sectionName}
              onChange={(sectionName) => setFormData({ ...formData, sectionName })}
            />
            <MultiSelect
              label="Categories"
              options={categories}
              selected={formData.categories}
              onChange={(categories) => setFormData({ ...formData, categories })}
            />
            <TouchableOpacity
              style={[styles.manageCategoriesButton, { borderColor: colors.border, backgroundColor: colors.surface }]}
              onPress={() => setCategoriesModalVisible(true)}
            >
              <Ionicons name="settings-outline" size={16} color={colors.textSecondary} />
              <Text style={[styles.manageCategoriesText, { color: colors.text }]}>Manage Categories</Text>
            </TouchableOpacity>
            <FormInput
              label="Name *"
              placeholder="e.g., CRM Tool"
              value={formData.name}
              onChangeText={(text) => setFormData({ ...formData, name: text })}
            />
            <FormInput
              label="Description"
              placeholder="What is this for?"
              value={formData.description}
              onChangeText={(text) => setFormData({ ...formData, description: text })}
              multiline
              numberOfLines={3}
              style={styles.textArea}
            />
            <FormInput
              label="Link"
              placeholder="https://..."
              value={formData.link}
              onChangeText={(text) => setFormData({ ...formData, link: text })}
              keyboardType="url"
              autoCapitalize="none"
            />
            <FormInput
              label="Instructions"
              placeholder="Notes, how to use..."
              value={formData.instructions}
              onChangeText={(text) => setFormData({ ...formData, instructions: text })}
              multiline
              numberOfLines={4}
              style={styles.textArea}
            />
            <View style={styles.imageSection}>
              <Text style={[styles.imageSectionTitle, { color: colors.text }]}>Images</Text>
              <View style={styles.imageGrid}>
                {formData.images.map((imageUri, index) => (
                  <View key={index} style={styles.imageContainer}>
                    <Image source={{ uri: imageUri }} style={styles.imagePreview} />
                    <TouchableOpacity
                      style={styles.removeImageButton}
                      onPress={() => removeImage(imageUri)}
                    >
                      <Ionicons name="close-circle" size={20} color="#FFFFFF" />
                    </TouchableOpacity>
                  </View>
                ))}
                <TouchableOpacity style={[styles.addImageButton, { borderColor: colors.border, backgroundColor: colors.surface }]} onPress={pickImage}>
                  <Ionicons name="add" size={24} color={colors.text} />
                  <Text style={[styles.addImageText, { color: colors.textSecondary }]}>Add Image</Text>
                </TouchableOpacity>
              </View>
            </View>
            <View style={styles.bottomPadding} />
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>

      {/* Add Section Modal */}
      <Modal visible={sectionModalVisible} transparent animationType="fade">
        <TouchableOpacity
          style={styles.sectionModalOverlay}
          activeOpacity={1}
          onPress={() => setSectionModalVisible(false)}
        >
          <View style={[styles.sectionModalContent, { backgroundColor: colors.surface }]}>
            <Text style={[styles.sectionModalTitle, { color: colors.text }]}>Add New Section</Text>
            <FormInput
              label="Section Name"
              placeholder="e.g., Marketing, Finance"
              value={newSection}
              onChangeText={setNewSection}
            />
            <TouchableOpacity
              style={[styles.addSectionButton, { backgroundColor: colors.primary }]}
              onPress={addSection}
            >
              <Text style={styles.addSectionButtonText}>Add Section</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Categories Modal */}
      <Modal visible={categoriesModalVisible} transparent animationType="fade">
        <View style={styles.overlay}>
          <View style={[styles.optionSheet, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.optionTitle, { color: colors.text }]}>Manage Categories</Text>

            <View style={[styles.categoryInputRow, { borderColor: colors.border, backgroundColor: colors.surface }]}>
              <TextInput
                value={newCategoryName}
                onChangeText={setNewCategoryName}
                placeholder="New category"
                placeholderTextColor={colors.textSecondary}
                style={[styles.categoryInput, { color: colors.text }]}
              />
              <TouchableOpacity
                style={[styles.categoryActionButton, { backgroundColor: colors.primary }]}
                onPress={addCategory}
              >
                <Ionicons name="add" size={16} color="#FFFFFF" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.categoriesList}>
              {categories.map(category => (
                <View key={category} style={[styles.categoryRow, { borderBottomColor: colors.border }]}>
                  {editingCategory === category ? (
                    <TextInput
                      value={editingCategoryName}
                      onChangeText={setEditingCategoryName}
                      style={[styles.categoryEditInput, { color: colors.text, borderColor: colors.border }]}
                    />
                  ) : (
                    <Text style={[styles.optionText, { color: colors.text }]}>{category}</Text>
                  )}

                  <View style={styles.categoryActions}>
                    {editingCategory === category ? (
                      <TouchableOpacity onPress={saveEditedCategory} style={styles.categoryIconButton}>
                        <Ionicons name="checkmark" size={18} color={colors.success} />
                      </TouchableOpacity>
                    ) : (
                      <TouchableOpacity onPress={() => startEditCategory(category)} style={styles.categoryIconButton}>
                        <Ionicons name="create-outline" size={17} color={colors.textSecondary} />
                      </TouchableOpacity>
                    )}
                    <TouchableOpacity onPress={() => deleteCategory(category)} style={styles.categoryIconButton}>
                      <Ionicons name="trash-outline" size={17} color={colors.danger} />
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
            </ScrollView>

            <TouchableOpacity
              onPress={() => {
                setCategoriesModalVisible(false);
                setEditingCategory(null);
                setEditingCategoryName('');
                setNewCategoryName('');
              }}
              style={styles.optionClose}
            >
              <Text style={[styles.optionCloseText, { color: colors.textSecondary }]}>Done</Text>
            </TouchableOpacity>
          </View>
        </View>
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
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sectionButton: {
    padding: 8,
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
  searchContainer: {
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  searchBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 42,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
  },
  controlButton: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 10,
    height: 42,
    gap: 6,
    maxWidth: 110,
  },
  controlButtonText: {
    fontSize: 12,
    fontWeight: '500',
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
  galleryListContent: {
    paddingBottom: 12,
  },
  galleryColumnWrapper: {
    gap: 8,
    marginBottom: 8,
  },
  galleryCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 10,
    minHeight: 120,
  },
  galleryTitle: {
    fontSize: 14,
    fontWeight: '600',
  },
  gallerySubtitle: {
    fontSize: 12,
    marginTop: 6,
    lineHeight: 16,
    flex: 1,
  },
  galleryTag: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginTop: 8,
  },
  galleryTagText: {
    fontSize: 11,
    fontWeight: '600',
  },
  link: {
    fontSize: 12,
    marginTop: 8,
  },
  overlay: {
    flex: 1,
    justifyContent: 'center',
    padding: 24,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  optionSheet: {
    borderWidth: 1,
    borderRadius: 16,
    maxHeight: '70%',
    paddingVertical: 10,
  },
  optionTitle: {
    fontSize: 16,
    fontWeight: '600',
    paddingHorizontal: 14,
    paddingBottom: 8,
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  optionText: {
    fontSize: 14,
    fontWeight: '500',
  },
  optionClose: {
    marginTop: 4,
    alignSelf: 'center',
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  optionCloseText: {
    fontSize: 14,
    fontWeight: '500',
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
    minHeight: 100,
    textAlignVertical: 'top',
  },
  bottomPadding: {
    height: 40,
  },
  sectionModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: 20,
  },
  sectionModalContent: {
    borderRadius: 16,
    padding: 20,
  },
  sectionModalTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
  },
  addSectionButton: {
    padding: 14,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 8,
  },
  addSectionButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  manageCategoriesButton: {
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 9,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  manageCategoriesText: {
    fontSize: 13,
    fontWeight: '500',
  },
  categoryInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 12,
  },
  categoryInput: {
    flex: 1,
    fontSize: 14,
  },
  categoryActionButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  categoriesList: {
    maxHeight: 200,
  },
  categoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  categoryEditInput: {
    flex: 1,
    fontSize: 14,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  categoryActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  categoryIconButton: {
    padding: 6,
  },
  galleryPlaceholder: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  galleryImage: {
    width: '100%',
    height: '100%',
  },
  galleryOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  imageSection: {
    marginTop: 16,
  },
  imageSectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  imageGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  imageContainer: {
    position: 'relative',
    width: 80,
    height: 80,
    borderRadius: 12,
    overflow: 'hidden',
  },
  imagePreview: {
    width: '100%',
    height: '100%',
    borderRadius: 12,
  },
  removeImageButton: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 10,
    padding: 2,
  },
  addImageButton: {
    width: 80,
    height: 80,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  addImageText: {
    fontSize: 10,
    textAlign: 'center',
  },
});
