# Bill Templates

Production-ready bill templates for GST and Non-GST bills, designed for thermal printer compatibility.

## Features

- ✅ Dynamic data rendering (no hardcoded values)
- ✅ GST-compliant format as per Indian tax regulations
- ✅ Thermal printer compatible (58mm and 80mm paper widths)
- ✅ Production-ready components
- ✅ TypeScript type safety

## Templates

### 1. GSTBillTemplate

**Required Fields (as per GST rules):**
- Invoice Number
- Restaurant Name
- Address
- GSTIN
- FSSAI License No
- Bill Number & Date
- Item-wise amount (Item, Qty, Rate, Amount)
- GST breakup (CGST + SGST with percentages)
- Total Amount
- Payment Mode

**Usage:**
```typescript
import { GSTBillTemplate, GSTBillData } from '@/components/templates';

const billData: GSTBillData = {
  invoiceNumber: 'INV-2026-0001',
  restaurantName: 'ABC Grand Restaurant',
  address: 'Chennai, Tamil Nadu - 600001',
  gstin: '33ABCDE1234F1Z5',
  fssaiLicense: '12345678901234',
  phone: '9876543210',
  billNumber: '1025',
  billDate: '16-01-2026',
  billTime: '09:45 PM',
  items: [
    { name: 'Veg Meals', quantity: 2, rate: 150.00, amount: 300.00 },
    { name: 'Coffee', quantity: 2, rate: 30.00, amount: 60.00 },
  ],
  subtotal: 440.00,
  cgstAmount: 11.00,
  sgstAmount: 11.00,
  cgstPercentage: 2.5,
  sgstPercentage: 2.5,
  totalAmount: 462.00,
  paymentMode: 'UPI',
  footerNote: 'Thank You! Visit Again',
};

<GSTBillTemplate data={billData} paperWidth={58} />
```

### 2. NonGSTBillTemplate

**Required Fields:**
- Invoice Number
- Restaurant Name
- Address
- Phone Number
- Bill Number & Date
- Item-wise amount (Item, Qty, Amount)
- Total Amount
- GST NOT APPLICABLE notice

**Usage:**
```typescript
import { NonGSTBillTemplate, NonGSTBillData } from '@/components/templates';

const billData: NonGSTBillData = {
  invoiceNumber: 'INV-2026-0123',
  restaurantName: 'Hotel ABC',
  address: 'Address Line',
  phone: 'XXXXXXXXXX',
  billNumber: '0123',
  billDate: '21-01-2026',
  billTime: '12:05 PM',
  items: [
    { name: 'Veg Meals', quantity: 1, amount: 120.00 },
    { name: 'Coffee', quantity: 1, amount: 30.00 },
  ],
  subtotal: 150.00,
  totalAmount: 150.00,
  paymentMode: 'Cash',
  footerNote: 'THANK YOU - VISIT AGAIN',
};

<NonGSTBillTemplate data={billData} paperWidth={58} />
```

## Bill Formatter Utility

Use the `billFormatter` utility to convert your app's bill data to template format:

```typescript
import { formatBill } from '@/utils/billFormatter';
import { getVendorProfile } from '@/services/auth';

// Get vendor profile
const vendorProfile = await getVendorProfile();

// Format bill based on billing mode
const formattedBill = formatBill(billData, vendorProfile);

// Render appropriate template
{billData.billing_mode === 'gst' ? (
  <GSTBillTemplate data={formattedBill as GSTBillData} />
) : (
  <NonGSTBillTemplate data={formattedBill as NonGSTBillData} />
)}
```

## Paper Width Support

Both templates support two standard thermal printer paper widths:

- **58mm** (220 points) - Default, compact format
- **80mm** (302 points) - Wider format with more spacing

```typescript
<GSTBillTemplate data={billData} paperWidth={58} /> // 58mm
<GSTBillTemplate data={billData} paperWidth={80} /> // 80mm
```

## Integration with BillSuccessScreen

Update your BillSuccessScreen to use these templates:

```typescript
import { GSTBillTemplate, NonGSTBillTemplate } from '../components/templates';
import { formatBill } from '../utils/billFormatter';

// In your component:
const formattedBill = formatBill(billData, vendorProfile);

return (
  <View>
    {billData.billing_mode === 'gst' ? (
      <GSTBillTemplate 
        data={formattedBill as GSTBillData} 
        paperWidth={58} 
      />
    ) : (
      <NonGSTBillTemplate 
        data={formattedBill as NonGSTBillData} 
        paperWidth={58} 
      />
    )}
  </View>
);
```

## Printing

These templates are designed for:
1. On-screen preview
2. Screenshot/image capture for sharing
3. Direct printing to thermal printers via Bluetooth/USB
4. PDF generation

For printing, use a library like `react-native-thermal-printer` or `react-native-print`.

## Customization

The templates maintain the required field order as per GST regulations. Only the footer note and optional customer details can be customized.

**Do not modify the order of required fields** to maintain GST compliance.

## Notes

- All amounts are formatted to 2 decimal places
- Dates are formatted as per Indian standard (DD-MM-YYYY)
- Time is shown in 12-hour format with AM/PM
- Monospace font is used for separators to ensure alignment
- Templates are responsive to paper width
