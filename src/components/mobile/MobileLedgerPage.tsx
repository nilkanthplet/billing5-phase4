// MobileLedgerPage.tsx - Optimized with One-Line Search, Filters, and Sorting
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { Database } from '../../lib/supabase';
import { 
  Search, 
  User, 
  Package, 
  ChevronDown,
  ChevronUp,
  Download,
  FileDown,
  Phone,
  MapPin,
  BookOpen,
  FileImage,
  Filter,
  Calendar,
  X
} from 'lucide-react';
import { T } from '../../contexts/LanguageContext';
import { PrintableChallan } from '../challans/PrintableChallan';
import { generateJPGChallan, downloadJPGChallan } from '../../utils/jpgChallanGenerator';
import { ChallanData } from '../challans/types';
import { generateClientLedgerJPG, downloadClientLedgerJPG, ClientLedgerData } from '../../utils/clientLedgerGenerator';

// Types
type Client = Database['public']['Tables']['clients']['Row'];
type Challan = Database['public']['Tables']['challans']['Row'];
type ChallanItem = Database['public']['Tables']['challan_items']['Row'];
type Return = Database['public']['Tables']['returns']['Row'];
type ReturnLineItem = Database['public']['Tables']['return_line_items']['Row'];

interface BorrowedStockBalance {
  plate_size: string;
  issued: number;
  returned: number;
  outstanding: number;
}

interface PlateBalance {
  plate_size: string;
  total_borrowed: number;
  total_returned: number;
  outstanding: number;
}

interface ClientLedger {
  client: Client;
  plate_balances: PlateBalance[];
  borrowed_stock_balances: BorrowedStockBalance[];
  total_outstanding: number;
  borrowed_outstanding: number;
  has_activity: boolean;
  all_transactions: Array<{
    type: 'udhar' | 'jama';
    id: number;
    number: string;
    date: string;
    client_id: string;
    items: Array<{
      plate_size: string;
      quantity: number;
      borrowed_stock?: number;
      returned_borrowed_stock?: number;
      notes?: string;
    }>;
    driver_name?: string;
  }>;
}

// Filter interface with sorting
interface FilterState {
  status: 'all' | 'active' | 'completed' | 'outstanding';
  dateRange: 'all' | 'last7days' | 'last30days' | 'last3months';
  plateSize: string;
  minOutstanding: number;
  sortBy: 'clientIdAsc' | 'clientIdDesc' | 'clientNameAsc' | 'clientNameDesc';
}

// Constants
const PLATE_SIZES = [
  '2 X 3', '21 X 3', '18 X 3', '15 X 3', '12 X 3',
  '9 X 3', 'પતરા', '2 X 2', '2 ફુટ'
];

const FILTER_OPTIONS = {
  status: [
    { value: 'all', label: 'બધા ગ્રાહકો' },
    { value: 'active', label: 'સક્રિય ગ્રાહકો' },
    { value: 'completed', label: 'પૂર્ણ ખાતા' },
    { value: 'outstanding', label: 'બાકી ખાતા' }
  ],
  dateRange: [
    { value: 'all', label: 'બધા સમય' },
    { value: 'last7days', label: 'છેલ્લા 7 દિવસ' },
    { value: 'last30days', label: 'છેલ્લા 30 દિવસ' },
    { value: 'last3months', label: 'છેલ્લા 3 મહિના' }
  ]
};

const SORT_OPTIONS = [
  { value: 'clientIdAsc', label: 'ક્લાયન્ટ ID (વધતા ક્રમમાં)' },
  { value: 'clientIdDesc', label: 'ક્લાયન્ટ ID (ઘટતા ક્રમમાં)' },
  { value: 'clientNameAsc', label: 'નામ (અ થી હ)' },
  { value: 'clientNameDesc', label: 'નામ (હ થી અ)' }
];

