import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { format } from 'date-fns';
import { motion } from 'framer-motion';
import { Download, Search, DollarSign, Calendar, User, Receipt } from 'lucide-react';

interface Bill {
  id: number;
  client_id: string;
  client: {
    name: string;
  };
  period_start: string;
  period_end: string;
  total_amount: number;
  payment_status: 'pending' | 'paid' | 'overdue';
  created_at: string;
}

export function BillManagementPage() {
  const [bills, setBills] = useState<Bill[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchBills();
  }, []);

  const fetchBills = async () => {
    try {
      const { data, error } = await supabase
        .from('bills')
        .select(`
          *,
          client:clients(name)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setBills(data || []);
    } catch (error) {
      console.error('Error fetching bills:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'paid':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'overdue':
        return 'bg-red-100 text-red-800 border-red-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const filteredBills = bills.filter(bill =>
    bill.client.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="min-h-screen pb-20 bg-gradient-to-br from-blue-50 via-indigo-50 to-cyan-50">
      <div className="p-3 space-y-4">
        {/* Header */}
        <div className="pt-2 text-center">
          <div className="inline-flex items-center justify-center w-10 h-10 mb-2 rounded-full shadow-lg bg-gradient-to-r from-blue-600 to-indigo-600">
            <Receipt className="w-5 h-5 text-white" />
          </div>
          <h1 className="mb-1 text-base font-bold text-gray-900">બિલ મેનેજમેન્ટ</h1>
          <p className="text-xs text-blue-600">બિલ અને પેમેન્ટ ટ્રેકિંગ</p>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-blue-400 w-4 h-4" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="ગ્રાહક શોધો..."
            className="w-full pl-10 pr-4 py-2 border-2 border-blue-200 rounded-lg focus:ring-4 focus:ring-blue-100 focus:border-blue-500 text-sm"
          />
        </div>

        {/* Bills List */}
        <div className="space-y-3">
          {loading ? (
            [...Array(3)].map((_, i) => (
              <div key={i} className="animate-pulse">
                <div className="h-32 bg-white border-2 border-blue-100 rounded-xl"></div>
              </div>
            ))
          ) : filteredBills.length === 0 ? (
            <div className="text-center py-8 bg-white border-2 border-blue-100 rounded-xl">
              <Receipt className="w-12 h-12 mx-auto mb-4 text-blue-300" />
              <p className="text-gray-500">કોઈ બિલ મળ્યું નથી</p>
            </div>
          ) : (
            filteredBills.map((bill) => (
              <motion.div
                key={bill.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white rounded-xl shadow-sm border-2 border-blue-100 p-4"
              >
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <h3 className="font-medium text-gray-900">બિલ #{bill.id}</h3>
                    <p className="text-sm text-blue-600">{bill.client.name}</p>
                  </div>
                  <span className={`px-2 py-1 rounded-full text-xs font-medium border ${getStatusColor(bill.payment_status)}`}>
                    {bill.payment_status === 'paid' ? 'ચૂકવેલ' : 
                     bill.payment_status === 'pending' ? 'બાકી' : 'મુદત વીતી'}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-4 mb-4 text-sm">
                  <div>
                    <p className="text-gray-500 flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      સમયગાળો
                    </p>
                    <p className="font-medium">
                      {format(new Date(bill.period_start), 'dd/MM/yyyy')} - {format(new Date(bill.period_end), 'dd/MM/yyyy')}
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-500 flex items-center gap-1">
                      <DollarSign className="w-3 h-3" />
                      રકમ
                    </p>
                    <p className="font-medium">₹{bill.total_amount.toLocaleString('en-IN')}</p>
                  </div>
                </div>

                <div className="flex justify-end">
                  <button className="p-2 text-blue-600 hover:bg-blue-50 rounded-full transition-colors">
                    <Download className="w-4 h-4" />
                  </button>
                </div>
              </motion.div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}