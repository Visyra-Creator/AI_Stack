import React, { useState, useEffect, useCallback, useMemo } from 'react';
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
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/src/context/ThemeContext';
import { FormInput } from '@/src/components/common/FormInput';
import { Select } from '@/src/components/common/Select';
import { EmptyState } from '@/src/components/common/EmptyState';
import { websiteStorage, websiteCategoryStorage, WebsiteItem } from '@/src/services/storage';
import { MultiSelect } from '@/src/components/common/MultiSelect';
import { useOptimisticSave } from '@/src/hooks/useOptimisticSave';

const SORT_OPTIONS = [
  { label: 'Recent', value: 'recent' },
  { label: 'Name', value: 'name' },
] as const;

const PRICING_OPTIONS = ['free', 'paid'] as const;
const PRICING_FILTER_OPTIONS = ['All', 'Free', 'Paid'] as const;

type SortValue = (typeof SORT_OPTIONS)[number]['value'];

const TABLE_BASE_WIDTH = {
  actions: 148,
  name: 220,
  category: 140,
  pricing: 100,
  link: 270,
  description: 270,
};

const TABLE_FLEX_WIDTH =
  TABLE_BASE_WIDTH.name +
  TABLE_BASE_WIDTH.category +
  TABLE_BASE_WIDTH.pricing +
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
    pricing: Math.round(TABLE_BASE_WIDTH.pricing * widthScale),
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
  const [categories, setCategories] = useState<string[]>([]);

  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState('All');
  const [activeSort, setActiveSort] = useState<SortValue>('recent');
  const [pricingFilter, setPricingFilter] = useState<(typeof PRICING_FILTER_OPTIONS)[number]>('All');

  const [filterModalVisible, setFilterModalVisible] = useState(false);
  const [sortModalVisible, setSortModalVisible] = useState(false);
  const [pricingModalVisible, setPricingModalVisible] = useState(false);
  const [categoriesModalVisible, setCategoriesModalVisible] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [editingCategory, setEditingCategory] = useState<string | null>(null);
  const [editingCategoryName, setEditingCategoryName] = useState('');

  const { isSaving, executeSave } = useOptimisticSave({
    onSaveSuccess: () => {
      loadItems();
    },
    onSaveError: () => {
      Alert.alert('Error', 'Failed to save. Please try again.');
    },
  });

  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const [isAddingCategory, setIsAddingCategory] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    toolLink: '',
    description: '',
    categories: [] as string[],
    pricingType: 'free' as 'free' | 'paid',
    pricingDescription: '',
  });

  const loadItems = useCallback(async () => {
    const data = await websiteStorage.getAll();
    setItems(data);
  }, []);

  const loadCategories = useCallback(async () => {
    const data = await websiteCategoryStorage.getAll();
    const sorted = [...data].sort((a, b) => {
      if (a.toLowerCase() === 'other') return 1;
      if (b.toLowerCase() === 'other') return -1;
      return a.localeCompare(b);
    });
    setCategories(sorted);
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

  const resetForm = () => {
    setFormData({
      name: '',
      toolLink: '',
      description: '',
      categories: [],
      pricingType: 'free',
      pricingDescription: '',
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
      categories: item.categories || (item.category ? [item.category] : []),
      pricingType: item.pricingType || 'free',
      pricingDescription: item.pricingDescription || '',
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

    const payload = {
      ...formData,
      pricingDescription:
        formData.pricingType === 'paid' ? formData.pricingDescription.trim() : '',
    };

    setModalVisible(false);

    await executeSave(async () => {
      if (editingItem) {
        await websiteStorage.update(editingItem.id, payload);
      } else {
        await websiteStorage.add(payload);
      }
    });

    resetForm();
  };

  const handleDelete = (item: WebsiteItem) => {
    Alert.alert('Delete', `Are you sure you want to delete "${item.name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          // Optimistic: remove from list immediately
          setItems(prev => prev.filter(current => current.id !== item.id));
          setIsDeleting(item.id);

          try {
            await websiteStorage.delete(item.id);
          } catch (error) {
            // Revert on failure
            await loadItems();
            Alert.alert('Error', 'Failed to delete. Please try again.');
          } finally {
            setIsDeleting(null);
          }
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

    // Optimistic: add to list immediately
    const updatedCategories = [...categories, value];
    setCategories(updatedCategories);
    setNewCategoryName('');
    setIsAddingCategory(true);

    try {
      await websiteCategoryStorage.saveAll(updatedCategories);
    } catch (error) {
      // Revert on failure
      setCategories(categories);
      setNewCategoryName(value);
      Alert.alert('Error', 'Failed to add category. Please try again.');
    } finally {
      setIsAddingCategory(false);
    }
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

    // Optimistic: update immediately
    const updatedCategories = categories.map(category =>
      category === editingCategory ? value : category,
    );
    setCategories(updatedCategories);
    setEditingCategory(null);
    setEditingCategoryName('');

    try {
      await websiteCategoryStorage.saveAll(updatedCategories);

      const allItems = await websiteStorage.getAll();
      const affectedItems = allItems.filter(item => item.categories?.includes(editingCategory));
      await Promise.all(
        affectedItems.map(item =>
          websiteStorage.update(item.id, {
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

      await loadItems();
    } catch (error) {
      // Revert on failure
      setCategories(categories);
      setEditingCategory(editingCategory);
      setEditingCategoryName(editingCategoryName);
      Alert.alert('Error', 'Failed to update category. Please try again.');
    }
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
            // Optimistic: remove category immediately
            const updatedCategories = categories.filter(category => category !== categoryToDelete);
            setCategories(updatedCategories);

            if (activeFilter === categoryToDelete) {
              setActiveFilter('All');
            }

            try {
              await websiteCategoryStorage.saveAll(updatedCategories);

              const allItems = await websiteStorage.getAll();
              const affectedItems = allItems.filter(item => item.categories?.includes(categoryToDelete));
              await Promise.all(
                affectedItems.map(item =>
                  websiteStorage.update(item.id, {
                    categories: item.categories?.filter(category => category !== categoryToDelete),
                  }),
                ),
              );

              setFormData(prev => ({
                ...prev,
                categories: prev.categories.filter(category => category !== categoryToDelete),
              }));

              if (editingCategory === categoryToDelete) {
                setEditingCategory(null);
                setEditingCategoryName('');
              }

              await loadItems();
            } catch (error) {
              // Revert on failure
              setCategories(categories);
              if (activeFilter === 'All') {
                setActiveFilter(categoryToDelete);
              }
              Alert.alert('Error', 'Failed to delete category. Please try again.');
            }
          },
        },
      ],
    );
  };

  const filteredItems = useMemo(() => {
    const query = searchQuery.toLowerCase().trim();

    return items.filter(item => {
      const matchesSearch =
        !query ||
        item.name.toLowerCase().includes(query) ||
        item.description.toLowerCase().includes(query) ||
        item.toolLink.toLowerCase().includes(query);

      const matchesFilter =
        activeFilter === 'All' ||
        (activeFilter === 'Favorites' ? (item.isFavorite ?? false) : (item.categories || (item.category ? [item.category] : [])).includes(activeFilter));

      const matchesPricing =
        pricingFilter === 'All' ||
        (pricingFilter === 'Free' ? (item.pricingType !== 'paid') : (item.pricingType === 'paid'));

      return matchesSearch && matchesFilter && matchesPricing;
    });
  }, [items, searchQuery, activeFilter, pricingFilter]);

  const displayedItems = [...filteredItems].sort((a, b) => {
    if (activeSort === 'name') {
      return a.name.localeCompare(b.name);
    }
    return b.createdAt - a.createdAt;
  });

  const uniqueCategories = ['All', 'Favorites', ...categories];
  const isFavoritesOnly = activeFilter === 'Favorites';

  const toggleFavoritesOnly = () => {
    setActiveFilter(prev => (prev === 'Favorites' ? 'All' : 'Favorites'));
  };

  const resetFilters = () => {
    setSearchQuery('');
    setActiveFilter('All');
    setPricingFilter('All');
    setActiveSort('recent');
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.replace('/')} style={styles.backButton}>
          <Ionicons name="home-outline" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.text }]}>Websites</Text>
        <TouchableOpacity
          onPress={openAddModal}
          style={[styles.addButton, { backgroundColor: colors.primary }]}
        >
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
              {activeFilter}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.controlButton, { backgroundColor: colors.surface, borderColor: colors.border }]}
            onPress={() => setPricingModalVisible(true)}
          >
            <Ionicons name="pricetag-outline" size={16} color={colors.textSecondary} />
            <Text style={[styles.controlButtonText, { color: colors.text }]} numberOfLines={1}>
              {pricingFilter}
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
          <TouchableOpacity
            style={[styles.favoriteFilterButton, { backgroundColor: colors.surface, borderColor: colors.border }]}
            onPress={resetFilters}
          >
            <Ionicons name="refresh-outline" size={16} color={colors.textSecondary} />
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
                  <View style={[styles.columnHeaderPricing, { width: columnWidths.pricing }]}>
                    <Text style={[styles.headerText, { color: colors.textSecondary }]}>Pricing</Text>
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
                        disabled={isDeleting === item.id}
                      >
                        {isDeleting === item.id ? (
                          <ActivityIndicator size="small" color={colors.danger} />
                        ) : (
                          <Ionicons name="trash-outline" size={16} color={colors.textSecondary} />
                        )}
                      </TouchableOpacity>
                    </View>

                    <View style={[styles.nameCell, { width: columnWidths.name }]}>
                      <Text style={[styles.nameText, { color: colors.text }]} numberOfLines={1}>{item.name}</Text>
                    </View>

                    <View style={[styles.categoryCell, { width: columnWidths.category }]}>
                      <View style={[styles.categoryPill, { backgroundColor: colors.primary + '1A' }]}>
                        <Text style={[styles.categoryPillText, { color: colors.primary }]} numberOfLines={1}>
                          {(item.categories || (item.category ? [item.category] : [])).join(', ') || 'Uncategorized'}
                        </Text>
                      </View>
                    </View>

                    <View style={[styles.pricingCell, { width: columnWidths.pricing }]}>
                      <View
                        style={[
                          styles.pricingPill,
                          {
                            backgroundColor:
                              item.pricingType === 'paid'
                                ? colors.warning + '22'
                                : colors.success + '22',
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.pricingPillText,
                            { color: item.pricingType === 'paid' ? colors.warning : colors.success },
                          ]}
                        >
                          {item.pricingType === 'paid' ? 'Paid' : 'Free'}
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
              <ScrollView style={styles.detailsContent} showsVerticalScrollIndicator={false}>
                <Text style={[styles.detailsName, { color: colors.text }]}>{selectedItem.name}</Text>

                <View style={styles.metaTagsWrap}>
                  {(selectedItem.categories || (selectedItem.category ? [selectedItem.category] : [])).map((tag, index) => (
                    <View key={`${tag}-${index}`} style={[styles.metaTag, { backgroundColor: colors.primary + '20' }]}>
                      <Text style={[styles.metaTagText, { color: colors.primary }]}>{tag}</Text>
                    </View>
                  ))}
                </View>

                {!!selectedItem.toolLink?.trim() && (
                  <>
                    <Text style={[styles.detailsLabel, { color: colors.textSecondary }]}>Website Link</Text>
                    <TouchableOpacity onPress={() => Linking.openURL(selectedItem.toolLink).catch(() => console.log('Failed to open link'))}>
                      <Text style={[styles.link, dynamicStyles.link]} numberOfLines={2}>{selectedItem.toolLink}</Text>
                    </TouchableOpacity>
                  </>
                )}

                <Text style={[styles.detailsLabel, { color: colors.textSecondary }]}>Description</Text>
                <Text style={[styles.mutedText, { color: colors.text }]}>
                  {selectedItem.description || 'No description'}
                </Text>

                <Text style={[styles.detailsLabel, { color: colors.textSecondary }]}>Pricing</Text>
                <Text style={[styles.mutedText, { color: colors.text }]}>
                  {selectedItem.pricingType === 'paid' ? 'Paid' : 'Free'}
                </Text>

                {selectedItem.pricingType === 'paid' && !!selectedItem.pricingDescription?.trim() && (
                  <>
                    <Text style={[styles.detailsLabel, { color: colors.textSecondary }]}>Pricing Description</Text>
                    <Text style={[styles.mutedText, { color: colors.text }]}>
                      {selectedItem.pricingDescription}
                    </Text>
                  </>
                )}
              </ScrollView>
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
                  setActiveFilter(option);
                  setFilterModalVisible(false);
                }}
              >
                <Text style={[styles.optionText, { color: colors.text }]}>{option}</Text>
                {activeFilter === option && <Ionicons name="checkmark" size={18} color={colors.primary} />}
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

      {/* Pricing Modal */}
      <Modal visible={pricingModalVisible} transparent animationType="fade">
        <View style={styles.overlay}>
          <View style={[styles.optionSheet, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.optionTitle, { color: colors.text }]}>Filter by Pricing</Text>
            {PRICING_FILTER_OPTIONS.map(option => (
              <TouchableOpacity
                key={option}
                style={styles.optionRow}
                onPress={() => {
                  setPricingFilter(option);
                  setPricingModalVisible(false);
                }}
              >
                <Text style={[styles.optionText, { color: colors.text }]}>{option}</Text>
                {pricingFilter === option && <Ionicons name="checkmark" size={18} color={colors.primary} />}
              </TouchableOpacity>
            ))}
            <TouchableOpacity onPress={() => setPricingModalVisible(false)} style={styles.optionClose}>
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
            <TouchableOpacity onPress={handleSave} disabled={isSaving} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              {isSaving && <ActivityIndicator size="small" color={colors.primary} />}
              <Text style={[styles.saveText, { color: isSaving ? colors.primary + '80' : colors.primary }]}>
                {isSaving ? 'Saving...' : 'Save'}
              </Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.form} showsVerticalScrollIndicator={false} contentContainerStyle={styles.formContent}>
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
              label="Description"
              placeholder="What does this website do?"
              value={formData.description}
              onChangeText={(text) => setFormData({ ...formData, description: text })}
              multiline
              numberOfLines={4}
              style={styles.textArea}
            />

            <MultiSelect
              label="Categories"
              options={categories}
              selectedValues={formData.categories}
              onSelect={(categories) => setFormData({ ...formData, categories })}
            />

            <Select
              label="Pricing Type"
              options={[...PRICING_OPTIONS]}
              value={formData.pricingType}
              onChange={(pricingType) =>
                setFormData(prev => ({
                  ...prev,
                  pricingType: (pricingType as (typeof PRICING_OPTIONS)[number]) || 'free',
                  pricingDescription:
                    pricingType === 'paid' ? prev.pricingDescription : '',
                }))
              }
            />
            {formData.pricingType === 'paid' && (
              <FormInput
                label="Pricing Description"
                placeholder="Explain paid plan details, pricing tiers, and notes"
                value={formData.pricingDescription}
                onChangeText={(text) => setFormData({ ...formData, pricingDescription: text })}
                multiline={true}
                numberOfLines={4}
                textAlignVertical="top"
                style={styles.pricingDescriptionInput}
              />
            )}
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
                style={[styles.categoryActionButton, { backgroundColor: colors.primary, opacity: isAddingCategory ? 0.6 : 1 }]}
                onPress={addCategory}
                disabled={isAddingCategory}
              >
                {isAddingCategory ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Ionicons name="add" size={16} color="#FFFFFF" />
                )}
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
  columnHeaderPricing: {
    width: 100,
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
  pricingCell: {
    width: 100,
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
  pricingPill: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  pricingPillText: {
    fontSize: 12,
    fontWeight: '700',
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
  pricingDescriptionInput: {
    minHeight: 110,
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
  formContent: {
    flexGrow: 1,
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
  textArea: {
    minHeight: 80,
    maxHeight: 120,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
    marginTop: 12,
  },
  metaTagsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 4,
  },
  metaTag: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  metaTagText: {
    fontSize: 11,
    fontWeight: '600',
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 2,
    paddingHorizontal: 8,
    borderRadius: 12,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '500',
    marginLeft: 4,
  },
});
