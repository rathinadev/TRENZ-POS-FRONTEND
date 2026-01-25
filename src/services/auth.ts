// src/services/auth.ts
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getDatabase } from '../database/schema';
import API from './api';
import type { VendorProfile } from '../types/api.types';
import { cacheVendorLogo } from '../utils/imageCache';

const AUTH_TOKEN_KEY = '@auth_token';
const USER_DATA_KEY = '@user_data';

export interface AuthData {
  token: string;
  user_id: string;
  username: string;
  vendor_id?: string;
  business_name?: string;
  gst_no?: string;
  fssai_license?: string;
  logo_url?: string;
  footer_note?: string;
  address?: string;
  phone?: string;
}

// ==================== TOKEN MANAGEMENT ====================

export const saveAuthToken = async (token: string): Promise<void> => {
  try {
    await AsyncStorage.setItem(AUTH_TOKEN_KEY, token);
  } catch (error) {
    console.error('Failed to save auth token:', error);
    throw error;
  }
};

export const getAuthToken = async (): Promise<string | null> => {
  try {
    return await AsyncStorage.getItem(AUTH_TOKEN_KEY);
  } catch (error) {
    console.error('Failed to get auth token:', error);
    return null;
  }
};

export const removeAuthToken = async (): Promise<void> => {
  try {
    await AsyncStorage.removeItem(AUTH_TOKEN_KEY);
  } catch (error) {
    console.error('Failed to remove auth token:', error);
  }
};

// ==================== USER DATA ====================

export const saveUserData = async (userData: AuthData): Promise<void> => {
  try {
    await AsyncStorage.setItem(USER_DATA_KEY, JSON.stringify(userData));
    
    // Save to database
    const db = getDatabase();
    const now = new Date().toISOString();
    
    db.execute('DELETE FROM auth');
    
    // SQLite stores NULL for undefined/null values
    db.execute(
      `INSERT INTO auth (
        token, user_id, username, vendor_id, business_name, 
        gst_no, fssai_license, logo_url, footer_note, address, phone,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        userData.token,
        userData.user_id,
        userData.username,
        userData.vendor_id || null,
        userData.business_name || null,
        userData.gst_no || null,
        userData.fssai_license || null,
        userData.logo_url || null,
        userData.footer_note || null,
        userData.address || null,
        userData.phone || null,
        now,
        now,
      ]
    );
  } catch (error) {
    console.error('Failed to save user data:', error);
    throw error;
  }
};

export const getUserData = async (): Promise<AuthData | null> => {
  try {
    const data = await AsyncStorage.getItem(USER_DATA_KEY);
    return data ? JSON.parse(data) : null;
  } catch (error) {
    console.error('Failed to get user data:', error);
    return null;
  }
};

export const removeUserData = async (): Promise<void> => {
  try {
    await AsyncStorage.removeItem(USER_DATA_KEY);
    
    // Remove from database
    const db = getDatabase();
    db.execute('DELETE FROM auth');
    db.execute('DELETE FROM vendor_profile');
  } catch (error) {
    console.error('Failed to remove user data:', error);
  }
};

// ==================== VENDOR PROFILE ====================

export const saveVendorProfile = async (vendor: VendorProfile): Promise<void> => {
  try {
    const db = getDatabase();
    const now = new Date().toISOString();
    
    // Check if profile exists
    const existing = db.execute(
      'SELECT id FROM vendor_profile WHERE vendor_id = ?',
      [vendor.id]
    );
    
    let logoLocalPath: string | null = null;
    
    // Cache logo if URL exists
    if (vendor.logo_url) {
      try {
        logoLocalPath = await cacheVendorLogo(vendor.id, vendor.logo_url);
      } catch (error) {
        console.warn('Failed to cache vendor logo:', error);
      }
    }
    
    if (existing.rows?._array?.length > 0) {
      // Update existing profile
      db.execute(
        `UPDATE vendor_profile SET
          username = ?, email = ?, business_name = ?, address = ?, phone = ?,
          gst_no = ?, fssai_license = ?, logo_url = ?, logo_local_path = ?,
          footer_note = ?, is_approved = ?, updated_at = ?
        WHERE vendor_id = ?`,
        [
          vendor.username || null,
          vendor.email || null,
          vendor.business_name,
          vendor.address,
          vendor.phone,
          vendor.gst_no,
          vendor.fssai_license || null,
          vendor.logo_url || null,
          logoLocalPath,
          vendor.footer_note || null,
          vendor.is_approved ? 1 : 0,
          now,
          vendor.id,
        ]
      );
    } else {
      // Insert new profile
      db.execute(
        `INSERT INTO vendor_profile (
          vendor_id, username, email, business_name, address, phone,
          gst_no, fssai_license, logo_url, logo_local_path, footer_note,
          is_approved, is_synced, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          vendor.id,
          vendor.username || null,
          vendor.email || null,
          vendor.business_name,
          vendor.address,
          vendor.phone,
          vendor.gst_no,
          vendor.fssai_license || null,
          vendor.logo_url || null,
          logoLocalPath,
          vendor.footer_note || null,
          vendor.is_approved ? 1 : 0,
          1, // is_synced
          now,
          now,
        ]
      );
    }
    
    console.log('Vendor profile saved successfully');
  } catch (error) {
    console.error('Failed to save vendor profile:', error);
    throw error;
  }
};

