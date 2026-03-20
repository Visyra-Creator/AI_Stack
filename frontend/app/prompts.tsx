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
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/src/context/ThemeContext';
import { Card } from '@/src/components/common/Card';
import { FormInput } from '@/src/components/common/FormInput';
import { Select } from '@/src/components/common/Select';
import { ImagePicker } from '@/src/components/common/ImagePicker';
import { EmptyState } from '@/src/components/common/EmptyState';
import { promptsStorage, PromptItem } from '@/src/services/storage';

const CATEGORIES = ['image', 'video', 'text', 'audio', 'other'];
const PROMPT_TYPES = ['general', 'personal'];

export default function PromptsScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const [items, setItems] = useState<PromptItem[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingItem, setEditingItem] = useState<PromptItem | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<'general' | 'personal'>('general');

  const [formData, setFormData] = useState({
    promptName: '',
    prompt: '',
    inputImage: undefined as string | undefined,
    generatedImage: undefined as string | undefined,
    aiToolUsed: '',
    category: 'image' as 'image' | 'video' | 'text' | 'audio' | 'other',
    type: 'general' as 'general' | 'personal',
  });

  const loadItems = useCallback(async () => {
    const data = await promptsStorage.getAll();
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
      promptName: '',
      prompt: '',
      inputImage: undefined,
      generatedImage: undefined,
      aiToolUsed: '',
      category: 'image',
      type: activeTab,
    });
    setEditingItem(null);
  };

  const openAddModal = () => {
    resetForm();
    setModalVisible(true);
  };

  const openEditModal = (item: PromptItem) => {
    setEditingItem(item);
    setFormData({
      promptName: item.promptName,
      prompt: item.prompt,
      inputImage: item.inputImage,
      generatedImage: item.generatedImage,
      aiToolUsed: item.aiToolUsed,
      category: item.category,
      type: item.type,
    });
    setModalVisible(true);
  };

  const handleSave = async () => {
    if (!formData.promptName.trim()) {
      Alert.alert('Error', 'Prompt name is required');
      return;
    }

    if (editingItem) {
      await promptsStorage.update(editingItem.id, formData);
    } else {
      await promptsStorage.add(formData);
    }

    await loadItems();
    setModalVisible(false);
    resetForm();
  };

  const handleDelete = (item: PromptItem) => {
    Alert.alert('Delete', `Are you sure you want to delete "${item.promptName}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await promptsStorage.delete(item.id);
          await loadItems();
        },
      },
    ]);
  };

  const filteredItems = items.filter(item => item.type === activeTab);

  const getCategoryIcon = (category: string): keyof typeof Ionicons.glyphMap => {
    switch (category) {
      case 'image': return 'image-outline';
      case 'video': return 'videocam-outline';
      case 'text': return 'document-text-outline';
      case 'audio': return 'musical-notes-outline';
      default: return 'ellipsis-horizontal';
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.text }]}>Prompts</Text>
        <TouchableOpacity onPress={openAddModal} style={[styles.addButton, { backgroundColor: colors.primary }]}>
          <Ionicons name="add" size={24} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[
            styles.tab,
            activeTab === 'general' && { backgroundColor: colors.primary },
            { borderColor: colors.border },
          ]}
          onPress={() => setActiveTab('general')}
        >
          <Text style={[styles.tabText, { color: activeTab === 'general' ? '#FFFFFF' : colors.text }]}>
            General
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.tab,
            activeTab === 'personal' && { backgroundColor: colors.primary },
            { borderColor: colors.border },
          ]}
          onPress={() => setActiveTab('personal')}
        >
          <Text style={[styles.tabText, { color: activeTab === 'personal' ? '#FFFFFF' : colors.text }]}>
            Personal
          </Text>
        </TouchableOpacity>
      </View>

      {filteredItems.length === 0 ? (
        <EmptyState
          icon="chatbubble-outline"
          title={`No ${activeTab.charAt(0).toUpperCase() + activeTab.slice(1)} Prompts`}
          description="Save your best prompts for easy access and reuse."
          actionLabel="Add Prompt"
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
              title={item.promptName}
              subtitle={item.prompt.substring(0, 100) + (item.prompt.length > 100 ? '...' : '')}
              onEdit={() => openEditModal(item)}
              onDelete={() => handleDelete(item)}
            >
              <View style={styles.cardContent}>
                <View style={styles.cardMeta}>
                  <View style={[styles.categoryBadge, { backgroundColor: colors.primary + '20' }]}>
                    <Ionicons name={getCategoryIcon(item.category)} size={14} color={colors.primary} />
                    <Text style={[styles.categoryText, { color: colors.primary }]}>
                      {item.category.charAt(0).toUpperCase() + item.category.slice(1)}
                    </Text>
                  </View>
                  {item.aiToolUsed && (
                    <Text style={[styles.toolText, { color: colors.textSecondary }]}>
                      Tool: {item.aiToolUsed}
                    </Text>
                  )}
                </View>
                {(item.inputImage || item.generatedImage) && (
                  <View style={styles.imagesRow}>
                    {item.inputImage && (
                      <Image source={{ uri: item.inputImage }} style={styles.thumbnail} />
                    )}
                    {item.generatedImage && (
                      <Image source={{ uri: item.generatedImage }} style={styles.thumbnail} />
                    )}
                  </View>
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
              {editingItem ? 'Edit Prompt' : 'Add Prompt'}
            </Text>
            <TouchableOpacity onPress={handleSave}>
              <Text style={[styles.saveText, { color: colors.primary }]}>Save</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.form} showsVerticalScrollIndicator={false}>
            <FormInput
              label="Prompt Name *"
              placeholder="Give your prompt a name"
              value={formData.promptName}
              onChangeText={(text) => setFormData({ ...formData, promptName: text })}
            />
            <FormInput
              label="Prompt"
              placeholder="Enter your full prompt here... (no length limit)"
              value={formData.prompt}
              onChangeText={(text) => setFormData({ ...formData, prompt: text })}
              multiline
              numberOfLines={8}
              style={styles.textArea}
            />
            <Select
              label="Type"
              options={PROMPT_TYPES}
              value={formData.type}
              onChange={(type) => setFormData({ ...formData, type: type as any })}
            />
            <Select
              label="Category"
              options={CATEGORIES}
              value={formData.category}
              onChange={(category) => setFormData({ ...formData, category: category as any })}
            />
            <FormInput
              label="AI Tool Used"
              placeholder="e.g., Midjourney, DALL-E, ChatGPT"
              value={formData.aiToolUsed}
              onChangeText={(text) => setFormData({ ...formData, aiToolUsed: text })}
            />
            <ImagePicker
              label="Input/Reference Image"
              value={formData.inputImage}
              onChange={(img) => setFormData({ ...formData, inputImage: img })}
            />
            <ImagePicker
              label="Generated Image"
              value={formData.generatedImage}
              onChange={(img) => setFormData({ ...formData, generatedImage: img })}
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
  tabContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 12,
    marginBottom: 16,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
  },
  list: {
    flex: 1,
    paddingHorizontal: 16,
  },
  cardContent: {
    marginTop: 12,
  },
  cardMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  categoryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    gap: 4,
  },
  categoryText: {
    fontSize: 12,
    fontWeight: '500',
  },
  toolText: {
    fontSize: 12,
  },
  imagesRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  thumbnail: {
    width: 60,
    height: 60,
    borderRadius: 8,
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
    minHeight: 150,
    textAlignVertical: 'top',
  },
  bottomPadding: {
    height: 40,
  },
});
