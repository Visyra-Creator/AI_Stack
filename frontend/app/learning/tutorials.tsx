import React, { useCallback, useMemo, useState } from 'react';
import {
  Alert,
  FlatList,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { parseAddContentMeta } from '../../data/add-content';
import { deleteItem, getItemsByCategory } from '../../services/api';

type SortOption = 'newest' | 'title';
type FilterOption = 'all' | 'uploaded';

interface TutorialCard {
  id: string;
  title: string;
  description: string;
  itemId?: string;
}

interface BackendItem {
  id: string;
  title: string;
  description: string;
  notes?: string;
}

export default function TutorialsScreen() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<SortOption>('newest');
  const [filterBy, setFilterBy] = useState<FilterOption>('all');
  const [openDropdown, setOpenDropdown] = useState<'sort' | 'filter' | null>(null);
  const [uploadedTutorials, setUploadedTutorials] = useState<TutorialCard[]>([]);

  const loadTutorials = useCallback(async () => {
    try {
      const items: BackendItem[] = await getItemsByCategory('Learning');

      const mapped = items
        .filter((item) => {
          const metadata = parseAddContentMeta(item.notes);
          const subcategories = metadata?.subcategories ?? (metadata?.subcategory ? [metadata.subcategory] : []);
          if (subcategories.length === 0) {
            return true;
          }

          return subcategories.some((value) => value.toLowerCase().includes('tutorial'));
        })
        .map((item) => ({
          id: `uploaded-${item.id}`,
          title: item.title,
          description: item.description || 'Uploaded tutorial content',
          itemId: item.id,
        }));

      setUploadedTutorials(mapped);
    } catch (error) {
      console.error('Failed to load uploaded tutorials:', error);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadTutorials();
    }, [loadTutorials])
  );

  const tutorialCards = useMemo<TutorialCard[]>(() => [...uploadedTutorials], [uploadedTutorials]);

  const filteredCards = useMemo(() => {
    const normalized = searchQuery.trim().toLowerCase();
    const sourceFiltered = tutorialCards.filter((card) => {
      if (filterBy === 'all') {
        return true;
      }

      return filterBy === 'uploaded' ? Boolean(card.itemId) : true;
    });

    const searched = sourceFiltered.filter((card) => {
      if (!normalized) {
        return true;
      }

      return (
        card.title.toLowerCase().includes(normalized) ||
        card.description.toLowerCase().includes(normalized)
      );
    });

    if (sortBy === 'title') {
      return [...searched].sort((a, b) => a.title.localeCompare(b.title));
    }

    return searched;
  }, [filterBy, searchQuery, sortBy, tutorialCards]);

  const sortOptions: { value: SortOption; label: string }[] = [
    { value: 'newest', label: 'Newest' },
    { value: 'title', label: 'A-Z' },
  ];

  const filterOptions: { value: FilterOption; label: string }[] = [
    { value: 'all', label: 'All' },
    { value: 'uploaded', label: 'Uploaded' },
  ];

  const handleDelete = (card: TutorialCard) => {
    if (!card.itemId) {
      Alert.alert('Unavailable', 'Only uploaded tutorials can be deleted.');
      return;
    }

    Alert.alert('Delete Tutorial', 'Are you sure you want to delete this tutorial?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteItem(card.itemId!);
            loadTutorials();
          } catch (error) {
            console.error('Failed to delete tutorial:', error);
            Alert.alert('Error', 'Failed to delete tutorial.');
          }
        },
      },
    ]);
  };

  const handleEdit = (card: TutorialCard) => {
    if (!card.itemId) {
      Alert.alert('Unavailable', 'Only uploaded tutorials can be edited.');
      return;
    }

    router.push({
      pathname: '/item/edit',
      params: { id: card.itemId, category: 'Learning' },
    });
  };

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <View style={styles.content}>
        <View style={styles.topBar}>
          <TouchableOpacity
            style={styles.addButton}
            onPress={() =>
              router.push({
                pathname: '/item/select-category',
                params: { initialCategory: 'Learning' },
              })
            }
            activeOpacity={0.86}
          >
            <Ionicons name="add" size={16} color="#FFFFFF" />
            <Text style={styles.addButtonText}>Add</Text>
          </TouchableOpacity>

          <TextInput
            style={styles.searchInput}
            placeholder="Search tutorials"
            placeholderTextColor="#6F7888"
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoCapitalize="none"
            autoCorrect={false}
          />

          <TouchableOpacity
            style={[styles.iconButton, openDropdown === 'sort' && styles.iconButtonActiveBlue]}
            onPress={() => setOpenDropdown((current) => (current === 'sort' ? null : 'sort'))}
            activeOpacity={0.85}
          >
            <Ionicons name="swap-vertical" size={18} color="#D7E3FF" />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.iconButton, (filterBy !== 'all' || openDropdown === 'filter') && styles.iconButtonActive]}
            onPress={() => setOpenDropdown((current) => (current === 'filter' ? null : 'filter'))}
            activeOpacity={0.85}
          >
            <Ionicons name="options-outline" size={18} color="#E1D4FF" />
          </TouchableOpacity>
        </View>

        {openDropdown === 'sort' ? (
          <View style={styles.dropdownMenu}>
            <TouchableOpacity
              style={styles.dropdownItem}
              onPress={() => {
                setSortBy('newest');
                setOpenDropdown(null);
              }}
              activeOpacity={0.85}
            >
              <Text style={styles.dropdownClearText}>Clear (Default)</Text>
              <Ionicons name="refresh" size={15} color="#8FB2FF" />
            </TouchableOpacity>
            {sortOptions.map((option) => (
              <TouchableOpacity
                key={option.value}
                style={styles.dropdownItem}
                onPress={() => {
                  setSortBy(option.value);
                  setOpenDropdown(null);
                }}
                activeOpacity={0.85}
              >
                <Text style={styles.dropdownText}>{option.label}</Text>
                {sortBy === option.value ? (
                  <Ionicons name="checkmark" size={16} color="#8FB2FF" />
                ) : null}
              </TouchableOpacity>
            ))}
          </View>
        ) : null}

        {openDropdown === 'filter' ? (
          <View style={styles.dropdownMenu}>
            <TouchableOpacity
              style={styles.dropdownItem}
              onPress={() => {
                setFilterBy('all');
                setOpenDropdown(null);
              }}
              activeOpacity={0.85}
            >
              <Text style={styles.dropdownClearText}>Clear (Default)</Text>
              <Ionicons name="refresh" size={15} color="#C7AEFF" />
            </TouchableOpacity>
            {filterOptions.map((option) => (
              <TouchableOpacity
                key={option.value}
                style={styles.dropdownItem}
                onPress={() => {
                  setFilterBy(option.value);
                  setOpenDropdown(null);
                }}
                activeOpacity={0.85}
              >
                <Text style={styles.dropdownText}>{option.label}</Text>
                {filterBy === option.value ? (
                  <Ionicons name="checkmark" size={16} color="#C7AEFF" />
                ) : null}
              </TouchableOpacity>
            ))}
          </View>
        ) : null}

        <Text style={styles.stateText}>
          Sort: {sortBy === 'newest' ? 'Newest' : 'A-Z'} | Filter: {filterBy}
        </Text>

        <FlatList
          data={filteredCards}
          keyExtractor={(item) => item.id}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={<Text style={styles.emptyText}>No tutorials found.</Text>}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.card}
              onPress={() => {
                if (item.itemId) {
                  router.push({
                    pathname: '/item/[id]',
                    params: { id: item.itemId, category: 'Learning' },
                  });
                  return;
                }
              }}
              activeOpacity={0.86}
            >
              <View style={styles.cardTextWrap}>
                <Text style={styles.cardTitle} numberOfLines={1}>{item.title}</Text>
                <Text style={styles.cardDescription} numberOfLines={2}>{item.description}</Text>
              </View>

              <View style={styles.cardActions}>
                <TouchableOpacity style={styles.actionButton} onPress={() => handleEdit(item)}>
                  <Ionicons name="create-outline" size={17} color="#D7E3FF" />
                </TouchableOpacity>
                <TouchableOpacity style={styles.actionButton} onPress={() => handleDelete(item)}>
                  <Ionicons name="trash-outline" size={17} color="#FF8C8C" />
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          )}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F0F0F',
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 18,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#1E2C4A',
    borderWidth: 1,
    borderColor: '#3A7AFE',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  addButtonText: {
    color: '#D7E3FF',
    fontSize: 12,
    fontWeight: '700',
  },
  searchInput: {
    flex: 1,
    backgroundColor: '#151A22',
    borderWidth: 1,
    borderColor: '#242B38',
    borderRadius: 12,
    color: '#FFFFFF',
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontSize: 14,
  },
  iconButton: {
    borderWidth: 1,
    borderColor: '#2A3241',
    borderRadius: 12,
    width: 42,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#12161F',
  },
  iconButtonActive: {
    borderColor: '#8A58E9',
    backgroundColor: '#281B44',
  },
  iconButtonActiveBlue: {
    borderColor: '#3A7AFE',
    backgroundColor: '#1A2440',
  },
  dropdownMenu: {
    backgroundColor: '#151A22',
    borderWidth: 1,
    borderColor: '#242B38',
    borderRadius: 12,
    paddingVertical: 6,
    marginBottom: 8,
  },
  dropdownItem: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dropdownText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  dropdownClearText: {
    color: '#B8C4DA',
    fontSize: 13,
    fontWeight: '700',
  },
  stateText: {
    color: '#9BA5B8',
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 10,
    textTransform: 'capitalize',
  },
  listContent: {
    paddingBottom: 24,
    gap: 10,
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
  cardTextWrap: {
    flex: 1,
    marginRight: 10,
  },
  cardTitle: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 6,
  },
  cardDescription: {
    color: '#8D95A3',
    fontSize: 13,
    lineHeight: 18,
  },
  cardActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  actionButton: {
    width: 30,
    height: 30,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: '#2D3646',
    backgroundColor: '#12161F',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    color: '#7F8797',
    textAlign: 'center',
    fontSize: 14,
    marginTop: 24,
  },
});

