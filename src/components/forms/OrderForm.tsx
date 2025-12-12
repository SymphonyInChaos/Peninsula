"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { api } from "@/lib/api";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Loader2,
  ShoppingCart,
  User,
  CreditCard,
  Package,
  Plus,
  Search,
  Trash2,
  Minus,
  Edit,
  X,
} from "lucide-react";

const orderSchema = z.object({
  customerId: z.string().optional(),
  items: z
    .array(
      z.object({
        productId: z.string(),
        quantity: z.number().min(1),
        price: z.number(),
        productName: z.string(),
      })
    )
    .min(1, "At least one product is required"),
  total: z.number().min(0),
  paymentMethod: z.enum(["cash", "card", "upi", "wallet", "qr", "other"]),
  status: z
    .enum(["pending", "processing", "completed", "cancelled", "refunded"])
    .optional(),
  notes: z.string().optional(),
  cashierId: z.string().optional(), // Add cashierId field
});

type OrderFormData = z.infer<typeof orderSchema>;

interface OrderFormProps {
  order?: any;
  onClose: () => void;
  onSuccess: () => void;
}

// Interface for product
interface Product {
  id: string;
  name: string;
  price: number;
  stock: number;
  sku?: string;
  category?: string;
  description?: string;
}

// Interface for customer
interface Customer {
  id: string;
  name: string;
  email?: string;
  phone?: string;
}

