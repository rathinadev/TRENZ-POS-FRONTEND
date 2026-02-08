# Print bills from the app

1. **Printer on** and paired with your PC (Windows: Settings → Bluetooth → pair). Note the COM port in Device Manager → Ports (e.g. COM5).

2. **In this folder, run the print server** (leave it running):
   ```
   npm install
   set PRINTER_COM_PORT=COM5
   npm run relay
   ```
   Use your COM port. For a WiFi printer use `set PRINTER_IP=192.168.x.x` instead.

3. **Run the app**: `npm run android`

4. **Create a bill** and complete checkout. On the success screen tap **Print Bill**. The receipt prints.

No need to open Printer Setup unless you want to change the print server URL (default is for emulator).
