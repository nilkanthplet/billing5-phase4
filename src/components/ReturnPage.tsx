import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { Database } from '../lib/supabase'
import { RotateCcw, Package, Save, Loader2, Calendar, User, Search, Hash, MapPin, Phone, Lock } from 'lucide-react'
import { PrintableChallan } from './challans/PrintableChallan'
import { generateJPGChallan, downloadJPGChallan } from '../utils/jpgChallanGenerator'
import { ChallanData } from './challans/types'
import { useAuth } from '../hooks/useAuth'

type Client = Database['public']['Tables']['clients']['Row']

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
]

export function ReturnPage() {
  const { user } = useAuth()
  const [selectedClient, setSelectedClient] = useState<Client | null>(null)
  const [returnChallanNumber, setReturnChallanNumber] = useState('')
  const [suggestedChallanNumber, setSuggestedChallanNumber] = useState('')
  const [returnDate, setReturnDate] = useState(new Date().toISOString().split('T')[0])
  const [quantities, setQuantities] = useState<Record<string, number>>({})
  const [overallNote, setOverallNote] = useState('')
  const [loading, setLoading] = useState(false)
  const [challanData, setChallanData] = useState<ChallanData | null>(null)

  useEffect(() => {
    generateNextChallanNumber()
  }, [])

  const generateNextChallanNumber = async () => {
    try {
      // Fetch all existing return challans to find the highest numeric value
      const { data, error } = await supabase
        .from('returns')
        .select('return_challan_number')
        .order('id', { ascending: false })

      if (error) throw error

      let maxNumber = 0
      if (data && data.length > 0) {
        // Extract all numeric values and find the absolute maximum
        data.forEach(returnChallan => {
          const match = returnChallan.return_challan_number.match(/\d+/)
          if (match) {
            const num = parseInt(match[0])
            if (num > maxNumber) {
              maxNumber = num
            }
          }
        })
      }

      // Always increment by 1 from the highest found number
      const nextNumber = (maxNumber + 1).toString()
      setSuggestedChallanNumber(nextNumber)
      
      // Set as default only if current challan number is empty
      if (!returnChallanNumber) {
        setReturnChallanNumber(nextNumber)
      }
    } catch (error) {
      console.error('Error generating return challan number:', error)
      // Fallback to starting from 1
      const fallback = '1'
      setSuggestedChallanNumber(fallback)
      if (!returnChallanNumber) {
        setReturnChallanNumber(fallback)
      }
    }
  }

  const handleChallanNumberChange = (value: string) => {
    setReturnChallanNumber(value)
    
    // If user clears the input, suggest the next available number
    if (!value.trim()) {
      setReturnChallanNumber(suggestedChallanNumber)
    }
  }

  const handleQuantityChange = (size: string, value: string) => {
    const quantity = parseInt(value) || 0
    setQuantities(prev => ({
      ...prev,
      [size]: quantity
    }))
  }

  const checkReturnChallanNumberExists = async (challanNumber: string) => {
    const { data, error } = await supabase
      .from('returns')
      .select('return_challan_number')
      .eq('return_challan_number', challanNumber)
      .limit(1)

    return data && data.length > 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      // Basic validation - only check if client is selected and challan number is provided
      if (!selectedClient) {
        alert('Please select a client.')
        return
      }

      if (!returnChallanNumber.trim()) {
        alert('Please enter a return challan number.')
        return
      }

      // Check if return challan number already exists
      const exists = await checkReturnChallanNumberExists(returnChallanNumber)
      if (exists) {
        alert('Return challan number already exists. Please use a different number.')
        return
      }

      // Process only entries with quantities > 0 (no validation error if none)
      const returnEntries = PLATE_SIZES
        .filter(size => quantities[size] > 0)
        .map(size => ({
          plate_size: size,
          returned_quantity: quantities[size],
          damage_notes: overallNote.trim() || null,
        }))

      // Create the return record (even if no line items)
      const { data: returnRecord, error: returnError } = await supabase
        .from('returns')
        .insert([{
          return_challan_number: returnChallanNumber,
          client_id: selectedClient.id,
          return_date: returnDate
        }])
        .select()
        .single()

      if (returnError) throw returnError

      // Create line items only for quantities > 0
      if (returnEntries.length > 0) {
        const lineItems = returnEntries.map(entry => ({
          return_id: returnRecord.id,
          ...entry
        }))

        const { error: lineItemsError } = await supabase
          .from('return_line_items')
          .insert(lineItems)

        if (lineItemsError) throw lineItemsError
      }

      // Prepare challan data
      const newChallanData: ChallanData = {
        type: 'return',
        challan_number: returnRecord.return_challan_number,
        date: returnDate,
        client: {
          id: selectedClient.id,
          name: selectedClient.name,
          site: selectedClient.site || '',
          mobile: selectedClient.mobile_number || ''
        },
        plates: returnEntries.map(entry => ({
          size: entry.plate_size,
          quantity: entry.returned_quantity,
          notes: overallNote || '',
        })),
        total_quantity: returnEntries.reduce((sum, entry) => sum + entry.returned_quantity, 0)
      };

      // Update state to render the challan
      setChallanData(newChallanData);
      
      // Wait for the component to render
      await new Promise(resolve => setTimeout(resolve, 500));

      // Generate and download the PDF
      try {
        const jpgDataUrl = await generateJPGChallan(newChallanData);
        downloadJPGChallan(jpgDataUrl, `return-challan-${returnRecord.return_challan_number}`);

      } catch (error) {
        console.error('JPG generation failed:', error);
        alert('Error generating challan image. Please try again.');
        return;
      }

      // Reset form
      setQuantities({})
      setOverallNote('')
      setReturnChallanNumber('')
      setSelectedClient(null)
      setChallanData(null)
      
      const message = returnEntries.length > 0 
        ? `Return challan ${returnRecord.return_challan_number} created and downloaded successfully with ${returnEntries.length} items!`
        : `Return challan ${returnRecord.return_challan_number} created and downloaded successfully (no items returned).`
      
      alert(message)
    } catch (error) {
      console.error('Error creating return:', error)
      alert('Error creating return. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  // Show access denied for non-admin users
  if (!user?.isAdmin) {
    return (
      <div className="space-y-8">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Return (Jama)</h1>
          <p className="text-gray-600">Access Denied - Admin Only</p>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 text-center">
          <div className="flex items-center justify-center w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-r from-gray-200 to-gray-300">
            <Lock className="w-8 h-8 text-gray-400" />
          </div>
          <h3 className="mb-2 text-xl font-bold text-gray-700">View-Only Access</h3>
          <p className="mb-4 text-gray-500">
            You have read-only access. Only the admin can process plate returns.
          </p>
          <p className="text-sm text-blue-600">
            Admin: nilkanthplatdepo@gmail.com
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {/* Hidden Printable Challan */}
      <div style={{ position: 'fixed', left: '-9999px', top: 0 }}>
        {challanData && (
          <div id={`challan-${challanData.challan_number}`}>
            <PrintableChallan
              data={challanData}
            />
          </div>
        )}
      </div>
      {/* Header */}
      <div className="text-center">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Return (Jama)</h1>
        <p className="text-gray-600">Process plate returns with manual data entry</p>
      </div>

      {/* Client Selection */}
      <ClientSelector 
        onClientSelect={setSelectedClient}
        selectedClient={selectedClient}
      />

      {/* Return Form */}
      {selectedClient && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <RotateCcw className="w-5 h-5 text-blue-600" />
              Return Plates
            </h2>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Return Details */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-gray-50 rounded-lg p-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Return Challan Number *
                </label>
                <input
                  type="text"
                  value={returnChallanNumber}
                  onChange={(e) => handleChallanNumberChange(e.target.value)}
                  onFocus={(e) => e.target.select()}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-base"
                  placeholder={`Suggested: ${suggestedChallanNumber}`}
                  required
                />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                  <Calendar className="w-4 h-4" />
                  Return Date *
                </label>
                <input
                  type="date"
                  value={returnDate}
                  onChange={(e) => setReturnDate(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-base"
                  required
                />
              </div>
            </div>

            {/* Two-Column Responsive Table */}
            <div className="overflow-x-auto scrollbar-thin scrollbar-thumb-gray-300">
              <table className="w-full min-w-[400px] md:min-w-full table-auto border border-gray-200 rounded-lg">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="px-2 py-3 md:px-4 md:py-3 text-left text-sm font-medium text-gray-700 border-b">
                      Plate Size
                    </th>
                    <th className="px-2 py-3 md:px-4 md:py-3 text-left text-sm font-medium text-gray-700 border-b">
                      Quantity Returned
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {PLATE_SIZES.map(size => (
                    <tr key={size} className="border-b hover:bg-gray-50">
                      <td className="px-2 py-2 md:px-4 md:py-3">
                        <div className="flex items-center gap-2">
                          <Package className="w-4 h-4 text-gray-500" />
                          <span className="font-medium text-gray-900">{size}</span>
                        </div>
                      </td>
                      <td className="px-2 py-2 md:px-4 md:py-3">
                        <input
                          type="number"
                          min="0"
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-base"
                          value={quantities[size] || ''}
                          onChange={(e) => handleQuantityChange(size, e.target.value)}
                          placeholder="0"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Overall Note Field */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                નોંધ (Note)
              </label>
              <textarea
                value={overallNote}
                onChange={(e) => setOverallNote(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-base resize-none"
                rows={3}
                placeholder="Enter any notes for this return (damage, loss, etc.)..."
              />
            </div>

            {/* Submit Button */}
            <div className="flex justify-end">
              <button
                type="submit"
                disabled={loading}
                className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 rounded-lg font-medium transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed text-base"
              >
                {loading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <Save className="w-5 h-5" />
                )}
                {loading ? 'Processing Return...' : 'Submit Return'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}