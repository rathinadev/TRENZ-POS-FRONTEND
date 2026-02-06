// src/services/api.ts
import axios, { AxiosInstance } from 'axios';
import { Platform } from 'react-native';
import { getAuthToken } from './auth';
import type {
  VendorProfile,
  LoginResponse,
  RegisterRequest,
  Category,
  Item,
  CreateItemRequest,
  UpdateItemRequest,
  Bill,
  BillSyncRequest,
  BillDownloadParams,
  BillDownloadResponse,
  SyncOperation,
  DashboardStatsResponse,
  DashboardSalesResponse,
  DashboardItemsResponse,
  DashboardPaymentsResponse,
  DashboardTaxResponse,
  DashboardProfitResponse,
  HealthResponse,
  BillingMode,
} from '../types/api.types';

// API Configuration
const API_BASE_URL = 'http://13.233.163.98:8000';
const API_TIMEOUT = 30000; // 30 seconds

// Create axios instance
const apiClient: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: API_TIMEOUT,
  headers: {
    'Content-Type': 'application/json',
  },
  // Treat 204 No Content as success
  validateStatus: (status) => {
    return (status >= 200 && status < 300) || status === 304;
  },
  // Handle empty responses (204 No Content) properly
  transformResponse: [
    (data, headers) => {
      // If no data or empty string, return null instead of trying to parse
      if (!data || data === '') {
        return null;
      }
      // Try to parse JSON, if it fails return the data as-is
      try {
        return JSON.parse(data);
      } catch (e) {
        return data;
      }
    },
  ],
});

// Request interceptor - Add auth token
apiClient.interceptors.request.use(
  async (config) => {
    const token = await getAuthToken();
    if (token && config.headers) {
      config.headers.Authorization = `Token ${token}`;
      console.log(`🔐 API Request: ${config.method?.toUpperCase()} ${config.url}`, {
        params: config.params,
        hasToken: !!token,
        tokenPrefix: token ? token.substring(0, 10) + '...' : 'none',
      });
    } else {
      console.warn(`⚠️ API Request WITHOUT TOKEN: ${config.method?.toUpperCase()} ${config.url}`);
    }
    return config;
  },
  (error) => {
    console.error('❌ Request interceptor error:', error);
    return Promise.reject(error);
  }
);

// Response interceptor - Handle errors
apiClient.interceptors.response.use(
  (response) => {
    console.log(`✅ API Response: ${response.config.method?.toUpperCase()} ${response.config.url}`, {
      status: response.status,
      dataKeys: response.data ? Object.keys(response.data) : [],
    });
    return response;
  },
  async (error) => {
    // Handle 204 No Content as success (for DELETE operations)
    if (error.response?.status === 204) {
      console.log(`✅ API Response: ${error.config?.method?.toUpperCase()} ${error.config?.url}`, {
        status: 204,
        message: 'No Content (Success)',
      });
      return { ...error.response, data: null };
    }

    // Don't log "Network Error" for DELETE requests - this is expected for 204 responses
    const isDeleteNetworkError =
      error.config?.method?.toUpperCase() === 'DELETE' &&
      error.message === 'Network Error' &&
      !error.response;

    if (!isDeleteNetworkError) {
      console.error(`❌ API Error: ${error.config?.method?.toUpperCase()} ${error.config?.url}`, {
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data,
      });
    }

    if (error.response?.status === 401) {
      // Token expired or invalid - logout user
      console.log('🔒 Authentication failed - token invalid or expired');
      // You can dispatch logout action here
    }
    return Promise.reject(error);
  }
);

