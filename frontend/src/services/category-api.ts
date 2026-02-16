import { api } from './api';

export interface CategoryDTO {
  id: string;
  name: string;
  section: string;
  displayOrder: number;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateCategoryInput {
  name: string;
  section: string;
  displayOrder?: number;
}

export const categoryApi = {
  list(section?: string): Promise<CategoryDTO[]> {
    const params = section ? `?section=${encodeURIComponent(section)}` : '';
    return api.get<CategoryDTO[]>(`/categories${params}`);
  },

  create(input: CreateCategoryInput): Promise<CategoryDTO> {
    return api.post<CategoryDTO>('/categories', input);
  },

  update(id: string, input: { name: string }): Promise<CategoryDTO> {
    return api.patch<CategoryDTO>(`/categories/${id}`, input);
  },

  rename(input: { section: string; oldName: string; newName: string }): Promise<{ section: string; oldName: string; newName: string }> {
    return api.post<{ section: string; oldName: string; newName: string }>('/categories/rename', input);
  },

  reorder(section: string, order: string[]): Promise<void> {
    return api.put<void>('/categories/reorder', { section, order });
  },

  delete(id: string): Promise<void> {
    return api.delete<void>(`/categories/${id}`);
  },
};
