export interface LearningItem {
  id: string;
  title: string;
  description: string;
  route: '/learning/tutorials' | '/learning/guides';
}

export const featuredTutorials: LearningItem[] = [
  {
    id: 'tutorial-1',
    title: 'Prompt Workflows 101',
    description: 'Build a repeatable prompt workflow for daily execution.',
    route: '/learning/tutorials',
  },
  {
    id: 'tutorial-2',
    title: 'Campaign Launch with AI',
    description: 'Use AI tools to plan and launch a growth campaign quickly.',
    route: '/learning/tutorials',
  },
  {
    id: 'tutorial-3',
    title: 'Tool Stack Setup',
    description: 'Set up your stack for faster operations and reporting.',
    route: '/learning/tutorials',
  },
];

export const guidesAndResources: LearningItem[] = [
  {
    id: 'guide-1',
    title: 'Growth Strategy Guide',
    description: 'Frameworks for lead generation, funnels, and conversion.',
    route: '/learning/guides',
  },
  {
    id: 'guide-2',
    title: 'Prompt Quality Checklist',
    description: 'A practical checklist to improve prompt outcomes.',
    route: '/learning/guides',
  },
  {
    id: 'guide-3',
    title: 'Weekly Learning Plan',
    description: 'A focused routine to apply new skills each week.',
    route: '/learning/guides',
  },
];

export const recentlyViewed: LearningItem[] = [
  {
    id: 'recent-1',
    title: 'Tutorial: Prompt Workflows 101',
    description: 'Resume where you left off and keep progress moving.',
    route: '/learning/tutorials',
  },
  {
    id: 'recent-2',
    title: 'Guide: Growth Strategy',
    description: 'Review key growth loops and implementation steps.',
    route: '/learning/guides',
  },
];

export const tutorialsList: LearningItem[] = [
  {
    id: 'tutorial-list-1',
    title: 'Getting Started with AI Tools',
    description: 'Choose and organize the right tools for your goals.',
    route: '/learning/tutorials',
  },
  {
    id: 'tutorial-list-2',
    title: 'Prompt Templates for Marketing',
    description: 'Use proven templates for outreach and campaign copy.',
    route: '/learning/tutorials',
  },
  {
    id: 'tutorial-list-3',
    title: 'Create a Content Sprint',
    description: 'Plan, draft, and publish content in one repeatable flow.',
    route: '/learning/tutorials',
  },
  {
    id: 'tutorial-list-4',
    title: 'Measure What Matters',
    description: 'Track outputs and outcomes with simple performance loops.',
    route: '/learning/tutorials',
  },
];