// API Service
export const API = {
  // ==================== HEALTH ====================
  health: async (): Promise<HealthResponse> => {
    const response = await apiClient.get('/health/');
    return response.data;
  },

  // ==================== AUTH ====================
  auth: {
    login: async (username: string, password: string): Promise<LoginResponse> => {
      const response = await apiClient.post('/auth/login', {
        username,
        password,
      });
      return response.data;
    },

    register: async (data: RegisterRequest): Promise<any> => {
      const response = await apiClient.post('/auth/register', data);
      return response.data;
    },

    logout: async (): Promise<any> => {
      const response = await apiClient.post('/auth/logout');
      return response.data;
    },

    forgotPassword: async (data: {
      username: string;
      phone: string;
    }): Promise<any> => {
      const response = await apiClient.post('/auth/forgot-password', data);
      return response.data;
    },

    resetPassword: async (data: {
      username: string;
      phone: string;
      new_password: string;
      new_password_confirm: string;
    }): Promise<any> => {
      const response = await apiClient.post('/auth/reset-password', data);
      return response.data;
    },

    // Get vendor profile
    getProfile: async (): Promise<VendorProfile> => {
      const response = await apiClient.get('/auth/profile');
      return response.data;
    },

    // Update vendor profile (with optional logo upload)
    updateProfile: async (data: FormData | Partial<VendorProfile>): Promise<{
      message: string;
      vendor: VendorProfile;
    }> => {
      const isFormData = data instanceof FormData;
      // Don't set Content-Type for FormData - axios will set it with boundary automatically
      const response = await apiClient.patch('/auth/profile', data, {
        headers: isFormData ? {} : { 'Content-Type': 'application/json' },
      });
      return response.data;
    },

    // ==================== VENDOR STAFF USER MANAGEMENT ====================
    // Security PIN Management
    securityPin: {
      // Set or change security PIN
      set: async (data: {
        pin: string;
        pin_confirm: string;
        old_pin?: string;
      }): Promise<{ message: string }> => {
        const response = await apiClient.post('/auth/vendor/security-pin/set', data);
        return response.data;
      },

      // Verify security PIN
      verify: async (pin: string): Promise<{
        message: string;
        verified: boolean;
      }> => {
        const response = await apiClient.post('/auth/vendor/security-pin/verify', { pin });
        return response.data;
      },

      // Check if PIN is set
      status: async (): Promise<{ has_pin: boolean }> => {
        const response = await apiClient.get('/auth/vendor/security-pin/status');
        return response.data;
      },
    },

    // Staff User Management
    staff: {
      // Create staff user
      create: async (data: {
        username: string;
        password: string;
        email?: string;
        security_pin: string;
      }): Promise<{
        message: string;
        user: {
          id: number;
          username: string;
          email: string;
          role: string;
          created_at: string;
        };
      }> => {
        const response = await apiClient.post('/auth/vendor/users/create', data);
        return response.data;
      },

      // List all vendor users (owner + staff)
      list: async (): Promise<{
        users: Array<{
          id: number;
          username: string;
          email: string;
          role: 'owner' | 'staff';
          created_at: string;
          created_by: string | null;
        }>;
      }> => {
        const response = await apiClient.get('/auth/vendor/users');
        return response.data;
      },

      // Reset staff password
      resetPassword: async (
        userId: number,
        data: {
          new_password: string;
          security_pin: string;
        }
      ): Promise<{ message: string }> => {
        const response = await apiClient.post(
          `/auth/vendor/users/${userId}/reset-password`,
          data
        );
        return response.data;
      },

      // Remove (deactivate) staff user
      remove: async (userId: number, securityPin: string): Promise<{ message: string }> => {
        const response = await apiClient.delete(`/auth/vendor/users/${userId}`, {
          params: { security_pin: securityPin },
        });
        return response.data;
      },
    },
  },

  // ==================== CATEGORIES ====================
  categories: {
    getAll: async (): Promise<Category[]> => {
      const response = await apiClient.get('/items/categories/');
      return response.data;
    },

    getById: async (id: string): Promise<Category> => {
      const response = await apiClient.get(`/items/categories/${id}/`);
      return response.data;
    },

    create: async (data: {
      id?: string;
      name: string;
      description?: string;
      sort_order?: number;
    }): Promise<Category> => {
      const response = await apiClient.post('/items/categories/', data);
      return response.data;
    },

    update: async (id: string, data: Partial<{
      name: string;
      description: string;
      sort_order: number;
      is_active: boolean;
    }>): Promise<Category> => {
      const response = await apiClient.patch(`/items/categories/${id}/`, data);
      return response.data;
    },

    delete: async (id: string): Promise<void> => {
      await apiClient.delete(`/items/categories/${id}/`);
    },

    // Batch sync
    sync: async (operations: SyncOperation[]): Promise<any> => {
      const response = await apiClient.post('/items/categories/sync', operations);
      return response.data;
    },
  },

  // ==================== ITEMS ====================
  items: {
    getAll: async (params?: {
      category?: string;
      search?: string;
      is_active?: boolean;
    }): Promise<Item[]> => {
      const response = await apiClient.get('/items/', { params });
      return response.data;
    },

    getById: async (id: string): Promise<Item> => {
      const response = await apiClient.get(`/items/${id}/`);
      return response.data;
    },

    create: async (data: CreateItemRequest): Promise<Item> => {
      const response = await apiClient.post('/items/', data);
      return response.data;
    },

    update: async (id: string, data: UpdateItemRequest): Promise<Item> => {
      const response = await apiClient.patch(`/items/${id}/`, data);
      return response.data;
    },

    delete: async (id: string): Promise<void> => {
      try {
        await apiClient.delete(`/items/${id}/`);
      } catch (error: any) {
        // React Native's XMLHttpRequest has a bug where 204 No Content responses
        // throw a "Network Error" even though the request succeeded.
        if (error.message === 'Network Error' && !error.response) {
          // Treat as success - the backend deleted it successfully
          return;
        }
        // If there's an actual error response, throw it
        throw error;
      }
    },

    // Update item status
    updateStatus: async (id: string, is_active: boolean): Promise<Item> => {
      const response = await apiClient.patch(`/items/${id}/status/`, { is_active });
      return response.data;
    },

    // Upload image (multipart/form-data)
    uploadImage: async (id: string, imageUri: string): Promise<Item> => {
      const formData = new FormData();
      formData.append('image', {
        uri: imageUri,
        type: 'image/jpeg',
        name: `${id}.jpg`,
      } as any);

      // Explicitly set Content-Type to multipart/form-data to override default json adapter
      const response = await apiClient.patch(`/items/${id}/`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      return response.data;
    },

    // Create item with image (multipart/form-data)
    createWithImage: async (data: CreateItemRequest, imageUri?: string): Promise<Item> => {
      if (!imageUri) {
        return API.items.create(data);
      }

      console.log('📦 Creating FormData with data:', data);
      console.log('🖼️ Image URI:', imageUri);

      const formData = new FormData();

      // Add all fields except category_ids
      Object.entries(data).forEach(([key, value]) => {
        if (value !== undefined && value !== null && key !== 'category_ids') {
          console.log(`  Adding field: ${key} = ${value}`);
          formData.append(key, String(value));
        }
      });

      // Add category_ids as JSON string (required by backend)
      if (data.category_ids && Array.isArray(data.category_ids)) {
        const categoryIdsJson = JSON.stringify(data.category_ids);
        console.log(`  Adding category_ids: ${categoryIdsJson}`);
        formData.append('category_ids', categoryIdsJson);
      }

      // Add image file - React Native specific format
      const filename = `item_${Date.now()}.jpg`;
      // iOS needs file:// removed, Android keeps it
      const uri = Platform.OS === 'ios' ? imageUri.replace('file://', '') : imageUri;

      // Detect file type from URI
      let type = 'image/jpeg';
      if (uri.toLowerCase().endsWith('.png')) {
        type = 'image/png';
      } else if (uri.toLowerCase().endsWith('.jpg') || uri.toLowerCase().endsWith('.jpeg')) {
        type = 'image/jpeg';
      }

      // React Native FormData expects this exact structure
      formData.append('image', {
        uri: uri,
        type: type,
        name: filename,
      } as any);

      console.log('  Adding image with URI:', uri);
      console.log('  Image type:', type);
      console.log('🚀 Sending FormData to /items/');

      // CRITICAL: For multipart/form-data in React Native:
      // 1. Don't set Content-Type (axios will add it with boundary)
      // 2. Don't transform the request
      // 3. Use default transformResponse (not our custom JSON parser)
      const response = await apiClient.post('/items/', formData, {
        headers: {
          // Remove the default Content-Type header - axios will set multipart/form-data with boundary
          'Content-Type': undefined,
        },
        transformRequest: [(data) => data], // Don't transform
        transformResponse: [(data) => {
          // Parse JSON response normally
          try {
            return JSON.parse(data);
          } catch (e) {
            return data;
          }
        }],
      });

      console.log('✅ Response received:', response.data);
      return response.data;
    },

    // Update item with image (multipart/form-data)
    updateWithImage: async (id: string, data: UpdateItemRequest, imageUri?: string): Promise<Item> => {
      if (!imageUri) {
        return API.items.update(id, data);
      }

      const formData = new FormData();

      // Add all fields except category_ids
      Object.entries(data).forEach(([key, value]) => {
        if (value !== undefined && value !== null && key !== 'category_ids') {
          formData.append(key, String(value));
        }
      });

      // Add category_ids as JSON string (required by backend)
      if (data.category_ids && Array.isArray(data.category_ids)) {
        formData.append('category_ids', JSON.stringify(data.category_ids));
      }

      // Add image file - React Native specific format
      const filename = `item_${Date.now()}.jpg`;
      // iOS needs file:// removed, Android keeps it
      const uri = Platform.OS === 'ios' ? imageUri.replace('file://', '') : imageUri;

      // Detect file type from URI
      let type = 'image/jpeg';
      if (uri.toLowerCase().endsWith('.png')) {
        type = 'image/png';
      } else if (uri.toLowerCase().endsWith('.jpg') || uri.toLowerCase().endsWith('.jpeg')) {
        type = 'image/jpeg';
      }

      formData.append('image', {
        uri: uri,
        type: type,
        name: filename,
      } as any);

      // CRITICAL: Same config as createWithImage for multipart/form-data
      const response = await apiClient.patch(`/items/${id}/`, formData, {
        headers: {
          'Content-Type': undefined,
        },
        transformRequest: [(data) => data],
        transformResponse: [(data) => {
          try {
            return JSON.parse(data);
          } catch (e) {
            return data;
          }
        }],
      });

      return response.data;
    },

    // Batch sync
    sync: async (operations: SyncOperation[]): Promise<any> => {
      const response = await apiClient.post('/items/sync', operations);
      return response.data;
    },
  },

  // ==================== INVENTORY ====================
  inventory: {
    // Get all inventory items
    getAll: async (params?: {
      is_active?: boolean;
      low_stock?: boolean;
      search?: string;
      unit_type?: string;
    }): Promise<any[]> => {
      const response = await apiClient.get('/inventory/', { params });
      return response.data;
    },

    // Get single inventory item
    getById: async (id: string): Promise<any> => {
      const response = await apiClient.get(`/inventory/${id}/`);
      return response.data;
    },

    // Create inventory item
    create: async (data: {
      name: string;
      description?: string;
      quantity: string;
      unit_type: string;
      sku?: string;
      barcode?: string;
      supplier_name?: string;
      supplier_contact?: string;
      min_stock_level?: string;
      reorder_quantity?: string;
      is_active?: boolean;
    }): Promise<any> => {
      const response = await apiClient.post('/inventory/', data);
      return response.data;
    },

    // Update inventory item
    update: async (id: string, data: Partial<{
      name: string;
      description: string;
      quantity: string;
      unit_type: string;
      sku: string;
      barcode: string;
      supplier_name: string;
      supplier_contact: string;
      min_stock_level: string;
      reorder_quantity: string;
      is_active: boolean;
    }>): Promise<any> => {
      const response = await apiClient.patch(`/inventory/${id}/`, data);
      return response.data;
    },

    // Update stock with action
    updateStock: async (id: string, data: {
      action: 'set' | 'add' | 'subtract';
      quantity: string;
      notes?: string;
    }): Promise<any> => {
      const response = await apiClient.patch(`/inventory/${id}/stock/`, data);
      return response.data;
    },

    // Delete inventory item
    delete: async (id: string): Promise<void> => {
      try {
        await apiClient.delete(`/inventory/${id}/`);
      } catch (error: any) {
        // React Native's XMLHttpRequest has a bug where 204 No Content responses
        // throw a "Network Error" even though the request succeeded.
        if (error.message === 'Network Error' && !error.response) {
          // Treat as success - the backend deleted it successfully
          return;
        }
        // If there's an actual error response, throw it
        throw error;
      }
    },

    // Get unit types
    getUnitTypes: async (): Promise<any[]> => {
      const response = await apiClient.get('/inventory/unit-types/');
      return response.data;
    },
  },

  // ==================== BILLS (Direct CRUD Operations) ====================
  bills: {
    // List bills with filtering and pagination
    list: async (params?: {
      billing_mode?: BillingMode;
      start_date?: string;
      end_date?: string;
      payment_mode?: 'cash' | 'upi' | 'card' | 'credit' | 'other';
      limit?: number;
      offset?: number;
    }): Promise<{
      count: number;
      total: number;
      offset: number;
      limit: number;
      bills: Bill[];
    }> => {
      const response = await apiClient.get('/bills/', { params });
      return response.data;
    },

    // Create new bill (server generates invoice number)
    create: async (data: {
      bill_date?: string;
      billing_mode: BillingMode;
      items_data: Array<{
        item_id?: string;
        item_name: string;
        price: string;
        mrp_price: string;
        price_type: 'exclusive' | 'inclusive';
        gst_percentage?: string;
        quantity: string;
        subtotal: string;
        item_gst_amount?: string;
        veg_nonveg?: 'veg' | 'nonveg';
      }>;
      subtotal: string;
      cgst_amount?: string;
      sgst_amount?: string;
      igst_amount?: string;
      total_tax?: string;
      total_amount: string;
      payment_mode: 'cash' | 'upi' | 'card' | 'credit' | 'other';
      amount_paid?: string;
      customer_name?: string;
      customer_phone?: string;
      payment_reference?: string;
    }): Promise<Bill> => {
      const response = await apiClient.post('/bills/', data);
      return response.data;
    },

    // Get bill details
    getById: async (id: string): Promise<Bill> => {
      const response = await apiClient.get(`/bills/${id}/`);
      return response.data;
    },

    // Update bill
    update: async (id: string, data: Partial<{
      items_data: Array<any>;
      payment_mode: string;
      payment_reference: string;
      amount_paid: string;
      customer_name: string;
      customer_phone: string;
      subtotal: string;
      total_amount: string;
    }>): Promise<Bill> => {
      const response = await apiClient.patch(`/bills/${id}/`, data);
      return response.data;
    },

    // Delete bill
    delete: async (id: string): Promise<void> => {
      await apiClient.delete(`/bills/${id}/`);
    },
  },

  // ==================== SALES BACKUP (Multi-Device Sync Only) ====================
  backup: {
    // Download bills from server (for new device or sync)
    download: async (params?: BillDownloadParams): Promise<BillDownloadResponse> => {
      const response = await apiClient.get('/backup/sync', { params });
      return response.data;
    },

    // Upload/sync existing bills to server (for multi-device sync)
    sync: async (bills: BillSyncRequest | BillSyncRequest[]): Promise<{
      synced: number;
      created: number;
      updated: number;
      skipped: number;
      message: string;
    }> => {
      const response = await apiClient.post('/backup/sync', bills);
      return response.data;
    },

    // Legacy sync method (for backward compatibility)
    syncLegacy: async (bills: Array<{
      bill_data: any;
      device_id: string;
    }> | {
      bill_data: any;
      device_id: string;
    }): Promise<any> => {
      const response = await apiClient.post('/backup/sync', bills);
      return response.data;
    },
  },

  // ==================== DASHBOARD & ANALYTICS ====================
  dashboard: {
    // Get overall statistics
    getStats: async (params?: {
      start_date?: string;
      end_date?: string;
    }): Promise<DashboardStatsResponse> => {
      const response = await apiClient.get('/dashboard/stats', { params });
      return response.data;
    },

    // Get sales analytics by billing mode
    getSales: async (params?: {
      start_date?: string;
      end_date?: string;
      billing_mode?: BillingMode;
    }): Promise<DashboardSalesResponse> => {
      const response = await apiClient.get('/dashboard/sales', { params });
      return response.data;
    },

    // Get item analytics (most/least sold)
    getItems: async (params?: {
      start_date?: string;
      end_date?: string;
      sort?: 'most_sold' | 'least_sold';
      limit?: number;
    }): Promise<DashboardItemsResponse> => {
      const response = await apiClient.get('/dashboard/items', { params });
      return response.data;
    },

    // Get payment mode analytics
    getPayments: async (params?: {
      start_date?: string;
      end_date?: string;
    }): Promise<DashboardPaymentsResponse> => {
      const response = await apiClient.get('/dashboard/payments', { params });
      return response.data;
    },

    // Get tax collection analytics
    getTax: async (params?: {
      start_date?: string;
      end_date?: string;
    }): Promise<DashboardTaxResponse> => {
      const response = await apiClient.get('/dashboard/tax', { params });
      return response.data;
    },

    // Get profit analytics
    getProfit: async (params?: {
      start_date?: string;
      end_date?: string;
    }): Promise<DashboardProfitResponse> => {
      const response = await apiClient.get('/dashboard/profit', { params });
      return response.data;
    },

    // Get pending payments and dues
    getPendingPayments: async (params?: {
      start_date?: string;
      end_date?: string;
      limit?: number;
      offset?: number;
    }): Promise<{
      total_pending: string;
      count: number;
      bills: Array<{
        id: string;
        invoice_number: string;
        customer_name: string;
        customer_phone: string;
        total_amount: string;
        amount_paid: string;
        pending_amount: string;
        bill_date: string;
        created_at: string;
      }>;
    }> => {
      const response = await apiClient.get('/dashboard/dues', { params });
      return response.data;
    },
  },

  // ==================== SETTINGS ====================
  settings: {
    push: async (data: {
      device_id: string;
      settings_data: any;
    }): Promise<any> => {
      const response = await apiClient.post('/settings/push', data);
      return response.data;
    },
  },
};

// Export axios instance for advanced usage
export { apiClient };

export default API;
