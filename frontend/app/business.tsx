import React, { useState, useEffect, useCallback, useMemo } from 'react';
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
  Linking,
  ActivityIndicator,
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
import { DoubleTapImage } from '@/src/components/common/DoubleTapImage';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { businessStorage, businessCategoryStorage, BusinessItem } from '@/src/services/storage';
import { openUriExternally } from '@/src/services/fileOpener';
import { useOptimisticSave } from '@/src/hooks/useOptimisticSave';

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
  const { width: windowWidth } = useWindowDimensions();
  const galleryColumns = 4;
  const gap = 1;
  const galleryCardWidth = (windowWidth - (galleryColumns - 1) * gap) / galleryColumns;
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
  const [isFavoritesOnly, setIsFavoritesOnly] = useState(false);

  const toggleFavoritesOnly = () => {
    setIsFavoritesOnly(prev => !prev);
  };

  // Optimistic save hook
  const { isSaving, executeSave } = useOptimisticSave({
    onSaveSuccess: () => {
      loadItems();
    },
    onSaveError: (error) => {
      Alert.alert('Error', 'Failed to save. Please try again.');
      console.error('Save error:', error);
    },
  });

  // Loading states for other operations
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const [isAddingCategory, setIsAddingCategory] = useState(false);

  const [formData, setFormData] = useState({
    sectionName: 'General',
    name: '',
    description: '',
    link: '',
    instructions: '',
    categories: [] as string[],
    images: [] as string[],
    files: [] as string[],
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
      files: [],
    });
    setEditingItem(null);
  };

  const [detailsVisible, setDetailsVisible] = useState(false);
  const [selectedItem, setSelectedItem] = useState<BusinessItem | null>(null);

  const openDetailsModal = (item: BusinessItem) => {
    setSelectedItem(item);
    setDetailsVisible(true);
  };

  const openEditFromDetails = () => {
    if (selectedItem) {
      setDetailsVisible(false);
      openEditModal(selectedItem);
    }
  };

  const getImageUri = (imageStr: string) => {
    try {
      const parsed = JSON.parse(imageStr);
      return parsed.uri as string | undefined;
    } catch {
      return undefined;
    }
  };

  const openExternalLink = async (url: string) => {
    try {
      const supported = await Linking.canOpenURL(url);
      if (!supported) {
        Alert.alert('Unable to open link', 'No app available to open this link.');
        return;
      }
      await Linking.openURL(url);
    } catch {
      Alert.alert('Unable to open link', 'Something went wrong while opening this link.');
    }
  };

  const renderLinkedText = (value: string) => {
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    return (
      <Text style={[styles.detailsValue, { color: colors.text }]}>
        {value.split(urlRegex).map((part, index) => (
          /^https?:\/\/[^\s]+$/i.test(part) ? (
            <Text
              key={`${part}-${index}`}
              style={[styles.detailsValue, { color: colors.primary, textDecorationLine: 'underline' }]}
              onPress={() => openExternalLink(part)}
            >
              {part}
            </Text>
          ) : (
            <Text key={`${part}-${index}`}>{part}</Text>
          )
        ))}
      </Text>
    );
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
      files: item.files || [],
    });
    setModalVisible(true);
  };

  const handleSave = async () => {
    if (!formData.name.trim()) {
      Alert.alert('Error', 'Name is required');
      return;
    }

    setModalVisible(false);

    await executeSave(async () => {
      if (editingItem) {
        await businessStorage.update(editingItem.id, formData);
      } else {
        await businessStorage.add(formData);
      }
    });

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

  const pickFiles = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        multiple: true,
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets) {
        const newFiles = result.assets
          .map((asset) => JSON.stringify({ name: asset.name, uri: asset.uri, size: asset.size, mimeType: asset.mimeType }))
          .filter(Boolean);
        if (newFiles.length === 0) return;
        setFormData((prev) => ({ ...prev, files: [...prev.files, ...newFiles] }));
      }
    } catch {
      Alert.alert('Unable to pick files', 'Something went wrong while selecting files.');
    }
  };

  const removeFile = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      files: prev.files.filter((_, i) => i !== index),
    }));
  };

  const getFileName = (fileStr: string): string => {
    try {
      const parsed = JSON.parse(fileStr);
      return parsed.name || 'File';
    } catch {
      return 'File';
    }
  };

  const getFileUri = (fileStr: string): string | undefined => {
    try {
      const parsed = JSON.parse(fileStr);
      return parsed.uri as string | undefined;
    } catch {
      return undefined;
    }
  };

  const openFile = async (fileStr: string) => {
    const uri = getFileUri(fileStr);
    if (!uri) {
      Alert.alert('Unable to open file', 'This attachment is missing a valid file path.');
      return;
    }
    const result = await openUriExternally(fileStr);
    if (!result.success) {
      Alert.alert('Unable to open file', result.reason || 'No app is available to open this file type.');
    }
  };

  const handleDelete = (item: BusinessItem) => {
    Alert.alert('Delete', `Are you sure you want to delete "${item.name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          setItems(prev => prev.filter(current => current.id !== item.id));
          setIsDeleting(item.id);
          try {
            await businessStorage.delete(item.id);
          } catch (error) {
            await loadItems();
            Alert.alert('Error', 'Failed to delete. Please try again.');
            console.error('Delete error:', error);
          } finally {
            setIsDeleting(null);
          }
        },
      },
    ]);
  };

  const toggleFavorite = async (item: BusinessItem) => {
    const nextFavorite = !(item.isFavorite ?? false);
    await businessStorage.update(item.id, { isFavorite: nextFavorite });
    setItems(prev => prev.map(current => (current.id === item.id ? { ...current, isFavorite: nextFavorite } : current)));
  };

  const onFavoritePress = (event: GestureResponderEvent, item: BusinessItem) => {
    event.stopPropagation();
    toggleFavorite(item);
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

    const previousCategories = categories;
    const updatedCategories = [...categories, value];
    setCategories(updatedCategories);
    setNewCategoryName('');
    setIsAddingCategory(true);
    try {
      await businessCategoryStorage.saveAll(updatedCategories);
    } catch (error) {
      setCategories(previousCategories);
      setNewCategoryName(value);
      Alert.alert('Error', 'Failed to add category. Please try again.');
      console.error('Add category error:', error);
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

    const previousCategories = categories;
    const previousEditingCategory = editingCategory;
    const previousEditingCategoryName = editingCategoryName;
    const updatedCategories = categories.map(category =>
      category === editingCategory ? value : category,
    );
    setCategories(updatedCategories);
    setEditingCategory(null);
    setEditingCategoryName('');

    try {
      await businessCategoryStorage.saveAll(updatedCategories);
    } catch {
      setCategories(previousCategories);
      setEditingCategory(previousEditingCategory);
      setEditingCategoryName(previousEditingCategoryName);
      Alert.alert('Error', 'Failed to update category. Please try again.');
      return;
    }

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
            const previousCategories = categories;
            const previousActiveFilter = activeFilter;
            const updatedCategories = categories.filter(category => category !== categoryToDelete);
            setCategories(updatedCategories);

            if (activeFilter === categoryToDelete) {
              setActiveFilter('All');
            }

            try {
              await businessCategoryStorage.saveAll(updatedCategories);

              const allItems = await businessStorage.getAll();
              const affectedItems = allItems.filter(item => item.categories?.includes(categoryToDelete));
              await Promise.all(
                affectedItems.map(item =>
                  businessStorage.update(item.id, {
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
            } catch {
              setCategories(previousCategories);
              setActiveFilter(previousActiveFilter);
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
        item.instructions.toLowerCase().includes(query) ||
        item.link.toLowerCase().includes(query);

      const matchesFilter =
        activeFilter === 'All' ||
        (activeFilter === 'Favorites' ? (item.isFavorite ?? false) : (item.categories || []).includes(activeFilter));

      return matchesSearch && matchesFilter;
    });
  }, [items, searchQuery, activeFilter]);

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
              onPress={() => openDetailsModal(item)}
              onFavorite={() => toggleFavorite(item)}
              isFavorite={item.isFavorite ?? false}
              onEdit={() => openEditModal(item)}
              onDelete={() => handleDelete(item)}
              isDeleteLoading={isDeleting === item.id}
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
                onPress={() => openDetailsModal(item)}
                activeOpacity={0.85}
              >
                <TouchableOpacity
                  style={[styles.galleryFavoriteButton, { backgroundColor: 'rgba(0,0,0,0.45)' }]}
                  onPress={(event) => onFavoritePress(event, item)}
                  activeOpacity={0.8}
                >
                  <Ionicons
                    name={(item.isFavorite ?? false) ? 'heart' : 'heart-outline'}
                    size={16}
                    color={(item.isFavorite ?? false) ? '#FF6B6B' : '#FFFFFF'}
                  />
                </TouchableOpacity>
                {uri ? (
                  <Image source={{ uri }} style={styles.galleryImage} resizeMode="cover" />
                ) : (
                  <View style={[styles.galleryPlaceholder, { backgroundColor: colors.surface }]}>
                    <Ionicons name="image-outline" size={24} color={colors.textSecondary} />
                    <Text style={[styles.galleryPlaceholderText, { color: colors.textSecondary }]}>No image</Text>
                    <TouchableOpacity
                      style={[styles.galleryAddImageCta, { backgroundColor: colors.background + 'D9' }]}
                      onPress={(event) => {
                        event.stopPropagation();
                        openEditModal(item);
                      }}
                      activeOpacity={0.85}
                    >
                      <Text style={[styles.galleryAddImageCtaText, { color: colors.text }]}>Add image</Text>
                    </TouchableOpacity>
                  </View>
                )}
                <View style={styles.galleryOverlay}>
                  <Text style={styles.galleryTitle} numberOfLines={1}>{item.name}</Text>
                  <Text style={styles.gallerySubtitle} numberOfLines={1}>
                    {item.description ? item.description.split('\n')[0].trim() : ''}
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
      <Modal visible={detailsVisible} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={[styles.modalContainer, { backgroundColor: colors.background }]}>
          <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
            <TouchableOpacity onPress={() => setDetailsVisible(false)}>
              <Text style={[styles.cancelText, { color: colors.textSecondary }]}>Close</Text>
            </TouchableOpacity>
            <Text style={[styles.modalTitle, { color: colors.text }]}>Details</Text>
            <TouchableOpacity onPress={openEditFromDetails}>
              <Text style={[styles.saveText, { color: colors.primary }]}>Edit</Text>
            </TouchableOpacity>
          </View>

          {selectedItem && (
            <ScrollView
              style={styles.detailsScroll}
              contentContainerStyle={styles.detailsScrollContent}
              showsVerticalScrollIndicator
            >
              <Text style={[styles.detailsTitle, { color: colors.text }]}>{selectedItem.name}</Text>

              {selectedItem.categories && selectedItem.categories.length > 0 && (
                <View style={styles.detailsTags}>
                  {selectedItem.categories.map((tag, index) => (
                    <View key={`${tag}-${index}`} style={[styles.detailsTag, { backgroundColor: colors.primary + '20' }]}>
                      <Text style={[styles.detailsTagText, { color: colors.primary }]}>{tag}</Text>
                    </View>
                  ))}
                </View>
              )}
              
              <View style={styles.detailsSection}>
                <Text style={[styles.detailsLabel, { color: colors.textSecondary }]}>Section</Text>
                <Text style={[styles.detailsValue, { color: colors.text }]}>{selectedItem.sectionName}</Text>
              </View>

              {!!selectedItem.description?.trim() && (
                <View style={styles.detailsSection}>
                  <Text style={[styles.detailsLabel, { color: colors.textSecondary }]}>Description</Text>
                  {renderLinkedText(selectedItem.description)}
                </View>
              )}

              {!!selectedItem.instructions?.trim() && (
                <View style={styles.detailsSection}>
                  <Text style={[styles.detailsLabel, { color: colors.textSecondary }]}>Instructions</Text>
                  {renderLinkedText(selectedItem.instructions)}
                </View>
              )}

              {!!selectedItem.link?.trim() && (
                <View style={styles.detailsSection}>
                  <Text style={[styles.detailsLabel, { color: colors.textSecondary }]}>URL</Text>
                  <TouchableOpacity onPress={() => openExternalLink(selectedItem.link)}>
                    <Text style={[styles.detailsLink, { color: colors.primary }]} numberOfLines={2}>
                      {selectedItem.link}
                    </Text>
                  </TouchableOpacity>
                </View>
              )}

              {selectedItem.images && selectedItem.images.length > 0 && (
                <View style={styles.detailsSection}>
                  <Text style={[styles.detailsLabel, { color: colors.textSecondary }]}>Images</Text>
                  <Text style={[styles.detailsImageHint, { color: colors.textSecondary }]}>Double tap an image to view full screen</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.detailsImagesRow}>
                    {selectedItem.images.map((image, index) => {
                      const uri = getImageUri(image);
                      if (!uri) return null;
                      return (
                        <DoubleTapImage
                          key={`${image}-${index}`}
                          uri={uri}
                          style={styles.detailsImagePreview}
                          resizeMode="contain"
                        />
                      );
                    })}
                  </ScrollView>
                </View>
              )}

              {selectedItem.files && selectedItem.files.length > 0 && (
                <View style={styles.detailsSection}>
                  <Text style={[styles.detailsLabel, { color: colors.textSecondary }]}>Documents</Text>
                  {selectedItem.files.map((file, index) => (
                    <TouchableOpacity
                      key={`${file}-${index}`}
                      style={[styles.detailsFileRow, { borderColor: colors.border }]}
                      onPress={() => openFile(file)}
                    >
                      <Ionicons name="document-text-outline" size={16} color={colors.primary} />
                      <Text style={[styles.detailsFileName, { color: colors.text }]} numberOfLines={1}>
                        {getFileName(file)}
                      </Text>
                      <Ionicons name="open-outline" size={16} color={colors.textSecondary} />
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              <View style={styles.bottomPadding} />
            </ScrollView>
          )}
        </SafeAreaView>
      </Modal>

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
            <TouchableOpacity onPress={handleSave} disabled={isSaving} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              {isSaving && <ActivityIndicator size="small" color={colors.primary} />}
              <Text style={[styles.saveText, { color: isSaving ? colors.primary + '80' : colors.primary }]}>
                {isSaving ? 'Saving...' : 'Save'}
              </Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.form} showsVerticalScrollIndicator={false} contentContainerStyle={styles.formContent}>
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
            <View style={styles.uploadSection}>
              <Text style={[styles.uploadLabel, { color: colors.textSecondary }]}>Upload Images</Text>
              <TouchableOpacity
                style={[styles.uploadButton, { backgroundColor: colors.surface, borderColor: colors.border }]}
                onPress={pickImage}
              >
                <Ionicons name="image-outline" size={18} color={colors.textSecondary} />
                <Text style={[styles.uploadButtonText, { color: colors.text }]}>Add Images</Text>
              </TouchableOpacity>

              {formData.images.length > 0 && (
                <View style={styles.imageGrid}>
                  {formData.images.map((imageUri, index) => (
                    <View key={index} style={styles.imageItem}>
                      <Image source={{ uri: imageUri }} style={styles.imagePreview} resizeMode="contain" />
                      <TouchableOpacity
                        style={[styles.imageRemoveButton, { backgroundColor: colors.background }]}
                        onPress={() => removeImage(imageUri)}
                      >
                        <Ionicons name="close-circle" size={18} color={colors.danger} />
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              )}
            </View>
            <View style={styles.uploadSection}>
              <Text style={[styles.uploadLabel, { color: colors.textSecondary }]}>Upload Documents</Text>
              <TouchableOpacity
                style={[styles.uploadButton, { backgroundColor: colors.surface, borderColor: colors.border }]}
                onPress={pickFiles}
              >
                <Ionicons name="document-attach-outline" size={18} color={colors.textSecondary} />
                <Text style={[styles.uploadButtonText, { color: colors.text }]}>Add Documents</Text>
              </TouchableOpacity>

              {formData.files.length > 0 && (
                <View style={styles.filesList}>
                  {formData.files.map((file, index) => (
                    <View key={`${file}-${index}`} style={[styles.fileItem, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                      <Ionicons name="document-text-outline" size={18} color={colors.primary} />
                      <Text style={[styles.fileName, { color: colors.text }]} numberOfLines={1}>
                        {getFileName(file)}
                      </Text>
                      <TouchableOpacity onPress={() => removeFile(index)}>
                        <Ionicons name="close-circle" size={20} color={colors.danger} />
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              )}
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
  },
  galleryListContent: {
    paddingBottom: 16,
    paddingHorizontal: 0,
  },
  galleryColumnWrapper: {
    justifyContent: 'flex-start',
    marginBottom: 1,
    paddingHorizontal: 0,
    gap: 1,
  },
  galleryCard: {
    aspectRatio: 1,
    overflow: 'hidden',
  },
  galleryFavoriteButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  galleryTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  gallerySubtitle: {
    fontSize: 11,
    color: '#E5E7EB',
    marginTop: 2,
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
  formContent: {
    flexGrow: 1,
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
  galleryPlaceholderText: {
    fontSize: 10,
    fontWeight: '600',
    marginTop: 6,
    opacity: 0.85,
  },
  galleryAddImageCta: {
    marginTop: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  galleryAddImageCtaText: {
    fontSize: 10,
    fontWeight: '700',
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
  uploadSection: {
    marginBottom: 16,
  },
  uploadLabel: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 6,
  },
  uploadButton: {
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  uploadButtonText: {
    fontSize: 14,
    fontWeight: '500',
  },
  imageGrid: {
    marginTop: 10,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  imageItem: {
    width: 84,
    height: 84,
    borderRadius: 10,
    overflow: 'hidden',
    position: 'relative',
  },
  imagePreview: {
    width: '100%',
    height: '100%',
    backgroundColor: '#0F172A22',
  },
  imageRemoveButton: {
    position: 'absolute',
    top: 4,
    right: 4,
    borderRadius: 10,
  },
  detailsScroll: {
    flex: 1,
  },
  detailsScrollContent: {
    padding: 16,
    paddingBottom: 36,
  },
  detailsTitle: {
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 12,
  },
  detailsTags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 16,
  },
  detailsTag: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  detailsTagText: {
    fontSize: 12,
    fontWeight: '600',
  },
  detailsSection: {
    marginBottom: 16,
  },
  detailsLabel: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  detailsImageHint: {
    fontSize: 11,
    marginBottom: 8,
    opacity: 0.75,
  },
  detailsValue: {
    fontSize: 15,
    lineHeight: 22,
  },
  detailsLink: {
    fontSize: 14,
    textDecorationLine: 'underline',
  },
  detailsImagesRow: {
    gap: 8,
    paddingRight: 8,
  },
  detailsImagePreview: {
    width: 88,
    height: 88,
    borderRadius: 10,
    backgroundColor: '#0F172A22',
  },
  detailsFileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 10,
    marginBottom: 8,
  },
  detailsFileName: {
    flex: 1,
    fontSize: 13,
    fontWeight: '500',
  },
  filesList: {
    marginTop: 10,
    gap: 8,
  },
  fileItem: {
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  fileName: {
    flex: 1,
    fontSize: 13,
    fontWeight: '500',
  },
});
