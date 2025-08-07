import { ChallanData } from '../components/challans/types';

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
    number: string;
    date: string;
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

const COMPANY_INFO = {
  name: 'NO WERE TECH',
  subtitle: 'સેન્ટરિંગ પ્લેટ્સ ભાડા સેવા',
  address: 'Your Address Here',
  phone: 'Your Phone Number',
  email: 'nilkanthplatdepo@gmail.com'
};

const PLATE_SIZES = [
  '2 X 3', '21 X 3', '18 X 3', '15 X 3', '12 X 3',
  '9 X 3', 'પતરા', '2 X 2', '2 ફુટ'
];

function renderText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  fontSize: number = 24,
  fontWeight: string = 'normal',
  color: string = '#000000',
  align: CanvasTextAlign = 'left'
) {
  if (!text || text.trim() === '') return;
  
  ctx.font = `${fontWeight} ${fontSize}px "Noto Sans Gujarati", Arial, sans-serif`;
  ctx.fillStyle = color;
  ctx.textAlign = align;
  ctx.textBaseline = 'top';
  ctx.fillText(text, x, y);
}

function drawLine(
  ctx: CanvasRenderingContext2D,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  color: string = '#000000',
  width: number = 1
) {
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
}

function drawRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  fillColor?: string,
  strokeColor?: string,
  strokeWidth: number = 1
) {
  if (fillColor) {
    ctx.fillStyle = fillColor;
    ctx.fillRect(x, y, width, height);
  }
  
  if (strokeColor) {
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = strokeWidth;
    ctx.strokeRect(x, y, width, height);
  }
}

