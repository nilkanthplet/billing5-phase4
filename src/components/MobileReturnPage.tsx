import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Database } from '../lib/supabase';
import { 
  ArrowLeft, 
  User, 
  FileText, 
  Edit, 
  Eye, 
  Download, 
  Search,
  Calendar,
  Hash,
  MapPin,
  Phone,
  Package,
  RotateCcw,
  Save,
  X,
  Loader2,
  Lock
} from 'lucide-react';
import { format } from 'date-fns';
import { motion, AnimatePresence } from 'framer-motion';
import { generateJPGChallan, downloadJPGChallan } from '../utils/jpgChallanGenerator';
import { ChallanData } from './challans/types';
import { PrintableChallan } from './challans/PrintableChallan';
import { useAuth } from '../hooks/useAuth';

type Client = Database['public']['Tables']['clients']['Row'];
type ChallanItem = Database['public']['Tables']['challan_items']['Row'];
type ReturnLineItem = Database['public']['Tables']['return_line_items']['Row'];

const PLATE_SIZES = [
  '2 X 3', '21 X 3', '18 X 3', '15 X 3', '12 X 3',
  '9 X 3', 'પતરા', '2 X 2', '2 ફુટ'
];

interface UdharChallan {
  id: number;
  challan_number: string;
  challan_date: string;
  status: 'active' | 'completed' | 'partial';
  client: Client;
  challan_items: ChallanItem[];
  total_plates: number;
  driver_name?: string | null;
}

interface JamaChallan {
  id: number;
  return_challan_number: string;
  return_date: string;
  client: Client;
  return_line_items: ReturnLineItem[];
  total_plates: number;
  driver_name?: string | null;
}

interface EditingChallan {
  id: number;
  type: 'udhar' | 'jama';
  challan_number: string;
  date: string;
  client_id: string;
  plates: Record<string, number>;
  driver_name: string;
}

type ViewMode = 'clients' | 'challans' | 'edit' | 'view';

