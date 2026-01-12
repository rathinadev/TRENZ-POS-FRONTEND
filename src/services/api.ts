// src/services/api.ts
import axios, { AxiosInstance, AxiosResponse } from 'axios';
import { getAuthToken } from './auth';

// API Configuration
const API_BASE_URL = __DEV__ 
  ? 'http://localhost:8000'  // Development
  : 'https://your-production-server.com';  // Production

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
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor - Handle errors
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      // Token expired or invalid - logout user
      console.log('Authentication failed - token invalid');
      // You can dispatch logout action here
    }
    return Promise.reject(error);
  }
);

// API Service
export const API = {
  // ==================== HEALTH ====================
  health: async (): Promise<any> => {
    const response = await apiClient.get('/health/');
    return response.data;
  },

  // ==================== AUTH ====================
  auth: {
    login: async (username: string, password: string): Promise<any> => {
      const response = await apiClient.post('/auth/login', {
        username,
        password,
      });
      return response.data;
    },

    register: async (data: {
      username: string;
      email: string;
      password: string;
      password_confirm: string;
      first_name?: string;
      last_name?: string;
      business_name?: string;
      phone?: string;
      address?: string;
    }): Promise<any> => {
      const response = await apiClient.post('/auth/register', data);
      return response.data;
    },

    logout: async (): Promise<any> => {
      const response = await apiClient.post('/auth/logout');
      return response.data;
    },
  },

  // ==================== CATEGORIES ====================
  categories: {
    getAll: async (): Promise<any[]> => {
      const response = await apiClient.get('/items/categories/');
      return response.data;
    },

    getById: async (id: string): Promise<any> => {
      const response = await apiClient.get(`/items/categories/${id}`);
      return response.data;
    },

    create: async (data: {
      id: string;
      name: string;
      description?: string;
      sort_order?: number;
    }): Promise<any> => {
      const response = await apiClient.post('/items/categories/', data);
      return response.data;
    },

    update: async (id: string, data: Partial<{
      name: string;
      description: string;
      sort_order: number;
      is_active: boolean;
    }>): Promise<any> => {
      const response = await apiClient.patch(`/items/categories/${id}`, data);
      return response.data;
    },

    delete: async (id: string): Promise<void> => {
      await apiClient.delete(`/items/categories/${id}`);
    },

    // Batch sync
    sync: async (operations: Array<{
      operation: 'create' | 'update' | 'delete';
      data?: any;
      id?: string;
      timestamp: string;
    }>): Promise<any> => {
      const response = await apiClient.post('/items/categories/sync', operations);
      return response.data;
    },
  },

  // ==================== ITEMS ====================
  items: {
    getAll: async (params?: {
      category?: string;
      search?: string;
    }): Promise<any[]> => {
      const response = await apiClient.get('/items/', { params });
      return response.data;
    },

    getById: async (id: string): Promise<any> => {
      const response = await apiClient.get(`/items/${id}`);
      return response.data;
    },

    create: async (data: {
      id: string;
      name: string;
      description?: string;
      price: number;
      stock_quantity?: number;
      sku?: string;
      barcode?: string;
      category_ids?: string[];
      sort_order?: number;
    }): Promise<any> => {
      const response = await apiClient.post('/items/', data);
      return response.data;
    },

    update: async (id: string, data: Partial<{
      name: string;
      description: string;
      price: number;
      stock_quantity: number;
      sku: string;
      barcode: string;
      category_ids: string[];
      is_active: boolean;
      sort_order: number;
    }>): Promise<any> => {
      const response = await apiClient.patch(`/items/${id}`, data);
      return response.data;
    },

    delete: async (id: string): Promise<void> => {
      await apiClient.delete(`/items/${id}`);
    },

    // Upload image
    uploadImage: async (id: string, imageUri: string): Promise<any> => {
      const formData = new FormData();
      formData.append('image', {
        uri: imageUri,
        type: 'image/jpeg',
        name: `${id}.jpg`,
      } as any);

      const response = await apiClient.patch(`/items/${id}`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      return response.data;
    },

    // Batch sync
    sync: async (operations: Array<{
      operation: 'create' | 'update' | 'delete';
      data?: any;
      id?: string;
      timestamp: string;
    }>): Promise<any> => {
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
    sync: async (bills: Array<{
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