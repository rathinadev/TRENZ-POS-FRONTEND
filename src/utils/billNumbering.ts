// src/utils/billNumbering.ts
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getDatabase } from '../database/schema';
import type { BillingMode } from '../types/business.types';

interface BillNumberingSettings {
  prefix: string;
  startingNumber: string;
  includeDate: boolean;
  currentNumber?: number;
}

/**
 * Generate invoice number based on billing mode
 * Format: GST-2024-0001 or NGST-2024-0001
 */
export const generateInvoiceNumber = async (
  billingMode: BillingMode
): Promise<string> => {
  try {
    const db = getDatabase();
    const year = new Date().getFullYear();
    const prefix = billingMode === 'gst' ? 'GST' : 'NGST';
    
    // Get or create sequence for this billing mode and year
    const existing = db.execute(
      'SELECT sequence FROM invoice_sequences WHERE billing_mode = ? AND year = ?',
      [billingMode, year]
    );
    
    let sequence: number;
    const now = new Date().toISOString();
    
    if (existing.rows?._array?.length > 0) {
      // Increment existing sequence
      sequence = existing.rows._array[0].sequence + 1;
      db.execute(
        'UPDATE invoice_sequences SET sequence = ?, updated_at = ? WHERE billing_mode = ? AND year = ?',
        [sequence, now, billingMode, year]
      );
    } else {
      // Create new sequence
      sequence = 1;
      db.execute(
        `INSERT INTO invoice_sequences (billing_mode, year, sequence, prefix, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [billingMode, year, sequence, prefix, now, now]
      );
    }
    
    // Format: GST-2024-0001 or NGST-2024-0001
    return `${prefix}-${year}-${sequence.toString().padStart(4, '0')}`;
  } catch (error) {
    console.error('Failed to generate invoice number:', error);
    // Fallback
    const year = new Date().getFullYear();
    const prefix = billingMode === 'gst' ? 'GST' : 'NGST';
    return `${prefix}-${year}-${Date.now().toString().slice(-4)}`;
  }
};

/**
 * Get the next bill number based on current settings
 * Automatically increments the counter
 * This is for backward compatibility - bill_number is separate from invoice_number
 */
export const getNextBillNumber = async (): Promise<string> => {
  try {
    const settingsJson = await AsyncStorage.getItem('bill_numbering');
    
    let settings: BillNumberingSettings;
    
    if (settingsJson) {
      settings = JSON.parse(settingsJson);
    } else {
      // Default settings if none exist
      settings = {
        prefix: 'BILL-',
        startingNumber: '1001',
        includeDate: true,
        currentNumber: 1001,
      };
    }

    // Get current number (use startingNumber if currentNumber doesn't exist)
    const currentNumber = settings.currentNumber || parseInt(settings.startingNumber, 10);
    
    // Generate bill number
    const billNumber = generateBillNumber(
      settings.prefix,
      currentNumber,
      settings.includeDate
    );
    
    // Increment counter for next time
    settings.currentNumber = currentNumber + 1;
    await AsyncStorage.setItem('bill_numbering', JSON.stringify(settings));
    
    return billNumber;
  } catch (error) {
    console.error('Failed to get next bill number:', error);
    // Return fallback bill number
    return `BILL-${Date.now()}`;
  }
};

/**
 * Generate a bill number without incrementing the counter (for preview)
 */
export const previewBillNumber = async (): Promise<string> => {
  try {
    const settingsJson = await AsyncStorage.getItem('bill_numbering');
    
    let settings: BillNumberingSettings;
    
    if (settingsJson) {
      settings = JSON.parse(settingsJson);
    } else {
      settings = {
        prefix: 'BILL-',
        startingNumber: '1001',
        includeDate: true,
        currentNumber: 1001,
      };
    }

    const currentNumber = settings.currentNumber || parseInt(settings.startingNumber, 10);
    
    return generateBillNumber(
      settings.prefix,
      currentNumber,
      settings.includeDate
    );
  } catch (error) {
    console.error('Failed to preview bill number:', error);
    return 'BILL-1001';
  }
};

/**
 * Helper function to generate bill number string
 */
const generateBillNumber = (
  prefix: string,
  number: number,
  includeDate: boolean
): string => {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  const dateString = `${year}${month}${day}`;

  if (includeDate) {
    return `${prefix}${dateString}-${number}`;
  } else {
    return `${prefix}${number}`;
  }
};

/**
 * Reset the bill numbering counter (use with caution!)
 */
export const resetBillNumbering = async (): Promise<void> => {
  try {
    const settingsJson = await AsyncStorage.getItem('bill_numbering');
    
    if (settingsJson) {
      const settings: BillNumberingSettings = JSON.parse(settingsJson);
      settings.currentNumber = parseInt(settings.startingNumber, 10);
      await AsyncStorage.setItem('bill_numbering', JSON.stringify(settings));
    }
  } catch (error) {
    console.error('Failed to reset bill numbering:', error);
    throw error;
  }
};

/**
 * Get current bill numbering settings
 */
export const getBillNumberingSettings = async (): Promise<BillNumberingSettings> => {
  try {
    const settingsJson = await AsyncStorage.getItem('bill_numbering');
    
    if (settingsJson) {
      return JSON.parse(settingsJson);
    }
    
    // Return defaults
    return {
      prefix: 'BILL-',
      startingNumber: '1001',
      includeDate: true,
      currentNumber: 1001,
    };
  } catch (error) {
    console.error('Failed to get bill numbering settings:', error);
    return {
      prefix: 'BILL-',
      startingNumber: '1001',
      includeDate: true,
      currentNumber: 1001,
    };
  }
};

/**
 * Get current invoice sequence for a billing mode
 */
export const getInvoiceSequence = async (
  billingMode: BillingMode
): Promise<number> => {
  try {
    const db = getDatabase();
    const year = new Date().getFullYear();
    
    const result = db.execute(
      'SELECT sequence FROM invoice_sequences WHERE billing_mode = ? AND year = ?',
      [billingMode, year]
    );
    
    if (result.rows?._array?.length > 0) {
      return result.rows._array[0].sequence;
    }
    
    return 0;
  } catch (error) {
    console.error('Failed to get invoice sequence:', error);
    return 0;
  }
};

export default {
  generateInvoiceNumber,
  getNextBillNumber,
  previewBillNumber,
  resetBillNumbering,
  getBillNumberingSettings,
  getInvoiceSequence,
};
