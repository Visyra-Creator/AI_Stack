import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  Alert,
  FlatList,
  Image,
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
import { parseAddContentMeta, serializeAddContentMeta } from '../../data/add-content';
import { deleteItem, getItemById, getItemsByCategory, updateItem } from '../../services/api';

type SortOption = 'newest' | 'oldest' | 'title';
type FilterOption = 'all' | 'uploaded' | 'favorites';
type ViewMode = 'normal' | 'gallery';

interface TutorialCard {
  id: string;
  title: string;
  description: string;
  itemId?: string;
  imageUri?: string;
  isFavorite?: boolean;
  notes?: string;
  category?: string;
  url?: string;
}

interface BackendItem {
  id: string;
  category: string;
  title: string;
  description: string;
  notes?: string;
  image?: string;
  url?: string;
}

export default function TutorialsScreen() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<SortOption>('newest');
  const [filterBy, setFilterBy] = useState<FilterOption>('all');
  const [viewMode, setViewMode] = useState<ViewMode>('normal');
  const [openDropdown, setOpenDropdown] = useState<'sort' | 'filter' | 'view' | null>(null);
  const [uploadedTutorials, setUploadedTutorials] = useState<TutorialCard[]>([]);
  const lastOpenAtRef = useRef(0);


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
        .map((item) => {
          const metadata = parseAddContentMeta(item.notes);

          return {
            id: `uploaded-${item.id}`,
            title: item.title,
            description: item.description || 'Uploaded tutorial content',
            itemId: item.id,
            imageUri: item.image || metadata?.imageUri,
            isFavorite: Boolean(metadata?.isFavorite),
              notes: item.notes,
              category: item.category,
              url: item.url,
          };
        });

      setUploadedTutorials(mapped);
    } catch (error) {
      console.error('Failed to load uploaded tutorials:', error);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      // Keep Tutorials as a predictable main view after returning from add/edit flows.
      setSearchQuery('');
      setFilterBy('all');
      setOpenDropdown(null);
      loadTutorials();
    }, [loadTutorials])
  );

  const tutorialCards = useMemo<TutorialCard[]>(() => [...uploadedTutorials], [uploadedTutorials]);

  const filteredCards = useMemo(() => {
    const normalized = searchQuery.trim().toLowerCase();
    const sourceFiltered = tutorialCards.filter((card) => {
      if (filterBy === 'uploaded') {
        return Boolean(card.itemId);
      }

      if (filterBy === 'favorites') {
        return Boolean(card.isFavorite);
      }

      return true;
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

    if (sortBy === 'oldest') {
      return [...searched].reverse();
    }

    return searched;
  }, [filterBy, searchQuery, sortBy, tutorialCards]);

  const sortOptions: { value: SortOption; label: string }[] = [
    { value: 'newest', label: 'Newest' },
    { value: 'oldest', label: 'Oldest First' },
    { value: 'title', label: 'A-Z' },
  ];

  const filterOptions: { value: FilterOption; label: string }[] = [
    { value: 'all', label: 'All' },
    { value: 'uploaded', label: 'Uploaded' },
    { value: 'favorites', label: 'Favorites' },
  ];

  const toggleFavoritesFilter = () => {
    setFilterBy((current) => (current === 'favorites' ? 'all' : 'favorites'));
    setOpenDropdown(null);
  };

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

    router.navigate({
      pathname: '/item/edit',
      params: {
        id: card.itemId,
        category: 'Learning',
        returnTo: '/learning/tutorials',
      },
    });
  };

  const handleToggleFavorite = async (card: TutorialCard) => {
    if (!card.itemId) {
      return;
    }

    try {
      const existing = await getItemById(card.itemId);
      const existingMeta = parseAddContentMeta(existing.notes);
      const nextFavorite = !Boolean(existingMeta?.isFavorite);
      const nextMeta = {
        ...(existingMeta ?? { subcategory: 'Tutorials' }),
        isFavorite: nextFavorite,
      };

      if (!nextFavorite) {
        delete (nextMeta as { isFavorite?: boolean }).isFavorite;
      }

      await updateItem(card.itemId, {
        category: existing.category,
        title: existing.title,
        description: existing.description || '',
        notes: serializeAddContentMeta(nextMeta),
        image: existing.image || null,
        url: existing.url || null,
      });

      setUploadedTutorials((current) =>
        current.map((item) =>
          item.itemId === card.itemId ? { ...item, isFavorite: nextFavorite } : item
        )
      );
    } catch (error) {
      console.error('Failed to update tutorial favorite:', error);
      Alert.alert('Error', 'Failed to update favorite.');
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <View style={styles.content}>
        <View style={styles.topBar}>
          <TouchableOpacity
            style={styles.addButton}
            onPress={() =>
              router.navigate({
                pathname: '/item/select-category',
                params: {
                  initialCategory: 'Learning',
                  subcategory: 'Tutorials',
                  returnTo: '/learning/tutorials',
                },
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

          <TouchableOpacity
            style={[styles.iconButton, filterBy === 'favorites' && styles.iconButtonActiveGold]}
            onPress={toggleFavoritesFilter}
            activeOpacity={0.85}
          >
            <Ionicons name={filterBy === 'favorites' ? 'star' : 'star-outline'} size={18} color="#FEC84B" />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.iconButton, openDropdown === 'view' && styles.iconButtonActiveTeal]}
            onPress={() => setOpenDropdown((current) => (current === 'view' ? null : 'view'))}
            activeOpacity={0.85}
          >
            <Ionicons name={viewMode === 'gallery' ? 'grid' : 'list'} size={18} color="#C5FFF5" />
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

        {openDropdown === 'view' ? (
          <View style={styles.dropdownMenu}>
            <TouchableOpacity
              style={styles.dropdownItem}
              onPress={() => {
                setViewMode('normal');
                setOpenDropdown(null);
              }}
              activeOpacity={0.85}
            >
              <Text style={styles.dropdownText}>Normal View</Text>
              {viewMode === 'normal' ? <Ionicons name="checkmark" size={16} color="#86F3E0" /> : null}
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.dropdownItem}
              onPress={() => {
                setViewMode('gallery');
                setOpenDropdown(null);
              }}
              activeOpacity={0.85}
            >
              <Text style={styles.dropdownText}>Gallery View</Text>
              {viewMode === 'gallery' ? <Ionicons name="checkmark" size={16} color="#86F3E0" /> : null}
            </TouchableOpacity>
          </View>
        ) : null}

        <Text style={styles.stateText}>
          Sort: {sortBy === 'newest' ? 'Newest' : sortBy === 'oldest' ? 'Oldest First' : 'A-Z'} | Filter: {filterBy} | View: {viewMode}
        </Text>

        <FlatList
          key={viewMode}
          data={filteredCards}
          numColumns={viewMode === 'gallery' ? 3 : 1}
          columnWrapperStyle={viewMode === 'gallery' ? styles.galleryRow : undefined}
          keyExtractor={(item) => item.id}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={<Text style={styles.emptyText}>No tutorials found.</Text>}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={viewMode === 'gallery' ? styles.galleryCard : styles.card}
              onPress={() => {
                if (item.itemId) {
                  const now = Date.now();
                  if (now - lastOpenAtRef.current < 450) {
                    return;
                  }
                  lastOpenAtRef.current = now;

                  router.navigate({
                    pathname: '/item/[id]',
                    params: {
                      id: item.itemId,
                      category: 'Learning',
                      returnTo: '/learning/tutorials',
                    },
                  });
                  return;
                }
              }}
              activeOpacity={0.86}
            >
              {viewMode === 'gallery' ? (
                <>
                  {item.imageUri ? (
                    <Image source={{ uri: item.imageUri }} style={styles.galleryImage} resizeMode="cover" />
                  ) : (
                    <View style={styles.galleryImagePlaceholder}>
                      <Ionicons name="image-outline" size={18} color="#7F8AA0" />
                    </View>
                  )}
                  <Text style={styles.galleryTitle} numberOfLines={2}>{item.title}</Text>
                  <View style={[styles.favoriteTag, !item.isFavorite && styles.normalTag]}>
                    <Ionicons
                      name={item.isFavorite ? 'star' : 'star-outline'}
                      size={11}
                      color={item.isFavorite ? '#FEC84B' : '#A5B1C6'}
                    />
                    <Text style={[styles.favoriteTagText, !item.isFavorite && styles.normalTagText]}>
                      {item.isFavorite ? 'Fav' : 'Normal'}
                    </Text>
                  </View>
                  <Text style={styles.galleryDescription} numberOfLines={2}>{item.description}</Text>
                  <View style={styles.galleryActions}>
                    <TouchableOpacity style={styles.galleryActionButton} onPress={() => handleToggleFavorite(item)}>
                      <Ionicons
                        name={item.isFavorite ? 'star' : 'star-outline'}
                        size={14}
                        color={item.isFavorite ? '#FEC84B' : '#D7E3FF'}
                      />
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.galleryActionButton} onPress={() => handleEdit(item)}>
                      <Ionicons name="create-outline" size={14} color="#D7E3FF" />
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.galleryActionButton} onPress={() => handleDelete(item)}>
                      <Ionicons name="trash-outline" size={14} color="#FF8C8C" />
                    </TouchableOpacity>
                  </View>
                </>
              ) : (
                <>
                  <View style={styles.cardTextWrap}>
                    <View style={styles.titleRow}>
                      <Text style={styles.cardTitle} numberOfLines={1}>{item.title}</Text>
                      <View style={[styles.favoriteTag, !item.isFavorite && styles.normalTag]}>
                        <Ionicons
                          name={item.isFavorite ? 'star' : 'star-outline'}
                          size={11}
                          color={item.isFavorite ? '#FEC84B' : '#A5B1C6'}
                        />
                        <Text style={[styles.favoriteTagText, !item.isFavorite && styles.normalTagText]}>
                          {item.isFavorite ? 'Fav' : 'Normal'}
                        </Text>
                      </View>
                    </View>
                    <Text style={styles.cardDescription} numberOfLines={2}>{item.description}</Text>
                  </View>

                  <View style={styles.cardActions}>
                    <TouchableOpacity style={styles.actionButton} onPress={() => handleToggleFavorite(item)}>
                      <Ionicons
                        name={item.isFavorite ? 'star' : 'star-outline'}
                        size={17}
                        color={item.isFavorite ? '#FEC84B' : '#D7E3FF'}
                      />
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.actionButton} onPress={() => handleEdit(item)}>
                      <Ionicons name="create-outline" size={17} color="#D7E3FF" />
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.actionButton} onPress={() => handleDelete(item)}>
                      <Ionicons name="trash-outline" size={17} color="#FF8C8C" />
                    </TouchableOpacity>
                  </View>
                </>
              )}
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
  iconButtonActiveTeal: {
    borderColor: '#37D6B0',
    backgroundColor: '#143329',
  },
  iconButtonActiveGold: {
    borderColor: '#FEC84B',
    backgroundColor: '#31260F',
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
  galleryRow: {
    paddingHorizontal: 0,
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
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
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
  galleryCard: {
    flex: 1,
    maxWidth: '33.33%',
    height: 214,
    backgroundColor: '#151A22',
    borderWidth: 1,
    borderColor: '#242B38',
    borderRadius: 14,
    padding: 8,
    marginHorizontal: 4,
    marginBottom: 10,
  },
  galleryImage: {
    width: '100%',
    height: 104,
    borderRadius: 10,
    marginBottom: 8,
  },
  galleryImagePlaceholder: {
    width: '100%',
    height: 104,
    borderRadius: 10,
    marginBottom: 8,
    backgroundColor: '#111722',
    borderWidth: 1,
    borderColor: '#2A3241',
    alignItems: 'center',
    justifyContent: 'center',
  },
  galleryTitle: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 4,
  },
  galleryDescription: {
    color: '#9AA4B7',
    fontSize: 11,
    lineHeight: 15,
    marginBottom: 8,
  },
  favoriteTag: {
    alignSelf: 'flex-start',
    marginBottom: 6,
    borderWidth: 1,
    borderColor: '#3B3521',
    backgroundColor: '#2B2414',
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  favoriteTagText: {
    color: '#FEC84B',
    fontSize: 10,
    fontWeight: '700',
  },
  normalTag: {
    borderColor: '#2A3241',
    backgroundColor: '#161C27',
  },
  normalTagText: {
    color: '#A5B1C6',
  },
  galleryActions: {
    marginTop: 'auto',
    flexDirection: 'row',
    gap: 6,
  },
  galleryActionButton: {
    flex: 1,
    height: 30,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#2D3646',
    backgroundColor: '#12161F',
    alignItems: 'center',
    justifyContent: 'center',
  },
});

