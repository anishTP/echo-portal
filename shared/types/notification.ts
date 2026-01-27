import type { NotificationTypeValue } from '../constants/states.js';

export interface Notification {
  id: string;
  type: NotificationTypeValue;
  title: string;
  message: string;
  resourceType?: string;
  resourceId?: string;
  isRead: boolean;
  createdAt: string;
  readAt?: string;
}