export const getVendorProfile = async (): Promise<VendorProfile | null> => {
  try {
    const db = getDatabase();
    const result = db.execute(
      'SELECT * FROM vendor_profile ORDER BY updated_at DESC LIMIT 1'
    );
    
    const rows = result.rows?._array || [];
    if (rows.length === 0) return null;
    
    const row = rows[0];
    return {
      id: row.vendor_id,
      username: row.username,
      email: row.email,
      business_name: row.business_name,
      address: row.address,
      phone: row.phone,
      gst_no: row.gst_no,
      fssai_license: row.fssai_license,
      logo_url: row.logo_url,
      footer_note: row.footer_note,
      is_approved: row.is_approved === 1,
    };
  } catch (error) {
    console.error('Failed to get vendor profile:', error);
    return null;
  }
};

export const updateVendorProfile = async (
  data: Partial<VendorProfile> | FormData
): Promise<VendorProfile> => {
  try {
    const response = await API.auth.updateProfile(data);
    
    // Save updated profile locally
    if (response.vendor) {
      await saveVendorProfile(response.vendor);
    }
    
    // Update auth data if needed
    const userData = await getUserData();
    if (userData && response.vendor) {
      await saveUserData({
        ...userData,
        business_name: response.vendor.business_name || undefined,
        gst_no: response.vendor.gst_no || undefined,
        fssai_license: response.vendor.fssai_license || undefined,
        logo_url: response.vendor.logo_url || undefined,
        footer_note: response.vendor.footer_note || undefined,
        address: response.vendor.address || undefined,
        phone: response.vendor.phone || undefined,
      });
    }
    
    return response.vendor;
  } catch (error) {
    console.error('Failed to update vendor profile:', error);
    throw error;
  }
};

// ==================== AUTH ACTIONS ====================

export const login = async (
  username: string,
  password: string
): Promise<{ success: boolean; error?: string; data?: AuthData }> => {
  try {
    const response = await API.auth.login(username, password);
    
    // API now returns vendor object with full details
    // FIX: Using '|| undefined' instead of '|| null' to satisfy TS strict checks for optional fields
    const authData: AuthData = {
      token: response.token,
      user_id: response.user_id.toString(),
      username: response.username,
      vendor_id: response.vendor?.id || undefined,
      business_name: response.vendor?.business_name || undefined,
      gst_no: response.vendor?.gst_no || undefined,
      fssai_license: response.vendor?.fssai_license || undefined,
      logo_url: response.vendor?.logo_url || undefined,
      footer_note: response.vendor?.footer_note || undefined,
      address: response.vendor?.address || undefined,
      phone: response.vendor?.phone || undefined,
    };
    
    await saveAuthToken(response.token);
    await saveUserData(authData);
    
    // Save vendor profile if available
    if (response.vendor) {
      await saveVendorProfile(response.vendor);
    }
    
    return { success: true, data: authData };
  } catch (error: any) {
    console.error('Login failed:', error);
    
    let errorMessage = 'Login failed. Please try again.';
    
    if (error.response) {
      if (error.response.status === 403) {
        errorMessage = 'Your vendor account is pending approval. Please wait for admin approval.';
      } else if (error.response.status === 401) {
        errorMessage = 'Invalid username or password.';
      } else if (error.response.data?.error) {
        errorMessage = error.response.data.error;
      } else if (error.response.data?.message) {
        errorMessage = error.response.data.message;
      }
    } else if (error.message) {
      errorMessage = error.message;
    }
    
    return { success: false, error: errorMessage };
  }
};

