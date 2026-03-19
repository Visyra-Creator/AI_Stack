export const addContentCategories = [
  'AI & Tools',
  'Prompts & Knowledge',
  'Learning',
  'Business & Growth',
  'Content Creation',
] as const;

export type AddContentCategory = (typeof addContentCategories)[number];

export interface AddContentMeta {
  categories?: string[];
  subcategory: string;
  subcategories?: string[];
  externalLink?: string;
  fileName?: string;
  fileUri?: string;
  fileMimeType?: string;
  imageUri?: string;
}

export const categorySubcategoryOptions: Record<AddContentCategory, string[]> = {
  'AI & Tools': ['Tool Reviews', 'Automation', 'Integrations'],
  'Prompts & Knowledge': ['Prompt Library', 'Templates', 'Knowledge Notes'],
  Learning: ['Tutorials', 'Guides'],
  'Business & Growth': ['Marketing', 'Lead Generation', 'Sales'],
  'Content Creation': ['Photography', 'Video', 'Design'],
};

export function isAddContentCategory(value: string): value is AddContentCategory {
  return addContentCategories.includes(value as AddContentCategory);
}

export function serializeAddContentMeta(meta: AddContentMeta): string | null {
  const compactMeta = Object.fromEntries(
    Object.entries(meta).filter(([, val]) => {
      if (Array.isArray(val)) {
        return val.length > 0;
      }
      return Boolean(val);
    })
  ) as AddContentMeta;

  if (
    !compactMeta.subcategory &&
    (!compactMeta.subcategories || compactMeta.subcategories.length === 0) &&
    !compactMeta.externalLink &&
    !compactMeta.fileUri &&
    !compactMeta.imageUri &&
    (!compactMeta.categories || compactMeta.categories.length === 0)
  ) {
    return null;
  }

  return JSON.stringify(compactMeta);
}

export function parseAddContentMeta(notes?: string | null): AddContentMeta | null {
  if (!notes) {
    return null;
  }

  try {
    const parsed = JSON.parse(notes) as AddContentMeta;
    if (typeof parsed !== 'object' || parsed === null) {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

