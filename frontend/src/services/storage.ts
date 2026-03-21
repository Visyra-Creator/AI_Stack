import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEYS = {
  AI_STACK: 'ai_stack',
  AI_STACK_CATEGORIES: 'ai_stack_categories',
  PROMPTS: 'prompts',
  PROMPT_CATEGORIES: 'prompt_categories',
  TOOLS: 'tools',
  TUTORIALS: 'tutorials',
  OPEN_SOURCE: 'open_source',
  OPEN_SOURCE_CATEGORIES: 'open_source_categories',
  LEAD_GENERATION: 'lead_generation',
  LEAD_GENERATION_CATEGORIES: 'lead_generation_categories',
  BUSINESS: 'business',
  BUSINESS_CATEGORIES: 'business_categories',
  CONTENT_CREATION: 'content_creation',
  CONTENT_CREATION_CATEGORIES: 'content_creation_categories',
  WEBSITE: 'website',
  REFERENCE: 'reference',
  MARKETING: 'marketing',
  MARKETING_CATEGORIES: 'marketing_categories',
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

const DEFAULT_PROMPT_CATEGORIES = ['image', 'video', 'text', 'audio', 'other'];

const DEFAULT_OPEN_SOURCE_CATEGORIES = [
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

const DEFAULT_LEAD_GENERATION_CATEGORIES = [
  'LinkedIn',
  'Email',
  'Cold Calling',
  'SEO',
  'PPC',
  'Social Media',
  'Content Marketing',
  'Affiliate',
  'Other',
];

const DEFAULT_MARKETING_CATEGORIES = [
  'Social Media',
  'Email Marketing',
  'SEO',
  'Content Marketing',
  'Paid Ads',
  'Analytics',
  'Automation',
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
  isFavorite?: boolean;
  createdAt: number;
  updatedAt?: number;
  favoritedAt?: number;
}

export interface PromptItem {
  id: string;
  promptName: string;
  description?: string;
  prompt: string;
  inputImage?: string;
  generatedImage?: string;
  aiToolUsed: string;
  category: string;
  type: 'general' | 'personal';
  isFavorite?: boolean;
  createdAt: number;
  updatedAt?: number;
  favoritedAt?: number;
}

export interface ToolItem {
  id: string;
  toolName: string;
  link: string;
  description: string;
  instructions: string;
  image?: string;
  isFavorite?: boolean;
  createdAt: number;
  updatedAt?: number;
  favoritedAt?: number;
}

export interface TutorialItem {
  id: string;
  tutorialName: string;
  description: string;
  instructions: string;
  videoLink?: string;
  files: string[];
  isFavorite?: boolean;
  createdAt: number;
  updatedAt?: number;
  favoritedAt?: number;
}

export interface OpenSourceItem {
  id: string;
  name: string;
  description: string;
  instructions: string;
  links: { label: string; url: string }[];
  category: string;
  images?: string[];
  files?: string[];
  isFavorite?: boolean;
  createdAt: number;
  updatedAt?: number;
  favoritedAt?: number;
}

export interface LeadGenerationItem {
  id: string;
  name: string;
  description: string;
  instructions: string;
  link: string;
  videoLink?: string;
  category: string;
  isFavorite?: boolean;
  images?: string[];
  files?: string[];
  createdAt: number;
  updatedAt?: number;
  favoritedAt?: number;
}

export interface BusinessItem {
  id: string;
  sectionName: string;
  name: string;
  description: string;
  link: string;
  instructions: string;
  categories?: string[];
  images?: string[];
  files?: string[];
  isFavorite?: boolean;
  createdAt: number;
  updatedAt?: number;
  favoritedAt?: number;
}

export interface ContentCreationItem {
  id: string;
  toolName: string;
  toolLink: string;
  description: string;
  instructions: string;
  videoLink?: string;
  videoFile?: string;
  images?: string[];
  files?: string[];
  categories?: string[];
  isFavorite?: boolean;
  createdAt: number;
  updatedAt?: number;
  favoritedAt?: number;
}

export interface WebsiteItem {
  id: string;
  name: string;
  toolLink: string;
  description: string;
  category: string;
  isFavorite?: boolean;
  createdAt: number;
  updatedAt?: number;
  favoritedAt?: number;
}

export interface ReferenceItem {
  id: string;
  name: string;
  link: string;
  description: string;
  isFavorite?: boolean;
  createdAt: number;
  updatedAt?: number;
  favoritedAt?: number;
}

export interface MarketingItem {
  id: string;
  name: string;
  toolLink: string;
  description: string;
  category: string;
  instructions: string;
  link: string;
  isFavorite?: boolean;
  image?: string;
  file?: string;
  createdAt: number;
  updatedAt?: number;
  favoritedAt?: number;
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
  const now = Date.now();
  const newItem = { 
    ...item, 
    id: generateId(), 
    createdAt: now,
    updatedAt: now,
    ...((item as any).isFavorite ? { favoritedAt: now } : {})
  } as unknown as T;
  items.unshift(newItem);
  await saveItems(key, items);
  return newItem;
}

async function updateItem<T extends { id: string }>(key: string, id: string, updates: Partial<T>): Promise<void> {
  const items = await getItems<T>(key);
  const index = items.findIndex(item => item.id === id);
  if (index !== -1) {
    const finalUpdates: any = { ...updates };
    if ('isFavorite' in finalUpdates) {
      if (finalUpdates.isFavorite) {
        finalUpdates.favoritedAt = Date.now();
      } else {
        delete finalUpdates.favoritedAt;
      }
    }
    finalUpdates.updatedAt = Date.now();
    items[index] = { ...items[index], ...finalUpdates };
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

export const promptsCategoryStorage = {
  getAll: async (): Promise<string[]> => {
    const categories = await getItems<string>(STORAGE_KEYS.PROMPT_CATEGORIES);
    if (categories.length === 0) {
      await saveItems(STORAGE_KEYS.PROMPT_CATEGORIES, DEFAULT_PROMPT_CATEGORIES);
      return DEFAULT_PROMPT_CATEGORIES;
    }
    return categories;
  },
  saveAll: (categories: string[]) => saveItems(STORAGE_KEYS.PROMPT_CATEGORIES, categories),
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

export const openSourceCategoryStorage = {
  getAll: async (): Promise<string[]> => {
    const categories = await getItems<string>(STORAGE_KEYS.OPEN_SOURCE_CATEGORIES);
    if (categories.length === 0) {
      await saveItems(STORAGE_KEYS.OPEN_SOURCE_CATEGORIES, DEFAULT_OPEN_SOURCE_CATEGORIES);
      return DEFAULT_OPEN_SOURCE_CATEGORIES;
    }
    return categories;
  },
  saveAll: (categories: string[]) => saveItems(STORAGE_KEYS.OPEN_SOURCE_CATEGORIES, categories),
};

// Lead Generation
export const leadGenerationStorage = {
  getAll: () => getItems<LeadGenerationItem>(STORAGE_KEYS.LEAD_GENERATION),
  add: (item: Omit<LeadGenerationItem, 'id' | 'createdAt'>) => addItem<LeadGenerationItem>(STORAGE_KEYS.LEAD_GENERATION, item),
  update: (id: string, updates: Partial<LeadGenerationItem>) => updateItem<LeadGenerationItem>(STORAGE_KEYS.LEAD_GENERATION, id, updates),
  delete: (id: string) => deleteItem<LeadGenerationItem>(STORAGE_KEYS.LEAD_GENERATION, id),
};

export const leadGenerationCategoryStorage = {
  getAll: async (): Promise<string[]> => {
    const categories = await getItems<string>(STORAGE_KEYS.LEAD_GENERATION_CATEGORIES);
    if (categories.length === 0) {
      await saveItems(STORAGE_KEYS.LEAD_GENERATION_CATEGORIES, DEFAULT_LEAD_GENERATION_CATEGORIES);
      return DEFAULT_LEAD_GENERATION_CATEGORIES;
    }
    return categories;
  },
  saveAll: (categories: string[]) => saveItems(STORAGE_KEYS.LEAD_GENERATION_CATEGORIES, categories),
};

// Business
export const businessStorage = {
  getAll: () => getItems<BusinessItem>(STORAGE_KEYS.BUSINESS),
  add: (item: Omit<BusinessItem, 'id' | 'createdAt'>) => addItem<BusinessItem>(STORAGE_KEYS.BUSINESS, item),
  update: (id: string, updates: Partial<BusinessItem>) => updateItem<BusinessItem>(STORAGE_KEYS.BUSINESS, id, updates),
  delete: (id: string) => deleteItem<BusinessItem>(STORAGE_KEYS.BUSINESS, id),
};

export const businessCategoryStorage = {
  getAll: async (): Promise<string[]> => {
    const categories = await getItems<string>(STORAGE_KEYS.BUSINESS_CATEGORIES);
    if (categories.length === 0) {
      await saveItems(STORAGE_KEYS.BUSINESS_CATEGORIES, ['General', 'Marketing', 'Finance', 'Operations', 'Sales', 'HR', 'IT', 'Other']);
      return ['General', 'Marketing', 'Finance', 'Operations', 'Sales', 'HR', 'IT', 'Other'];
    }
    return categories;
  },
  saveAll: (categories: string[]) => saveItems(STORAGE_KEYS.BUSINESS_CATEGORIES, categories),
};

// Content Creation
export const contentCreationStorage = {
  getAll: () => getItems<ContentCreationItem>(STORAGE_KEYS.CONTENT_CREATION),
  add: (item: Omit<ContentCreationItem, 'id' | 'createdAt'>) => addItem<ContentCreationItem>(STORAGE_KEYS.CONTENT_CREATION, item),
  update: (id: string, updates: Partial<ContentCreationItem>) => updateItem<ContentCreationItem>(STORAGE_KEYS.CONTENT_CREATION, id, updates),
  delete: (id: string) => deleteItem<ContentCreationItem>(STORAGE_KEYS.CONTENT_CREATION, id),
};

export const contentCreationCategoryStorage = {
  getAll: async (): Promise<string[]> => {
    const categories = await getItems<string>(STORAGE_KEYS.CONTENT_CREATION_CATEGORIES);
    if (categories.length === 0) {
      const defaultCategories = ['Video Editing', 'Graphic Design', 'Writing', 'Audio Editing', 'Social Media', 'Other'];
      await saveItems(STORAGE_KEYS.CONTENT_CREATION_CATEGORIES, defaultCategories);
      return defaultCategories;
    }
    return categories;
  },
  saveAll: (categories: string[]) => saveItems(STORAGE_KEYS.CONTENT_CREATION_CATEGORIES, categories),
};

// Website
export const websiteStorage = {
  getAll: () => getItems<WebsiteItem>(STORAGE_KEYS.WEBSITE),
  add: (item: Omit<WebsiteItem, 'id' | 'createdAt'>) => addItem<WebsiteItem>(STORAGE_KEYS.WEBSITE, item),
  update: (id: string, updates: Partial<WebsiteItem>) => updateItem<WebsiteItem>(STORAGE_KEYS.WEBSITE, id, updates),
  delete: (id: string) => deleteItem<WebsiteItem>(STORAGE_KEYS.WEBSITE, id),
};

export const websiteCategoryStorage = {
  getAll: async (): Promise<string[]> => {
    const categories = await getItems<string>(STORAGE_KEYS.WEBSITE + '_CATEGORIES');
    if (categories.length === 0) {
      const defaultCategories = ['AI Tool', 'Productivity', 'Design', 'Development', 'Marketing', 'Social Media', 'Analytics', 'Communication', 'Finance', 'Other'];
      await saveItems(STORAGE_KEYS.WEBSITE + '_CATEGORIES', defaultCategories);
      return defaultCategories;
    }
    return categories;
  },
  saveAll: (categories: string[]) => saveItems(STORAGE_KEYS.WEBSITE + '_CATEGORIES', categories),
};

// Marketing
export const marketingStorage = {
  getAll: () => getItems<MarketingItem>(STORAGE_KEYS.MARKETING),
  add: (item: Omit<MarketingItem, 'id' | 'createdAt'>) => addItem<MarketingItem>(STORAGE_KEYS.MARKETING, item),
  update: (id: string, updates: Partial<MarketingItem>) => updateItem<MarketingItem>(STORAGE_KEYS.MARKETING, id, updates),
  delete: (id: string) => deleteItem<MarketingItem>(STORAGE_KEYS.MARKETING, id),
};

export const referenceStorage = {
  getAll: () => getItems<ReferenceItem>(STORAGE_KEYS.REFERENCE),
  add: (item: Omit<ReferenceItem, 'id' | 'createdAt'>) => addItem<ReferenceItem>(STORAGE_KEYS.REFERENCE, item),
  update: (id: string, updates: Partial<ReferenceItem>) => updateItem<ReferenceItem>(STORAGE_KEYS.REFERENCE, id, updates),
  delete: (id: string) => deleteItem<ReferenceItem>(STORAGE_KEYS.REFERENCE, id),
};

export const marketingCategoryStorage = {
  getAll: async (): Promise<string[]> => {
    const categories = await getItems<string>(STORAGE_KEYS.MARKETING_CATEGORIES);
    if (categories.length === 0) {
      await saveItems(STORAGE_KEYS.MARKETING_CATEGORIES, DEFAULT_MARKETING_CATEGORIES);
      return DEFAULT_MARKETING_CATEGORIES;
    }
    return categories;
  },
  saveAll: (categories: string[]) => saveItems(STORAGE_KEYS.MARKETING_CATEGORIES, categories),
};

