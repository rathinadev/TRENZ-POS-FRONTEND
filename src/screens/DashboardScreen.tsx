import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
  ScrollView,
  Animated,
  TextInput,
  Image,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types/business.types';
import { getBills, getItems, getCategories } from '../services/storage';
import API from '../services/api';
import { getNetworkStatus } from '../services/sync';

type DashboardScreenProps = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'Dashboard'>;
};

type DateRange = 'today' | 'yesterday' | 'last7days' | 'custom';

interface DashboardData {
  totalSales: number;
  totalBills: number;
  avgBillValue: number;
  gstBills: number;
  nonGstBills: number;
  totalTaxCollected: number;
  paymentSplit: {
    cash: { count: number; amount: number };
    upi: { count: number; amount: number };
    card: { count: number; amount: number };
    credit: { count: number; amount: number };
    other: { count: number; amount: number };
  };
  pendingPayments: number;
  mostSoldProduct: {
    name: string;
    soldCount: number;
    category: string;
    image?: string;
  } | null;
  leastSoldProduct: {
    name: string;
    soldCount: number;
    category: string;
    image?: string;
  } | null;
  mostSoldCategory: {
    name: string;
    itemsSold: number;
  } | null;
  leastSoldCategory: {
    name: string;
    itemsSold: number;
  } | null;
}

