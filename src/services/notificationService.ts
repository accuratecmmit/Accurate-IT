import { parseResponseJson } from '../lib/apiClient';
import { getStoredToken } from './authService';

export interface UserNotification {
  id: string;
  recipientId: string;
  senderId?: string;
  title: string;
  message: string;
  type: 'TICKET_ASSIGNED' | 'TICKET_UPDATED' | 'SLA_BREACH' | 'APPROVAL_REQUIRED' | 'PROFILE_CHANGE_REVIEW' | 'SYSTEM_ALERT';
  referenceEntityType?: string;
  referenceEntityId?: string;
  isRead: boolean;
  createdAt: string;
}

function getAuthHeaders(): Record<string, string> {
  const token = getStoredToken();
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

export async function fetchNotifications(): Promise<{ notifications: UserNotification[]; error?: string }> {
  try {
    const res = await fetch('/api/notifications', {
      headers: getAuthHeaders(),
    });
    const parsed = await parseResponseJson(res);
    const data = parsed.data || {};
    if (!res.ok) {
      return { notifications: [], error: data.error || 'Failed to fetch notifications' };
    }
    return { notifications: data.notifications || [] };
  } catch (err: any) {
    return { notifications: [], error: err.message || 'Network error fetching notifications' };
  }
}

export type StoredNotification = UserNotification;

export const fetchMyNotifications = fetchNotifications;

export async function markNotificationAsRead(id: string): Promise<{ success: boolean; error?: string }> {
  try {
    const res = await fetch(`/api/notifications/${id}/read`, {
      method: 'PATCH',
      headers: getAuthHeaders(),
    });
    const parsed = await parseResponseJson(res);
    const data = parsed.data || {};
    if (!res.ok) {
      return { success: false, error: data.error || 'Failed to mark notification as read' };
    }
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || 'Network error marking notification as read' };
  }
}

export async function markAllNotificationsAsRead(): Promise<{ success: boolean; error?: string }> {
  try {
    const res = await fetch('/api/notifications/read-all', {
      method: 'POST',
      headers: getAuthHeaders(),
    });
    const parsed = await parseResponseJson(res);
    const data = parsed.data || {};
    return { success: res.ok };
  } catch {
    return { success: false };
  }
}