export function MobileReturnPage() {
  const { user } = useAuth();
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [udharChallans, setUdharChallans] = useState<UdharChallan[]>([]);
  const [jamaChallans, setJamaChallans] = useState<JamaChallan[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [viewMode, setViewMode] = useState<ViewMode>('clients');
  const [activeTab, setActiveTab] = useState<'udhar' | 'jama'>('udhar');
  const [editingChallan, setEditingChallan] = useState<EditingChallan | null>(null);
  const [editLoading, setEditLoading] = useState(false);
  const [downloading, setDownloading] = useState<number | null>(null);
  const [challanData, setChallanData] = useState<ChallanData | null>(null);
  const [viewingTransactions, setViewingTransactions] = useState<any[]>([]);

  useEffect(() => {
    fetchClients();
  }, []);

  useEffect(() => {
    if (selectedClient) {
      fetchClientChallans();
    }
  }, [selectedClient]);

  const fetchClients = async () => {
    try {
      const { data, error } = await supabase
        .from('clients')
        .select('*')
        .order('id');

      if (error) throw error;
      setClients(data || []);
    } catch (error) {
      console.error('Error fetching clients:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchClientChallans = async () => {
    if (!selectedClient) return;

    try {
      setLoading(true);
      
      // Fetch Udhar Challans
      const { data: udharData, error: udharError } = await supabase
        .from('challans')
        .select(`
          *,
          client:clients!challans_client_id_fkey(*),
          challan_items(*)
        `)
        .eq('client_id', selectedClient.id)
        .order('challan_date', { ascending: false });

      if (udharError) throw udharError;

      // Fetch Jama Challans
      const { data: jamaData, error: jamaError } = await supabase
        .from('returns')
        .select(`
          *,
          client:clients!returns_client_id_fkey(*),
          return_line_items(*)
        `)
        .eq('client_id', selectedClient.id)
        .order('return_date', { ascending: false });

      if (jamaError) throw jamaError;

      // Transform data
      const transformedUdharData = udharData?.map(challan => ({
        id: challan.id,
        challan_number: challan.challan_number,
        challan_date: challan.challan_date,
        status: challan.status as 'active' | 'completed' | 'partial',
        client: challan.client as Client,
        challan_items: challan.challan_items as ChallanItem[],
        total_plates: challan.challan_items?.reduce(
          (sum: number, item: ChallanItem) => sum + (item.borrowed_quantity || 0), 
          0
        ),
        driver_name: challan.driver_name
      })) || [];

      const transformedJamaData = jamaData?.map(challan => ({
        id: challan.id,
        return_challan_number: challan.return_challan_number,
        return_date: challan.return_date,
        client: challan.client as Client,
        return_line_items: challan.return_line_items as ReturnLineItem[],
        total_plates: challan.return_line_items?.reduce(
          (sum: number, item: ReturnLineItem) => sum + (item.returned_quantity || 0), 
          0
        ),
        driver_name: challan.driver_name
      })) || [];

      setUdharChallans(transformedUdharData);
      setJamaChallans(transformedJamaData);
    } catch (error) {
      console.error('Error fetching challans:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleEditChallan = async (challan: UdharChallan | JamaChallan, type: 'udhar' | 'jama') => {
    try {
      if (type === 'udhar') {
        const udharChallan = challan as UdharChallan;
        const plates: Record<string, number> = {};
        udharChallan.challan_items.forEach((item: ChallanItem) => {
          plates[item.plate_size] = item.borrowed_quantity;
        });

        setEditingChallan({
          id: udharChallan.id,
          type: 'udhar',
          challan_number: udharChallan.challan_number,
          date: udharChallan.challan_date,
          client_id: udharChallan.client.id,
          plates,
          driver_name: udharChallan.driver_name || ''
        });
      } else {
        const jamaChallan = challan as JamaChallan;
        const plates: Record<string, number> = {};
        jamaChallan.return_line_items.forEach((item: ReturnLineItem) => {
          plates[item.plate_size] = item.returned_quantity;
        });

        setEditingChallan({
          id: jamaChallan.id,
          type: 'jama',
          challan_number: jamaChallan.return_challan_number,
          date: jamaChallan.return_date,
          client_id: jamaChallan.client.id,
          plates,
          driver_name: jamaChallan.driver_name || ''
        });
      }
      setViewMode('edit');
    } catch (error) {
      console.error('Error preparing edit:', error);
      alert('ચલણ એડિટ કરવામાં ભૂલ.');
    }
  };

  const handleSaveEdit = async () => {
    if (!editingChallan) return;

    setEditLoading(true);
    try {
      if (editingChallan.type === 'udhar') {
        // Update challan
        const { error: challanError } = await supabase
          .from('challans')
          .update({
            challan_number: editingChallan.challan_number,
            challan_date: editingChallan.date,
            driver_name: editingChallan.driver_name || null
          })
          .eq('id', editingChallan.id);

        if (challanError) throw challanError;

        // Delete existing items
        const { error: deleteError } = await supabase
          .from('challan_items')
          .delete()
          .eq('challan_id', editingChallan.id);

        if (deleteError) throw deleteError;

        // Insert new items
        const newItems = Object.entries(editingChallan.plates)
          .filter(([_, quantity]) => quantity > 0)
          .map(([plate_size, quantity]) => ({
            challan_id: editingChallan.id,
            plate_size,
            borrowed_quantity: quantity,
          }));

        if (newItems.length > 0) {
          const { error: insertError } = await supabase
            .from('challan_items')
            .insert(newItems);

          if (insertError) throw insertError;
        }
      } else {
        // Update return
        const { error: returnError } = await supabase
          .from('returns')
          .update({
            return_challan_number: editingChallan.challan_number,
            return_date: editingChallan.date,
            driver_name: editingChallan.driver_name || null
          })
          .eq('id', editingChallan.id);

        if (returnError) throw returnError;

        // Delete existing items
        const { error: deleteError } = await supabase
          .from('return_line_items')
          .delete()
          .eq('return_id', editingChallan.id);

        if (deleteError) throw deleteError;

        // Insert new items
        const newItems = Object.entries(editingChallan.plates)
          .filter(([_, quantity]) => quantity > 0)
          .map(([plate_size, quantity]) => ({
            return_id: editingChallan.id,
            plate_size,
            returned_quantity: quantity,
          }));

        if (newItems.length > 0) {
          const { error: insertError } = await supabase
            .from('return_line_items')
            .insert(newItems);

          if (insertError) throw insertError;
        }
      }

      setEditingChallan(null);
      setViewMode('challans');
      await fetchClientChallans();
      alert('ચલણ સફળતાપૂર્વક અપડેટ થયું!');
    } catch (error) {
      console.error('Error updating challan:', error);
      alert('ચલણ અપડેટ કરવામાં ભૂલ. કૃપા કરીને ફરી પ્રયત્ન કરો.');
    } finally {
      setEditLoading(false);
    }
  };

  const handleViewChallan = (challan: UdharChallan | JamaChallan, type: 'udhar' | 'jama') => {
    // Prepare transactions for ledger-style view
    const transactions = [];
    
    if (type === 'udhar') {
      const udharChallan = challan as UdharChallan;
      transactions.push({
        type: 'udhar' as const,
        id: udharChallan.id,
        number: udharChallan.challan_number,
        date: udharChallan.challan_date,
        client_id: udharChallan.client.id,
        items: udharChallan.challan_items.map(item => ({
          plate_size: item.plate_size,
          quantity: item.borrowed_quantity,
          borrowed_stock: item.borrowed_stock || 0,
          notes: item.partner_stock_notes || ''
        })),
        driver_name: udharChallan.driver_name
      });
    } else {
      const jamaChallan = challan as JamaChallan;
      transactions.push({
        type: 'jama' as const,
        id: jamaChallan.id,
        number: jamaChallan.return_challan_number,
        date: jamaChallan.return_date,
        client_id: jamaChallan.client.id,
        items: jamaChallan.return_line_items.map(item => ({
          plate_size: item.plate_size,
          quantity: item.returned_quantity,
          returned_borrowed_stock: item.returned_borrowed_stock || 0,
          notes: item.damage_notes || ''
        })),
        driver_name: jamaChallan.driver_name
      });
    }

    setViewingTransactions(transactions);
    setViewMode('view');
  };

  const handleDownload = async (challan: UdharChallan | JamaChallan, type: 'udhar' | 'jama') => {
    try {
      setDownloading(challan.id);
      
      const challanDataForPDF: ChallanData = {
        type: type === 'udhar' ? 'issue' : 'return',
        challan_number: type === 'udhar' 
          ? (challan as UdharChallan).challan_number 
          : (challan as JamaChallan).return_challan_number,
        date: type === 'udhar' 
          ? (challan as UdharChallan).challan_date 
          : (challan as JamaChallan).return_date,
        client: {
          id: challan.client.id,
          name: challan.client.name,
          site: challan.client.site || '',
          mobile: challan.client.mobile_number || ''
        },
        driver_name: challan.driver_name || undefined,
        plates: type === 'udhar' 
          ? (challan as UdharChallan).challan_items.map(item => ({
              size: item.plate_size,
              quantity: item.borrowed_quantity,
              borrowed_stock: item.borrowed_stock || 0,
              notes: item.partner_stock_notes || '',
            }))
          : (challan as JamaChallan).return_line_items.map(item => ({
              size: item.plate_size,
              quantity: item.returned_quantity,
              notes: item.damage_notes || '',
            })),
        total_quantity: challan.total_plates
      };

      setChallanData(challanDataForPDF);
      await new Promise(resolve => setTimeout(resolve, 500));

      const jpgDataUrl = await generateJPGChallan(challanDataForPDF);
      downloadJPGChallan(jpgDataUrl, `${type}-challan-${challanDataForPDF.challan_number}`);

      setChallanData(null);
    } catch (error) {
      console.error('Error downloading challan:', error);
      alert('ચલણ ડાઉનલોડ કરવામાં ભૂલ. કૃપા કરીને ફરી પ્રયત્ન કરો.');
    } finally {
      setDownloading(null);
    }
  };

  const filteredClients = clients.filter(client =>
    client.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    client.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (client.site || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  const currentChallans = activeTab === 'udhar' ? udharChallans : jamaChallans;

  // Clients List View
  if (viewMode === 'clients') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-cyan-50">
        <div className="p-4 space-y-4">
          {/* Header */}
          <div className="text-center">
            <div className="inline-flex items-center justify-center w-10 h-10 mb-2 rounded-full shadow-lg bg-gradient-to-r from-blue-600 to-indigo-600">
              <User className="w-5 h-5 text-white" />
            </div>
            <h1 className="mb-1 text-base font-bold text-gray-900">ગ્રાહક પસંદ કરો</h1>
            <p className="text-xs text-blue-600">ચલણ જોવા માટે ગ્રાહક પસંદ કરો</p>
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="absolute w-4 h-4 text-blue-400 transform -translate-y-1/2 left-3 top-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="ગ્રાહક શોધો..."
              className="w-full py-2 pl-10 pr-3 text-sm transition-all duration-200 border-2 border-blue-200 rounded-lg focus:ring-4 focus:ring-blue-100 focus:border-blue-500"
            />
          </div>

          {/* Clients List */}
          <div className="space-y-3">
            {loading ? (
              <div className="space-y-2">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="p-3 bg-white border border-blue-100 rounded-lg shadow-sm animate-pulse">
                    <div className="w-2/3 h-4 mb-2 bg-blue-200 rounded"></div>
                    <div className="w-1/2 h-3 bg-blue-200 rounded"></div>
                  </div>
                ))}
              </div>
            ) : filteredClients.length === 0 ? (
              <div className="py-8 text-center bg-white border-2 border-blue-100 shadow-lg rounded-xl">
                <User className="w-12 h-12 mx-auto mb-4 text-blue-300" />
                <p className="mb-1 text-sm font-semibold text-gray-700">કોઈ ગ્રાહક મળ્યો નથી</p>
                <p className="text-xs text-blue-600">શોધ શબ્દ બદલીને પ્રયત્ન કરો</p>
              </div>
            ) : (
              filteredClients.map((client) => (
                <motion.div
                  key={client.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="overflow-hidden transition-all duration-200 bg-white border-2 border-blue-100 shadow-lg rounded-xl hover:shadow-xl hover:border-blue-200"
                >
                  <button
                    onClick={() => {
                      setSelectedClient(client);
                      setViewMode('challans');
                    }}
                    className="w-full p-3 text-left"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex items-center justify-center w-8 h-8 text-sm font-bold text-white rounded-full shadow-md bg-gradient-to-r from-blue-500 to-indigo-500">
                        {client.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1">
                        <h3 className="text-sm font-bold text-gray-900">{client.name}</h3>
                        <div className="flex items-center gap-2 mt-1 text-xs text-blue-600">
                          <span className="flex items-center gap-0.5">
                            <Hash className="w-2.5 h-2.5" />
                            {client.id}
                          </span>
                          <span className="flex items-center gap-0.5">
                            <MapPin className="w-2.5 h-2.5" />
                            {client.site}
                          </span>
                        </div>
                        <div className="flex items-center gap-1 mt-1 text-xs text-blue-600">
                          <Phone className="w-2.5 h-2.5" />
                          <span>{client.mobile_number}</span>
                        </div>
                      </div>
                    </div>
                  </button>
                </motion.div>
              ))
            )}
          </div>
        </div>
      </div>
    );
  }

  // Challans List View
  if (viewMode === 'challans') {
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
          {/* Header with Back Button */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => setViewMode('clients')}
              className="flex items-center justify-center w-8 h-8 text-blue-600 transition-colors bg-white border-2 border-blue-200 rounded-lg hover:bg-blue-50"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div className="flex-1 text-center">
              <h1 className="text-sm font-bold text-gray-900">{selectedClient?.name}</h1>
              <p className="text-xs text-blue-600">ચલણ વ્યવસ્થાપન</p>
            </div>
          </div>

          {/* Tab Navigation */}
          <div className="p-1.5 bg-white border-2 border-blue-100 shadow-lg rounded-xl">
            <div className="grid grid-cols-2 gap-1.5">
              <button
                onClick={() => setActiveTab('udhar')}
                className={`flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg font-medium text-xs transition-all duration-200 ${
                  activeTab === 'udhar'
                    ? 'bg-gradient-to-r from-red-500 to-orange-500 text-white shadow-lg transform scale-105'
                    : 'text-blue-600 hover:bg-blue-50'
                }`}
              >
                <FileText className="w-3 h-3" />
                <span>ઉધાર ચલણ</span>
              </button>
              <button
                onClick={() => setActiveTab('jama')}
                className={`flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg font-medium text-xs transition-all duration-200 ${
                  activeTab === 'jama'
                    ? 'bg-gradient-to-r from-green-500 to-emerald-500 text-white shadow-lg transform scale-105'
                    : 'text-blue-600 hover:bg-blue-50'
                }`}
              >
                <RotateCcw className="w-3 h-3" />
                <span>જમા ચલણ</span>
              </button>
            </div>
          </div>

          {/* Challans List */}
          <div className="space-y-2">
            {loading ? (
              <div className="space-y-2">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="p-3 bg-white border border-blue-100 rounded-lg shadow-sm animate-pulse">
                    <div className="w-2/3 h-4 mb-2 bg-blue-200 rounded"></div>
                    <div className="w-1/2 h-3 bg-blue-200 rounded"></div>
                  </div>
                ))}
              </div>
            ) : currentChallans.length === 0 ? (
              <div className="py-8 text-center bg-white border-2 border-blue-100 shadow-lg rounded-xl">
                <div className={`w-12 h-12 mx-auto mb-3 rounded-full flex items-center justify-center ${
                  activeTab === 'udhar' ? 'bg-red-100' : 'bg-green-100'
                }`}>
                  {activeTab === 'udhar' ? (
                    <FileText className="w-6 h-6 text-red-600" />
                  ) : (
                    <RotateCcw className="w-6 h-6 text-green-600" />
                  )}
                </div>
                <p className="mb-1 text-sm font-semibold text-gray-700">
                  {activeTab === 'udhar' 
                    ? 'કોઈ ઉધાર ચલણ મળ્યું નથી' 
                    : 'કોઈ જમા ચલણ મળ્યું નથી'
                  }
                </p>
              </div>
            ) : (
              currentChallans.map((challan) => (
                <motion.div
                  key={challan.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="overflow-hidden transition-all duration-200 bg-white border-2 border-blue-100 shadow-lg rounded-xl hover:shadow-xl hover:border-blue-200"
                >
                  <div className="p-3">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1">
                        <div className="flex items-center gap-1.5 mb-1">
                          <div className="flex items-center justify-center w-5 h-5 rounded-full bg-gradient-to-r from-blue-500 to-indigo-500">
                            <Hash className="w-2.5 h-2.5 text-white" />
                          </div>
                          <span className="text-xs font-semibold text-gray-900">
                            {activeTab === 'udhar' 
                              ? (challan as UdharChallan).challan_number
                              : (challan as JamaChallan).return_challan_number
                            }
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 mb-0.5 text-xs text-blue-600">
                          <Calendar className="w-2.5 h-2.5" />
                          <span>
                            {format(new Date(
                              activeTab === 'udhar' 
                                ? (challan as UdharChallan).challan_date
                                : (challan as JamaChallan).return_date
                            ), 'dd/MM/yyyy')}
                          </span>
                        </div>
                        {challan.driver_name && (
                          <div className="flex items-center gap-1.5 text-xs text-blue-600">
                            <User className="w-2.5 h-2.5" />
                            <span>{challan.driver_name}</span>
                          </div>
                        )}
                      </div>
                      <div className="flex flex-col items-end gap-1.5">
                        <span className="text-xs font-medium text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded-full">
                          {challan.total_plates} પ્લેટ્સ
                        </span>
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex gap-1.5">
                      {user?.isAdmin ? (
                        <button
                          onClick={() => handleEditChallan(challan, activeTab)}
                          className="flex items-center justify-center flex-1 gap-1 px-1.5 py-1.5 text-xs font-medium text-blue-700 transition-colors bg-blue-100 rounded-lg hover:bg-blue-200"
                        >
                          <Edit className="w-2.5 h-2.5" />
                          એડિટ
                        </button>
                      ) : (
                        <div className="flex items-center justify-center flex-1 gap-1 px-1.5 py-1.5 text-xs font-medium text-gray-500 bg-gray-200 rounded-lg">
                          <Lock className="w-2.5 h-2.5" />
                          લૉક
                        </div>
                      )}
                      <button
                        onClick={() => handleViewChallan(challan, activeTab)}
                        className="flex items-center justify-center flex-1 gap-1 px-1.5 py-1.5 text-xs font-medium text-blue-700 transition-colors bg-blue-100 rounded-lg hover:bg-blue-200"
                      >
                        <Eye className="w-2.5 h-2.5" />
                        જુઓ
                      </button>
                      <button
                        onClick={() => handleDownload(challan, activeTab)}
                        disabled={downloading === challan.id}
                        className={`flex-1 py-1.5 px-1.5 rounded-lg text-xs font-medium transition-colors flex items-center justify-center gap-1 ${
                          activeTab === 'udhar'
                            ? 'bg-gradient-to-r from-red-500 to-orange-500 hover:from-red-600 hover:to-orange-600 text-white'
                            : 'bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white'
                        } disabled:opacity-50`}
                      >
                        <Download className="w-2.5 h-2.5" />
                        {downloading === challan.id ? 'લોડિંગ...' : 'ડાઉનલોડ'}
                      </button>
                    </div>
                  </div>
                </motion.div>
              ))
            )}
          </div>
        </div>
      </div>
    );
  }

  // Edit View (similar to MobileIssueRental)
  if (viewMode === 'edit' && editingChallan) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-orange-50 via-red-50 to-pink-50">
        <div className="p-4 space-y-4">
          {/* Header */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => setViewMode('challans')}
              className="flex items-center justify-center w-8 h-8 text-blue-600 transition-colors bg-white border-2 border-blue-200 rounded-lg hover:bg-blue-50"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div className="flex-1 text-center">
              <h1 className="text-sm font-bold text-gray-900">
                {editingChallan.type === 'udhar' ? 'ઉધાર' : 'જમા'} ચલણ એડિટ કરો
              </h1>
              <p className="text-xs text-blue-600">#{editingChallan.challan_number}</p>
            </div>
          </div>

          {/* Edit Form */}
          <div className="overflow-hidden bg-white border border-gray-100 rounded-lg shadow-sm">
            <div className={`p-2 ${
              editingChallan.type === 'udhar' 
                ? 'bg-gradient-to-r from-red-500 to-orange-500' 
                : 'bg-gradient-to-r from-green-500 to-emerald-500'
            }`}>
              <h2 className="flex items-center gap-1 text-xs font-bold text-white">
                <Package className="w-3 h-3" />
                ચલણ વિગતો
              </h2>
            </div>

            <div className="p-3 space-y-3">
              {/* Basic Details */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block mb-1 text-xs font-medium text-gray-700">
                    ચલણ નંબર *
                  </label>
                  <input
                    type="text"
                    value={editingChallan.challan_number}
                    onChange={(e) => setEditingChallan({
                      ...editingChallan,
                      challan_number: e.target.value
                    })}
                    className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-blue-200 focus:border-blue-400"
                  />
                </div>
                <div>
                  <label className="block mb-1 text-xs font-medium text-gray-700">
                    તારીખ *
                  </label>
                  <input
                    type="date"
                    value={editingChallan.date}
                    onChange={(e) => setEditingChallan({
                      ...editingChallan,
                      date: e.target.value
                    })}
                    className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-blue-200 focus:border-blue-400"
                  />
                </div>
              </div>

              {/* Driver Name */}
              <div>
                <label className="block mb-1 text-xs font-medium text-gray-700">
                  ડ્રાઈવરનું નામ
                </label>
                <input
                  type="text"
                  value={editingChallan.driver_name}
                  onChange={(e) => setEditingChallan({
                    ...editingChallan,
                    driver_name: e.target.value
                  })}
                  className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-blue-200 focus:border-blue-400"
                  placeholder="ડ્રાઈવરનું નામ દાખલ કરો"
                />
              </div>

              {/* Plates Table */}
              <div className="overflow-x-auto">
                <table className="w-full overflow-hidden text-xs rounded">
                  <thead>
                    <tr className="text-white bg-gradient-to-r from-blue-500 to-indigo-500">
                      <th className="px-1 py-1 font-medium text-left">સાઇઝ</th>
                      <th className="px-1 py-1 font-medium text-center">માત્રા</th>
                    </tr>
                  </thead>
                  <tbody>
                    {PLATE_SIZES.map((size, index) => (
                      <tr key={size} className={index % 2 === 0 ? 'bg-gray-50' : 'bg-white'}>
                        <td className="px-1 py-1 font-medium">{size}</td>
                        <td className="px-1 py-1 text-center">
                          <input
                            type="number"
                            min={0}
                            value={editingChallan.plates[size] || ''}
                            onChange={(e) => setEditingChallan({
                              ...editingChallan,
                              plates: {
                                ...editingChallan.plates,
                                [size]: parseInt(e.target.value) || 0
                              }
                            })}
                            className="w-10 px-0.5 py-0.5 border border-gray-300 rounded text-center"
                            placeholder="0"
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Total */}
              <div className="p-2 border border-blue-200 rounded bg-blue-50">
                <div className="text-center">
                  <span className="text-sm font-bold text-blue-800">
                    કુલ: {Object.values(editingChallan.plates).reduce((sum, qty) => sum + (qty || 0), 0)} પ્લેટ્સ
                  </span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-2">
                <button
                  onClick={handleSaveEdit}
                  disabled={editLoading}
                  className="flex items-center justify-center flex-1 gap-1 px-2 py-2 text-xs font-medium text-white transition-colors rounded-lg bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 disabled:opacity-50"
                >
                  {editLoading ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    <Save className="w-3 h-3" />
                  )}
                  સેવ કરો
                </button>
                <button
                  onClick={() => setViewMode('challans')}
                  disabled={editLoading}
                  className="flex-1 px-2 py-2 text-xs font-medium text-white transition-colors bg-gray-500 rounded-lg hover:bg-gray-600 disabled:opacity-50"
                >
                  રદ કરો
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // View Mode (Ledger-style)
  if (viewMode === 'view') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-cyan-50">
        <div className="p-4 space-y-4">
          {/* Header */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => setViewMode('challans')}
              className="flex items-center justify-center w-8 h-8 text-blue-600 transition-colors bg-white border-2 border-blue-200 rounded-lg hover:bg-blue-50"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div className="flex-1 text-center">
              <h1 className="text-sm font-bold text-gray-900">ચલણ વિગતો</h1>
              <p className="text-xs text-blue-600">{selectedClient?.name}</p>
            </div>
          </div>

          {/* Ledger-style Table */}
          <div className="overflow-hidden bg-white border-2 border-blue-100 rounded-lg shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-white bg-gradient-to-r from-blue-500 to-indigo-500">
                    <th className="sticky left-0 bg-gradient-to-r from-blue-500 to-indigo-500 px-1 py-1 text-left font-bold min-w-[50px]">
                      ચલણ નં.
                    </th>
                    <th className="px-1 py-1 text-center font-bold min-w-[50px] border-l border-blue-400">
                      તારીખ
                    </th>
                    <th className="px-1 py-1 text-center font-bold min-w-[50px] border-l border-blue-400">
                      કુલ
                    </th>
                    {PLATE_SIZES.map(size => (
                      <th key={size} className="px-1 py-1 text-center font-bold min-w-[60px] border-l border-blue-400">
                        {size}
                      </th>
                    ))}
                    <th className="px-1 py-1 text-center font-bold min-w-[40px] border-l border-blue-400">
                      ડ્રાઈવર
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {viewingTransactions.map((transaction) => (
                    <tr 
                      key={`${transaction.type}-${transaction.id}`}
                      className={`border-b border-blue-100 ${
                        transaction.type === 'udhar' ? 'bg-yellow-50' : 'bg-green-50'
                      }`}
                    >
                      <td className={`sticky left-0 px-1 py-1 border-r border-blue-100 ${
                        transaction.type === 'udhar' ? 'bg-yellow-50' : 'bg-green-50'
                      }`}>
                        <div className="text-xs font-semibold text-gray-900">
                          #{transaction.number}
                        </div>
                      </td>
                      
                      <td className="px-1 py-1 text-center border-l border-blue-100">
                        <div className="text-xs font-medium text-blue-600">
                          {format(new Date(transaction.date), 'dd/MM/yy')}
                        </div>
                      </td>
                      
                      <td className="px-1 py-1 text-center border-l border-blue-100">
                        <div className="text-xs font-medium text-blue-600">
                          {transaction.items.reduce((sum: number, item: any) => {
                            const regularQty = item.quantity || 0;
                            const borrowedQty = transaction.type === 'udhar' 
                              ? (item.borrowed_stock || 0) 
                              : (item.returned_borrowed_stock || 0);
                            return sum + regularQty + borrowedQty;
                          }, 0)}
                        </div>
                      </td>

                      {PLATE_SIZES.map(size => {
                        const item = transaction.items.find((i: any) => i.plate_size === size);
                        const quantity = item?.quantity || 0;
                        let borrowedStock = 0;
                        
                        if (transaction.type === 'udhar') {
                          borrowedStock = item?.borrowed_stock || 0;
                        } else {
                          borrowedStock = item?.returned_borrowed_stock || 0;
                        }

                        const hasData = quantity > 0 || borrowedStock > 0;
                        const prefix = transaction.type === 'udhar' ? '+' : '-';

                        return (
                          <td key={size} className="px-1 py-1 text-center border-l border-blue-100">
                            {hasData ? (
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
                              </div>
                            ) : (
                              <span className="text-xs text-gray-300">-</span>
                            )}
                          </td>
                        );
                      })}

                      <td className="px-1 py-1 text-center border-l border-blue-100">
                        <div className="text-xs font-medium text-gray-600">
                          {transaction.driver_name || '-'}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return null;
}