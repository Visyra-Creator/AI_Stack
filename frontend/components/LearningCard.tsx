import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface LearningCardProps {
  title: string;
  description: string;
  onPress: () => void;
  compact?: boolean;
}

export function LearningCard({ title, description, onPress, compact = false }: LearningCardProps) {
  return (
    <TouchableOpacity
      style={[styles.card, compact && styles.cardCompact]}
      onPress={onPress}
      activeOpacity={0.86}
    >
      <View style={styles.textWrap}>
        <Text style={styles.title} numberOfLines={1}>{title}</Text>
        <Text style={styles.description} numberOfLines={compact ? 2 : 3}>{description}</Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color="#9CA7BA" />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#151A22',
    borderWidth: 1,
    borderColor: '#242B38',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.24,
    shadowRadius: 8,
    elevation: 5,
  },
  cardCompact: {
    width: 260,
    marginRight: 12,
  },
  textWrap: {
    flex: 1,
    marginRight: 8,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 6,
  },
  description: {
    color: '#8D95A3',
    fontSize: 13,
    lineHeight: 18,
  },
});

