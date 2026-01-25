// src/screens/BillHistoryScreen.tsx
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
  ScrollView,
  ActivityIndicator,
  Alert,
  TextInput,
  Modal,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';
import { RootStackParamList } from '../types/business.types';
import { Bill as APIBill, BillItem } from '../types/api.types';
import { getBills } from '../services/storage';
import API from '../services/api';
import { getNetworkStatus } from '../services/sync';

type BillHistoryScreenProps = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'BillHistory'>;
  route: RouteProp<RootStackParamList, 'BillHistory'>;
};

// Local Bill type for display (combines API and storage formats)
interface LocalBill {
  id: string;
  invoice_number: string;
  bill_number?: string;
  billing_mode: string;
  bill_date: string;
  total_amount: number;
  total_tax: number;
  payment_mode: string;
  customer_name?: string;
  customer_phone?: string;
  items: BillItem[] | string; // Can be array from API or string from local storage
  cgst_amount?: number;
  sgst_amount?: number;
  igst_amount?: number;
  subtotal: number;
  created_at?: string;
  timestamp?: string;
}

type DateFilterType = 'days' | 'weeks' | 'months' | 'years' | 'calendar';

const BillHistoryScreen: React.FC<BillHistoryScreenProps> = ({ navigation, route }) => {
  const { filterType, startDate, endDate, title } = route.params;
  
  // Initialize with dashboard's date range
  const initialStartDate = startDate ? new Date(startDate) : new Date();
  const initialEndDate = endDate ? new Date(endDate) : new Date();
  
  const [bills, setBills] = useState<LocalBill[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedBill, setSelectedBill] = useState<LocalBill | null>(null);
  const [dateFilterType, setDateFilterType] = useState<DateFilterType>('calendar'); // Start with calendar (dashboard range)
  const [filterValue, setFilterValue] = useState<string>('7');
  const [showCalendar, setShowCalendar] = useState(false);
  const [customStartDate, setCustomStartDate] = useState<Date>(initialStartDate);
  const [customEndDate, setCustomEndDate] = useState<Date>(initialEndDate);
  const [selectingStartDate, setSelectingStartDate] = useState(true);

  useEffect(() => {
    loadBills();
  }, [dateFilterType, filterValue, customStartDate, customEndDate]);

  // Convert API Bill to LocalBill format
  const convertAPIBillToLocal = (apiBill: APIBill): LocalBill => {
    return {
      id: apiBill.id,
      invoice_number: apiBill.invoice_number,
      bill_number: apiBill.bill_number,
      billing_mode: apiBill.billing_mode,
      bill_date: apiBill.bill_date,
      total_amount: apiBill.total,
      total_tax: apiBill.total_tax || 0,
      payment_mode: apiBill.payment_mode,
      customer_name: apiBill.customer_name,
      customer_phone: apiBill.customer_phone,
      items: apiBill.items,
      cgst_amount: apiBill.cgst,
      sgst_amount: apiBill.sgst,
      igst_amount: apiBill.igst,
      subtotal: apiBill.subtotal,
      created_at: apiBill.timestamp,
      timestamp: apiBill.timestamp,
    };
  };

  const calculateDateRange = () => {
    let end = new Date();
    end.setHours(23, 59, 59, 999);
    
    let start = new Date();
    start.setHours(0, 0, 0, 0);

    const value = parseInt(filterValue) || 1;

    // Apply date filter
    switch (dateFilterType) {
      case 'days':
        start = new Date();
        start.setDate(start.getDate() - value);
        start.setHours(0, 0, 0, 0);
        break;
      
      case 'weeks':
        start = new Date();
        start.setDate(start.getDate() - (value * 7));
        start.setHours(0, 0, 0, 0);
        break;
      
      case 'months':
        start = new Date();
        start.setMonth(start.getMonth() - value);
        start.setHours(0, 0, 0, 0);
        break;
      
      case 'years':
        start = new Date();
        start.setFullYear(start.getFullYear() - value);
        start.setHours(0, 0, 0, 0);
        break;
      
      case 'calendar':
        start = new Date(customStartDate);
        start.setHours(0, 0, 0, 0);
        end = new Date(customEndDate);
        end.setHours(23, 59, 59, 999);
        break;
    }

    return { start, end };
  };

  const formatDateShort = (date: Date) => {
    return date.toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  };

  const generateCalendarDays = (year: number, month: number) => {
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();
    
    const days: (Date | null)[] = [];
    
    // Add empty slots for days before the first day of month
    for (let i = 0; i < startingDayOfWeek; i++) {
      days.push(null);
    }
    
    // Add all days of the month
    for (let day = 1; day <= daysInMonth; day++) {
      days.push(new Date(year, month, day));
    }
    
    return days;
  };

  const [calendarMonth, setCalendarMonth] = useState(new Date().getMonth());
  const [calendarYear, setCalendarYear] = useState(new Date().getFullYear());

  const handleDateSelect = (date: Date) => {
    if (selectingStartDate) {
      setCustomStartDate(date);
      setSelectingStartDate(false);
    } else {
      if (date >= customStartDate) {
        setCustomEndDate(date);
        setShowCalendar(false);
        setSelectingStartDate(true);
      } else {
        Alert.alert('Invalid Date', 'End date must be after start date');
      }
    }
  };

  const renderCalendar = () => {
    const days = generateCalendarDays(calendarYear, calendarMonth);
    const monthName = new Date(calendarYear, calendarMonth).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
    
    return (
      <Modal
        visible={showCalendar}
        transparent
        animationType="slide"
        onRequestClose={() => {
          setShowCalendar(false);
          setSelectingStartDate(true);
        }}
      >
        <View style={styles.calendarOverlay}>
          <View style={styles.calendarModal}>
            {/* Calendar Header */}
            <View style={styles.calendarHeader}>
              <Text style={styles.calendarTitle}>
                {selectingStartDate ? 'Select Start Date' : 'Select End Date'}
              </Text>
              <TouchableOpacity 
                onPress={() => {
                  setShowCalendar(false);
                  setSelectingStartDate(true);
                }}
              >
                <Text style={styles.calendarClose}>✕</Text>
              </TouchableOpacity>
            </View>

            {/* Month Navigation */}
            <View style={styles.monthNavigation}>
              <TouchableOpacity 
                onPress={() => {
                  if (calendarMonth === 0) {
                    setCalendarMonth(11);
                    setCalendarYear(calendarYear - 1);
                  } else {
                    setCalendarMonth(calendarMonth - 1);
                  }
                }}
                style={styles.monthButton}
              >
                <Text style={styles.monthButtonText}>←</Text>
              </TouchableOpacity>
              <Text style={styles.monthName}>{monthName}</Text>
              <TouchableOpacity 
                onPress={() => {
                  if (calendarMonth === 11) {
                    setCalendarMonth(0);
                    setCalendarYear(calendarYear + 1);
                  } else {
                    setCalendarMonth(calendarMonth + 1);
                  }
                }}
                style={styles.monthButton}
              >
                <Text style={styles.monthButtonText}>→</Text>
              </TouchableOpacity>
            </View>

            {/* Weekday Headers */}
            <View style={styles.weekdayHeaders}>
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                <Text key={day} style={styles.weekdayText}>{day}</Text>
              ))}
            </View>

            {/* Calendar Days */}
            <ScrollView style={styles.calendarScroll}>
              <View style={styles.calendarGrid}>
                {days.map((date, index) => {
                  if (!date) {
                    return <View key={`empty-${index}`} style={styles.emptyDay} />;
                  }
                  
                  const isSelected = 
                    (date.toDateString() === customStartDate.toDateString()) ||
                    (date.toDateString() === customEndDate.toDateString());
                  
                  const isInRange = 
                    date >= customStartDate && date <= customEndDate;
                  
                  const isToday = date.toDateString() === new Date().toDateString();
                  
                  return (
                    <TouchableOpacity
                      key={index}
                      style={[
                        styles.calendarDay,
                        isSelected && styles.calendarDaySelected,
                        isInRange && !isSelected && styles.calendarDayInRange,
                      ]}
                      onPress={() => handleDateSelect(date)}
                    >
                      <Text style={[
                        styles.calendarDayText,
                        isSelected && styles.calendarDayTextSelected,
                        isToday && !isSelected && styles.calendarDayTextToday,
                      ]}>
                        {date.getDate()}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </ScrollView>

            {/* Selected Range Display */}
            <View style={styles.selectedRangeContainer}>
              <View style={styles.selectedRangeRow}>
                <Text style={styles.selectedRangeLabel}>Start:</Text>
                <Text style={styles.selectedRangeValue}>{formatDateShort(customStartDate)}</Text>
              </View>
              <View style={styles.selectedRangeRow}>
                <Text style={styles.selectedRangeLabel}>End:</Text>
                <Text style={styles.selectedRangeValue}>{formatDateShort(customEndDate)}</Text>
              </View>
            </View>

            {/* Apply Button */}
            <TouchableOpacity 
              style={styles.applyButton}
              onPress={() => {
                setShowCalendar(false);
                setSelectingStartDate(true);
              }}
            >
              <Text style={styles.applyButtonText}>Apply Date Range</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    );
  };

  const loadBills = async () => {
    try {
      setIsLoading(true);
      const dateRange = calculateDateRange();

      // Check if online
      const isOnline = await getNetworkStatus();

      if (isOnline) {
        try {
          // Use API to get bills
          const params: any = {
            start_date: dateRange.start.toISOString().split('T')[0],
            end_date: dateRange.end.toISOString().split('T')[0],
          };

          if (filterType === 'gst' || filterType === 'non_gst') {
            params.billing_mode = filterType;
          }

          console.log('📥 Downloading bills from API with params:', params);
          const response = await API.bills.download(params);
          console.log('✅ Bills downloaded from API:', response.bills?.length || 0);
          
          // Convert API bills to local format
          const localBills = (response.bills || []).map(convertAPIBillToLocal);
          setBills(localBills);
        } catch (apiError: any) {
          console.error('❌ API failed, loading from local storage:', apiError.message);
          
          // Show user-friendly error message
          if (apiError.response?.status === 500) {
            Alert.alert(
              'Server Error',
              'Unable to fetch bills from server. Loading from local storage instead.\n\nPlease contact backend team to fix the /backup/sync endpoint.',
              [{ text: 'OK' }]
            );
          }
          
          loadBillsFromLocal(dateRange);
        }
      } else {
        console.log('📴 Offline - loading bills from local storage');
        loadBillsFromLocal(dateRange);
      }
    } catch (error) {
      console.error('Failed to load bills:', error);
      Alert.alert('Error', 'Failed to load bill history');
    } finally {
      setIsLoading(false);
    }
  };

  const loadBillsFromLocal = async (dateRange: { start: Date; end: Date }) => {
    try {
      const allBills = await getBills();
      const filtered = allBills.filter((bill: any) => {
        const billDate = new Date(bill.bill_date || bill.created_at || bill.timestamp);
        const matchesDate = billDate >= dateRange.start && billDate <= dateRange.end;
        
        if (filterType === 'gst') {
          return matchesDate && bill.billing_mode === 'gst';
        } else if (filterType === 'non_gst') {
          return matchesDate && bill.billing_mode === 'non_gst';
        } else if (filterType === 'all') {
          return matchesDate;
        }
        
        return matchesDate;
      });

      // Convert local bills to LocalBill format
      const localBills: LocalBill[] = filtered.map((bill: any) => ({
        id: bill.id,
        invoice_number: bill.invoice_number,
        bill_number: bill.bill_number,
        billing_mode: bill.billing_mode,
        bill_date: bill.bill_date,
        total_amount: bill.total_amount || bill.total || 0,
        total_tax: bill.total_tax || 0,
        payment_mode: bill.payment_mode,
        customer_name: bill.customer_name,
        customer_phone: bill.customer_phone,
        items: bill.items, // Can be string or array
        cgst_amount: bill.cgst_amount || bill.cgst,
        sgst_amount: bill.sgst_amount || bill.sgst,
        igst_amount: bill.igst_amount || bill.igst,
        subtotal: bill.subtotal,
        created_at: bill.created_at || bill.timestamp,
        timestamp: bill.timestamp || bill.created_at,
      }));

      setBills(localBills);
    } catch (error) {
      console.error('Failed to load local bills:', error);
      setBills([]);
    }
  };

  const formatDate = (dateString: string | undefined) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  };

  const formatTime = (dateString: string | undefined) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleTimeString('en-IN', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const parseItems = (itemsData: BillItem[] | string): BillItem[] => {
    try {
      // If it's already an array, return it
      if (Array.isArray(itemsData)) {
        return itemsData;
      }
      // If it's a string, parse it
      return JSON.parse(itemsData);
    } catch {
      return [];
    }
  };

  // Group bills by date and sort (latest first)
  const groupBillsByDate = () => {
    // Sort bills by date (latest first)
    const sortedBills = [...bills].sort((a, b) => {
      const dateA = new Date(a.bill_date || a.created_at || a.timestamp || 0);
      const dateB = new Date(b.bill_date || b.created_at || b.timestamp || 0);
      return dateB.getTime() - dateA.getTime(); // Descending order (latest first)
    });

    // Group by date
    const grouped: { [key: string]: LocalBill[] } = {};
    
    sortedBills.forEach(bill => {
      const billDate = new Date(bill.bill_date || bill.created_at || bill.timestamp || 0);
      const dateKey = billDate.toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      }); // e.g., "26 Jan 2026"
      
      if (!grouped[dateKey]) {
        grouped[dateKey] = [];
      }
      grouped[dateKey].push(bill);
    });

    return grouped;
  };

  const renderBillCard = (bill: LocalBill) => {
    const items = parseItems(bill.items);
    const totalItems = items.reduce((sum: number, item: any) => sum + (item.quantity || 0), 0);

    return (
      <TouchableOpacity
        key={bill.id}
        style={styles.billCard}
        onPress={() => setSelectedBill(bill)}
        activeOpacity={0.7}
      >
        <View style={styles.billHeader}>
          <View style={styles.billHeaderLeft}>
            <Text style={styles.invoiceNumber}>{bill.invoice_number}</Text>
            <Text style={styles.billDate}>{formatDate(bill.bill_date || bill.created_at || bill.timestamp || '')}</Text>
          </View>
          <View style={styles.billHeaderRight}>
            <Text style={styles.billAmount}>₹{bill.total_amount.toFixed(2)}</Text>
            <View style={[
              styles.badge,
              bill.billing_mode === 'gst' ? styles.gstBadge : styles.nonGstBadge
            ]}>
              <Text style={[
                styles.badgeText,
                bill.billing_mode === 'gst' ? styles.gstBadgeText : styles.nonGstBadgeText
              ]}>
                {bill.billing_mode === 'gst' ? 'GST' : 'Non-GST'}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.billDetails}>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Items:</Text>
            <Text style={styles.detailValue}>{totalItems} items</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Payment:</Text>
            <Text style={styles.detailValue}>{bill.payment_mode.toUpperCase()}</Text>
          </View>
          {bill.customer_name && (
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Customer:</Text>
              <Text style={styles.detailValue}>{bill.customer_name}</Text>
            </View>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  const renderBillDetails = () => {
    if (!selectedBill) return null;

    const items = parseItems(selectedBill.items);

    return (
      <View style={styles.detailsOverlay}>
        <View style={styles.detailsModal}>
          <View style={styles.detailsHeader}>
            <Text style={styles.detailsTitle}>Bill Details</Text>
            <TouchableOpacity onPress={() => setSelectedBill(null)}>
              <Text style={styles.closeButton}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.detailsContent}>
            {/* Bill Info */}
            <View style={styles.detailsSection}>
              <Text style={styles.sectionTitle}>Bill Information</Text>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Invoice Number:</Text>
                <Text style={styles.infoValue}>{selectedBill.invoice_number}</Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Bill Number:</Text>
                <Text style={styles.infoValue}>{selectedBill.bill_number}</Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Date:</Text>
                <Text style={styles.infoValue}>
                  {formatDate(selectedBill.bill_date || selectedBill.created_at || selectedBill.timestamp || '')} {selectedBill.created_at ? formatTime(selectedBill.created_at) : selectedBill.timestamp ? formatTime(selectedBill.timestamp) : ''}
                </Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Type:</Text>
                <View style={[
                  styles.badge,
                  selectedBill.billing_mode === 'gst' ? styles.gstBadge : styles.nonGstBadge
                ]}>
                  <Text style={[
                    styles.badgeText,
                    selectedBill.billing_mode === 'gst' ? styles.gstBadgeText : styles.nonGstBadgeText
                  ]}>
                    {selectedBill.billing_mode === 'gst' ? 'GST' : 'Non-GST'}
                  </Text>
                </View>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Payment Mode:</Text>
                <Text style={styles.infoValue}>{selectedBill.payment_mode.toUpperCase()}</Text>
              </View>
              {selectedBill.customer_name && (
                <>
                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>Customer:</Text>
                    <Text style={styles.infoValue}>{selectedBill.customer_name}</Text>
                  </View>
                  {selectedBill.customer_phone && (
                    <View style={styles.infoRow}>
                      <Text style={styles.infoLabel}>Phone:</Text>
                      <Text style={styles.infoValue}>{selectedBill.customer_phone}</Text>
                    </View>
                  )}
                </>
              )}
            </View>

            {/* Items */}
            <View style={styles.detailsSection}>
              <Text style={styles.sectionTitle}>Items ({items.length})</Text>
              {items.map((item: any, index: number) => (
                <View key={index} style={styles.itemRow}>
                  <View style={styles.itemInfo}>
                    <Text style={styles.itemName}>{item.name}</Text>
                    <Text style={styles.itemQuantity}>Qty: {item.quantity}</Text>
                  </View>
                  <Text style={styles.itemPrice}>₹{item.subtotal?.toFixed(2) || '0.00'}</Text>
                </View>
              ))}
            </View>

            {/* Amounts */}
            <View style={styles.detailsSection}>
              <Text style={styles.sectionTitle}>Amount Breakdown</Text>
              <View style={styles.amountRow}>
                <Text style={styles.amountLabel}>Subtotal:</Text>
                <Text style={styles.amountValue}>₹{selectedBill.subtotal.toFixed(2)}</Text>
              </View>
              
              {selectedBill.billing_mode === 'gst' && (
                <>
                  {selectedBill.cgst_amount && selectedBill.cgst_amount > 0 && (
                    <View style={styles.amountRow}>
                      <Text style={styles.amountLabel}>CGST:</Text>
                      <Text style={styles.amountValue}>₹{selectedBill.cgst_amount.toFixed(2)}</Text>
                    </View>
                  )}
                  {selectedBill.sgst_amount && selectedBill.sgst_amount > 0 && (
                    <View style={styles.amountRow}>
                      <Text style={styles.amountLabel}>SGST:</Text>
                      <Text style={styles.amountValue}>₹{selectedBill.sgst_amount.toFixed(2)}</Text>
                    </View>
                  )}
                  {selectedBill.igst_amount && selectedBill.igst_amount > 0 && (
                    <View style={styles.amountRow}>
                      <Text style={styles.amountLabel}>IGST:</Text>
                      <Text style={styles.amountValue}>₹{selectedBill.igst_amount.toFixed(2)}</Text>
                    </View>
                  )}
                  <View style={styles.amountRow}>
                    <Text style={styles.amountLabel}>Total Tax:</Text>
                    <Text style={styles.amountValue}>₹{selectedBill.total_tax?.toFixed(2) || '0.00'}</Text>
                  </View>
                </>
              )}

              <View style={[styles.amountRow, styles.totalRow]}>
                <Text style={styles.totalLabel}>Total Amount:</Text>
                <Text style={styles.totalValue}>₹{selectedBill.total_amount.toFixed(2)}</Text>
              </View>
            </View>
          </ScrollView>
        </View>
      </View>
    );
  };

  if (isLoading) {
    return (
      <View style={[styles.container, styles.loadingContainer]}>
        <ActivityIndicator size="large" color="#C62828" />
        <Text style={styles.loadingText}>Loading bills...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
          activeOpacity={0.7}
        >
          <Text style={styles.backButtonText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{title}</Text>
        <View style={styles.headerRight} />
      </View>

      {/* Date Filter Tabs */}
      <View style={styles.filterContainer}>
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterScrollContent}
        >
          <TouchableOpacity
            style={[styles.filterTab, dateFilterType === 'days' && styles.filterTabActive]}
            onPress={() => setDateFilterType('days')}
          >
            <Text style={[styles.filterTabText, dateFilterType === 'days' && styles.filterTabTextActive]}>
              Days
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.filterTab, dateFilterType === 'weeks' && styles.filterTabActive]}
            onPress={() => setDateFilterType('weeks')}
          >
            <Text style={[styles.filterTabText, dateFilterType === 'weeks' && styles.filterTabTextActive]}>
              Weeks
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.filterTab, dateFilterType === 'months' && styles.filterTabActive]}
            onPress={() => setDateFilterType('months')}
          >
            <Text style={[styles.filterTabText, dateFilterType === 'months' && styles.filterTabTextActive]}>
              Months
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.filterTab, dateFilterType === 'years' && styles.filterTabActive]}
            onPress={() => setDateFilterType('years')}
          >
            <Text style={[styles.filterTabText, dateFilterType === 'years' && styles.filterTabTextActive]}>
              Years
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.filterTab, styles.calendarTab, dateFilterType === 'calendar' && styles.filterTabActive]}
            onPress={() => {
              setDateFilterType('calendar');
              setShowCalendar(true);
            }}
          >
            <Text style={[styles.filterTabText, dateFilterType === 'calendar' && styles.filterTabTextActive]}>
              Calendar
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </View>

      {/* Number Input for Days/Weeks/Months/Years */}
      {dateFilterType !== 'calendar' && (
        <View style={styles.inputContainer}>
          <Text style={styles.inputLabel}>
            Enter number of {dateFilterType}:
          </Text>
          <View style={styles.inputRow}>
            <TouchableOpacity
              style={styles.inputButton}
              onPress={() => {
                const val = parseInt(filterValue) || 1;
                if (val > 1) setFilterValue(String(val - 1));
              }}
            >
              <Text style={styles.inputButtonText}>−</Text>
            </TouchableOpacity>
            <TextInput
              style={styles.numberInput}
              value={filterValue}
              onChangeText={setFilterValue}
              keyboardType="numeric"
              maxLength={3}
              placeholder="1"
            />
            <TouchableOpacity
              style={styles.inputButton}
              onPress={() => {
                const val = parseInt(filterValue) || 0;
                setFilterValue(String(val + 1));
              }}
            >
              <Text style={styles.inputButtonText}>+</Text>
            </TouchableOpacity>
            <Text style={styles.resultText}>
              Last {filterValue || 1} {dateFilterType}
            </Text>
          </View>
        </View>
      )}

      {/* Calendar Selected Range Display */}
      {dateFilterType === 'calendar' && (
        <TouchableOpacity 
          style={styles.calendarRangeDisplay}
          onPress={() => setShowCalendar(true)}
        >
          <Text style={styles.calendarRangeLabel}>Selected Range:</Text>
          <Text style={styles.calendarRangeText}>
            {formatDateShort(customStartDate)} → {formatDateShort(customEndDate)}
          </Text>
          <Text style={styles.calendarRangeTap}>Tap to change</Text>
        </TouchableOpacity>
      )}

      {/* Summary */}
      <View style={styles.summary}>
        <Text style={styles.summaryText}>
          Total Bills: <Text style={styles.summaryValue}>{bills.length}</Text>
        </Text>
        <Text style={styles.summaryText}>
          Total Amount: <Text style={styles.summaryValue}>
            ₹{bills.reduce((sum, bill) => sum + bill.total_amount, 0).toFixed(2)}
          </Text>
        </Text>
      </View>

      {/* Bills List - Grouped by Date */}
      <ScrollView style={styles.billsList} showsVerticalScrollIndicator={false}>
        {bills.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No bills found</Text>
            <Text style={styles.emptySubtext}>
              {filterType === 'gst' ? 'No GST bills' : 
               filterType === 'non_gst' ? 'No Non-GST bills' : 
               'No bills'} found for the selected period
            </Text>
          </View>
        ) : (
          Object.entries(groupBillsByDate()).map(([date, dateBills]) => (
            <View key={date} style={styles.dateGroup}>
              {/* Date Header */}
              <View style={styles.dateHeader}>
                <Text style={styles.dateHeaderText}>{date}</Text>
                <Text style={styles.dateHeaderCount}>{dateBills.length} bills</Text>
              </View>
              {/* Bills for this date */}
              {dateBills.map(renderBillCard)}
            </View>
          ))
        )}
      </ScrollView>

      {/* Bill Details Modal */}
      {selectedBill && renderBillDetails()}

      {/* Calendar Modal */}
      {renderCalendar()}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 48,
    paddingBottom: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backButtonText: {
    fontSize: 28,
    color: '#333333',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333333',
  },
  headerRight: {
    width: 40,
  },
  filterContainer: {
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
    paddingVertical: 8,
  },
  filterScrollContent: {
    paddingHorizontal: 16,
    gap: 8,
  },
  filterTab: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#F5F5F5',
    marginRight: 8,
  },
  filterTabActive: {
    backgroundColor: '#C62828',
  },
  filterTabText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#666',
  },
  filterTabTextActive: {
    color: '#FFFFFF',
  },
  calendarTab: {
    paddingHorizontal: 12,
  },
  inputContainer: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
    marginBottom: 12,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  inputButton: {
    width: 40,
    height: 40,
    backgroundColor: '#C62828',
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  inputButtonText: {
    fontSize: 24,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  numberInput: {
    width: 80,
    height: 40,
    borderWidth: 2,
    borderColor: '#C62828',
    borderRadius: 8,
    textAlign: 'center',
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  resultText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '500',
    color: '#666',
    marginLeft: 8,
  },
  calendarRangeDisplay: {
    backgroundColor: '#FFF8F0',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#FFE0B2',
    borderLeftWidth: 4,
    borderLeftColor: '#FF9800',
  },
  calendarRangeLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  calendarRangeText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  calendarRangeTap: {
    fontSize: 12,
    color: '#FF9800',
    fontStyle: 'italic',
  },
  calendarOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  calendarModal: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    width: '100%',
    maxHeight: '80%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 10,
  },
  calendarHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  calendarTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  calendarClose: {
    fontSize: 28,
    color: '#666',
    padding: 4,
  },
  monthNavigation: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#F5F5F5',
  },
  monthButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  monthButtonText: {
    fontSize: 20,
    color: '#C62828',
  },
  monthName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  weekdayHeaders: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    padding: 12,
    backgroundColor: '#F5F5F5',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  weekdayText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
    width: 40,
    textAlign: 'center',
  },
  calendarScroll: {
    maxHeight: 300,
  },
  calendarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 8,
  },
  emptyDay: {
    width: '14.28%',
    aspectRatio: 1,
  },
  calendarDay: {
    width: '14.28%',
    aspectRatio: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 4,
  },
  calendarDaySelected: {
    backgroundColor: '#C62828',
    borderRadius: 8,
  },
  calendarDayInRange: {
    backgroundColor: '#FFEBEE',
    borderRadius: 4,
  },
  calendarDayText: {
    fontSize: 14,
    color: '#333',
  },
  calendarDayTextSelected: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  calendarDayTextToday: {
    color: '#C62828',
    fontWeight: '700',
  },
  selectedRangeContainer: {
    padding: 16,
    backgroundColor: '#F5F5F5',
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
  },
  selectedRangeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  selectedRangeLabel: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  selectedRangeValue: {
    fontSize: 14,
    color: '#333',
    fontWeight: '600',
  },
  applyButton: {
    backgroundColor: '#C62828',
    margin: 16,
    marginTop: 8,
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  applyButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  summary: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'space-around',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  summaryText: {
    fontSize: 14,
    color: '#666666',
  },
  summaryValue: {
    fontWeight: '600',
    color: '#333333',
  },
  billsList: {
    flex: 1,
    padding: 16,
  },
  dateGroup: {
    marginBottom: 16,
  },
  dateHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 4,
    paddingVertical: 8,
    marginBottom: 8,
  },
  dateHeaderText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#333',
  },
  dateHeaderCount: {
    fontSize: 12,
    fontWeight: '500',
    color: '#666',
    backgroundColor: '#F5F5F5',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  billCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  billHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  billHeaderLeft: {
    flex: 1,
  },
  invoiceNumber: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333333',
    marginBottom: 4,
  },
  billDate: {
    fontSize: 12,
    color: '#999999',
  },
  billHeaderRight: {
    alignItems: 'flex-end',
  },
  billAmount: {
    fontSize: 18,
    fontWeight: '700',
    color: '#C62828',
    marginBottom: 4,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  gstBadge: {
    backgroundColor: '#E8F5E9',
  },
  nonGstBadge: {
    backgroundColor: '#FFF3E0',
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  gstBadgeText: {
    color: '#2E7D32',
  },
  nonGstBadgeText: {
    color: '#E65100',
  },
  billDetails: {
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
    paddingTop: 12,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  detailLabel: {
    fontSize: 13,
    color: '#666666',
  },
  detailValue: {
    fontSize: 13,
    fontWeight: '500',
    color: '#333333',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 100,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#666666',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#999999',
    textAlign: 'center',
  },
  detailsOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  detailsModal: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    width: '100%',
    maxHeight: '80%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 10,
  },
  detailsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  detailsTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#333333',
  },
  closeButton: {
    fontSize: 24,
    color: '#666666',
    padding: 4,
  },
  detailsContent: {
    padding: 20,
  },
  detailsSection: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333333',
    marginBottom: 12,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  infoLabel: {
    fontSize: 14,
    color: '#666666',
  },
  infoValue: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333333',
  },
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  itemInfo: {
    flex: 1,
  },
  itemName: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333333',
    marginBottom: 2,
  },
  itemQuantity: {
    fontSize: 12,
    color: '#999999',
  },
  itemPrice: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333333',
  },
  amountRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  amountLabel: {
    fontSize: 14,
    color: '#666666',
  },
  amountValue: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333333',
  },
  totalRow: {
    marginTop: 8,
    paddingTop: 12,
    borderTopWidth: 2,
    borderTopColor: '#E0E0E0',
  },
  totalLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333333',
  },
  totalValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#C62828',
  },
});

export default BillHistoryScreen;
