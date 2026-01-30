import { Injectable } from '@nestjs/common';
import { NotificationDto } from './dto/notification.dto';

@Injectable()
export class NotificationsService {
  private notifications: Map<string, NotificationDto[]> = new Map();

  addNotification(notification: NotificationDto): void {
    const userNotifications = this.notifications.get(notification.userId) || [];
    userNotifications.push(notification);
    this.notifications.set(notification.userId, userNotifications);
  }

  getUserNotifications(userId: string): NotificationDto[] {
    return this.notifications.get(userId) || [];
  }

  clearUserNotifications(userId: string): void {
    this.notifications.delete(userId);
  }
}