import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEYS = {
  AI_STACK: 'ai_stack',
  AI_STACK_CATEGORIES: 'ai_stack_categories',
  PROMPTS: 'prompts',
  TOOLS: 'tools',
  TUTORIALS: 'tutorials',
  OPEN_SOURCE: 'open_source',
  LEAD_GENERATION: 'lead_generation',
  BUSINESS: 'business',
  CONTENT_CREATION: 'content_creation',
  WEBSITE: 'website',
  MARKETING: 'marketing',
};

const DEFAULT_AI_STACK_CATEGORIES = [
  'Image Generation',
  'Video Generation',
  'Text Generation',
  'Audio Generation',
  'Code Generation',
  'Data Analysis',
  'Automation',
  'Research',
  'Design',
  'Other',
];

export interface AIStackItem {
  id: string;
  toolName: string;
  url: string;
  categories: string[];
  description?: string;
  images?: string[];
  files?: string[];
  usedFor: string;
  keyFeatures: string;
  pricing: 'free' | 'paid' | 'freemium';
  bestFor: string;
  guides: string;
  instructions: string;
  createdAt: number;
}

export interface PromptItem {
  id: string;
  promptName: string;
  prompt: string;
  inputImage?: string;
  generatedImage?: string;
  aiToolUsed: string;
  category: 'image' | 'video' | 'text' | 'audio' | 'other';
  type: 'general' | 'personal';
  createdAt: number;
}

export interface ToolItem {
  id: string;
  toolName: string;
  link: string;
  description: string;
  instructions: string;
  createdAt: number;
}

export interface TutorialItem {
  id: string;
  tutorialName: string;
  description: string;
  instructions: string;
  videoLink?: string;
  files: string[];
  createdAt: number;
}

export interface OpenSourceItem {
  id: string;
  name: string;
  description: string;
  instructions: string;
  links: { label: string; url: string }[];
  category: string;
  createdAt: number;
}

export interface LeadGenerationItem {
  id: string;
  name: string;
  description: string;
  instructions: string;
  link: string;
  videoLink?: string;
  createdAt: number;
}

export interface BusinessItem {
  id: string;
  sectionName: string;
  name: string;
  description: string;
  link: string;
  instructions: string;
  createdAt: number;
}

export interface ContentCreationItem {
  id: string;
  toolName: string;
  toolLink: string;
  description: string;
  instructions: string;
  videoLink?: string;
  videoFile?: string;
  createdAt: number;
}

export interface WebsiteItem {
  id: string;
  name: string;
  toolLink: string;
  description: string;
  category: string;
  createdAt: number;
}

export interface MarketingItem {
  id: string;
  name: string;
  toolLink: string;
  description: string;
  category: string;
  instructions: string;
  link: string;
  file?: string;
  createdAt: number;
}

const generateId = (): string => {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
};

// Generic CRUD operations
async function getItems<T>(key: string): Promise<T[]> {
  try {
    const data = await AsyncStorage.getItem(key);
    return data ? JSON.parse(data) : [];
  } catch (error) {
    console.error(`Error getting ${key}:`, error);
    return [];
  }
}

async function saveItems<T>(key: string, items: T[]): Promise<void> {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(items));
  } catch (error) {
    console.error(`Error saving ${key}:`, error);
  }
}

async function addItem<T extends { id: string; createdAt: number }>(key: string, item: Omit<T, 'id' | 'createdAt'>): Promise<T> {
  const items = await getItems<T>(key);
  const newItem = { ...item, id: generateId(), createdAt: Date.now() } as T;
  items.unshift(newItem);
  await saveItems(key, items);
  return newItem;
}

async function updateItem<T extends { id: string }>(key: string, id: string, updates: Partial<T>): Promise<void> {
  const items = await getItems<T>(key);
  const index = items.findIndex(item => item.id === id);
  if (index !== -1) {
    items[index] = { ...items[index], ...updates };
    await saveItems(key, items);
  }
}

async function deleteItem<T extends { id: string }>(key: string, id: string): Promise<void> {
  const items = await getItems<T>(key);
  const filtered = items.filter(item => item.id !== id);
  await saveItems(key, filtered);
}

// AI Stack
export const aiStackStorage = {
  getAll: () => getItems<AIStackItem>(STORAGE_KEYS.AI_STACK),
  add: (item: Omit<AIStackItem, 'id' | 'createdAt'>) => addItem<AIStackItem>(STORAGE_KEYS.AI_STACK, item),
  update: (id: string, updates: Partial<AIStackItem>) => updateItem<AIStackItem>(STORAGE_KEYS.AI_STACK, id, updates),
  delete: (id: string) => deleteItem<AIStackItem>(STORAGE_KEYS.AI_STACK, id),
};

export const aiStackCategoryStorage = {
  getAll: async (): Promise<string[]> => {
    const categories = await getItems<string>(STORAGE_KEYS.AI_STACK_CATEGORIES);
    if (categories.length === 0) {
      await saveItems(STORAGE_KEYS.AI_STACK_CATEGORIES, DEFAULT_AI_STACK_CATEGORIES);
      return DEFAULT_AI_STACK_CATEGORIES;
    }
    return categories;
  },
  saveAll: (categories: string[]) => saveItems(STORAGE_KEYS.AI_STACK_CATEGORIES, categories),
};

