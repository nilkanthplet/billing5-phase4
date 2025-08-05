import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { Database } from '../lib/supabase';
import { 
  Package, 
  Edit3, 
  Save, 
  X, 
  Search, 
  BarChart3, 
  Plus,
  Minus,
  TrendingUp,
  TrendingDown,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  CheckCircle
} from 'lucide-react';
import { T } from '../contexts/LanguageContext';
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

interface StockCardProps {
  plateSize: string;
  stockData: Stock | undefined;
  borrowedStock: number;
  onUpdate: (plateSize: string, values: Partial<Stock>) => Promise<void>;
  isAdmin: boolean;
}

function StockCard({ plateSize, stockData, borrowedStock, onUpdate, isAdmin }: StockCardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [editValues, setEditValues] = useState({
    total_quantity: stockData?.total_quantity || 0
  });
  const [isLoading, setIsLoading] = useState(false);

  const handleSave = async () => {
    setIsLoading(true);
    try {
      await onUpdate(plateSize, { total_quantity: editValues.total_quantity });
      setIsEditing(false);
    } catch (error) {
      console.error('Error updating stock:', error);
      alert('સ્ટોક અપડેટ કરવામાં ભૂલ. કૃપા કરીને ફરી પ્રયત્ન કરો.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancel = () => {
    setEditValues({
      total_quantity: stockData?.total_quantity || 0
    });
    setIsEditing(false);
  };

  const incrementStock = () => {
    setEditValues(prev => ({
      ...prev,
      total_quantity: prev.total_quantity + 1
    }));
  };

  const decrementStock = () => {
    setEditValues(prev => ({
      ...prev,
      total_quantity: Math.max(0, prev.total_quantity - 1)
    }));
  };

  const getAvailabilityStatus = (available: number) => {
    if (available > 20) return { 
      color: 'text-emerald-600', 
      bg: 'bg-emerald-50', 
      border: 'border-emerald-200',
      status: 'સારો',
      icon: CheckCircle
    };
    if (available > 5) return { 
      color: 'text-amber-600', 
      bg: 'bg-amber-50', 
      border: 'border-amber-200',
      status: 'મધ્યમ',
      icon: AlertTriangle
    };
    return { 
      color: 'text-red-600', 
      bg: 'bg-red-50', 
      border: 'border-red-200',
      status: 'ઓછો',
      icon: AlertTriangle
    };
  };

  const totalOnRent = (stockData?.on_rent_quantity || 0) + borrowedStock;
  const availabilityStatus = getAvailabilityStatus(stockData?.available_quantity || 0);
  const StatusIcon = availabilityStatus.icon;

  return (
    <div className="overflow-hidden transition-all duration-300 bg-white border shadow-sm border-slate-200 rounded-2xl hover:shadow-md">
      {/* Main Card Content */}
      <div className="p-4">
        {/* Header Row */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600">
              <span className="text-sm font-bold text-white">{plateSize}</span>
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-800">{plateSize}</h3>
              <p className="text-xs text-slate-500">પ્લેટ સાઇઝ</p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            {isAdmin && (
              <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="flex items-center justify-center w-8 h-8 transition-colors rounded-lg bg-slate-100 hover:bg-slate-200"
              >
                {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>
            )}
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-3 mb-3">
          {/* Total Stock */}
          <div className="p-3 border border-purple-200 rounded-xl bg-gradient-to-br from-purple-50 to-purple-100">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-medium text-purple-600">કુલ સ્ટોક</span>
              <Package className="w-4 h-4 text-purple-500" />
            </div>
            {isEditing ? (
              <div className="flex items-center gap-2">
                <button
                  onClick={decrementStock}
                  className="flex items-center justify-center w-8 h-8 transition-colors bg-white border border-purple-200 rounded-lg hover:bg-purple-50"
                >
                  <Minus className="w-3 h-3 text-purple-600" />
                </button>
                <input
                  type="number"
                  min="0"
                  value={editValues.total_quantity}
                  onChange={(e) => setEditValues(prev => ({
                    ...prev, 
                    total_quantity: parseInt(e.target.value) || 0
                  }))}
                  className="flex-1 px-2 py-1 text-sm font-bold text-center border border-purple-200 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                />
                <button
                  onClick={incrementStock}
                  className="flex items-center justify-center w-8 h-8 transition-colors bg-white border border-purple-200 rounded-lg hover:bg-purple-50"
                >
                  <Plus className="w-3 h-3 text-purple-600" />
                </button>
              </div>
            ) : (
              <span className="text-2xl font-bold text-purple-700">
                {stockData?.total_quantity || 0}
              </span>
            )}
          </div>

          {/* Available Stock */}
          <div className={`p-3 rounded-xl border ${availabilityStatus.bg} ${availabilityStatus.border}`}>
            <div className="flex items-center justify-between mb-1">
              <span className={`text-xs font-medium ${availabilityStatus.color}`}>ઉપલબ્ધ</span>
              <StatusIcon className={`w-4 h-4 ${availabilityStatus.color}`} />
            </div>
            <div className="flex items-center gap-2">
              <span className={`text-2xl font-bold ${availabilityStatus.color}`}>
                {stockData?.available_quantity || 0}
              </span>
              <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${availabilityStatus.bg} ${availabilityStatus.color} border ${availabilityStatus.border}`}>
                {availabilityStatus.status}
              </span>
            </div>
          </div>
        </div>

        {/* Secondary Stats */}
        <div className="grid grid-cols-2 gap-3">
          {/* Total On Rent */}
          <div className="p-3 border border-blue-200 bg-blue-50 rounded-xl">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-medium text-blue-600">કુલ બહાર</span>
              <TrendingUp className="w-4 h-4 text-blue-500" />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-lg font-bold text-blue-700">{totalOnRent}</span>
              <span className="text-xs text-blue-500">
                ({stockData?.on_rent_quantity || 0}+{borrowedStock})
              </span>
            </div>
          </div>

          {/* Borrowed Stock */}
          <div className="p-3 border border-orange-200 bg-orange-50 rounded-xl">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-medium text-orange-600">બીજો ડેપો</span>
              <TrendingDown className="w-4 h-4 text-orange-500" />
            </div>
            <span className="text-lg font-bold text-orange-700">{borrowedStock}</span>
          </div>
        </div>

        {/* Action Buttons */}
        {isAdmin && (
          <div className="mt-4">
            {isEditing ? (
              <div className="flex gap-2">
                <button
                  onClick={handleSave}
                  disabled={isLoading}
                  className="flex items-center justify-center flex-1 gap-2 px-4 py-3 text-sm font-medium text-white transition-colors bg-emerald-500 rounded-xl hover:bg-emerald-600 disabled:opacity-50"
                >
                  {isLoading ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <Save className="w-4 h-4" />
                  )}
                  સેવ કરો
                </button>
                <button
                  onClick={handleCancel}
                  className="flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium transition-colors bg-slate-200 rounded-xl text-slate-700 hover:bg-slate-300"
                >
                  <X className="w-4 h-4" />
                  કેન્સલ
                </button>
              </div>
            ) : (
              <button
                onClick={() => setIsEditing(true)}
                className="flex items-center justify-center w-full gap-2 px-4 py-3 text-sm font-medium text-white transition-colors bg-blue-500 rounded-xl hover:bg-blue-600"
              >
                <Edit3 className="w-4 h-4" />
                એડિટ કરો
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export function MobileStockPage() {
  const { user } = useAuth();
  const [stockItems, setStockItems] = useState<Stock[]>([]);
  const [borrowedStockData, setBorrowedStockData] = useState<BorrowedStockData[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showTotals, setShowTotals] = useState(true);

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
      const { data, error } = await supabase
        .from('challan_items')
        .select(`
          plate_size,
          borrowed_stock,
          challans!inner(status)
        `)
        .eq('challans.status', 'active');

      if (error) throw error;

      const aggregated = (data || []).reduce((acc, item) => {
        const existing = acc.find(a => a.plate_size === item.plate_size);
        if (existing) {
          existing.total_borrowed += item.borrowed_stock || 0;
        } else {
          acc.push({
            plate_size: item.plate_size,
            total_borrowed: item.borrowed_stock || 0
          });
        }
        return acc;
      }, [] as BorrowedStockData[]);

      setBorrowedStockData(aggregated);
    } catch (error) {
      console.error('Error fetching borrowed stock:', error);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await Promise.all([fetchStock(), fetchBorrowedStock()]);
    setRefreshing(false);
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
      <div className="min-h-screen pb-20 bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
        <div className="p-4 space-y-4">
          {/* Header Skeleton */}
          <div className="text-center animate-pulse">
            <div className="w-16 h-16 mx-auto mb-3 rounded-full bg-slate-200"></div>
            <div className="w-32 h-4 mx-auto mb-2 rounded bg-slate-200"></div>
            <div className="w-24 h-3 mx-auto rounded bg-slate-200"></div>
          </div>
          
          {/* Cards Skeleton */}
          {[1, 2, 3].map((i) => (
            <div key={i} className="p-4 bg-white border rounded-2xl border-slate-200 animate-pulse">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-xl bg-slate-200"></div>
                <div className="flex-1">
                  <div className="w-20 h-4 mb-1 rounded bg-slate-200"></div>
                  <div className="w-16 h-3 rounded bg-slate-200"></div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {[1, 2, 3, 4].map((j) => (
                  <div key={j} className="p-3 rounded-xl bg-slate-100">
                    <div className="w-16 h-3 mb-2 rounded bg-slate-200"></div>
                    <div className="w-12 h-6 rounded bg-slate-200"></div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-20 bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      <div className="p-4 space-y-6">
        {/* Enhanced Header */}
        <div className="text-center">
          <div className="relative inline-flex items-center justify-center w-16 h-16 mb-4 rounded-full shadow-lg bg-gradient-to-br from-blue-600 via-indigo-600 to-purple-600">
            <Package className="w-8 h-8 text-white" />
            <div className="absolute flex items-center justify-center w-6 h-6 rounded-full -top-1 -right-1 bg-emerald-500">
              <span className="text-xs font-bold text-white">{filteredPlateSizes.length}</span>
            </div>
          </div>
          <h1 className="mb-2 text-2xl font-bold text-slate-800">સ્ટોક મેનેજમેન્ટ</h1>
          <p className="text-sm text-slate-600">ઇન્વેન્ટરી ટ્રેકિંગ અને મેનેજમેન્ટ</p>
        </div>

        {/* Search and Refresh */}
        <div className="flex gap-3">
          <div className="relative flex-1">
            <Search className="absolute w-5 h-5 transform -translate-y-1/2 left-3 top-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="પ્લેટ સાઇઝ શોધો..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full py-3 pl-10 pr-4 transition-colors border rounded-xl border-slate-200 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white/80 backdrop-blur-sm"
            />
          </div>
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="flex items-center justify-center w-12 h-12 transition-colors bg-white border rounded-xl border-slate-200 hover:bg-slate-50 disabled:opacity-50"
          >
            <RefreshCw className={`w-5 h-5 text-slate-600 ${refreshing ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {/* Totals Summary Card */}
        {showTotals && (
          <div className="overflow-hidden bg-white border shadow-lg border-slate-200 rounded-2xl">
            <div className="p-4 bg-gradient-to-r from-emerald-500 to-teal-600">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <BarChart3 className="w-5 h-5 text-white" />
                  <h2 className="text-lg font-bold text-white">કુલ આંકડા</h2>
                </div>
                <button
                  onClick={() => setShowTotals(!showTotals)}
                  className="p-1 transition-colors rounded-lg hover:bg-white/20"
                >
                  <ChevronUp className="w-5 h-5 text-white" />
                </button>
              </div>
            </div>
            
            <div className="p-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="p-3 text-center border border-purple-200 bg-purple-50 rounded-xl">
                  <div className="text-2xl font-bold text-purple-700">{totals.totalStock}</div>
                  <div className="text-xs font-medium text-purple-600">કુલ સ્ટોક</div>
                </div>
                <div className="p-3 text-center border bg-emerald-50 border-emerald-200 rounded-xl">
                  <div className="text-2xl font-bold text-emerald-700">{totals.totalAvailable}</div>
                  <div className="text-xs font-medium text-emerald-600">ઉપલબ્ધ</div>
                </div>
                <div className="p-3 text-center border border-blue-200 bg-blue-50 rounded-xl">
                  <div className="text-2xl font-bold text-blue-700">{totals.totalOnRent + totals.totalBorrowedStock}</div>
                  <div className="text-xs font-medium text-blue-600">કુલ બહાર</div>
                </div>
                <div className="p-3 text-center border border-orange-200 bg-orange-50 rounded-xl">
                  <div className="text-2xl font-bold text-orange-700">{totals.totalBorrowedStock}</div>
                  <div className="text-xs font-medium text-orange-600">બીજો ડેપો</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Stock Cards */}
        <div className="space-y-4">
          {filteredPlateSizes.map((plateSize) => (
            <StockCard
              key={plateSize}
              plateSize={plateSize}
              stockData={stockMap[plateSize]}
              borrowedStock={borrowedStockMap[plateSize] || 0}
              onUpdate={handleUpdateStock}
              isAdmin={user?.isAdmin || false}
            />
          ))}
        </div>

        {/* Empty State */}
        {filteredPlateSizes.length === 0 && (
          <div className="p-8 text-center bg-white border shadow-lg border-slate-200 rounded-2xl">
            <div className="flex items-center justify-center w-16 h-16 mx-auto mb-4 rounded-full bg-slate-100">
              <Package className="w-8 h-8 text-slate-400" />
            </div>
            <h3 className="mb-2 text-lg font-semibold text-slate-800">
              {searchTerm ? 'કોઈ મેચિંગ પ્લેટ સાઇઝ મળ્યો નથી' : 'કોઈ પ્લેટ સાઇઝ કોન્ફિગર નથી'}
            </h3>
            <p className="text-sm text-slate-600">
              {searchTerm ? 'શોધ શબ્દ બદલીને પ્રયત્ન કરો' : 'નવા પ્લેટ સાઇઝ ઉમેરો'}
            </p>
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="px-4 py-2 mt-4 text-sm font-medium text-white transition-colors bg-blue-500 rounded-xl hover:bg-blue-600"
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