const DashboardScreen: React.FC<DashboardScreenProps> = ({ navigation }) => {
  const [selectedRange, setSelectedRange] = useState<DateRange>('today');
  const [customDays, setCustomDays] = useState('');
  const [showCustomInput, setShowCustomInput] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [dashboardData, setDashboardData] = useState<DashboardData>({
    totalSales: 0,
    totalBills: 0,
    avgBillValue: 0,
    gstBills: 0,
    nonGstBills: 0,
    totalTaxCollected: 0,
    paymentSplit: {
      cash: { count: 0, amount: 0 },
      upi: { count: 0, amount: 0 },
      card: { count: 0, amount: 0 },
      credit: { count: 0, amount: 0 },
      other: { count: 0, amount: 0 },
    },
    pendingPayments: 0,
    mostSoldProduct: null,
    leastSoldProduct: null,
    mostSoldCategory: null,
    leastSoldCategory: null,
  });

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start();

    loadDashboardData('today');
  }, []);

  const calculateDateRange = (range: DateRange, days?: number) => {
    let end = new Date();
    end.setHours(23, 59, 59, 999);
    
    let start = new Date();
    start.setHours(0, 0, 0, 0);

    switch (range) {
      case 'today':
        // Already set to today
        break;
      case 'yesterday':
        start.setDate(start.getDate() - 1);
        end.setDate(end.getDate() - 1);
        break;
      case 'last7days':
        start.setDate(start.getDate() - 7);
        break;
      case 'custom':
        if (days) {
          start.setDate(start.getDate() - days);
        }
        break;
    }

    return { start, end };
  };

  const loadDashboardData = async (range: DateRange, customDaysValue?: string) => {
    try {
      setIsLoading(true);

      const days = customDaysValue ? parseInt(customDaysValue, 10) : undefined;
      const dateRange = calculateDateRange(range, days);

      // ONLINE-FIRST: Always try API first
      const isOnline = await getNetworkStatus();
      console.log('🌐 Online-First Mode: Network available:', isOnline);

      if (isOnline) {
        console.log('📡 Loading dashboard data from API (online-first)...');
        try {
          // Log request parameters
          const startDate = dateRange.start.toISOString().split('T')[0];
          const endDate = dateRange.end.toISOString().split('T')[0];
          console.log('📊 Dashboard API Request - Date Range:', startDate, 'to', endDate);
          
          // Check token
          const token = await import('../services/auth').then(m => m.getAuthToken());
          console.log('🔑 Auth Token Present:', !!token);
          
          // Use API endpoints for accurate server-side data
          const [stats, sales, itemsData, payments, tax, profit] = await Promise.all([
            API.dashboard.getStats(),
            API.dashboard.getSales({
              start_date: startDate,
              end_date: endDate,
            }),
            API.dashboard.getItems({
              start_date: startDate,
              end_date: endDate,
            }),
            API.dashboard.getPayments({
              start_date: startDate,
              end_date: endDate,
            }),
            API.dashboard.getTax({
              start_date: startDate,
              end_date: endDate,
            }),
            API.dashboard.getProfit({
              start_date: startDate,
              end_date: endDate,
            }),
          ]);

          // Log raw API responses
          console.log('📥 Dashboard API Responses:');
          console.log('  Stats:', JSON.stringify(stats, null, 2));
          console.log('  Sales:', JSON.stringify(sales, null, 2));
          console.log('  Items:', JSON.stringify(itemsData, null, 2));
          console.log('  Payments:', JSON.stringify(payments, null, 2));
          console.log('  Tax:', JSON.stringify(tax, null, 2));
          console.log('  Profit:', JSON.stringify(profit, null, 2));

          // Transform API data to dashboard format
          const paymentSplitData = stats.statistics?.payment_split || payments.payment_split || [];
          const paymentSplitMap: DashboardData['paymentSplit'] = {
            cash: { count: 0, amount: 0 },
            upi: { count: 0, amount: 0 },
            card: { count: 0, amount: 0 },
            credit: { count: 0, amount: 0 },
            other: { count: 0, amount: 0 },
          };

          // Map payment split from API
          if (Array.isArray(paymentSplitData)) {
            paymentSplitData.forEach((item: any) => {
              const mode = item.payment_mode?.toLowerCase() || 'other';
              if (mode in paymentSplitMap) {
                paymentSplitMap[mode as keyof typeof paymentSplitMap] = {
                  count: item.transaction_count || item.count || 0,
                  amount: parseFloat(item.total_amount || item.amount || '0'),
                };
              }
            });
          } else if (paymentSplitData) {
            // Handle object format from stats.statistics.payment_split
            Object.keys(paymentSplitMap).forEach((mode) => {
              const data = paymentSplitData[mode];
              if (data) {
                paymentSplitMap[mode as keyof typeof paymentSplitMap] = {
                  count: data.count || 0,
                  amount: parseFloat(data.amount || '0'),
                };
              }
            });
          }

          // Calculate pending payments (credit bills)
          const pendingPayments = paymentSplitMap.credit.amount;

          const data: DashboardData = {
            totalSales: parseFloat(sales.summary?.total_revenue || stats.statistics?.total_revenue || '0'),
            totalBills: stats.statistics?.total_bills || stats.total_bills || 0,
            avgBillValue: stats.avg_bill_value || (stats.total_bills > 0 ? parseFloat(stats.statistics?.total_revenue || '0') / stats.total_bills : 0),
            gstBills: stats.statistics?.gst_bills || 0,
            nonGstBills: stats.statistics?.non_gst_bills || 0,
            totalTaxCollected: parseFloat(tax.summary?.total_tax_collected || '0'),
            paymentSplit: paymentSplitMap,
            pendingPayments,
            mostSoldProduct: itemsData.most_sold && itemsData.most_sold.length > 0
              ? {
                  name: itemsData.most_sold[0].item_name || itemsData.most_sold[0].name,
                  soldCount: parseInt(itemsData.most_sold[0].total_quantity || itemsData.most_sold[0].quantity_sold || '0'),
                  category: itemsData.most_sold[0].category?.[0] || 'Unknown',
                  image: itemsData.most_sold[0].image_url,
                }
              : null,
            leastSoldProduct: itemsData.least_sold && itemsData.least_sold.length > 0
              ? {
                  name: itemsData.least_sold[0].item_name || itemsData.least_sold[0].name,
                  soldCount: parseInt(itemsData.least_sold[0].total_quantity || itemsData.least_sold[0].quantity_sold || '0'),
                  category: itemsData.least_sold[0].category?.[0] || 'Unknown',
                  image: itemsData.least_sold[0].image_url,
                }
              : null,
            mostSoldCategory: null, // API doesn't provide category breakdown
            leastSoldCategory: null,
          };

          console.log('✅ Dashboard data loaded from API successfully');
          console.log('📊 Final Dashboard Data:', {
            totalSales: data.totalSales,
            totalBills: data.totalBills,
            avgBillValue: data.avgBillValue,
            gstBills: data.gstBills,
            nonGstBills: data.nonGstBills,
            totalTaxCollected: data.totalTaxCollected,
          });
          
          setDashboardData(data);
          
          // ONLINE-FIRST: No need to save to local, using live API data
          console.log('💾 Using live API data (online-first mode)');
          return;
        } catch (apiError: any) {
          console.error('❌ Dashboard API error:', apiError);
          console.error('Error details:', {
            message: apiError.message,
            response: apiError.response?.data,
            status: apiError.response?.status,
            config: {
              url: apiError.config?.url,
              method: apiError.config?.method,
              headers: apiError.config?.headers,
            },
          });
          console.warn('⚠️ ONLINE-FIRST: API failed, falling back to local data');
          // Fall through to local calculation
        }
      }

      // FALLBACK: Local calculation (offline or API failed)
      console.log('📴 Loading dashboard data from local storage (fallback)...');
      const allBills = await getBills();
      
      // Filter bills by date range
      const filteredBills = allBills.filter(bill => {
        const billDate = new Date(bill.created_at || bill.bill_date || bill.created_at);
        return billDate >= dateRange.start && billDate <= dateRange.end;
      });

      // Load items and categories for product analysis
      const allItems = await getItems();
      const allCategories = await getCategories();

      // Calculate dashboard metrics
      const data = calculateDashboardMetrics(filteredBills, allItems, allCategories);
      
      setDashboardData(data);
    } catch (error) {
      console.error('Failed to load dashboard data:', error);
      // Set empty data on error
      setDashboardData({
        totalSales: 0,
        totalBills: 0,
        avgBillValue: 0,
        gstBills: 0,
        nonGstBills: 0,
        totalTaxCollected: 0,
        paymentSplit: {
          cash: { count: 0, amount: 0 },
          upi: { count: 0, amount: 0 },
          card: { count: 0, amount: 0 },
          credit: { count: 0, amount: 0 },
          other: { count: 0, amount: 0 },
        },
        pendingPayments: 0,
        mostSoldProduct: null,
        leastSoldProduct: null,
        mostSoldCategory: null,
        leastSoldCategory: null,
      });
    } finally {
      setIsLoading(false);
    }
  };

  const calculateDashboardMetrics = (
    bills: any[],
    items: any[],
    categories: any[]
  ): DashboardData => {
    // Total sales
    const totalSales = bills.reduce((sum, bill) => sum + (bill.total_amount || 0), 0);
    
    // Total bills
    const totalBills = bills.length;
    
    // Average bill value
    const avgBillValue = totalBills > 0 ? Math.round(totalSales / totalBills) : 0;

    // GST vs Non-GST bills
    const gstBills = bills.filter(bill => bill.billing_mode === 'gst').length;
    const nonGstBills = bills.filter(bill => bill.billing_mode === 'non_gst').length;

    // Total tax collected
    const totalTaxCollected = bills.reduce((sum, bill) => sum + (bill.total_tax || 0), 0);

    // Payment split
    const paymentSplit: DashboardData['paymentSplit'] = {
      cash: { count: 0, amount: 0 },
      upi: { count: 0, amount: 0 },
      card: { count: 0, amount: 0 },
      credit: { count: 0, amount: 0 },
      other: { count: 0, amount: 0 },
    };

    bills.forEach(bill => {
      const mode = (bill.payment_mode || 'cash').toLowerCase() as keyof typeof paymentSplit;
      if (mode in paymentSplit) {
        paymentSplit[mode].count++;
        paymentSplit[mode].amount += bill.total_amount || 0;
      } else {
        paymentSplit.other.count++;
        paymentSplit.other.amount += bill.total_amount || 0;
      }
    });

    // Pending payments (credit bills)
    const pendingPayments = paymentSplit.credit.amount;
    
    // Track product sales
    const productSales: { [key: string]: { name: string; count: number; categoryId: string; itemData: any } } = {};
    
    // Track category sales
    const categorySales: { [key: string]: number } = {};

    bills.forEach(bill => {
      try {
        const billItems = JSON.parse(bill.items || '[]');
        
        billItems.forEach((item: any) => {
          const itemId = item.id;
          const quantity = item.quantity || 0;
          
          // Track product sales
          if (!productSales[itemId]) {
            const itemData = items.find(i => i.id === itemId);
            productSales[itemId] = {
              name: item.name,
              count: 0,
              categoryId: itemData?.category_ids?.[0] || '',
              itemData,
            };
          }
          productSales[itemId].count += quantity;
          
          // Track category sales
          const itemData = items.find(i => i.id === itemId);
          if (itemData && itemData.category_ids && itemData.category_ids.length > 0) {
            const categoryId = itemData.category_ids[0];
            categorySales[categoryId] = (categorySales[categoryId] || 0) + quantity;
          }
        });
      } catch (error) {
        console.error('Error parsing bill items:', error);
      }
    });

    // Find most/least sold products
    const productEntries = Object.entries(productSales);
    let mostSoldProduct = null;
    let leastSoldProduct = null;

    if (productEntries.length > 0) {
      const sortedProducts = productEntries.sort((a, b) => b[1].count - a[1].count);
      
      const mostSold = sortedProducts[0][1];
      const category = categories.find(c => c.id === mostSold.categoryId);
      mostSoldProduct = {
        name: mostSold.name,
        soldCount: mostSold.count,
        category: category?.name || 'Uncategorized',
      };

      const leastSold = sortedProducts[sortedProducts.length - 1][1];
      const leastCategory = categories.find(c => c.id === leastSold.categoryId);
      leastSoldProduct = {
        name: leastSold.name,
        soldCount: leastSold.count,
        category: leastCategory?.name || 'Uncategorized',
      };
    }

    // Find most/least sold categories
    const categoryEntries = Object.entries(categorySales);
    let mostSoldCategory = null;
    let leastSoldCategory = null;

    if (categoryEntries.length > 0) {
      const sortedCategories = categoryEntries.sort((a, b) => b[1] - a[1]);
      
      const mostCat = categories.find(c => c.id === sortedCategories[0][0]);
      if (mostCat) {
        mostSoldCategory = {
          name: mostCat.name,
          itemsSold: sortedCategories[0][1],
        };
      }

      const leastCat = categories.find(c => c.id === sortedCategories[sortedCategories.length - 1][0]);
      if (leastCat) {
        leastSoldCategory = {
          name: leastCat.name,
          itemsSold: sortedCategories[sortedCategories.length - 1][1],
        };
      }
    }

    return {
      totalSales,
      totalBills,
      avgBillValue,
      gstBills,
      nonGstBills,
      totalTaxCollected,
      paymentSplit,
      pendingPayments,
      mostSoldProduct,
      leastSoldProduct,
      mostSoldCategory,
      leastSoldCategory,
    };
  };

  const handleRangeSelect = (range: DateRange) => {
    setSelectedRange(range);
    setShowCustomInput(range === 'custom');

    if (range !== 'custom') {
      loadDashboardData(range);
    } else {
      // Clear custom days when switching to custom
      setCustomDays('');
    }
  };

  const handleApplyCustomRange = () => {
    if (customDays && parseInt(customDays) > 0) {
      loadDashboardData('custom', customDays);
    }
  };

  const handleDownloadSummary = () => {
    navigation.navigate('SelectSummaryDate');
  };

  const handleViewGSTBills = () => {
    const dateRange = calculateDateRange(selectedRange, customDays ? parseInt(customDays) : undefined);
    navigation.navigate('BillHistory', {
      filterType: 'gst',
      startDate: dateRange.start.toISOString(),
      endDate: dateRange.end.toISOString(),
      title: 'GST Bills',
    });
  };

  const handleViewNonGSTBills = () => {
    const dateRange = calculateDateRange(selectedRange, customDays ? parseInt(customDays) : undefined);
    navigation.navigate('BillHistory', {
      filterType: 'non_gst',
      startDate: dateRange.start.toISOString(),
      endDate: dateRange.end.toISOString(),
      title: 'Non-GST Bills',
    });
  };

  const handleViewAllBills = () => {
    const dateRange = calculateDateRange(selectedRange, customDays ? parseInt(customDays) : undefined);
    navigation.navigate('BillHistory', {
      filterType: 'all',
      startDate: dateRange.start.toISOString(),
      endDate: dateRange.end.toISOString(),
      title: 'All Bills',
    });
  };

  const getDateRangeText = () => {
    if (selectedRange === 'custom' && customDays) {
      return `Showing data for last ${customDays} days`;
    }
    return '';
  };

  const hasData = selectedRange !== 'custom' || (selectedRange === 'custom' && customDays && !isLoading);

  if (isLoading) {
    return (
      <View style={[styles.container, styles.loadingContainer]}>
        <ActivityIndicator size="large" color="#C62828" />
        <Text style={styles.loadingText}>Loading dashboard...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

      {/* Header */}
      <Animated.View
        style={[
          styles.header,
          {
            opacity: fadeAnim,
            transform: [{ translateY: slideAnim }],
          },
        ]}
      >
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
          activeOpacity={0.7}
        >
          <Text style={styles.backArrow}>←</Text>
          <Text style={styles.backText}>Back</Text>
        </TouchableOpacity>

        <Text style={styles.title}>Dashboard</Text>
      </Animated.View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Date Range Card */}
        <Animated.View
          style={[
            styles.card,
            {
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }],
            },
          ]}
        >
          <Text style={styles.cardTitle}>Date Range</Text>

          <View style={styles.dateButtonsGrid}>
            <TouchableOpacity
              style={[
                styles.dateButton,
                selectedRange === 'today' && styles.dateButtonActive,
              ]}
              onPress={() => handleRangeSelect('today')}
              activeOpacity={0.9}
            >
              <Text
                style={[
                  styles.dateButtonText,
                  selectedRange === 'today' && styles.dateButtonTextActive,
                ]}
              >
                Today
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.dateButton,
                selectedRange === 'yesterday' && styles.dateButtonActive,
              ]}
              onPress={() => handleRangeSelect('yesterday')}
              activeOpacity={0.9}
            >
              <Text
                style={[
                  styles.dateButtonText,
                  selectedRange === 'yesterday' && styles.dateButtonTextActive,
                ]}
              >
                Yesterday
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.dateButton,
                selectedRange === 'last7days' && styles.dateButtonActive,
              ]}
              onPress={() => handleRangeSelect('last7days')}
              activeOpacity={0.9}
            >
              <Text
                style={[
                  styles.dateButtonText,
                  selectedRange === 'last7days' && styles.dateButtonTextActive,
                ]}
              >
                Last 7 Days
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.dateButton,
                selectedRange === 'custom' && styles.dateButtonActive,
              ]}
              onPress={() => handleRangeSelect('custom')}
              activeOpacity={0.9}
            >
              <Text
                style={[
                  styles.dateButtonText,
                  selectedRange === 'custom' && styles.dateButtonTextActive,
                ]}
              >
                Custom Range
              </Text>
            </TouchableOpacity>
          </View>

          {showCustomInput && (
            <View style={styles.customInputSection}>
              <View style={styles.customInputRow}>
                <View style={styles.inputContainer}>
                  <Text style={styles.inputLabel}>Enter number of days</Text>
                  <TextInput
                    style={styles.numberInput}
                    value={customDays}
                    onChangeText={setCustomDays}
                    placeholder="Enter number of days"
                    placeholderTextColor="rgba(51, 51, 51, 0.5)"
                    keyboardType="numeric"
                  />
                </View>

                <TouchableOpacity
                  style={styles.applyButton}
                  onPress={handleApplyCustomRange}
                  activeOpacity={0.9}
                >
                  <Text style={styles.applyButtonText}>Apply</Text>
                </TouchableOpacity>
              </View>

              {customDays && (
                <Text style={styles.dateRangeText}>{getDateRangeText()}</Text>
              )}
            </View>
          )}
        </Animated.View>

        {hasData ? (
          <>
            {/* Total Sales Card - Clickable */}
            <TouchableOpacity 
              style={styles.card}
              onPress={handleViewAllBills}
              activeOpacity={0.7}
            >
              <Text style={styles.cardTitle}>Total Sales</Text>
              <Text style={styles.metricValue}>₹ {dashboardData.totalSales.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</Text>
              <Text style={styles.viewDetailsText}>Tap to view all bills →</Text>
            </TouchableOpacity>

            {/* Total Bills Card - Clickable */}
            <TouchableOpacity 
              style={styles.card}
              onPress={handleViewAllBills}
              activeOpacity={0.7}
            >
              <Text style={styles.cardTitle}>Total Bills</Text>
              <Text style={styles.metricValue}>{dashboardData.totalBills} Bills</Text>
              <Text style={styles.viewDetailsText}>Tap to view all bills →</Text>
            </TouchableOpacity>

            {/* Average Bill Value Card - Clickable */}
            <TouchableOpacity 
              style={styles.card}
              onPress={handleViewAllBills}
              activeOpacity={0.7}
            >
              <Text style={styles.cardTitle}>Average Bill Value</Text>
              <Text style={styles.metricValue}>₹ {dashboardData.avgBillValue}</Text>
              <Text style={styles.viewDetailsText}>Tap to view all bills →</Text>
            </TouchableOpacity>

            {/* GST/Non-GST Bills Breakdown - Clickable */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Bills Breakdown</Text>
              <View style={styles.breakdownRow}>
                <TouchableOpacity 
                  style={styles.breakdownItem}
                  onPress={handleViewGSTBills}
                  activeOpacity={0.7}
                >
                  <Text style={styles.breakdownLabel}>GST Bills</Text>
                  <Text style={styles.breakdownValue}>{dashboardData.gstBills}</Text>
                  <Text style={styles.viewDetailsTextSmall}>View →</Text>
                </TouchableOpacity>
                <View style={styles.breakdownDivider} />
                <TouchableOpacity 
                  style={styles.breakdownItem}
                  onPress={handleViewNonGSTBills}
                  activeOpacity={0.7}
                >
                  <Text style={styles.breakdownLabel}>Non-GST Bills</Text>
                  <Text style={styles.breakdownValue}>{dashboardData.nonGstBills}</Text>
                  <Text style={styles.viewDetailsTextSmall}>View →</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Total Tax Collected - Clickable */}
            {dashboardData.totalTaxCollected > 0 && (
              <TouchableOpacity 
                style={styles.card}
                onPress={handleViewGSTBills}
                activeOpacity={0.7}
              >
                <Text style={styles.cardTitle}>Total Tax Collected</Text>
                <Text style={styles.metricValue}>₹ {dashboardData.totalTaxCollected.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</Text>
                <Text style={styles.viewDetailsText}>Tap to view GST bills →</Text>
              </TouchableOpacity>
            )}

            {/* Payment Mode Split - Clickable */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Payment Mode Split</Text>
              <Text style={[styles.metricSubtext, {marginBottom: 10}]}>Tap any payment mode to view bills</Text>
              <View style={styles.paymentGrid}>
                {dashboardData.paymentSplit.cash.amount > 0 && (
                  <TouchableOpacity 
                    style={styles.paymentItem}
                    onPress={handleViewAllBills}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.paymentMode}>Cash</Text>
                    <Text style={styles.paymentAmount}>₹ {dashboardData.paymentSplit.cash.amount.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</Text>
                    <Text style={styles.paymentCount}>{dashboardData.paymentSplit.cash.count} bills</Text>
                  </TouchableOpacity>
                )}
                {dashboardData.paymentSplit.upi.amount > 0 && (
                  <TouchableOpacity 
                    style={styles.paymentItem}
                    onPress={handleViewAllBills}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.paymentMode}>UPI</Text>
                    <Text style={styles.paymentAmount}>₹ {dashboardData.paymentSplit.upi.amount.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</Text>
                    <Text style={styles.paymentCount}>{dashboardData.paymentSplit.upi.count} bills</Text>
                  </TouchableOpacity>
                )}
                {dashboardData.paymentSplit.card.amount > 0 && (
                  <TouchableOpacity 
                    style={styles.paymentItem}
                    onPress={handleViewAllBills}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.paymentMode}>Card</Text>
                    <Text style={styles.paymentAmount}>₹ {dashboardData.paymentSplit.card.amount.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</Text>
                    <Text style={styles.paymentCount}>{dashboardData.paymentSplit.card.count} bills</Text>
                  </TouchableOpacity>
                )}
                {dashboardData.paymentSplit.credit.amount > 0 && (
                  <TouchableOpacity 
                    style={styles.paymentItem}
                    onPress={handleViewAllBills}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.paymentMode}>Credit</Text>
                    <Text style={styles.paymentAmount}>₹ {dashboardData.paymentSplit.credit.amount.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</Text>
                    <Text style={styles.paymentCount}>{dashboardData.paymentSplit.credit.count} bills</Text>
                  </TouchableOpacity>
                )}
                {dashboardData.paymentSplit.other.amount > 0 && (
                  <TouchableOpacity 
                    style={styles.paymentItem}
                    onPress={handleViewAllBills}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.paymentMode}>Other</Text>
                    <Text style={styles.paymentAmount}>₹ {dashboardData.paymentSplit.other.amount.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</Text>
                    <Text style={styles.paymentCount}>{dashboardData.paymentSplit.other.count} bills</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>

            {/* Pending Payments and Refunds - Clickable */}
            {dashboardData.pendingPayments > 0 && (
              <TouchableOpacity 
                style={[styles.card, styles.warningCard]}
                onPress={handleViewAllBills}
                activeOpacity={0.7}
              >
                <Text style={styles.cardTitle}>Pending Payments and Refunds</Text>
                <Text style={styles.metricValue}>₹ {dashboardData.pendingPayments.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</Text>
                <Text style={styles.viewDetailsText}>Tap to view all bills →</Text>
              </TouchableOpacity>
            )}

            {/* Online Orders - Coming Soon */}
            <View style={[styles.card, styles.infoCard]}>
              <Text style={styles.cardTitle}>Online Orders</Text>
              <Text style={styles.metricValue}>Coming Soon</Text>
              <Text style={styles.metricSubtext}>Online order integration is not yet available in the backend API</Text>
            </View>

            {/* Most Sold Product Card */}
            {dashboardData.mostSoldProduct && (
              <View style={styles.productCard}>
                <Text style={styles.cardTitle}>Most Sold Product</Text>
                <View style={styles.productInfo}>
                  <View style={styles.productImage}>
                    <Text style={styles.imagePlaceholder}>🍛</Text>
                  </View>
                  <View style={styles.productDetails}>
                    <Text style={styles.productName}>{dashboardData.mostSoldProduct.name}</Text>
                    <Text style={styles.productSold}>{dashboardData.mostSoldProduct.soldCount} sold</Text>
                    <Text style={styles.productCategory}>Category: {dashboardData.mostSoldProduct.category}</Text>
                  </View>
                </View>
              </View>
            )}

            {/* Least Sold Product Card */}
            {dashboardData.leastSoldProduct && (
              <View style={styles.productCard}>
                <Text style={styles.cardTitle}>Least Sold Product</Text>
                <View style={styles.productInfo}>
                  <View style={styles.productImage}>
                    <Text style={styles.imagePlaceholder}>🥘</Text>
                  </View>
                  <View style={styles.productDetails}>
                    <Text style={styles.productName}>{dashboardData.leastSoldProduct.name}</Text>
                    <Text style={styles.productSold}>{dashboardData.leastSoldProduct.soldCount} sold</Text>
                    <Text style={styles.productCategory}>Category: {dashboardData.leastSoldProduct.category}</Text>
                  </View>
                </View>
              </View>
            )}

            {/* Daily Bill Summary Card */}
            <View style={styles.summaryCard}>
              <Text style={styles.cardTitle}>Download Bill Summary</Text>
              <Text style={styles.summaryDescription}>
                Download a summary of bills for the selected date range
              </Text>
              <TouchableOpacity
                style={styles.downloadButton}
                onPress={handleDownloadSummary}
                activeOpacity={0.9}
              >
                <Text style={styles.downloadButtonText}>Download Summary</Text>
              </TouchableOpacity>
            </View>

            {/* Category Performance Card */}
            {(dashboardData.mostSoldCategory || dashboardData.leastSoldCategory) && (
              <View style={styles.categoryCard}>
                <Text style={styles.cardTitle}>Category Performance</Text>

                {dashboardData.mostSoldCategory && (
                  <View style={styles.categorySection}>
                    <Text style={styles.categoryLabel}>Most Sold Category</Text>
                    <Text style={styles.categoryName}>{dashboardData.mostSoldCategory.name}</Text>
                    <Text style={styles.categoryItems}>{dashboardData.mostSoldCategory.itemsSold} items sold</Text>
                  </View>
                )}

                {dashboardData.leastSoldCategory && (
                  <View style={styles.categorySectionBottom}>
                    <Text style={styles.categoryLabel}>Least Sold Category</Text>
                    <Text style={styles.categoryName}>{dashboardData.leastSoldCategory.name}</Text>
                    <Text style={styles.categoryItems}>{dashboardData.leastSoldCategory.itemsSold} items sold</Text>
                  </View>
                )}
              </View>
            )}

            {/* Show message if no bills */}
            {dashboardData.totalBills === 0 && (
              <View style={styles.emptyStateCard}>
                <Text style={styles.emptyStateText}>No bills found for this date range</Text>
                <Text style={styles.emptyStateSubtext}>Try selecting a different date range</Text>
              </View>
            )}
          </>
        ) : (
          <View style={styles.emptyStateCard}>
            <Text style={styles.emptyStateText}>Please enter number of days and tap Apply</Text>
            <Text style={styles.emptyStateSubtext}>Custom date range requires input</Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  loadingContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666666',
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 48,
    paddingBottom: 12,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  backArrow: {
    fontSize: 20,
    fontWeight: '600',
    color: '#C62828',
    lineHeight: 28,
  },
  backText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#C62828',
    letterSpacing: -0.31,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#333333',
    letterSpacing: 0.38,
    lineHeight: 42,
  },
  scrollContent: {
    padding: 20,
    gap: 20,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderWidth: 0.6,
    borderColor: '#E0E0E0',
    borderRadius: 16,
    padding: 21,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333333',
    letterSpacing: -0.44,
    lineHeight: 27,
    marginBottom: 16,
  },
  dateButtonsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  dateButton: {
    width: '48.5%',
    height: 44,
    backgroundColor: '#F5F5F5',
    borderWidth: 0.6,
    borderColor: '#E0E0E0',
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dateButtonActive: {
    backgroundColor: '#C62828',
    borderColor: '#C62828',
  },
  dateButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333333',
    letterSpacing: -0.31,
  },
  dateButtonTextActive: {
    color: '#FFFFFF',
  },
  customInputSection: {
    marginTop: 17,
    paddingTop: 17,
    borderTopWidth: 0.6,
    borderTopColor: '#E0E0E0',
  },
  customInputRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'flex-end',
  },
  inputContainer: {
    flex: 1,
    gap: 8,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333333',
    letterSpacing: -0.15,
    lineHeight: 20,
  },
  numberInput: {
    height: 48,
    borderWidth: 1.81,
    borderColor: '#E0E0E0',
    borderRadius: 10,
    paddingHorizontal: 16,
    fontSize: 16,
    color: '#333333',
    letterSpacing: -0.31,
  },
  applyButton: {
    width: 92,
    height: 48,
    backgroundColor: '#C62828',
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  applyButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    letterSpacing: -0.31,
  },
  dateRangeText: {
    fontSize: 15,
    color: '#999999',
    letterSpacing: -0.31,
    lineHeight: 24,
    marginTop: 8,
  },
  metricValue: {
    fontSize: 16,
    color: '#333333',
    letterSpacing: -0.31,
    lineHeight: 24,
    marginBottom: 8,
  },
  metricSubtext: {
    fontSize: 16,
    color: '#999999',
    letterSpacing: -0.31,
    lineHeight: 24,
  },
  productCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 0.6,
    borderColor: '#E0E0E0',
    borderRadius: 16,
    padding: 21,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  productInfo: {
    flexDirection: 'row',
    gap: 16,
  },
  productImage: {
    width: 80,
    height: 80,
    backgroundColor: '#F5F5F5',
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  imagePlaceholder: {
    fontSize: 40,
  },
  productDetails: {
    flex: 1,
    justifyContent: 'center',
  },
  productName: {
    fontSize: 16,
    color: '#333333',
    letterSpacing: -0.31,
    lineHeight: 24,
  },
  productSold: {
    fontSize: 16,
    color: '#999999',
    letterSpacing: -0.31,
    lineHeight: 24,
  },
  productCategory: {
    fontSize: 16,
    color: '#999999',
    letterSpacing: -0.31,
    lineHeight: 24,
  },
  summaryCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 0.6,
    borderColor: '#E0E0E0',
    borderRadius: 16,
    padding: 17,
    gap: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  summaryDescription: {
    fontSize: 15,
    color: '#999999',
    letterSpacing: -0.31,
    lineHeight: 24,
  },
  downloadButton: {
    height: 48,
    backgroundColor: '#C62828',
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  downloadButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    letterSpacing: -0.31,
  },
  categoryCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 0.6,
    borderColor: '#E0E0E0',
    borderRadius: 16,
    padding: 21,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  categorySection: {
    paddingBottom: 8,
    borderBottomWidth: 0.6,
    borderBottomColor: '#E0E0E0',
  },
  categorySectionBottom: {
    paddingTop: 8,
  },
  categoryLabel: {
    fontSize: 16,
    color: '#999999',
    letterSpacing: -0.31,
    lineHeight: 24,
  },
  categoryName: {
    fontSize: 16,
    color: '#333333',
    letterSpacing: -0.31,
    lineHeight: 24,
  },
  categoryItems: {
    fontSize: 16,
    color: '#999999',
    letterSpacing: -0.31,
    lineHeight: 24,
  },
  emptyStateCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 0.6,
    borderColor: '#E0E0E0',
    borderRadius: 16,
    padding: 32,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  emptyStateText: {
    fontSize: 15,
    color: '#999999',
    textAlign: 'center',
    letterSpacing: -0.31,
    lineHeight: 24,
  },
  emptyStateSubtext: {
    fontSize: 16,
    color: '#999999',
    textAlign: 'center',
    letterSpacing: -0.31,
    lineHeight: 24,
  },
  breakdownRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  breakdownItem: {
    flex: 1,
    alignItems: 'center',
  },
  breakdownDivider: {
    width: 1,
    height: 40,
    backgroundColor: '#E0E0E0',
    marginHorizontal: 16,
  },
  breakdownLabel: {
    fontSize: 14,
    color: '#999999',
    letterSpacing: -0.31,
    lineHeight: 20,
    marginBottom: 4,
  },
  breakdownValue: {
    fontSize: 20,
    fontWeight: '600',
    color: '#333333',
    letterSpacing: -0.31,
    lineHeight: 28,
  },
  viewDetailsText: {
    fontSize: 12,
    color: '#C62828',
    marginTop: 8,
    textAlign: 'center',
    fontWeight: '500',
  },
  viewDetailsTextSmall: {
    fontSize: 11,
    color: '#C62828',
    marginTop: 4,
    fontWeight: '500',
  },
  paymentGrid: {
    gap: 12,
  },
  paymentItem: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
  },
  paymentMode: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333333',
    letterSpacing: -0.31,
    marginBottom: 4,
  },
  paymentAmount: {
    fontSize: 18,
    fontWeight: '700',
    color: '#C62828',
    letterSpacing: -0.31,
    marginBottom: 2,
  },
  paymentCount: {
    fontSize: 12,
    color: '#999999',
    letterSpacing: -0.31,
  },
  warningCard: {
    borderColor: '#FF9800',
    borderWidth: 1,
  },
  infoCard: {
    borderColor: '#2196F3',
    borderWidth: 1,
    backgroundColor: '#E3F2FD',
  },
});

export default DashboardScreen;