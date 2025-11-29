const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

export const api = {
  customers: {
    getAll: async () => {
      const response = await fetch(`${API_BASE_URL}/api/customers`);
      if (!response.ok) {
        throw new Error('Failed to fetch customers');
      }
      const data = await response.json();
      return data.data || data; // Handle both response structures
    },
    getById: async (id: string) => {
      const response = await fetch(`${API_BASE_URL}/api/customers/${id}`);
      if (!response.ok) {
        throw new Error('Failed to fetch customer');
      }
      const data = await response.json();
      return data.data || data; // Handle both response structures
    },
    create: async (data: { name: string; email?: string; phone?: string }) => {
      const response = await fetch(`${API_BASE_URL}/api/customers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to create customer');
      }
      const result = await response.json();
      return result.data || result; // Handle both response structures
    },
    update: async (id: string, data: { name?: string; email?: string; phone?: string }) => {
      const response = await fetch(`${API_BASE_URL}/api/customers/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to update customer');
      }
      const result = await response.json();
      return result.data || result; // Handle both response structures
    },
    delete: async (id: string) => {
      const response = await fetch(`${API_BASE_URL}/api/customers/${id}`, {
        method: 'DELETE',
      });
      if (!response.ok) {
        const error = await response.json().catch(() => ({ message: 'Failed to delete customer' }));
        throw new Error(error.message || 'Failed to delete customer');
      }
      return;
    },
  },
  products: {
    getAll: async () => {
      const response = await fetch(`${API_BASE_URL}/api/products`);
      if (!response.ok) {
        throw new Error('Failed to fetch products');
      }
      const data = await response.json();
      // Your backend returns { success: true, data: [...], count: number }
      return data.data || data; // Extract products array from data property
    },
    getById: async (id: string) => {
      const response = await fetch(`${API_BASE_URL}/api/products/${id}`);
      if (!response.ok) {
        throw new Error('Failed to fetch product');
      }
      const data = await response.json();
      return data.data || data; // Handle both response structures
    },
    create: async (data: { name: string; price: number; stock: number; description?: string }) => {
      const response = await fetch(`${API_BASE_URL}/api/products`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to create product');
      }
      const result = await response.json();
      return result.data || result; // Handle both response structures
    },
    update: async (id: string, data: { name?: string; price?: number; stock?: number; description?: string }) => {
      const response = await fetch(`${API_BASE_URL}/api/products/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to update product');
      }
      const result = await response.json();
      return result.data || result; // Handle both response structures
    },
    delete: async (id: string) => {
      const response = await fetch(`${API_BASE_URL}/api/products/${id}`, {
        method: 'DELETE',
      });
      if (!response.ok) {
        const error = await response.json().catch(() => ({ message: 'Failed to delete product' }));
        throw new Error(error.message || 'Failed to delete product');
      }
      return;
    },
  },
  orders: {
    getAll: async () => {
      const response = await fetch(`${API_BASE_URL}/api/orders`);
      if (!response.ok) {
        throw new Error('Failed to fetch orders');
      }
      const data = await response.json();
      return data.data || data; // Handle both response structures
    },
    getById: async (id: string) => {
      const response = await fetch(`${API_BASE_URL}/api/orders/${id}`);
      if (!response.ok) {
        throw new Error('Failed to fetch order');
      }
      const data = await response.json();
      return data.data || data; // Handle both response structures
    },
    create: async (data: { customerId?: string | null; items: Array<{ productId: string; qty: number }> }) => {
      const response = await fetch(`${API_BASE_URL}/api/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to create order');
      }
      const result = await response.json();
      return result.data || result; // Handle both response structures
    },
    update: async (id: string, data: { customerId?: string | null; items?: Array<{ productId: string; qty: number }> }) => {
      const response = await fetch(`${API_BASE_URL}/api/orders/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to update order');
      }
      const result = await response.json();
      return result.data || result; // Handle both response structures
    },
    delete: async (id: string) => {
      const response = await fetch(`${API_BASE_URL}/api/orders/${id}`, {
        method: 'DELETE',
      });
      if (!response.ok) {
        const error = await response.json().catch(() => ({ message: 'Failed to delete order' }));
        throw new Error(error.message || 'Failed to delete order');
      }
      return;
    },
  },
};