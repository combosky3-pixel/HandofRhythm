
export enum GameGenre {
  JAZZ = 'JAZZ',
  ELECTRONIC = 'ELECTRONIC',
  FUNK = 'FUNK',
}

export interface HandCoordinates {
  x: number;
  y: number;
  z?: number;
}

export interface HandState {
  left: HandCoordinates | null;
  right: HandCoordinates | null;
  isLeftPinching: boolean;
  isRightPinching: boolean;
  leftSqueeze: number; // 0.0 (Open) to 1.0 (Fist)
  rightSqueeze: number; // 0.0 (Open) to 1.0 (Fist)
}

export enum AppState {
  IDLE = 'IDLE',
  LOADING = 'LOADING',
  RUNNING = 'RUNNING',
  ERROR = 'ERROR',
}

export interface Particle {
  pos: { x: number; y: number };
  vel: { x: number; y: number };
  acc: { x: number; y: number };
  maxSpeed: number;
  prevPos: { x: number; y: number };
  color: number;
  age: number;
}

export type BeatType = 'SNARE' | 'KICK';
export type NoteType = 'LEAD' | 'RHYTHM' | 'BASS';
export type BeatCallback = (type: BeatType) => void;
export type NoteCallback = (type: NoteType, x: number, y: number) => void;