function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
  fontSize: number = 16,
  fontWeight: string = 'normal',
  color: string = '#000000'
): number {
  if (!text || text.trim() === '') return y;
  
  ctx.font = `${fontWeight} ${fontSize}px "Noto Sans Gujarati", Arial, sans-serif`;
  ctx.fillStyle = color;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  
  const words = text.split(' ');
  let line = '';
  let currentY = y;
  
  for (let n = 0; n < words.length; n++) {
    const testLine = line + words[n] + ' ';
    const metrics = ctx.measureText(testLine);
    const testWidth = metrics.width;
    
    if (testWidth > maxWidth && n > 0) {
      ctx.fillText(line, x, currentY);
      line = words[n] + ' ';
      currentY += lineHeight;
    } else {
      line = testLine;
    }
  }
  
  ctx.fillText(line, x, currentY);
  return currentY + lineHeight;
}
export async function generateClientLedgerJPG(data: ClientLedgerData): Promise<string> {
  return new Promise((resolve, reject) => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    if (!ctx) {
      reject(new Error('Could not get canvas context'));
      return;
    }

    // Set canvas to A4 size at higher resolution for better quality
    canvas.width = 2480;
    canvas.height = Math.max(3508, 2000 + (data.transactions.length * 60) + (data.plate_balances.length * 50));

    try {
      // Enable high-quality rendering
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      
      // Fill background with white
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      
      let currentY = 100;
      const margin = 120;
      const pageWidth = canvas.width - (margin * 2);
      
      // Header
      renderText(ctx, COMPANY_INFO.name, canvas.width / 2, currentY, 48, 'bold', '#1e40af', 'center');
      currentY += 70;
      
      renderText(ctx, COMPANY_INFO.subtitle, canvas.width / 2, currentY, 28, 'normal', '#4f46e5', 'center');
      currentY += 50;
      
      renderText(ctx, 'ગ્રાહક ખાતાવહી (Client Ledger)', canvas.width / 2, currentY, 36, 'bold', '#1e40af', 'center');
      currentY += 80;
      
      // Client Information Box
      drawRect(ctx, margin, currentY, pageWidth, 200, '#f8fafc', '#e2e8f0', 2);
      currentY += 20;
      
      renderText(ctx, 'ગ્રાહક વિગતો (Client Details)', margin + 20, currentY, 28, 'bold', '#1e40af');
      currentY += 50;
      
      renderText(ctx, `નામ (Name): ${data.client.name}`, margin + 20, currentY, 24, 'normal', '#374151');
      renderText(ctx, `ID: ${data.client.id}`, margin + pageWidth - 400, currentY, 24, 'normal', '#374151');
      currentY += 40;
      
      renderText(ctx, `સાઇટ (Site): ${data.client.site}`, margin + 20, currentY, 24, 'normal', '#374151');
      renderText(ctx, `મોબાઇલ: ${data.client.mobile}`, margin + pageWidth - 400, currentY, 24, 'normal', '#374151');
      currentY += 40;
      
      renderText(ctx, `રિપોર્ટ તારીખ: ${new Date(data.generated_date).toLocaleDateString('en-GB')}`, margin + 20, currentY, 24, 'normal', '#6b7280');
      currentY += 80;
      
      // Outstanding Summary
      drawRect(ctx, margin, currentY, pageWidth, 120, '#fef3c7', '#f59e0b', 2);
      currentY += 20;
      
      renderText(ctx, 'કુલ બાકી પ્લેટ્સ (Total Outstanding Plates)', margin + 20, currentY, 28, 'bold', '#92400e');
      renderText(ctx, data.total_outstanding.toString(), margin + pageWidth - 100, currentY, 36, 'bold', '#dc2626', 'right');
      currentY += 100;
      
      // Enhanced Plate Balance Table - Show only active plates
      renderText(ctx, 'પ્લેટ બેલેન્સ (Plate Balance)', margin, currentY, 28, 'bold', '#1e40af');
      currentY += 50;
      
      // Filter to show only plates with activity
      const activePlateBalances = data.plate_balances.filter(balance => 
        balance.total_borrowed > 0 || balance.total_returned > 0
      );
      
      if (activePlateBalances.length === 0) {
        renderText(ctx, 'કોઈ પ્લેટ પ્રવૃત્તિ નથી (No plate activity)', margin + 20, currentY, 20, 'italic', '#6b7280');
        currentY += 60;
      } else {
      // Table header
      const tableY = currentY;
      const colWidths = [300, 200, 200, 200];
      const colX = [margin, margin + colWidths[0], margin + colWidths[0] + colWidths[1], margin + colWidths[0] + colWidths[1] + colWidths[2]];
      
      drawRect(ctx, margin, currentY, pageWidth, 50, '#1e40af');
      renderText(ctx, 'પ્લેટ સાઇઝ', colX[0] + 10, currentY + 15, 20, 'bold', '#ffffff');
      renderText(ctx, 'કુલ ઉધાર', colX[1] + 10, currentY + 15, 20, 'bold', '#ffffff');
      renderText(ctx, 'કુલ જમા', colX[2] + 10, currentY + 15, 20, 'bold', '#ffffff');
      renderText(ctx, 'બાકી', colX[3] + 10, currentY + 15, 20, 'bold', '#ffffff');
      currentY += 50;
      
      // Table rows
        activePlateBalances.forEach((balance, index) => {
        const rowColor = index % 2 === 0 ? '#f8fafc' : '#ffffff';
        drawRect(ctx, margin, currentY, pageWidth, 40, rowColor, '#e2e8f0', 1);
        
        renderText(ctx, balance.plate_size, colX[0] + 10, currentY + 10, 20, 'normal', '#374151');
        renderText(ctx, balance.total_borrowed.toString(), colX[1] + 10, currentY + 10, 20, 'normal', '#374151');
        renderText(ctx, balance.total_returned.toString(), colX[2] + 10, currentY + 10, 20, 'normal', '#374151');
        
        const outstandingColor = balance.outstanding > 0 ? '#dc2626' : balance.outstanding < 0 ? '#16a34a' : '#374151';
        renderText(ctx, balance.outstanding.toString(), colX[3] + 10, currentY + 10, 20, 'bold', outstandingColor);
        
        currentY += 40;
      });
      }
      
      currentY += 60;
      
      // Enhanced Transaction History
      if (data.transactions.length > 0) {
        renderText(ctx, 'ટ્રાન્ઝેક્શન ઇતિહાસ (Transaction History)', margin, currentY, 28, 'bold', '#1e40af');
        currentY += 50;
        
        // Enhanced transaction table header
        const txColWidths = [120, 180, 120, 400, 150, 200];
        const txColX = [
          margin,
          margin + txColWidths[0],
          margin + txColWidths[0] + txColWidths[1],
          margin + txColWidths[0] + txColWidths[1] + txColWidths[2],
          margin + txColWidths[0] + txColWidths[1] + txColWidths[2] + txColWidths[3],
          margin + txColWidths[0] + txColWidths[1] + txColWidths[2] + txColWidths[3] + txColWidths[4]
        ];
        
        drawRect(ctx, margin, currentY, pageWidth, 60, '#1e40af');
        renderText(ctx, 'પ્રકાર', txColX[0] + 10, currentY + 15, 18, 'bold', '#ffffff');
        renderText(ctx, 'ચલણ નંબર', txColX[1] + 10, currentY + 15, 18, 'bold', '#ffffff');
        renderText(ctx, 'તારીખ', txColX[2] + 10, currentY + 15, 18, 'bold', '#ffffff');
        renderText(ctx, 'પ્લેટ વિગતો', txColX[3] + 10, currentY + 15, 18, 'bold', '#ffffff');
        renderText(ctx, 'ડ્રાઈવર', txColX[4] + 10, currentY + 15, 18, 'bold', '#ffffff');
        renderText(ctx, 'કુલ', txColX[5] + 10, currentY + 15, 18, 'bold', '#ffffff');
        currentY += 60;
        
        // Enhanced transaction rows
        const maxTransactions = Math.min(data.transactions.length, 25);
        for (let i = 0; i < maxTransactions; i++) {
          const transaction = data.transactions[i];
          const rowColor = i % 2 === 0 ? '#f8fafc' : '#ffffff';
          const rowHeight = 80;
          
          drawRect(ctx, margin, currentY, pageWidth, rowHeight, rowColor, '#e2e8f0', 1);
          
          // Type
          const typeText = transaction.type === 'udhar' ? 'ઉધાર' : 'જમા';
          const typeColor = transaction.type === 'udhar' ? '#dc2626' : '#16a34a';
          renderText(ctx, typeText, txColX[0] + 10, currentY + 10, 18, 'bold', typeColor);
          
          // Challan Number
          renderText(ctx, `#${transaction.number}`, txColX[1] + 10, currentY + 10, 18, 'normal', '#374151');
          
          // Date
          const formattedDate = new Date(transaction.date).toLocaleDateString('en-GB');
          renderText(ctx, formattedDate, txColX[2] + 10, currentY + 10, 18, 'normal', '#374151');
          
          // Enhanced Details (plate sizes, quantities, and borrowed stock)
          let details = transaction.items
            .filter(item => item.quantity > 0)
            .map(item => {
              let itemDetail = `${item.plate_size}:${item.quantity}`;
              if (transaction.type === 'udhar' && item.borrowed_stock && item.borrowed_stock > 0) {
                itemDetail += `(+${item.borrowed_stock})`;
              }
              if (transaction.type === 'jama' && item.returned_borrowed_stock && item.returned_borrowed_stock > 0) {
                itemDetail += `(+${item.returned_borrowed_stock})`;
              }
              return itemDetail;
            })
            .join(', ');
          
          // Use text wrapping for better details display
          wrapText(ctx, details, txColX[3] + 10, currentY + 10, txColWidths[3] - 20, 20, 16, 'normal', '#374151');
          
          // Driver name
          if (transaction.driver_name) {
            renderText(ctx, transaction.driver_name, txColX[4] + 10, currentY + 10, 16, 'normal', '#374151');
          }
          
          // Enhanced Total (including borrowed stock)
          let total = transaction.items.reduce((sum, item) => sum + item.quantity, 0);
          if (transaction.type === 'udhar') {
            total += transaction.items.reduce((sum, item) => sum + (item.borrowed_stock || 0), 0);
          }
          if (transaction.type === 'jama') {
            total += transaction.items.reduce((sum, item) => sum + (item.returned_borrowed_stock || 0), 0);
          }
          renderText(ctx, total.toString(), txColX[5] + 10, currentY + 10, 18, 'bold', '#374151');
          
          currentY += rowHeight;
        }
        
        if (data.transactions.length > maxTransactions) {
          currentY += 20;
          renderText(ctx, `... અને ${data.transactions.length - maxTransactions} વધુ ટ્રાન્ઝેક્શન`, margin, currentY, 18, 'italic', '#6b7280');
          currentY += 40;
        }
      } else {
        renderText(ctx, 'કોઈ ટ્રાન્ઝેક્શન ઇતિહાસ નથી (No transaction history)', margin, currentY, 20, 'italic', '#6b7280');
        currentY += 60;
      }
      
      // Enhanced Summary Section
      currentY += 40;
      drawRect(ctx, margin, currentY, pageWidth, 150, '#e0f2fe', '#0277bd', 2);
      currentY += 20;
      
      renderText(ctx, 'સારાંશ (Summary)', margin + 20, currentY, 24, 'bold', '#0277bd');
      currentY += 40;
      
      const udharCount = data.transactions.filter(t => t.type === 'udhar').length;
      const jamaCount = data.transactions.filter(t => t.type === 'jama').length;
      
      renderText(ctx, `કુલ ઉધાર ચલણ: ${udharCount}`, margin + 20, currentY, 20, 'normal', '#374151');
      renderText(ctx, `કુલ જમા ચલણ: ${jamaCount}`, margin + 400, currentY, 20, 'normal', '#374151');
      currentY += 35;
      
      renderText(ctx, `કુલ ટ્રાન્ઝેક્શન: ${data.transactions.length}`, margin + 20, currentY, 20, 'normal', '#374151');
      renderText(ctx, `કુલ બાકી પ્લેટ્સ: ${data.total_outstanding}`, margin + 400, currentY, 20, 'bold', data.total_outstanding > 0 ? '#dc2626' : '#16a34a');
      currentY += 80;
      
      // Footer
      currentY = Math.max(currentY + 60, canvas.height - 200);
      drawLine(ctx, margin, currentY, margin + pageWidth, currentY, '#e2e8f0', 2);
      currentY += 30;
      
      renderText(ctx, `રિપોર્ટ જનરેટ કરવામાં આવી: ${new Date().toLocaleString('en-GB')}`, margin, currentY, 18, 'normal', '#6b7280');
      currentY += 40;
      
      renderText(ctx, COMPANY_INFO.email, canvas.width / 2, currentY, 20, 'normal', '#1e40af', 'center');
      
      // Convert to JPG
      const jpgDataUrl = canvas.toDataURL('image/jpeg', 0.92);
      resolve(jpgDataUrl);
      
    } catch (error) {
      console.error('Error generating client ledger:', error);
      reject(error);
    }
  });
}

export const downloadClientLedgerJPG = (dataUrl: string, filename: string) => {
  try {
    const link = document.createElement('a');
    link.download = `${filename}.jpg`;
    link.href = dataUrl;
    link.style.display = 'none';
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    // Clean up the data URL to free memory
    URL.revokeObjectURL(dataUrl);
  } catch (error) {
    console.error('Error downloading client ledger JPG:', error);
    alert('Error downloading ledger. Please try again.');
  }
};