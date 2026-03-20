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
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import { useTheme } from '@/src/context/ThemeContext';
import { Card } from '@/src/components/common/Card';
import { FormInput } from '@/src/components/common/FormInput';
import { Button } from '@/src/components/common/Button';
import { EmptyState } from '@/src/components/common/EmptyState';
import { tutorialsStorage, TutorialItem } from '@/src/services/storage';

export default function TutorialsScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const [items, setItems] = useState<TutorialItem[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingItem, setEditingItem] = useState<TutorialItem | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const [formData, setFormData] = useState({
    tutorialName: '',
    description: '',
    instructions: '',
    videoLink: '',
    files: [] as string[],
  });

  const loadItems = useCallback(async () => {
    const data = await tutorialsStorage.getAll();
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
      tutorialName: '',
      description: '',
      instructions: '',
      videoLink: '',
      files: [],
    });
    setEditingItem(null);
  };

  const openAddModal = () => {
    resetForm();
    setModalVisible(true);
  };

  const openEditModal = (item: TutorialItem) => {
    setEditingItem(item);
    setFormData({
      tutorialName: item.tutorialName,
      description: item.description,
      instructions: item.instructions,
      videoLink: item.videoLink || '',
      files: item.files || [],
    });
    setModalVisible(true);
  };

  const handleSave = async () => {
    if (!formData.tutorialName.trim()) {
      Alert.alert('Error', 'Tutorial name is required');
      return;
    }

    if (editingItem) {
      await tutorialsStorage.update(editingItem.id, formData);
    } else {
      await tutorialsStorage.add(formData);
    }

    await loadItems();
    setModalVisible(false);
    resetForm();
  };

  const handleDelete = (item: TutorialItem) => {
    Alert.alert('Delete', `Are you sure you want to delete "${item.tutorialName}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await tutorialsStorage.delete(item.id);
          await loadItems();
        },
      },
    ]);
  };

  const pickFiles = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        multiple: true,
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets) {
        const newFiles: string[] = [];
        for (const asset of result.assets) {
          // Store file info as JSON string
          newFiles.push(JSON.stringify({ name: asset.name, uri: asset.uri, size: asset.size }));
        }
        setFormData({ ...formData, files: [...formData.files, ...newFiles] });
      }
    } catch (error) {
      console.log('Error picking files:', error);
    }
  };

  const removeFile = (index: number) => {
    const newFiles = formData.files.filter((_, i) => i !== index);
    setFormData({ ...formData, files: newFiles });
  };

  const getFileName = (fileStr: string): string => {
    try {
      const parsed = JSON.parse(fileStr);
      return parsed.name || 'File';
    } catch {
      return 'File';
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.text }]}>Tutorials</Text>
        <TouchableOpacity onPress={openAddModal} style={[styles.addButton, { backgroundColor: colors.primary }]}>
          <Ionicons name="add" size={24} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      {items.length === 0 ? (
        <EmptyState
          icon="play-circle-outline"
          title="No Tutorials Yet"
          description="Save tutorials, guides, and learning resources here."
          actionLabel="Add Tutorial"
          onAction={openAddModal}
        />
      ) : (
        <ScrollView
          style={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        >
          {items.map(item => (
            <Card
              key={item.id}
              title={item.tutorialName}
              subtitle={item.description}
              onEdit={() => openEditModal(item)}
              onDelete={() => handleDelete(item)}
            >
              <View style={styles.cardFooter}>
                {item.videoLink && (
                  <View style={[styles.badge, { backgroundColor: colors.danger + '20' }]}>
                    <Ionicons name="videocam" size={14} color={colors.danger} />
                    <Text style={[styles.badgeText, { color: colors.danger }]}>Video</Text>
                  </View>
                )}
                {item.files && item.files.length > 0 && (
                  <View style={[styles.badge, { backgroundColor: colors.primary + '20' }]}>
                    <Ionicons name="document" size={14} color={colors.primary} />
                    <Text style={[styles.badgeText, { color: colors.primary }]}>
                      {item.files.length} file(s)
                    </Text>
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
              {editingItem ? 'Edit Tutorial' : 'Add Tutorial'}
            </Text>
            <TouchableOpacity onPress={handleSave}>
              <Text style={[styles.saveText, { color: colors.primary }]}>Save</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.form} showsVerticalScrollIndicator={false}>
            <FormInput
              label="Tutorial Name *"
              placeholder="e.g., Midjourney Basics"
              value={formData.tutorialName}
              onChangeText={(text) => setFormData({ ...formData, tutorialName: text })}
            />
            <FormInput
              label="Description"
              placeholder="What will you learn?"
              value={formData.description}
              onChangeText={(text) => setFormData({ ...formData, description: text })}
              multiline
              numberOfLines={3}
              style={styles.textArea}
            />
            <FormInput
              label="Instructions"
              placeholder="Step-by-step instructions..."
              value={formData.instructions}
              onChangeText={(text) => setFormData({ ...formData, instructions: text })}
              multiline
              numberOfLines={5}
              style={styles.textArea}
            />
            <FormInput
              label="Video Link"
              placeholder="YouTube, Vimeo, or other video URL"
              value={formData.videoLink}
              onChangeText={(text) => setFormData({ ...formData, videoLink: text })}
              keyboardType="url"
              autoCapitalize="none"
            />

            <View style={styles.filesSection}>
              <Text style={[styles.filesLabel, { color: colors.textSecondary }]}>Files</Text>
              <Button title="Add Files" onPress={pickFiles} variant="outline" />
              {formData.files.map((file, index) => (
                <View key={index} style={[styles.fileItem, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                  <Ionicons name="document-outline" size={20} color={colors.primary} />
                  <Text style={[styles.fileName, { color: colors.text }]} numberOfLines={1}>
                    {getFileName(file)}
                  </Text>
                  <TouchableOpacity onPress={() => removeFile(index)}>
                    <Ionicons name="close-circle" size={20} color={colors.danger} />
                  </TouchableOpacity>
                </View>
              ))}
            </View>

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
  list: {
    flex: 1,
    paddingHorizontal: 16,
  },
  cardFooter: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    gap: 4,
  },
  badgeText: {
    fontSize: 12,
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
  filesSection: {
    marginBottom: 16,
  },
  filesLabel: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 8,
  },
  fileItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    marginTop: 8,
    borderWidth: 1,
    gap: 8,
  },
  fileName: {
    flex: 1,
    fontSize: 14,
  },
  bottomPadding: {
    height: 40,
  },
});
