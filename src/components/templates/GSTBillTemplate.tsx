// src/components/templates/GSTBillTemplate.tsx
import React from 'react';
import { View, Text, StyleSheet, Image } from 'react-native';

export interface GSTBillData {
  // Business Details
  invoiceNumber: string;
  restaurantName: string;
  address: string;
  gstin: string;
  fssaiLicense: string;
  phone?: string;
  logoUri?: string;
  
  // Bill Details
  billNumber: string;
  billDate: string;
  billTime?: string;
  tableNumber?: string;
  
  // Items
  items: Array<{
    name: string;
    quantity: number;
    rate: number;
    amount: number;
    gstPercentage?: number;
  }>;
  
  // Amounts
  subtotal: number;
  cgstAmount: number;
  sgstAmount: number;
  cgstPercentage: number;
  sgstPercentage: number;
  totalAmount: number;
  
  // Payment
  paymentMode: string;
  paymentReference?: string;
  amountPaid?: number;
  changeAmount?: number;
  
  // Optional
  footerNote?: string;
  customerName?: string;
  customerPhone?: string;
}

interface GSTBillTemplateProps {
  data: GSTBillData;
  paperWidth?: 58 | 80; // mm
}

const GSTBillTemplate: React.FC<GSTBillTemplateProps> = ({ 
  data, 
  paperWidth = 58 
}) => {
  const styles = paperWidth === 58 ? styles58mm : styles80mm;

  return (
    <View style={[baseStyles.container, styles.container]}>
      {/* Separator */}
      <Text style={[baseStyles.separator, styles.text]}>
        ----------------------------------------
      </Text>

      {/* Business Header */}
      <Text style={[baseStyles.businessName, styles.text]}>
        {data.restaurantName.toUpperCase()}
      </Text>
      <Text style={[baseStyles.address, styles.text]}>
        {data.address}
      </Text>
      <Text style={[baseStyles.businessDetail, styles.text]}>
        GSTIN: {data.gstin}
      </Text>
      <Text style={[baseStyles.businessDetail, styles.text]}>
        FSSAI No: {data.fssaiLicense}
      </Text>
      {data.phone && (
        <Text style={[baseStyles.businessDetail, styles.text]}>
          Ph: {data.phone}
        </Text>
      )}

      {/* Separator */}
      <Text style={[baseStyles.separator, styles.text]}>
        ----------------------------------------
      </Text>

      {/* Bill Details */}
      <Text style={[baseStyles.billDetail, styles.text]}>
        Bill No: {data.billNumber}
      </Text>
      <Text style={[baseStyles.billDetail, styles.text]}>
        Date: {data.billDate}
        {data.billTime && ` | Time: ${data.billTime}`}
      </Text>
      <Text style={[baseStyles.billDetail, styles.text]}>
        Invoice No: {data.invoiceNumber}
      </Text>
      {data.tableNumber && (
        <Text style={[baseStyles.billDetail, styles.text]}>
          Table: {data.tableNumber}
        </Text>
      )}

      {/* Separator */}
      <Text style={[baseStyles.separator, styles.text]}>
        ----------------------------------------
      </Text>

      {/* Items Header */}
      <View style={baseStyles.itemsHeader}>
        <Text style={[baseStyles.itemsHeaderText, styles.text, { flex: 3 }]}>
          Item
        </Text>
        <Text style={[baseStyles.itemsHeaderText, styles.text, { flex: 1, textAlign: 'center' }]}>
          Qty
        </Text>
        <Text style={[baseStyles.itemsHeaderText, styles.text, { flex: 1.5, textAlign: 'right' }]}>
          Rate
        </Text>
        <Text style={[baseStyles.itemsHeaderText, styles.text, { flex: 1.5, textAlign: 'right' }]}>
          Amount
        </Text>
      </View>

      {/* Separator */}
      <Text style={[baseStyles.separator, styles.text]}>
        ----------------------------------------
      </Text>

      {/* Items List */}
      {data.items.map((item, index) => (
        <View key={index} style={baseStyles.itemRow}>
          <Text style={[baseStyles.itemName, styles.text, { flex: 3 }]}>
            {item.name}
          </Text>
          <Text style={[baseStyles.itemQuantity, styles.text, { flex: 1, textAlign: 'center' }]}>
            {item.quantity}
          </Text>
          <Text style={[baseStyles.itemRate, styles.text, { flex: 1.5, textAlign: 'right' }]}>
            {item.rate.toFixed(2)}
          </Text>
          <Text style={[baseStyles.itemAmount, styles.text, { flex: 1.5, textAlign: 'right' }]}>
            {item.amount.toFixed(2)}
          </Text>
        </View>
      ))}

      {/* Separator */}
      <Text style={[baseStyles.separator, styles.text]}>
        ----------------------------------------
      </Text>

      {/* Totals */}
      <View style={baseStyles.totalRow}>
        <Text style={[baseStyles.totalLabel, styles.text]}>Sub Total</Text>
        <Text style={[baseStyles.totalValue, styles.text]}>
          {data.subtotal.toFixed(2)}
        </Text>
      </View>

      <View style={baseStyles.totalRow}>
        <Text style={[baseStyles.totalLabel, styles.text]}>
          CGST @{data.cgstPercentage}%
        </Text>
        <Text style={[baseStyles.totalValue, styles.text]}>
          {data.cgstAmount.toFixed(2)}
        </Text>
      </View>

      <View style={baseStyles.totalRow}>
        <Text style={[baseStyles.totalLabel, styles.text]}>
          SGST @{data.sgstPercentage}%
        </Text>
        <Text style={[baseStyles.totalValue, styles.text]}>
          {data.sgstAmount.toFixed(2)}
        </Text>
      </View>

      {/* Separator */}
      <Text style={[baseStyles.separator, styles.text]}>
        ----------------------------------------
      </Text>

      {/* Grand Total */}
      <View style={baseStyles.grandTotalRow}>
        <Text style={[baseStyles.grandTotalLabel, styles.text]}>
          TOTAL AMOUNT
        </Text>
        <Text style={[baseStyles.grandTotalValue, styles.text]}>
          ₹{data.totalAmount.toFixed(2)}
        </Text>
      </View>

      {/* Separator */}
      <Text style={[baseStyles.separator, styles.text]}>
        ----------------------------------------
      </Text>

      {/* Payment Details */}
      <Text style={[baseStyles.paymentDetail, styles.text]}>
        Payment Mode: {data.paymentMode.toUpperCase()}
      </Text>
      {data.paymentReference && (
        <Text style={[baseStyles.paymentDetail, styles.text]}>
          Ref: {data.paymentReference}
        </Text>
      )}
      {data.amountPaid !== undefined && (
        <>
          <Text style={[baseStyles.paymentDetail, styles.text]}>
            Amount Paid: ₹{data.amountPaid.toFixed(2)}
          </Text>
          {data.changeAmount !== undefined && data.changeAmount > 0 && (
            <Text style={[baseStyles.paymentDetail, styles.text]}>
              Change: ₹{data.changeAmount.toFixed(2)}
            </Text>
          )}
        </>
      )}

      {/* Customer Details */}
      {(data.customerName || data.customerPhone) && (
        <>
          <Text style={[baseStyles.separator, styles.text]}>
            ----------------------------------------
          </Text>
          {data.customerName && (
            <Text style={[baseStyles.customerDetail, styles.text]}>
              Customer: {data.customerName}
            </Text>
          )}
          {data.customerPhone && (
            <Text style={[baseStyles.customerDetail, styles.text]}>
              Phone: {data.customerPhone}
            </Text>
          )}
        </>
      )}

      {/* GST Info */}
      <Text style={[baseStyles.separator, styles.text]}>
        ----------------------------------------
      </Text>
      <Text style={[baseStyles.gstInfo, styles.text]}>
        GST @{data.cgstPercentage + data.sgstPercentage}% | ITC Applicable
      </Text>

      {/* Footer Note */}
      {data.footerNote && (
        <>
          <Text style={[baseStyles.separator, styles.text]}>
            ----------------------------------------
          </Text>
          <Text style={[baseStyles.footerNote, styles.text]}>
            {data.footerNote}
          </Text>
        </>
      )}

      {/* Bottom Separator */}
      <Text style={[baseStyles.separator, styles.text]}>
        ----------------------------------------
      </Text>
    </View>
  );
};

