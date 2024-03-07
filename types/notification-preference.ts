// Define an interface for NotificationPreference
export interface NotificationPreference {
	email: boolean;
	sms: boolean;
	webPush: boolean;
  }
  
  // Default notification preference structure
  export const DEFAULT_NOTIFICATION_PREFERENCE: NotificationPreference = {
	email: false,
	sms: false,
	webPush: true // Default is web push notifications
  };
  