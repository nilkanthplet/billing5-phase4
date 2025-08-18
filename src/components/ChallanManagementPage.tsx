import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Link } from 'react-router-dom';
import { 
  Download, 
  Eye, 
  Search, 
  ChevronDown, 
  ChevronUp, 
  Calendar, 
  User, 
  Hash, 
  FileText, 
  RotateCcw, 
  Edit, 
  Save, 
  X, 
  Trash2, 
  BookOpen, 
  Lock,
  ArrowLeft,
  Package,
  Plus
} from 'lucide-react';
import { format } from 'date-fns';
import { motion, AnimatePresence } from 'framer-motion';
import { T, useTranslation } from '../contexts/LanguageContext';
import { generateJPGChallan, downloadJPGChallan } from '../utils/jpgChallanGenerator';
import { PrintableChallan } from './challans/PrintableChallan';
import { ChallanData } from './challans/types';
import { useAuth } from '../hooks/useAuth';

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

interface Client {
  id: string;
  name: string;
  site: string;
  mobile_number: string;
}

interface ChallanItem {
  id: number;
  challan_id: number;
  plate_size: string;
  borrowed_quantity: number;
  partner_stock_notes?: string | null;
  status: string;
  borrowed_stock: number;
}

interface ReturnLineItem {
  id: number;
  return_id: number;
  plate_size: string;
  returned_quantity: number;
  damage_notes?: string | null;
  damaged_quantity: number;
  lost_quantity: number;
  returned_borrowed_stock: number;
}

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
  note: string;
  driver_name: string;
}

interface ClientLedger {
  client: Client;
  udhar_challans: UdharChallan[];
  jama_challans: JamaChallan[];
  total_outstanding: number;
  has_activity: boolean;
}

