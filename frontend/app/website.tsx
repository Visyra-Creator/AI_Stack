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
  TextInput,
  Linking,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/src/context/ThemeContext';
import { Card } from '@/src/components/common/Card';
import { FormInput } from '@/src/components/common/FormInput';
import { Select } from '@/src/components/common/Select';
import { EmptyState } from '@/src/components/common/EmptyState';
import { websiteStorage, WebsiteItem, websiteCategoryStorage } from '@/src/services/storage';

const SORT_OPTIONS = [
  { label: 'Recent', value: 'recent' },
  { label: 'Name', value: 'name' },
] as const;

type SortValue = (typeof SORT_OPTIONS)[number]['value'];

const TABLE_BASE_WIDTH = {
  actions: 148,
  name: 220,
  category: 140,
  link: 270,
  description: 270,
};

const TABLE_FLEX_WIDTH =
  TABLE_BASE_WIDTH.name +
  TABLE_BASE_WIDTH.category +
  TABLE_BASE_WIDTH.link +
  TABLE_BASE_WIDTH.description;

const TABLE_MIN_CONTENT_WIDTH =
  TABLE_BASE_WIDTH.actions +
  TABLE_FLEX_WIDTH;

export default function WebsiteScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { width: viewportWidth } = useWindowDimensions();

  const listHorizontalPadding = 24;
  const availableTableWidth = Math.max(320, viewportWidth - listHorizontalPadding);
  const resolvedTableWidth = Math.max(availableTableWidth, TABLE_MIN_CONTENT_WIDTH);
  const scaledFlexWidth = resolvedTableWidth - TABLE_BASE_WIDTH.actions;
  const widthScale = scaledFlexWidth / TABLE_FLEX_WIDTH;
  const columnWidths = {
    actions: TABLE_BASE_WIDTH.actions,
    name: Math.round(TABLE_BASE_WIDTH.name * widthScale),
    category: Math.round(TABLE_BASE_WIDTH.category * widthScale),
    link: Math.round(TABLE_BASE_WIDTH.link * widthScale),
    description: Math.round(TABLE_BASE_WIDTH.description * widthScale),
  };

  // Dynamic styles that depend on theme colors
  const dynamicStyles = {
    link: {
      color: colors.primary,
    },
  };

  const [items, setItems] = useState<WebsiteItem[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [detailsVisible, setDetailsVisible] = useState(false);
  const [selectedItem, setSelectedItem] = useState<WebsiteItem | null>(null);
  const [editingItem, setEditingItem] = useState<WebsiteItem | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState('All');
  const [activeSort, setActiveSort] = useState<SortValue>('recent');

  const [filterModalVisible, setFilterModalVisible] = useState(false);
  const [sortModalVisible, setSortModalVisible] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    toolLink: '',
    description: '',
    category: '',
  });

  const [categories, setCategories] = useState<string[]>([]);
  const [categoriesModalVisible, setCategoriesModalVisible] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [editingCategory, setEditingCategory] = useState<string | null>(null);
  const [editingCategoryName, setEditingCategoryName] = useState('');

  const loadItems = useCallback(async () => {
    const data = await websiteStorage.getAll();
    setItems(data);
  }, []);

  const loadCategories = useCallback(async () => {
    const data = await websiteCategoryStorage.getAll();
    setCategories(data);
  }, []);

  useEffect(() => {
    loadItems();
    loadCategories();
  }, [loadItems, loadCategories]);

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([loadItems(), loadCategories()]);
    setRefreshing(false);
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
    await websiteCategoryStorage.saveAll(updatedCategories);
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
    await websiteCategoryStorage.saveAll(updatedCategories);
    setCategories(updatedCategories);

    const allItems = await websiteStorage.getAll();
    const affectedItems = allItems.filter(item => item.category === editingCategory);
    await Promise.all(
      affectedItems.map(item =>
        websiteStorage.update(item.id, {
          category: value,
        }),
      ),
    );

    if (filterCategory === editingCategory) {
      setFilterCategory(value);
    }

    setFormData(prev => ({
      ...prev,
      category: prev.category === editingCategory ? value : prev.category,
    }));

    setEditingCategory(null);
    setEditingCategoryName('');
    await loadItems();
  };

  const deleteCategory = (categoryToDelete: string) => {
    Alert.alert(
      'Delete Category',
      `Delete "${categoryToDelete}"? This removes it from existing websites too.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            const updatedCategories = categories.filter(category => category !== categoryToDelete);
            await websiteCategoryStorage.saveAll(updatedCategories);
            setCategories(updatedCategories);

            const allItems = await websiteStorage.getAll();
            const affectedItems = allItems.filter(item => item.category === categoryToDelete);
            await Promise.all(
              affectedItems.map(item =>
                websiteStorage.update(item.id, {
                  category: '',
                }),
              ),
            );

            if (filterCategory === categoryToDelete) {
              setFilterCategory('All');
            }

            setFormData(prev => ({
              ...prev,
              category: prev.category === categoryToDelete ? '' : prev.category,
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

  const openDetailsModal = (item: WebsiteItem) => {
    setSelectedItem(item);
    setDetailsVisible(true);
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

  const toggleFavorite = async (item: WebsiteItem) => {
    const nextFavorite = !(item.isFavorite ?? false);

    // Optimistic update so table-row icon responds instantly.
    setItems(prev =>
      prev.map(current =>
        current.id === item.id
          ? {
              ...current,
              isFavorite: nextFavorite,
              favoritedAt: nextFavorite ? Date.now() : undefined,
            }
          : current,
      ),
    );

    try {
      await websiteStorage.update(item.id, {
        isFavorite: nextFavorite,
        favoritedAt: nextFavorite ? Date.now() : undefined,
      });
    } catch {
      // Revert local state if persistence fails.
      setItems(prev =>
        prev.map(current =>
          current.id === item.id
            ? {
                ...current,
                isFavorite: item.isFavorite ?? false,
                favoritedAt: item.favoritedAt,
              }
            : current,
        ),
      );
    }
  };

  const filteredItems = items.filter(item => {
    const matchesQuery =
      item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (item.category && item.category.toLowerCase().includes(searchQuery.toLowerCase()));
    
    const matchesFilter =
      filterCategory === 'All' ||
      (filterCategory === 'Favorites' ? (item.isFavorite ?? false) : item.category === filterCategory);

    return matchesQuery && matchesFilter;
  });

  const displayedItems = [...filteredItems].sort((a, b) => {
    if (activeSort === 'name') {
      return a.name.localeCompare(b.name);
    }
    return b.createdAt - a.createdAt;
  });

  const uniqueCategories = ['All', 'Favorites', ...categories];
  const isFavoritesOnly = filterCategory === 'Favorites';

  const toggleFavoritesOnly = () => {
    setFilterCategory(prev => (prev === 'Favorites' ? 'All' : 'Favorites'));
  };

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

      <View style={styles.searchContainer}>
        <View style={styles.searchRow}>
          <View style={[styles.searchBox, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Ionicons name="search" size={20} color={colors.textSecondary} />
            <TextInput
              placeholder="Search websites..."
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
              {filterCategory}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.favoriteFilterButton,
              {
                backgroundColor: isFavoritesOnly ? colors.primary + '20' : colors.surface,
                borderColor: isFavoritesOnly ? colors.primary : colors.border,
              },
            ]}
            onPress={toggleFavoritesOnly}
          >
            <Ionicons
              name={isFavoritesOnly ? 'heart' : 'heart-outline'}
              size={16}
              color={isFavoritesOnly ? colors.primary : colors.textSecondary}
            />
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
        </View>
      </View>

      {displayedItems.length === 0 ? (
        <EmptyState
          icon="globe-outline"
          title="No Websites Found"
          description="Try adjusting your filters or save a new website."
          actionLabel="Add Website"
          onAction={openAddModal}
        />
      ) : (
        // Table-only layout for Website page
        <View style={styles.list}>
          <ScrollView
            horizontal={true}
            showsHorizontalScrollIndicator={true}
            style={styles.tableContainer}
            contentContainerStyle={[styles.tableContent, { minWidth: resolvedTableWidth }]}
          >
            <ScrollView
              style={styles.tableScroll}
              refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
            >
              {/* Table Headers */}
              <View
                style={[
                  styles.tableShell,
                  {
                    borderColor: colors.border,
                    backgroundColor: colors.card,
                    width: resolvedTableWidth,
                  },
                ]}
              >
                <View style={[styles.tableHeader, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
                  <View style={[styles.columnHeaderActions, { width: columnWidths.actions }]}>
                    <Text style={[styles.headerText, { color: colors.textSecondary }]}>Actions</Text>
                  </View>
                  <View style={[styles.columnHeaderName, { width: columnWidths.name }]}>
                    <Text style={[styles.headerText, { color: colors.textSecondary }]}>Website Name</Text>
                  </View>
                  <View style={[styles.columnHeaderCategory, { width: columnWidths.category }]}>
                    <Text style={[styles.headerText, { color: colors.textSecondary }]}>Category</Text>
                  </View>
                  <View style={[styles.columnHeaderLink, { width: columnWidths.link }]}>
                    <Text style={[styles.headerText, { color: colors.textSecondary }]}>Website Link</Text>
                  </View>
                  <View style={[styles.columnHeaderDescription, { width: columnWidths.description }]}>
                    <Text style={[styles.headerText, { color: colors.textSecondary }]}>One Line Description</Text>
                  </View>
                </View>

                {/* Table Rows */}
                {displayedItems.map((item, index) => (
                  <View
                    key={item.id}
                    style={[
                      styles.tableRow,
                      {
                        backgroundColor: index % 2 === 0 ? colors.card : colors.surface,
                        borderBottomColor: colors.border,
                      },
                    ]}
                  >
                    <View style={[styles.actionsCell, { width: columnWidths.actions }]}>
                      <TouchableOpacity
                        style={[styles.actionButton, { backgroundColor: colors.surface, borderColor: colors.border }]}
                        onPress={() => toggleFavorite(item)}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        activeOpacity={0.75}
                      >
                        <Ionicons
                          name={(item.isFavorite ?? false) ? 'heart' : 'heart-outline'}
                          size={16}
                          color={(item.isFavorite ?? false) ? colors.danger : colors.textSecondary}
                        />
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={[styles.actionButton, { backgroundColor: colors.surface, borderColor: colors.border }]}
                        onPress={() => openDetailsModal(item)}
                      >
                        <Ionicons name="eye-outline" size={16} color={colors.textSecondary} />
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={[styles.actionButton, { backgroundColor: colors.surface, borderColor: colors.border }]}
                        onPress={() => openEditModal(item)}
                      >
                        <Ionicons name="create-outline" size={16} color={colors.textSecondary} />
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={[styles.actionButton, { backgroundColor: colors.surface, borderColor: colors.border }]}
                        onPress={() => handleDelete(item)}
                      >
                        <Ionicons name="trash-outline" size={16} color={colors.textSecondary} />
                      </TouchableOpacity>
                    </View>

                    <View style={[styles.nameCell, { width: columnWidths.name }]}>
                      <Text style={[styles.nameText, { color: colors.text }]} numberOfLines={1}>{item.name}</Text>
                    </View>

                    <View style={[styles.categoryCell, { width: columnWidths.category }]}>
                      <View style={[styles.categoryPill, { backgroundColor: colors.primary + '1A' }]}>
                        <Text style={[styles.categoryPillText, { color: colors.primary }]} numberOfLines={1}>
                          {item.category || 'Uncategorized'}
                        </Text>
                      </View>
                    </View>

                    <View style={[styles.linkCell, { width: columnWidths.link }]}>
                      {item.toolLink ? (
                        <TouchableOpacity onPress={() => Linking.openURL(item.toolLink).catch(() => console.log('Failed to open link'))}>
                          <Text style={[styles.link, dynamicStyles.link]} numberOfLines={1}>
                            {item.toolLink}
                          </Text>
                        </TouchableOpacity>
                      ) : (
                        <Text style={[styles.mutedText, { color: colors.textSecondary }]}>-</Text>
                      )}
                    </View>

                    <View style={[styles.descriptionCell, { width: columnWidths.description }]}>
                      <Text style={[styles.mutedText, { color: colors.textSecondary }]} numberOfLines={1}>
                        {item.description || 'No description'}
                      </Text>
                    </View>
                  </View>
                ))}
              </View>
            </ScrollView>
          </ScrollView>
        </View>
      )}

      <Modal visible={detailsVisible} transparent animationType="fade" onRequestClose={() => setDetailsVisible(false)}>
        <View style={styles.overlayCenter}>
          <View style={[styles.detailsPopup, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={[styles.detailsHeader, { borderBottomColor: colors.border }]}>
              <Text style={[styles.detailsTitle, { color: colors.text }]}>Website Details</Text>
              <TouchableOpacity onPress={() => setDetailsVisible(false)}>
                <Ionicons name="close" size={20} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
            {selectedItem && (
              <View style={styles.detailsContent}>
                <Text style={[styles.detailsName, { color: colors.text }]}>{selectedItem.name}</Text>
                <View style={[styles.categoryPill, { backgroundColor: colors.primary + '1A', alignSelf: 'flex-start', marginTop: 8 }]}>
                  <Text style={[styles.categoryPillText, { color: colors.primary }]}>
                    {selectedItem.category || 'Uncategorized'}
                  </Text>
                </View>

                <Text style={[styles.detailsLabel, { color: colors.textSecondary }]}>Website Link</Text>
                {selectedItem.toolLink ? (
                  <TouchableOpacity onPress={() => Linking.openURL(selectedItem.toolLink).catch(() => console.log('Failed to open link'))}>
                    <Text style={[styles.link, dynamicStyles.link]} numberOfLines={2}>{selectedItem.toolLink}</Text>
                  </TouchableOpacity>
                ) : (
                  <Text style={[styles.mutedText, { color: colors.textSecondary }]}>-</Text>
                )}

                <Text style={[styles.detailsLabel, { color: colors.textSecondary }]}>Description</Text>
                <Text style={[styles.mutedText, { color: colors.text }]}>
                  {selectedItem.description || 'No description'}
                </Text>
              </View>
            )}
          </View>
        </View>
      </Modal>

      {/* Filter Modal */}
      <Modal visible={filterModalVisible} transparent animationType="fade">
        <View style={styles.overlay}>
          <View style={[styles.optionSheet, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.optionTitle, { color: colors.text }]}>Filter by Category</Text>
            {uniqueCategories.map(option => (
              <TouchableOpacity
                key={option}
                style={styles.optionRow}
                onPress={() => {
                  setFilterCategory(option);
                  setFilterModalVisible(false);
                }}
              >
                <Text style={[styles.optionText, { color: colors.text }]}>{option}</Text>
                {filterCategory === option && <Ionicons name="checkmark" size={18} color={colors.primary} />}
              </TouchableOpacity>
            ))}
            <TouchableOpacity onPress={() => setFilterModalVisible(false)} style={styles.optionClose}>
              <Text style={[styles.optionCloseText, { color: colors.textSecondary }]}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Sort Modal */}
      <Modal visible={sortModalVisible} transparent animationType="fade">
        <View style={styles.overlay}>
          <View style={[styles.optionSheet, { backgroundColor: colors.card, borderColor: colors.border }]}>
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

      {/* Edit/Add Modal */}
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
              options={categories}
              value={formData.category}
              onChange={(category) => setFormData({ ...formData, category })}
            />
            <TouchableOpacity
              style={[styles.manageCategoriesButton, { borderColor: colors.border, backgroundColor: colors.surface }]}
              onPress={() => setCategoriesModalVisible(true)}
            >
              <Ionicons name="settings-outline" size={16} color={colors.textSecondary} />
              <Text style={[styles.manageCategoriesText, { color: colors.text }]}>Manage Categories</Text>
            </TouchableOpacity>
            <View style={styles.bottomPadding} />
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>

      {/* Categories Modal */}
      <Modal visible={categoriesModalVisible} transparent animationType="fade">
        <View style={styles.overlay}>
          <View style={[styles.optionSheet, { backgroundColor: colors.card, borderColor: colors.border }]}>
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
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 10,
    height: 40,
    paddingLeft: 12,
    flex: 1,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    paddingVertical: 8,
    paddingHorizontal: 8,
  },
  controlButton: {
    height: 42,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    maxWidth: 112,
  },
  favoriteFilterButton: {
    width: 42,
    height: 42,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  controlButtonText: {
    fontSize: 12,
    fontWeight: '500',
    maxWidth: 74,
  },
  list: {
    flex: 1,
    paddingHorizontal: 12,
    marginTop: 8,
  },
  tableContainer: {
    flex: 1,
  },
  tableContent: {
    paddingBottom: 8,
  },
  tableScroll: {
    flex: 1,
    minHeight: 220,
  },
  tableShell: {
    borderWidth: 1,
    borderRadius: 12,
    overflow: 'hidden',
  },
  tableHeader: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    minHeight: 44,
  },
  columnHeaderName: {
    width: 220,
    paddingHorizontal: 14,
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  columnHeaderActions: {
    width: 100,
    paddingHorizontal: 12,
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  columnHeaderCategory: {
    width: 140,
    paddingHorizontal: 14,
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  columnHeaderLink: {
    width: 270,
    paddingHorizontal: 14,
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  columnHeaderDescription: {
    width: 270,
    paddingHorizontal: 14,
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  headerText: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    textAlign: 'left',
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    minHeight: 54,
    alignItems: 'center',
  },
  nameCell: {
    width: 220,
    justifyContent: 'center',
    paddingHorizontal: 14,
    alignItems: 'flex-start',
  },
  actionsCell: {
    width: 100,
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 6,
    paddingHorizontal: 12,
    alignItems: 'center',
  },
  categoryCell: {
    width: 140,
    justifyContent: 'center',
    paddingHorizontal: 14,
    alignItems: 'flex-start',
  },
  linkCell: {
    width: 270,
    justifyContent: 'center',
    paddingHorizontal: 14,
    alignItems: 'flex-start',
  },
  descriptionCell: {
    width: 270,
    justifyContent: 'center',
    paddingHorizontal: 14,
    alignItems: 'flex-start',
  },
  actionButton: {
    width: 28,
    height: 28,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nameText: {
    fontSize: 14,
    fontWeight: '600',
  },
  mutedText: {
    fontSize: 13,
    fontWeight: '400',
  },
  categoryPill: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    maxWidth: '100%',
  },
  categoryPillText: {
    fontSize: 12,
    fontWeight: '600',
  },
  link: {
    fontSize: 13,
    fontWeight: '500',
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
    borderWidth: 1,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    marginBottom: 10,
  },
  categoryInput: {
    flex: 1,
    fontSize: 14,
    paddingVertical: 10,
  },
  categoryActionButton: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoriesList: {
    maxHeight: 240,
  },
  categoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  categoryActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  categoryIconButton: {
    padding: 4,
  },
  categoryEditInput: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 8,
    fontSize: 14,
    paddingHorizontal: 8,
    paddingVertical: 6,
    marginRight: 8,
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
  overlayCenter: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  detailsPopup: {
    width: '100%',
    maxWidth: 520,
    borderRadius: 14,
    borderWidth: 1,
    overflow: 'hidden',
  },
  detailsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  detailsTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  detailsContent: {
    padding: 14,
    gap: 8,
  },
  detailsName: {
    fontSize: 17,
    fontWeight: '700',
  },
  detailsLabel: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    marginTop: 6,
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'flex-end',
  },
  optionSheet: {
    borderTopLeftRadius: 14,
    borderTopRightRadius: 14,
    borderTopWidth: 1,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 24,
  },
  optionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 10,
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
  },
  optionText: {
    fontSize: 15,
  },
  optionClose: {
    alignSelf: 'center',
    marginTop: 8,
    paddingVertical: 6,
  },
  optionCloseText: {
    fontSize: 14,
    fontWeight: '500',
  },
});
