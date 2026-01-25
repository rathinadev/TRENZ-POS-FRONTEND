# Auto-Sync Feature

## 🔄 **Automatic Background Sync**

Your app now **automatically syncs all local changes to the backend** when internet connectivity is restored!

---

## ✨ **How It Works**

### **Network Detection:**
The app continuously monitors your device's network status using React Native NetInfo.

### **Auto-Sync Trigger:**
When the app detects that internet connectivity has been **restored** (from offline to online), it automatically:

1. **Checks offline duration** - only syncs if you were offline for more than 3 seconds
2. **Prevents false triggers** - ignores brief network fluctuations
3. **Waits 2 seconds** for connection to stabilize
4. **Syncs all local changes** to the backend server
5. **Logs the results** for debugging

**Important**: Auto-sync will NOT trigger if:
- You're already online and stay online
- Network briefly flickers (< 3 seconds offline)
- You navigate between screens while online
- API calls fail (this doesn't mean you're offline)

---

## 📊 **What Gets Synced**

When you turn on WiFi/Data, the app automatically syncs:

### **1. Categories** 🏷️
- New categories created offline
- Category updates (name, description, sort order)
- Category deletions

### **2. Items/Menu Items** 🍽️
- New items added offline
- Item updates (price, GST, images, etc.)
- Item status changes (active/inactive)
- Stock quantity updates

### **3. Bills/Sales** 💰
- Bills created offline
- Complete bill data with items
- Payment information
- Customer details

### **4. Inventory** 📦
- Stock level changes
- New inventory items
- Inventory updates

---

## 🚀 **User Experience**

### **Scenario 1: Working Offline, Then Coming Online**

```
1. User is offline (no WiFi/Data)
   └─ Creates 5 bills
   └─ Adds 3 new items
   └─ Updates 2 categories
   └─ All saved locally ✅

2. User turns on WiFi/Data
   └─ App detects: "Network restored!"
   └─ AUTO-SYNC starts automatically 🔄
   └─ Syncs all 10 changes to backend
   └─ Shows: "✅ Successfully synced 10 changes"

3. All data now on server ☁️
```

### **Scenario 2: Network Drops and Returns**

```
1. User working normally (online)
   └─ Network suddenly drops 📴
   └─ App: "Offline - using local data"
   └─ User continues working

2. User makes changes offline
   └─ Creates bills
   └─ Adds items
   └─ All saved locally

3. Network comes back
   └─ AUTO-SYNC triggers automatically 🔄
   └─ All offline changes sync to server
   └─ User doesn't need to do anything!
```

---

## 📱 **Console Logs**

You'll see clear logging when auto-sync happens:

### **When Network Restored (Genuine Disconnection):**
```
📶 Network status: 📴 Offline
📴 Going offline - tracking timestamp

(... user is offline for 5+ seconds ...)

📶 Network status: ✅ Online
🔄 Network transition detected: offline → online
   Offline duration: 5230ms
🔄 AUTO-SYNC: Network genuinely restored - syncing all local changes to backend...
📡 Online - syncing all local changes to backend...
🔄 === Starting full sync to backend ===
```

### **When Network Flickers Briefly (Prevented):**
```
📶 Network status: 📴 Offline
📴 Going offline - tracking timestamp

(... brief 1 second flicker ...)

📶 Network status: ✅ Online
🔄 Network transition detected: offline → online
   Offline duration: 1200ms
⏭️ AUTO-SYNC: Skipping sync - offline duration too short (1200ms < 3000ms)
   This was likely a false network state change, not a genuine disconnection
```

### **Sync in Progress:**
```
Syncing categories...
✅ Categories synced: 2
Syncing items...
✅ Items synced: 3
Syncing bills...
✅ Bills synced: 5
Syncing inventory...
✅ Inventory synced: 0
```

### **Sync Complete:**
```
✅ AUTO-SYNC: Successfully synced 10 changes to backend
   Categories: 2, Items: 3, Bills: 5, Inventory: 0
```

---

## ⚙️ **Technical Details**

### **Network Listener:**
- Initialized in `App.tsx` when app starts
- Uses `@react-native-community/netinfo`
- Listens for network state changes
- Triggers sync on offline → online transition

### **Sync Safeguards:**
- **3 second minimum offline duration** - prevents false triggers from brief network flickers
- **2 second delay** after network is restored - ensures connection is stable
- **Debouncing** - prevents multiple rapid sync attempts
- **Timestamp tracking** - only syncs on genuine disconnections

### **Sync Function:**
- Located in `src/services/sync.ts`
- `syncAll()` syncs all entity types
- Handles errors gracefully
- Logs detailed results

