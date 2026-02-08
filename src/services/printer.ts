// src/services/printer.ts
/**
 * PRINTER CONFIGURATION — How it works (standalone or in any app)
 * ================================================================
 *
 * 1. CONNECTION
 *    - User pairs the thermal printer (e.g. XP-v320m) in Android Bluetooth settings.
 *    - App stores printer MAC in business_settings (printer_mac_address).
 *    - On print, we connect via Bluetooth SPP if not already connected, then send data.
 *    - Optional: network print (printer_connection_type = 'network') sends the same bill
 *      string to a relay URL (e.g. emulator / WiFi printer) via HTTP POST.
 *
 * 2. PAPER WIDTH
 *    - Stored in business_settings (paper_size: '58mm' | '80mm'). Default 80mm.
 *    - 58mm = 32 chars/line, 80mm = 48 chars/line. Layout (centered header, item columns,
 *      label/value rows) is built in JS and sent as plain text + ESC/POS commands.
 *
 * 3. SENDING TO BLUETOOTH
 *    - Native (XprinterModule.kt): printBillStart() clears buffer; printBillChunk(text)
 *      appends; printBillFlush() encodes as US_ASCII and writes to the socket in 64-byte
 *      chunks with 80ms delay so the printer buffer does not overflow.
 *    - JS sends line-by-line: for each line we call Start → Chunk(line + '\n') → Flush,
 *      then 50ms delay. This avoids the printer dropping the middle of the bill (items).
 *    - All text is normalized with toAscii() (₹ → "Rs ", non-ASCII → '?') so the printer
 *      never receives invalid bytes.
 *
 * 4. BILL LAYOUT (built here, no layout pin native)
 *    - Header: store name on its own line (so first chunk isn’t ESC-only), then address,
 *      GSTIN, FSSAI, phone — all centered via space padding (formatCenterLine).
 *    - Bill details: Bill No, Date, Invoice No — label left, value right (formatLabelValueRow).
 *    - Items: one row per product (Item | Qty | Rate | Amount), one blank line between items.
 *    - Totals: Subtotal, CGST, SGST, Total, Payment, Amount Paid — label left, value right.
 *    - Footer: "GST @x% | ITC Applicable" and "Thank You! Visit Again" centered.
 *    - After the bill, cutPaper() is called (ESC/POS cut command) from JS.
 *
 * 5. INDEPENDENT APP USAGE
 *    - Use getBusinessSettings() for paper_size and printer_mac_address (or your own config).
 *    - Call printBill(billData, isGST) with the same bill shape (GSTBillData / NonGSTBillData).
 *    - For network/relay, the same built string is POSTed to your URL; for Bluetooth, it is
 *      sent line-by-line via XprinterModule as above.
 */
import { NativeModules, Platform } from 'react-native';
import type { GSTBillData } from '../components/templates/GSTBillTemplate';
import type { NonGSTBillData } from '../components/templates/NonGSTBillTemplate';
import { getBusinessSettings } from './storage';

const { XprinterModule } = NativeModules;

export interface BluetoothDevice {
  name: string;
  address: string;
}

export interface PrinterService {
  getPairedDevices(): Promise<BluetoothDevice[]>;
  connectBluetooth(macAddress: string): Promise<boolean>;
  isConnected(): Promise<boolean>;
  disconnect(): Promise<void>;
  printBill(billData: GSTBillData | NonGSTBillData, isGST: boolean): Promise<boolean>;
  printTestPage(): Promise<boolean>;
  openCashDrawer(): Promise<boolean>;
  cutPaper(): Promise<boolean>;
}

// ESC/POS Commands
const ESC = '\x1B';
const GS = '\x1D';
const CUT_CMD = '\n\n\x1dV\x01'; // Paper cut

