export interface Point {
  x: number;
  y: number;
}

export interface StrokeStart {
  id: string;
  color: string;
  width: number;
  tool: 'brush' | 'eraser';
}

export interface Stroke extends StrokeStart {
  points: Point[];
  userId: string;
  seq?: number;
}

export interface User {
  id: string;
  name: string;
  color: string;
}