import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from "@nestjs/websockets";
import { Server, Socket } from "socket.io";
import { queueRoom, SocketEventName } from "@queuehub/shared";

@WebSocketGateway({
  cors: {
    origin: process.env.CORS_ORIGIN?.split(",") ?? "http://localhost:3000",
    credentials: true,
  },
})
export class RealtimeGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  handleConnection() {}

  handleDisconnect() {}

  @SubscribeMessage("joinQueue")
  handleJoinQueue(client: Socket, queueId: string) {
    client.join(queueRoom(queueId));
  }

  @SubscribeMessage("leaveQueue")
  handleLeaveQueue(client: Socket, queueId: string) {
    client.leave(queueRoom(queueId));
  }

  emitToQueue(queueId: string, event: SocketEventName, payload: unknown) {
    this.server.to(queueRoom(queueId)).emit(event, payload);
  }

  emitToUser(userId: string, event: SocketEventName, payload: unknown) {
    this.server.to(`user:${userId}`).emit(event, payload);
  }

  @SubscribeMessage("identify")
  handleIdentify(client: Socket, userId: string) {
    client.join(`user:${userId}`);
  }
}
