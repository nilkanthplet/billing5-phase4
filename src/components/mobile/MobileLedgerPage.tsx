import React, { useState, useEffect } from 'react';
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
  Calendar,
  TrendingUp,
  AlertCircle,
  CheckCircle2,
  Clock,
  Users
} from 'lucide-react';
import { T } from '../../contexts/LanguageContext';
import { PrintableChallan } from '../challans/PrintableChallan';
import { generateJPGChallan, downloadJPGChallan } from '../../utils/jpgChallanGenerator';
import { ChallanData } from '../challans/types';
import { generateClientLedgerJPG, downloadClientLedgerJPG, ClientLedgerData } from '../../utils/clientLedgerGenerator';
import { motion, AnimatePresence } from 'framer-motion';

type Client = Database['public']['Tables']['clients']['Row'];
type Challan = Database['public']['Tables']['challans']['Row'];
type ChallanItem = Database['public']['Tables']['challan_items']['Row'];
type Return = Database['public']['Tables']['returns']['Row'];
type ReturnLineItem = Database['public']['Tables']['return_line_items']['Row'];

interface PlateBalance {
  plate_size: string;
  total_borrowed: number;
  total_returned: number;
  outstanding: number;
}

interface ClientLedger {
  client: Client;
  plate_balances: PlateBalance[];
  total_outstanding: number;
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

const PLATE_SIZES = [
  '2 X 3', '21 X 3', '18 X 3', '15 X 3', '12 X 3',
  '9 X 3', 'પતરા', '2 X 2', '2 ફુટ'
];

export function MobileLedgerPage() {
  const [clientLedgers, setClientLedgers] = useState<ClientLedger[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [expandedClient, setExpandedClient] = useState<string | null>(null);
  const [downloading, setDownloading] = useState<string | null>(null);
  const [challanData, setChallanData] = useState<ChallanData | null>(null);
  const [downloadingLedger, setDownloadingLedger] = useState<string | null>(null);

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

  const fetchClientLedgers = async () => {
    try {
      const { data: clients, error: clientsError } = await supabase
        .from('clients')
        .select('*')
        .order('id');

      if (clientsError) throw clientsError;

      const { data: challans, error: challansError } = await supabase
        .from('challans')
        .select(`*, challan_items (*)`)
        .order('created_at', { ascending: false });

      if (challansError) throw challansError;

      const { data: returns, error: returnsError } = await supabase
        .from('returns')
        .select(`*, return_line_items (*)`)
        .order('created_at', { ascending: false });

      if (returnsError) throw returnsError;

      const ledgers: ClientLedger[] = clients.map(client => {
        const clientChallans = challans.filter(c => c.client_id === client.id);
        const clientReturns = returns.filter(r => r.client_id === client.id);

        const plateBalanceMap = new Map<string, PlateBalance>();
        
        // Initialize ALL plate sizes
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
          all_transactions: allTransactions
        };
      });

      setClientLedgers(ledgers);
    } catch (error) {
      console.error('Error fetching client ledgers:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleExpanded = (clientId: string) => {
    setExpandedClient(expandedClient === clientId ? null : clientId);
  };

  const handleDownloadChallan = async (transaction: any, type: 'udhar' | 'jama') => {
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
          notes: item.notes || '',
        })),
        total_quantity: transaction.items.reduce((sum, item) => sum + item.quantity, 0)
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
  };

