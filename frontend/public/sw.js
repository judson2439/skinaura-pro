// Service Worker for SkinAura PRO Push Notifications
// Version 2.0 - Enhanced notification support

const CACHE_NAME = 'skinaura-pro-v2';
const NOTIFICATION_ICONS = {
  default: '/favicon.ico',
  routine: '/favicon.ico',
  streak: '/favicon.ico',
  feedback: '/favicon.ico',
  product: '/favicon.ico',
};

// Install event
self.addEventListener('install', (event) => {
  console.log('Service Worker v2 installing.');
  self.skipWaiting();
});

// Activate event
self.addEventListener('activate', (event) => {
  console.log('Service Worker v2 activating.');
  event.waitUntil(
    Promise.all([
      clients.claim(),
      // Clean up old caches
      caches.keys().then((cacheNames) => {
        return Promise.all(
          cacheNames
            .filter((name) => name !== CACHE_NAME)
            .map((name) => caches.delete(name))
        );
      }),
    ])
  );
});

// Push event - handle incoming push notifications
self.addEventListener('push', (event) => {
  console.log('Push notification received:', event);

  let data = {
    title: 'SkinAura PRO',
    body: 'Time for your skincare routine!',
    icon: NOTIFICATION_ICONS.default,
    badge: NOTIFICATION_ICONS.default,
    tag: 'routine-reminder',
    requireInteraction: false,
    data: {
      url: '/',
      type: 'general',
    },
  };

  if (event.data) {
    try {
      const payload = event.data.json();
      data = { ...data, ...payload };
      
      // Set appropriate icon based on notification type
      if (payload.data?.type) {
        switch (payload.data.type) {
          case 'am_reminder':
          case 'pm_reminder':
            data.icon = NOTIFICATION_ICONS.routine;
            break;
          case 'streak_warning':
            data.icon = NOTIFICATION_ICONS.streak;
            data.requireInteraction = true;
            break;
          case 'feedback':
            data.icon = NOTIFICATION_ICONS.feedback;
            break;
          case 'product_recommendation':
            data.icon = NOTIFICATION_ICONS.product;
            break;
        }
      }
    } catch (e) {
      console.error('Error parsing push data:', e);
      data.body = event.data.text();
    }
  }

  const options = {
    body: data.body,
    icon: data.icon || NOTIFICATION_ICONS.default,
    badge: data.badge || NOTIFICATION_ICONS.default,
    tag: data.tag || 'notification',
    requireInteraction: data.requireInteraction || false,
    data: data.data || {},
    actions: data.actions || getActionsForType(data.data?.type),
    vibrate: getVibrationPattern(data.data?.type),
    silent: false,
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

// Get appropriate actions based on notification type
function getActionsForType(type) {
  switch (type) {
    case 'am_reminder':
    case 'pm_reminder':
      return [
        { action: 'start-routine', title: 'Start Routine' },
        { action: 'snooze', title: 'Snooze 30min' },
      ];
    case 'streak_warning':
      return [
        { action: 'complete-now', title: 'Complete Now' },
        { action: 'dismiss', title: 'Dismiss' },
      ];
    case 'feedback':
      return [
        { action: 'view-feedback', title: 'View Feedback' },
        { action: 'dismiss', title: 'Dismiss' },
      ];
    case 'product_recommendation':
      return [
        { action: 'view-product', title: 'View Product' },
        { action: 'dismiss', title: 'Dismiss' },
      ];
    default:
      return [
        { action: 'open', title: 'Open App' },
        { action: 'dismiss', title: 'Dismiss' },
      ];
  }
}

// Get vibration pattern based on notification type
function getVibrationPattern(type) {
  switch (type) {
    case 'streak_warning':
      return [200, 100, 200, 100, 200]; // Urgent pattern
    case 'am_reminder':
    case 'pm_reminder':
      return [200, 100, 200]; // Standard pattern
    default:
      return [200]; // Simple vibration
  }
}

// Notification click event
self.addEventListener('notificationclick', (event) => {
  console.log('Notification clicked:', event);
  
  event.notification.close();

  const action = event.action;
  const notificationData = event.notification.data || {};
  const notificationType = notificationData.type;

  // Handle dismiss action
  if (action === 'dismiss') {
    return;
  }

  // Handle snooze action
  if (action === 'snooze') {
    // Schedule a new notification in 30 minutes
    event.waitUntil(
      scheduleSnoozeNotification(notificationData, 30)
    );
    return;
  }

  // Determine URL based on action and notification type
  let targetUrl = notificationData.url || '/';
  
  switch (action) {
    case 'start-routine':
    case 'complete-now':
      targetUrl = '/?view=routine';
      break;
    case 'view-feedback':
      targetUrl = '/?view=progress';
      break;
    case 'view-product':
      targetUrl = '/?view=products';
      break;
    case 'open':
    default:
      targetUrl = notificationData.url || '/';
      break;
  }

  // Open or focus the app
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // Check if there's already a window open
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          // Navigate to the target URL if different
          if (targetUrl !== '/') {
            client.navigate(targetUrl);
          }
          return client.focus();
        }
      }
      // If no window is open, open a new one
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});

// Schedule a snooze notification
async function scheduleSnoozeNotification(originalData, minutes) {
  // Note: This is a simplified implementation
  // In production, you'd want to use the Push API or a backend service
  // to schedule the notification server-side
  
  console.log(`Snoozing notification for ${minutes} minutes`);
  
  // For now, we'll just log this - actual snooze would require backend support
  // The backend would need to schedule a new push notification
}

// Notification close event
self.addEventListener('notificationclose', (event) => {
  console.log('Notification closed:', event);
  
  // Track notification dismissal for analytics
  const notificationData = event.notification.data || {};
  
  // You could send this to your analytics service
  console.log('Notification dismissed:', {
    type: notificationData.type,
    tag: event.notification.tag,
    timestamp: new Date().toISOString(),
  });
});

// Background sync for offline support
self.addEventListener('sync', (event) => {
  console.log('Background sync:', event.tag);
  
  if (event.tag === 'sync-routine-completion') {
    event.waitUntil(syncRoutineCompletions());
  }
  
  if (event.tag === 'sync-notification-preferences') {
    event.waitUntil(syncNotificationPreferences());
  }
});

// Sync routine completions when back online
async function syncRoutineCompletions() {
  console.log('Syncing routine completions...');
  // This would sync any offline routine completions
  // Implementation would depend on your offline storage strategy
}

// Sync notification preferences when back online
async function syncNotificationPreferences() {
  console.log('Syncing notification preferences...');
  // This would sync any offline preference changes
}

// Periodic background sync for checking reminders
self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'check-reminders') {
    event.waitUntil(checkReminders());
  }
});

async function checkReminders() {
  console.log('Checking reminders...');
  // This would check if it's time to send a reminder
  // Note: Periodic sync has limited browser support
}

// Message event - handle messages from the main app
self.addEventListener('message', (event) => {
  console.log('Service Worker received message:', event.data);
  
  if (event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  
  if (event.data.type === 'TEST_NOTIFICATION') {
    self.registration.showNotification(event.data.title || 'Test Notification', {
      body: event.data.body || 'This is a test notification from SkinAura PRO',
      icon: NOTIFICATION_ICONS.default,
      badge: NOTIFICATION_ICONS.default,
      tag: 'test-notification',
    });
  }
  
  if (event.data.type === 'GET_SUBSCRIPTION') {
    event.waitUntil(
      self.registration.pushManager.getSubscription().then((subscription) => {
        event.ports[0].postMessage({
          type: 'SUBSCRIPTION',
          subscription: subscription ? subscription.toJSON() : null,
        });
      })
    );
  }
});

// Fetch event - for caching (optional, for PWA support)
self.addEventListener('fetch', (event) => {
  // For now, we'll just pass through all requests
  // You could add caching logic here for offline support
  event.respondWith(fetch(event.request));
});
