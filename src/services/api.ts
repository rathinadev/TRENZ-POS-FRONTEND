// src/services/api.ts
import axios, { AxiosInstance } from 'axios';
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
    console.error(`❌ API Error: ${error.config?.method?.toUpperCase()} ${error.config?.url}`, {
      status: error.response?.status,
      statusText: error.response?.statusText,
      data: error.response?.data,
    });
    
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
      gst_no: string;
    }): Promise<any> => {
      const response = await apiClient.post('/auth/forgot-password', data);
      return response.data;
    },

    resetPassword: async (data: {
      username: string;
      gst_no: string;
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
      await apiClient.delete(`/items/${id}/`);
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

      // Don't set Content-Type - axios will set it with boundary automatically
      const response = await apiClient.patch(`/items/${id}/`, formData);
      return response.data;
    },

    // Create item with image (multipart/form-data)
    createWithImage: async (data: CreateItemRequest, imageUri?: string): Promise<Item> => {
      if (!imageUri) {
        return API.items.create(data);
      }

      const formData = new FormData();
      Object.entries(data).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          if (key === 'category_ids' && Array.isArray(value)) {
            value.forEach((id: string) => {
              formData.append('category_ids', id);
            });
          } else {
            formData.append(key, String(value));
          }
        }
      });

      formData.append('image', {
        uri: imageUri,
        type: 'image/jpeg',
        name: `${data.id || 'item'}.jpg`,
      } as any);

      // Don't set Content-Type - axios will set it with boundary automatically
      const response = await apiClient.post('/items/', formData);
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
      await apiClient.delete(`/inventory/${id}/`);
    },

    // Get unit types
    getUnitTypes: async (): Promise<any[]> => {
      const response = await apiClient.get('/inventory/unit-types/');
      return response.data;
    },
  },

  // ==================== BILLS / SALES BACKUP ====================
  bills: {
    // Download bills from server (for new device or sync)
    download: async (params?: BillDownloadParams): Promise<BillDownloadResponse> => {
      const response = await apiClient.get('/backup/sync', { params });
      return response.data;
    },

    // Upload/sync bills to server
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
