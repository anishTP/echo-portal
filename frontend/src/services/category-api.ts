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

  delete(id: string): Promise<void> {
    return api.delete<void>(`/categories/${id}`);
  },
};
