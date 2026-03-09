import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/contexts/AuthContext';
import { subscribeToUserOrders, Order, requestReturn } from '@/services/orderService';
import { toast } from 'sonner';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import logoImage from '@/assets/logo-new.png';
import {
  Loader2,
  Package,
  ArrowLeft,
  Truck,
  ExternalLink,
  Clock,
  CheckCircle2,
  XCircle,
  MapPin,
  Home,
  ChevronRight,
  Ban,
  Mail,
  X,
  Download,
  RotateCcw as ReturnIcon,
  Share2,
  MessageCircle,
} from 'lucide-react';

// Order Status Stepper Component
const OrderStatusStepper = ({ status }: { status: string }) => {
  // Check if this is a return flow
  const isReturnFlow = ['returnRequested', 'returnScheduled', 'returned'].includes(status);
  
  // Normal order steps
  const orderSteps = [
    { key: 'pending', label: 'Order\nPlaced' },
    { key: 'processing', label: 'Processing' },
    { key: 'shipped', label: 'Shipped' },
    { key: 'outForDelivery', label: 'Out for\nDelivery' },
    { key: 'delivered', label: 'Delivered' },
  ];

  // Return flow steps
  const returnSteps = [
    { key: 'returnRequested', label: 'Return\nRequested' },
    { key: 'returnScheduled', label: 'Return\nScheduled' },
    { key: 'returned', label: 'Picked Up' },
  ];

  const steps = isReturnFlow ? returnSteps : orderSteps;

  const getStepIndex = (currentStatus: string) => {
    const index = steps.findIndex(s => s.key === currentStatus);
    return index >= 0 ? index : 0;
  };

  const currentIndex = getStepIndex(status);
  const isCancelled = status === 'cancelled';

  // For return flow, use emerald color scheme
  const activeColor = isReturnFlow ? 'bg-emerald-500' : 'bg-blue-500';
  const activeBorder = isReturnFlow ? 'border-emerald-500' : 'border-blue-500';
  const activeText = isReturnFlow ? 'text-emerald-600' : 'text-blue-600';
  const activeDot = isReturnFlow ? 'bg-emerald-500' : 'bg-blue-500';

  return (
    <div className="flex items-start justify-between relative" style={{ fontFamily: "'Poppins', sans-serif" }}>
      {/* Progress Line Background */}
      <div className="absolute top-4 left-6 right-6 h-0.5 bg-gray-200 z-0" />
      
      {/* Progress Line Active */}
      <div 
        className={`absolute top-4 left-6 h-0.5 z-0 transition-all duration-500 ${isCancelled ? 'bg-red-500' : activeColor}`}
        style={{ 
          width: isCancelled ? '0%' : `calc(${(currentIndex / (steps.length - 1)) * 100}% - 12px)`,
        }}
      />
      
      {steps.map((step, index) => {
        const isCompleted = !isCancelled && index <= currentIndex;
        const isCurrent = !isCancelled && index === currentIndex;
        
        return (
          <div key={step.key} className="flex flex-col items-center relative z-10" style={{ width: `${100 / steps.length}%`, fontFamily: "'Poppins', sans-serif" }}>
            {/* Step Circle */}
            <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 transition-all duration-300 ${
              isCancelled 
                ? 'bg-gray-100 border-gray-300'
                : isCompleted 
                  ? `${activeColor} ${activeBorder}` 
                  : 'bg-white border-gray-300'
            }`}>
              {isCompleted ? (
                <CheckCircle2 className="w-5 h-5 text-white" />
              ) : (
                <div className={`w-2 h-2 rounded-full ${isCurrent ? activeDot : 'bg-gray-300'}`} />
              )}
            </div>
            
            {/* Step Label */}
            <p className={`text-[10px] text-center mt-2 leading-tight whitespace-pre-line ${
              isCompleted ? `${activeText} font-medium` : 'text-gray-400'
            }`}>
              {step.label}
            </p>
          </div>
        );
      })}
    </div>
  );
};

const OrderDetailsPage = () => {
  const navigate = useNavigate();
  const { orderId } = useParams<{ orderId: string }>();
  const { user } = useAuth();
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [showShareMenu, setShowShareMenu] = useState(false);
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const [isDownloadingInvoice, setIsDownloadingInvoice] = useState(false);
  const receiptRef = useRef<HTMLDivElement>(null);

  // Return modal states
  const [showReturnModal, setShowReturnModal] = useState(false);
  const [returnReason, setReturnReason] = useState('');
  const [customReturnReason, setCustomReturnReason] = useState('');
  const [returnStep, setReturnStep] = useState<'reason' | 'details'>('reason');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Subscribe to user orders and find the specific order
  useEffect(() => {
    if (!user || !orderId) {
      navigate('/account/orders');
      return;
    }

    setLoading(true);
    
    const unsubscribe = subscribeToUserOrders(
      user.uid,
      (fetchedOrders) => {
        const foundOrder = fetchedOrders.find(o => o.id === orderId);
        if (foundOrder) {
          setOrder(foundOrder);
        } else {
          toast.error('Order not found');
          navigate('/account/orders');
        }
        setLoading(false);
      },
      (error) => {
        console.error('Error fetching order:', error);
        toast.error('Failed to load order details');
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [user, orderId, navigate]);

  // Format date
  const formatDate = (date: Date | { seconds: number; nanoseconds: number } | undefined) => {
    if (!date) return 'N/A';
    
    let jsDate: Date;
    if (date instanceof Date) {
      jsDate = date;
    } else if (typeof date === 'object' && 'seconds' in date) {
      jsDate = new Date(date.seconds * 1000);
    } else {
      return 'Invalid Date';
    }

    return jsDate.toLocaleDateString('en-IN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
  };

  // Get status label
  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'pending': return 'Pending';
      case 'processing': return 'Processing';
      case 'shipped': return 'Shipped';
      case 'outForDelivery': return 'Out for Delivery';
      case 'delivered': return 'Delivered';
      case 'cancelled': return 'Cancelled';
      case 'returnRequested': return 'Return Requested';
      case 'returnScheduled': return 'Return Scheduled';
      case 'returned': return 'Returned';
      default: return status.charAt(0).toUpperCase() + status.slice(1);
    }
  };

  // Check if order can be returned (within 7 days of delivery)
  const canReturnOrder = (order: Order) => {
    if (order.status !== 'delivered') return false;
    
    if (!order.deliveredAt) {
      return true;
    }

    try {
      let deliveredDate: Date;
      
      if (order.deliveredAt instanceof Date) {
        deliveredDate = order.deliveredAt;
      } else if (typeof order.deliveredAt === 'object' && 'toDate' in order.deliveredAt) {
        deliveredDate = (order.deliveredAt as any).toDate();
      } else if (typeof order.deliveredAt === 'object' && 'seconds' in order.deliveredAt) {
        deliveredDate = new Date((order.deliveredAt as any).seconds * 1000);
      } else if (typeof order.deliveredAt === 'string') {
        deliveredDate = new Date(order.deliveredAt);
      } else {
        return true;
      }
      
      const hoursSinceDelivery = (new Date().getTime() - deliveredDate.getTime()) / (1000 * 60 * 60);
      return hoursSinceDelivery <= 168; // 7 days = 168 hours
    } catch (error) {
      console.error('Error checking return eligibility:', error);
      return true;
    }
  };

  // Handle return request
  const handleRequestReturn = async () => {
    if (!order || !user || !returnReason) {
      toast.error('Please select a return reason');
      return;
    }

    if (returnReason === 'Other reason' && !customReturnReason.trim()) {
      toast.error('Please provide your reason for return');
      return;
    }

    setIsSubmitting(true);
    try {
      const finalReason = returnReason === 'Other reason' ? customReturnReason : returnReason;
      await requestReturn(order.id, user.uid, finalReason);
      toast.success('Return request submitted successfully. Our team will review it shortly.');
      setShowReturnModal(false);
      setReturnReason('');
      setCustomReturnReason('');
    } catch (error: any) {
      console.error('Error requesting return:', error);
      toast.error(error.message || 'Failed to request return');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Format payment method
  const formatPaymentMethod = (method: string) => {
    if (method === 'cod') return 'Cash On Delivery';
    if (method === 'online') return 'Online Payment';
    if (method === 'card') return 'Card Payment';
    return method.split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
  };

  // Generate receipt image
  const generateReceiptImage = async (order: Order): Promise<Blob | null> => {
    if (!receiptRef.current) {
      console.error('Receipt ref is null');
      return null;
    }
    
    try {
      const parentContainer = receiptRef.current.parentElement;
      if (parentContainer) {
        parentContainer.style.opacity = '1';
        parentContainer.style.zIndex = '99999';
      }
      
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const canvas = await html2canvas(receiptRef.current, {
        backgroundColor: '#ffffff',
        scale: 2,
        useCORS: true,
        logging: true,
        allowTaint: true,
        width: 380,
        height: receiptRef.current.scrollHeight,
      });
      
      if (parentContainer) {
        parentContainer.style.opacity = '0';
        parentContainer.style.zIndex = '-9999';
      }
      
      return new Promise((resolve) => {
        canvas.toBlob((blob) => {
          resolve(blob);
        }, 'image/png', 1.0);
      });
    } catch (error) {
      console.error('Error generating receipt image:', error);
      const parentContainer = receiptRef.current?.parentElement;
      if (parentContainer) {
        parentContainer.style.opacity = '0';
        parentContainer.style.zIndex = '-9999';
      }
      return null;
    }
  };

  // Share receipt as image
  const shareReceiptImage = async (platform: 'whatsapp' | 'email' | 'download' | 'native') => {
    if (!order) return;
    
    setIsGeneratingImage(true);
    
    try {
      const imageBlob = await generateReceiptImage(order);
      
      if (!imageBlob) {
        alert('Failed to generate receipt image. Please try again.');
        setIsGeneratingImage(false);
        return;
      }
      
      const file = new File([imageBlob], `order-receipt-${order.orderId}.png`, { type: 'image/png' });
      
      const downloadImage = () => {
        const url = URL.createObjectURL(imageBlob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `order-receipt-${order.orderId}.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      };
      
      const canShareFiles = navigator.canShare && navigator.canShare({ files: [file] });
      
      if (platform === 'native' && canShareFiles) {
        await navigator.share({
          title: `Order Receipt - ORD-${order.orderId}`,
          files: [file],
        });
      } else if (platform === 'download') {
        downloadImage();
        alert('Receipt image saved to your downloads!');
      } else if (canShareFiles) {
        await navigator.share({
          title: `Order Receipt - ORD-${order.orderId}`,
          files: [file],
        });
      } else {
        downloadImage();
        
        setTimeout(() => {
          if (platform === 'whatsapp') {
            window.open('https://web.whatsapp.com/', '_blank');
            alert('Receipt downloaded! Open WhatsApp and attach the image from your Downloads folder.');
          } else if (platform === 'email') {
            window.open(`mailto:?subject=Order Receipt - ORD-${order.orderId}`, '_blank');
            alert('Receipt downloaded! Attach the image from your Downloads folder to the email.');
          } else {
            alert('Receipt image downloaded! You can now share it on any platform.');
          }
        }, 500);
      }
      
      setShowShareMenu(false);
    } catch (error) {
      console.error('Error sharing receipt:', error);
      if ((error as Error).name !== 'AbortError') {
        alert('Failed to share receipt. Please try the "Save" option to download the image.');
      }
    } finally {
      setIsGeneratingImage(false);
    }
  };

  // Convert number to words for invoice
  const numberToWords = (num: number): string => {
    const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
    const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
    
    if (num === 0) return 'Zero';
    
    const convertLessThanThousand = (n: number): string => {
      if (n < 20) return ones[n];
      if (n < 100) return tens[Math.floor(n / 10)] + (n % 10 ? ' ' + ones[n % 10] : '');
      return ones[Math.floor(n / 100)] + ' Hundred' + (n % 100 ? ' ' + convertLessThanThousand(n % 100) : '');
    };
    
    const intPart = Math.floor(num);
    let words = '';
    
    if (intPart >= 10000000) {
      words += convertLessThanThousand(Math.floor(intPart / 10000000)) + ' Crore ';
    }
    if (intPart >= 100000) {
      words += convertLessThanThousand(Math.floor((intPart % 10000000) / 100000)) + ' Lakh ';
    }
    if (intPart >= 1000) {
      words += convertLessThanThousand(Math.floor((intPart % 100000) / 1000)) + ' Thousand ';
    }
    if (intPart % 1000 !== 0) {
      words += convertLessThanThousand(intPart % 1000);
    }
    
    return words.trim() + ' Rupees Only';
  };

  // Download Invoice as PDF
  const downloadInvoice = async () => {
    if (!order) return;
    
    setIsDownloadingInvoice(true);
    
    try {
      const doc = new jsPDF('p', 'mm', 'a4');
      const pageWidth = doc.internal.pageSize.getWidth();
      const margin = 15;
      let yPos = 15;
      
      try {
        const img = new Image();
        img.crossOrigin = 'Anonymous';
        img.src = logoImage;
        await new Promise((resolve, reject) => {
          img.onload = resolve;
          img.onerror = reject;
        });
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0);
        const logoBase64 = canvas.toDataURL('image/png');
        doc.addImage(logoBase64, 'PNG', margin, yPos, 45, 15);
      } catch (e) {
        doc.setFontSize(16);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(249, 115, 22);
        doc.text('SREE RASTHU SILVERS', margin, yPos + 10);
      }
      
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(0, 0, 0);
      doc.text('Tax Invoice/Bill of Supply', pageWidth - margin, yPos + 5, { align: 'right' });
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.text('(Original for Recipient)', pageWidth - margin, yPos + 10, { align: 'right' });
      
      yPos += 25;
      
      doc.setDrawColor(200, 200, 200);
      doc.line(margin, yPos, pageWidth - margin, yPos);
      yPos += 8;
      
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.text('Sold By:', margin, yPos);
      doc.text('Billing Address:', pageWidth / 2 + 10, yPos);
      
      yPos += 5;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      
      const soldByLines = [
        'Sree Rasthu Silvers',
        'Ramasomayajulu St, Rama Rao Peta',
        'Kakinada, Andhra Pradesh 533001',
        'India',
        'Phone: 63049 60489'
      ];
      soldByLines.forEach((line, idx) => {
        doc.text(line, margin, yPos + (idx * 4));
      });
      
      const billingLines = [
        order.shippingAddress.fullName,
        order.shippingAddress.address,
        `${order.shippingAddress.city}, ${order.shippingAddress.state}`,
        `PIN: ${order.shippingAddress.pincode}`,
        'India',
        `State/UT Code: ${order.shippingAddress.state === 'Andhra Pradesh' ? '37' : '00'}`
      ];
      billingLines.forEach((line, idx) => {
        doc.text(line, pageWidth / 2 + 10, yPos + (idx * 4), { align: 'left' });
      });
      
      yPos += 30;
      
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.text('Shipping Address:', pageWidth / 2 + 10, yPos);
      yPos += 5;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      
      const shippingLines = [
        order.shippingAddress.fullName,
        order.shippingAddress.address,
        `${order.shippingAddress.city}, ${order.shippingAddress.state}`,
        `PIN: ${order.shippingAddress.pincode}`,
        'India',
        `State/UT Code: ${order.shippingAddress.state === 'Andhra Pradesh' ? '37' : '00'}`,
        `Place of Supply: ${order.shippingAddress.state}`,
        `Place of Delivery: ${order.shippingAddress.state}`
      ];
      shippingLines.forEach((line, idx) => {
        doc.text(line, pageWidth / 2 + 10, yPos + (idx * 4));
      });
      
      yPos += 10;
      
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.text(`Order Number: ${order.orderId}`, margin, yPos);
      yPos += 5;
      doc.setFont('helvetica', 'normal' );
      doc.setFontSize(8);
      
      const orderDateObj = order.createdAt instanceof Date 
        ? order.createdAt 
        : new Date((order.createdAt as any).seconds * 1000);
      const orderDateStr = orderDateObj.toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' });
      doc.text(`Order Date: ${orderDateStr}`, margin, yPos);
      
      const invoiceNum = `INV-${order.orderId}`;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.text(`Invoice Number: ${invoiceNum}`, pageWidth - margin, yPos - 5, { align: 'right' });
      doc.setFont('helvetica', 'normal');
      doc.text(`Invoice Date: ${orderDateStr}`, pageWidth - margin, yPos, { align: 'right' });
      
      yPos += 25;
      
      const formatAmount = (amount: number) => {
        return amount.toFixed(2);
      };
      
      const tableData = order.items.map((item, idx) => {
        const netAmount = item.price * item.quantity;
        const taxRate = 3;
        const taxAmount = (netAmount * taxRate) / 100;
        return [
          (idx + 1).toString(),
          item.name,
          formatAmount(item.price),
          item.quantity.toString(),
          formatAmount(netAmount),
          `${taxRate}%`,
          'IGST',
          formatAmount(taxAmount),
          formatAmount(netAmount + taxAmount)
        ];
      });
      
      if (order.deliveryCharge > 0) {
        tableData.push([
          (order.items.length + 1).toString(),
          'Delivery Charges',
          formatAmount(order.deliveryCharge),
          '1',
          formatAmount(order.deliveryCharge),
          '0%',
          '-',
          '0.00',
          formatAmount(order.deliveryCharge)
        ]);
      }
      
      const totalTax = order.taxAmount;
      
      autoTable(doc, {
        startY: yPos,
        head: [['S.No', 'Description', 'Unit Price (Rs)', 'Qty', 'Net Amt (Rs)', 'Tax Rate', 'Tax Type', 'Tax Amt (Rs)', 'Total (Rs)']],
        body: tableData,
        theme: 'grid',
        headStyles: {
          fillColor: [240, 240, 240],
          textColor: [0, 0, 0],
          fontSize: 7,
          fontStyle: 'bold',
          halign: 'center'
        },
        bodyStyles: {
          fontSize: 7,
          textColor: [50, 50, 50]
        },
        columnStyles: {
          0: { halign: 'center', cellWidth: 10 },
          1: { cellWidth: 42 },
          2: { halign: 'right', cellWidth: 22 },
          3: { halign: 'center', cellWidth: 10 },
          4: { halign: 'right', cellWidth: 22 },
          5: { halign: 'center', cellWidth: 14 },
          6: { halign: 'center', cellWidth: 14 },
          7: { halign: 'right', cellWidth: 20 },
          8: { halign: 'right', cellWidth: 22 }
        },
        margin: { left: margin, right: margin },
        didDrawPage: (data) => {
          yPos = data.cursor?.y || yPos + 50;
        }
      });
      
      yPos = (doc as any).lastAutoTable?.finalY || yPos + 50;
      yPos += 5;
      
      doc.setFillColor(240, 240, 240);
      doc.rect(margin, yPos, pageWidth - (2 * margin), 8, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.text('TOTAL:', margin + 5, yPos + 5.5);
      doc.text(totalTax.toFixed(2), pageWidth - margin - 45, yPos + 5.5, { align: 'right' });
      doc.text('Rs. ' + order.total.toFixed(2), pageWidth - margin - 5, yPos + 5.5, { align: 'right' });
      
      yPos += 15;
      
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.text('Amount in Words:', margin, yPos);
      yPos += 5;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.text(numberToWords(order.total), margin, yPos);
      
      yPos += 15;
      
      const sigBoxWidth = 70;
      const sigBoxHeight = 25;
      const sigBoxX = pageWidth - margin - sigBoxWidth;
      
      doc.setDrawColor(150, 150, 150);
      doc.rect(sigBoxX, yPos, sigBoxWidth, sigBoxHeight);
      
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.text('For Sree Rasthu Silvers:', sigBoxX + 5, yPos + 6);
      
      doc.setFont('helvetica', 'bold');
      doc.text('Authorized Signatory', sigBoxX + sigBoxWidth / 2, yPos + 20, { align: 'center' });
      
      yPos += sigBoxHeight + 10;
      
      doc.setFontSize(7);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(100, 100, 100);
      doc.text('Whether tax is payable under reverse charge - No', margin, yPos);
      
      yPos += 10;
      
      doc.setDrawColor(200, 200, 200);
      doc.line(margin, yPos, pageWidth - margin, yPos);
      yPos += 5;
      
      doc.setFontSize(6);
      doc.setTextColor(120, 120, 120);
      const footerText = 'This is a computer generated invoice and does not require a physical signature. For any queries, contact us at +91 98198 73745 or support@sreerasthusilvers.com';
      doc.text(footerText, pageWidth / 2, yPos, { align: 'center', maxWidth: pageWidth - (2 * margin) });
      
      doc.save(`Invoice-${order.orderId}.pdf`);
      
    } catch (error) {
      console.error('Error generating invoice PDF:', error);
      alert('Failed to generate invoice. Please try again.');
    } finally {
      setIsDownloadingInvoice(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (!order) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50" style={{ fontFamily: "'Poppins', sans-serif" }}>
      {/* Header */}
      <div className="sticky top-0 bg-white border-b border-gray-200 px-4 py-3 flex items-center gap-3 z-10">
        <button
          onClick={() => navigate(-1)}
          className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-gray-700" />
        </button>
        <h2 className="text-lg font-semibold text-gray-900" style={{ fontFamily: "'Poppins', sans-serif" }}>Order Details</h2>
      </div>

      {/* Content */}
      <div className="pb-24">
        {/* Tracking ID Banner */}
        <div className="bg-blue-50 px-4 py-3 border-b border-blue-100">
          <p className="text-sm text-blue-700">
            Order can be tracked by <span className="font-semibold">ORD-{order.orderId}</span>
            {order.trackingId && (
              <span className="block mt-1 text-xs">Tracking ID: {order.trackingId}</span>
            )}
          </p>
        </div>

        {/* Product Card */}
        <div className="bg-white px-4 py-4 border-b border-gray-100">
          <div className="flex gap-4">
            <div className="w-16 h-16 bg-gray-50 rounded-lg flex-shrink-0 overflow-hidden border border-gray-100">
              <img 
                src={order.items[0]?.image} 
                alt={order.items[0]?.name} 
                className="w-full h-full object-cover" 
              />
            </div>
            <div className="flex-1">
              <h3 className="text-sm font-semibold text-gray-900" style={{ fontFamily: "'Poppins', sans-serif" }}>
                {order.items.length > 1 
                  ? `${order.items[0]?.name} +${order.items.length - 1} more`
                  : order.items[0]?.name
                }
              </h3>
              <p className="text-base font-bold text-gray-900 mt-1">₹{order.total.toLocaleString()}</p>
            </div>
          </div>
        </div>

        {/* Order Status Timeline */}
        <div className="bg-white px-4 py-5 border-b border-gray-100">
          <OrderStatusStepper status={order.status} />
        </div>

        {/* Current Status Card */}
        <div className="bg-white px-4 py-4 border-b border-gray-100">
          <div className="flex gap-3">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
              order.status === 'delivered' ? 'bg-emerald-100' :
              order.status === 'cancelled' ? 'bg-red-100' :
              order.status === 'returnRequested' ? 'bg-amber-100' :
              order.status === 'returnScheduled' ? 'bg-emerald-100' :
              order.status === 'returned' ? 'bg-gray-100' :
              'bg-blue-100'
            }`}>
              {order.status === 'delivered' ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-600" />
              ) : order.status === 'cancelled' ? (
                <XCircle className="w-5 h-5 text-red-600" />
              ) : order.status === 'returnRequested' ? (
                <ReturnIcon className="w-5 h-5 text-amber-600" />
              ) : order.status === 'returnScheduled' ? (
                <ReturnIcon className="w-5 h-5 text-emerald-600" />
              ) : order.status === 'returned' ? (
                <CheckCircle2 className="w-5 h-5 text-gray-600" />
              ) : (
                <Package className="w-5 h-5 text-blue-600" />
              )}
            </div>
            <div className="flex-1">
              <h4 className="text-base font-semibold text-gray-900" style={{ fontFamily: "'Poppins', sans-serif" }}>{getStatusLabel(order.status)}</h4>
              {order.carrier && (
                <p className="text-xs text-gray-500 flex items-center gap-1 mt-0.5">
                  <MapPin className="w-3 h-3" />
                  {order.carrier}
                </p>
              )}
              <p className="text-xs text-gray-600 mt-1" style={{ fontFamily: "'Poppins', sans-serif" }}>
                {order.status === 'pending' && 'Your order has been placed successfully'}
                {order.status === 'processing' && 'Package is being prepared for shipment'}
                {order.status === 'shipped' && 'Package has left the warehouse'}
                {order.status === 'outForDelivery' && 'Package is out for delivery'}
                {order.status === 'delivered' && 'Package has been delivered'}
                {order.status === 'cancelled' && 'Order has been cancelled'}
                {order.status === 'returnRequested' && 'Return request submitted. Waiting for approval.'}
                {order.status === 'returnScheduled' && 'Return approved! Pickup will be scheduled soon.'}
                {order.status === 'returned' && 'Item has been picked up and returned successfully.'}
              </p>
              <p className="text-xs text-gray-400 mt-1 flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {formatDate(order.updatedAt || order.createdAt)}
              </p>
            </div>
          </div>
        </div>

        {/* OTP Delivery Verification - Shown when out for delivery */}
        {order.status === 'outForDelivery' && order.delivery_otp && (
          <div className="bg-white px-4 py-3 border-b border-gray-100">
            <p className="text-xs font-semibold text-gray-900">Delivery OTP</p>
            <p className="text-xs text-gray-600 mt-0.5">Share this OTP with your delivery partner</p>
            <p className="text-sm font-bold text-gray-900 mt-1">{order.delivery_otp}</p>
          </div>
        )}

        {/* Delivery Message */}
        {order.status !== 'delivered' && order.status !== 'cancelled' && 
         order.status !== 'returnRequested' && order.status !== 'returnScheduled' && 
         order.status !== 'returned' && (
          <div className="bg-amber-50 px-4 py-3 border-b border-amber-100">
            <p className="text-sm text-amber-800">
              {order.status === 'shipped' || order.status === 'outForDelivery'
                ? "Yayy! your item is on the way. It will reach you soon."
                : "Your order is being processed. We'll notify you once it's shipped."
              }
            </p>
          </div>
        )}

        {/* Delivery Executive Info */}
        {order.status !== 'delivered' && order.status !== 'cancelled' && (
          <div className="bg-gray-50 px-4 py-3 border-b border-gray-200">
            <p className="text-xs text-gray-600">
              <span className="font-medium text-gray-800">Delivery Executive details</span> will be available once the order is out for delivery
            </p>
          </div>
        )}

        {/* Action Buttons */}
        <div className="bg-white px-4 py-4 flex gap-3 border-b border-gray-100">
          {/* Cancel Button - Only for pending/processing orders */}
          {(order.status === 'pending' || order.status === 'processing') && (
            <button
              onClick={() => navigate(`/account/orders/${orderId}/cancel`)}
              className="flex-1 py-2.5 px-4 bg-red-50 border border-red-200 rounded-lg text-sm font-medium text-red-700 flex items-center justify-center gap-2 hover:bg-red-100 transition-colors"
            >
              <Ban className="w-4 h-4" />
              Cancel Order
            </button>
          )}

          {/* Return Button - Only for delivered orders within 7 days */}
          {canReturnOrder(order) && (
            <button
              onClick={() => setShowReturnModal(true)}
              className="flex-1 py-2.5 px-4 bg-emerald-50 border border-emerald-200 rounded-lg text-sm font-medium text-emerald-700 flex items-center justify-center gap-2 hover:bg-emerald-100 transition-colors"
            >
              <ReturnIcon className="w-4 h-4" />
              Return Items
            </button>
          )}

          {/* Chat Button - Always show */}
          <button 
            onClick={() => {
              const phoneNumber = '919819873745';
              const message = encodeURIComponent(
                `Hello! I need assistance regarding my order:\n\nOrder ID: ORD-${order.orderId}\nProduct: ${order.items[0]?.name}${order.items.length > 1 ? ` +${order.items.length - 1} more items` : ''}\nStatus: ${getStatusLabel(order.status)}\n\nPlease help me with my product enquiry.`
              );
              window.open(`https://wa.me/${phoneNumber}?text=${message}`, '_blank');
            }}
            className="flex-1 py-2.5 px-4 bg-blue-50 border border-blue-200 rounded-lg text-sm font-medium text-blue-700 flex items-center justify-center gap-2 hover:bg-blue-100 transition-colors"
          >
            <MessageCircle className="w-4 h-4" />
            Chat with us
          </button>
        </div>

        {/* Track Package Button */}
        {order.trackingUrl && (
          <div className="bg-white px-4 py-3 border-b border-gray-100">
            <a
              href={order.trackingUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 w-full py-3 bg-blue-600 text-white text-sm font-semibold rounded-xl"
            >
              <Truck className="w-4 h-4" />
              Track Package
              <ExternalLink className="w-4 h-4" />
            </a>
          </div>
        )}

        {/* Delivery Details Section */}
        <div className="bg-white mt-2 border-t border-b border-gray-100">
          <h3 className="px-4 py-3 text-base font-semibold text-gray-900 border-b border-gray-100" style={{ fontFamily: "'Poppins', sans-serif" }}>Delivery details</h3>
          
          {/* Delivery Address */}
          <div className="px-4 py-3 flex items-center gap-3 border-b border-gray-100">
            <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center flex-shrink-0">
              <Home className="w-5 h-5 text-gray-600" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-blue-600">Delivery Address</p>
              <p className="text-xs text-gray-600 truncate">
                {order.shippingAddress.address}, {order.shippingAddress.city}
              </p>
            </div>
            <ChevronRight className="w-5 h-5 text-gray-400 flex-shrink-0" />
          </div>

          {/* Customer Info */}
          <div className="px-4 py-3 flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center flex-shrink-0">
              <span className="text-white text-sm font-semibold">
                {order.shippingAddress.fullName.charAt(0).toUpperCase()}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900">{order.shippingAddress.fullName}</p>
              <p className="text-xs text-gray-500">ORD-{order.orderId}</p>
            </div>
            <ChevronRight className="w-5 h-5 text-gray-400 flex-shrink-0" />
          </div>
        </div>

        {/* Price Details Section */}
        <div className="bg-white mt-2 border-t border-b border-gray-100">
          <h3 className="px-4 py-3 text-base font-semibold text-gray-900 border-b border-gray-100" style={{ fontFamily: "'Poppins', sans-serif" }}>Price details</h3>
          
          <div className="px-4 py-3 space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Selling price</span>
              <span className="text-gray-900">₹{order.subtotal.toLocaleString()}</span>
            </div>
            {order.discount > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-green-600">Discount</span>
                <span className="text-green-600">-₹{order.discount.toLocaleString()}</span>
              </div>
            )}
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Total fees</span>
              <span className="text-gray-900">₹{(order.deliveryCharge + order.taxAmount).toLocaleString()}</span>
            </div>
            <div className="pt-3 border-t border-gray-200 flex justify-between">
              <span className="text-base font-semibold text-blue-600">Total amount</span>
              <span className="text-base font-bold text-gray-900">₹{order.total.toLocaleString()}</span>
            </div>
          </div>
        </div>

        {/* Share Order Details */}
        <div className="bg-white mt-2 px-4 py-3 border-t border-gray-100">
          <button 
            onClick={() => setShowShareMenu(true)}
            className="w-full flex items-center justify-between text-sm text-gray-700 font-medium py-2"
          >
            <div className="flex items-center gap-3">
              <Share2 className="w-5 h-5 text-gray-500" />
              <span>Share Order Details</span>
            </div>
            <ChevronRight className="w-4 h-4 text-gray-400" />
          </button>
        </div>

        {/* Download Invoice */}
        <div className="bg-white px-4 py-3 border-b border-gray-100">
          <button 
            onClick={() => downloadInvoice()}
            disabled={isDownloadingInvoice}
            className="w-full flex items-center justify-between text-sm text-gray-700 font-medium py-2 disabled:opacity-50"
          >
            <div className="flex items-center gap-3">
              <Download className="w-5 h-5 text-gray-500" />
              <div className="text-left">
                <span className="block">Download Invoice</span>
                <span className="text-xs text-gray-400">Order ID: {order.orderId}</span>
              </div>
            </div>
            {isDownloadingInvoice ? (
              <Loader2 className="w-4 h-4 text-gray-400 animate-spin" />
            ) : (
              <ChevronRight className="w-4 h-4 text-gray-400" />
            )}
          </button>
        </div>

        {/* Feedback */}
        <div className="bg-white mt-2 px-4 py-4 border-t border-b border-gray-100">
          <button className="w-full flex items-center justify-center gap-2 text-sm text-gray-500">
            Did you find this page helpful?
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Hidden Receipt Component for Image Generation */}
      {order && (
        <div style={{ 
          position: 'fixed', 
          left: 0, 
          top: 0, 
          zIndex: -9999,
          opacity: 0,
          pointerEvents: 'none',
          overflow: 'hidden',
        }}>
          <div
            ref={receiptRef}
            style={{
              width: '380px',
              padding: '24px',
              backgroundColor: '#ffffff',
              fontFamily: "'Poppins', sans-serif",
            }}
          >
            {/* Header */}
            <div style={{ textAlign: 'center', marginBottom: '20px', borderBottom: '2px solid #f97316', paddingBottom: '16px' }}>
              <h1 style={{ fontSize: '22px', fontWeight: 'bold', color: '#f97316', margin: 0 }}>SREE RASTHU SILVERS</h1>
              <p style={{ fontSize: '11px', color: '#6b7280', margin: '4px 0 0 0' }}>92.5% Pure Silver Jewelry</p>
            </div>

            {/* Receipt Title */}
            <div style={{ textAlign: 'center', marginBottom: '16px' }}>
              <h2 style={{ fontSize: '16px', fontWeight: '600', color: '#1f2937', margin: 0 }}>ORDER RECEIPT</h2>
            </div>

            {/* Order Info */}
            <div style={{ backgroundColor: '#fff7ed', padding: '12px', borderRadius: '8px', marginBottom: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                <span style={{ fontSize: '12px', color: '#6b7280' }}>Order ID:</span>
                <span style={{ fontSize: '12px', fontWeight: '600', color: '#1f2937' }}>ORD-{order.orderId}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                <span style={{ fontSize: '12px', color: '#6b7280' }}>Date:</span>
                <span style={{ fontSize: '12px', color: '#1f2937' }}>{formatDate(order.createdAt)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '12px', color: '#6b7280' }}>Status:</span>
                <span style={{ fontSize: '12px', fontWeight: '600', color: '#f97316' }}>{getStatusLabel(order.status)}</span>
              </div>
            </div>

            {/* Items */}
            <div style={{ marginBottom: '16px' }}>
              <h3 style={{ fontSize: '13px', fontWeight: '600', color: '#1f2937', marginBottom: '10px', borderBottom: '1px solid #e5e7eb', paddingBottom: '6px' }}>Items Ordered</h3>
              {order.items.map((item, idx) => (
                <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px', paddingBottom: '10px', borderBottom: idx < order.items.length - 1 ? '1px dashed #e5e7eb' : 'none' }}>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontSize: '12px', fontWeight: '500', color: '#1f2937', margin: 0 }}>{item.name}</p>
                    <p style={{ fontSize: '11px', color: '#6b7280', margin: '2px 0 0 0' }}>Qty: {item.quantity} × ₹{item.price.toLocaleString('en-IN')}</p>
                  </div>
                  <span style={{ fontSize: '12px', fontWeight: '600', color: '#1f2937' }}>₹{(item.quantity * item.price).toLocaleString('en-IN')}</span>
                </div>
              ))}
            </div>

            {/* Price Details */}
            <div style={{ backgroundColor: '#f9fafb', padding: '12px', borderRadius: '8px', marginBottom: '16px' }}>
              <h3 style={{ fontSize: '13px', fontWeight: '600', color: '#1f2937', marginBottom: '10px' }}>Price Details</h3>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                <span style={{ fontSize: '12px', color: '#6b7280' }}>Selling Price</span>
                <span style={{ fontSize: '12px', color: '#1f2937' }}>₹{order.subtotal.toLocaleString('en-IN')}</span>
              </div>
              {order.discount > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                  <span style={{ fontSize: '12px', color: '#16a34a' }}>Discount</span>
                  <span style={{ fontSize: '12px', color: '#16a34a' }}>-₹{order.discount.toLocaleString('en-IN')}</span>
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                <span style={{ fontSize: '12px', color: '#6b7280' }}>Total Fees</span>
                <span style={{ fontSize: '12px', color: '#1f2937' }}>₹{(order.deliveryCharge + order.taxAmount).toLocaleString('en-IN')}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderTop: '2px solid #f97316' }}>
                <span style={{ fontSize: '14px', fontWeight: '700', color: '#f97316' }}>Total Amount</span>
                <span style={{ fontSize: '14px', fontWeight: '700', color: '#1f2937' }}>₹{order.total.toLocaleString('en-IN')}</span>
              </div>
            </div>

            {/* Payment & Delivery */}
            <div style={{ marginBottom: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span style={{ fontSize: '12px', color: '#6b7280' }}>Payment:</span>
                <span style={{ fontSize: '12px', fontWeight: '500', color: '#1f2937' }}>{formatPaymentMethod(order.paymentMethod)}</span>
              </div>
              <div style={{ marginTop: '10px' }}>
                <p style={{ fontSize: '12px', color: '#6b7280', margin: '0 0 4px 0' }}>Delivery Address:</p>
                <p style={{ fontSize: '12px', color: '#1f2937', margin: 0, lineHeight: '1.4' }}>
                  {order.shippingAddress.fullName}<br />
                  {order.shippingAddress.address}<br />
                  {order.shippingAddress.city}, {order.shippingAddress.state}<br />
                  PIN: {order.shippingAddress.pincode}<br />
                  Mobile: {order.shippingAddress.mobile}
                </p>
              </div>
            </div>

            {/* Tracking Info */}
            {(order.trackingId || order.carrier) && (
              <div style={{ backgroundColor: '#eff6ff', padding: '10px', borderRadius: '8px', marginBottom: '16px' }}>
                <p style={{ fontSize: '12px', fontWeight: '600', color: '#1d4ed8', marginBottom: '6px' }}>Tracking Information</p>
                {order.trackingId && <p style={{ fontSize: '11px', color: '#4b5563', margin: '0 0 4px 0' }}>ID: {order.trackingId}</p>}
                {order.carrier && <p style={{ fontSize: '11px', color: '#4b5563', margin: 0 }}>Carrier: {order.carrier}</p>}
              </div>
            )}

            {/* Footer */}
            <div style={{ textAlign: 'center', borderTop: '1px solid #e5e7eb', paddingTop: '16px' }}>
              <p style={{ fontSize: '12px', fontWeight: '500', color: '#1f2937', margin: '0 0 4px 0' }}>Thank you for shopping with us! 🎉</p>
              <p style={{ fontSize: '11px', color: '#6b7280', margin: '0 0 8px 0' }}>For support: +91 98198 73745</p>
              <p style={{ fontSize: '10px', color: '#9ca3af', margin: 0 }}>www.sreerasthusilvers.com</p>
            </div>
          </div>
        </div>
      )}

      {/* Share Menu Modal */}
      <AnimatePresence>
        {showShareMenu && order && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-[60] flex items-end"
            onClick={() => setShowShareMenu(false)}
          >
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
              className="bg-white w-full rounded-t-3xl p-6 pb-8"
              style={{ fontFamily: "'Poppins', sans-serif" }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold text-gray-900">Share Order Details</h3>
                <button
                  onClick={() => setShowShareMenu(false)}
                  className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100"
                >
                  <X className="w-5 h-5 text-gray-600" />
                </button>
              </div>

              {/* Generating Image Indicator */}
              {isGeneratingImage && (
                <div className="flex items-center justify-center py-4 mb-4">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-orange-500 mr-3"></div>
                  <span className="text-sm text-gray-600">Generating receipt image...</span>
                </div>
              )}

              {/* Share Options Grid */}
              <div className="grid grid-cols-4 gap-4">
                {/* WhatsApp */}
                <button
                  onClick={() => shareReceiptImage('whatsapp')}
                  disabled={isGeneratingImage}
                  className="flex flex-col items-center gap-2 disabled:opacity-50"
                >
                  <div className="w-14 h-14 bg-green-100 rounded-2xl flex items-center justify-center">
                    <MessageCircle className="w-7 h-7 text-green-600" />
                  </div>
                  <span className="text-xs text-gray-700">WhatsApp</span>
                </button>

                {/* Gmail */}
                <button
                  onClick={() => shareReceiptImage('email')}
                  disabled={isGeneratingImage}
                  className="flex flex-col items-center gap-2 disabled:opacity-50"
                >
                  <div className="w-14 h-14 bg-red-100 rounded-2xl flex items-center justify-center">
                    <Mail className="w-7 h-7 text-red-600" />
                  </div>
                  <span className="text-xs text-gray-700">Gmail</span>
                </button>

                {/* Instagram */}
                <button
                  onClick={() => shareReceiptImage('native')}
                  disabled={isGeneratingImage}
                  className="flex flex-col items-center gap-2 disabled:opacity-50"
                >
                  <div className="w-14 h-14 bg-pink-100 rounded-2xl flex items-center justify-center">
                    <Share2 className="w-7 h-7 text-pink-600" />
                  </div>
                  <span className="text-xs text-gray-700">Instagram</span>
                </button>

                {/* Download Image */}
                <button
                  onClick={() => shareReceiptImage('download')}
                  disabled={isGeneratingImage}
                  className="flex flex-col items-center gap-2 disabled:opacity-50"
                >
                  <div className="w-14 h-14 bg-gray-100 rounded-2xl flex items-center justify-center">
                    <Download className="w-7 h-7 text-gray-600" />
                  </div>
                  <span className="text-xs text-gray-700">Save</span>
                </button>

                {/* Facebook Messenger */}
                <button
                  onClick={() => shareReceiptImage('native')}
                  disabled={isGeneratingImage}
                  className="flex flex-col items-center gap-2 disabled:opacity-50"
                >
                  <div className="w-14 h-14 bg-blue-100 rounded-2xl flex items-center justify-center">
                    <MessageCircle className="w-7 h-7 text-blue-600" />
                  </div>
                  <span className="text-xs text-gray-700">Messenger</span>
                </button>

                {/* SMS */}
                <button
                  onClick={() => shareReceiptImage('native')}
                  disabled={isGeneratingImage}
                  className="flex flex-col items-center gap-2 disabled:opacity-50"
                >
                  <div className="w-14 h-14 bg-green-100 rounded-2xl flex items-center justify-center">
                    <MessageCircle className="w-7 h-7 text-green-700" />
                  </div>
                  <span className="text-xs text-gray-700">SMS</span>
                </button>

                {/* Telegram */}
                <button
                  onClick={() => shareReceiptImage('native')}
                  disabled={isGeneratingImage}
                  className="flex flex-col items-center gap-2 disabled:opacity-50"
                >
                  <div className="w-14 h-14 bg-sky-100 rounded-2xl flex items-center justify-center">
                    <Share2 className="w-7 h-7 text-sky-600" />
                  </div>
                  <span className="text-xs text-gray-700">Telegram</span>
                </button>

                {/* More (Native Share) */}
                <button
                  onClick={() => shareReceiptImage('native')}
                  disabled={isGeneratingImage}
                  className="flex flex-col items-center gap-2 disabled:opacity-50"
                >
                  <div className="w-14 h-14 bg-gray-100 rounded-2xl flex items-center justify-center">
                    <Share2 className="w-7 h-7 text-gray-600" />
                  </div>
                  <span className="text-xs text-gray-700">More</span>
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Return Request Modal - Full Page */}
      <AnimatePresence>
        {showReturnModal && order && (
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="fixed inset-0 bg-white z-[99999] flex flex-col"
          >
            {/* Header */}
            <div className="flex items-center gap-3 px-4 py-4 border-b border-gray-100">
              <button
                onClick={() => {
                  if (returnStep === 'details') {
                    setReturnStep('reason');
                  } else {
                    setShowReturnModal(false);
                    setReturnReason('');
                    setCustomReturnReason('');
                    setReturnStep('reason');
                  }
                }}
                className="w-8 h-8 flex items-center justify-center"
              >
                <ArrowLeft className="w-5 h-5 text-gray-700" />
              </button>
              <h3 className="text-lg font-semibold text-gray-900" style={{ fontFamily: "'Poppins', sans-serif" }}>Request Return</h3>
            </div>

            {/* Return Reasons Grid - Step 1 */}
            {returnStep === 'reason' && (
              <>
                <div className="flex-1 overflow-y-auto px-4 py-4">
              
              {/* Product Info */}
              <div className="mb-4">
                <div className="flex gap-3">
                  <div className="w-16 h-16 bg-gray-100 rounded-lg overflow-hidden flex-shrink-0">
                    <img 
                      src={order.items[0]?.image} 
                      alt={order.items[0]?.name}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="text-sm font-semibold text-gray-900 line-clamp-2" style={{ fontFamily: "'Poppins', sans-serif" }}>
                      {order.items[0]?.name}
                    </h4>
                    <p className="text-xs text-gray-500 mt-0.5" style={{ fontFamily: "'Poppins', sans-serif" }}>
                      Quantity: {order.items[0]?.quantity}
                    </p>
                    <p className="text-base font-bold text-gray-900 mt-1" style={{ fontFamily: "'Poppins', sans-serif" }}>
                      ₹{order.items[0]?.price?.toLocaleString()}
                    </p>
                  </div>
                </div>
                {order.items.length > 1 && (
                  <p className="text-xs text-gray-500 mt-2 text-center" style={{ fontFamily: "'Poppins', sans-serif" }}>
                    +{order.items.length - 1} more items will be included in this return
                  </p>
                )}
              </div>

              <h4 className="text-base font-semibold text-gray-900 mb-4" style={{ fontFamily: "'Poppins', sans-serif" }}>Reason for return</h4>
              
              <div className="grid grid-cols-2 gap-3">
                {[
                  { 
                    reason: 'Quality not as expected', 
                    image: 'https://i.ibb.co/4R89tnfN/IMG-20260303-223842.webp',
                    description: 'Quality of the product not as expected'
                  },
                  { 
                    reason: 'Received wrong item', 
                    image: 'https://i.ibb.co/n8gYFKdG/IMG-20260303-223851.webp',
                    description: 'Received wrong item'
                  },
                  { 
                    reason: "Don't want anymore", 
                    image: 'https://i.ibb.co/Gv310qKb/IMG-20260303-223900.webp',
                    description: "Don't want the product anymore"
                  },
                  { 
                    reason: 'Missing in package', 
                    image: 'https://i.ibb.co/BSzmq7H/IMG-20260303-223908.webp',
                    description: 'Product is missing in the package'
                  },
                  { 
                    reason: 'Damaged/Broken item', 
                    image: 'https://i.ibb.co/XxBg8Bcy/IMG-20260303-223921.webp',
                    description: 'Received a broken/damaged item'
                  },
                  { 
                    reason: "Size/Fit issue", 
                    image: 'https://i.ibb.co/yndkCNM1/IMG-20260303-223832.webp',
                    description: "Don't like the size/fit of the product"
                  },
                ].map((item) => (
                  <button
                    key={item.reason}
                    onClick={() => {
                      setReturnReason(item.reason);
                      setCustomReturnReason('');
                    }}
                    className={`flex flex-col items-center p-4 rounded-xl border-2 transition-all ${
                      returnReason === item.reason
                        ? 'border-gray-900 bg-gray-50'
                        : 'border-gray-200 bg-white hover:border-gray-300'
                    }`}
                  >
                    <img src={item.image} alt={item.description} className="w-16 h-16 mb-2 object-contain" />
                    <span className={`text-xs text-center leading-tight ${
                      returnReason === item.reason ? 'text-gray-900 font-medium' : 'text-gray-600'
                    }`} style={{ fontFamily: "'Poppins', sans-serif" }}>
                      {item.description}
                    </span>
                  </button>
                ))}
              </div>

              {/* Other Reason Option */}
              <button
                onClick={() => setReturnReason('Other reason')}
                className={`w-full mt-3 p-4 rounded-xl border-2 transition-all flex items-center gap-3 ${
                  returnReason === 'Other reason'
                    ? 'border-gray-900 bg-gray-50'
                    : 'border-gray-200 bg-white hover:border-gray-300'
                }`}
              >
                <span className="text-2xl">✏️</span>
                <span className={`text-sm ${
                  returnReason === 'Other reason' ? 'text-gray-900 font-medium' : 'text-gray-600'
                }`} style={{ fontFamily: "'Poppins', sans-serif" }}>
                  Other reason
                </span>
              </button>

              {/* Custom Reason Input - Shows when "Other reason" is selected */}
              {returnReason === 'Other reason' && (
                <div className="mt-3">
                  <textarea
                    value={customReturnReason}
                    onChange={(e) => setCustomReturnReason(e.target.value)}
                    placeholder="Please describe your reason for return..."
                    rows={4}
                    maxLength={200}
                    className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:outline-none focus:border-gray-900 bg-gray-50 text-gray-900 placeholder-gray-500 resize-none"
                    style={{ fontFamily: "'Poppins', sans-serif" }}
                    autoFocus
                  />
                  <p className="text-xs text-gray-700 mt-1 ml-1" style={{ fontFamily: "'Poppins', sans-serif" }}>
                    {customReturnReason.length}/200 characters
                  </p>
                </div>
              )}
            </div>

            {/* Bottom Button - Step 1 */}
            <div className="px-4 py-4 border-t border-gray-100 bg-white">
              <button
                onClick={() => setReturnStep('details')}
                disabled={!returnReason || (returnReason === 'Other reason' && !customReturnReason.trim())}
                className={`w-full py-4 rounded-full font-semibold text-base transition-all ${
                  !returnReason || (returnReason === 'Other reason' && !customReturnReason.trim())
                    ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                    : 'bg-gray-900 text-white hover:bg-gray-800'
                }`}
                style={{ fontFamily: "'Poppins', sans-serif" }}
              >
                Continue
              </button>
            </div>
              </>
            )}

            {/* Return Details - Step 2 */}
            {returnStep === 'details' && (
              <>
                {/* Scrollable Content */}
                <div className="flex-1 overflow-y-auto">
                  <div className="px-4 py-6 space-y-6">
                    {/* Product Info */}
                    <div>
                      <div className="flex gap-3">
                        <div className="w-16 h-16 bg-gray-100 rounded-lg overflow-hidden flex-shrink-0">
                          <img 
                            src={order.items[0]?.image} 
                            alt={order.items[0]?.name}
                            className="w-full h-full object-cover"
                          />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="text-sm font-semibold text-gray-900 line-clamp-2" style={{ fontFamily: "'Poppins', sans-serif" }}>
                            {order.items[0]?.name}
                          </h4>
                          <p className="text-xs text-gray-500 mt-0.5" style={{ fontFamily: "'Poppins', sans-serif" }}>
                            Quantity: {order.items[0]?.quantity}
                          </p>
                          <p className="text-base font-bold text-gray-900 mt-1" style={{ fontFamily: "'Poppins', sans-serif" }}>
                            ₹{order.items[0]?.price?.toLocaleString()}
                          </p>
                        </div>
                      </div>
                      {order.items.length > 1 && (
                        <p className="text-xs text-gray-500 mt-2 text-center" style={{ fontFamily: "'Poppins', sans-serif" }}>
                          +{order.items.length - 1} more items will be included in this return
                        </p>
                      )}
                    </div>

                    <div className="h-px bg-gray-200" />

                    {/* Replacement Info */}
                    <div>
                      <h4 className="text-base font-medium text-gray-900 mb-3" style={{ fontFamily: "'Poppins', sans-serif" }}>
                        Return Type
                      </h4>
                      <div className="p-4 bg-blue-50 rounded-lg border-2 border-blue-200">
                        <p className="text-sm font-semibold text-gray-900" style={{ fontFamily: "'Poppins', sans-serif" }}>
                          Product Replacement
                        </p>
                        <p className="text-xs text-gray-600 mt-1" style={{ fontFamily: "'Poppins', sans-serif" }}>
                          Your product will be replaced with the same item after quality check
                        </p>
                      </div>
                    </div>

                    <div className="h-px bg-gray-200" />

                    {/* Pick up and delivery */}
                    <div>
                      <h4 className="text-sm font-medium text-gray-900 mb-3" style={{ fontFamily: "'Poppins', sans-serif" }}>
                        Pick up and delivery
                      </h4>
                      <div className="p-4 bg-gray-50 rounded-lg">
                        <p className="text-sm font-medium text-gray-900" style={{ fontFamily: "'Poppins', sans-serif" }}>
                          {order.shippingAddress?.fullName || 'N/A'}
                        </p>
                        <p className="text-xs text-gray-600 mt-1" style={{ fontFamily: "'Poppins', sans-serif" }}>
                          📱 {order.shippingAddress?.mobile || 'N/A'}
                        </p>
                        <p className="text-xs text-gray-600 mt-1" style={{ fontFamily: "'Poppins', sans-serif" }}>
                          {order.shippingAddress?.address}, { order.shippingAddress?.locality && `${order.shippingAddress.locality}, `}{order.shippingAddress?.city}, {order.shippingAddress?.state} - {order.shippingAddress?.pincode}
                        </p>
                        {order.shippingAddress?.landmark && (
                          <p className="text-xs text-gray-600 mt-1" style={{ fontFamily: "'Poppins', sans-serif" }}>
                            Landmark: {order.shippingAddress.landmark}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Bottom Button - Step 2 */}
                <div className="px-4 py-4 border-t border-gray-100 bg-white">
                  <button
                    onClick={handleRequestReturn}
                    disabled={isSubmitting}
                    className={`w-full py-4 rounded-full font-semibold text-base transition-all ${
                      isSubmitting
                        ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                        : 'bg-gray-900 text-white hover:bg-gray-800'
                    }`}
                    style={{ fontFamily: "'Poppins', sans-serif" }}
                  >
                    {isSubmitting ? 'Submitting...' : 'Continue'}
                  </button>
                </div>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default OrderDetailsPage;
