import { Ionicons } from '@expo/vector-icons';

export interface DashboardCategory {
  id: string;
  title: 'AI & Tools' | 'Prompts & Knowledge' | 'Learning' | 'Business & Growth' | 'Content Creation';
  description: string;
  icon: keyof typeof Ionicons.glyphMap;
  accent: string;
  sections?: LearningSection[];
}

export interface LearningSection {
  id: string;
  title: string;
  description: string;
  screen: 'TutorialsScreen' | 'GuidesScreen';
  route: '/learning/tutorials' | '/learning/guides';
}

export interface QuickAction {
  id: string;
  title: 'Create Prompt' | 'Start Campaign' | 'Explore Tools';
  icon: keyof typeof Ionicons.glyphMap;
  route: string;
  accent: string;
}

export const categories: DashboardCategory[] = [
  {
    id: 'business-growth',
    title: 'Business & Growth',
    description: 'Drive leads, sales, and marketing systems',
    icon: 'trending-up-outline',
    accent: '#3954E6',
  },
  {
    id: 'ai-tools',
    title: 'AI & Tools',
    description: 'Explore and manage your AI stack',
    icon: 'layers-outline',
    accent: '#2D7FF9',
  },
  {
    id: 'prompts-knowledge',
    title: 'Prompts & Knowledge',
    description: 'Store and reuse powerful prompts',
    icon: 'bookmarks-outline',
    accent: '#2BAA7B',
  },
  {
    id: 'learning',
    title: 'Learning',
    description: 'Tutorials and educational content',
    icon: 'school-outline',
    accent: '#8A58E9',
    sections: [
      {
        id: 'tutorials',
        title: 'Tutorials',
        description: 'Step-by-step guides to learn tools and workflows',
        screen: 'TutorialsScreen',
        route: '/learning/tutorials',
      },
      {
        id: 'guides',
        title: 'Guides',
        description: 'In-depth explanations and strategies',
        screen: 'GuidesScreen',
        route: '/learning/guides',
      },
    ],
  },
  {
    id: 'content-creation',
    title: 'Content Creation',
    description: 'Plan and produce high-impact content',
    icon: 'sparkles-outline',
    accent: '#D97A1E',
  },
];

export const quickActions: QuickAction[] = [
  {
    id: 'create-prompt',
    title: 'Create Prompt',
    icon: 'create-outline',
    route: '/category/Prompts & Knowledge',
    accent: '#2BAA7B',
  },
  {
    id: 'start-campaign',
    title: 'Start Campaign',
    icon: 'rocket-outline',
    route: '/category/Business & Growth',
    accent: '#3954E6',
  },
  {
    id: 'explore-tools',
    title: 'Explore Tools',
    icon: 'construct-outline',
    route: '/category/AI & Tools',
    accent: '#2D7FF9',
  },
];