// Base styles (common for all paper widths)
const baseStyles = StyleSheet.create({
  container: {
    backgroundColor: '#FFFFFF',
    padding: 8,
  },
  logoContainer: {
    alignItems: 'center',
    marginVertical: 8,
  },
  logo: {
    width: 80,
    height: 80,
  },
  separator: {
    fontSize: 10,
    color: '#333333',
    fontFamily: 'monospace',
    marginVertical: 2,
  },
  businessName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#000000',
    textAlign: 'center',
    marginVertical: 2,
  },
  address: {
    fontSize: 11,
    color: '#333333',
    textAlign: 'center',
    marginVertical: 1,
  },
  businessDetail: {
    fontSize: 11,
    color: '#333333',
    textAlign: 'center',
    marginVertical: 1,
  },
  billDetail: {
    fontSize: 11,
    color: '#333333',
    marginVertical: 1,
  },
  itemsHeader: {
    flexDirection: 'row',
    marginVertical: 2,
  },
  itemsHeaderText: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#000000',
  },
  itemRow: {
    flexDirection: 'row',
    marginVertical: 1,
  },
  itemName: {
    fontSize: 11,
    color: '#333333',
  },
  itemQuantity: {
    fontSize: 11,
    color: '#333333',
  },
  itemRate: {
    fontSize: 11,
    color: '#333333',
  },
  itemAmount: {
    fontSize: 11,
    color: '#333333',
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginVertical: 1,
  },
  totalLabel: {
    fontSize: 11,
    color: '#333333',
  },
  totalValue: {
    fontSize: 11,
    color: '#333333',
    textAlign: 'right',
  },
  grandTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginVertical: 2,
  },
  grandTotalLabel: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#000000',
  },
  grandTotalValue: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#000000',
    textAlign: 'right',
  },
  paymentDetail: {
    fontSize: 11,
    color: '#333333',
    marginVertical: 1,
  },
  customerDetail: {
    fontSize: 11,
    color: '#333333',
    marginVertical: 1,
  },
  gstInfo: {
    fontSize: 10,
    color: '#666666',
    textAlign: 'center',
    marginVertical: 1,
  },
  footerNote: {
    fontSize: 11,
    color: '#333333',
    textAlign: 'center',
    marginVertical: 2,
  },
});

// 58mm paper width styles
const styles58mm = StyleSheet.create({
  container: {
    width: 220, // ~58mm in points
  },
  text: {
    fontSize: 10,
  },
});

// 80mm paper width styles
const styles80mm = StyleSheet.create({
  container: {
    width: 302, // ~80mm in points
  },
  text: {
    fontSize: 11,
  },
});

export default GSTBillTemplate;
