export interface Notice {
  id: string;
  title: string;
  subtitle?: string;
  content: string;
  type: 'event' | 'payment' | 'warning' | 'info';
  date: Date;
  expirationDate?: Date | null;
  deleted: boolean;
  createdAt: Date;
  updatedAt: Date;
  createdBy?: string;
}
