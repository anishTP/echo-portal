import type { NotificationTypeValue, NotificationCategoryValue } from '../constants/states.js';

export interface Notification {
  id: string;
  type: NotificationTypeValue;
  category: NotificationCategoryValue;
  title: string;
  message: string;
  resourceType?: string;
  resourceId?: string;
  actorId?: string;
  actorName?: string;
  isRead: boolean;
  createdAt: string;
  readAt?: string;
}

export interface NotificationPreference {
  category: NotificationCategoryValue;
  enabled: boolean;
}
