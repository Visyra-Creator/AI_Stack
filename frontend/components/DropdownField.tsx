import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface DropdownFieldProps {
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
  selectedValues?: string[];
  onChangeValues?: (values: string[]) => void;
  multiSelect?: boolean;
  allowOptionManagement?: boolean;
  onOptionsChange?: (options: string[]) => void;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
}

export function DropdownField({
  label,
  value,
  options,
  onChange,
  selectedValues,
  onChangeValues,
  multiSelect,
  allowOptionManagement,
  onOptionsChange,
  placeholder = 'Select option',
  required,
  disabled,
}: DropdownFieldProps) {
  const [open, setOpen] = useState(false);
  const [localOptions, setLocalOptions] = useState<string[]>(options);
  const [editorMode, setEditorMode] = useState<'add' | 'edit' | null>(null);
  const [draftValue, setDraftValue] = useState('');
  const [editingOriginal, setEditingOriginal] = useState<string | null>(null);

  useEffect(() => {
    setLocalOptions(options);
  }, [options]);

  const selectedSet = useMemo(() => new Set(selectedValues ?? []), [selectedValues]);

  const triggerLabel = useMemo(() => {
    if (!multiSelect) {
      return value;
    }

    if (!selectedValues || selectedValues.length === 0) {
      return '';
    }

    return selectedValues.join(', ');
  }, [multiSelect, selectedValues, value]);

  const persistOptions = (nextOptions: string[]) => {
    setLocalOptions(nextOptions);
    onOptionsChange?.(nextOptions);
  };

  const handleToggleOption = (option: string) => {
    if (!multiSelect) {
      onChange(option);
      setOpen(false);
      return;
    }

    const current = selectedValues ?? [];
    const next = current.includes(option)
      ? current.filter((item) => item !== option)
      : [...current, option];
    onChangeValues?.(next);
  };

  const startAdd = () => {
    setEditorMode('add');
    setDraftValue('');
    setEditingOriginal(null);
  };

  const startEdit = (option: string) => {
    setEditorMode('edit');
    setDraftValue(option);
    setEditingOriginal(option);
  };

  const saveEditor = () => {
    const trimmed = draftValue.trim();
    if (!trimmed) {
      Alert.alert('Invalid value', 'Category value cannot be empty.');
      return;
    }

    if (editorMode === 'add') {
      if (localOptions.some((item) => item.toLowerCase() === trimmed.toLowerCase())) {
        Alert.alert('Duplicate value', 'This category already exists.');
        return;
      }

      const nextOptions = [...localOptions, trimmed];
      persistOptions(nextOptions);
      if (multiSelect) {
        const current = selectedValues ?? [];
        onChangeValues?.([...current, trimmed]);
      } else {
        onChange(trimmed);
      }
    }

    if (editorMode === 'edit' && editingOriginal) {
      const duplicate = localOptions.some(
        (item) => item !== editingOriginal && item.toLowerCase() === trimmed.toLowerCase()
      );
      if (duplicate) {
        Alert.alert('Duplicate value', 'This category already exists.');
        return;
      }

      const nextOptions = localOptions.map((item) => (item === editingOriginal ? trimmed : item));
      persistOptions(nextOptions);

      if (multiSelect) {
        const current = selectedValues ?? [];
        const nextSelected = current.map((item) => (item === editingOriginal ? trimmed : item));
        onChangeValues?.(nextSelected);
      } else if (value === editingOriginal) {
        onChange(trimmed);
      }
    }

    setEditorMode(null);
    setDraftValue('');
    setEditingOriginal(null);
  };

  const deleteOption = (option: string) => {
    Alert.alert('Delete Category', 'Remove this option from the dropdown?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          const nextOptions = localOptions.filter((item) => item !== option);
          persistOptions(nextOptions);

          if (multiSelect) {
            const current = selectedValues ?? [];
            onChangeValues?.(current.filter((item) => item !== option));
          } else if (value === option) {
            onChange('');
          }
        },
      },
    ]);
  };

  return (
    <View style={styles.section}>
      <Text style={styles.label}>
        {label}
        {required ? ' *' : ''}
      </Text>

      <TouchableOpacity
        style={[styles.trigger, disabled && styles.triggerDisabled]}
        onPress={() => !disabled && setOpen(true)}
        activeOpacity={0.86}
        disabled={disabled}
      >
        <Text style={[styles.triggerText, !triggerLabel && styles.placeholderText]} numberOfLines={1}>
          {triggerLabel || placeholder}
        </Text>
        <Ionicons name="chevron-down" size={18} color="#AAB3C4" />
      </TouchableOpacity>

      <Modal
        visible={open}
        transparent
        animationType="fade"
        onRequestClose={() => setOpen(false)}
      >
        <Pressable style={styles.overlay} onPress={() => setOpen(false)}>
          <Pressable style={styles.menu} onPress={(event) => event.stopPropagation()}>
            {allowOptionManagement ? (
              <View style={styles.manageBar}>
                <TouchableOpacity style={styles.manageButton} onPress={startAdd} activeOpacity={0.86}>
                  <Ionicons name="add" size={14} color="#D7E3FF" />
                  <Text style={styles.manageButtonText}>Add</Text>
                </TouchableOpacity>
              </View>
            ) : null}

            {allowOptionManagement && editorMode ? (
              <View style={styles.editorWrap}>
                <TextInput
                  style={styles.editorInput}
                  value={draftValue}
                  onChangeText={setDraftValue}
                  placeholder="Enter category"
                  placeholderTextColor="#5E6879"
                />
                <View style={styles.editorActions}>
                  <TouchableOpacity
                    style={[styles.editorButton, styles.editorButtonSecondary]}
                    onPress={() => {
                      setEditorMode(null);
                      setDraftValue('');
                      setEditingOriginal(null);
                    }}
                    activeOpacity={0.86}
                  >
                    <Text style={styles.editorButtonTextSecondary}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.editorButton} onPress={saveEditor} activeOpacity={0.86}>
                    <Text style={styles.editorButtonText}>Save</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : null}

            <ScrollView showsVerticalScrollIndicator={false}>
              {localOptions.map((option) => (
                <TouchableOpacity
                  key={option}
                  style={styles.menuItem}
                  onPress={() => handleToggleOption(option)}
                  activeOpacity={0.86}
                >
                  <Text style={styles.menuText}>{option}</Text>
                  <View style={styles.itemActions}>
                    {allowOptionManagement ? (
                      <>
                        <TouchableOpacity style={styles.iconAction} onPress={() => startEdit(option)}>
                          <Ionicons name="create-outline" size={14} color="#CFD7E6" />
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.iconAction} onPress={() => deleteOption(option)}>
                          <Ionicons name="trash-outline" size={14} color="#FF9D9D" />
                        </TouchableOpacity>
                      </>
                    ) : null}
                    {multiSelect ? (
                      selectedSet.has(option) ? <Ionicons name="checkmark" size={16} color="#84A9FF" /> : null
                    ) : value === option ? (
                      <Ionicons name="checkmark" size={16} color="#84A9FF" />
                    ) : null}
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {multiSelect ? (
              <TouchableOpacity style={styles.doneButton} onPress={() => setOpen(false)} activeOpacity={0.86}>
                <Text style={styles.doneButtonText}>Done</Text>
              </TouchableOpacity>
            ) : null}
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    marginBottom: 18,
  },
  label: {
    color: '#95A0B3',
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  trigger: {
    backgroundColor: '#151A22',
    borderWidth: 1,
    borderColor: '#242B38',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  triggerDisabled: {
    opacity: 0.7,
  },
  triggerText: {
    color: '#FFFFFF',
    fontSize: 15,
    flex: 1,
  },
  placeholderText: {
    color: '#5B6270',
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.42)',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  menu: {
    maxHeight: 360,
    backgroundColor: '#151A22',
    borderWidth: 1,
    borderColor: '#242B38',
    borderRadius: 12,
    paddingVertical: 4,
  },
  manageBar: {
    paddingHorizontal: 10,
    paddingTop: 8,
    paddingBottom: 4,
  },
  manageButton: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderWidth: 1,
    borderColor: '#3A7AFE',
    backgroundColor: '#1A2440',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  manageButtonText: {
    color: '#D7E3FF',
    fontSize: 12,
    fontWeight: '700',
  },
  editorWrap: {
    paddingHorizontal: 10,
    paddingBottom: 8,
    gap: 8,
  },
  editorInput: {
    backgroundColor: '#10141C',
    borderWidth: 1,
    borderColor: '#2A3241',
    borderRadius: 10,
    color: '#FFFFFF',
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  editorActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
  },
  editorButton: {
    backgroundColor: '#3A7AFE',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  editorButtonSecondary: {
    backgroundColor: '#1E2533',
    borderWidth: 1,
    borderColor: '#2A3241',
  },
  editorButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  editorButtonTextSecondary: {
    color: '#C2CAD9',
    fontSize: 12,
    fontWeight: '700',
  },
  menuItem: {
    paddingHorizontal: 12,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  itemActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  iconAction: {
    width: 24,
    height: 24,
    borderRadius: 7,
    borderWidth: 1,
    borderColor: '#2A3241',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#10141C',
  },
  menuText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
    flex: 1,
  },
  doneButton: {
    marginHorizontal: 10,
    marginVertical: 8,
    backgroundColor: '#3A7AFE',
    borderRadius: 8,
    paddingVertical: 9,
    alignItems: 'center',
  },
  doneButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
});

