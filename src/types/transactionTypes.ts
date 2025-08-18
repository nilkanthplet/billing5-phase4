import { Database } from '../lib/supabase';

export type TransactionItem = {
  plate_size: string;
  quantity: number;
  borrowed_stock?: number;
  returned_borrowed_stock?: number;
  notes?: string;
};

export type ChallanItem = Database['public']['Tables']['challan_items']['Row'];
export type ReturnLineItem = Database['public']['Tables']['return_line_items']['Row'];

export type Transaction = {
  type: 'udhar' | 'jama';
  date: string;
  items: TransactionItem[];
  driver_name?: string;
};
