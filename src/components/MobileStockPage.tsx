import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Database } from '../lib/supabase';
import { Package, Edit3 } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';

type Stock = Database['public']['Tables']['stock']['Row'];

interface BorrowedStockData {
  plate_size: string;
  total_borrowed: number;
}

const PLATE_SIZES = [
  '2 X 3',
  '21 X 3', 
  '18 X 3',
  '15 X 3',
  '12 X 3',
  '9 X 3',
  'પતરા',
  '2 X 2',
  '2 ફુટ'
];

export function MobileStockPage() {
  const { user } = useAuth();
  const [stockItems, setStockItems] = useState<Stock[]>([]);
  const [borrowedStockData, setBorrowedStockData] = useState<BorrowedStockData[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStock();
    fetchBorrowedStock();
  }, []);

  const fetchStock = async () => {
    try {
      const { data, error } = await supabase
        .from('stock')
        .select('*')
        .order('plate_size');

      if (error) throw error;
      setStockItems(data || []);
    } catch (error) {
      console.error('Error fetching stock:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchBorrowedStock = async () => {
    try {
      // Get all active borrowed stock
      const { data: borrowedData, error: borrowedError } = await supabase
        .from('challan_items')
        .select(`
          plate_size,
          borrowed_stock,
          challans!inner(status)
        `)
        .eq('challans.status', 'active');

      if (borrowedError) throw borrowedError;

      // Get all returned borrowed stock
      const { data: returnedData, error: returnedError } = await supabase
        .from('return_line_items')
        .select(`
          plate_size,
          returned_borrowed_stock
        `);

      if (returnedError) throw returnedError;

      // Calculate net borrowed stock (borrowed - returned)
      const borrowedMap = (borrowedData || []).reduce((acc, item) => {
        acc[item.plate_size] = (acc[item.plate_size] || 0) + (item.borrowed_stock || 0);
        return acc;
      }, {} as Record<string, number>);

      const returnedMap = (returnedData || []).reduce((acc, item) => {
        acc[item.plate_size] = (acc[item.plate_size] || 0) + (item.returned_borrowed_stock || 0);
        return acc;
      }, {} as Record<string, number>);

      // Calculate final borrowed quantities
      const aggregated = Object.entries(borrowedMap).map(([plate_size, borrowed]) => ({
        plate_size,
        total_borrowed: Math.max(0, borrowed - (returnedMap[plate_size] || 0))
      }));

      setBorrowedStockData(aggregated);
    } catch (error) {
      console.error('Error fetching borrowed stock:', error);
    }
  };

  const handleUpdateStock = async (plateSize: string, values: Partial<Stock>) => {
    try {
      const stockItem = stockItems.find(item => item.plate_size === plateSize);
      if (!stockItem) return;

      const newAvailableQuantity = (values.total_quantity || stockItem.total_quantity) - stockItem.on_rent_quantity;

      const { error } = await supabase
        .from('stock')
        .update({
          total_quantity: values.total_quantity,
          available_quantity: Math.max(0, newAvailableQuantity),
          updated_at: new Date().toISOString()
        })
        .eq('id', stockItem.id);

      if (error) throw error;

      await fetchStock();
      await fetchBorrowedStock();
    } catch (error) {
      console.error('Error updating stock:', error);
      alert('સ્ટોક અપડેટ કરવામાં ભૂલ. કૃપા કરીને ફરી પ્રયત્ન કરો.');
    }
  };

  const stockMap = stockItems.reduce((acc, item) => {
    acc[item.plate_size] = item;
    return acc;
  }, {} as Record<string, Stock>);

  const borrowedStockMap = borrowedStockData.reduce((acc, item) => {
    acc[item.plate_size] = item.total_borrowed;
    return acc;
  }, {} as Record<string, number>);

  const filteredPlateSizes = PLATE_SIZES.filter(size =>
    size.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const calculateTotals = () => {
    const filteredStockItems = filteredPlateSizes
      .map(size => stockMap[size])
      .filter(Boolean);

    const totalBorrowedStock = filteredPlateSizes
      .reduce((sum, size) => sum + (borrowedStockMap[size] || 0), 0);

    return {
      totalStock: filteredStockItems.reduce((sum, item) => sum + (item?.total_quantity || 0), 0),
      totalAvailable: filteredStockItems.reduce((sum, item) => sum + (item?.available_quantity || 0), 0),
      totalOnRent: filteredStockItems.reduce((sum, item) => sum + (item?.on_rent_quantity || 0), 0),
      totalBorrowedStock
    };
  };

  const totals = calculateTotals();

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
        <div className="p-4">
          <div className="h-10 mb-4 rounded bg-slate-200 animate-pulse"></div>
          <div className="h-12 mb-4 rounded bg-slate-200 animate-pulse"></div>
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-16 rounded bg-slate-200 animate-pulse"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-blue-50 to-blue-50">
      <div className="p-4">
        {/* Header */}
        <div className="flex items-center gap-2 p-3 mb-4 bg-white border border-blue-200 rounded-xl">
          <Package className="w-5 h-5 text-blue-600" />
          <h1 className="text-lg font-semibold text-blue-900">સ્ટોક ટેબલ</h1>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div className="p-3 text-center bg-white border border-purple-200 rounded-xl">
            <div className="text-2xl font-bold text-purple-700">{totals.totalStock}</div>
            <div className="text-xs font-medium text-purple-600">કુલ સ્ટોક</div>
          </div>
          <div className="p-3 text-center bg-white border border-emerald-200 rounded-xl">
            <div className="text-2xl font-bold text-emerald-700">{totals.totalAvailable}</div>
            <div className="text-xs font-medium text-emerald-600">ઉપલબ્ધ</div>
          </div>
          <div className="p-3 text-center bg-white border border-blue-200 rounded-xl">
            <div className="text-2xl font-bold text-blue-700">{totals.totalOnRent + totals.totalBorrowedStock}</div>
            <div className="text-xs font-medium text-blue-600">કુલ બહાર</div>
          </div>
          <div className="p-3 text-center bg-white border border-orange-200 rounded-xl">
            <div className="text-2xl font-bold text-orange-700">{totals.totalBorrowedStock}</div>
            <div className="text-xs font-medium text-orange-600">બીજો ડેપો</div>
          </div>
        </div>

        {/* Stock Table */}
        <div className="overflow-hidden bg-white border border-blue-200 rounded-xl">
          <table className="w-full">
            <thead>
              <tr className="text-sm font-medium text-white bg-blue-500">
                <th className="p-2 text-left">સાઇઝ</th>
                <th className="p-2 text-center">કુલ</th>
                <th className="p-2 text-center">ઉપલબ્ધ</th>
                <th className="p-2 text-center">કુલ બહાર</th>
                <th className="p-2 text-center">બીજો ડેપો</th>
                {user?.isAdmin && <th className="w-12 p-2"></th>}
              </tr>
            </thead>
            <tbody>
              {filteredPlateSizes.map((plateSize) => {
                const stock = stockMap[plateSize];
                const borrowed = borrowedStockMap[plateSize] || 0;
                const totalOut = (stock?.on_rent_quantity || 0) + borrowed;
                const isLowStock = (stock?.available_quantity || 0) <= 5;
                
                return (
                  <tr key={plateSize} className="border-b border-blue-100">
                    <td className="p-2 font-semibold text-gray-800">{plateSize}</td>
                    <td className="p-2 text-center">
                      <span className="font-bold text-purple-600">
                        {stock?.total_quantity || 0}
                      </span>
                    </td>
                    <td className="p-2 text-center">
                      <span className={`px-2 py-0.5 rounded-full ${
                        isLowStock ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'
                      }`}>
                        {stock?.available_quantity || 0}
                      </span>
                    </td>
                    <td className="p-2 text-center">
                      <div className="text-blue-600">
                        {totalOut}
                        <div className="text-xs text-gray-500">
                          ({stock?.on_rent_quantity || 0}+{borrowed})
                        </div>
                      </div>
                    </td>
                    <td className="p-2 text-center">
                      <span className="px-2 py-0.5 bg-orange-100 text-orange-700 rounded-full">
                        {borrowed}
                      </span>
                    </td>
                    {user?.isAdmin && (
                      <td className="p-2 text-center">
                        <button 
                          onClick={() => handleUpdateStock(plateSize, { 
                            total_quantity: (stock?.total_quantity || 0) + 1 
                          })}
                          className="p-1 text-blue-600 rounded hover:bg-blue-50"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                      </td>
                    )}
                  </tr>
                );
              })}
              
              {/* Totals Row */}
              <tr className="font-bold border-t-2 border-green-300 bg-green-50">
                <td className="p-2 text-green-800">કુલ</td>
                <td className="p-2 text-center text-purple-700">{totals.totalStock}</td>
                <td className="p-2 text-center">
                  <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded-full">
                    {totals.totalAvailable}
                  </span>
                </td>
                <td className="p-2 text-center">
                  <div className="text-blue-700">
                    {totals.totalOnRent + totals.totalBorrowedStock}
                    <div className="text-xs text-gray-600">
                      ({totals.totalOnRent}+{totals.totalBorrowedStock})
                    </div>
                  </div>
                </td>
                <td className="p-2 text-center">
                  <span className="px-2 py-0.5 bg-orange-100 text-orange-700 rounded-full">
                    {totals.totalBorrowedStock}
                  </span>
                </td>
                {user?.isAdmin && <td className="p-2 text-center">•</td>}
              </tr>
            </tbody>
          </table>
        </div>

        {/* Empty State */}
        {filteredPlateSizes.length === 0 && (
          <div className="p-8 text-center bg-white border border-blue-200 rounded-xl">
            <div className="flex items-center justify-center w-16 h-16 mx-auto mb-4 rounded-full bg-blue-50">
              <Package className="w-8 h-8 text-blue-400" />
            </div>
            <h3 className="mb-2 text-lg font-semibold text-gray-800">
              {searchTerm ? 'કોઈ મેચિંગ પ્લેટ સાઇઝ મળ્યો નથી' : 'કોઈ પ્લેટ સાઇઝ કોન્ફિગર નથી'}
            </h3>
            <p className="text-sm text-gray-600">
              {searchTerm ? 'શોધ શબ્દ બદલીને પ્રયત્ન કરો' : 'નવા પ્લેટ સાઇઝ ઉમેરો'}
            </p>
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="px-4 py-2 mt-4 text-sm font-medium text-white transition-colors bg-blue-500 rounded-lg hover:bg-blue-600"
              >
                શોધ સાફ કરો
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
