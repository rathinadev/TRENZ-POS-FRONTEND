#!/usr/bin/env node
/**
 * Print relay for development on laptop: app (emulator) → this server → your printer.
 * Works with BLUETOOTH printer: pair the printer with your laptop, then use its COM port.
 *
 * Usage (Bluetooth printer paired with laptop):
 *   1. Pair XP-v320m with Windows: Settings → Bluetooth → pair. Note the COM port
 *      (e.g. COM5 - "Standard Serial over Bluetooth link" in Device Manager → Ports).
 *   2. Install deps once:  npm install
 *   3. Run:  set PRINTER_COM_PORT=COM5  (Windows)  or  PRINTER_COM_PORT=COM5 npm run relay
 *   4. In the app (emulator): Printer Setup → Use network printing → URL http://10.0.2.2:9101 → Save
 *   5. Tap Print Bill → receipt prints from your Bluetooth printer.
 *
 * Usage (WiFi printer on same network):
 *   set PRINTER_IP=192.168.1.100
 *   npm run relay
 */

const http = require('http');

const PORT = Number(process.env.PRINT_RELAY_PORT) || 9101;
const PRINTER_COM_PORT = process.env.PRINTER_COM_PORT || '';
const PRINTER_IP = process.env.PRINTER_IP || '';
const PRINTER_PORT = Number(process.env.PRINTER_PORT) || 9100;

function sendViaSerial(portName, data) {
  let SerialPort;
  try {
    SerialPort = require('serialport').SerialPort;
  } catch (e) {
    return Promise.reject(new Error('Need serialport for Bluetooth. Run: npm install'));
  }
  return new Promise((resolve, reject) => {
    const port = new SerialPort({ path: portName, baudRate: 9600 }, (err) => {
      if (err) return reject(err);
      port.write(Buffer.from(data, 'utf8'), (e) => {
        if (e) return reject(e);
        port.close(() => resolve());
      });
    });
    port.on('error', reject);
  });
}

function sendViaTcp(data) {
  const net = require('net');
  return new Promise((resolve, reject) => {
    const client = new net.Socket();
    client.setTimeout(5000);
    client.connect(PRINTER_PORT, PRINTER_IP, () => {
      client.write(Buffer.from(data, 'utf8'), (err) => {
        if (err) return reject(err);
        client.end(() => resolve());
      });
    });
    client.on('error', reject);
    client.on('timeout', () => {
      client.destroy();
      reject(new Error('Printer connection timeout'));
    });
  });
}

async function sendToPrinter(body) {
  if (PRINTER_COM_PORT) {
    return sendViaSerial(PRINTER_COM_PORT, body);
  }
  if (PRINTER_IP) {
    return sendViaTcp(body);
  }
  throw new Error(
    'Set PRINTER_COM_PORT (e.g. COM5 for Bluetooth on laptop) or PRINTER_IP (WiFi printer). ' +
    'Windows: pair printer in Bluetooth settings, then Device Manager → Ports to see COM port.'
  );
}

const server = http.createServer((req, res) => {
  if (req.method !== 'POST' || (req.url !== '/print' && req.url !== '/')) {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not found. POST /print with raw print data (UTF-8).');
    return;
  }

  const chunks = [];
  req.on('data', (chunk) => chunks.push(chunk));
  req.on('end', async () => {
    const body = Buffer.concat(chunks).toString('utf8');
    if (!body) {
      res.writeHead(400, { 'Content-Type': 'text/plain' });
      res.end('Empty body');
      return;
    }
    try {
      await sendToPrinter(body);
      res.writeHead(200, { 'Content-Type': 'text/plain' });
      res.end('OK');
    } catch (e) {
      console.error('Print error:', e.message);
      res.writeHead(500, { 'Content-Type': 'text/plain' });
      res.end('Print failed: ' + e.message);
    }
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log('Print relay listening on port', PORT);
  if (PRINTER_COM_PORT) {
    console.log('Printer: Bluetooth via', PRINTER_COM_PORT);
  } else if (PRINTER_IP) {
    console.log('Printer: TCP', PRINTER_IP + ':' + PRINTER_PORT);
  } else {
    console.log('WARNING: Set PRINTER_COM_PORT (Bluetooth) or PRINTER_IP (WiFi) or prints will fail.');
  }
  console.log('App (emulator) → set Print server URL to http://10.0.2.2:' + PORT);
});
