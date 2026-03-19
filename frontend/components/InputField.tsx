import React from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';

interface InputFieldProps {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  required?: boolean;
  multiline?: boolean;
  keyboardType?: 'default' | 'url';
  editable?: boolean;
}

export function InputField({
  label,
  value,
  onChangeText,
  placeholder,
  required,
  multiline,
  keyboardType,
  editable = true,
}: InputFieldProps) {
  return (
    <View style={styles.section}>
      <Text style={styles.label}>
        {label}
        {required ? ' *' : ''}
      </Text>
      <TextInput
        style={[styles.input, multiline && styles.textArea, !editable && styles.inputReadonly]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#5B6270"
        multiline={multiline}
        numberOfLines={multiline ? 4 : 1}
        textAlignVertical={multiline ? 'top' : 'center'}
        keyboardType={keyboardType}
        editable={editable}
        autoCapitalize="none"
        autoCorrect={false}
      />
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
  input: {
    backgroundColor: '#151A22',
    borderWidth: 1,
    borderColor: '#242B38',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: '#FFFFFF',
    fontSize: 15,
  },
  inputReadonly: {
    opacity: 0.78,
  },
  textArea: {
    minHeight: 118,
  },
});

