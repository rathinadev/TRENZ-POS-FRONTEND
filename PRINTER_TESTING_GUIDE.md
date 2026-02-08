# XP-v320m Printer Testing Guide

> **Full reference:** For architecture, ESC/POS, implementation details, and how to extend, see **[docs/PRINTER_ULTIMATE_GUIDE.md](docs/PRINTER_ULTIMATE_GUIDE.md)**.

## 🖨 Test with XP-v320m Today

### Development on your laptop (Bluetooth printer)

Use the app in the **emulator** and print to your **Bluetooth** XP-v320m. Pair the printer with the laptop; the relay sends jobs over the COM port Windows creates.

   - Turn on the XP-v320m. **Settings → Bluetooth & devices → Add device** → select the printer and pair.
   - **Device Manager → Ports (COM & LPT)** → note e.g. **Standard Serial over Bluetooth link (COM5)**.
2. **Start the relay on the laptop** (in `TRENZ-POS-FRONTEND`):
   ```bash
   npm install
   set PRINTER_COM_PORT=COM5
   npm run relay
   ```
   Replace `192.168.1.100` with your printer’s IP. Use your actual COM port (Device Manager → Ports). Leave the relay running.
3. **Run the app in the Android emulator**: `npm run android`.
4. In the app go to **Printer Setup** → turn on **Use network printing** → set **Print server URL** to `http://10.0.2.2:9101` → tap **Save URL**.
5. Tap **Test Print**. The relay sends the job to the printer; the receipt should print.
6. Create a bill and complete checkout → tap **Print Bill** (or use **Auto Print**). Bills will go through the relay to the printer.

### Option B: From a **physical Android device** (Bluetooth)

1. **Pair the printer** – On the device: **Settings → Bluetooth** → turn on printer → pair (PIN often 0000 or 1234).
2. **Install the app** – Connect the phone via USB and run: `npm run android`.
3. In the app go to **Printer Setup** → select **XP-v320M** → tap **Connect**.
4. **Test print** → then create a bill and **Print Bill** (or use **Auto Print**).

If Bluetooth connection fails, the app tries a fallback that works with many XP-v320m units.

---

## ✅ What Has Been Implemented

1. **Native Android Module** (`XprinterModule.kt`)
   - Bluetooth device discovery
   - Connection management
   - Print text with GBK encoding
   - Cash drawer control
   - Paper cutting

2. **TypeScript Printer Service** (`src/services/printer.ts`)
   - Bill formatting for GST and Non-GST bills
   - ESC/POS command generation
   - Automatic reconnection

3. **UI Updates**
   - `PrinterSetupScreen`: Lists and connects to Bluetooth devices
   - `BillSuccessScreen`: Prints bills after generation
   - `TestPrintPreviewScreen`: Test print functionality

## 🧪 How to Test (On Android Device)

### Prerequisites
1. **Physical Android device** (phone/tablet) with Bluetooth
2. **XP-v320m printer** powered on
3. **USB cable** to connect device to computer (for debugging)

### Step 1: Pair the Printer
1. On your Android device, go to **Settings → Bluetooth**
2. Turn on Bluetooth
3. Turn on the XP-v320m printer
4. Find the printer in the available devices list (usually shows as "XP-v320M" or similar)
5. Tap to pair (may require a PIN - check printer manual, often "0000" or "1234")
6. Wait for "Paired" status

### Step 2: Build and Install the App
```bash
cd /home/rathina-devan/Desktop/personal/freelance/TRENZ-POS-FRONTEND

# Connect your Android device via USB
adb devices  # Should show your device

# Build and install
npm run android
# OR
npx react-native run-android
```

### Step 3: Test Printer Connection
1. Open the app on your device
2. Navigate to **Settings → Printer Setup** (or wherever PrinterSetup is in your navigation)
3. You should see a list of paired Bluetooth devices
4. Find your XP-v320m printer in the list
5. Tap to select it
6. Tap **"Connect"** button
7. Wait for "Connected" status

### Step 4: Test Print
1. In Printer Setup, tap **"Test Print"**
2. A test page should print from the printer
3. Verify the output looks correct

### Step 5: Test Bill Printing
1. Create a test bill in the app
2. Complete checkout
3. On the Bill Success screen, tap **"Print Bill"**
4. The bill should print from the printer
5. Verify:
   - Business name and address print correctly
   - Items list is formatted properly
   - Amounts are aligned
   - Paper cuts after printing

## 🔍 Troubleshooting

### Printer Not Showing in List
- **Solution**: Make sure printer is paired in Android Settings first
- Refresh the device list in the app

### Connection Fails
- Check printer is powered on
- Check printer is within Bluetooth range (~10 meters)
- Try unpairing and re-pairing in Android Settings
- Restart the app

### Print Nothing Happens
- Verify connection status shows "Connected"
- Check printer has paper loaded
- Try test print first
- Check printer is not in sleep mode

### Encoding Issues (Garbled Text)
- The code uses GBK encoding as per Xprinter documentation
- If you see garbled text, the printer might need different encoding
- Check printer manual for encoding requirements

### Build Errors
If you get Gradle/build errors:
```bash
cd android
./gradlew clean
cd ..
npm install
npm run android
```

## 📝 Code Verification (What We Can Check from Ubuntu)

✅ **Files Created:**
- `android/app/src/main/java/com/trenztechnologies/XprinterModule.kt` ✓
- `android/app/src/main/java/com/trenztechnologies/XprinterPackage.kt` ✓
- `src/services/printer.ts` ✓

✅ **Files Updated:**
- `android/app/src/main/java/com/trenztechnologies/MainApplication.kt` ✓
- `src/screens/PrinterSetupScreen.tsx` ✓
- `src/screens/BillSuccessScreen.tsx` ✓
- `src/screens/TestPrintPreviewScreen.tsx` ✓
- `src/database/schema.ts` ✓
- `src/services/storage.ts` ✓

✅ **Permissions:**
- Bluetooth permissions already in `AndroidManifest.xml` ✓

## 🎯 Testing Checklist

- [ ] Printer pairs successfully in Android Settings
- [ ] Printer appears in app's device list
- [ ] Connection succeeds
- [ ] Test print works
- [ ] Bill printing works
- [ ] Paper cuts after printing
- [ ] Cash drawer opens (if applicable)
- [ ] Both 58mm and 80mm paper sizes work
- [ ] GST bills print correctly
- [ ] Non-GST bills print correctly

## 📞 Next Steps

1. **On Android Device**: Follow the testing steps above
2. **If Issues**: Check the troubleshooting section
3. **For Debugging**: Use `adb logcat` to see app logs:
   ```bash
   adb logcat | grep -i "xprinter\|bluetooth\|print"
   ```

## ⚠️ Note

The printer functionality **cannot be tested on an emulator** because:
- Android emulators have limited Bluetooth support
- Physical Bluetooth hardware is required
- The printer must be physically paired

You **must use a physical Android device** to test this feature.

