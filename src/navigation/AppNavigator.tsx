import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types/business.types';

// Existing screens
import SplashScreen from '../screens/SplashScreen';
import WelcomeScreen from '../screens/WelcomeScreen';
import LoginScreen from '../screens/LoginScreen';
import SignupScreen from '../screens/SignupScreen';
import SetupSuccessScreen from '../screens/SuccessScreen';
import SetupFailureScreen from '../screens/FailureScreen';
import ModeSelectionScreen from '../screens/ModeSelectionScreen';

// Dashboard Screens
import DashboardScreen from '../screens/DashboardScreen';
import DownloadingSummaryScreen from '../screens/DownloadingSummaryScreen';
import BillSummaryScreen from '../screens/BillSummaryScreen';
import SaveSuccessScreen from '../screens/SaveSuccessScreen';
import SelectSummaryDateScreen from '../screens/SelectSummaryDateScreen';
import BillHistoryScreen from '../screens/BillHistoryScreen';

// Billing screens
import BillingScreen from '../screens/BillingScreen';
import CheckoutScreen from '../screens/CheckoutScreen';
import BillSuccessScreen from '../screens/BillSuccessScreen';

// Admin screens
import AdminPinScreen from '../screens/AdminPinScreen';
import AdminDashboardScreen from '../screens/AdminDashboardScreen';
import ItemManagementScreen from '../screens/ItemManagementScreen';
import AddItemScreen from '../screens/AddItemScreen';
import EditItemScreen from '../screens/EditItemScreen';
import BillFormatScreen from '../screens/BillFormatScreen';
import BusinessDetailsScreen from '../screens/BusinessDetailsScreen';
import InvoiceFormatScreen from '../screens/InvoiceFormatScreen';
import InvoiceStructureScreen from '../screens/InvoiceStructureScreen';
import LogoUploadScreen from '../screens/LogoUploadScreen';
import FooterNoteScreen from '../screens/FooterNoteScreen';
import BillNumberingScreen from '../screens/BillNumberingScreen';
import GSTSettingsScreen from '../screens/GSTSettingsScreen';
import PrinterSetupScreen from '../screens/PrinterSetupScreen';
import TestPrintPreviewScreen from '../screens/TestPrintPreviewScreen';
import AddPeopleScreen from '../screens/AddPeopleScreen';
import BackupDataScreen from '../screens/BackupDataScreen';
import BackupDetailsScreen from '../screens/BackupDetailsScreen';
import BackupCompleteScreen from '../screens/BackupCompleteScreen';
import BackingUpScreen from '../screens/BackingUpScreen';
import ExportBillsScreen from '../screens/ExportBillsScreen';
import ExportSuccessScreen from '../screens/ExportSuccessScreen';
import BillPreviewScreen from '../screens/BillPreviewScreen';
import BillScannerScreen from '../screens/BillScannerScreen';
import ExportingBillsScreen from '../screens/ExportingBillsScreen';
import RestoreDataScreen from '../screens/RestoreDataScreen';
import RestoringDataScreen from '../screens/RestoringDataScreen';
import RestoreSuccessScreen from '../screens/RestoreSuccessScreen';
import SetAdminPinScreen from '../screens/SetAdminPinScreen';

// ==================== NEW: INVENTORY SCREEN ====================
import InventoryManagementScreen from '../screens/InventoryManagementScreen';
// ==================== END NEW ====================

const Stack = createNativeStackNavigator<RootStackParamList>();

