import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { NotificationsService } from './notifications.service';
import { NotificationsGateway } from './notifications/notifications.gateway';

@Module({
  imports: [JwtModule.register({})],
  providers: [NotificationsService, NotificationsGateway],
  exports: [NotificationsGateway, NotificationsService],
})
export class NotificationsModule {}