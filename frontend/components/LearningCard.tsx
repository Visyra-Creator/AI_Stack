import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface LearningCardProps {
  title: string;
  description: string;
  onPress: () => void;
  compact?: boolean;
  sourceLabel?: string;
}

export function LearningCard({ title, description, onPress, compact = false, sourceLabel }: LearningCardProps) {
  return (
    <TouchableOpacity
      style={[styles.card, compact && styles.cardCompact]}
      onPress={onPress}
      activeOpacity={0.86}
    >
      <View style={styles.textWrap}>
        <View style={styles.headerRow}>
          <Text style={styles.title} numberOfLines={1}>{title}</Text>
        </View>
        <Text style={styles.description} numberOfLines={compact ? 2 : 3}>{description}</Text>
      </View>
      <View style={styles.rightWrap}>
        {sourceLabel ? <Text style={styles.source}>{sourceLabel}</Text> : null}
        <Ionicons name="chevron-forward" size={18} color="#9CA7BA" />
      </View>
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
  rightWrap: {
    minWidth: 54,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'stretch',
    gap: 6,
  },
  headerRow: {
    marginBottom: 6,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
    flex: 1,
  },
  description: {
    color: '#8D95A3',
    fontSize: 13,
    lineHeight: 18,
  },
  source: {
    color: '#9CB8FF',
    fontSize: 11,
    fontWeight: '700',
    textAlign: 'center',
  },
});

