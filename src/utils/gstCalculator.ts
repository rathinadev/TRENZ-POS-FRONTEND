// src/utils/gstCalculator.ts
import type { CartItem, BillingMode } from '../types/business.types';
import type { PriceType } from '../types/api.types';

export interface GSTCalculationResult {
  subtotal: number;
  totalDiscount: number;
  totalGST: number;
  cgst: number;
  sgst: number;
  igst: number;
  totalTax: number;
  total: number;
}

export interface ItemGSTBreakdown {
  itemId: string;
  name: string;
  quantity: number;
  mrpPrice: number;
  priceType: PriceType;
  gstPercentage: number;
  itemSubtotal: number;
  itemDiscount: number;
  itemGST: number;
  itemTotal: number;
}

/**
 * Calculate GST for a single item
 */
export const calculateItemGST = (
  item: CartItem,
  applyDiscount: boolean = true
): ItemGSTBreakdown => {
  const mrpPrice = item.mrp_price || item.price;
  const priceType = item.price_type || 'exclusive';
  const gstPercentage = item.gst_percentage || 0;
  const additionalDiscount = item.additional_discount || 0;
  
  // Calculate item subtotal (MRP * quantity)
  let itemSubtotal = mrpPrice * item.quantity;
  
  // Apply item-level discount
  let itemDiscount = 0;
  if (applyDiscount && additionalDiscount > 0) {
    itemDiscount = additionalDiscount * item.quantity;
    itemSubtotal -= itemDiscount;
  }
  
  // Calculate GST based on price type
  let itemGST = 0;
  if (gstPercentage > 0) {
    if (priceType === 'exclusive') {
      // GST is added on top of MRP
      itemGST = itemSubtotal * (gstPercentage / 100);
    } else {
      // GST is included in MRP - extract it
      const baseAmount = itemSubtotal / (1 + gstPercentage / 100);
      itemGST = itemSubtotal - baseAmount;
    }
  }
  
  const itemTotal = itemSubtotal + itemGST;
  
  return {
    itemId: item.id,
    name: item.name,
    quantity: item.quantity,
    mrpPrice,
    priceType,
    gstPercentage,
    itemSubtotal: mrpPrice * item.quantity,
    itemDiscount,
    itemGST,
    itemTotal,
  };
};

/**
 * Calculate GST for all items in cart
 */
export const calculateGST = (
  items: CartItem[],
  billingMode: BillingMode,
  billLevelDiscount: number = 0,
  isInterState: boolean = false
): GSTCalculationResult => {
  if (billingMode === 'non_gst') {
    // No GST calculation for non-GST bills
    const subtotal = items.reduce((sum, item) => {
      const mrpPrice = item.mrp_price || item.price;
      return sum + mrpPrice * item.quantity;
    }, 0);
    
    const totalDiscount = items.reduce((sum, item) => {
      const discount = item.additional_discount || 0;
      return sum + discount * item.quantity;
    }, 0) + billLevelDiscount;
    
    return {
      subtotal: subtotal - totalDiscount,
      totalDiscount,
      totalGST: 0,
      cgst: 0,
      sgst: 0,
      igst: 0,
      totalTax: 0,
      total: subtotal - totalDiscount,
    };
  }
  
  // GST calculation
  let totalSubtotal = 0;
  let totalItemDiscount = 0;
  let totalItemGST = 0;
  
  // Calculate GST for each item
  items.forEach(item => {
    const breakdown = calculateItemGST(item, true);
    totalSubtotal += breakdown.itemSubtotal;
    totalItemDiscount += breakdown.itemDiscount;
    totalItemGST += breakdown.itemGST;
  });
  
  // Apply bill-level discount
  const finalSubtotal = totalSubtotal - totalItemDiscount - billLevelDiscount;
  
  // Recalculate GST on discounted amount
  // Note: This is a simplified approach. For accurate GST calculation,
  // you might need to recalculate per-item GST after applying bill discount proportionally
  let adjustedGST = 0;
  
  if (totalItemGST > 0 && totalSubtotal > 0) {
    // Calculate GST ratio
    const gstRatio = totalItemGST / totalSubtotal;
    // Apply ratio to discounted subtotal
    adjustedGST = finalSubtotal * gstRatio;
  }
  
  // Split GST into CGST/SGST or IGST
  let cgst = 0;
  let sgst = 0;
  let igst = 0;
  
  if (isInterState) {
    // Inter-state: IGST only
    igst = adjustedGST;
  } else {
    // Intra-state: CGST + SGST (50-50 split)
    cgst = adjustedGST / 2;
    sgst = adjustedGST / 2;
  }
  
  const totalTax = adjustedGST;
  const total = finalSubtotal + totalTax;
  
  return {
    subtotal: finalSubtotal,
    totalDiscount: totalItemDiscount + billLevelDiscount,
    totalGST: adjustedGST,
    cgst,
    sgst,
    igst,
    totalTax,
    total,
  };
};

