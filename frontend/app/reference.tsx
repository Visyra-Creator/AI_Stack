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
import { FormInput } from '@/src/components/common/FormInput';
import { EmptyState } from '@/src/components/common/EmptyState';
import { referenceStorage, ReferenceItem } from '@/src/services/storage';

const SORT_OPTIONS = [
  { label: 'Recent', value: 'recent' },
  { label: 'Name', value: 'name' },
] as const;

type SortValue = (typeof SORT_OPTIONS)[number]['value'];

const TABLE_BASE_WIDTH = {
  actions: 148,
  name: 260,
  link: 320,
  description: 320,
};

const TABLE_FLEX_WIDTH = TABLE_BASE_WIDTH.name + TABLE_BASE_WIDTH.link + TABLE_BASE_WIDTH.description;
const TABLE_MIN_CONTENT_WIDTH = TABLE_BASE_WIDTH.actions + TABLE_FLEX_WIDTH;

export default function ReferenceScreen() {
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
    link: Math.round(TABLE_BASE_WIDTH.link * widthScale),
    description: Math.round(TABLE_BASE_WIDTH.description * widthScale),
  };

  const [items, setItems] = useState<ReferenceItem[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [detailsVisible, setDetailsVisible] = useState(false);
  const [selectedItem, setSelectedItem] = useState<ReferenceItem | null>(null);
  const [editingItem, setEditingItem] = useState<ReferenceItem | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<'All' | 'Favorites'>('All');
  const [activeSort, setActiveSort] = useState<SortValue>('recent');

  const [filterModalVisible, setFilterModalVisible] = useState(false);
  const [sortModalVisible, setSortModalVisible] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    link: '',
    description: '',
  });

  const loadItems = useCallback(async () => {
    const data = await referenceStorage.getAll();
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
    setFormData({ name: '', link: '', description: '' });
    setEditingItem(null);
  };

  const openAddModal = () => {
    resetForm();
    setModalVisible(true);
  };

  const openEditModal = (item: ReferenceItem) => {
    setEditingItem(item);
    setFormData({ name: item.name, link: item.link, description: item.description });
    setModalVisible(true);
  };

  const openDetailsModal = (item: ReferenceItem) => {
    setSelectedItem(item);
    setDetailsVisible(true);
  };

  const handleSave = async () => {
    if (!formData.name.trim()) {
      Alert.alert('Error', 'Name is required');
      return;
    }

    if (editingItem) {
      await referenceStorage.update(editingItem.id, formData);
    } else {
      await referenceStorage.add(formData);
    }

    await loadItems();
    setModalVisible(false);
    resetForm();
  };

  const handleDelete = (item: ReferenceItem) => {
    Alert.alert('Delete', `Are you sure you want to delete "${item.name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await referenceStorage.delete(item.id);
          await loadItems();
        },
      },
    ]);
  };

  const toggleFavorite = async (item: ReferenceItem) => {
    const nextFavorite = !(item.isFavorite ?? false);

    setItems(prev =>
      prev.map(current =>
        current.id === item.id
          ? { ...current, isFavorite: nextFavorite, favoritedAt: nextFavorite ? Date.now() : undefined }
          : current,
      ),
    );

    try {
      await referenceStorage.update(item.id, {
        isFavorite: nextFavorite,
      } as any);
    } catch {
      setItems(prev =>
        prev.map(current =>
          current.id === item.id
            ? { ...current, isFavorite: item.isFavorite ?? false, favoritedAt: item.favoritedAt }
            : current,
        ),
      );
    }
  };

  const filteredItems = items.filter(item => {
    const query = searchQuery.toLowerCase().trim();
    const matchesQuery =
      !query ||
      item.name.toLowerCase().includes(query) ||
      item.link.toLowerCase().includes(query) ||
      item.description.toLowerCase().includes(query);

    const matchesFilter = activeFilter === 'All' || (item.isFavorite ?? false);
    return matchesQuery && matchesFilter;
  });

  const displayedItems = [...filteredItems].sort((a, b) => {
    if (activeSort === 'name') return a.name.localeCompare(b.name);
    return b.createdAt - a.createdAt;
  });

  const isFavoritesOnly = activeFilter === 'Favorites';

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.text }]}>Reference</Text>
        <TouchableOpacity onPress={openAddModal} style={[styles.addButton, { backgroundColor: colors.primary }]}>
          <Ionicons name="add" size={24} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      <View style={styles.searchContainer}>
        <View style={styles.searchRow}>
          <View style={[styles.searchBox, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Ionicons name="search" size={20} color={colors.textSecondary} />
            <TextInput
              placeholder="Search references..."
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
            <Text style={[styles.controlButtonText, { color: colors.text }]}>{activeFilter}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.favoriteFilterButton,
              {
                backgroundColor: isFavoritesOnly ? colors.primary + '20' : colors.surface,
                borderColor: isFavoritesOnly ? colors.primary : colors.border,
              },
            ]}
            onPress={() => setActiveFilter(prev => (prev === 'Favorites' ? 'All' : 'Favorites'))}
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
            <Text style={[styles.controlButtonText, { color: colors.text }]}>
              {SORT_OPTIONS.find(option => option.value === activeSort)?.label}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {displayedItems.length === 0 ? (
        <EmptyState
          icon="book-outline"
          title="No References Found"
          description="Add and organize useful references here."
          actionLabel="Add Reference"
          onAction={openAddModal}
        />
      ) : (
        <View style={styles.list}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator
            style={styles.tableContainer}
            contentContainerStyle={[styles.tableContent, { minWidth: resolvedTableWidth }]}
          >
            <ScrollView
              style={styles.tableScroll}
              refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
            >
              <View
                style={[
                  styles.tableShell,
                  { borderColor: colors.border, backgroundColor: colors.card, width: resolvedTableWidth },
                ]}
              >
                <View style={[styles.tableHeader, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
                  <View style={[styles.columnHeaderActions, { width: columnWidths.actions }]}>
                    <Text style={[styles.headerText, { color: colors.textSecondary }]}>Actions</Text>
                  </View>
                  <View style={[styles.columnHeaderName, { width: columnWidths.name }]}>
                    <Text style={[styles.headerText, { color: colors.textSecondary }]}>Name</Text>
                  </View>
                  <View style={[styles.columnHeaderLink, { width: columnWidths.link }]}>
                    <Text style={[styles.headerText, { color: colors.textSecondary }]}>Link</Text>
                  </View>
                  <View style={[styles.columnHeaderDescription, { width: columnWidths.description }]}>
                    <Text style={[styles.headerText, { color: colors.textSecondary }]}>Description</Text>
                  </View>
                </View>

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

                    <View style={[styles.linkCell, { width: columnWidths.link }]}>
                      {item.link ? (
                        <TouchableOpacity onPress={() => Linking.openURL(item.link).catch(() => console.log('Failed to open link'))}>
                          <Text style={[styles.linkText, { color: colors.primary }]} numberOfLines={1}>{item.link}</Text>
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
              <Text style={[styles.detailsTitle, { color: colors.text }]}>Reference Details</Text>
              <TouchableOpacity onPress={() => setDetailsVisible(false)}>
                <Ionicons name="close" size={20} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
            {selectedItem && (
              <View style={styles.detailsContent}>
                <Text style={[styles.detailsName, { color: colors.text }]}>{selectedItem.name}</Text>
                <Text style={[styles.detailsLabel, { color: colors.textSecondary }]}>Link</Text>
                {selectedItem.link ? (
                  <TouchableOpacity onPress={() => Linking.openURL(selectedItem.link).catch(() => console.log('Failed to open link'))}>
                    <Text style={[styles.linkText, { color: colors.primary }]}>{selectedItem.link}</Text>
                  </TouchableOpacity>
                ) : (
                  <Text style={[styles.mutedText, { color: colors.textSecondary }]}>-</Text>
                )}
                <Text style={[styles.detailsLabel, { color: colors.textSecondary }]}>Description</Text>
                <Text style={[styles.mutedText, { color: colors.text }]}>{selectedItem.description || 'No description'}</Text>
              </View>
            )}
          </View>
        </View>
      </Modal>

      <Modal visible={filterModalVisible} transparent animationType="fade">
        <View style={styles.overlay}>
          <View style={[styles.optionSheet, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.optionTitle, { color: colors.text }]}>Filter</Text>
            {['All', 'Favorites'].map(option => (
              <TouchableOpacity
                key={option}
                style={styles.optionRow}
                onPress={() => {
                  setActiveFilter(option as 'All' | 'Favorites');
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
              {editingItem ? 'Edit Reference' : 'Add Reference'}
            </Text>
            <TouchableOpacity onPress={handleSave}>
              <Text style={[styles.saveText, { color: colors.primary }]}>Save</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.form} showsVerticalScrollIndicator={false}>
            <FormInput
              label="Name *"
              placeholder="e.g., UI Checklist"
              value={formData.name}
              onChangeText={(text) => setFormData({ ...formData, name: text })}
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
              label="Description"
              placeholder="Short note about this reference"
              value={formData.description}
              onChangeText={(text) => setFormData({ ...formData, description: text })}
              multiline
              numberOfLines={3}
            />
            <View style={styles.bottomPadding} />
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backButton: { padding: 8 },
  title: { fontSize: 20, fontWeight: '600' },
  addButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchContainer: { paddingHorizontal: 16, marginBottom: 8 },
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 10,
    height: 40,
    paddingLeft: 12,
    flex: 1,
  },
  searchInput: { flex: 1, fontSize: 14, paddingVertical: 8, paddingHorizontal: 8 },
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
  controlButtonText: { fontSize: 12, fontWeight: '500', maxWidth: 74 },
  list: { flex: 1, paddingHorizontal: 12, marginTop: 8 },
  tableContainer: { flex: 1 },
  tableContent: { paddingBottom: 8 },
  tableScroll: { flex: 1, minHeight: 220 },
  tableShell: { borderWidth: 1, borderRadius: 12, overflow: 'hidden' },
  tableHeader: { flexDirection: 'row', borderBottomWidth: 1, minHeight: 44 },
  columnHeaderActions: { width: 148, paddingHorizontal: 12, justifyContent: 'center', alignItems: 'flex-start' },
  columnHeaderName: { width: 260, paddingHorizontal: 14, justifyContent: 'center', alignItems: 'flex-start' },
  columnHeaderLink: { width: 320, paddingHorizontal: 14, justifyContent: 'center', alignItems: 'flex-start' },
  columnHeaderDescription: { width: 320, paddingHorizontal: 14, justifyContent: 'center', alignItems: 'flex-start' },
  headerText: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    textAlign: 'left',
  },
  tableRow: { flexDirection: 'row', borderBottomWidth: 1, minHeight: 54, alignItems: 'center' },
  actionsCell: {
    width: 148,
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 6,
    paddingHorizontal: 12,
    alignItems: 'center',
  },
  nameCell: { width: 260, justifyContent: 'center', paddingHorizontal: 14, alignItems: 'flex-start' },
  linkCell: { width: 320, justifyContent: 'center', paddingHorizontal: 14, alignItems: 'flex-start' },
  descriptionCell: { width: 320, justifyContent: 'center', paddingHorizontal: 14, alignItems: 'flex-start' },
  actionButton: {
    width: 28,
    height: 28,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nameText: { fontSize: 14, fontWeight: '600' },
  mutedText: { fontSize: 13, fontWeight: '400' },
  linkText: { fontSize: 13, fontWeight: '500' },
  modalContainer: { flex: 1 },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  cancelText: { fontSize: 16 },
  modalTitle: { fontSize: 18, fontWeight: '600' },
  saveText: { fontSize: 16, fontWeight: '600' },
  form: { flex: 1, padding: 16 },
  bottomPadding: { height: 40 },
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
  detailsTitle: { fontSize: 16, fontWeight: '600' },
  detailsContent: { padding: 14, gap: 8 },
  detailsName: { fontSize: 17, fontWeight: '700' },
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
  optionTitle: { fontSize: 16, fontWeight: '600', marginBottom: 10 },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
  },
  optionText: { fontSize: 15 },
  optionClose: { alignSelf: 'center', marginTop: 8, paddingVertical: 6 },
  optionCloseText: { fontSize: 14, fontWeight: '500' },
});

