
export enum DeskStatus {
  Available = 'Available',
  Occupied = 'Occupied',
  Reserved = 'Reserved',
}

export interface Desk {
  id: string;
  status: DeskStatus;
  temperature: number; // in Celsius
  noiseLevel: number; // in dB
  isBeaconOn: boolean;
  isLocked: boolean;
  location: {
    row: number;
    col: number;
  };
}

export interface User {
  id: string;
  name: string;
  team: string;
}

export interface Booking {
  id: string;
  deskId: string;
  userId: string;
  startTime: Date;
  endTime: Date;
}
