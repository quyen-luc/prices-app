import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

export interface Notification {
  id: string;
  type: 'success' | 'info' | 'warning' | 'error';
  title: string;
  message: string;
  duration?: number;
}

@Injectable({
  providedIn: 'root'
})
export class NotificationService {
  private _notifications = new BehaviorSubject<Notification[]>([]);
  public readonly notifications$: Observable<Notification[]> = this._notifications.asObservable();

  constructor() {}

  /**
   * Show a success notification
   * @param title The title of the notification
   * @param message Optional message details
   * @param duration Optional duration in ms (default: 5000)
   */
  showSuccess(title: string, message: string = '', duration: number = 5000): void {
    this.addNotification({
      id: this.generateId(),
      type: 'success',
      title,
      message,
      duration
    });
  }

  /**
   * Show an info notification
   * @param title The title of the notification
   * @param message Optional message details
   * @param duration Optional duration in ms (default: 5000)
   */
  showInfo(title: string, message: string = '', duration: number = 5000): void {
    this.addNotification({
      id: this.generateId(),
      type: 'info',
      title,
      message,
      duration
    });
  }

  /**
   * Show a warning notification
   * @param title The title of the notification
   * @param message Optional message details
   * @param duration Optional duration in ms (default: 5000)
   */
  showWarning(title: string, message: string = '', duration: number = 5000): void {
    this.addNotification({
      id: this.generateId(),
      type: 'warning',
      title,
      message,
      duration
    });
  }

  /**
   * Show an error notification
   * @param title The title of the notification
   * @param message Optional message details
   * @param duration Optional duration in ms (default: 8000)
   */
  showError(title: string, message: string = '', duration: number = 8000): void {
    this.addNotification({
      id: this.generateId(),
      type: 'error',
      title,
      message,
      duration
    });
  }

  /**
   * Remove a notification by ID
   * @param id The notification ID to remove
   */
  removeNotification(id: string): void {
    const currentNotifications = this._notifications.value;
    this._notifications.next(currentNotifications.filter(n => n.id !== id));
  }

  /**
   * Add a notification to the stack
   * @param notification The notification to add
   */
  private addNotification(notification: Notification): void {
    const currentNotifications = this._notifications.value;
    this._notifications.next([...currentNotifications, notification]);

    // Auto-remove after duration if specified
    if (notification.duration) {
      setTimeout(() => {
        this.removeNotification(notification.id);
      }, notification.duration);
    }
  }

  /**
   * Generate a unique ID for notifications
   */
  private generateId(): string {
    return `notification-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  }
}