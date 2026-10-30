import type { Stroke, User } from '@drawtogether/shared';

interface RoomState {
  strokes: Stroke[];
  users: Map<string, User>;
  seq: number;
  activeStrokes: Map<string, Stroke & { _buffer: any[] }>;
}

const rooms = new Map<string, RoomState>();

export function getRoom(roomId: string): RoomState {
  let room = rooms.get(roomId);
  if (!room) {
    room = { strokes: [], users: new Map(), seq: 0, activeStrokes: new Map() };
    rooms.set(roomId, room);
  }
  return room;
}

export function addUser(roomId: string, socketId: string, name: string): User {
  const room = getRoom(roomId);
  const colors = ['#f87171', '#fb923c', '#facc15', '#4ade80', '#60a5fa', '#a78bfa'];
  const color = colors[room.users.size % colors.length];
  const user: User = { id: socketId, name, color };
  room.users.set(socketId, user);
  return user;
}

export function removeUser(roomId: string, socketId: string) {
  const room = rooms.get(roomId);
  if (!room) return;
  room.users.delete(socketId);
  if (room.users.size === 0) rooms.delete(roomId);
}

export function addStroke(roomId: string, stroke: Stroke): number {
  const room = getRoom(roomId);
  room.seq += 1;
  room.strokes.push({ ...stroke, seq: room.seq } as any);
  return room.seq;
}

export function clearRoom(roomId: string): number {
  const room = getRoom(roomId);
  room.strokes = [];
  room.seq += 1;
  return room.seq;
}