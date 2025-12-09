/**
 * Browser Notifications Utility
 * Handles requesting permission and showing notifications
 */

export type NotificationPermissionStatus = 'granted' | 'denied' | 'default';

/**
 * Request notification permission from the user
 * @returns Promise<NotificationPermissionStatus>
 */
export async function requestNotificationPermission(): Promise<NotificationPermissionStatus> {
    if (!('Notification' in window)) {
        console.warn('This browser does not support notifications');
        return 'denied';
    }

    if (Notification.permission === 'granted') {
        return 'granted';
    }

    if (Notification.permission === 'denied') {
        return 'denied';
    }

    try {
        const permission = await Notification.requestPermission();
        return permission as NotificationPermissionStatus;
    } catch (error) {
        console.error('Error requesting notification permission:', error);
        return 'denied';
    }
}

/**
 * Show a browser notification
 * @param title - Notification title
 * @param options - Notification options (body, icon, badge, etc.)
 */
export function showNotification(
    title: string,
    options?: NotificationOptions
): Notification | null {
    if (!('Notification' in window)) {
        console.warn('This browser does not support notifications');
        return null;
    }

    if (Notification.permission !== 'granted') {
        console.warn('Notification permission not granted');
        return null;
    }

    try {
        const notification = new Notification(title, {
            icon: '/cafe-icon.png',
            badge: '/cafe-badge.png',
            ...options,
        });

        // Auto-close after 5 seconds
        setTimeout(() => notification.close(), 5000);

        return notification;
    } catch (error) {
        console.error('Error showing notification:', error);
        return null;
    }
}

/**
 * Check if notifications are supported and permitted
 */
export function canShowNotifications(): boolean {
    return 'Notification' in window && Notification.permission === 'granted';
}

/**
 * Get current notification permission status
 */
export function getNotificationPermission(): NotificationPermissionStatus {
    if (!('Notification' in window)) {
        return 'denied';
    }
    return Notification.permission as NotificationPermissionStatus;
}
