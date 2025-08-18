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
      display += `<sup style="color: #dc2626; font-size: 11px; font-weight: bold;">${prefix}${borrowedStock}</sup>`;
    }
    if (notes) {
      display += `<sup style="color: #6b7280; font-size: 9px;"> (${notes})</sup>`;
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

  const clientInitial = data.client.name.charAt(0).toUpperCase();

  // Generate HTML content with improved header design
  tempDiv.innerHTML = `
    <div style="
      width: 1300px;
      background: radial-gradient(ellipse at top, #f0f9ff 0%, #e0f2fe 25%, #e0e7ff 50%, #fdf4ff 75%, #fef7ed 100%);
      padding: 45px;
      font-family: 'Inter', 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      color: #0f172a;
      min-height: 900px;
      position: relative;
    ">
      <!-- Decorative Border -->
      <div style="
        position: absolute;
        top: 20px;
        left: 20px;
        right: 20px;
        bottom: 20px;
        border: 4px solid;
        border-image: linear-gradient(45deg, #3b82f6, #8b5cf6, #06b6d4, #10b981) 1;
        border-radius: 25px;
        pointer-events: none;
      "></div>

      <!-- Enhanced Shop Header -->
      <div style="
        text-align: center;
        margin-bottom: 35px;
        padding: 35px;
        background: linear-gradient(135deg, #ffffff 0%, #f8fafc 100%);
        border-radius: 25px;
        box-shadow: 
          0 20px 40px rgba(59, 130, 246, 0.1),
          0 0 0 1px rgba(255, 255, 255, 0.8),
          inset 0 1px 0 rgba(255, 255, 255, 0.9);
        border: 3px solid transparent;
        background-clip: padding-box;
        position: relative;
        overflow: hidden;
      ">
        <!-- Shop Branding -->
        <div style="
          display: flex;
          gap: 25px;
          align-items: center;
          margin-bottom: 25px;
          justify-content: center;
        ">
          <div style="
            background: linear-gradient(135deg, #3b82f6, #8b5cf6 60%, #10b981);
            width: 75px;
            height: 75px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            box-shadow: 0 15px 35px rgba(59, 130, 246, 0.4);
            border: 3px solid rgba(255, 255, 255, 0.3);
          ">
            <span style="font-size: 36px; color: #fff; text-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);">🏗️</span>
          </div>
          <div style="text-align: left;">
            <h1 style="
              margin: 0;
              font-size: 42px;
              font-weight: 900;
              background: linear-gradient(90deg,#1e40af,#3b82f6,#8b5cf6,#10b981);
              -webkit-background-clip: text;
              -webkit-text-fill-color: transparent;
              background-clip: text;
              letter-spacing: -1px;
            ">નીલકંઠ પ્લેટ ડેપો</h1>
            <div style="
              margin-top: 10px;
              display: inline-block;
              padding: 8px 20px;
              border-radius: 16px;
              background: linear-gradient(90deg, #e0e7ff, #dbeafe 90%);
              color: #1e40af;
              font-size: 17px;
              font-weight: 700;
              border: 2px solid #3b82f6;
            ">🏪 પ્રીમિયમ પ્લેટ રેન્ટલ સર્વિસ</div>
          </div>
        </div>
        
        <!-- Document Title -->
        <div style="
          background: linear-gradient(135deg, #f0f9ff, #e0f2fe);
          padding: 20px;
          border-radius: 20px;
          border: 2px solid #0284c7;
          margin-bottom: 25px;
        ">
          <h2 style="
            margin: 0;
            font-size: 32px;
            font-weight: 800;
            color: #0c4a6e;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 15px;
          ">
            <span style="
              display: inline-flex;
              align-items: center;
              justify-content: center;
              width: 45px;
              height: 45px;
              background: linear-gradient(135deg, #0284c7, #0369a1);
              border-radius: 50%;
              color: white;
              font-size: 20px;
            ">📊</span>
            ગ્રાહક એકાઉન્ટ ખાતાવહી
          </h2>
        </div>
        
        <!-- Enhanced Client Info -->
        <div style="
          background: linear-gradient(135deg, #f8fafc, #eef2ff);
          border-radius: 22px;
          padding: 28px;
          display: flex;
          gap: 32px;
          align-items: center;
          box-shadow: 0 8px 20px rgba(96, 165, 250, 0.15);
          border: 3px solid;
          border-image: linear-gradient(135deg, #3b82f6, #8b5cf6) 1;
        ">
          <div style="
            background: linear-gradient(135deg, #1e40af, #a855f7);
            width: 70px;
            height: 70px;
            border-radius: 20px;
            display: flex;
            align-items: center;
            justify-content: center;
            color: #fff;
            font-size: 32px;
            font-weight: 900;
            box-shadow: 0 10px 25px rgba(30, 64, 175, 0.4);
            border: 3px solid rgba(255, 255, 255, 0.3);
            text-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
          ">
            ${clientInitial}
          </div>
          <div style="flex: 1;">
            <div style="font-size: 28px; font-weight: 800; color: #334155; margin-bottom: 8px;">${data.client.name}</div>
            <div style="
              display: inline-block;
              padding: 6px 15px;
              background: linear-gradient(135deg, #dbeafe, #e0e7ff);
              border-radius: 15px;
              margin-bottom: 10px;
              border: 2px solid #3b82f6;
            ">
              <span style="font-size: 16px; color: #1e40af; font-weight: 700;">ID: ${data.client.id}</span>
            </div>
            <div style="display: flex; gap: 20px; flex-wrap: wrap;">
              ${data.client.site ? `
                <div style="
                  display: flex;
                  align-items: center;
                  gap: 8px;
                  padding: 8px 16px;
                  background: rgba(255, 255, 255, 0.8);
                  border-radius: 20px;
                  font-size: 16px;
                  font-weight: 700;
                  color: #0ea5e9;
                  box-shadow: 0 4px 10px rgba(59, 130, 246, 0.1);
                ">
                  <span style="font-size: 18px;">📍</span>
                  <span>${data.client.site}</span>
                </div>
              ` : ''}
              
              ${data.client.mobile ? `
                <div style="
                  display: flex;
                  align-items: center;
                  gap: 8px;
                  padding: 8px 16px;
                  background: rgba(255, 255, 255, 0.8);
                  border-radius: 20px;
                  font-size: 16px;
                  font-weight: 700;
                  color: #0ea5e9;
                  box-shadow: 0 4px 10px rgba(59, 130, 246, 0.1);
                ">
                  <span style="font-size: 18px;">📱</span>
                  <span>${data.client.mobile}</span>
                </div>
              ` : ''}
            </div>
          </div>
        </div>
        
        <!-- Outstanding Balance -->
        <div style="display: flex; justify-content: center; margin-top: 25px;">
          <div style="
            display: flex;
            align-items: center;
            gap: 15px;
            padding: 18px 35px;
            background: ${getAccurateGrandTotal() > 0 
              ? 'linear-gradient(135deg, #fee2e2, #fecaca)' 
              : 'linear-gradient(135deg, #dcfce7, #bbf7d0)'};
            color: ${getAccurateGrandTotal() > 0 ? '#991b1b' : '#166534'};
            border-radius: 30px;
            font-size: 22px;
            font-weight: 900;
            box-shadow: 
              0 10px 25px ${getAccurateGrandTotal() > 0 
                ? 'rgba(239, 68, 68, 0.25)' 
                : 'rgba(16, 185, 129, 0.25)'},
              inset 0 1px 0 rgba(255, 255, 255, 0.5);
            border: 3px solid ${getAccurateGrandTotal() > 0 ? '#f87171' : '#4ade80'};
            text-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
          ">
            <span style="font-size: 28px;">
              ${getAccurateGrandTotal() > 0 ? '⚖️' : '✅'}
            </span>
            <span>
              ${getAccurateGrandTotal() > 0 
                ? `કુલ બાકી: ${getAccurateGrandTotal()} પ્લેટ` 
                : 'સંપૂર્ણ ચુકવણી ✨'}
            </span>
          </div>
        </div>
      </div>

      <!-- Activity Table -->
      <div style="
        background: linear-gradient(135deg, #ffffff 0%, #f8fafc 100%);
        border-radius: 25px;
        overflow: hidden;
        box-shadow: 
          0 20px 40px rgba(59, 130, 246, 0.1),
          0 0 0 1px rgba(255, 255, 255, 0.8),
          inset 0 1px 0 rgba(255, 255, 255, 0.9);
        border: 3px solid transparent;
        background-clip: padding-box;
      ">
        <div style="
          padding: 30px;
          background: linear-gradient(135deg, #f0f9ff, #e0f2fe);
          border-bottom: 4px solid #0284c7;
        ">
          <div style="display: flex; align-items: center; gap: 20px;">
            <div style="
              display: flex;
              align-items: center;
              justify-content: center;
              width: 50px;
              height: 50px;
              background: linear-gradient(135deg, #0284c7, #0369a1);
              border-radius: 50%;
              box-shadow: 
                0 8px 20px rgba(2, 132, 199, 0.4),
                inset 0 1px 0 rgba(255, 255, 255, 0.2);
              border: 3px solid rgba(255, 255, 255, 0.3);
            ">
              <span style="color: white; font-size: 22px; text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);">📦</span>
            </div>
            <h3 style="
              margin: 0; 
              font-size: 28px; 
              font-weight: 800; 
              color: #0c4a6e;
              text-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
            ">સંપૂર્ણ પ્લેટ પ્રવૃત્તિ વિવરણ</h3>
          </div>
        </div>
        <div style="overflow-x: auto;">
          <table style="
            width: 100%;
            border-collapse: collapse;
            font-size: 15px;
          ">
            <thead>
              <tr style="
                background: linear-gradient(135deg, #1e40af 0%, #3b82f6 25%, #0284c7 50%, #0369a1 75%, #075985 100%);
                color: white;
              ">
                <th style="
                  padding: 18px 12px;
                  text-align: left;
                  font-weight: 800;
                  border-right: 2px solid rgba(255, 255, 255, 0.3);
                  min-width: 120px;
                  font-size: 16px;
                  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
                ">ચલણ નંબર</th>
                <th style="
                  padding: 18px 12px;
                  text-align: center;
                  font-weight: 800;
                  border-right: 2px solid rgba(255, 255, 255, 0.3);
                  min-width: 100px;
                  font-size: 16px;
                  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
                ">તારીખ</th>
                <th style="
                  padding: 18px 12px;
                  text-align: center;
                  font-weight: 800;
                  border-right: 2px solid rgba(255, 255, 255, 0.3);
                  min-width: 80px;
                  font-size: 16px;
                  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
                ">કુલ</th>
                ${PLATE_SIZES.map(size => `
                  <th style="
                    padding: 18px 12px;
                    text-align: center;
                    font-weight: 800;
                    border-right: 2px solid rgba(255, 255, 255, 0.3);
                    min-width: 90px;
                    font-size: 15px;
                    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
                  ">${size}</th>
                `).join('')}
              </tr>
            </thead>
            <tbody>
              <!-- Current Balance Row -->
              <tr style="
                background: linear-gradient(135deg, #dbeafe 0%, #e0e7ff 50%, #f0f9ff 100%);
                border-bottom: 4px solid #3b82f6;
                font-weight: 800;
              ">
                <td style="
                  padding: 20px 12px;
                  color: #1e40af;
                  border-right: 2px solid #3b82f6;
                  font-size: 17px;
                  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
                ">
                  <span style="
                    display: inline-flex;
                    align-items: center;
                    gap: 8px;
                  ">
                    <span style="font-size: 20px;">⚖️</span>
                    વર્તમાન બેલેન્સ
                  </span>
                </td>
                <td style="
                  padding: 20px 12px;
                  text-align: center;
                  color: #1e40af;
                  border-right: 2px solid #3b82f6;
                  font-size: 16px;
                ">-</td>
                <td style="
                  padding: 20px 12px;
                  text-align: center;
                  color: #1e40af;
                  border-right: 2px solid #3b82f6;
                  font-size: 20px;
                  font-weight: 900;
                ">${getAccurateGrandTotal()}</td>
                ${PLATE_SIZES.map(size => {
                  const balance = data.plate_balances.find(b => b.plate_size === size)?.outstanding || 0;
                  const borrowedBalance = getBorrowedStockBalance(size);
                  const totalBalance = balance + borrowedBalance;
                  
                  return `
                    <td style="
                      padding: 20px 12px;
                      text-align: center;
                      border-right: 2px solid #3b82f6;
                    ">
                      ${totalBalance !== 0 ? `
                        <span style="
                          color: #1e40af; 
                          font-weight: 800;
                          font-size: 16px;
                        ">${totalBalance}</span>
                        ${borrowedBalance > 0 ? `<sup style="color: #dc2626; font-size: 11px; font-weight: bold; margin-left: 3px;">${borrowedBalance}</sup>` : ''}
                      ` : '<span style="color: #64748b; font-size: 16px;">-</span>'}
                    </td>
                  `;
                }).join('')}
              </tr>
              <!-- Transaction Rows -->
              ${data.transactions.length === 0 ? `
                <tr>
                  <td colspan="${PLATE_SIZES.length + 3}" style="
                    padding: 50px;
                    text-align: center;
                    color: #64748b;
                    font-size: 20px;
                    font-weight: 600;
                  ">
                    <div style="
                      display: flex;
                      flex-direction: column;
                      align-items: center;
                      gap: 15px;
                    ">
                      <span style="font-size: 48px;">📝</span>
                      <span>કોઈ પ્રવૃત્તિ રેકોર્ડ નથી</span>
                    </div>
                  </td>
                </tr>
              ` : data.transactions.map((transaction, index) => `
                <tr style="
                  background: ${transaction.type === 'udhar' 
                    ? 'linear-gradient(135deg, #fefce8, #fef3c7)' 
                    : 'linear-gradient(135deg, #f0fdf4, #dcfce7)'};
                  border-bottom: 2px solid ${transaction.type === 'udhar' ? '#fbbf24' : '#10b981'};
                  transition: all 0.3s ease;
                ">
                  <td style="
                    padding: 16px 12px;
                    border-right: 1px solid #e2e8f0;
                    font-weight: 700;
                    color: #374151;
                    font-size: 15px;
                  ">
                    <div style="
                      display: flex;
                      align-items: center;
                      gap: 8px;
                    ">
                      <span style="
                        display: inline-flex;
                        align-items: center;
                        justify-content: center;
                        width: 24px;
                        height: 24px;
                        background: ${transaction.type === 'udhar' ? '#f59e0b' : '#10b981'};
                        color: white;
                        border-radius: 50%;
                        font-size: 12px;
                        font-weight: bold;
                      ">${index + 1}</span>
                      <span>#${transaction.number}</span>
                      ${transaction.items.some(item => (item.borrowed_stock || 0) > 0 || (item.returned_borrowed_stock || 0) > 0) ? '<span style="color: #7c3aed; font-weight: bold; margin-left: 5px;">*</span>' : ''}
                    </div>
                  </td>
                  <td style="
                    padding: 16px 12px;
                    text-align: center;
                    border-right: 1px solid #e2e8f0;
                    color: #2563eb;
                    font-weight: 700;
                    font-size: 14px;
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
                    padding: 16px 12px;
                    text-align: center;
                    border-right: 1px solid #e2e8f0;
                    color: #2563eb;
                    font-weight: 800;
                    font-size: 16px;
                  ">${getTransactionTotalWithBorrowed(transaction)}</td>
                  ${PLATE_SIZES.map(size => {
                    const display = formatPlateDisplay(transaction, size);
                    return `
                      <td style="
                        padding: 16px 12px;
                        text-align: center;
                        border-right: 1px solid #e2e8f0;
                      ">
                        ${display ? `<span style="color: #1e40af; font-weight: 700; font-size: 14px;">${display}</span>` : '<span style="color: #cbd5e1; font-size: 14px;">-</span>'}
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
          padding: 25px;
          background: linear-gradient(135deg, #f8fafc, #f1f5f9);
          border-top: 3px solid #3b82f6;
        ">
          <div style="
            display: flex;
            justify-content: center;
            gap: 35px;
            flex-wrap: wrap;
            font-size: 15px;
            font-weight: 700;
          ">
            <div style="
              display: flex; 
              align-items: center; 
              gap: 10px; 
              color: #1e40af;
              padding: 8px 16px;
              background: white;
              border-radius: 20px;
              box-shadow: 0 4px 10px rgba(59, 130, 246, 0.1);
              border: 2px solid #dbeafe;
            ">
              <div style="
                width: 24px;
                height: 24px;
                background: linear-gradient(135deg, #fbbf24, #f59e0b);
                border-radius: 50%;
                box-shadow: 0 3px 8px rgba(251, 191, 36, 0.4);
              "></div>
              <span>ઉધાર (આપેલ)</span>
            </div>
            <div style="
              display: flex; 
              align-items: center; 
              gap: 10px; 
              color: #1e40af;
              padding: 8px 16px;
              background: white;
              border-radius: 20px;
              box-shadow: 0 4px 10px rgba(59, 130, 246, 0.1);
              border: 2px solid #dbeafe;
            ">
              <div style="
                width: 24px;
                height: 24px;
                background: linear-gradient(135deg, #10b981, #059669);
                border-radius: 50%;
                box-shadow: 0 3px 8px rgba(16, 185, 129, 0.4);
              "></div>
              <span>જમા (પરત)</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Footer -->
      <div style="
        text-align: center;
        margin-top: 35px;
        padding: 30px;
        background: linear-gradient(135deg, #ffffff, #f8fafc);
        border-radius: 20px;
        border: 3px solid;
        border-image: linear-gradient(135deg, #3b82f6, #8b5cf6) 1;
        box-shadow: 
          0 10px 25px rgba(59, 130, 246, 0.1),
          inset 0 1px 0 rgba(255, 255, 255, 0.9);
        position: relative;
      ">
        <div style="margin-bottom: 20px;">
          <p style="
            margin: 0 0 8px 0;
            font-size: 18px;
            color: #1e40af;
            font-weight: 800;
          ">📞 સંપર્કમાં રહો | 📧 સેવા અને સપોર્ટ</p>
        </div>
        <div style="
          padding: 15px;
          background: linear-gradient(135deg, #f0f9ff, #e0f2fe);
          border-radius: 15px;
          border: 2px solid #0284c7;
        ">
          <p style="
            margin: 0 0 5px 0;
            font-size: 15px;
            color: #0c4a6e;
            font-weight: 700;
          ">
            📅 બનાવ્યું: ${new Date(data.generated_date).toLocaleDateString('gu-IN', {
              year: 'numeric',
              month: 'long',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit'
            })}
          </p>
          <p style="
            margin: 0;
            font-size: 12px;
            color: #64748b;
            font-weight: 600;
          ">🖥️ આ ડિજિટલ ખાતાવહી કોમ્પ્યુટર દ્વારા બનાવવામાં આવી છે - નીલકંઠ પ્લેટ ડેપો</p>
        </div>
      </div>
    </div>
  `;

  try {
    // Generate image using html2canvas with enhanced settings
    const canvas = await html2canvas(tempDiv, {
      width: 1300,
      height: tempDiv.scrollHeight,
      scale: 2.5,
      useCORS: true,
      allowTaint: false,
      backgroundColor: '#ffffff',
      removeContainer: true,
      logging: false,
      imageTimeout: 15000,
      onclone: function(clonedDoc) {
        const style = clonedDoc.createElement('style');
        style.textContent = `
          @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
        `;
        clonedDoc.head.appendChild(style);
      }
    });
    
    const dataUrl = canvas.toDataURL('image/jpeg', 0.95);
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