  const handleBackupData = async () => {
    try {
      const csvRows = [];
      const headers = [
        'Client ID', 'Client Name', 'Site', 'Mobile Number', 'Total Outstanding Plates',
        'Plate Size', 'Total Issued', 'Total Returned', 'Current Balance',
        'Total Transactions', 'Last Activity Date'
      ];
      csvRows.push(headers.join(','));

      clientLedgers.forEach(ledger => {
        if (!ledger.has_activity) {
          csvRows.push([
            `"${ledger.client.id}"`, `"${ledger.client.name}"`, `"${ledger.client.site}"`,
            `"${ledger.client.mobile_number}"`, '0', 'No Activity', '0', '0', '0', '0', 'Never'
          ].join(','));
        } else {
          ledger.plate_balances.forEach(balance => {
            const lastActivityDate = ledger.all_transactions.length > 0 
              ? new Date(ledger.all_transactions[0].date).toLocaleDateString('en-GB')
              : 'Never';
              
            csvRows.push([
              `"${ledger.client.id}"`, `"${ledger.client.name}"`, `"${ledger.client.site}"`,
              `"${ledger.client.mobile_number}"`, ledger.total_outstanding.toString(),
              `"${balance.plate_size}"`, balance.total_borrowed.toString(),
              balance.total_returned.toString(), balance.outstanding.toString(),
              ledger.all_transactions.length.toString(), `"${lastActivityDate}"`
            ].join(','));
          });
        }
      });

      const csvContent = csvRows.join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `ledger-backup-${new Date().toISOString().split('T')[0]}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      alert('Backup exported successfully!');
    } catch (error) {
      console.error('Error creating backup:', error);
      alert('Error creating backup. Please try again.');
    }
  };

  const handleDownloadClientLedger = async (ledger: ClientLedger) => {
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
  };

  const filteredLedgers = clientLedgers.filter(ledger =>
    ledger.client.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    ledger.client.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
    ledger.client.site.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Calculate summary stats
  const summaryStats = {
    totalClients: clientLedgers.length,
    activeClients: clientLedgers.filter(l => l.total_outstanding > 0).length,
    totalOutstanding: clientLedgers.reduce((sum, l) => l.total_outstanding, 0),
    clearedClients: clientLedgers.filter(l => l.total_outstanding === 0 && l.has_activity).length
  };

  if (loading) {
    return (
      <div className="min-h-screen pb-20 bg-gradient-to-br from-blue-50 via-indigo-50 to-cyan-50">
        <div className="p-3 space-y-4">
          <div className="pt-2 text-center">
            <div className="w-32 h-5 mx-auto mb-1 bg-blue-200 rounded animate-pulse"></div>
            <div className="w-40 h-3 mx-auto bg-blue-200 rounded animate-pulse"></div>
          </div>
          
          {/* Loading Stats */}
          <div className="grid grid-cols-2 gap-2">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="p-3 bg-white border border-blue-100 rounded-lg shadow-sm animate-pulse">
                <div className="w-8 h-8 mx-auto mb-2 bg-blue-200 rounded-full"></div>
                <div className="w-12 h-4 mx-auto mb-1 bg-blue-200 rounded"></div>
                <div className="w-16 h-3 mx-auto bg-blue-200 rounded"></div>
              </div>
            ))}
          </div>
          
          {/* Loading Client Cards */}
          {[...Array(5)].map((_, i) => (
            <div key={i} className="p-3 bg-white border border-blue-100 rounded-lg shadow-sm animate-pulse">
              <div className="w-2/3 h-4 mb-2 bg-blue-200 rounded"></div>
              <div className="w-1/2 h-3 bg-blue-200 rounded"></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-20 bg-gradient-to-br from-blue-50 via-indigo-50 to-cyan-50">
      {/* Hidden Printable Challan */}
      <div style={{ position: 'fixed', left: '-9999px', top: 0 }}>
        {challanData && (
          <div id={`challan-${challanData.challan_number}`}>
            <PrintableChallan data={challanData} />
          </div>
        )}
      </div>

      <div className="p-3 space-y-4">
        {/* Enhanced Header */}
        <div className="pt-2 text-center">
          <div className="inline-flex items-center justify-center w-12 h-12 mb-3 rounded-full shadow-lg bg-gradient-to-r from-blue-600 to-indigo-600">
            <BookOpen className="w-6 h-6 text-white" />
          </div>
          <h1 className="mb-1 text-lg font-bold text-gray-900">ખાતાવહી</h1>
          <p className="text-sm text-blue-600">ગ્રાહક ભાડા ઇતિહાસ અને બેલેન્સ</p>
        </div>

        {/* Enhanced Summary Stats */}
        <div className="grid grid-cols-2 gap-3">
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="p-3 text-center bg-white border-2 border-blue-200 rounded-xl shadow-lg"
          >
            <div className="flex items-center justify-center w-8 h-8 mx-auto mb-2 rounded-full bg-gradient-to-r from-blue-500 to-indigo-500">
              <Users className="w-4 h-4 text-white" />
            </div>
            <div className="text-xl font-bold text-blue-700">{summaryStats.totalClients}</div>
            <div className="text-xs font-medium text-blue-600">કુલ ગ્રાહકો</div>
          </motion.div>

          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.1 }}
            className="p-3 text-center bg-white border-2 border-orange-200 rounded-xl shadow-lg"
          >
            <div className="flex items-center justify-center w-8 h-8 mx-auto mb-2 rounded-full bg-gradient-to-r from-orange-500 to-red-500">
              <Clock className="w-4 h-4 text-white" />
            </div>
            <div className="text-xl font-bold text-orange-700">{summaryStats.activeClients}</div>
            <div className="text-xs font-medium text-orange-600">સક્રિય ગ્રાહકો</div>
          </motion.div>

          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2 }}
            className="p-3 text-center bg-white border-2 border-red-200 rounded-xl shadow-lg"
          >
            <div className="flex items-center justify-center w-8 h-8 mx-auto mb-2 rounded-full bg-gradient-to-r from-red-500 to-pink-500">
              <AlertCircle className="w-4 h-4 text-white" />
            </div>
            <div className="text-xl font-bold text-red-700">{summaryStats.totalOutstanding}</div>
            <div className="text-xs font-medium text-red-600">કુલ બાકી</div>
          </motion.div>

          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.3 }}
            className="p-3 text-center bg-white border-2 border-green-200 rounded-xl shadow-lg"
          >
            <div className="flex items-center justify-center w-8 h-8 mx-auto mb-2 rounded-full bg-gradient-to-r from-green-500 to-emerald-500">
              <CheckCircle2 className="w-4 h-4 text-white" />
            </div>
            <div className="text-xl font-bold text-green-700">{summaryStats.clearedClients}</div>
            <div className="text-xs font-medium text-green-600">ક્લિયર ગ્રાહકો</div>
          </motion.div>
        </div>

        {/* Enhanced Controls */}
        <div className="space-y-3">
          {/* Search Bar */}
          <div className="relative">
            <Search className="absolute w-4 h-4 text-blue-400 transform -translate-y-1/2 left-3 top-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full py-3 pl-10 pr-3 text-sm transition-all duration-200 bg-white border-2 border-blue-200 rounded-lg focus:ring-4 focus:ring-blue-100 focus:border-blue-500 shadow-sm"
              placeholder="ગ્રાહક શોધો..."
            />
          </div>

          {/* Backup Button */}
          <div className="flex justify-center">
            <button
              onClick={handleBackupData}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white transition-all duration-200 transform rounded-lg shadow-lg bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 hover:shadow-xl hover:scale-105"
            >
              <FileDown className="w-4 h-4" />
              CSV બેકઅપ
            </button>
          </div>
        </div>

        {/* Enhanced Client Cards */}
        <div className="space-y-3">
          <AnimatePresence>
            {filteredLedgers.map((ledger, index) => {
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
              
              const netBorrowedStock = issuedBorrowed - returnedBorrowed;
              const totalOutstandingWithBorrowed = ledger.total_outstanding + netBorrowedStock;
              
              return (
                <motion.div
                  key={ledger.client.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ delay: index * 0.05 }}
                  className="overflow-hidden transition-all duration-200 bg-white border-2 border-blue-100 shadow-lg rounded-xl hover:shadow-xl hover:border-blue-200"
                >
                  {/* Enhanced Client Header */}
                  <div 
                    className="p-4 transition-colors cursor-pointer hover:bg-blue-50"
                    onClick={() => toggleExpanded(ledger.client.id)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3 mb-2">
                          <div className="flex items-center justify-center w-8 h-8 text-sm font-bold text-white rounded-full shadow-sm bg-gradient-to-r from-blue-500 to-indigo-500">
                            {ledger.client.name.charAt(0).toUpperCase()}
                          </div>
                          <div className="flex-1 min-w-0">
                            <h3 className="text-sm font-bold text-gray-900 truncate">
                              {ledger.client.name}
                            </h3>
                            <p className="text-xs text-blue-600 font-medium">ID: {ledger.client.id}</p>
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-4 ml-11">
                          <div className="flex items-center gap-1 text-xs text-blue-600">
                            <MapPin className="w-3 h-3" />
                            <span className="truncate max-w-[120px]">{ledger.client.site}</span>
                          </div>
                          <div className="flex items-center gap-1 text-xs text-blue-600">
                            <Phone className="w-3 h-3" />
                            <span>{ledger.client.mobile_number}</span>
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2 ml-3">
                        {/* Enhanced Status Badge */}
                        <div className="text-center">
                          <span className={`px-3 py-1.5 rounded-full text-xs font-bold shadow-sm border-2 ${
                            totalOutstandingWithBorrowed > 0 
                              ? 'bg-gradient-to-r from-red-500 to-red-600 text-white border-red-300' 
                              : ledger.has_activity
                                ? 'bg-gradient-to-r from-green-500 to-green-600 text-white border-green-300'
                                : 'bg-gradient-to-r from-gray-400 to-gray-500 text-white border-gray-300'
                          }`}>
                            {totalOutstandingWithBorrowed > 0 
                              ? `${totalOutstandingWithBorrowed} બાકી` 
                              : ledger.has_activity ? 'ક્લિયર' : 'નિષ્ક્રિય'
                            }
                          </span>
                          {ledger.has_activity && (
                            <p className="mt-1 text-xs text-gray-500">
                              {ledger.all_transactions.length} ચલણ
                            </p>
                          )}
                        </div>
                        
                        {/* Download Button */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDownloadClientLedger(ledger);
                          }}
                          disabled={downloadingLedger === ledger.client.id}
                          className="flex items-center justify-center w-10 h-10 transition-all duration-200 rounded-full bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600 text-white shadow-lg hover:shadow-xl disabled:opacity-50 transform hover:scale-105"
                        >
                          {downloadingLedger === ledger.client.id ? (
                            <div className="w-4 h-4 border-2 border-white rounded-full border-t-transparent animate-spin" />
                          ) : (
                            <FileImage className="w-4 h-4" />
                          )}
                        </button>
                        
                        {/* Expand Icon */}
                        <div className="flex items-center justify-center w-6 h-6 bg-blue-100 rounded-full">
                          {expandedClient === ledger.client.id ? (
                            <ChevronUp className="w-4 h-4 text-blue-600" />
                          ) : (
                            <ChevronDown className="w-4 h-4 text-blue-600" />
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Enhanced Expanded Details */}
                  <AnimatePresence>
                    {expandedClient === ledger.client.id && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.3 }}
                        className="overflow-hidden border-t-2 border-blue-100 bg-gradient-to-r from-blue-50 to-indigo-50"
                      >
                        {!ledger.has_activity ? (
                          <div className="p-6 text-center text-gray-500">
                            <div className="flex items-center justify-center w-12 h-12 mx-auto mb-3 rounded-full bg-gradient-to-r from-blue-200 to-indigo-200">
                              <TrendingUp className="w-6 h-6 text-blue-400" />
                            </div>
                            <p className="text-sm font-medium text-gray-700">કોઈ પ્રવૃત્તિ નથી</p>
                            <p className="text-xs text-blue-600 mt-1">આ ગ્રાહકે હજુ સુધી કોઈ ભાડો લીધો નથી</p>
                          </div>
                        ) : (
                          <EnhancedActivityTable 
                            ledger={ledger} 
                            onDownloadChallan={handleDownloadChallan}
                            downloading={downloading}
                          />
                        )}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              );
            })}
          </AnimatePresence>

          {filteredLedgers.length === 0 && !loading && (
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="py-8 text-center bg-white border-2 border-blue-100 shadow-lg rounded-xl"
            >
              <div className="flex items-center justify-center w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-r from-blue-200 to-indigo-200">
                <User className="w-8 h-8 text-blue-400" />
              </div>
              <p className="mb-1 text-sm font-semibold text-gray-700">
                {searchTerm ? 'કોઈ ગ્રાહક મળ્યો નથી' : 'કોઈ ગ્રાહક નથી'}
              </p>
              <p className="text-xs text-blue-600">
                {searchTerm ? 'શોધ શબ્દ બદલીને પ્રયત્ન કરો' : 'નવા ગ્રાહકો ઉમેરો'}
              </p>
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm('')}
                  className="px-4 py-2 mt-3 text-xs font-medium text-white transition-colors rounded-lg bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600"
                >
                  શોધ સાફ કરો
                </button>
              )}
            </motion.div>
          )}
        </div>
      </div>
    </div>
  );
}

// Enhanced Activity Table Component
interface EnhancedActivityTableProps {
  ledger: ClientLedger;
  onDownloadChallan: (transaction: any, type: 'udhar' | 'jama') => void;
  downloading: string | null;
}

function EnhancedActivityTable({ ledger, onDownloadChallan, downloading }: EnhancedActivityTableProps) {
  const [showAllSizes, setShowAllSizes] = useState(false);
  
  // Get only plate sizes that have activity
  const activePlateSizes = PLATE_SIZES.filter(size => {
    const balance = ledger.plate_balances.find(b => b.plate_size === size);
    return balance && (balance.total_borrowed > 0 || balance.total_returned > 0);
  });

  const displaySizes = showAllSizes ? PLATE_SIZES : activePlateSizes;

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
    
    if (quantity === 0) {
      return null;
    }

    const prefix = transaction.type === 'udhar' ? '+' : '-';
    
    let borrowedStock = 0;
    if (transaction.type === 'udhar') {
      borrowedStock = getBorrowedStock(transaction, plateSize);
    } else if (transaction.type === 'jama') {
      borrowedStock = getReturnedBorrowedStock(transaction, plateSize);
    }

    const notes = getNotes(transaction, plateSize);
    const combinedTotal = quantity + borrowedStock;
    const displayQuantity = `${prefix}${combinedTotal}`;

    const supContent = [];
    if (borrowedStock > 0) {
      supContent.push(`+${borrowedStock}`);
    }
    if (notes) {
      supContent.push(notes);
    }

    return (
      <span className={`font-bold text-sm ${
        transaction.type === 'udhar' ? 'text-orange-700' : 'text-green-700'
      }`}>
        {displayQuantity}
        {supContent.length > 0 && (
          <sup className="text-xs font-bold text-purple-600 bg-purple-100 px-1 py-0.5 rounded ml-0.5 whitespace-nowrap" style={{fontSize: '8px'}}>
            {supContent.join(' ')}
          </sup>
        )}
      </span>
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
    <div className="p-3">
      {/* Enhanced Header with Toggle */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="flex items-center justify-center w-6 h-6 rounded-full bg-gradient-to-r from-blue-500 to-indigo-500">
            <Package className="w-3 h-3 text-white" />
          </div>
          <h4 className="text-sm font-semibold text-gray-900">પ્લેટ પ્રવૃત્તિ</h4>
        </div>
        
        {activePlateSizes.length !== PLATE_SIZES.length && (
          <button
            onClick={() => setShowAllSizes(!showAllSizes)}
            className="px-2 py-1 text-xs font-medium text-blue-600 border border-blue-200 rounded bg-blue-50 hover:bg-blue-100"
          >
            {showAllSizes ? 'માત્ર સક્રિય' : 'બધા સાઇઝ'}
          </button>
        )}
      </div>
      
      {/* Enhanced Responsive Table */}
      <div className="overflow-hidden bg-white border-2 border-blue-100 rounded-lg shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-white bg-gradient-to-r from-blue-500 to-indigo-500">
                <th className="sticky left-0 bg-gradient-to-r from-blue-500 to-indigo-500 px-2 py-2 text-left font-bold min-w-[70px] border-r border-blue-400">
                  <div className="text-xs">ચલણ નં.</div>
                </th>
                <th className="px-1 py-2 text-center font-bold min-w-[50px] border-l border-blue-400">
                  <div className="text-xs">તારીખ</div>
                </th>
                <th className="px-1 py-2 text-center font-bold min-w-[40px] border-l border-blue-400">
                  <div className="text-xs">કુલ</div>
                </th>
                {displaySizes.map(size => (
                  <th key={size} className="px-1 py-2 text-center font-bold min-w-[45px] border-l border-blue-400">
                    <div className="text-xs leading-tight">{size}</div>
                  </th>
                ))}
                <th className="px-1 py-2 text-center font-bold min-w-[40px] border-l border-blue-400">
                  <div className="text-xs">PDF</div>
                </th>
              </tr>
            </thead>
            <tbody>
              {/* Enhanced Current Balance Row */}
              <tr className="border-b-2 border-blue-200 bg-gradient-to-r from-blue-100 to-indigo-100">
                <td className="sticky left-0 bg-gradient-to-r from-blue-100 to-indigo-100 px-2 py-2 font-bold text-blue-900 border-r border-blue-200">
                  <div className="text-xs leading-tight">વર્તમાન<br />બેલેન્સ</div>
                </td>
                <td className="px-1 py-2 text-center border-l border-blue-200">
                  <div className="text-xs font-semibold text-blue-700">-</div>
                </td>
                <td className="px-1 py-2 text-center border-l border-blue-200">
                  <div className="text-sm font-bold text-blue-800">
                    {getAccurateGrandTotal()}
                  </div>
                </td>
                {displaySizes.map(size => {
                  const balance = getCurrentBalance(size);
                  return (
                    <td key={size} className="px-1 py-2 text-center border-l border-blue-200">
                      {balance !== 0 ? (
                        <span className={`font-bold text-sm px-1 py-0.5 rounded ${
                          balance > 0 
                            ? 'text-red-700 bg-red-100' 
                            : 'text-green-700 bg-green-100'
                        }`}>
                          {balance}
                        </span>
                      ) : (
                        <span className="text-xs text-blue-400">-</span>
                      )}
                    </td>
                  );
                })}
                <td className="px-1 py-2 text-center border-l border-blue-200">
                  <div className="text-xs font-semibold text-blue-700">-</div>
                </td>
              </tr>

              {/* Enhanced Transaction Rows */}
              {ledger.all_transactions.length === 0 ? (
                <tr>
                  <td colSpan={displaySizes.length + 4} className="px-2 py-6 text-center text-blue-500">
                    <div className="text-xs">કોઈ ચલણ નથી</div>
                  </td>
                </tr>
              ) : (
                ledger.all_transactions.map((transaction, index) => (
                  <motion.tr 
                    key={`${transaction.type}-${transaction.id}`}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className={`border-b border-blue-100 hover:bg-blue-25 transition-colors ${
                      transaction.type === 'udhar' ? 'bg-orange-50' : 'bg-green-50'
                    }`}
                  >
                    <td className={`sticky left-0 px-2 py-1.5 border-r border-blue-100 ${
                      transaction.type === 'udhar' ? 'bg-orange-50' : 'bg-green-50'
                    }`}>
                      <div className="text-xs font-semibold text-gray-900 leading-tight">
                        #{transaction.number}
                        {hasBorrowedStock(transaction) && (
                          <span className="font-bold text-purple-600">*</span>
                        )}
                        {transaction.driver_name && (
                          <div className="text-xs text-gray-600 mt-0.5 truncate max-w-[60px]">
                            {transaction.driver_name}
                          </div>
                        )}
                      </div>
                    </td>
                    
                    <td className="px-1 py-1.5 text-center border-l border-blue-100">
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
                    
                    <td className="px-1 py-1.5 text-center border-l border-blue-100">
                      <div className={`text-sm font-bold px-1 py-0.5 rounded ${
                        transaction.type === 'udhar' 
                          ? 'text-orange-700 bg-orange-100' 
                          : 'text-green-700 bg-green-100'
                      }`}>
                        {getTransactionTotalWithBorrowed(transaction)}
                      </div>
                    </td>

                    {displaySizes.map(size => {
                      const formattedDisplay = formatPlateDisplay(transaction, size);
                      return (
                        <td key={size} className="px-1 py-1.5 text-center border-l border-blue-100">
                          {formattedDisplay ? (
                            formattedDisplay
                          ) : (
                            <span className="text-xs text-gray-300">-</span>
                          )}
                        </td>
                      );
                    })}
                    
                    <td className="px-1 py-1.5 text-center border-l border-blue-100">
                      <button
                        onClick={() => onDownloadChallan(transaction, transaction.type)}
                        disabled={downloading === `${transaction.type}-${transaction.id}`}
                        className={`p-1 rounded-full transition-all duration-200 hover:shadow-md transform hover:scale-110 ${
                          transaction.type === 'udhar'
                            ? 'text-orange-600 hover:bg-orange-200 hover:text-orange-700'
                            : 'text-green-600 hover:bg-green-200 hover:text-green-700'
                        } disabled:opacity-50`}
                      >
                        {downloading === `${transaction.type}-${transaction.id}` ? (
                          <div className="w-3 h-3 border border-current rounded-full border-t-transparent animate-spin" />
                        ) : (
                          <Download className="w-3 h-3" />
                        )}
                      </button>
                    </td>
                  </motion.tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Enhanced Legend and Summary */}
        <div className="p-3 space-y-3 border-t-2 border-blue-100 bg-gradient-to-r from-blue-50 to-indigo-50">
          {/* Legend */}
          <div className="flex flex-wrap justify-center gap-3 text-xs">
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 bg-orange-400 rounded-full shadow-sm"></div>
              <span className="font-medium text-blue-700">ઉધાર (Issue)</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 bg-green-400 rounded-full shadow-sm"></div>
              <span className="font-medium text-blue-700">જમા (Return)</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="text-purple-600 font-bold">*</span>
              <span className="font-medium text-blue-700">ઉધાર સ્ટોક</span>
            </div>
            <div className="flex items-center gap-1">
              <FileImage className="w-3 h-3 text-blue-600" />
              <span className="font-medium text-blue-700">લેજર ડાઉનલોડ</span>
            </div>
          </div>

          {/* Quick Summary */}
          <div className="grid grid-cols-3 gap-2 pt-2 border-t border-blue-200">
            <div className="text-center">
              <div className="text-xs text-blue-600">કુલ ચલણ</div>
              <div className="text-sm font-bold text-blue-800">{ledger.all_transactions.length}</div>
            </div>
            <div className="text-center">
              <div className="text-xs text-blue-600">ઉધાર ચલણ</div>
              <div className="text-sm font-bold text-orange-700">
                {ledger.all_transactions.filter(t => t.type === 'udhar').length}
              </div>
            </div>
            <div className="text-center">
              <div className="text-xs text-blue-600">જમા ચલણ</div>
              <div className="text-sm font-bold text-green-700">
                {ledger.all_transactions.filter(t => t.type === 'jama').length}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default MobileLedgerPage;