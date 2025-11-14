import { useState, useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { X, Search, Plus, Trash2, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/lib/api';

interface BackendOrder {
  id: string;
  customerId: string | null;
  total: number;
  createdAt: string;
  customer: {
    id: string;
    name: string;
    phone?: string | null;
    email?: string | null;
  } | null;
  items: Array<{
    id: string;
    orderId: string;
    productId: string;
    qty: number;
    price: number;
    product: {
      id: string;
      name: string;
      price: number;
      stock: number;
    };
  }>;
}

interface OrderFormProps {
  order?: BackendOrder | null;
  onClose: () => void;
  onSuccess?: () => void;
}

interface OrderItem {
  productId: string;
  productName: string;
  quantity: number;
  price: number;
}

const OrderForm = ({ order, onClose, onSuccess }: OrderFormProps) => {
  const queryClient = useQueryClient();
  const isEditMode = !!order;
  const [phone, setPhone] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [customer, setCustomer] = useState<any>(null);
  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
  const [selectedProduct, setSelectedProduct] = useState('');
  const [quantity, setQuantity] = useState('1');

  // Initialize form with order data if editing
  useEffect(() => {
    if (order) {
      if (order.customer) {
        setCustomer(order.customer);
        setPhone(order.customer.phone || '');
        setCustomerName(order.customer.name);
        setCustomerEmail(order.customer.email || '');
      }
      // Convert order items to form format
      const items: OrderItem[] = order.items.map((item) => ({
        productId: item.productId,
        productName: item.product.name,
        quantity: item.qty,
        price: item.price,
      }));
      setOrderItems(items);
    }
  }, [order]);

  // Fetch products
  const { data: products = [], isLoading: productsLoading } = useQuery({
    queryKey: ['products'],
    queryFn: api.products.getAll,
  });

  // Fetch customers to search
  const { data: customers = [] } = useQuery({
    queryKey: ['customers'],
    queryFn: api.customers.getAll,
  });

  // Customer lookup by phone (only when not in edit mode or phone changes manually)
  const [phoneManuallyChanged, setPhoneManuallyChanged] = useState(false);
  
  useEffect(() => {
    if (!isEditMode && phone.length === 10 && phoneManuallyChanged) {
      const foundCustomer = customers.find((c: any) => c.phone === phone);
      if (foundCustomer) {
        setCustomer(foundCustomer);
        setCustomerName(foundCustomer.name);
        setCustomerEmail(foundCustomer.email || '');
        toast.success(`Customer found: ${foundCustomer.name}`);
      } else {
        setCustomer(null);
        setCustomerName('');
        setCustomerEmail('');
        toast.info('New customer - please enter name');
      }
    } else if (!isEditMode && phone.length !== 10) {
      setCustomer(null);
      setCustomerName('');
      setCustomerEmail('');
    }
  }, [phone, customers, isEditMode, phoneManuallyChanged]);

  // Create customer mutation
  const createCustomerMutation = useMutation({
    mutationFn: api.customers.create,
  });

  // Create order mutation
  const createOrderMutation = useMutation({
    mutationFn: api.orders.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
      toast.success('Order created successfully!');
      onSuccess?.();
      onClose();
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to create order');
    },
  });

  // Update order mutation
  const updateOrderMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: { customerId?: string | null; items?: Array<{ productId: string; qty: number }> } }) =>
      api.orders.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
      toast.success('Order updated successfully!');
      onSuccess?.();
      onClose();
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to update order');
    },
  });

  const handleAddItem = () => {
    if (!selectedProduct || !quantity) {
      toast.error('Please select a product and quantity');
      return;
    }

    const product = products.find((p: any) => p.id === selectedProduct);
    if (!product) return;

    const qty = parseInt(quantity);
    if (qty <= 0) {
      toast.error('Quantity must be greater than 0');
      return;
    }

    if (product.stock < qty) {
      toast.error(`Insufficient stock. Available: ${product.stock}`);
      return;
    }

    // Check if product already in order
    const existingItem = orderItems.find((item) => item.productId === product.id);
    if (existingItem) {
      toast.error('Product already added. Remove it first to change quantity.');
      return;
    }

    const newItem: OrderItem = {
      productId: product.id,
      productName: product.name,
      quantity: qty,
      price: product.price,
    };

    setOrderItems([...orderItems, newItem]);
    setSelectedProduct('');
    setQuantity('1');
    toast.success('Item added to order');
  };

  const handleRemoveItem = (index: number) => {
    setOrderItems(orderItems.filter((_, i) => i !== index));
  };

  const calculateTotal = () => {
    return orderItems.reduce((sum, item) => sum + item.quantity * item.price, 0);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!phone || phone.length !== 10) {
      toast.error('Please enter a valid 10-digit phone number');
      return;
    }

    if (orderItems.length === 0) {
      toast.error('Please add at least one item to the order');
      return;
    }

    try {
      let customerId: string | null = null;

      // If customer not found, create new one
      if (!customer) {
        if (!customerName.trim()) {
          toast.error('Please enter customer name');
          return;
        }

        const newCustomer = await createCustomerMutation.mutateAsync({
          name: customerName,
          phone,
          email: customerEmail || undefined,
        });
        customerId = newCustomer.id;
      } else {
        customerId = customer.id;
      }

      // Create or update order
      if (isEditMode && order) {
        await updateOrderMutation.mutateAsync({
          id: order.id,
          data: {
            customerId,
            items: orderItems.map((item) => ({
              productId: item.productId,
              qty: item.quantity,
            })),
          },
        });
      } else {
        await createOrderMutation.mutateAsync({
          customerId,
          items: orderItems.map((item) => ({
            productId: item.productId,
            qty: item.quantity,
          })),
        });
      }
    } catch (error) {
      // Error handling is done in mutation onError
    }
  };

  const isLoading = createOrderMutation.isPending || updateOrderMutation.isPending || createCustomerMutation.isPending;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className="bg-card rounded-2xl shadow-medium w-full max-w-3xl max-h-[90vh] overflow-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-card border-b border-border p-4 sm:p-6 flex items-center justify-between">
          <h2 className="text-xl sm:text-2xl font-bold">
            {isEditMode ? 'Edit Order' : 'Create Order'}
          </h2>
          <Button variant="ghost" size="icon" onClick={onClose} className="rounded-xl" disabled={isLoading}>
            <X className="w-5 h-5" />
          </Button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-6">
          {/* Customer Search */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Customer Details</h3>
            <div className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor="phone">Phone Number *</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="phone"
                    type="tel"
                    value={phone}
                    onChange={(e) => {
                      setPhone(e.target.value.replace(/\D/g, '').slice(0, 10));
                      setPhoneManuallyChanged(true);
                    }}
                    placeholder="Enter 10-digit phone"
                    className="rounded-xl pl-10"
                    maxLength={10}
                    required
                    disabled={isLoading}
                  />
                </div>
              </div>
              {phone.length === 10 && customer && (
                <div className="bg-accent rounded-xl p-3 text-sm">
                  <p className="font-medium">{customer.name}</p>
                  <p className="text-muted-foreground text-xs">{customer.email || 'No email'}</p>
                  <p className="text-muted-foreground text-xs">Orders: {customer.orders?.length || 0}</p>
                </div>
              )}
              {phone.length === 10 && !customer && (
                <div className="space-y-2">
                  <div className="space-y-2">
                    <Label htmlFor="customerName">Customer Name *</Label>
                    <Input
                      id="customerName"
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      placeholder="Enter customer name"
                      className="rounded-xl"
                      required
                      disabled={isLoading}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="customerEmail">Email (Optional)</Label>
                    <Input
                      id="customerEmail"
                      type="email"
                      value={customerEmail}
                      onChange={(e) => setCustomerEmail(e.target.value)}
                      placeholder="Enter email"
                      className="rounded-xl"
                      disabled={isLoading}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Add Items */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Order Items</h3>
            
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-2 space-y-2">
                <Label htmlFor="product">Product</Label>
                {productsLoading ? (
                  <div className="flex items-center justify-center h-10">
                    <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                  </div>
                ) : (
                  <select
                    id="product"
                    value={selectedProduct}
                    onChange={(e) => setSelectedProduct(e.target.value)}
                    className="w-full h-10 px-3 rounded-xl border border-input bg-background text-sm"
                    disabled={isLoading}
                  >
                    <option value="">Select product</option>
                    {products.map((product: any) => (
                      <option key={product.id} value={product.id}>
                        {product.name} - ${product.price.toFixed(2)} ({product.stock} in stock)
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="quantity">Quantity</Label>
                <div className="flex gap-2">
                  <Input
                    id="quantity"
                    type="number"
                    min="1"
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                    className="rounded-xl flex-1"
                    disabled={isLoading}
                  />
                  <Button 
                    type="button" 
                    onClick={handleAddItem} 
                    className="rounded-xl px-3"
                    disabled={isLoading || !selectedProduct}
                  >
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </div>

            {/* Order Items List */}
            {orderItems.length > 0 && (
              <div className="bg-accent/50 rounded-xl p-4 space-y-2">
                {orderItems.map((item, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between bg-background rounded-lg p-3"
                  >
                    <div className="flex-1">
                      <p className="font-medium text-sm">{item.productName}</p>
                      <p className="text-xs text-muted-foreground">
                        {item.quantity} x ${item.price.toFixed(2)} = ${(item.quantity * item.price).toFixed(2)}
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => handleRemoveItem(index)}
                      className="rounded-lg"
                    >
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </div>
                ))}

                <div className="pt-3 border-t border-border flex justify-between items-center">
                  <span className="font-semibold">Total:</span>
                  <span className="text-xl font-bold">${calculateTotal().toFixed(2)}</span>
                </div>
              </div>
            )}
          </div>

          <div className="flex flex-col-reverse sm:flex-row gap-3 pt-4">
            <Button 
              type="button" 
              variant="outline" 
              onClick={onClose} 
              className="rounded-2xl flex-1"
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button 
              type="submit" 
              className="rounded-2xl flex-1"
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  {isEditMode ? 'Updating...' : 'Creating...'}
                </>
              ) : (
                isEditMode ? 'Update Order' : 'Create Order'
              )}
            </Button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  );
};

export default OrderForm;
