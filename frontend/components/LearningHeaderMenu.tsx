import React, { useState } from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

interface MenuLink {
  id: string;
  label: string;
  route: '/learning/tutorials' | '/learning/guides';
}

const menuLinks: MenuLink[] = [
  { id: 'tutorials', label: 'Tutorials', route: '/learning/tutorials' },
  { id: 'guides', label: 'Guides', route: '/learning/guides' },
];

export function LearningHeaderMenu() {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);

  const handleNavigate = (route: MenuLink['route']) => {
    setIsOpen(false);
    router.push(route);
  };

  return (
    <>
      <TouchableOpacity style={styles.trigger} onPress={() => setIsOpen(true)}>
        <Ionicons name="menu" size={24} color="#FFFFFF" />
      </TouchableOpacity>

      <Modal transparent animationType="fade" visible={isOpen} onRequestClose={() => setIsOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setIsOpen(false)}>
          <View style={styles.menu}>
            {menuLinks.map((link) => (
              <TouchableOpacity
                key={link.id}
                style={styles.menuItem}
                onPress={() => handleNavigate(link.route)}
              >
                <Text style={styles.menuText}>{link.label}</Text>
                <Ionicons name="chevron-forward" size={16} color="#9CA7BA" />
              </TouchableOpacity>
            ))}
          </View>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  trigger: {
    padding: 4,
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    paddingTop: 88,
    paddingRight: 16,
    alignItems: 'flex-end',
  },
  menu: {
    width: 190,
    backgroundColor: '#151A22',
    borderWidth: 1,
    borderColor: '#242B38',
    borderRadius: 12,
    paddingVertical: 6,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.24,
    shadowRadius: 8,
    elevation: 8,
  },
  menuItem: {
    paddingHorizontal: 12,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  menuText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
});