const AppNavigator: React.FC = () => {
  return (
    <Stack.Navigator
      initialRouteName="Splash"
      screenOptions={{
        headerShown: false,
        animation: 'fade',
      }}
    >
      {/* Existing screens */}
      <Stack.Screen name="Splash" component={SplashScreen} />
      <Stack.Screen
        name="Welcome"
        component={WelcomeScreen}
        options={{ animation: 'slide_from_right' }}
      />
      <Stack.Screen
        name="Login"
        component={LoginScreen}
        options={{ animation: 'slide_from_right' }}
      />
      <Stack.Screen
        name="Signup"
        component={SignupScreen}
        options={{ animation: 'slide_from_right' }}
      />
      <Stack.Screen
        name="SetupSuccess"
        component={SetupSuccessScreen}
        options={{ animation: 'fade' }}
      />
      <Stack.Screen
        name="SetupFailure"
        component={SetupFailureScreen}
        options={{ animation: 'fade' }}
      />
      <Stack.Screen
        name="ModeSelection"
        component={ModeSelectionScreen}
        options={{ animation: 'fade' }}
      />

      {/* Billing screens */}
      <Stack.Screen
        name="Billing"
        component={BillingScreen}
        options={{ animation: 'slide_from_right', animationDuration: 300 }}
      />
      <Stack.Screen
        name="Checkout"
        component={CheckoutScreen}
        options={{ animation: 'slide_from_right', animationDuration: 300 }}
      />
      <Stack.Screen
        name="BillSuccess"
        component={BillSuccessScreen}
        options={{ animation: 'slide_from_right', animationDuration: 300 }}
      />
      <Stack.Screen 
        name="Dashboard" 
        component={DashboardScreen}
        options={{ animation: 'slide_from_right', animationDuration: 300 }}
      />
      <Stack.Screen 
        name="SelectSummaryDate" 
        component={SelectSummaryDateScreen}
        options={{ animation: 'slide_from_right', animationDuration: 300 }}
      />
      <Stack.Screen 
        name="DownloadingSummary" 
        component={DownloadingSummaryScreen}
        options={{ animation: 'slide_from_right', animationDuration: 300 }}
      />
      <Stack.Screen 
        name="BillSummary" 
        component={BillSummaryScreen}
        options={{ animation: 'slide_from_right', animationDuration: 300 }}
      />
      <Stack.Screen 
        name="SaveSuccess" 
        component={SaveSuccessScreen}
        options={{ animation: 'slide_from_right', animationDuration: 300 }}
      />
      <Stack.Screen 
        name="BillHistory" 
        component={BillHistoryScreen}
        options={{ animation: 'slide_from_right', animationDuration: 300 }}
      />

      {/* Admin screens */}
      <Stack.Screen
        name="AdminPin"
        component={AdminPinScreen}
        options={{ animation: 'slide_from_right', animationDuration: 300 }}
      />
      <Stack.Screen
        name="AdminDashboard"
        component={AdminDashboardScreen}
        options={{ animation: 'fade', animationDuration: 300 }}
      />
      <Stack.Screen
        name="ItemManagement"
        component={ItemManagementScreen}
        options={{ animation: 'slide_from_right', animationDuration: 300 }}
      />
      <Stack.Screen 
        name="AddItem" 
        component={AddItemScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen 
        name="EditItem" 
        component={EditItemScreen}
        options={{ headerShown: false }}
      />
      
      {/* ==================== NEW: INVENTORY MANAGEMENT ==================== */}
      <Stack.Screen 
        name="InventoryManagement" 
        component={InventoryManagementScreen}
        options={{ animation: 'slide_from_right', animationDuration: 300 }}
      />
      {/* ==================== END NEW ==================== */}
      
      <Stack.Screen 
        name="BillFormat" 
        component={BillFormatScreen}
        options={{ animation: 'slide_from_right', animationDuration: 300 }}
      />
      <Stack.Screen 
        name="BusinessDetails" 
        component={BusinessDetailsScreen}
        options={{ animation: 'slide_from_right', animationDuration: 300 }}
      />
      <Stack.Screen 
        name="InvoiceFormat" 
        component={InvoiceFormatScreen}
        options={{ animation: 'slide_from_right', animationDuration: 300 }}
      />
      <Stack.Screen 
        name="InvoiceStructure" 
        component={InvoiceStructureScreen}
        options={{ animation: 'slide_from_right', animationDuration: 300 }}
      />
      <Stack.Screen 
        name="LogoUpload" 
        component={LogoUploadScreen}
        options={{ animation: 'slide_from_right', animationDuration: 300 }}
      />
      <Stack.Screen 
        name="FooterNote" 
        component={FooterNoteScreen}
        options={{ animation: 'slide_from_right', animationDuration: 300 }}
      />
       <Stack.Screen 
        name="BillNumbering" 
        component={BillNumberingScreen} 
        options={{ animation: 'slide_from_right', animationDuration: 300 }}
      />
      <Stack.Screen 
        name="GSTSettings" 
        component={GSTSettingsScreen}
        options={{ animation: 'slide_from_right', animationDuration: 300 }}
      />
      <Stack.Screen 
        name="PrinterSetup" 
        component={PrinterSetupScreen} 
        options={{ animation: 'slide_from_right', animationDuration: 300 }}
      />
      <Stack.Screen 
        name="TestPrintPreview" 
        component={TestPrintPreviewScreen}
        options={{ animation: 'slide_from_right', animationDuration: 300 }}
      />
      <Stack.Screen 
        name="AddPeople" 
        component={AddPeopleScreen}
        options={{ animation: 'slide_from_right', animationDuration: 300 }}
      />
      <Stack.Screen 
        name="BackupData" 
        component={BackupDataScreen} 
        options={{ animation: 'slide_from_right', animationDuration: 300 }}
      />
      <Stack.Screen 
        name="BackupDetails" 
        component={BackupDetailsScreen} 
        options={{ animation: 'slide_from_right', animationDuration: 300 }}
      />
      <Stack.Screen 
        name="BackingUp" 
        component={BackingUpScreen} 
        options={{ animation: 'slide_from_right', animationDuration: 300 }}
      />
      <Stack.Screen 
        name="BackupComplete" 
        component={BackupCompleteScreen} 
        options={{ animation: 'slide_from_right', animationDuration: 300 }}
      />
      <Stack.Screen 
        name="ExportBills" 
        component={ExportBillsScreen} 
        options={{ animation: 'slide_from_right', animationDuration: 300 }}
      />
      <Stack.Screen 
        name="BillScanner" 
        component={BillScannerScreen} 
        options={{ animation: 'slide_from_right', animationDuration: 300 }}
      />
      <Stack.Screen 
        name="BillPreview" 
        component={BillPreviewScreen} 
        options={{ animation: 'slide_from_right', animationDuration: 300 }}
      />
      <Stack.Screen 
        name="ExportingBills" 
        component={ExportingBillsScreen} 
        options={{ animation: 'slide_from_right', animationDuration: 300 }}
      />
      <Stack.Screen 
        name="ExportSuccess" 
        component={ExportSuccessScreen} 
        options={{ animation: 'slide_from_right', animationDuration: 300 }}
      />
      <Stack.Screen 
        name="RestoreData" 
        component={RestoreDataScreen}
        options={{ animation: 'slide_from_right', animationDuration: 300 }}
      />
      <Stack.Screen 
        name="RestoringData" 
        component={RestoringDataScreen}
        options={{ animation: 'slide_from_right', animationDuration: 300 }}
      />
      <Stack.Screen 
        name="RestoreSuccess" 
        component={RestoreSuccessScreen}
        options={{ animation: 'slide_from_right', animationDuration: 300 }}
      />
      <Stack.Screen 
        name="SetAdminPin" 
        component={SetAdminPinScreen} 
        options={{ animation: 'slide_from_right', animationDuration: 300 }}
      />
    </Stack.Navigator>
  );
};

export default AppNavigator;