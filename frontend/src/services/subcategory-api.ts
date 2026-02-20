import { api } from './api';

export interface SubcategoryDTO {
  id: string;
  name: string;
  categoryId: string;
  displayOrder: number;
  body: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateSubcategoryInput {
  name: string;
  categoryId: string;
  branchId: string;
}

export interface RenameSubcategoryInput {
  name: string;
  branchId: string;
}

export interface ReorderItem {
  type: 'subcategory' | 'content';
  id: string;
}

export interface ReorderInput {
  categoryId: string;
  branchId: string;
  order: ReorderItem[];
}

export interface MoveContentInput {
  branchId: string;
  subcategoryId: string | null;
  displayOrder: number;
}

export const subcategoryApi = {
  list(categoryId: string): Promise<SubcategoryDTO[]> {
    return api.get<SubcategoryDTO[]>(`/subcategories?categoryId=${encodeURIComponent(categoryId)}`);
  },

  create(input: CreateSubcategoryInput): Promise<SubcategoryDTO> {
    return api.post<SubcategoryDTO>('/subcategories', input);
  },

  rename(id: string, input: RenameSubcategoryInput): Promise<SubcategoryDTO> {
    return api.patch<SubcategoryDTO>(`/subcategories/${id}`, input);
  },

  delete(id: string, branchId: string): Promise<{ deletedSubcategory: string; deletedContentCount: number }> {
    return api.delete<{ deletedSubcategory: string; deletedContentCount: number }>(
      `/subcategories/${id}?branchId=${encodeURIComponent(branchId)}`
    );
  },

  reorder(input: ReorderInput): Promise<{ updated: number }> {
    return api.put<{ updated: number }>('/subcategories/reorder', input);
  },

  moveContent(contentId: string, input: MoveContentInput): Promise<unknown> {
    return api.patch(`/contents/${contentId}/move`, input);
  },
};
