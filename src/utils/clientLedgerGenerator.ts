// utils/clientLedgerGenerator.ts
import html2canvas from 'html2canvas';

export interface ClientLedgerData {
  client: {
    id: string;
    name: string;
    site: string;
    mobile: string;
  };
  plate_balances: Array<{
    plate_size: string;
    total_borrowed: number;
    total_returned: number;
    outstanding: number;
  }>;
  total_outstanding: number;
  transactions: Array<{
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
  generated_date: string;
}

const PLATE_SIZES = [
  '2 X 3', '21 X 3', '18 X 3', '15 X 3', '12 X 3',
  '9 X 3', 'પતરા', '2 X 2', '2 ફુટ'
];

export const generateClientLedgerJPG = async (data: ClientLedgerData): Promise<string> => {
  // Create a hidden div for rendering
  const tempDiv = document.createElement('div');
  tempDiv.style.position = 'absolute';
  tempDiv.style.left = '-9999px';
  tempDiv.style.top = '0';
  document.body.appendChild(tempDiv);

  // Calculate borrowed stock balances
  const getBorrowedStockBalance = (plateSize: string) => {
    const borrowed = data.transactions
      .filter(t => t.type === 'udhar')
      .reduce((sum, t) => {
        const item = t.items.find(i => i.plate_size === plateSize);
        return sum + (item?.borrowed_stock || 0);
      }, 0);

    const returned = data.transactions
      .filter(t => t.type === 'jama')
      .reduce((sum, t) => {
        const item = t.items.find(i => i.plate_size === plateSize);
        return sum + (item?.returned_borrowed_stock || 0);
      }, 0);

    return borrowed - returned;
  };

  const getTransactionTotalWithBorrowed = (transaction: typeof data.transactions[0]) => {
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

  const formatPlateDisplay = (transaction: typeof data.transactions[0], plateSize: string) => {
    const item = transaction.items.find(i => i.plate_size === plateSize);
    if (!item) return '';

    const quantity = item.quantity || 0;
    let borrowedStock = 0;
    
    if (transaction.type === 'udhar') {
      borrowedStock = item.borrowed_stock || 0;
    } else if (transaction.type === 'jama') {
      borrowedStock = item.returned_borrowed_stock || 0;
    }

    if (quantity === 0 && borrowedStock === 0) return '';

    const prefix = transaction.type === 'udhar' ? '+' : '-';
    const notes = item.notes || '';
    
    let display = '';
    if (quantity > 0) {
      display += `${prefix}${quantity}`;
    }
    if (borrowedStock > 0) {
      display += `<sup style="color: #dc2626; font-size: 10px; font-weight: bold;">${prefix}${borrowedStock}</sup>`;
    }
    if (notes) {
      display += `<sup style="color: #6b7280; font-size: 8px;"> (${notes})</sup>`;
    }
    
    return display;
  };

  // Calculate accurate grand total
  const getAccurateGrandTotal = () => {
    const regularOutstanding = data.plate_balances.reduce((sum, balance) => sum + Math.abs(balance.outstanding), 0);
    const netBorrowedStock = data.transactions.reduce((sum, t) => {
      if (t.type === 'udhar') {
        return sum + t.items.reduce((subSum, item) => subSum + (item.borrowed_stock || 0), 0);
      } else {
        return sum - t.items.reduce((subSum, item) => subSum + (item.returned_borrowed_stock || 0), 0);
      }
    }, 0);
    return regularOutstanding + netBorrowedStock;
  };

  // Generate HTML content that matches your ledger design
  tempDiv.innerHTML = `
    <div style="
      width: 1200px;
      background: linear-gradient(135deg, #eff6ff 0%, #e0e7ff 50%, #cffafe 100%);
      padding: 40px;
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      color: #1f2937;
      min-height: 800px;
    ">
      <!-- Header -->
      <div style="
        text-align: center;
        margin-bottom: 40px;
        padding: 30px;
        background: white;
        border-radius: 20px;
        box-shadow: 0 10px 30px rgba(59, 130, 246, 0.1);
        border: 3px solid #dbeafe;
      ">
        <div style="
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 60px;
          height: 60px;
          background: linear-gradient(135deg, #2563eb, #4f46e5);
          border-radius: 50%;
          margin-bottom: 20px;
          box-shadow: 0 8px 20px rgba(59, 130, 246, 0.3);
        ">
          <span style="color: white; font-size: 24px; font-weight: bold;">📊</span>
        </div>
        
        <h1 style="
          margin: 0 0 15px 0;
          font-size: 36px;
          font-weight: bold;
          background: linear-gradient(135deg, #2563eb, #4f46e5);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        ">ખાતાવહી</h1>
        
        <p style="
          margin: 0 0 25px 0;
          font-size: 18px;
          color: #1d4ed8;
          font-weight: 600;
        ">ગ્રાહક પ્લેટ ઇતિહાસ</p>
        
        <!-- Client Info -->
        <div style="
          background: linear-gradient(135deg, #dbeafe, #e0e7ff);
          padding: 25px;
          border-radius: 15px;
          margin-top: 20px;
          border: 2px solid #3b82f6;
        ">
          <div style="display: flex; align-items: center; justify-content: center; gap: 20px; margin-bottom: 15px;">
            <div style="
              display: flex;
              align-items: center;
              justify-content: center;
              width: 50px;
              height: 50px;
              background: linear-gradient(135deg, #2563eb, #4f46e5);
              border-radius: 50%;
              color: white;
              font-size: 24px;
              font-weight: bold;
              box-shadow: 0 6px 15px rgba(59, 130, 246, 0.3);
            ">${data.client.name.charAt(0).toUpperCase()}</div>
            <div>
              <h2 style="margin: 0; font-size: 28px; font-weight: bold; color: #1f2937;">${data.client.name}</h2>
              <p style="margin: 5px 0 0 0; font-size: 18px; color: #1d4ed8; font-weight: 600;">ID: ${data.client.id}</p>
            </div>
          </div>
          
          <div style="display: flex; justify-content: center; gap: 30px; flex-wrap: wrap;">
            ${data.client.site ? `
              <div style="
                display: flex;
                align-items: center;
                gap: 8px;
                padding: 10px 20px;
                background: white;
                border-radius: 25px;
                font-size: 16px;
                font-weight: 600;
                color: #1d4ed8;
                box-shadow: 0 4px 10px rgba(59, 130, 246, 0.1);
              ">
                <span>📍</span>
                <span>${data.client.site}</span>
              </div>
            ` : ''}
            
            ${data.client.mobile ? `
              <div style="
                display: flex;
                align-items: center;
                gap: 8px;
                padding: 10px 20px;
                background: white;
                border-radius: 25px;
                font-size: 16px;
                font-weight: 600;
                color: #1d4ed8;
                box-shadow: 0 4px 10px rgba(59, 130, 246, 0.1);
              ">
                <span>📱</span>
                <span>${data.client.mobile}</span>
              </div>
            ` : ''}
            
            <div style="
              display: flex;
              align-items: center;
              gap: 8px;
              padding: 10px 20px;
              background: ${getAccurateGrandTotal() > 0 ? 'linear-gradient(135deg, #ef4444, #dc2626)' : 'linear-gradient(135deg, #10b981, #059669)'};
              color: white;
              border-radius: 25px;
              font-size: 18px;
              font-weight: bold;
              box-shadow: 0 6px 15px ${getAccurateGrandTotal() > 0 ? 'rgba(239, 68, 68, 0.3)' : 'rgba(16, 185, 129, 0.3)'};
            ">
              <span>⚖️</span>
              <span>${getAccurateGrandTotal() > 0 ? `${getAccurateGrandTotal()} કુલ બાકી` : 'પૂર્ણ'}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Activity Table -->
      <div style="
        background: white;
        border-radius: 20px;
        overflow: hidden;
        box-shadow: 0 10px 30px rgba(59, 130, 246, 0.1);
        border: 3px solid #dbeafe;
      ">
        <div style="
          padding: 25px;
          background: linear-gradient(135deg, #dbeafe, #e0e7ff);
          border-bottom: 3px solid #3b82f6;
        ">
          <div style="display: flex; align-items: center; gap: 15px;">
            <div style="
              display: flex;
              align-items: center;
              justify-content: center;
              width: 40px;
              height: 40px;
              background: linear-gradient(135deg, #2563eb, #4f46e5);
              border-radius: 50%;
              box-shadow: 0 6px 15px rgba(59, 130, 246, 0.3);
            ">
              <span style="color: white; font-size: 18px;">📦</span>
            </div>
            <h3 style="margin: 0; font-size: 24px; font-weight: bold; color: #1f2937;">પ્લેટ પ્રવૃત્તિ</h3>
          </div>
        </div>

        <div style="overflow-x: auto;">
          <table style="
            width: 100%;
            border-collapse: collapse;
            font-size: 14px;
          ">
            <thead>
              <tr style="
                background: linear-gradient(135deg, #3b82f6, #4f46e5);
                color: white;
              ">
                <th style="
                  padding: 15px 10px;
                  text-align: left;
                  font-weight: bold;
                  border-right: 2px solid #2563eb;
                  min-width: 100px;
                ">ચલણ નં.</th>
                <th style="
                  padding: 15px 10px;
                  text-align: center;
                  font-weight: bold;
                  border-right: 2px solid #2563eb;
                  min-width: 80px;
                ">તારીખ</th>
                <th style="
                  padding: 15px 10px;
                  text-align: center;
                  font-weight: bold;
                  border-right: 2px solid #2563eb;
                  min-width: 60px;
                ">કુલ</th>
                ${PLATE_SIZES.map(size => `
                  <th style="
                    padding: 15px 10px;
                    text-align: center;
                    font-weight: bold;
                    border-right: 2px solid #2563eb;
                    min-width: 80px;
                  ">${size}</th>
                `).join('')}
              </tr>
            </thead>
            <tbody>
              <!-- Current Balance Row -->
              <tr style="
                background: linear-gradient(135deg, #dbeafe, #e0e7ff);
                border-bottom: 3px solid #3b82f6;
                font-weight: bold;
              ">
                <td style="
                  padding: 15px 10px;
                  color: #1f2937;
                  border-right: 2px solid #3b82f6;
                ">વર્તમાન બેલેન્સ</td>
                <td style="
                  padding: 15px 10px;
                  text-align: center;
                  color: #1d4ed8;
                  border-right: 2px solid #3b82f6;
                ">-</td>
                <td style="
                  padding: 15px 10px;
                  text-align: center;
                  color: #1d4ed8;
                  border-right: 2px solid #3b82f6;
                  font-size: 16px;
                ">${getAccurateGrandTotal()}</td>
                ${PLATE_SIZES.map(size => {
                  const balance = data.plate_balances.find(b => b.plate_size === size)?.outstanding || 0;
                  const borrowedBalance = getBorrowedStockBalance(size);
                  const totalBalance = balance + borrowedBalance;
                  
                  return `
                    <td style="
                      padding: 15px 10px;
                      text-align: center;
                      border-right: 2px solid #3b82f6;
                    ">
                      ${totalBalance !== 0 ? `
                        <span style="color: #1e40af; font-weight: bold;">${totalBalance}</span>
                        ${borrowedBalance > 0 ? `<sup style="color: #dc2626; font-size: 10px; font-weight: bold; margin-left: 2px;">${borrowedBalance}</sup>` : ''}
                      ` : '<span style="color: #9ca3af;">-</span>'}
                    </td>
                  `;
                }).join('')}
              </tr>

              <!-- Transaction Rows -->
              ${data.transactions.length === 0 ? `
                <tr>
                  <td colspan="${PLATE_SIZES.length + 3}" style="
                    padding: 40px;
                    text-align: center;
                    color: #6b7280;
                    font-size: 18px;
                  ">કોઈ ચલણ નથી</td>
                </tr>
              ` : data.transactions.map(transaction => `
                <tr style="
                  background: ${transaction.type === 'udhar' ? '#fefce8' : '#f0fdf4'};
                  border-bottom: 1px solid #e5e7eb;
                ">
                  <td style="
                    padding: 12px 10px;
                    border-right: 1px solid #e5e7eb;
                    font-weight: bold;
                    color: #374151;
                  ">
                    #${transaction.number}
                    ${transaction.items.some(item => (item.borrowed_stock || 0) > 0 || (item.returned_borrowed_stock || 0) > 0) ? '<span style="color: #7c3aed; font-weight: bold;">*</span>' : ''}
                  </td>
                  <td style="
                    padding: 12px 10px;
                    text-align: center;
                    border-right: 1px solid #e5e7eb;
                    color: #2563eb;
                    font-weight: 600;
                  ">
                    ${(() => {
                      const d = new Date(transaction.date);
                      const day = d.getDate().toString().padStart(2, '0');
                      const month = (d.getMonth() + 1).toString().padStart(2, '0');
                      const year = d.getFullYear().toString().slice(-2);
                      return `${day}/${month}/${year}`;
                    })()}
                  </td>
                  <td style="
                    padding: 12px 10px;
                    text-align: center;
                    border-right: 1px solid #e5e7eb;
                    color: #2563eb;
                    font-weight: 600;
                  ">${getTransactionTotalWithBorrowed(transaction)}</td>
                  ${PLATE_SIZES.map(size => {
                    const display = formatPlateDisplay(transaction, size);
                    return `
                      <td style="
                        padding: 12px 10px;
                        text-align: center;
                        border-right: 1px solid #e5e7eb;
                      ">
                        ${display ? `<span style="color: #1e40af; font-weight: bold;">${display}</span>` : '<span style="color: #d1d5db;">-</span>'}
                      </td>
                    `;
                  }).join('')}
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>

        <!-- Legend -->
        <div style="
          padding: 20px;
          background: linear-gradient(135deg, #dbeafe, #e0e7ff);
          border-top: 2px solid #3b82f6;
        ">
          <div style="
            display: flex;
            justify-content: center;
            gap: 30px;
            flex-wrap: wrap;
            font-size: 14px;
            font-weight: 600;
          ">
            <div style="display: flex; align-items: center; gap: 8px; color: #1d4ed8;">
              <div style="
                width: 20px;
                height: 20px;
                background: #fbbf24;
                border-radius: 50%;
                box-shadow: 0 2px 5px rgba(251, 191, 36, 0.3);
              "></div>
              <span>ઉધાર</span>
            </div>
            <div style="display: flex; align-items: center; gap: 8px; color: #1d4ed8;">
              <div style="
                width: 20px;
                height: 20px;
                background: #10b981;
                border-radius: 50%;
                box-shadow: 0 2px 5px rgba(16, 185, 129, 0.3);
              "></div>
              <span>જમા</span>
            </div> 
          </div>
        </div>
      </div>

      <!-- Footer -->
      <div style="
        text-align: center;
        margin-top: 30px;
        padding: 20px;
        background: white;
        border-radius: 15px;
        border: 2px solid #dbeafe;
        box-shadow: 0 4px 15px rgba(59, 130, 246, 0.1);
      ">
        <p style="
          margin: 0;
          font-size: 14px;
          color: #6b7280;
          font-weight: 600;
        ">
          બનાવ્યું: ${new Date(data.generated_date).toLocaleDateString('gu-IN', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
          })}
        </p>
        <p style="
          margin: 8px 0 0 0;
          font-size: 12px;
          color: #9ca3af;
        ">આ ડિજિટલ ખાતાવહી કોમ્પ્યુટર દ્વારા બનાવવામાં આવી છે</p>
      </div>
    </div>
  `;

  try {
    // Generate image using html2canvas
    const canvas = await html2canvas(tempDiv, {
      width: 1200,
      height: tempDiv.scrollHeight,
      scale: 2, // Higher quality
      useCORS: true,
      allowTaint: false,
      backgroundColor: '#ffffff'
    });

    // Convert to data URL
    const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
    
    // Clean up
    document.body.removeChild(tempDiv);
    
    return dataUrl;
  } catch (error) {
    document.body.removeChild(tempDiv);
    throw error;
  }
};

export const downloadClientLedgerJPG = (dataUrl: string, filename: string) => {
  const link = document.createElement('a');
  link.download = `${filename}.jpg`;
  link.href = dataUrl;
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};