/**
 * Calculate item-level GST breakdowns for bill items
 */
export const calculateItemGSTBreakdowns = (
  items: CartItem[],
  billingMode: BillingMode,
  billLevelDiscount: number = 0
): ItemGSTBreakdown[] => {
  if (billingMode === 'non_gst') {
    // Return breakdowns without GST
    return items.map(item => {
      const mrpPrice = item.mrp_price || item.price;
      const itemSubtotal = mrpPrice * item.quantity;
      const itemDiscount = (item.additional_discount || 0) * item.quantity;
      
      return {
        itemId: item.id,
        name: item.name,
        quantity: item.quantity,
        mrpPrice,
        priceType: item.price_type || 'exclusive',
        gstPercentage: 0,
        itemSubtotal,
        itemDiscount,
        itemGST: 0,
        itemTotal: itemSubtotal - itemDiscount,
      };
    });
  }
  
  // Calculate proportional bill discount per item
  const totalSubtotal = items.reduce((sum, item) => {
    const mrpPrice = item.mrp_price || item.price;
    return sum + mrpPrice * item.quantity;
  }, 0);
  
  return items.map(item => {
    const breakdown = calculateItemGST(item, true);
    
    // Apply proportional bill-level discount
    let itemBillDiscount = 0;
    if (billLevelDiscount > 0 && totalSubtotal > 0) {
      const itemSubtotal = breakdown.itemSubtotal;
      const proportion = itemSubtotal / totalSubtotal;
      itemBillDiscount = billLevelDiscount * proportion;
    }
    
    // Recalculate GST on discounted amount
    const discountedSubtotal = breakdown.itemSubtotal - breakdown.itemDiscount - itemBillDiscount;
    let adjustedGST = 0;
    
    if (breakdown.gstPercentage > 0) {
      if (breakdown.priceType === 'exclusive') {
        adjustedGST = discountedSubtotal * (breakdown.gstPercentage / 100);
      } else {
        const baseAmount = discountedSubtotal / (1 + breakdown.gstPercentage / 100);
        adjustedGST = discountedSubtotal - baseAmount;
      }
    }
    
    return {
      ...breakdown,
      itemDiscount: breakdown.itemDiscount + itemBillDiscount,
      itemGST: adjustedGST,
      itemTotal: discountedSubtotal + adjustedGST,
    };
  });
};

/**
 * Round amount based on rounding rule
 */
export const roundAmount = (
  amount: number,
  rule: 'nearest' | 'up' | 'down' | 'none' = 'nearest'
): number => {
  switch (rule) {
    case 'up':
      return Math.ceil(amount);
    case 'down':
      return Math.floor(amount);
    case 'nearest':
      return Math.round(amount);
    case 'none':
    default:
      return amount;
  }
};

export default {
  calculateItemGST,
  calculateGST,
  calculateItemGSTBreakdowns,
  roundAmount,
};