// Prompts
export const promptsStorage = {
  getAll: () => getItems<PromptItem>(STORAGE_KEYS.PROMPTS),
  add: (item: Omit<PromptItem, 'id' | 'createdAt'>) => addItem<PromptItem>(STORAGE_KEYS.PROMPTS, item),
  update: (id: string, updates: Partial<PromptItem>) => updateItem<PromptItem>(STORAGE_KEYS.PROMPTS, id, updates),
  delete: (id: string) => deleteItem<PromptItem>(STORAGE_KEYS.PROMPTS, id),
};

// Tools
export const toolsStorage = {
  getAll: () => getItems<ToolItem>(STORAGE_KEYS.TOOLS),
  add: (item: Omit<ToolItem, 'id' | 'createdAt'>) => addItem<ToolItem>(STORAGE_KEYS.TOOLS, item),
  update: (id: string, updates: Partial<ToolItem>) => updateItem<ToolItem>(STORAGE_KEYS.TOOLS, id, updates),
  delete: (id: string) => deleteItem<ToolItem>(STORAGE_KEYS.TOOLS, id),
};

// Tutorials
export const tutorialsStorage = {
  getAll: () => getItems<TutorialItem>(STORAGE_KEYS.TUTORIALS),
  add: (item: Omit<TutorialItem, 'id' | 'createdAt'>) => addItem<TutorialItem>(STORAGE_KEYS.TUTORIALS, item),
  update: (id: string, updates: Partial<TutorialItem>) => updateItem<TutorialItem>(STORAGE_KEYS.TUTORIALS, id, updates),
  delete: (id: string) => deleteItem<TutorialItem>(STORAGE_KEYS.TUTORIALS, id),
};

// Open Source
export const openSourceStorage = {
  getAll: () => getItems<OpenSourceItem>(STORAGE_KEYS.OPEN_SOURCE),
  add: (item: Omit<OpenSourceItem, 'id' | 'createdAt'>) => addItem<OpenSourceItem>(STORAGE_KEYS.OPEN_SOURCE, item),
  update: (id: string, updates: Partial<OpenSourceItem>) => updateItem<OpenSourceItem>(STORAGE_KEYS.OPEN_SOURCE, id, updates),
  delete: (id: string) => deleteItem<OpenSourceItem>(STORAGE_KEYS.OPEN_SOURCE, id),
};

// Lead Generation
export const leadGenerationStorage = {
  getAll: () => getItems<LeadGenerationItem>(STORAGE_KEYS.LEAD_GENERATION),
  add: (item: Omit<LeadGenerationItem, 'id' | 'createdAt'>) => addItem<LeadGenerationItem>(STORAGE_KEYS.LEAD_GENERATION, item),
  update: (id: string, updates: Partial<LeadGenerationItem>) => updateItem<LeadGenerationItem>(STORAGE_KEYS.LEAD_GENERATION, id, updates),
  delete: (id: string) => deleteItem<LeadGenerationItem>(STORAGE_KEYS.LEAD_GENERATION, id),
};

// Business
export const businessStorage = {
  getAll: () => getItems<BusinessItem>(STORAGE_KEYS.BUSINESS),
  add: (item: Omit<BusinessItem, 'id' | 'createdAt'>) => addItem<BusinessItem>(STORAGE_KEYS.BUSINESS, item),
  update: (id: string, updates: Partial<BusinessItem>) => updateItem<BusinessItem>(STORAGE_KEYS.BUSINESS, id, updates),
  delete: (id: string) => deleteItem<BusinessItem>(STORAGE_KEYS.BUSINESS, id),
};

// Content Creation
export const contentCreationStorage = {
  getAll: () => getItems<ContentCreationItem>(STORAGE_KEYS.CONTENT_CREATION),
  add: (item: Omit<ContentCreationItem, 'id' | 'createdAt'>) => addItem<ContentCreationItem>(STORAGE_KEYS.CONTENT_CREATION, item),
  update: (id: string, updates: Partial<ContentCreationItem>) => updateItem<ContentCreationItem>(STORAGE_KEYS.CONTENT_CREATION, id, updates),
  delete: (id: string) => deleteItem<ContentCreationItem>(STORAGE_KEYS.CONTENT_CREATION, id),
};

// Website
export const websiteStorage = {
  getAll: () => getItems<WebsiteItem>(STORAGE_KEYS.WEBSITE),
  add: (item: Omit<WebsiteItem, 'id' | 'createdAt'>) => addItem<WebsiteItem>(STORAGE_KEYS.WEBSITE, item),
  update: (id: string, updates: Partial<WebsiteItem>) => updateItem<WebsiteItem>(STORAGE_KEYS.WEBSITE, id, updates),
  delete: (id: string) => deleteItem<WebsiteItem>(STORAGE_KEYS.WEBSITE, id),
};

// Marketing
export const marketingStorage = {
  getAll: () => getItems<MarketingItem>(STORAGE_KEYS.MARKETING),
  add: (item: Omit<MarketingItem, 'id' | 'createdAt'>) => addItem<MarketingItem>(STORAGE_KEYS.MARKETING, item),
  update: (id: string, updates: Partial<MarketingItem>) => updateItem<MarketingItem>(STORAGE_KEYS.MARKETING, id, updates),
  delete: (id: string) => deleteItem<MarketingItem>(STORAGE_KEYS.MARKETING, id),
};
