import { Component, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { NotificationService, Notification } from '../../../core/services/notification.service';
import { Observable } from 'rxjs';

@Component({
  selector: 'app-notification-toast',
  templateUrl: './notification-toast.component.html',
  styleUrls: ['./notification-toast.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class NotificationToastComponent implements OnInit {
  notifications$: Observable<Notification[]>;

  constructor(private notificationService: NotificationService) { }

  ngOnInit(): void {
    this.notifications$ = this.notificationService.notifications$;
  }

  /**
   * Close a notification
   * @param id The notification ID to close
   */
  closeNotification(id: string): void {
    this.notificationService.removeNotification(id);
  }

  /**
   * Get the icon for a notification type
   * @param type The notification type
   * @returns The icon class name
   */
  getIcon(type: string): string {
    switch (type) {
      case 'success': return 'fas fa-check-circle';
      case 'info': return 'fas fa-info-circle';
      case 'warning': return 'fas fa-exclamation-triangle';
      case 'error': return 'fas fa-times-circle';
      default: return 'fas fa-bell';
    }
  }
}