class PrinterServiceImpl implements PrinterService {
  /**
   * Send print data to network relay (for emulator / WiFi printer)
   */
  private async sendToNetworkPrinter(baseUrl: string, printData: string): Promise<void> {
    const url = baseUrl.replace(/\/$/, '') + '/print';
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
      body: printData,
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(text || `Print server returned ${res.status}`);
    }
  }

  /**
   * Use network printing only when user explicitly chose it (no emulator default).
   * Docs: connect via Bluetooth — pair in Settings first, then select and connect in app.
   */
  private async isNetworkPrintMode(): Promise<{ url: string } | null> {
    const settings = await getBusinessSettings();
    if (settings?.printer_connection_type === 'network' && settings?.printer_network_url) {
      return { url: settings.printer_network_url };
    }
    return null;
  }

  /**
   * Build GST bill string (one source of truth for layout). Used for Bluetooth and network.
   */
  private buildGSTBillContent(data: GSTBillData, paperWidth: 58 | 80): string {
    let s = '';
    s += ESC + '@' + this.leftAlign();
    s += this.setFontSize(2, 2) + this.boldOn() + '\n';
    s += this.formatCenterLine((data.restaurantName || 'Store').toUpperCase(), paperWidth);
    s += this.boldOff() + this.setFontSize(1, 1);
    s += this.formatCenterLine(data.address || '', paperWidth);
    s += this.formatCenterLine(`GSTIN: ${data.gstin || ''}`, paperWidth);
    s += this.formatCenterLine(`FSSAI No: ${data.fssaiLicense || 'N/A'}`, paperWidth);
    if (data.phone) s += this.formatCenterLine(`Ph: ${data.phone}`, paperWidth);
    s += '\n' + this.lineSeparator(paperWidth);
    s += this.formatLabelValueRow('Bill No:', data.billNumber, paperWidth);
    s += this.formatLabelValueRow('Date:', data.billDate + (data.billTime ? ` | ${this.timeToAscii(data.billTime)}` : ''), paperWidth);
    s += this.formatLabelValueRow('Invoice No:', data.invoiceNumber, paperWidth);
    if (data.tableNumber) s += this.formatLabelValueRow('Table:', data.tableNumber, paperWidth);
    s += '\n' + this.lineSeparator(paperWidth);
    s += this.boldOn() + this.formatItemHeaderRow(paperWidth) + this.boldOff() + this.lineSeparator(paperWidth);
    data.items.forEach((item, idx) => {
      const name = idx === 0 ? ' ' + item.name : item.name;
      s += this.formatItemRow(name, item.quantity.toString(), item.rate.toFixed(2), item.amount.toFixed(2), paperWidth);
      s += '\n';
    });
    s += this.lineSeparator(paperWidth);
    s += this.formatAmountRow('Subtotal:', data.subtotal, paperWidth);
    s += this.formatAmountRow(`CGST (${data.cgstPercentage}%):`, data.cgstAmount, paperWidth);
    s += this.formatAmountRow(`SGST (${data.sgstPercentage}%):`, data.sgstAmount, paperWidth);
    s += '\n' + this.boldOn() + this.formatAmountRow('Total:', data.totalAmount, paperWidth) + this.boldOff() + '\n';
    s += this.lineSeparator(paperWidth);
    s += this.formatLine(`Payment Mode: ${data.paymentMode}`, paperWidth);
    if (data.amountPaid) s += this.formatAmountRow('Amount Paid:', data.amountPaid, paperWidth);
    if (data.changeAmount && data.changeAmount > 0) s += this.formatAmountRow('Change:', data.changeAmount, paperWidth);
    s += '\n';
    const totalGstPct = (data.cgstPercentage || 0) + (data.sgstPercentage || 0);
    s += this.formatCenterLine(`GST @${totalGstPct}% | ITC Applicable`, paperWidth);
    s += this.formatCenterLine(data.footerNote || 'Thank You! Visit Again', paperWidth);
    s += '\n\n';
    return s;
  }

  /**
   * Build Non-GST bill string (one source of truth). Used for Bluetooth and network.
   */
  private buildNonGSTBillContent(data: NonGSTBillData, paperWidth: 58 | 80): string {
    let s = '';
    s += ESC + '@' + this.leftAlign();
    s += this.setFontSize(2, 2) + this.boldOn() + '\n';
    s += this.formatCenterLine((data.restaurantName || 'Store').toUpperCase(), paperWidth);
    s += this.boldOff() + this.setFontSize(1, 1);
    s += this.formatCenterLine(data.address || '', paperWidth);
    if (data.phone) s += this.formatCenterLine(`Ph: ${data.phone}`, paperWidth);
    s += '\n' + this.lineSeparator(paperWidth);
    s += this.formatLabelValueRow('Bill No:', data.billNumber, paperWidth);
    s += this.formatLabelValueRow('Date:', data.billDate + (data.billTime ? ` | ${this.timeToAscii(data.billTime)}` : ''), paperWidth);
    if (data.tableNumber) s += this.formatLabelValueRow('Table:', data.tableNumber, paperWidth);
    s += '\n' + this.lineSeparator(paperWidth);
    s += this.boldOn() + this.formatItemHeaderRowNonGST(paperWidth) + this.boldOff() + this.lineSeparator(paperWidth);
    data.items.forEach((item, idx) => {
      const name = idx === 0 ? ' ' + item.name : item.name;
      s += this.formatItemRowNonGST(name, item.quantity.toString(), item.amount.toFixed(2), paperWidth);
      s += '\n';
    });
    s += this.lineSeparator(paperWidth);
    s += this.formatAmountRow('Subtotal:', data.subtotal, paperWidth);
    s += '\n' + this.boldOn() + this.formatAmountRow('Total:', data.totalAmount, paperWidth) + this.boldOff() + '\n';
    s += this.lineSeparator(paperWidth);
    s += this.formatLine(`Payment Mode: ${data.paymentMode}`, paperWidth);
    if (data.amountPaid) s += this.formatAmountRow('Amount Paid:', data.amountPaid, paperWidth);
    if (data.changeAmount && data.changeAmount > 0) s += this.formatAmountRow('Change:', data.changeAmount, paperWidth);
    s += '\n';
    s += this.formatCenterLine(data.footerNote || 'Thank You! Visit Again', paperWidth);
    s += '\n\n';
    return s;
  }

  private getGSTBillPrintData(data: GSTBillData, paperWidth: 58 | 80): string {
    return this.buildGSTBillContent(data, paperWidth);
  }

  private getNonGSTBillPrintData(data: NonGSTBillData, paperWidth: 58 | 80): string {
    return this.buildNonGSTBillContent(data, paperWidth);
  }

  /**
   * Build test print string (no native send)
   */
  private getTestPrintData(): string {
    let printData = '';
    printData += ESC + '@';
    printData += this.centerText();
    printData += this.setFontSize(2, 2);
    printData += this.boldOn();
    printData += 'TEST PRINT\n';
    printData += this.boldOff();
    printData += this.setFontSize(1, 1);
    printData += this.leftAlign();
    printData += '\nThis is a test print from\nTRENZ POS Mobile App\n\n';
    printData += `Date: ${new Date().toLocaleString()}\n\n`;
    printData += this.lineSeparator(58);
    printData += '\n';
    printData += this.centerText();
    printData += 'If you can read this,\nyour printer is working!\n\n\n';
    return printData;
  }

  /**
   * Get list of paired Bluetooth devices
   */
  async getPairedDevices(): Promise<BluetoothDevice[]> {
    if (Platform.OS !== 'android') {
      throw new Error('Printer is only supported on Android');
    }
    
    if (!XprinterModule) {
      throw new Error('XprinterModule is not available');
    }
    
    try {
      const devices = await XprinterModule.getPairedDevices();
      return devices.map((d: any) => ({
        name: d.name || 'Unknown Device',
        address: d.address,
      }));
    } catch (error: any) {
      throw new Error(`Failed to get paired devices: ${error.message}`);
    }
  }

  /**
   * Connect to Bluetooth printer
   */
  async connectBluetooth(macAddress: string): Promise<boolean> {
    if (Platform.OS !== 'android') {
      throw new Error('Printer is only supported on Android');
    }
    
    if (!XprinterModule) {
      throw new Error('XprinterModule is not available');
    }
    
    try {
      const result = await XprinterModule.connectBluetooth(macAddress);
      return result === true;
    } catch (error: any) {
      throw new Error(`Failed to connect: ${error.message}`);
    }
  }

  /**
   * Check if printer is connected (Bluetooth) or network print is configured
   */
  async isConnected(): Promise<boolean> {
    const network = await this.isNetworkPrintMode();
    if (network) return true;
    if (Platform.OS !== 'android' || !XprinterModule) return false;
    try {
      return await XprinterModule.isConnected();
    } catch {
      return false;
    }
  }

  /**
   * Disconnect from printer
   */
  async disconnect(): Promise<void> {
    if (Platform.OS !== 'android' || !XprinterModule) {
      return;
    }
    
    try {
      await XprinterModule.disconnect();
    } catch (error) {
      console.error('Failed to disconnect:', error);
    }
  }

  /**
   * Print ESC/POS command to center text
   */
  private centerText(): string {
    return ESC + 'a' + '\x01'; // Center alignment
  }

  /**
   * Print ESC/POS command to left align text
   */
  private leftAlign(): string {
    return ESC + 'a' + '\x00'; // Left alignment
  }

  /**
   * Print ESC/POS command to set font size
   */
  private setFontSize(width: number, height: number): string {
    // ESC ! n where n = (width-1) | ((height-1) << 4)
    const n = (width - 1) | ((height - 1) << 4);
    return ESC + '!' + String.fromCharCode(n);
  }

  /**
   * Print ESC/POS command to bold text
   */
  private boldOn(): string {
    return ESC + 'E' + '\x01';
  }

  /**
   * Print ESC/POS command to bold off
   */
  private boldOff(): string {
    return ESC + 'E' + '\x00';
  }

  /**
   * Print line separator
   */
  private lineSeparator(paperWidth: 58 | 80): string {
    const chars = paperWidth === 58 ? 32 : 48;
    return '-'.repeat(chars) + '\n';
  }

  /**
   * Format line to paper width: left-aligned (as in UI). Pad on right only.
   * 58mm = 32 chars, 80mm = 48 chars.
   */
  private formatLine(text: string, paperWidth: 58 | 80): string {
    const maxChars = paperWidth === 58 ? 32 : 48;
    const line = text.length <= maxChars ? text : text.substring(0, maxChars - 3) + '...';
    return line + ' '.repeat(Math.max(0, maxChars - line.length)) + '\n';
  }

  /**
   * Center text on line with equal left and right padding (like UI) — no ESC/POS center.
   */
  private formatCenterLine(text: string, paperWidth: 58 | 80): string {
    const maxChars = paperWidth === 58 ? 32 : 48;
    const t = text.length <= maxChars ? text : text.substring(0, maxChars - 3) + '...';
    const leftPad = Math.floor((maxChars - t.length) / 2);
    const rightPad = maxChars - t.length - leftPad;
    return ' '.repeat(leftPad) + t + ' '.repeat(rightPad) + '\n';
  }

  /**
   * Format amount row like UI: label left-aligned, amount right-aligned (spaces between).
   */
  private formatAmountRow(label: string, amount: number, paperWidth: 58 | 80): string {
    const maxChars = paperWidth === 58 ? 32 : 48;
    const amountText = `Rs ${amount.toFixed(2)}`;
    const spaces = Math.max(1, maxChars - label.length - amountText.length);
    const line = label + ' '.repeat(spaces) + amountText;
    return line.length <= maxChars ? line + ' '.repeat(maxChars - line.length) + '\n' : line.substring(0, maxChars) + '\n';
  }

  /**
   * Label left, value right (same style as CGST/SGST) for Bill No, Date, Invoice No.
   */
  private formatLabelValueRow(label: string, value: string, paperWidth: 58 | 80): string {
    const maxChars = paperWidth === 58 ? 32 : 48;
    const spaces = Math.max(1, maxChars - label.length - value.length);
    const line = label + ' '.repeat(spaces) + value;
    return line.length <= maxChars ? line + ' '.repeat(maxChars - line.length) + '\n' : line.substring(0, maxChars) + '\n';
  }

  /** Column widths for item table: Item (left), Qty, Rate, Amount (right). 80mm=48, 58mm=32. */
  private getItemColumnWidths(paperWidth: 58 | 80): { item: number; qty: number; rate: number; amount: number } {
    if (paperWidth === 80) return { item: 18, qty: 4, rate: 10, amount: 12 };
    return { item: 10, qty: 3, rate: 8, amount: 9 };
  }

  /**
   * One row per product like UI: Item (left) | Qty | Rate | Amount (right-aligned in columns).
   */
  private formatItemRow(
    name: string,
    qty: string,
    rate: string,
    amount: string,
    paperWidth: 58 | 80
  ): string {
    const w = this.getItemColumnWidths(paperWidth);
    const itemPart = (name.length > w.item ? name.substring(0, w.item - 1) + '…' : name).padEnd(w.item);
    const qtyPart = qty.padStart(w.qty);
    const ratePart = rate.padStart(w.rate);
    const amountPart = amount.padStart(w.amount);
    return itemPart + qtyPart + ratePart + amountPart + '\n';
  }

  /** Header line for item table (Item, Qty, Rate, Amount) same column widths. */
  private formatItemHeaderRow(paperWidth: 58 | 80): string {
    const w = this.getItemColumnWidths(paperWidth);
    return 'Item'.padEnd(w.item) + 'Qty'.padStart(w.qty) + 'Rate'.padStart(w.rate) + 'Amount'.padStart(w.amount) + '\n';
  }

  /** Non-GST: one row per product — Item (left) | Qty | Amount (right). No Rate column. */
  private formatItemRowNonGST(name: string, qty: string, amount: string, paperWidth: 58 | 80): string {
    const itemW = paperWidth === 80 ? 28 : 16;
    const qtyW = paperWidth === 80 ? 6 : 4;
    const amountW = paperWidth === 80 ? 14 : 12;
    const itemPart = (name.length > itemW ? name.substring(0, itemW - 1) + '…' : name).padEnd(itemW);
    const qtyPart = qty.padStart(qtyW);
    const amountPart = amount.padStart(amountW);
    return itemPart + qtyPart + amountPart + '\n';
  }

  private formatItemHeaderRowNonGST(paperWidth: 58 | 80): string {
    const itemW = paperWidth === 80 ? 28 : 16;
    const qtyW = paperWidth === 80 ? 6 : 4;
    const amountW = paperWidth === 80 ? 14 : 12;
    return 'Item'.padEnd(itemW) + 'Qty'.padStart(qtyW) + 'Amount'.padStart(amountW) + '\n';
  }

  /** Strip to ASCII so printer never gets garbage (no encoding/random chars). */
  private toAscii(s: string): string {
    return s.replace(/₹/g, 'Rs ').replace(/[^\x00-\x7F]/g, '?');
  }

  /** Time string to printer-safe ASCII (e.g. replace Unicode space with normal space so no "6:09?pm"). */
  private timeToAscii(t: string): string {
    return t.replace(/[^\x00-\x7F]/g, ' ');
  }

  private delay(ms: number): Promise<void> {
    return new Promise((r) => setTimeout(r, ms));
  }

  /**
   * Send line-by-line so printer buffer doesn't drop the middle (items).
   */
  private async sendToBluetooth(printData: string): Promise<void> {
    const safe = this.toAscii(printData);
    const lines = safe.split('\n');
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const withNewline = i < lines.length - 1 ? line + '\n' : (line ? line + '\n' : '');
      if (!withNewline) continue;
      await XprinterModule.printBillStart();
      await XprinterModule.printBillChunk(withNewline);
      await XprinterModule.printBillFlush();
      await this.delay(50);
    }
  }

  private async printGSTBill(data: GSTBillData, paperWidth: 58 | 80): Promise<void> {
    await this.sendToBluetooth(this.buildGSTBillContent(data, paperWidth));
  }

  private async printNonGSTBill(data: NonGSTBillData, paperWidth: 58 | 80): Promise<void> {
    await this.sendToBluetooth(this.buildNonGSTBillContent(data, paperWidth));
  }

  /**
   * Print bill (Bluetooth or network/emulator)
   */
  async printBill(billData: GSTBillData | NonGSTBillData, isGST: boolean): Promise<boolean> {
    try {
      const settings = await getBusinessSettings();
      const paperWidth: 58 | 80 = (settings?.paper_size === '58mm' ? 58 : 80) as 58 | 80;

      const network = await this.isNetworkPrintMode();
      if (network) {
        const printData = isGST
          ? this.getGSTBillPrintData(billData as GSTBillData, paperWidth)
          : this.getNonGSTBillPrintData(billData as NonGSTBillData, paperWidth);
        await this.sendToNetworkPrinter(network.url, printData + CUT_CMD);
        return true;
      }

      if (Platform.OS !== 'android' || !XprinterModule) {
        throw new Error('Set up your Bluetooth printer in Printer Setup first.');
      }
      let connected = await XprinterModule.isConnected();
      if (!connected && settings?.printer_mac_address) {
        await this.connectBluetooth(settings.printer_mac_address);
        connected = await XprinterModule.isConnected();
      }
      if (!connected) {
        throw new Error('Set up printer once in Printer Setup: pair in Bluetooth, then select printer and tap Connect.');
      }
      if (isGST) {
        await this.printGSTBill(billData as GSTBillData, paperWidth);
      } else {
        await this.printNonGSTBill(billData as NonGSTBillData, paperWidth);
      }
      await this.cutPaper(); // Tell auto-cut machine to cut after bill
      return true;
    } catch (error: any) {
      throw new Error(`Failed to print bill: ${error.message}`);
    }
  }

  /**
   * Print test page (Bluetooth or network/emulator)
   */
  async printTestPage(): Promise<boolean> {
    try {
      const network = await this.isNetworkPrintMode();
      if (network) {
        await this.sendToNetworkPrinter(network.url, this.getTestPrintData() + CUT_CMD);
        return true;
      }
      if (Platform.OS !== 'android' || !XprinterModule) {
        throw new Error('Print is only supported on Android. Connect your Bluetooth printer in Printer Setup.');
      }
      let connected = await XprinterModule.isConnected();
      if (!connected) {
        const settings = await getBusinessSettings();
        if (settings?.printer_mac_address) {
          await this.connectBluetooth(settings.printer_mac_address);
          connected = await XprinterModule.isConnected();
        }
      }
      if (!connected) throw new Error('Printer not connected. Go to Printer Setup, select XP-v320m and tap Connect.');
      await this.sendToBluetooth(this.getTestPrintData());
      await this.cutPaper();
      return true;
    } catch (error: any) {
      throw new Error(`Failed to print test page: ${error.message}`);
    }
  }

  /**
   * Open cash drawer
   */
  async openCashDrawer(): Promise<boolean> {
    if (Platform.OS !== 'android' || !XprinterModule) {
      throw new Error('Printer is only supported on Android');
    }
    
    try {
      await XprinterModule.openCashDrawer();
      return true;
    } catch (error: any) {
      throw new Error(`Failed to open cash drawer: ${error.message}`);
    }
  }

  /**
   * Cut paper
   */
  async cutPaper(): Promise<boolean> {
    if (Platform.OS !== 'android' || !XprinterModule) {
      throw new Error('Printer is only supported on Android');
    }
    
    try {
      await XprinterModule.cutPaper();
      return true;
    } catch (error: any) {
      throw new Error(`Failed to cut paper: ${error.message}`);
    }
  }
}

// Export singleton instance
export const PrinterService = new PrinterServiceImpl();