const OrderForm = ({ order, onClose, onSuccess }: OrderFormProps) => {
  const [showProductSearch, setShowProductSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([]);
  
  const queryClient = useQueryClient();
  const isEditing = !!order;

  // Fetch all products
  const { data: allProducts = [], isLoading: productsLoading } = useQuery<Product[]>({
    queryKey: ["products"],
    queryFn: async () => {
      try {
        const response = await api.products.getAll();
        return response;
      } catch (error) {
        console.error("Error fetching products:", error);
        toast.error("Failed to load products");
        return [];
      }
    },
  });

  // Filter products based on search query
  useEffect(() => {
    if (searchQuery.trim() === "") {
      setFilteredProducts(allProducts);
    } else {
      const filtered = allProducts.filter(product =>
        product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        product.category?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        product.sku?.toLowerCase().includes(searchQuery.toLowerCase())
      );
      setFilteredProducts(filtered);
    }
  }, [searchQuery, allProducts]);

  // Fetch customers
  const { data: customers = [], isLoading: customersLoading } = useQuery<Customer[]>({
    queryKey: ["customers"],
    queryFn: async () => {
      try {
        const response = await api.customers.getAll();
        return response;
      } catch (error) {
        console.error("Error fetching customers:", error);
        return [];
      }
    },
  });

  // Initialize form with order data or defaults
  const form = useForm<OrderFormData>({
    resolver: zodResolver(orderSchema),
    defaultValues: {
      customerId: order?.customerId || "",
      items: order?.items?.map((item: any) => ({
        productId: item.productId,
        productName: item.product?.name || "Unknown Product",
        quantity: item.qty || 1,
        price: item.price || 0,
      })) || [],
      total: order?.total || 0,
      paymentMethod: order?.paymentMethod || "cash",
      status: order?.status || "pending",
      notes: "",
      cashierId: "system", // Default cashierId
    },
  });

  // Watch form values
  const items = form.watch("items");
  const total = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);

  // Update total when items change
  useEffect(() => {
    form.setValue("total", total);
  }, [total, form]);

  // Add product to order
  const addProduct = (product: Product) => {
    const existingItemIndex = items.findIndex(item => item.productId === product.id);
    
    if (existingItemIndex >= 0) {
      // Update quantity if already exists
      const currentItems = [...items];
      const currentQuantity = currentItems[existingItemIndex].quantity;
      
      if (currentQuantity < product.stock) {
        currentItems[existingItemIndex] = {
          ...currentItems[existingItemIndex],
          quantity: currentQuantity + 1,
        };
        form.setValue("items", currentItems);
      } else {
        toast.error(`Cannot add more ${product.name}. Only ${product.stock} available.`);
      }
    } else {
      // Add new product
      if (product.stock > 0) {
        form.setValue("items", [
          ...items,
          {
            productId: product.id,
            productName: product.name,
            price: product.price,
            quantity: 1,
          },
        ]);
      } else {
        toast.error(`${product.name} is out of stock`);
      }
    }
    
    setShowProductSearch(false);
    setSearchQuery("");
  };

  // Update product quantity
  const updateQuantity = (productId: string, change: number) => {
    const updatedItems = items.map(item => {
      if (item.productId === productId) {
        const product = allProducts.find(p => p.id === productId);
        const newQuantity = item.quantity + change;
        
        if (newQuantity < 1) {
          return item; // Don't go below 1
        }
        
        if (product && newQuantity > product.stock) {
          toast.error(`Cannot add more ${product.name}. Only ${product.stock} available.`);
          return item;
        }
        
        return {
          ...item,
          quantity: newQuantity,
        };
      }
      return item;
    });
    
    form.setValue("items", updatedItems);
  };

  // Remove product from order
  const removeProduct = (productId: string) => {
    const updatedItems = items.filter(item => item.productId !== productId);
    form.setValue("items", updatedItems);
  };

  // Create order mutation
  const createMutation = useMutation({
    mutationFn: async (orderData: any) => {
      console.log("Creating order with data:", orderData);
      
      // Format data for backend - explicitly set cashierId to "system"
      const formattedData = {
        customerId: orderData.customerId || null,
        items: orderData.items.map((item: any) => ({
          productId: item.productId,
          qty: item.quantity,
        })),
        paymentMethod: orderData.paymentMethod,
        status: orderData.status || "pending",
        cashierId: "system", // Always use "system" as cashierId
        notes: orderData.notes || undefined,
      };
      
      console.log("Sending to API:", formattedData);
      return api.orders.create(formattedData);
    },
    onSuccess: (data) => {
      console.log("Order created successfully:", data);
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      queryClient.invalidateQueries({ queryKey: ["products"] });
      toast.success("Order created successfully");
      onSuccess();
    },
    onError: (error: any) => {
      console.error("Order creation error:", error);
      const errorMessage = error.message || "Failed to create order";
      
      // More specific error handling
      if (errorMessage.includes("Cashier not found")) {
        toast.error("System error: Please check backend configuration");
      } else if (errorMessage.includes("stock")) {
        toast.error("Insufficient stock for one or more products");
      } else {
        toast.error(errorMessage);
      }
    },
  });

  // Update order mutation
  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      console.log("Updating order:", id, data);
      
      // Format data for backend
      const formattedData = {
        customerId: data.customerId || null,
        items: data.items.map((item: any) => ({
          productId: item.productId,
          qty: item.quantity,
        })),
        paymentMethod: data.paymentMethod,
        status: data.status || "pending",
        cashierId: "system", // Always use "system" as cashierId
        notes: data.notes || undefined,
      };
      
      return api.orders.update(id, formattedData);
    },
    onSuccess: (data) => {
      console.log("Order updated successfully:", data);
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      queryClient.invalidateQueries({ queryKey: ["products"] });
      toast.success("Order updated successfully");
      onSuccess();
    },
    onError: (error: any) => {
      console.error("Order update error:", error);
      const errorMessage = error.message || "Failed to update order";
      toast.error(errorMessage);
    },
  });

  const onSubmit = (data: OrderFormData) => {
    console.log("Form submitted with data:", data);
    
    if (data.items.length === 0) {
      toast.error("Please add at least one product to the order");
      return;
    }

    const orderData = {
      ...data,
      customerId: data.customerId || null,
      total: data.total,
    };

    if (isEditing) {
      updateMutation.mutate({ id: order.id, data: orderData });
    } else {
      createMutation.mutate(orderData);
    }
  };

  const isLoading = createMutation.isPending || updateMutation.isPending;

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {isEditing ? (
              <>
                <Edit className="w-5 h-5" />
                Edit Order #{order?.id?.slice(0, 8) || ""}
              </>
            ) : (
              <>
                <ShoppingCart className="w-5 h-5" />
                Create New Order
              </>
            )}
          </DialogTitle>
          <DialogDescription>
            Add products to create a new order. Products will be deducted from inventory.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Customer Information */}
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <User className="w-4 h-4 text-muted-foreground" />
                  <h3 className="font-semibold">Customer Information</h3>
                </div>
                <FormField
                  control={form.control}
                  name="customerId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Customer (Optional)</FormLabel>
                      <Select
                        value={field.value || "walk-in"}
                        onValueChange={(value) => field.onChange(value === "walk-in" ? "" : value)}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select customer" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="walk-in">Walk-in Customer</SelectItem>
                          {customersLoading ? (
                            <SelectItem value="loading" disabled>
                              Loading customers...
                            </SelectItem>
                          ) : (
                            customers.map((customer) => (
                              <SelectItem key={customer.id} value={customer.id}>
                                {customer.name}
                              </SelectItem>
                            ))
                          )}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Payment Information */}
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <CreditCard className="w-4 h-4 text-muted-foreground" />
                  <h3 className="font-semibold">Payment Information</h3>
                </div>
                <FormField
                  control={form.control}
                  name="paymentMethod"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Payment Method</FormLabel>
                      <Select
                        value={field.value}
                        onValueChange={field.onChange}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select payment method" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="cash">Cash</SelectItem>
                          <SelectItem value="card">Card</SelectItem>
                          <SelectItem value="upi">UPI</SelectItem>
                          <SelectItem value="wallet">Wallet</SelectItem>
                          <SelectItem value="qr">QR Code</SelectItem>
                          <SelectItem value="other">Other</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            {/* Status Section (Only for editing) */}
            {isEditing && (
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Package className="w-4 h-4 text-muted-foreground" />
                  <h3 className="font-semibold">Order Status</h3>
                </div>
                <FormField
                  control={form.control}
                  name="status"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Status</FormLabel>
                      <Select
                        value={field.value}
                        onValueChange={field.onChange}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select status" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="pending">Pending</SelectItem>
                          <SelectItem value="processing">Processing</SelectItem>
                          <SelectItem value="completed">Completed</SelectItem>
                          <SelectItem value="cancelled">Cancelled</SelectItem>
                          <SelectItem value="refunded">Refunded</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            )}

            {/* Products Section */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Package className="w-4 h-4 text-muted-foreground" />
                  <h3 className="font-semibold">Products</h3>
                </div>
                
                <Button 
                  type="button" 
                  variant="outline" 
                  size="sm"
                  onClick={() => setShowProductSearch(true)}
                  disabled={productsLoading}
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Add Product
                </Button>
              </div>

              {/* Product Search Modal */}
              {showProductSearch && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                  <div className="bg-white dark:bg-gray-900 rounded-lg w-full max-w-2xl mx-4 max-h-[80vh] overflow-hidden">
                    <div className="p-4 border-b flex items-center justify-between">
                      <div>
                        <h3 className="font-semibold">Select Products</h3>
                        <p className="text-sm text-muted-foreground">
                          Click on a product to add it to the order
                        </p>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setShowProductSearch(false);
                          setSearchQuery("");
                        }}
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                    <div className="p-4">
                      <div className="relative mb-4">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                        <Input
                          placeholder="Search products by name, category, or SKU..."
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          className="pl-10"
                        />
                      </div>
                      
                      <div className="max-h-[400px] overflow-y-auto">
                        {productsLoading ? (
                          <div className="flex justify-center p-8">
                            <Loader2 className="w-6 h-6 animate-spin" />
                          </div>
                        ) : filteredProducts.length === 0 ? (
                          <div className="text-center p-8 text-muted-foreground">
                            No products found. Try a different search term.
                          </div>
                        ) : (
                          <div className="space-y-2">
                            {filteredProducts.map((product) => (
                              <div
                                key={product.id}
                                className="flex items-center justify-between p-3 border rounded-lg hover:bg-accent cursor-pointer transition-colors"
                                onClick={() => addProduct(product)}
                              >
                                <div className="flex-1">
                                  <div className="font-medium">{product.name}</div>
                                  <div className="text-sm text-muted-foreground">
                                    {product.category && (
                                      <span className="mr-3">{product.category}</span>
                                    )}
                                    <span>Stock: {product.stock}</span>
                                  </div>
                                </div>
                                <div className="flex items-center gap-3">
                                  <Badge variant={product.stock > 0 ? "default" : "destructive"}>
                                    {product.stock > 0 ? "In Stock" : "Out of Stock"}
                                  </Badge>
                                  <div className="font-semibold">
                                    ₹{product.price.toFixed(2)}
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="p-4 border-t">
                      <Button
                        type="button"
                        variant="outline"
                        className="w-full"
                        onClick={() => {
                          setShowProductSearch(false);
                          setSearchQuery("");
                        }}
                      >
                        Close
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              {/* Products List */}
              <div className="border rounded-lg">
                {items.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No products added yet. Click "Add Product" to search and add products.
                  </div>
                ) : (
                  <div className="divide-y">
                    {items.map((item) => (
                      <div key={item.productId} className="p-4 flex items-center justify-between hover:bg-muted/30 transition-colors">
                        <div className="flex-1">
                          <div className="font-medium">{item.productName}</div>
                          <div className="text-sm text-muted-foreground">
                            Unit Price: ₹{item.price.toFixed(2)}
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-4">
                          {/* Quantity Controls */}
                          <div className="flex items-center gap-2">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => updateQuantity(item.productId, -1)}
                              disabled={item.quantity <= 1}
                              className="h-8 w-8 p-0"
                            >
                              <Minus className="w-3 h-3" />
                            </Button>
                            <span className="w-8 text-center font-medium">
                              {item.quantity}
                            </span>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => updateQuantity(item.productId, 1)}
                              className="h-8 w-8 p-0"
                            >
                              <Plus className="w-3 h-3" />
                            </Button>
                          </div>
                          
                          <div className="font-semibold w-24 text-right">
                            ₹{(item.price * item.quantity).toFixed(2)}
                          </div>
                          
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => removeProduct(item.productId)}
                            className="h-8 w-8 p-0"
                          >
                            <Trash2 className="w-4 h-4 text-destructive" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                
                {/* Order Total */}
                {items.length > 0 && (
                  <div className="border-t p-4 bg-muted/30">
                    <div className="flex justify-between items-center">
                      <div className="text-lg font-semibold">Total</div>
                      <div className="text-2xl font-bold">₹{total.toFixed(2)}</div>
                    </div>
                  </div>
                )}
              </div>
              
              {/* Items Validation Error */}
              {form.formState.errors.items && (
                <p className="text-sm text-destructive">
                  {form.formState.errors.items.message}
                </p>
              )}
            </div>

            {/* Notes */}
            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes (Optional)</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Add any notes about this order..."
                      {...field}
                      rows={3}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                disabled={isLoading}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isLoading || items.length === 0}>
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    {isEditing ? "Updating..." : "Creating..."}
                  </>
                ) : isEditing ? (
                  "Update Order"
                ) : (
                  "Create Order"
                )}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};

export default OrderForm;