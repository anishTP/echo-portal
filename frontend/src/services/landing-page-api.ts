import { api } from './api';
import type { SectionPageDTO, CategoryPageDTO } from '@echo-portal/shared';

export const sectionPageApi = {
  get(section: string, branchId?: string): Promise<SectionPageDTO> {
    const params = branchId ? `?branchId=${encodeURIComponent(branchId)}` : '';
    return api.get<SectionPageDTO>(`/section-pages/${encodeURIComponent(section)}${params}`);
  },

  update(section: string, branchId: string, body: string): Promise<SectionPageDTO> {
    return api.put<SectionPageDTO>(`/section-pages/${encodeURIComponent(section)}`, {
      branchId,
      body,
    });
  },
};

export const categoryPageApi = {
  get(categoryId: string, branchId?: string): Promise<CategoryPageDTO> {
    const params = branchId ? `?branchId=${encodeURIComponent(branchId)}` : '';
    return api.get<CategoryPageDTO>(`/category-pages/${encodeURIComponent(categoryId)}${params}`);
  },

  update(categoryId: string, branchId: string, body: string): Promise<CategoryPageDTO> {
    return api.put<CategoryPageDTO>(`/category-pages/${encodeURIComponent(categoryId)}`, {
      branchId,
      body,
    });
  },
};
