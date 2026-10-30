import { Server, Socket } from 'socket.io';
import type { StrokeStart, Point } from '@drawtogether/shared';
import { getRoom, addUser, removeUser, addStroke, clearRoom } from './rooms';

export function registerHandlers(io: Server) {
  io.on('connection', (socket: Socket) => {
    let currentRoomId: string | null = null;

    socket.on('room:join', ({ roomId, userName }: { roomId: string; userName: string }) => {
      if (currentRoomId) {
        socket.leave(`room:${currentRoomId}`);
        removeUser(currentRoomId, socket.id);
        socket.to(`room:${currentRoomId}`).emit('room:user-left', { userId: socket.id });
      }

      currentRoomId = roomId;
      socket.join(`room:${roomId}`);
      const user = addUser(roomId, socket.id, userName || 'Anonymous');

      const room = getRoom(roomId);
      socket.emit('room:state', {
        roomId,
        strokes: room.strokes,
        users: Array.from(room.users.values()),
        seq: room.seq,
      });

      socket.to(`room:${roomId}`).emit('room:user-joined', { user });
    });

    socket.on('draw:stroke-start', ({ stroke }: { stroke: StrokeStart }) => {
      if (!currentRoomId) return;
      const room = getRoom(currentRoomId);
      room.activeStrokes.set(stroke.id, { ...stroke, points: [], _buffer: [], userId: socket.id } as any);
    });

    socket.on('draw:stroke-point', ({ strokeId, point }: { strokeId: string; point: Point }) => {
      if (!currentRoomId) return;
      const room = getRoom(currentRoomId);
      const active = room.activeStrokes.get(strokeId);
      if (active) active._buffer.push(point);
    });

    socket.on('draw:stroke-end', ({ strokeId }: { strokeId: string }) => {
      if (!currentRoomId) return;
      const room = getRoom(currentRoomId);
      const active = room.activeStrokes.get(strokeId);
      if (!active) return;
      room.activeStrokes.delete(strokeId);

      const stroke = {
        id: active.id,
        color: active.color,
        width: active.width,
        tool: active.tool,
        userId: socket.id,
        points: active._buffer,
      };
      const seq = addStroke(currentRoomId, stroke);
      io.to(`room:${currentRoomId}`).emit('draw:stroke', { stroke, seq });
    });

    socket.on('draw:clear', () => {
      if (!currentRoomId) return;
      const seq = clearRoom(currentRoomId);
      io.to(`room:${currentRoomId}`).emit('draw:cleared', { seq });
    });

    socket.on('disconnect', () => {
      if (!currentRoomId) return;
      removeUser(currentRoomId, socket.id);
      socket.to(`room:${currentRoomId}`).emit('room:user-left', { userId: socket.id });
    });
  });
}