// Optimized CSV Export Function
const exportDetailedCSV = (clientLedgers: ClientLedger[]) => {
  try {
    const csvRows: string[] = [];
    const BOM = '\uFEFF';
    
    // Header
    csvRows.push('Client Name,Client ID,Site,Mobile,Total Outstanding,Regular Outstanding,Borrowed Outstanding,Total Transactions,Last Activity,Has Activity');
    
    // Process each client
    clientLedgers.forEach((ledger) => {
      const borrowedStockBalance = ledger.all_transactions.reduce((bSum, t) => {
        if (t.type === 'udhar') {
          return bSum + t.items.reduce((itemSum, item) => itemSum + (item.borrowed_stock || 0), 0);
        } else {
          return bSum - t.items.reduce((itemSum, item) => itemSum + (item.returned_borrowed_stock || 0), 0);
        }
      }, 0);

      const totalOutstanding = ledger.total_outstanding + borrowedStockBalance;
      const lastActivity = ledger.all_transactions.length > 0 
        ? new Date(ledger.all_transactions[0].date).toLocaleDateString('en-GB')
        : 'Never';

      const cleanText = (text: string | null | undefined) => {
        if (!text) return 'N/A';
        return String(text).replace(/"/g, '""');
      };

      csvRows.push([
        `"${cleanText(ledger.client.name)}"`,
        `"${cleanText(ledger.client.id)}"`,
        `"${cleanText(ledger.client.site)}"`,
        `"${cleanText(ledger.client.mobile_number)}"`,
        totalOutstanding,
        ledger.total_outstanding,
        borrowedStockBalance,
        ledger.all_transactions.length,
        `"${lastActivity}"`,
        ledger.has_activity ? 'Yes' : 'No'
      ].join(','));
    });

    const csvContent = BOM + csvRows.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    
    const today = new Date();
    const dateString = today.toISOString().split('T')[0];
    const filename = `નીલકંઠ-પ્લેટ-ડેપો-બેકઅપ-${dateString}.csv`;
    
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    
    return true;
  } catch (error) {
    console.error('CSV Export Error:', error);
    return false;
  }
};

export function MobileLedgerPage() {
  // State
  const [clientLedgers, setClientLedgers] = useState<ClientLedger[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [expandedClient, setExpandedClient] = useState<string | null>(null);
  const [downloading, setDownloading] = useState<string | null>(null);
  const [challanData, setChallanData] = useState<ChallanData | null>(null);
  const [downloadingLedger, setDownloadingLedger] = useState<string | null>(null);
  const [exportingCSV, setExportingCSV] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  
  // Filter state with sorting
  const [filters, setFilters] = useState<FilterState>({
    status: 'all',
    dateRange: 'all',
    plateSize: '',
    minOutstanding: 0,
    sortBy: 'clientIdAsc'
  });

  // Fetch data effect
  useEffect(() => {
    fetchClientLedgers();
    
    const challanSubscription = supabase
      .channel('challans_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'challans' }, () => {
        fetchClientLedgers();
      })
      .subscribe();

    const returnsSubscription = supabase
      .channel('returns_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'returns' }, () => {
        fetchClientLedgers();
      })
      .subscribe();

    return () => {
      challanSubscription.unsubscribe();
      returnsSubscription.unsubscribe();
    };
  }, []);

  // Optimized data fetching
  const fetchClientLedgers = useCallback(async () => {
    try {
      const [clientsResponse, challansResponse, returnsResponse] = await Promise.all([
        supabase.from('clients').select('*').order('id'),
        supabase.from('challans').select(`*, challan_items (*)`).order('created_at', { ascending: false }),
        supabase.from('returns').select(`*, return_line_items (*)`).order('created_at', { ascending: false })
      ]);

      if (clientsResponse.error) throw clientsResponse.error;
      if (challansResponse.error) throw challansResponse.error;
      if (returnsResponse.error) throw returnsResponse.error;

      const { data: clients } = clientsResponse;
      const { data: challans } = challansResponse;
      const { data: returns } = returnsResponse;

      const ledgers: ClientLedger[] = clients.map(client => {
        const clientChallans = challans.filter(c => c.client_id === client.id);
        const clientReturns = returns.filter(r => r.client_id === client.id);

        const plateBalanceMap = new Map<string, PlateBalance>();
        
        PLATE_SIZES.forEach(size => {
          plateBalanceMap.set(size, {
            plate_size: size,
            total_borrowed: 0,
            total_returned: 0,
            outstanding: 0
          });
        });

        clientChallans.forEach(challan => {
          challan.challan_items.forEach(item => {
            const existing = plateBalanceMap.get(item.plate_size);
            if (existing) {
              existing.total_borrowed += item.borrowed_quantity;
            }
          });
        });

        clientReturns.forEach(returnRecord => {
          returnRecord.return_line_items.forEach(item => {
            const existing = plateBalanceMap.get(item.plate_size);
            if (existing) {
              existing.total_returned += item.returned_quantity;
            }
          });
        });

        const plate_balances = PLATE_SIZES.map(size => {
          const balance = plateBalanceMap.get(size)!;
          return {
            ...balance,
            outstanding: balance.total_borrowed - balance.total_returned
          };
        });

        const total_outstanding = plate_balances.reduce((sum, balance) => sum + balance.outstanding, 0);

        const allTransactions = [
          ...clientChallans.map(challan => ({
            type: 'udhar' as const,
            id: challan.id,
            number: challan.challan_number,
            date: challan.challan_date,
            client_id: challan.client_id,
            items: challan.challan_items.map(item => ({
              plate_size: item.plate_size,
              quantity: item.borrowed_quantity,
              borrowed_stock: item.borrowed_stock || 0,
              notes: item.partner_stock_notes || ''
            })),
            driver_name: challan.driver_name
          })),
          ...clientReturns.map(returnRecord => ({
            type: 'jama' as const,
            id: returnRecord.id,
            number: returnRecord.return_challan_number,
            date: returnRecord.return_date,
            client_id: returnRecord.client_id,
            items: returnRecord.return_line_items.map(item => ({
              plate_size: item.plate_size,
              quantity: item.returned_quantity,
              returned_borrowed_stock: item.returned_borrowed_stock || 0,
              notes: item.damage_notes || ''
            })),
            driver_name: returnRecord.driver_name
          }))
        ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

        const has_activity = clientChallans.length > 0 || clientReturns.length > 0;

        return {
          client,
          plate_balances,
          total_outstanding,
          has_activity,
          all_transactions: allTransactions,
          borrowed_stock_balances: [], // Computed as needed
          borrowed_outstanding: 0 // Computed as needed
        };
      });

      setClientLedgers(ledgers);
    } catch (error) {
      console.error('Error fetching client ledgers:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  // Optimized filtering logic with useMemo
  const filteredLedgers = useMemo(() => {
    return clientLedgers.filter(ledger => {
      // Search term filter
      const searchMatch = !searchTerm || (
        ledger.client.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        ledger.client.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (ledger.client.site?.toLowerCase() || '').includes(searchTerm.toLowerCase())
      );

      if (!searchMatch) return false;

      // Status filter
      const borrowedStockBalance = ledger.all_transactions.reduce((bSum, t) => {
        if (t.type === 'udhar') {
          return bSum + t.items.reduce((itemSum, item) => itemSum + (item.borrowed_stock || 0), 0);
        } else {
          return bSum - t.items.reduce((itemSum, item) => itemSum + (item.returned_borrowed_stock || 0), 0);
        }
      }, 0);
      
      const totalOutstanding = ledger.total_outstanding + borrowedStockBalance;
      
      switch (filters.status) {
        case 'active':
          if (!ledger.has_activity) return false;
          break;
        case 'completed':
          if (totalOutstanding > 0) return false;
          break;
        case 'outstanding':
          if (totalOutstanding <= 0) return false;
          break;
      }

      // Minimum outstanding filter
      if (filters.minOutstanding > 0 && totalOutstanding < filters.minOutstanding) {
        return false;
      }

      // Date range filter
      if (filters.dateRange !== 'all' && ledger.all_transactions.length > 0) {
        const lastTransactionDate = new Date(ledger.all_transactions[0].date);
        const now = new Date();
        let cutoffDate = new Date();

        switch (filters.dateRange) {
          case 'last7days':
            cutoffDate.setDate(now.getDate() - 7);
            break;
          case 'last30days':
            cutoffDate.setDate(now.getDate() - 30);
            break;
          case 'last3months':
            cutoffDate.setMonth(now.getMonth() - 3);
            break;
        }

        if (lastTransactionDate < cutoffDate) return false;
      }

      // Plate size filter
      if (filters.plateSize) {
        const hasPlateActivity = ledger.all_transactions.some(transaction =>
          transaction.items.some(item => item.plate_size === filters.plateSize)
        );
        if (!hasPlateActivity) return false;
      }

      return true;
    });
  }, [clientLedgers, searchTerm, filters]);

  // Sorted ledgers with useMemo
  const sortedLedgers = useMemo(() => {
    const ledgersCopy = [...filteredLedgers];
    
    switch (filters.sortBy) {
      case 'clientIdAsc':
        return ledgersCopy.sort((a, b) => a.client.id.localeCompare(b.client.id, 'gu'));
      case 'clientIdDesc':
        return ledgersCopy.sort((a, b) => b.client.id.localeCompare(a.client.id, 'gu'));
      case 'clientNameAsc':
        return ledgersCopy.sort((a, b) => a.client.name.localeCompare(b.client.name, 'gu'));
      case 'clientNameDesc':
        return ledgersCopy.sort((a, b) => b.client.name.localeCompare(a.client.name, 'gu'));
      default:
        return ledgersCopy;
    }
  }, [filteredLedgers, filters.sortBy]);

  // Event handlers
  const toggleExpanded = useCallback((clientId: string) => {
    setExpandedClient(expandedClient === clientId ? null : clientId);
  }, [expandedClient]);

  const handleDownloadChallan = useCallback(async (transaction: any, type: 'udhar' | 'jama') => {
    try {
      const downloadKey = `${type}-${transaction.id}`;
      setDownloading(downloadKey);
      
      const client = clientLedgers.find(ledger => ledger.client.id === transaction.client_id)?.client;
      if (!client) throw new Error('Client not found');

      const challanDataForPDF: ChallanData = {
        type: type === 'udhar' ? 'issue' : 'return',
        challan_number: transaction.number,
        date: transaction.date,
        client: {
          id: client.id,
          name: client.name,
          site: client.site || '',
          mobile: client.mobile_number || ''
        },
        driver_name: transaction.driver_name || undefined,
        plates: transaction.items.map(item => ({
          size: item.plate_size,
          quantity: item.quantity,
          borrowed_stock: type === 'udhar' ? (item.borrowed_stock || 0) : (item.returned_borrowed_stock || 0),
          notes: item.notes || '',
        })),
        total_quantity: transaction.items.reduce((sum: number, item: any) => {
          const regularQty = item.quantity || 0;
          const borrowedQty = type === 'udhar' 
            ? (item.borrowed_stock || 0) 
            : (item.returned_borrowed_stock || 0);
          return sum + regularQty + borrowedQty;
        }, 0)
      };

      setChallanData(challanDataForPDF);
      await new Promise(resolve => setTimeout(resolve, 500));

      const jpgDataUrl = await generateJPGChallan(challanDataForPDF);
      downloadJPGChallan(jpgDataUrl, `${type}-challan-${challanDataForPDF.challan_number}`);

      setChallanData(null);
    } catch (error) {
      console.error('Error downloading challan:', error);
      alert('Error downloading challan. Please try again.');
    } finally {
      setDownloading(null);
    }
  }, [clientLedgers]);

  const handleBackupData = useCallback(async () => {
    try {
      setExportingCSV(true);
      
      if (!clientLedgers || clientLedgers.length === 0) {
        alert('⚠️ કોઈ ડેટા મળ્યો નથી. કૃપા કરીને રિફ્રેશ કરો.');
        return;
      }
      
      const success = exportDetailedCSV(sortedLedgers);
      
      if (success) {
        alert('✅ CSV બેકઅપ સફળતાપૂર્વક ડાઉનલોડ થયું!');
      } else {
        throw new Error('CSV export failed');
      }
      
    } catch (error) {
      console.error('CSV Export Error:', error);
      alert('❌ બેકઅપ બનાવવામાં ભૂલ. કૃપા કરીને ફરી પ્રયત્ન કરો.');
    } finally {
      setExportingCSV(false);
    }
  }, [clientLedgers, sortedLedgers]);

  const handleDownloadClientLedger = useCallback(async (ledger: ClientLedger) => {
    try {
      setDownloadingLedger(ledger.client.id);
      
      const ledgerData: ClientLedgerData = {
        client: {
          id: ledger.client.id,
          name: ledger.client.name,
          site: ledger.client.site || '',
          mobile: ledger.client.mobile_number || ''
        },
        plate_balances: ledger.plate_balances,
        total_outstanding: ledger.total_outstanding,
        transactions: ledger.all_transactions,
        generated_date: new Date().toISOString()
      };

      const jpgDataUrl = await generateClientLedgerJPG(ledgerData);
      downloadClientLedgerJPG(jpgDataUrl, `ledger-${ledger.client.id}-${ledger.client.name.replace(/\s+/g, '-')}`);
      
    } catch (error) {
      console.error('Error downloading client ledger:', error);
      alert('લેજર ડાઉનલોડ કરવામાં ભૂલ. કૃપા કરીને ફરી પ્રયત્ન કરો.');
    } finally {
      setDownloadingLedger(null);
    }
  }, []);

  const resetFilters = useCallback(() => {
    setFilters({
      status: 'all',
      dateRange: 'all',
      plateSize: '',
      minOutstanding: 0,
      sortBy: 'clientIdAsc'
    });
  }, []);

  // Check if any filters are active
  const hasActiveFilters = filters.status !== 'all' || 
                          filters.dateRange !== 'all' || 
                          filters.plateSize || 
                          filters.minOutstanding > 0 ||
                          filters.sortBy !== 'clientIdAsc';

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-cyan-50">
        <div className="p-4 space-y-3">
          <div className="pt-1 text-center">
            <div className="w-24 h-3 mx-auto mb-1 bg-blue-200 rounded animate-pulse"></div>
            <div className="w-32 h-2 mx-auto bg-blue-200 rounded animate-pulse"></div>
          </div>
          {[...Array(5)].map((_, i) => (
            <div key={i} className="p-2 bg-white border border-blue-100 rounded-lg shadow-sm animate-pulse">
              <div className="w-2/3 h-3 mb-1 bg-blue-200 rounded"></div>
              <div className="w-1/2 h-2 bg-blue-200 rounded"></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-cyan-50">
      {/* Hidden Printable Challan */}
      <div style={{ position: 'fixed', left: '-9999px', top: 0 }}>
        {challanData && (
          <div id={`challan-${challanData.challan_number}`}>
            <PrintableChallan data={challanData} />
          </div>
        )}
      </div>

      <div className="p-4 space-y-4">
        {/* Header */}
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-8 h-8 mb-2 rounded-full shadow-lg bg-gradient-to-r from-blue-600 to-indigo-600">
            <BookOpen className="w-4 h-4 text-white" />
          </div>
          <h1 className="mb-1 text-sm font-bold text-gray-900">ખાતાવહી</h1>
          <p className="mb-3 text-xs text-blue-700">ગ્રાહક ભાડા ઇતિહાસ</p>
          
          {/* Stats */}
          <div className="grid grid-cols-3 gap-2 mb-3">
            <div className="p-1.5 bg-white border border-blue-100 rounded-lg shadow-sm">
              <p className="text-xs font-medium text-blue-600">કુલ ગ્રાહકો</p>
              <p className="text-sm font-bold text-gray-900">{clientLedgers.length}</p>
            </div>
            <div className="p-1.5 bg-white border border-blue-100 rounded-lg shadow-sm">
              <p className="text-xs font-medium text-blue-600">ફિલ્ટર્ડ</p>
              <p className="text-sm font-bold text-gray-900">{sortedLedgers.length}</p>
            </div>
            <div className="p-1.5 bg-white border border-blue-100 rounded-lg shadow-sm">
              <p className="text-xs font-medium text-blue-600">કુલ બાકી</p>
              <p className="text-sm font-bold text-gray-900">
                {sortedLedgers.reduce((sum, l) => {
                  const borrowedStock = l.all_transactions.reduce((bSum, t) => {
                    if (t.type === 'udhar') {
                      return bSum + t.items.reduce((itemSum, item) => itemSum + (item.borrowed_stock || 0), 0);
                    } else {
                      return bSum - t.items.reduce((itemSum, item) => itemSum + (item.returned_borrowed_stock || 0), 0);
                    }
                  }, 0);
                  return sum + l.total_outstanding + borrowedStock;
                }, 0)}
              </p>
            </div>
          </div>
        </div>

        {/* Search and Filter Controls - Combined in One Line */}
        <div className="space-y-2">
          {/* Combined Search and Filter Bar */}
          <div className="flex gap-2">
            {/* Search Input - Takes most space */}
            <div className="relative flex-1">
              <Search className="absolute w-3 h-3 text-blue-400 transform -translate-y-1/2 left-2 top-1/2" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full py-2 pl-8 pr-2 text-xs placeholder-blue-300 transition-all duration-200 bg-white border-2 border-blue-200 rounded-lg focus:ring-4 focus:ring-blue-100 focus:border-blue-500"
                placeholder="નામ, ID અથવા સાઇટથી શોધો..."
              />
            </div>

            {/* Filter Toggle Button */}
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium transition-all duration-200 rounded-lg shadow-md whitespace-nowrap ${
                showFilters ? 'bg-blue-600 text-white' : 'bg-white text-blue-600 border border-blue-200'
              } hover:shadow-lg active:scale-95`}
            >
              <Filter className="w-3 h-3" />
              ફિલ્ટર
              {hasActiveFilters && (
                <span className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse ml-0.5"></span>
              )}
            </button>
            
            {/* Reset Button - Only show when filters are active */}
            {hasActiveFilters && (
              <button
                onClick={resetFilters}
                className="flex items-center justify-center gap-1 px-2 py-2 text-xs font-medium text-red-600 transition-all duration-200 bg-white border border-red-200 rounded-lg shadow-md hover:shadow-lg hover:bg-red-50 active:scale-95"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          {/* Compact Filter Panel */}
          {showFilters && (
            <div className="p-3 space-y-3 bg-white border-2 border-blue-100 rounded-lg shadow-lg">
              {/* First Row - Status and Date Range */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block mb-1 text-xs font-medium text-gray-700">સ્થિતિ</label>
                  <select
                    value={filters.status}
                    onChange={(e) => setFilters(prev => ({ ...prev, status: e.target.value as any }))}
                    className="w-full px-2 py-1.5 text-xs bg-white border border-blue-200 rounded-md focus:ring-2 focus:ring-blue-100 focus:border-blue-500"
                  >
                    {FILTER_OPTIONS.status.map(option => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block mb-1 text-xs font-medium text-gray-700">તારીખ રેન્જ</label>
                  <select
                    value={filters.dateRange}
                    onChange={(e) => setFilters(prev => ({ ...prev, dateRange: e.target.value as any }))}
                    className="w-full px-2 py-1.5 text-xs bg-white border border-blue-200 rounded-md focus:ring-2 focus:ring-blue-100 focus:border-blue-500"
                  >
                    {FILTER_OPTIONS.dateRange.map(option => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Second Row - Plate Size and Minimum Outstanding */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block mb-1 text-xs font-medium text-gray-700">પ્લેટ સાઈઝ</label>
                  <select
                    value={filters.plateSize}
                    onChange={(e) => setFilters(prev => ({ ...prev, plateSize: e.target.value }))}
                    className="w-full px-2 py-1.5 text-xs bg-white border border-blue-200 rounded-md focus:ring-2 focus:ring-blue-100 focus:border-blue-500"
                  >
                    <option value="">બધા પ્લેટ સાઈઝ</option>
                    {PLATE_SIZES.map(size => (
                      <option key={size} value={size}>{size}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block mb-1 text-xs font-medium text-gray-700">લઘુત્તમ બાકી</label>
                  <input
                    type="number"
                    min="0"
                    value={filters.minOutstanding}
                    onChange={(e) => setFilters(prev => ({ ...prev, minOutstanding: Number(e.target.value) }))}
                    className="w-full px-2 py-1.5 text-xs bg-white border border-blue-200 rounded-md focus:ring-2 focus:ring-blue-100 focus:border-blue-500"
                    placeholder="0"
                  />
                </div>
              </div>

              {/* Third Row - Sort Options */}
              <div className="grid grid-cols-1 gap-2">
                <div>
                  <label className="block mb-1 text-xs font-medium text-gray-700">ક્રમમાં લગાવો</label>
                  <select
                    value={filters.sortBy}
                    onChange={(e) => setFilters(prev => ({ ...prev, sortBy: e.target.value as any }))}
                    className="w-full px-2 py-1.5 text-xs bg-white border border-blue-200 rounded-md focus:ring-2 focus:ring-blue-100 focus:border-blue-500"
                  >
                    {SORT_OPTIONS.map(option => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* Backup Button */}
          <button
            onClick={handleBackupData}
            disabled={exportingCSV || sortedLedgers.length === 0}
            className="flex items-center justify-center w-full gap-2 px-3 py-2 text-xs font-medium text-white transition-all duration-200 transform rounded-lg shadow-lg bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 hover:shadow-xl active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {exportingCSV ? (
              <>
                <div className="w-3 h-3 border-2 border-white rounded-full border-t-transparent animate-spin" />
                CSV બનાવી રહ્યું છે...
              </>
            ) : (
              <>
                <FileDown className="w-3 h-3" />
                CSV બેકઅપ ડાઉનલોડ કરો ({sortedLedgers.length})
              </>
            )}
          </button>

          <p className="text-xs text-center text-gray-600">
            📊 {sortedLedgers.length} ગ્રાહકોની ફિલ્ટર્ડ બેકઅપ ફાઇલ
          </p>
        </div>

        {/* Client Cards */}
        <div className="space-y-2">
          {sortedLedgers.map((ledger) => (
            <div key={ledger.client.id} className="overflow-hidden transition-all duration-200 bg-white border-2 border-blue-100 shadow-lg rounded-xl hover:shadow-xl hover:border-blue-200">
              <div 
                className="relative p-2 transition-colors cursor-pointer hover:bg-blue-50"
                onClick={() => toggleExpanded(ledger.client.id)}
              >
                <div className={`absolute top-2 right-2 w-1.5 h-1.5 rounded-full ${
                  ledger.has_activity ? 'bg-green-500 animate-pulse' : 'bg-gray-300'
                }`} />
                
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <div className="flex items-center justify-center w-6 h-6 text-xs font-bold text-white rounded-full shadow-md bg-gradient-to-r from-blue-500 to-indigo-500">
                        {ledger.client.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <h3 className="text-sm font-bold text-gray-900 truncate">
                          {ledger.client.name}
                        </h3>
                        <p className="text-xs font-medium text-blue-600">
                          ID: {ledger.client.id}
                        </p>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 ml-8">
                      {ledger.client.site && (
                        <div className="flex items-center gap-1 px-1.5 py-0.5 text-xs font-medium text-blue-700 bg-blue-50 rounded-full">
                          <MapPin className="w-2.5 h-2.5" />
                          <span className="truncate max-w-[120px]">{ledger.client.site}</span>
                        </div>
                      )}
                      {ledger.client.mobile_number && (
                        <div className="flex items-center gap-1 px-1.5 py-0.5 text-xs font-medium text-blue-700 bg-blue-50 rounded-full">
                          <Phone className="w-2.5 h-2.5" />
                          <span>{ledger.client.mobile_number}</span>
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex flex-col items-end gap-1.5 mt-2 ml-2">
                    <div className="flex flex-col items-end gap-1.5">
                      {(() => {
                        const borrowedStockBalance = ledger.all_transactions.reduce((bSum, t) => {
                          if (t.type === 'udhar') {
                            return bSum + t.items.reduce((itemSum, item) => itemSum + (item.borrowed_stock || 0), 0);
                          } else {
                            return bSum - t.items.reduce((itemSum, item) => itemSum + (item.returned_borrowed_stock || 0), 0);
                          }
                        }, 0);
                        
                        const totalBalance = ledger.total_outstanding + borrowedStockBalance;
                        
                        return totalBalance > 0 ? (
                          <div className="px-2 py-1 text-xs font-bold text-white rounded-full shadow-lg bg-gradient-to-r from-red-500 to-red-600">
                            <div className="text-center">
                              <div>{totalBalance} કુલ બાકી</div>
                            </div>
                          </div>
                        ) : (
                          <span className="px-2 py-1 text-xs font-bold text-white rounded-full shadow-lg bg-gradient-to-r from-green-500 to-green-600">
                            પૂર્ણ
                          </span>
                        );
                      })()}
                      
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDownloadClientLedger(ledger);
                        }}
                        disabled={downloadingLedger === ledger.client.id}
                        className="flex items-center justify-center text-white transition-all duration-200 rounded-full shadow-lg w-7 h-7 bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600 hover:shadow-xl disabled:opacity-50 active:scale-95"
                      >
                        {downloadingLedger === ledger.client.id ? (
                          <div className="w-3 h-3 border-2 border-white rounded-full border-t-transparent animate-spin" />
                        ) : (
                          <FileImage className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>
                    
                    <div className={`flex items-center justify-center w-6 h-6 transition-all duration-200 rounded-full ${
                      expandedClient === ledger.client.id ? 'bg-blue-500 text-white' : 'bg-blue-100 text-blue-600'
                    }`}>
                      {expandedClient === ledger.client.id ? (
                        <ChevronUp className="w-3.5 h-3.5" />
                      ) : (
                        <ChevronDown className="w-3.5 h-3.5" />
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {expandedClient === ledger.client.id && (
                <div className="border-t-2 border-blue-100 bg-gradient-to-r from-blue-50 to-indigo-50">
                  {!ledger.has_activity ? (
                    <div className="p-4 text-center text-gray-500">
                      <div className="flex items-center justify-center w-10 h-10 mx-auto mb-2 rounded-full bg-gradient-to-r from-blue-200 to-indigo-200">
                        <Package className="w-5 h-5 text-blue-400" />
                      </div>
                      <p className="text-xs font-medium">કોઈ પ્રવૃત્તિ નથી</p>
                    </div>
                  ) : (
                    <AllSizesActivityTable 
                      ledger={ledger} 
                      onDownloadChallan={handleDownloadChallan}
                      downloading={downloading}
                    />
                  )}
                </div>
              )}
            </div>
          ))}

          {sortedLedgers.length === 0 && !loading && (
            <div className="py-6 text-center bg-white border-2 border-blue-100 shadow-lg rounded-xl">
              <div className="flex items-center justify-center w-12 h-12 mx-auto mb-3 rounded-full bg-gradient-to-r from-blue-200 to-indigo-200">
                <User className="w-6 h-6 text-blue-400" />
              </div>
              <p className="mb-1 text-sm font-semibold text-gray-700">
                {searchTerm || hasActiveFilters
                  ? 'કોઈ ગ્રાહક મળ્યો નથી' 
                  : 'કોઈ ગ્રાહક નથી'}
              </p>
              <p className="text-xs text-blue-600">
                {searchTerm || hasActiveFilters
                  ? 'ફિલ્ટર બદલીને પ્રયત્ન કરો' 
                  : 'નવા ગ્રાહકો ઉમેરો'}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// AllSizesActivityTable Component
interface AllSizesActivityTableProps {
  ledger: ClientLedger;
  onDownloadChallan: (transaction: any, type: 'udhar' | 'jama') => void;
  downloading: string | null;
}

function AllSizesActivityTable({ ledger, onDownloadChallan, downloading }: AllSizesActivityTableProps) {
  const allPlateSizes = PLATE_SIZES;

  const getCurrentBalance = (plateSize: string) => {
    const balance = ledger.plate_balances.find(b => b.plate_size === plateSize);
    return balance?.outstanding || 0;
  };

  const getTransactionQuantity = (transaction: typeof ledger.all_transactions[0], plateSize: string) => {
    const item = transaction.items.find(i => i.plate_size === plateSize);
    return item?.quantity || 0;
  };

  const getBorrowedStock = (transaction: typeof ledger.all_transactions[0], plateSize: string) => {
    const item = transaction.items.find(i => i.plate_size === plateSize);
    return item?.borrowed_stock || 0;
  };

  const getReturnedBorrowedStock = (transaction: typeof ledger.all_transactions[0], plateSize: string) => {
    const item = transaction.items.find(i => i.plate_size === plateSize);
    return item?.returned_borrowed_stock || 0;
  };

  const getNotes = (transaction: typeof ledger.all_transactions[0], plateSize: string) => {
    const item = transaction.items.find(i => i.plate_size === plateSize);
    return item?.notes || '';
  };

  const hasBorrowedStock = (transaction: typeof ledger.all_transactions[0]) => {
    return transaction.type === 'udhar' && transaction.items.some(item => (item.borrowed_stock || 0) > 0);
  };

  const getTransactionTotalWithBorrowed = (transaction: typeof ledger.all_transactions[0]) => {
    const regularTotal = transaction.items.reduce((sum, item) => sum + item.quantity, 0);
    if (transaction.type === 'udhar') {
      const borrowedStockTotal = transaction.items.reduce((sum, item) => sum + (item.borrowed_stock || 0), 0);
      return regularTotal + borrowedStockTotal;
    }
    if (transaction.type === 'jama') {
      const returnedBorrowedStockTotal = transaction.items.reduce((sum, item) => sum + (item.returned_borrowed_stock || 0), 0);
      return regularTotal + returnedBorrowedStockTotal;
    }
    return regularTotal;
  };

  const formatPlateDisplay = (transaction: typeof ledger.all_transactions[0], plateSize: string) => {
    const quantity = getTransactionQuantity(transaction, plateSize);
    
    let borrowedStock = 0;
    if (transaction.type === 'udhar') {
      borrowedStock = getBorrowedStock(transaction, plateSize);
    } else if (transaction.type === 'jama') {
      borrowedStock = getReturnedBorrowedStock(transaction, plateSize);
    }

    if (quantity === 0 && borrowedStock === 0) {
      return null;
    }

    const prefix = transaction.type === 'udhar' ? '+' : '-';
    const notes = getNotes(transaction, plateSize);
    
    return (
      <div className="inline-block">
        {quantity > 0 && (
          <span className="text-xs font-bold text-blue-800">
            {prefix}{quantity}
          </span>
        )}
        
        {borrowedStock > 0 && (
          <sup className="ml-0.5 font-bold text-red-600" style={{fontSize: '9px'}}>
            {prefix}{borrowedStock}
          </sup>
        )}
        
        {notes && (
          <sup className="ml-0.5 text-gray-500" style={{fontSize: '8px'}}>
            ({notes})
          </sup>
        )}
      </div>
    );
  };

  const getNetBorrowedStock = () => {
    const issuedBorrowed = ledger.all_transactions
      .filter(t => t.type === 'udhar')
      .reduce((sum, t) => {
        return sum + t.items.reduce((subSum, item) => subSum + (item.borrowed_stock || 0), 0);
      }, 0);
    
    const returnedBorrowed = ledger.all_transactions
      .filter(t => t.type === 'jama')
      .reduce((sum, t) => {
        return sum + t.items.reduce((subSum, item) => subSum + (item.returned_borrowed_stock || 0), 0);
      }, 0);
    
    return issuedBorrowed - returnedBorrowed;
  };

  const getAccurateGrandTotal = () => {
    const regularOutstanding = ledger.plate_balances.reduce((sum, balance) => sum + Math.abs(balance.outstanding), 0);
    const netBorrowedStock = getNetBorrowedStock();
    return regularOutstanding + netBorrowedStock;
  };
  
  return (
    <div className="p-2">
      <div className="flex items-center gap-2 mb-2">
        <div className="flex items-center justify-center w-5 h-5 rounded-full bg-gradient-to-r from-blue-500 to-indigo-500">
          <Package className="w-2.5 h-2.5 text-white" />
        </div>
        <h4 className="text-xs font-semibold text-gray-900">પ્લેટ પ્રવૃત્તિ</h4>
      </div>
      
      <div className="overflow-hidden bg-white border-2 border-blue-100 rounded-lg shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-white bg-gradient-to-r from-blue-500 to-indigo-500">
                <th className="sticky left-0 bg-gradient-to-r from-blue-500 to-indigo-500 px-1 py-1 text-left font-bold min-w-[50px]">
                  <div className="text-xs">ચલણ નં.</div>
                </th>
                <th className="px-1 py-1 text-center font-bold min-w-[50px] border-l border-blue-400">
                  <div className="text-xs">તારીખ</div>
                </th>
                <th className="px-1 py-1 text-center font-bold min-w-[50px] border-l border-blue-400">
                  <div className="text-xs">કુલ</div>
                </th>
                {allPlateSizes.map(size => (
                  <th key={size} className="px-1 py-1 text-center font-bold min-w-[60px] border-l border-blue-400">
                    <div className="text-xs">{size}</div>
                  </th>
                ))}
                <th className="px-1 py-1 text-center font-bold min-w-[40px] border-l border-blue-400">
                  <div className="text-xs">ડાઉનલોડ</div>
                </th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b-2 border-blue-200 bg-gradient-to-r from-blue-100 to-indigo-100">
                <td className="sticky left-0 px-1 py-1 font-bold text-blue-900 border-r border-blue-200 bg-gradient-to-r from-blue-100 to-indigo-100">
                  <div className="text-xs">ચાલુ નંગ</div>
                </td>
                <td className="px-1 py-1 text-center border-l border-blue-200">
                  <div className="text-xs font-semibold text-blue-700">-</div>
                </td>
                <td className="px-1 py-1 text-center border-l border-blue-200"> 
                  <div className="text-xs font-semibold text-blue-700">
                    {getAccurateGrandTotal()}
                  </div>
                </td>
                {allPlateSizes.map(size => {
                  const balance = getCurrentBalance(size);
                  
                  const borrowedIssued = ledger.all_transactions
                    .filter(t => t.type === 'udhar')
                    .reduce((sum, t) => {
                      const item = t.items.find(i => i.plate_size === size);
                      return sum + (item?.borrowed_stock || 0);
                    }, 0);
                    
                  const borrowedReturned = ledger.all_transactions
                    .filter(t => t.type === 'jama')
                    .reduce((sum, t) => {
                      const item = t.items.find(i => i.plate_size === size);
                      return sum + (item?.returned_borrowed_stock || 0);
                    }, 0);
                    
                  const borrowedBalance = borrowedIssued - borrowedReturned;
                  const totalBalance = (balance || 0) + (borrowedBalance || 0);
                  
                  return (
                    <td key={size} className="px-1 py-1 text-center border-l border-blue-200">
                      <div className="inline-block">
                        {balance !== 0 || borrowedBalance > 0 ? (
                          <div className="inline-block">
                            <span className="text-xs font-bold text-blue-800">
                              {totalBalance}
                            </span>
                            {borrowedBalance > 0 && (
                              <sup className="ml-0.5 font-bold text-red-600" style={{fontSize: '9px'}}>
                                {borrowedBalance}
                              </sup>
                            )}
                          </div>
                        ) : (
                          <span className="text-xs text-blue-400">-</span>
                        )}
                      </div>
                    </td>
                  );
                })}
                <td className="px-1 py-1 text-center border-l border-blue-200">
                  <div className="text-xs font-semibold text-blue-700">-</div>
                </td>
              </tr>

              {ledger.all_transactions.length === 0 ? (
                <tr>
                  <td colSpan={allPlateSizes.length + 4} className="px-1 py-3 text-center text-blue-500">
                    <div className="text-xs">કોઈ ચલણ નથી</div>
                  </td>
                </tr>
              ) : (
                ledger.all_transactions.map((transaction) => (
                  <tr 
                    key={`${transaction.type}-${transaction.id}`}
                    className={`border-b border-blue-100 hover:bg-blue-25 transition-colors ${
                      transaction.type === 'udhar' ? 'bg-yellow-50' : 'bg-green-50'
                    }`}
                  >
                    <td className={`sticky left-0 px-1 py-0.5 border-r border-blue-100 ${
                      transaction.type === 'udhar' ? 'bg-yellow-50' : 'bg-green-50'
                    }`}>
                      <div className="text-xs font-semibold text-gray-900">
                        #{transaction.number}
                        {hasBorrowedStock(transaction) && (
                          <span className="font-bold text-purple-600">*</span>
                        )}
                      </div>
                    </td>
                    
                    <td className="px-1 py-0.5 text-center border-l border-blue-100">
                      <div className="text-xs font-medium text-blue-600">
                        {(() => {
                          const d = new Date(transaction.date);
                          const day = d.getDate().toString().padStart(2, '0');
                          const month = (d.getMonth() + 1).toString().padStart(2, '0');
                          const year = d.getFullYear().toString().slice(-2);
                          return `${day}/${month}/${year}`;
                        })()}
                      </div>
                    </td>
                    
                    <td className="px-1 py-0.5 text-center border-l border-blue-100">
                      <div className="text-xs font-medium text-blue-600">
                        {getTransactionTotalWithBorrowed(transaction)}
                      </div>
                    </td>

                    {allPlateSizes.map(size => {
                      const formattedDisplay = formatPlateDisplay(transaction, size);
                      return (
                        <td key={size} className="px-1 py-0.5 text-center border-l border-blue-100">
                          {formattedDisplay ? (
                            formattedDisplay
                          ) : (
                            <span className="text-xs text-gray-300">-</span>
                          )}
                        </td>
                      );
                    })}
                    
                    <td className="px-1 py-0.5 text-center border-l border-blue-100">
                      <button
                        onClick={() => onDownloadChallan(transaction, transaction.type)}
                        disabled={downloading === `${transaction.type}-${transaction.id}`}
                        className={`p-0.5 rounded-full transition-all duration-200 hover:shadow-md ${
                          transaction.type === 'udhar'
                            ? 'text-yellow-600 hover:bg-yellow-200 hover:text-yellow-700'
                            : 'text-green-600 hover:bg-green-200 hover:text-green-700'
                        } disabled:opacity-50`}
                      >
                        <Download className="w-2.5 h-2.5" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="p-2 border-t-2 border-blue-100 bg-gradient-to-r from-blue-50 to-indigo-50">
          <div className="flex flex-wrap justify-center gap-2 text-xs">
            <div className="flex items-center gap-1">
              <div className="w-2.5 h-2.5 bg-yellow-400 rounded-full shadow-sm"></div>
              <span className="font-medium text-blue-700">ઉધાર</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-2.5 h-2.5 bg-green-400 rounded-full shadow-sm"></div>
              <span className="font-medium text-blue-700">જમા</span>
            </div>
              <div className="flex items-center gap-1">
              <div className="w-2.5 h-2.5 bg-blue-400 rounded-full shadow-sm"></div>
              <span className="font-medium text-blue-700">ચાલુ નંગ</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default MobileLedgerPage;
