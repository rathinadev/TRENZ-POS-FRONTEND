// src/utils/billFormatter.ts
import type { GSTBillData } from '../components/templates/GSTBillTemplate';
import type { NonGSTBillData } from '../components/templates/NonGSTBillTemplate';
import type { BillData, CartItem } from '../types/business.types';

/**
 * Formats bill data for GST bill template
 */
export const formatGSTBill = (
  billData: BillData,
  vendorProfile: {
    business_name: string;
    address: string;
    gst_no: string;
    fssai_license?: string;
    phone: string;
    footer_note?: string;
    logo_url?: string;
  }
): GSTBillData => {
  // Calculate GST percentages from amounts
  const totalGST = (billData.cgst || 0) + (billData.sgst || 0);
  const cgstPercentage = billData.cgst && billData.subtotal > 0 
    ? (billData.cgst / billData.subtotal) * 100 
    : 2.5;
  const sgstPercentage = billData.sgst && billData.subtotal > 0 
    ? (billData.sgst / billData.subtotal) * 100 
    : 2.5;

  return {
    invoiceNumber: billData.invoiceNumber || '',
    restaurantName: vendorProfile.business_name,
    address: vendorProfile.address,
    gstin: vendorProfile.gst_no,
    fssaiLicense: vendorProfile.fssai_license || '',
    phone: vendorProfile.phone,
    logoUri: vendorProfile.logo_url,
    
    billNumber: billData.billNumber || '',
    billDate: new Date(billData.timestamp).toLocaleDateString('en-IN'),
    billTime: new Date(billData.timestamp).toLocaleTimeString('en-IN', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    }),
    
    items: billData.cart.map((item: CartItem) => ({
      name: item.name,
      quantity: item.quantity,
      rate: item.price,
      amount: item.price * item.quantity,
      gstPercentage: item.gst_percentage,
    })),
    
    subtotal: billData.subtotal,
    cgstAmount: billData.cgst || 0,
    sgstAmount: billData.sgst || 0,
    cgstPercentage: Number(cgstPercentage.toFixed(1)),
    sgstPercentage: Number(sgstPercentage.toFixed(1)),
    totalAmount: billData.total,
    
    paymentMode: billData.paymentMethod || 'Cash',
    paymentReference: billData.paymentReference,
    amountPaid: billData.amountPaid,
    changeAmount: billData.changeAmount,
    
    footerNote: vendorProfile.footer_note || 'Thank You! Visit Again',
  };
};

/**
 * Formats bill data for Non-GST bill template
 */
export const formatNonGSTBill = (
  billData: BillData,
  vendorProfile: {
    business_name: string;
    address: string;
    gst_no?: string;
    fssai_license?: string;
    phone: string;
    footer_note?: string;
    logo_url?: string;
  }
): NonGSTBillData => {
  return {
    invoiceNumber: billData.invoiceNumber || '',
    restaurantName: vendorProfile.business_name,
    address: vendorProfile.address,
    gstin: vendorProfile.gst_no,
    fssaiLicense: vendorProfile.fssai_license,
    phone: vendorProfile.phone,
    logoUri: vendorProfile.logo_url,
    
    billNumber: billData.billNumber || '',
    billDate: new Date(billData.timestamp).toLocaleDateString('en-IN'),
    billTime: new Date(billData.timestamp).toLocaleTimeString('en-IN', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    }),
    
    items: billData.cart.map((item: CartItem) => ({
      name: item.name,
      quantity: item.quantity,
      amount: item.price * item.quantity,
    })),
    
    subtotal: billData.subtotal,
    totalAmount: billData.total,
    
    paymentMode: billData.paymentMethod || 'Cash',
    paymentReference: billData.paymentReference,
    amountPaid: billData.amountPaid,
    changeAmount: billData.changeAmount,
    
    footerNote: vendorProfile.footer_note || 'THANK YOU - VISIT AGAIN',
  };
};

/**
 * Formats bill data based on billing mode
 */
export const formatBill = (
  billData: BillData,
  vendorProfile: {
    business_name: string;
    address: string;
    gst_no: string;
    fssai_license?: string;
    phone: string;
    footer_note?: string;
    logo_url?: string;
  }
): GSTBillData | NonGSTBillData => {
  if (billData.billing_mode === 'gst') {
    return formatGSTBill(billData, vendorProfile);
  } else {
    return formatNonGSTBill(billData, vendorProfile);
  }
};
