import {
  OnGatewayConnection, OnGatewayDisconnect, OnGatewayInit,
  SubscribeMessage, WebSocketGateway, WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { NotificationsService } from './notifications.service';

@WebSocketGateway({ cors: { origin: '*' }, namespace: '/notifications' })
export class NotificationsGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer() server: Server;

  private userSockets = new Map<number, string[]>(); // userId -> socketIds

  constructor(private notificationsService: NotificationsService) {
    notificationsService.setGateway(this);
  }

  afterInit() {
    console.log('WebSocket gateway initialised');
  }

  handleConnection(client: Socket) {
    const userId = Number(client.handshake.query.userId);
    if (userId) {
      const existing = this.userSockets.get(userId) ?? [];
      this.userSockets.set(userId, [...existing, client.id]);
      client.join(`user_${userId}`);
    }
  }

  handleDisconnect(client: Socket) {
    for (const [userId, socketIds] of this.userSockets.entries()) {
      const filtered = socketIds.filter((id) => id !== client.id);
      if (filtered.length) this.userSockets.set(userId, filtered);
      else this.userSockets.delete(userId);
    }
  }

  sendToUser(userId: number, notification: any) {
    this.server.to(`user_${userId}`).emit('notification', notification);
  }

  @SubscribeMessage('ping')
  handlePing(client: Socket) {
    client.emit('pong', { time: new Date().toISOString() });
  }
}
