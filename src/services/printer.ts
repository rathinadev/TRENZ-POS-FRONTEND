// src/services/printer.ts
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
   * Build GST bill print string (no native send)
   */
  private getGSTBillPrintData(data: GSTBillData, paperWidth: 58 | 80): string {
    let printData = '';
    printData += ESC + '@';
    printData += this.centerText();
    printData += this.setFontSize(2, 2);
    printData += this.boldOn();
    printData += this.formatLine(data.restaurantName.toUpperCase(), paperWidth);
    printData += this.boldOff();
    printData += this.setFontSize(1, 1);
    printData += this.formatLine(data.address, paperWidth);
    printData += this.formatLine(`GSTIN: ${data.gstin}`, paperWidth);
    if (data.fssaiLicense) printData += this.formatLine(`FSSAI No: ${data.fssaiLicense}`, paperWidth);
    if (data.phone) printData += this.formatLine(`Ph: ${data.phone}`, paperWidth);
    printData += '\n';
    printData += this.leftAlign();
    printData += this.lineSeparator(paperWidth);
    printData += this.formatLine(`Bill No: ${data.billNumber}`, paperWidth);
    printData += this.formatLine(`Date: ${data.billDate}${data.billTime ? ` | ${data.billTime}` : ''}`, paperWidth);
    printData += this.formatLine(`Invoice No: ${data.invoiceNumber}`, paperWidth);
    if (data.tableNumber) printData += this.formatLine(`Table: ${data.tableNumber}`, paperWidth);
    printData += '\n';
    printData += this.lineSeparator(paperWidth);
    printData += this.boldOn();
    printData += this.formatLine('Item          Qty    Rate    Amount', paperWidth);
    printData += this.boldOff();
    printData += this.lineSeparator(paperWidth);
    for (const item of data.items) {
      const name = item.name.length > 12 ? item.name.substring(0, 12) : item.name;
      const qty = item.quantity.toString();
      const rate = `Rs ${item.rate.toFixed(2)}`;
      const amount = `Rs ${item.amount.toFixed(2)}`;
      printData += this.formatLine(name, paperWidth);
      printData += this.formatLine(`${qty.padStart(4)}  ${rate.padStart(8)}  ${amount.padStart(10)}`, paperWidth);
      if (item.gstPercentage) printData += this.formatLine(`  GST ${item.gstPercentage}%`, paperWidth);
      printData += '\n';
    }
    printData += this.lineSeparator(paperWidth);
    printData += this.formatAmountRow('Subtotal:', data.subtotal, paperWidth);
    printData += this.formatAmountRow(`CGST (${data.cgstPercentage}%):`, data.cgstAmount, paperWidth);
    printData += this.formatAmountRow(`SGST (${data.sgstPercentage}%):`, data.sgstAmount, paperWidth);
    printData += '\n';
    printData += this.boldOn();
    printData += this.formatAmountRow('Total:', data.totalAmount, paperWidth);
    printData += this.boldOff();
    printData += '\n';
    printData += this.lineSeparator(paperWidth);
    printData += this.formatLine(`Payment Mode: ${data.paymentMode}`, paperWidth);
    if (data.amountPaid) printData += this.formatAmountRow('Amount Paid:', data.amountPaid, paperWidth);
    if (data.changeAmount && data.changeAmount > 0) printData += this.formatAmountRow('Change:', data.changeAmount, paperWidth);
    printData += '\n';
    printData += this.centerText();
    if (data.footerNote) printData += this.formatLine(data.footerNote, paperWidth);
    printData += '\n\n';
    return printData;
  }

  /**
   * Build Non-GST bill print string (no native send)
   */
  private getNonGSTBillPrintData(data: NonGSTBillData, paperWidth: 58 | 80): string {
    let printData = '';
    printData += ESC + '@';
    printData += this.centerText();
    printData += this.setFontSize(2, 2);
    printData += this.boldOn();
    printData += this.formatLine(data.restaurantName.toUpperCase(), paperWidth);
    printData += this.boldOff();
    printData += this.setFontSize(1, 1);
    printData += this.formatLine(data.address, paperWidth);
    if (data.phone) printData += this.formatLine(`Ph: ${data.phone}`, paperWidth);
    printData += '\n';
    printData += this.leftAlign();
    printData += this.lineSeparator(paperWidth);
    printData += this.formatLine(`Bill No: ${data.billNumber}`, paperWidth);
    printData += this.formatLine(`Date: ${data.billDate}${data.billTime ? ` | ${data.billTime}` : ''}`, paperWidth);
    if (data.tableNumber) printData += this.formatLine(`Table: ${data.tableNumber}`, paperWidth);
    printData += '\n';
    printData += this.lineSeparator(paperWidth);
    printData += this.boldOn();
    printData += this.formatLine('Item          Qty    Amount', paperWidth);
    printData += this.boldOff();
    printData += this.lineSeparator(paperWidth);
    for (const item of data.items) {
      const name = item.name.length > 12 ? item.name.substring(0, 12) : item.name;
      const qty = item.quantity.toString();
      const amount = `Rs ${item.amount.toFixed(2)}`;
      printData += this.formatLine(name, paperWidth);
      printData += this.formatLine(`${qty.padStart(4)}  ${amount.padStart(15)}`, paperWidth);
      printData += '\n';
    }
    printData += this.lineSeparator(paperWidth);
    printData += this.formatAmountRow('Subtotal:', data.subtotal, paperWidth);
    printData += '\n';
    printData += this.boldOn();
    printData += this.formatAmountRow('Total:', data.totalAmount, paperWidth);
    printData += this.boldOff();
    printData += '\n';
    printData += this.lineSeparator(paperWidth);
    printData += this.formatLine(`Payment Mode: ${data.paymentMode}`, paperWidth);
    if (data.amountPaid) printData += this.formatAmountRow('Amount Paid:', data.amountPaid, paperWidth);
    if (data.changeAmount && data.changeAmount > 0) printData += this.formatAmountRow('Change:', data.changeAmount, paperWidth);
    printData += '\n';
    printData += this.centerText();
    if (data.footerNote) printData += this.formatLine(data.footerNote, paperWidth);
    printData += '\n\n';
    return printData;
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
   * Format text to fit paper width (no padding - keeps total length down so full bill prints).
   */
  private formatLine(text: string, paperWidth: 58 | 80): string {
    const maxChars = paperWidth === 58 ? 32 : 48;
    if (text.length <= maxChars) return text + '\n';
    return text.substring(0, maxChars - 3) + '...\n';
  }

  /**
   * Format amount row; use "Rs " (not ₹) so line length matches printer and "Amount Paid" doesn't wrap.
   */
  private formatAmountRow(label: string, amount: number, paperWidth: 58 | 80): string {
    const maxChars = paperWidth === 58 ? 32 : 48;
    const amountText = `Rs ${amount.toFixed(2)}`;
    const spaces = maxChars - label.length - amountText.length;
    return label + ' '.repeat(Math.max(1, spaces)) + amountText + '\n';
  }

  /** Strip to ASCII so printer never gets garbage (no encoding/random chars). */
  private toAscii(s: string): string {
    return s.replace(/₹/g, 'Rs ').replace(/[^\x00-\x7F]/g, '?');
  }

  /** Delay helper so printer can process each line (avoids buffer dropping middle). */
  private delay(ms: number): Promise<void> {
    return new Promise((r) => setTimeout(r, ms));
  }

  /**
   * Send bill line-by-line: each line flushed separately so printer buffer never overflows.
   * (One big stream was losing Bill No, items, Sub Total, Payment – only start + CGST/SGST/Total + footer printed.)
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
      await this.delay(60);
    }
  }

  /**
   * Print GST Bill
   */
  private async printGSTBill(data: GSTBillData, paperWidth: 58 | 80): Promise<void> {
    let printData = '';
    
    // Initialize printer
    printData += ESC + '@'; // Reset printer
    
    // Business Header (Centered, Bold, Large)
    printData += this.centerText();
    printData += this.setFontSize(2, 2);
    printData += this.boldOn();
    printData += this.formatLine(data.restaurantName.toUpperCase(), paperWidth);
    printData += this.boldOff();
    printData += this.setFontSize(1, 1);
    printData += this.formatLine(data.address, paperWidth);
    printData += this.formatLine(`GSTIN: ${data.gstin}`, paperWidth);
    if (data.fssaiLicense) {
      printData += this.formatLine(`FSSAI No: ${data.fssaiLicense}`, paperWidth);
    }
    if (data.phone) {
      printData += this.formatLine(`Ph: ${data.phone}`, paperWidth);
    }
    printData += '\n';

    // Line separator
    printData += this.leftAlign();
    printData += this.lineSeparator(paperWidth);

    // Bill Details
    printData += this.formatLine(`Bill No: ${data.billNumber}`, paperWidth);
    printData += this.formatLine(`Date: ${data.billDate}${data.billTime ? ` | ${data.billTime}` : ''}`, paperWidth);
    printData += this.formatLine(`Invoice No: ${data.invoiceNumber}`, paperWidth);
    if (data.tableNumber) {
      printData += this.formatLine(`Table: ${data.tableNumber}`, paperWidth);
    }
    printData += '\n';

    // Line separator
    printData += this.lineSeparator(paperWidth);

    // Items Header
    printData += this.boldOn();
    printData += this.formatLine('Item          Qty    Rate    Amount', paperWidth);
    printData += this.boldOff();
    printData += this.lineSeparator(paperWidth);

    // Items
    for (const item of data.items) {
      const name = item.name.length > 12 ? item.name.substring(0, 12) : item.name;
      const qty = item.quantity.toString();
      const rate = `Rs ${item.rate.toFixed(2)}`;
      const amount = `Rs ${item.amount.toFixed(2)}`;

      // First line: Item name
      printData += this.formatLine(name, paperWidth);

      // Second line: Qty, Rate, Amount
      const itemLine = `${qty.padStart(4)}  ${rate.padStart(8)}  ${amount.padStart(10)}`;
      printData += this.formatLine(itemLine, paperWidth);

      if (item.gstPercentage) {
        printData += this.formatLine(`  GST ${item.gstPercentage}%`, paperWidth);
      }
      printData += '\n';
    }
    
    // Line separator
    printData += this.lineSeparator(paperWidth);
    
    // Amounts
    printData += this.formatAmountRow('Subtotal:', data.subtotal, paperWidth);
    printData += this.formatAmountRow(`CGST (${data.cgstPercentage}%):`, data.cgstAmount, paperWidth);
    printData += this.formatAmountRow(`SGST (${data.sgstPercentage}%):`, data.sgstAmount, paperWidth);
    printData += '\n';
    printData += this.boldOn();
    printData += this.formatAmountRow('Total:', data.totalAmount, paperWidth);
    printData += this.boldOff();
    printData += '\n';
    
    // Payment Details
    printData += this.lineSeparator(paperWidth);
    printData += this.formatLine(`Payment Mode: ${data.paymentMode}`, paperWidth);
    if (data.amountPaid) {
      printData += this.formatAmountRow('Amount Paid:', data.amountPaid, paperWidth);
    }
    if (data.changeAmount && data.changeAmount > 0) {
      printData += this.formatAmountRow('Change:', data.changeAmount, paperWidth);
    }
    printData += '\n';
    
    // Footer
    printData += this.centerText();
    if (data.footerNote) {
      printData += this.formatLine(data.footerNote, paperWidth);
    }
    printData += '\n\n';
    await this.sendToBluetooth(printData);
  }

  /**
   * Print Non-GST Bill
   */
  private async printNonGSTBill(data: NonGSTBillData, paperWidth: 58 | 80): Promise<void> {
    let printData = '';

    // Initialize printer
    printData += ESC + '@'; // Reset printer

    // Business Header (Centered, Bold, Large)
    printData += this.centerText();
    printData += this.setFontSize(2, 2);
    printData += this.boldOn();
    printData += this.formatLine(data.restaurantName.toUpperCase(), paperWidth);
    printData += this.boldOff();
    printData += this.setFontSize(1, 1);
    printData += this.formatLine(data.address, paperWidth);
    if (data.phone) {
      printData += this.formatLine(`Ph: ${data.phone}`, paperWidth);
    }
    printData += '\n';

    // Line separator
    printData += this.leftAlign();
    printData += this.lineSeparator(paperWidth);

    // Bill Details
    printData += this.formatLine(`Bill No: ${data.billNumber}`, paperWidth);
    printData += this.formatLine(`Date: ${data.billDate}${data.billTime ? ` | ${data.billTime}` : ''}`, paperWidth);
    if (data.tableNumber) {
      printData += this.formatLine(`Table: ${data.tableNumber}`, paperWidth);
    }
    printData += '\n';

    // Line separator
    printData += this.lineSeparator(paperWidth);

    // Items Header
    printData += this.boldOn();
    printData += this.formatLine('Item          Qty    Amount', paperWidth);
    printData += this.boldOff();
    printData += this.lineSeparator(paperWidth);

    // Items
    for (const item of data.items) {
      const name = item.name.length > 12 ? item.name.substring(0, 12) : item.name;
      const qty = item.quantity.toString();
      const amount = `Rs ${item.amount.toFixed(2)}`;

      // First line: Item name
      printData += this.formatLine(name, paperWidth);

      // Second line: Qty, Amount
      const itemLine = `${qty.padStart(4)}  ${amount.padStart(15)}`;
      printData += this.formatLine(itemLine, paperWidth);
      printData += '\n';
    }
    
    // Line separator
    printData += this.lineSeparator(paperWidth);
    
    // Amounts
    printData += this.formatAmountRow('Subtotal:', data.subtotal, paperWidth);
    printData += '\n';
    printData += this.boldOn();
    printData += this.formatAmountRow('Total:', data.totalAmount, paperWidth);
    printData += this.boldOff();
    printData += '\n';
    
    // Payment Details
    printData += this.lineSeparator(paperWidth);
    printData += this.formatLine(`Payment Mode: ${data.paymentMode}`, paperWidth);
    if (data.amountPaid) {
      printData += this.formatAmountRow('Amount Paid:', data.amountPaid, paperWidth);
    }
    if (data.changeAmount && data.changeAmount > 0) {
      printData += this.formatAmountRow('Change:', data.changeAmount, paperWidth);
    }
    printData += '\n';
    
    // Footer
    printData += this.centerText();
    if (data.footerNote) {
      printData += this.formatLine(data.footerNote, paperWidth);
    }
    printData += '\n\n';
    await this.sendToBluetooth(printData);
  }

  /**
   * Print bill (Bluetooth or network/emulator)
   */
  async printBill(billData: GSTBillData | NonGSTBillData, isGST: boolean): Promise<boolean> {
    try {
      const settings = await getBusinessSettings();
      const paperWidth: 58 | 80 = (settings?.paper_size === '80mm' ? 80 : 58) as 58 | 80;

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
      const printData = this.getTestPrintData();
      await XprinterModule.printText(printData);
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