export function ChallanManagementPage() {
  const { user } = useAuth();
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [clientLedger, setClientLedger] = useState<ClientLedger | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedChallan, setExpandedChallan] = useState<number | null>(null);
  const [downloading, setDownloading] = useState<number | null>(null);
  const [challanData, setChallanData] = useState<ChallanData | null>(null);
  const { language } = useTranslation();
  const [editingChallan, setEditingChallan] = useState<EditingChallan | null>(null);
  const [editLoading, setEditLoading] = useState(false);
  const [stockData, setStockData] = useState<any[]>([]);

  useEffect(() => {
    fetchClients();
    fetchStockData();
  }, []);

  const fetchStockData = async () => {
    try {
      const { data, error } = await supabase
        .from('stock')
        .select('*')
        .order('plate_size');

      if (error) throw error;
      setStockData(data || []);
    } catch (error) {
      console.error('Error fetching stock data:', error);
    }
  };

  const fetchClients = async () => {
    try {
      const { data, error } = await supabase
        .from('clients')
        .select('*')
        .order('name');

      if (error) throw error;
      setClients(data || []);
    } catch (error) {
      console.error('Error fetching clients:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchClientChallans = async (client: Client) => {
    try {
      setLoading(true);
      
      // Fetch Udhar Challans
      const { data: udharData, error: udharError } = await supabase
        .from('challans')
        .select(`
          *,
          challan_items(*)
        `)
        .eq('client_id', client.id)
        .order('challan_date', { ascending: false });

      if (udharError) throw udharError;

      // Fetch Jama Challans
      const { data: jamaData, error: jamaError } = await supabase
        .from('returns')
        .select(`
          *,
          return_line_items(*)
        `)
        .eq('client_id', client.id)
        .order('return_date', { ascending: false });

      if (jamaError) throw jamaError;

      // Transform data
      const transformedUdharData = udharData?.map(challan => ({
        id: challan.id,
        challan_number: challan.challan_number,
        challan_date: challan.challan_date,
        status: challan.status as 'active' | 'completed' | 'partial',
        client: client,
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
        client: client,
        return_line_items: challan.return_line_items as ReturnLineItem[],
        total_plates: challan.return_line_items?.reduce(
          (sum: number, item: ReturnLineItem) => sum + (item.returned_quantity || 0), 
          0
        ),
        driver_name: challan.driver_name
      })) || [];

      // Calculate outstanding
      const totalBorrowed = transformedUdharData.reduce((sum, challan) => sum + challan.total_plates, 0);
      const totalReturned = transformedJamaData.reduce((sum, challan) => sum + challan.total_plates, 0);
      const total_outstanding = totalBorrowed - totalReturned;

      setClientLedger({
        client,
        udhar_challans: transformedUdharData,
        jama_challans: transformedJamaData,
        total_outstanding,
        has_activity: transformedUdharData.length > 0 || transformedJamaData.length > 0
      });
    } catch (error) {
      console.error('Error fetching client challans:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleClientSelect = (client: Client) => {
    setSelectedClient(client);
    setExpandedChallan(null);
    setEditingChallan(null);
    fetchClientChallans(client);
  };

  const handleEditChallan = async (challan: UdharChallan | JamaChallan, type: 'udhar' | 'jama') => {
    try {
      if (type === 'udhar') {
        const { data, error } = await supabase
          .from('challans')
          .select(`
            *,
            challan_items(*)
          `)
          .eq('id', challan.id)
          .single();

        if (error) throw error;

        const plates: Record<string, number> = {};
        (data.challan_items as ChallanItem[]).forEach((item: ChallanItem) => {
          plates[item.plate_size] = item.borrowed_quantity;
        });

        setEditingChallan({
          id: challan.id,
          type: 'udhar',
          challan_number: data.challan_number,
          date: data.challan_date,
          client_id: data.client_id,
          plates,
          note: '',
          driver_name: data.driver_name || ''
        });
      } else {
        const { data, error } = await supabase
          .from('returns')
          .select(`
            *,
            return_line_items(*)
          `)
          .eq('id', challan.id)
          .single();

        if (error) throw error;

        const plates: Record<string, number> = {};
        (data.return_line_items as ReturnLineItem[]).forEach((item: ReturnLineItem) => {
          plates[item.plate_size] = item.returned_quantity;
        });

        setEditingChallan({
          id: challan.id,
          type: 'jama',
          challan_number: data.return_challan_number,
          date: data.return_date,
          client_id: data.client_id,
          plates,
          note: data.return_line_items[0]?.damage_notes || '',
          driver_name: data.driver_name || ''
        });
      }
    } catch (error) {
      console.error('Error fetching challan details:', error);
      alert('ચલણ વિગતો લોડ કરવામાં ભૂલ.');
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
            client_id: editingChallan.client_id,
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
            partner_stock_notes: editingChallan.note?.trim() || null
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
            client_id: editingChallan.client_id,
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
            damage_notes: editingChallan.note || null
          }));

        if (newItems.length > 0) {
          const { error: insertError } = await supabase
            .from('return_line_items')
            .insert(newItems);

          if (insertError) throw insertError;
        }
      }

      setEditingChallan(null);
      if (selectedClient) {
        await fetchClientChallans(selectedClient);
      }
      alert('ચલણ સફળતાપૂર્વક અપડેટ થયું!');
    } catch (error) {
      console.error('Error updating challan:', error);
      alert('ચલણ અપડેટ કરવામાં ભૂલ. કૃપા કરીને ફરી પ્રયત્ન કરો.');
    } finally {
      setEditLoading(false);
    }
  };

  const handleDeleteChallan = async () => {
    if (!editingChallan) return;

    const confirmDelete = confirm(`શું તમે ખરેખર આ ${editingChallan.type} ચલણ ડિલીટ કરવા માંગો છો? આ ક્રિયા પૂર્વવત્ કરી શકાશે નહીં.`);
    if (!confirmDelete) return;

    setEditLoading(true);
    try {
      if (editingChallan.type === 'udhar') {
        const { error } = await supabase
          .from('challans')
          .delete()
          .eq('id', editingChallan.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('returns')
          .delete()
          .eq('id', editingChallan.id);

        if (error) throw error;
      }

      setEditingChallan(null);
      if (selectedClient) {
        await fetchClientChallans(selectedClient);
      }
      alert('ચલણ સફળતાપૂર્વક ડિલીટ થયું!');
    } catch (error) {
      console.error('Error deleting challan:', error);
      alert('ચલણ ડિલીટ કરવામાં ભૂલ. કૃપા કરીને ફરી પ્રયત્ન કરો.');
    } finally {
      setEditLoading(false);
    }
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

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-800 border border-green-200';
      case 'partial':
        return 'bg-yellow-100 text-yellow-800 border border-yellow-200';
      case 'active':
        return 'bg-blue-100 text-blue-800 border border-blue-200';
      default:
        return 'bg-gray-100 text-gray-800 border border-gray-200';
    }
  };

  const getStatusText = (status: string) => {
    const statusMap = {
      'active': { gu: 'સક્રિય', en: 'Active' },
      'completed': { gu: 'પૂર્ણ', en: 'Completed' },
      'partial': { gu: 'અર્ધ', en: 'Partial' },
      'returned': { gu: 'પરત', en: 'Returned' }
    };
    return statusMap[status as keyof typeof statusMap]?.[language] || status;
  };

  const filteredClients = clients.filter(client =>
    client.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    client.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
    client.site.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getStockInfo = (size: string) => {
    return stockData.find(s => s.plate_size === size);
  };

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

      <div className="p-2 space-y-3">
        {/* Header */}
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-8 h-8 mb-2 rounded-full shadow-lg bg-gradient-to-r from-blue-600 to-indigo-600">
            <BookOpen className="w-4 h-4 text-white" />
          </div>
          <h1 className="mb-1 text-sm font-bold text-gray-900">ચલણ બૂક</h1>
          <p className="text-xs text-blue-600">ગ્રાહક પસંદ કરો અને ચલણ જુઓ</p>
        </div>

        {/* Client List or Selected Client View */}
        {!selectedClient ? (
          <>
            {/* Search Bar */}
            <div className="relative">
              <Search className="absolute w-3 h-3 text-blue-400 -translate-y-1/2 left-2 top-1/2" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="ગ્રાહક શોધો..."
                className="w-full py-2 pl-8 pr-2 text-xs transition-all duration-200 border-2 border-blue-200 rounded-lg focus:ring-4 focus:ring-blue-100 focus:border-blue-500"
              />
            </div>

            {/* Client List */}
            <div className="space-y-2">
              {loading ? (
                <div className="space-y-2">
                  {[...Array(5)].map((_, i) => (
                    <div key={i} className="p-3 bg-white border border-blue-100 shadow-sm rounded-xl animate-pulse">
                      <div className="w-2/3 h-4 mb-2 bg-blue-200 rounded"></div>
                      <div className="w-1/2 h-3 bg-blue-200 rounded"></div>
                    </div>
                  ))}
                </div>
              ) : filteredClients.length === 0 ? (
                <div className="py-8 text-center bg-white border-2 border-blue-100 shadow-lg rounded-xl">
                  <User className="w-12 h-12 mx-auto mb-4 text-blue-300" />
                  <p className="mb-1 text-sm font-semibold text-gray-700">
                    {searchTerm ? 'કોઈ ગ્રાહક મળ્યો નથી' : 'કોઈ ગ્રાહક નથી'}
                  </p>
                  <p className="text-xs text-blue-600">
                    {searchTerm ? 'શોધ માપદંડ બદલીને ફરી પ્રયાસ કરો' : 'નવા ગ્રાહકો ઉમેરો'}
                  </p>
                </div>
              ) : (
                filteredClients.map((client) => (
                  <motion.div
                    key={client.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="overflow-hidden transition-all duration-200 bg-white border-2 border-blue-100 shadow-lg rounded-xl hover:shadow-xl hover:border-blue-200 cursor-pointer"
                    onClick={() => handleClientSelect(client)}
                  >
                    <div className="p-3">
                      <div className="flex items-center gap-3">
                        <div className="flex items-center justify-center w-8 h-8 text-sm font-bold text-white rounded-full shadow-md bg-gradient-to-r from-blue-500 to-indigo-500">
                          {client.name.charAt(0).toUpperCase()}
                        </div>
                        <div className="flex-1">
                          <h3 className="text-sm font-bold text-gray-900">{client.name}</h3>
                          <div className="flex items-center gap-2 text-xs text-blue-600">
                            <span className="flex items-center gap-0.5">
                              <Hash className="w-2 h-2" />
                              {client.id}
                            </span>
                            <span className="flex items-center gap-0.5">
                              <User className="w-2 h-2" />
                              {client.site}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                ))
              )}
            </div>
          </>
        ) : (
          <>
            {/* Selected Client Header */}
            <div className="p-3 bg-white border-2 border-blue-100 shadow-lg rounded-xl">
              <div className="flex items-center justify-between">
                <button
                  onClick={() => {
                    setSelectedClient(null);
                    setClientLedger(null);
                    setExpandedChallan(null);
                    setEditingChallan(null);
                  }}
                  className="flex items-center gap-2 text-blue-600 hover:text-blue-700"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span className="text-sm font-medium">પાછા જાઓ</span>
                </button>
                <div className="text-center">
                  <h2 className="text-sm font-bold text-gray-900">{selectedClient.name}</h2>
                  <p className="text-xs text-blue-600">ID: {selectedClient.id}</p>
                </div>
                <div className="w-16"></div>
              </div>
            </div>

            {/* Client Challans */}
            {loading ? (
              <div className="space-y-2">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="p-2 bg-white border border-blue-100 shadow-sm rounded-xl animate-pulse">
                    <div className="w-2/3 h-3 mb-1 bg-blue-200 rounded"></div>
                    <div className="w-1/2 h-2 bg-blue-200 rounded"></div>
                  </div>
                ))}
              </div>
            ) : !clientLedger?.has_activity ? (
              <div className="py-8 text-center bg-white border-2 border-blue-100 shadow-lg rounded-xl">
                <FileText className="w-12 h-12 mx-auto mb-4 text-blue-300" />
                <p className="mb-1 text-sm font-semibold text-gray-700">કોઈ ચલણ પ્રવૃત્તિ નથી</p>
                <p className="text-xs text-blue-600">આ ગ્રાહક માટે કોઈ ચલણ બનાવવામાં આવ્યું નથી</p>
              </div>
            ) : (
              <div className="space-y-2">
                {/* Udhar Challans */}
                {clientLedger?.udhar_challans.map((challan) => (
                  <ChallanCard
                    key={`udhar-${challan.id}`}
                    challan={challan}
                    type="udhar"
                    isExpanded={expandedChallan === challan.id}
                    onToggleExpand={() => setExpandedChallan(expandedChallan === challan.id ? null : challan.id)}
                    onEdit={() => handleEditChallan(challan, 'udhar')}
                    onDownload={() => handleDownload(challan, 'udhar')}
                    downloading={downloading === challan.id}
                    user={user}
                  />
                ))}

                {/* Jama Challans */}
                {clientLedger?.jama_challans.map((challan) => (
                  <ChallanCard
                    key={`jama-${challan.id}`}
                    challan={challan}
                    type="jama"
                    isExpanded={expandedChallan === challan.id}
                    onToggleExpand={() => setExpandedChallan(expandedChallan === challan.id ? null : challan.id)}
                    onEdit={() => handleEditChallan(challan, 'jama')}
                    onDownload={() => handleDownload(challan, 'jama')}
                    downloading={downloading === challan.id}
                    user={user}
                  />
                ))}
              </div>
            )}
          </>
        )}

        {/* Edit Modal */}
        {editingChallan && user?.isAdmin && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-2 bg-blue-900/30 backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto border-4 border-blue-200">
              <div className="p-3 text-white bg-gradient-to-r from-blue-600 to-indigo-600">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-semibold">
                    {editingChallan.type === 'udhar' ? 'ઉધાર' : 'જમા'} ચલણ એડિટ કરો
                  </h2>
                  <button
                    onClick={() => setEditingChallan(null)}
                    className="p-1.5 transition-colors rounded-lg hover:bg-blue-500/20"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="p-3 space-y-3">
                {/* Basic Details */}
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  <div>
                    <label className="block mb-1 text-xs font-medium text-blue-700">
                      ચલણ નંબર
                    </label>
                    <input
                      type="text"
                      value={editingChallan.challan_number}
                      onChange={(e) => setEditingChallan({
                        ...editingChallan,
                        challan_number: e.target.value
                      })}
                      className="w-full px-2 py-1.5 text-xs border-2 border-blue-200 rounded-lg focus:ring-2 focus:ring-blue-100 focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block mb-1 text-xs font-medium text-blue-700">
                      તારીખ
                    </label>
                    <input
                      type="date"
                      value={editingChallan.date}
                      onChange={(e) => setEditingChallan({
                        ...editingChallan,
                        date: e.target.value
                      })}
                      className="w-full px-2 py-1.5 text-xs border-2 border-blue-200 rounded-lg focus:ring-2 focus:ring-blue-100 focus:border-blue-500"
                    />
                  </div>
                </div>

                {/* Driver Name */}
                <div>
                  <label className="block mb-1 text-xs font-medium text-blue-700">
                    ડ્રાઈવરનું નામ
                  </label>
                  <input
                    type="text"
                    value={editingChallan.driver_name}
                    onChange={(e) => setEditingChallan({
                      ...editingChallan,
                      driver_name: e.target.value
                    })}
                    className="w-full px-2 py-1.5 text-xs border-2 border-blue-200 rounded-lg focus:ring-2 focus:ring-blue-100 focus:border-blue-500"
                    placeholder="ડ્રાઈવરનું નામ દાખલ કરો"
                  />
                </div>

                {/* Plate Quantities */}
                <div>
                  <label className="block mb-1.5 text-xs font-medium text-blue-700">
                    પ્લેટ માત્રા
                  </label>
                  <div className="grid grid-cols-2 gap-1.5 md:grid-cols-3">
                    {PLATE_SIZES.map(size => {
                      const stockInfo = getStockInfo(size);
                      return (
                        <div key={size} className="p-1.5 border-2 border-blue-200 rounded-lg">
                          <label className="block mb-0.5 text-xs font-medium text-blue-700">
                            {size}
                          </label>
                          <input
                            type="number"
                            min="0"
                            value={editingChallan.plates[size] || ''}
                            onChange={(e) => setEditingChallan({
                              ...editingChallan,
                              plates: {
                                ...editingChallan.plates,
                                [size]: parseInt(e.target.value) || 0
                              }
                            })}
                            className="w-full px-1 py-0.5 text-xs text-center border border-blue-300 rounded focus:ring-1 focus:ring-blue-200 focus:border-blue-500"
                            placeholder="0"
                          />
                          {stockInfo && editingChallan.type === 'udhar' && (
                            <div className="mt-0.5 text-xs text-gray-500 text-center">
                              સ્ટોક: {stockInfo.available_quantity}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Note */}
                <div>
                  <label className="block mb-1 text-xs font-medium text-blue-700">
                    નોંધ
                  </label>
                  <textarea
                    value={editingChallan.note}
                    onChange={(e) => setEditingChallan({
                      ...editingChallan,
                      note: e.target.value
                    })}
                    className="w-full px-2 py-1.5 text-xs border-2 border-blue-200 rounded-lg resize-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500"
                    rows={2}
                    placeholder="આ ચલણ માટે કોઈ નોંધ દાખલ કરો..."
                  />
                </div>

                {/* Action Buttons */}
                <div className="flex flex-col gap-1.5 pt-3 border-t-2 border-blue-100 sm:flex-row">
                  <button
                    onClick={handleSaveEdit}
                    disabled={editLoading}
                    className="flex items-center justify-center flex-1 gap-1.5 px-2 py-1.5 text-xs font-medium text-white transition-colors rounded-lg bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 disabled:opacity-50"
                  >
                    {editLoading ? (
                      <div className="w-3 h-3 border-2 border-white rounded-full border-t-transparent animate-spin" />
                    ) : (
                      <Save className="w-3 h-3" />
                    )}
                    સેવ કરો
                  </button>
                  <button
                    onClick={handleDeleteChallan}
                    disabled={editLoading}
                    className="flex items-center justify-center flex-1 gap-1.5 px-2 py-1.5 text-xs font-medium text-white transition-colors rounded-lg bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 disabled:opacity-50"
                  >
                    <Trash2 className="w-3 h-3" />
                    ડિલીટ કરો
                  </button>
                  <button
                    onClick={() => setEditingChallan(null)}
                    disabled={editLoading}
                    className="flex-1 px-2 py-1.5 text-xs font-medium text-white transition-colors bg-gray-500 rounded-lg hover:bg-gray-600 disabled:opacity-50"
                  >
                    રદ કરો
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Challan Card Component
interface ChallanCardProps {
  challan: UdharChallan | JamaChallan;
  type: 'udhar' | 'jama';
  isExpanded: boolean;
  onToggleExpand: () => void;
  onEdit: () => void;
  onDownload: () => void;
  downloading: boolean;
  user: any;
}

function ChallanCard({ 
  challan, 
  type, 
  isExpanded, 
  onToggleExpand, 
  onEdit, 
  onDownload, 
  downloading, 
  user 
}: ChallanCardProps) {
  const challanNumber = type === 'udhar' 
    ? (challan as UdharChallan).challan_number
    : (challan as JamaChallan).return_challan_number;
  
  const challanDate = type === 'udhar'
    ? (challan as UdharChallan).challan_date
    : (challan as JamaChallan).return_date;

  const items = type === 'udhar'
    ? (challan as UdharChallan).challan_items
    : (challan as JamaChallan).return_line_items;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="overflow-hidden transition-all duration-200 bg-white border-2 border-blue-100 shadow-lg rounded-xl hover:shadow-xl hover:border-blue-200"
    >
      {/* Challan Header */}
      <div 
        className="p-2 transition-colors cursor-pointer hover:bg-blue-25"
        onClick={onToggleExpand}
      >
        <div className="flex items-start justify-between mb-2">
          <div className="flex-1">
            <div className="flex items-center gap-1.5 mb-1">
              <div className={`flex items-center justify-center w-5 h-5 rounded-full ${
                type === 'udhar' 
                  ? 'bg-gradient-to-r from-red-500 to-orange-500' 
                  : 'bg-gradient-to-r from-green-500 to-emerald-500'
              }`}>
                {type === 'udhar' ? (
                  <FileText className="w-2.5 h-2.5 text-white" />
                ) : (
                  <RotateCcw className="w-2.5 h-2.5 text-white" />
                )}
              </div>
              <span className="text-xs font-semibold text-gray-900">
                {challanNumber}
              </span>
            </div>
            <div className="flex items-center gap-1.5 mb-0.5 text-xs text-blue-600">
              <Calendar className="w-2.5 h-2.5" />
              <span>{format(new Date(challanDate), 'dd/MM/yyyy')}</span>
            </div>
            {challan.driver_name && (
              <div className="flex items-center gap-1.5 text-xs text-blue-600">
                <User className="w-2.5 h-2.5" />
                <span>{challan.driver_name}</span>
              </div>
            )}
          </div>
          <div className="flex flex-col items-end gap-1.5">
            {type === 'udhar' && (
              <span className={`px-1.5 py-0.5 rounded-full text-xs font-medium ${
                (challan as UdharChallan).status === 'completed' 
                  ? 'bg-green-100 text-green-800 border border-green-200'
                  : (challan as UdharChallan).status === 'partial'
                  ? 'bg-yellow-100 text-yellow-800 border border-yellow-200'
                  : 'bg-blue-100 text-blue-800 border border-blue-200'
              }`}>
                {(challan as UdharChallan).status === 'completed' ? 'પૂર્ણ' : 
                 (challan as UdharChallan).status === 'partial' ? 'અર્ધ' : 'સક્રિય'}
              </span>
            )}
            <div className="flex items-center gap-1.5">
              <span className={`text-xs font-medium px-1.5 py-0.5 rounded-full ${
                type === 'udhar' 
                  ? 'text-red-600 bg-red-50' 
                  : 'text-green-600 bg-green-50'
              }`}>
                {challan.total_plates} પ્લેટ્સ
              </span>
              <div className="flex items-center justify-center w-4 h-4 bg-blue-100 rounded-full">
                {isExpanded ? (
                  <ChevronUp className="w-2.5 h-2.5 text-blue-600" />
                ) : (
                  <ChevronDown className="w-2.5 h-2.5 text-blue-600" />
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-1.5">
          {user?.isAdmin ? (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onEdit();
              }}
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
            onClick={(e) => {
              e.stopPropagation();
              onToggleExpand();
            }}
            className="flex items-center justify-center flex-1 gap-1 px-1.5 py-1.5 text-xs font-medium text-blue-700 transition-colors bg-blue-100 rounded-lg hover:bg-blue-200"
          >
            <Eye className="w-2.5 h-2.5" />
            જુઓ
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDownload();
            }}
            disabled={downloading}
            className={`flex-1 py-1.5 px-1.5 rounded-lg text-xs font-medium transition-colors flex items-center justify-center gap-1 ${
              type === 'udhar'
                ? 'bg-gradient-to-r from-red-500 to-orange-500 hover:from-red-600 hover:to-orange-600 text-white'
                : 'bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white'
            } disabled:opacity-50`}
          >
            <Download className="w-2.5 h-2.5" />
            {downloading ? 'લોડિંગ...' : 'ડાઉનલોડ'}
          </button>
        </div>
      </div>

      {/* Expanded Details */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden border-t-2 border-blue-100 bg-gradient-to-r from-blue-50 to-indigo-50"
          >
            <div className="p-2 space-y-2">
              {/* Plate Details */}
              <div className="p-2 bg-white border border-blue-200 rounded-lg">
                <h4 className="mb-1.5 text-xs font-medium text-blue-900">પ્લેટ વિગતો</h4>
                <div className="space-y-1.5">
                  {type === 'udhar' 
                    ? (challan as UdharChallan).challan_items.map((item, index) => (
                        <div key={index} className="flex items-center justify-between py-0.5 border-b border-blue-100 last:border-b-0">
                          <span className="text-xs font-medium text-gray-900">{item.plate_size}</span>
                          <div className="text-right">
                            <span className="text-xs font-bold text-red-600">{item.borrowed_quantity}</span>
                            {item.borrowed_stock > 0 && (
                              <span className="ml-1 text-xs font-bold text-purple-600">+{item.borrowed_stock}*</span>
                            )}
                            {item.partner_stock_notes && (
                              <div className="mt-0.5 text-xs text-blue-500">{item.partner_stock_notes}</div>
                            )}
                          </div>
                        </div>
                      ))
                    : (challan as JamaChallan).return_line_items.map((item, index) => (
                        <div key={index} className="flex items-center justify-between py-0.5 border-b border-blue-100 last:border-b-0">
                          <span className="text-xs font-medium text-gray-900">{item.plate_size}</span>
                          <div className="text-right">
                            <span className="text-xs font-bold text-green-600">{item.returned_quantity}</span>
                            {item.returned_borrowed_stock > 0 && (
                              <span className="ml-1 text-xs font-bold text-purple-600">+{item.returned_borrowed_stock}*</span>
                            )}
                            {item.damage_notes && (
                              <div className="mt-0.5 text-xs text-blue-500">{item.damage_notes}</div>
                            )}
                          </div>
                        </div>
                      ))
                  }
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}