// src/components/templates/NonGSTBillTemplate.tsx
import React from 'react';
import { View, Text, StyleSheet, Image } from 'react-native';

export interface NonGSTBillData {
  // Business Details
  invoiceNumber: string;
  restaurantName: string;
  address: string;
  gstin?: string;
  fssaiLicense?: string;
  phone: string;
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
    rate?: number;
    amount: number;
  }>;
  
  // Amounts
  subtotal: number;
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

interface NonGSTBillTemplateProps {
  data: NonGSTBillData;
  paperWidth?: 58 | 80; // mm
}

const NonGSTBillTemplate: React.FC<NonGSTBillTemplateProps> = ({ 
  data, 
  paperWidth = 58 
}) => {
  const styles = paperWidth === 58 ? styles58mm : styles80mm;

  return (
    <View style={[baseStyles.container, styles.container]}>
      {/* Logo */}
      {data.logoUri && (
        <View style={baseStyles.logoContainer}>
          <Image 
            source={{ uri: data.logoUri }} 
            style={baseStyles.logo}
            resizeMode="contain"
          />
        </View>
      )}

      {/* Business Header */}
      <Text style={[baseStyles.businessName, styles.text]}>
        {data.restaurantName.toUpperCase()}
      </Text>

      {/* Separator */}
      <Text style={[baseStyles.separator, styles.text]}>
        ------------------------------------
      </Text>

      {/* Address & Contact */}
      <Text style={[baseStyles.address, styles.text]}>
        {data.address}
      </Text>
      <Text style={[baseStyles.businessDetail, styles.text]}>
        Ph: {data.phone}
      </Text>

      {/* Separator */}
      <Text style={[baseStyles.separator, styles.text]}>
        ------------------------------------
      </Text>

      {/* Bill Details */}
      <Text style={[baseStyles.billDetail, styles.text]}>
        Bill No: {data.billNumber}
      </Text>
      <Text style={[baseStyles.billDetail, styles.text]}>
        Date: {data.billDate}
      </Text>
      {data.billTime && (
        <Text style={[baseStyles.billDetail, styles.text]}>
          Time: {data.billTime}
        </Text>
      )}
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
        ------------------------------------
      </Text>

      {/* Items Header */}
      <View style={baseStyles.itemsHeader}>
        <Text style={[baseStyles.itemsHeaderText, styles.text, { flex: 3 }]}>
          ITEM
        </Text>
        <Text style={[baseStyles.itemsHeaderText, styles.text, { flex: 1, textAlign: 'center' }]}>
          QTY
        </Text>
        <Text style={[baseStyles.itemsHeaderText, styles.text, { flex: 1.5, textAlign: 'right' }]}>
          AMT
        </Text>
      </View>

      {/* Separator */}
      <Text style={[baseStyles.separator, styles.text]}>
        ------------------------------------
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
          <Text style={[baseStyles.itemAmount, styles.text, { flex: 1.5, textAlign: 'right' }]}>
            {item.amount.toFixed(2)}
          </Text>
        </View>
      ))}

      {/* Separator */}
      <Text style={[baseStyles.separator, styles.text]}>
        ------------------------------------
      </Text>

      {/* Subtotal */}
      <View style={baseStyles.totalRow}>
        <Text style={[baseStyles.totalLabel, styles.text]}>Subtotal</Text>
        <Text style={[baseStyles.totalValue, styles.text]}>
          {data.subtotal.toFixed(2)}
        </Text>
      </View>

      {/* GST (0.00 for Non-GST) */}
      <View style={baseStyles.totalRow}>
        <Text style={[baseStyles.totalLabel, styles.text]}>GST</Text>
        <Text style={[baseStyles.totalValue, styles.text]}>0.00</Text>
      </View>

      {/* Separator */}
      <Text style={[baseStyles.separator, styles.text]}>
        ------------------------------------
      </Text>

      {/* Grand Total */}
      <View style={baseStyles.grandTotalRow}>
        <Text style={[baseStyles.grandTotalLabel, styles.text]}>TOTAL</Text>
        <Text style={[baseStyles.grandTotalValue, styles.text]}>
          {data.totalAmount.toFixed(2)}
        </Text>
      </View>

      {/* Separator */}
      <Text style={[baseStyles.separator, styles.text]}>
        ------------------------------------
      </Text>

      {/* Payment Details */}
      <Text style={[baseStyles.paymentDetail, styles.text]}>
        Payment: {data.paymentMode.toUpperCase()}
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
            ------------------------------------
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

      {/* Separator */}
      <Text style={[baseStyles.separator, styles.text]}>
        ------------------------------------
      </Text>

      {/* Non-GST Notice */}
      <Text style={[baseStyles.gstNotice, styles.text]}>
        GST NOT APPLICABLE
      </Text>
      <Text style={[baseStyles.gstNotice, styles.text]}>
        (Non-GST Registered Hotel)
      </Text>

      {/* Footer Note */}
      {data.footerNote && (
        <>
          <Text style={[baseStyles.separator, styles.text]}>
            ------------------------------------
          </Text>
          <Text style={[baseStyles.footerNote, styles.text]}>
            {data.footerNote}
          </Text>
        </>
      )}

      {/* Bottom Separator */}
      <Text style={[baseStyles.separator, styles.text]}>
        ------------------------------------
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
    marginVertical: 4,
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
  gstNotice: {
    fontSize: 11,
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

export default NonGSTBillTemplate;
