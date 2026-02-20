import type { ContentSectionValue } from '../constants/states.js';

export interface SectionPageDTO {
  id: string | null;
  section: ContentSectionValue;
  branchId: string | null;
  body: string;
  createdBy: string | null;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface CategoryPageDTO {
  id: string | null;
  categoryId: string;
  branchId: string | null;
  body: string;
  createdBy: string | null;
  createdAt: string | null;
  updatedAt: string | null;
}

export type LandingPageFileType = 'section_page' | 'category_page' | 'subcategory_page';