export const logout = async (): Promise<void> => {
  try {
    // Try to logout on server (don't throw if it fails - might be offline)
    try {
      await API.auth.logout();
    } catch (error) {
      console.log('Server logout failed (might be offline)');
    }
    
    // Clear local data
    await removeAuthToken();
    await removeUserData();
    
    console.log('Logged out successfully');
  } catch (error) {
    console.error('Logout failed:', error);
    throw error;
  }
};

export const register = async (data: {
  username: string;
  email?: string; // Optional field
  password: string;
  password_confirm: string;
  business_name: string;
  phone: string;
  address: string;
  gst_no?: string; // Optional field
  fssai_license?: string;
}): Promise<{ success: boolean; error?: string; message?: string }> => {
  try {
    const response = await API.auth.register(data);
    
    return {
      success: true,
      message: response.message || 'Registration successful. Your vendor account is pending approval. Please wait for admin approval.',
    };
  } catch (error: any) {
    console.error('Registration failed:', error);
    
    let errorMessage = 'Registration failed. Please try again.';
    
    if (error.response?.data) {
      if (error.response.data.details) {
        // Validation errors - format nicely
        const details = error.response.data.details;
        const errors = Object.entries(details)
          .map(([field, messages]: [string, any]) => {
            const fieldName = field.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase());
            const msgs = Array.isArray(messages) ? messages : [messages];
            return `${fieldName}: ${msgs.join(', ')}`;
          })
          .join('\n');
        errorMessage = errors;
      } else if (error.response.data.error) {
        errorMessage = error.response.data.error;
      }
    } else if (error.message) {
      errorMessage = error.message;
    }
    
    return { success: false, error: errorMessage };
  }
};

export const isAuthenticated = async (): Promise<boolean> => {
  const token = await getAuthToken();
  return token !== null;
};

export const checkAuthStatus = async (): Promise<{
  isAuthenticated: boolean;
  userData: AuthData | null;
}> => {
  const token = await getAuthToken();
  const userData = await getUserData();
  
  return {
    isAuthenticated: token !== null,
    userData,
  };
};

// ==================== PASSWORD RESET ====================

export const forgotPassword = async (data: {
  username: string;
  gst_no: string;
}): Promise<{
  success: boolean;
  error?: string;
  data?: { username: string; gst_no: string; business_name: string };
}> => {
  try {
    const response = await API.auth.forgotPassword(data);
    
    return {
      success: true,
      data: {
        username: response.username,
        gst_no: response.gst_no,
        business_name: response.business_name,
      },
    };
  } catch (error: any) {
    console.error('Forgot password failed:', error);
    
    let errorMessage = 'Verification failed. Please try again.';
    
    if (error.response?.data) {
      if (error.response.data.details?.non_field_errors) {
        errorMessage = error.response.data.details.non_field_errors[0];
      } else if (error.response.data.error) {
        errorMessage = error.response.data.error;
      }
    } else if (error.message) {
      errorMessage = error.message;
    }
    
    return { success: false, error: errorMessage };
  }
};

export const resetPassword = async (data: {
  username: string;
  gst_no: string;
  new_password: string;
  new_password_confirm: string;
}): Promise<{ success: boolean; error?: string; message?: string }> => {
  try {
    const response = await API.auth.resetPassword(data);
    
    return {
      success: true,
      message: response.message || 'Password reset successful. You can now login with your new password.',
    };
  } catch (error: any) {
    console.error('Password reset failed:', error);
    
    let errorMessage = 'Password reset failed. Please try again.';
    
    if (error.response?.data) {
      if (error.response.data.details) {
        // Format validation errors
        const details = error.response.data.details;
        const errors = Object.entries(details)
          .map(([field, messages]: [string, any]) => {
            const msgs = Array.isArray(messages) ? messages : [messages];
            return msgs.join(', ');
          })
          .join('\n');
        errorMessage = errors;
      } else if (error.response.data.error) {
        errorMessage = error.response.data.error;
      }
    } else if (error.message) {
      errorMessage = error.message;
    }
    
    return { success: false, error: errorMessage };
  }
};

export default {
  login,
  logout,
  register,
  forgotPassword,
  resetPassword,
  isAuthenticated,
  checkAuthStatus,
  saveAuthToken,
  getAuthToken,
  removeAuthToken,
  saveUserData,
  getUserData,
  removeUserData,
  saveVendorProfile,
  getVendorProfile,
  updateVendorProfile,
};