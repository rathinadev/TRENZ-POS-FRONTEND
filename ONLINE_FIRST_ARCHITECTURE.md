# Online-First Architecture

## 📡 **Architecture Change: Offline-First → Online-First**

The app has been updated to prioritize **online API data** while maintaining local storage as a fallback for offline scenarios.

---

## 🎯 **Key Principles**

### **Online-First Strategy:**
1. **Always try API first** when network is available
2. **Use live data** from server for analytics, dashboard, billing
3. **Save to local storage** as backup for offline use
4. **Fallback to local** only when:
   - Network is unavailable
   - API request fails
   - Server is down

### **Local Storage Role:**
- **Backup/Cache** for offline scenarios
- **Fallback** when API fails
- **Quick recovery** if network drops
- **NOT primary data source** anymore

---

## 🔄 **Updated Screens**

### **1. DashboardScreen** (100% Online-First)
```typescript
// BEFORE: Load from local, sync in background
loadFromLocal() → syncToAPI()

// NOW: Try API first, fallback to local
tryAPI() → if (fail) → loadFromLocal()
```

**Behavior:**
- ✅ Always fetch latest analytics from API
- ✅ Real-time data for: sales, bills, GST, payments
- ✅ Fallback to local if API fails
- ✅ Clear logging of data source

---

### **2. BillingScreen** (Online-First)
```typescript
// BEFORE: Load items/categories from local only
loadFromLocal()

// NOW: Try API first, fallback to local
tryAPI() → saveToLocal() → if (fail) → loadFromLocal()
```

**Behavior:**
- ✅ Always fetch latest items/categories from API
- ✅ Get real-time inventory status
- ✅ Save API data to local for offline use
- ✅ Fallback to local if API fails

---

### **3. LoginScreen** (Initial Sync)
```typescript
// Initial sync still runs in background
// Purpose: Download base data for offline use
initialSync() // Non-blocking, runs in background
```

**Behavior:**
- ✅ Downloads categories, items, bills for offline use
- ✅ Non-blocking (user can navigate immediately)
- ✅ Provides backup data if API fails later

---

### **4. BillHistoryScreen** (Online-First)
```typescript
// BEFORE: Load from local
// NOW: Try API, fallback to local
```

**Behavior:**
- ✅ Fetch bills from API
- ✅ Better error handling for 500 errors
- ✅ Fallback to local bills if API fails

---

## 📊 **Data Flow**

### **Online (Network Available):**
```
User Action
  ↓
Check Network: ✅ Online
  ↓
API Request → Server
  ↓
API Response ✅
  ↓
Save to Local Storage (background)
  ↓
Display Data (from API)
```

### **Offline (Network Unavailable):**
```
User Action
  ↓
Check Network: ❌ Offline
  ↓
Load from Local Storage
  ↓
Display Data (from local)
  ↓
Show "Offline" indicator
```

### **API Failure (Server Error):**
```
User Action
  ↓
Check Network: ✅ Online
  ↓
API Request → Server
  ↓
API Error ❌ (500, 404, etc.)
  ↓
Load from Local Storage (fallback)
  ↓
Display Data (from local)
  ↓
Show Error Message
```

---

## 🚀 **Benefits**

### **Real-Time Data:**
- ✅ Dashboard shows live analytics
- ✅ Billing uses latest items/prices
- ✅ Inventory reflects current stock
- ✅ No stale data

### **Reliability:**
- ✅ Local storage as safety net
- ✅ App works offline
- ✅ Graceful degradation
- ✅ Clear error messages

### **Performance:**
- ✅ Direct API calls (no sync delay)
- ✅ Fresh data on every request
- ✅ Background local saves (non-blocking)

---

## 🔍 **Logging**

All screens now have clear logging to show data source:

```
🌐 ONLINE-FIRST: Network available: true
📡 Loading from API (online-first)...
✅ Loaded from API: { categories: 10, items: 50 }
💾 Saving API data to local storage...
```

Or when offline:

```
🌐 ONLINE-FIRST: Network available: false
📴 Loading from local storage (fallback)...
✅ Loaded from local: { categories: 10, items: 50 }
```

---

## ⚠️ **Important Notes**

### **Local Storage is NOT Deleted:**
- All local storage code remains intact
- `storage.ts` functions unchanged
- Database schema unchanged
- Sync service still available

### **Backward Compatibility:**
- If API fails, app works from local
- Offline mode still fully functional
- No data loss

### **Backend Requirements:**
- APIs must return correct data
- APIs must be fast (< 2s response)
- 404/500 errors handled gracefully

---

## 📱 **User Experience**

### **When Online:**
- **Fast**: Direct API calls
- **Fresh**: Real-time data
- **Accurate**: Latest from server

### **When Offline:**
- **Functional**: Uses local data
- **Clear**: "Offline" indicators
- **Graceful**: No crashes

---

## 🛠️ **Developer Notes**

### **Adding New Screens:**
```typescript
// Template for online-first loading:
const loadData = async () => {
  try {
    const isOnline = await getNetworkStatus();
    
    if (isOnline) {
      console.log('📡 Loading from API...');
      const data = await API.endpoint.get();
      // Save to local (optional)
      return data;
    } else {
      throw new Error('Offline');
    }
  } catch (error) {
    console.warn('⚠️ Fallback to local');
    return await loadFromLocal();
  }
};
```

### **Testing:**
1. **Online mode**: Turn on WiFi/Data
2. **Offline mode**: Turn off WiFi/Data
3. **API failure**: Backend returns 500
4. **Slow network**: Throttle network speed

---

## ✅ **Summary**

Your app is now **ONLINE-FIRST**:
- ✅ Prioritizes live API data
- ✅ Keeps local storage as backup
- ✅ Works offline when needed
- ✅ Better for analytics and real-time data
- ✅ No local storage deleted

**Result**: Best of both worlds - real-time accuracy when online, reliability when offline!
