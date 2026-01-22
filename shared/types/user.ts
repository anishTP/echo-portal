import type { AuthProviderType, RoleType } from '../constants/states.js';

export interface User {
  id: string;
  externalId: string;
  provider: AuthProviderType;
  email: string;
  displayName: string;
  avatarUrl?: string;
  roles: RoleType[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  lastLoginAt?: string;
}

export interface UserCreateInput {
  externalId: string;
  provider: AuthProviderType;
  email: string;
  displayName: string;
  avatarUrl?: string;
  roles?: RoleType[];
}

export interface UserUpdateInput {
  displayName?: string;
  avatarUrl?: string;
  roles?: RoleType[];
  isActive?: boolean;
}
