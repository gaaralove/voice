
export interface OrderRecord {
  id: string;
  restaurant: string;
  items: string[];
  total: number;
  platform: 'Meituan' | 'Eleme';
  date: string;
}

export interface UserProfile {
  name: string;
  preferredTaste: string[];
  commonAddresses: string[];
}

export interface AppSettings {
  modelName: string;
  systemInstruction: string;
}

export enum AppStep {
  IDLE = 'IDLE',
  RECORDING = 'RECORDING',
  PROCESSING = 'PROCESSING',
  CONFIRMING = 'CONFIRMING',
  ORDER_PLACED = 'ORDER_PLACED'
}