---

## 🎯 **Benefits**

### **For Users:**
- ✅ **Automatic**: No manual sync button needed
- ✅ **Seamless**: Works in background
- ✅ **Fast**: Syncs within seconds of coming online
- ✅ **Reliable**: Retries failed syncs
- ✅ **Transparent**: Clear console logs

### **For Business:**
- ✅ **Data integrity**: All changes reach server
- ✅ **Real-time updates**: Data synced immediately
- ✅ **No data loss**: Offline changes preserved
- ✅ **Analytics accuracy**: Server has latest data

---

## 🔍 **Monitoring Auto-Sync**

### **Check Console Logs:**
1. Open Metro bundler terminal
2. Look for auto-sync messages
3. Verify sync counts match your changes

### **Verify on Backend:**
1. Check server logs
2. Query database for synced data
3. Verify timestamps match sync time

---

## ⚠️ **Important Notes**

### **Sync Triggers:**
- ✅ Network restored (offline → online) **for more than 3 seconds**
- ✅ App startup (if online)
- ❌ Does NOT sync when going offline
- ❌ Does NOT sync if already online
- ❌ Does NOT sync on brief network flickers (< 3 seconds)
- ❌ Does NOT sync when navigating between screens
- ❌ Does NOT sync when API calls fail (server errors are not offline)

### **Sync Behavior:**
- Only syncs **unsynced** local changes
- Marks items as synced after success
- Retries failed items later
- Prevents duplicate syncs

### **Network Requirements:**
- Requires stable internet connection
- 2-second delay ensures stability
- Fails gracefully if server unavailable
- Retries on next network restore

---

## 🛠️ **Developer Notes**

### **Customizing Sync Delay:**
```typescript
// In src/services/sync.ts
setTimeout(async () => {
  // Change from 2000ms (2s) to desired delay
  await syncAll();
}, 2000); // ← Adjust this value
```

### **Adding Custom Sync Logic:**
```typescript
// Add to initNetworkListener in sync.ts
if (wasOffline && isOnline) {
  console.log('Network restored');
  
  // Add your custom logic here
  // Example: Show user notification
  // Example: Refresh dashboard data
  
  setTimeout(async () => {
    await syncAll();
  }, 2000);
}
```

### **Manual Sync Trigger:**
```typescript
// Import in any screen
import { syncAll } from '../services/sync';

// Trigger manually
const handleManualSync = async () => {
  const result = await syncAll();
  console.log('Sync result:', result);
};
```

---

## 📋 **Testing Auto-Sync**

### **Test Scenario 1: Basic Auto-Sync**
1. Turn OFF WiFi/Data
2. Create a bill in the app
3. Turn ON WiFi/Data
4. Watch console - should see auto-sync
5. Verify bill appears on backend

### **Test Scenario 2: Multiple Changes**
1. Go offline
2. Create multiple bills
3. Add items
4. Update categories
5. Go online
6. Verify all changes sync

### **Test Scenario 3: Brief Network Flicker (Should NOT Sync)**
1. Work normally (online)
2. Disconnect WiFi for 1-2 seconds
3. Reconnect WiFi immediately
4. Check console - should see "Skipping sync - offline duration too short"
5. Auto-sync should NOT trigger

### **Test Scenario 4: Genuine Disconnection (Should Sync)**
1. Work normally (online)
2. Disconnect WiFi for 5+ seconds
3. Make changes offline
4. Reconnect WiFi
5. Check console - should see "Network genuinely restored"
6. Auto-sync should trigger

---

## 🚨 **Troubleshooting**

### **Auto-Sync Not Triggering:**
- Check if network listener is initialized
- Look for console log: "Network listener initialized"
- Verify NetInfo package is installed
- Check for errors in console
- Ensure you were offline for MORE than 3 seconds (brief flickers are ignored)

### **Sync Fails:**
- Check backend server is running
- Verify API endpoints are correct
- Check authentication token is valid
- Look for error messages in console

### **Data Not Appearing on Backend:**
- Verify sync completed successfully
- Check backend logs for incoming requests
- Verify data was marked as "unsynced" locally
- Check database sync operation queue

---

## ✅ **Summary**

Your app now features **intelligent auto-sync**:

- ✅ Automatically syncs when network is restored
- ✅ Syncs all local changes (bills, items, categories, inventory)
- ✅ Works seamlessly in the background
- ✅ Clear console logs for monitoring
- ✅ 2-second delay for connection stability
- ✅ Graceful error handling

**Result**: Users never have to worry about manually syncing - it just works! 🎉
