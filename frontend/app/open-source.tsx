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
import { useTheme } from '@/src/context/ThemeContext';
import { Card } from '@/src/components/common/Card';
import { FormInput } from '@/src/components/common/FormInput';
import { Select } from '@/src/components/common/Select';
import { Button } from '@/src/components/common/Button';
import { EmptyState } from '@/src/components/common/EmptyState';
import { openSourceStorage, OpenSourceItem } from '@/src/services/storage';

const CATEGORIES = [
  'AI/ML',
  'Web Development',
  'Mobile Development',
  'DevOps',
  'Data Science',
  'Automation',
  'Graphics',
  'Audio/Video',
  'Other',
];

export default function OpenSourceScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const [items, setItems] = useState<OpenSourceItem[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingItem, setEditingItem] = useState<OpenSourceItem | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    instructions: '',
    links: [{ label: '', url: '' }] as { label: string; url: string }[],
    category: '',
  });

  const loadItems = useCallback(async () => {
    const data = await openSourceStorage.getAll();
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
      name: '',
      description: '',
      instructions: '',
      links: [{ label: '', url: '' }],
      category: '',
    });
    setEditingItem(null);
  };

  const openAddModal = () => {
    resetForm();
    setModalVisible(true);
  };

  const openEditModal = (item: OpenSourceItem) => {
    setEditingItem(item);
    setFormData({
      name: item.name,
      description: item.description,
      instructions: item.instructions,
      links: item.links.length > 0 ? item.links : [{ label: '', url: '' }],
      category: item.category,
    });
    setModalVisible(true);
  };

  const handleSave = async () => {
    if (!formData.name.trim()) {
      Alert.alert('Error', 'Name is required');
      return;
    }

    const cleanedLinks = formData.links.filter(l => l.label.trim() || l.url.trim());

    if (editingItem) {
      await openSourceStorage.update(editingItem.id, { ...formData, links: cleanedLinks });
    } else {
      await openSourceStorage.add({ ...formData, links: cleanedLinks });
    }

    await loadItems();
    setModalVisible(false);
    resetForm();
  };

  const handleDelete = (item: OpenSourceItem) => {
    Alert.alert('Delete', `Are you sure you want to delete "${item.name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await openSourceStorage.delete(item.id);
          await loadItems();
        },
      },
    ]);
  };

  const addLink = () => {
    setFormData({ ...formData, links: [...formData.links, { label: '', url: '' }] });
  };

  const updateLink = (index: number, field: 'label' | 'url', value: string) => {
    const newLinks = [...formData.links];
    newLinks[index][field] = value;
    setFormData({ ...formData, links: newLinks });
  };

  const removeLink = (index: number) => {
    if (formData.links.length > 1) {
      const newLinks = formData.links.filter((_, i) => i !== index);
      setFormData({ ...formData, links: newLinks });
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.text }]}>Open Source</Text>
        <TouchableOpacity onPress={openAddModal} style={[styles.addButton, { backgroundColor: colors.primary }]}>
          <Ionicons name="add" size={24} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      {items.length === 0 ? (
        <EmptyState
          icon="git-branch-outline"
          title="No Open Source Projects"
          description="Track interesting open source projects and tools."
          actionLabel="Add Project"
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
              title={item.name}
              subtitle={item.description}
              tags={item.category ? [item.category] : []}
              onEdit={() => openEditModal(item)}
              onDelete={() => handleDelete(item)}
            >
              {item.links && item.links.length > 0 && (
                <View style={styles.linksContainer}>
                  {item.links.map((link, index) => (
                    <View key={index} style={[styles.linkBadge, { backgroundColor: colors.success + '20' }]}>
                      <Ionicons name="link" size={12} color={colors.success} />
                      <Text style={[styles.linkText, { color: colors.success }]}>
                        {link.label || link.url}
                      </Text>
                    </View>
                  ))}
                </View>
              )}
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
              {editingItem ? 'Edit Project' : 'Add Project'}
            </Text>
            <TouchableOpacity onPress={handleSave}>
              <Text style={[styles.saveText, { color: colors.primary }]}>Save</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.form} showsVerticalScrollIndicator={false}>
            <FormInput
              label="Project Name *"
              placeholder="e.g., Stable Diffusion"
              value={formData.name}
              onChangeText={(text) => setFormData({ ...formData, name: text })}
            />
            <FormInput
              label="Description"
              placeholder="What does this project do?"
              value={formData.description}
              onChangeText={(text) => setFormData({ ...formData, description: text })}
              multiline
              numberOfLines={3}
              style={styles.textArea}
            />
            <Select
              label="Category"
              options={CATEGORIES}
              value={formData.category}
              onChange={(category) => setFormData({ ...formData, category })}
            />
            <FormInput
              label="Instructions"
              placeholder="Installation, setup notes..."
              value={formData.instructions}
              onChangeText={(text) => setFormData({ ...formData, instructions: text })}
              multiline
              numberOfLines={4}
              style={styles.textArea}
            />

            <View style={styles.linksSection}>
              <Text style={[styles.linksLabel, { color: colors.textSecondary }]}>Links</Text>
              {formData.links.map((link, index) => (
                <View key={index} style={styles.linkRow}>
                  <View style={styles.linkInputs}>
                    <FormInput
                      label="Label"
                      placeholder="GitHub"
                      value={link.label}
                      onChangeText={(text) => updateLink(index, 'label', text)}
                      style={styles.linkLabelInput}
                    />
                    <FormInput
                      label="URL"
                      placeholder="https://..."
                      value={link.url}
                      onChangeText={(text) => updateLink(index, 'url', text)}
                      keyboardType="url"
                      autoCapitalize="none"
                      style={styles.linkUrlInput}
                    />
                  </View>
                  {formData.links.length > 1 && (
                    <TouchableOpacity onPress={() => removeLink(index)} style={styles.removeLink}>
                      <Ionicons name="close-circle" size={24} color={colors.danger} />
                    </TouchableOpacity>
                  )}
                </View>
              ))}
              <Button title="Add Link" onPress={addLink} variant="outline" style={styles.addLinkButton} />
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
  linksContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 12,
  },
  linkBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    gap: 4,
  },
  linkText: {
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
  linksSection: {
    marginBottom: 16,
  },
  linksLabel: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 8,
  },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginBottom: 8,
  },
  linkInputs: {
    flex: 1,
    flexDirection: 'row',
    gap: 8,
  },
  linkLabelInput: {
    flex: 1,
  },
  linkUrlInput: {
    flex: 2,
  },
  removeLink: {
    padding: 8,
    marginBottom: 16,
  },
  addLinkButton: {
    marginTop: 8,
  },
  bottomPadding: {
    height: 40,
  },
});
