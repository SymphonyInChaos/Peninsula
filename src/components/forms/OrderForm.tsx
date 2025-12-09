import { useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  X,
  Search,
  Plus,
  Trash2,
  Loader2,
  CreditCard,
  Smartphone,
  Wallet,
  MoreHorizontal,
} from "lucide-react";
import { toast } from "sonner";
import { api, PaymentMethod, formatCurrency } from "@/lib/api";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

interface BackendOrder {
  id: string;
  customerId: string | null;
  total: number;
  paymentMethod?: PaymentMethod;
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
  stock: number;
}

const OrderForm = ({ order, onClose, onSuccess }: OrderFormProps) => {
  const queryClient = useQueryClient();
  const isEditMode = !!order;
  const [phone, setPhone] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [customer, setCustomer] = useState<any>(null);
  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
  const [selectedProduct, setSelectedProduct] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("cash");
  const [orderType, setOrderType] = useState<"online" | "offline">("offline");

  // Initialize form with order data if editing
  useEffect(() => {
    if (order) {
      if (order.customer) {
        setCustomer(order.customer);
        setPhone(order.customer.phone || "");
        setCustomerName(order.customer.name);
        setCustomerEmail(order.customer.email || "");
        // If customer exists, it's an online order (customer associated)
        setOrderType("online");
      } else {
        // Walk-in customer, offline order
        setOrderType("offline");
      }

      // Convert order items to form format
      const items: OrderItem[] = order.items.map((item) => ({
        productId: item.productId,
        productName: item.product.name,
        quantity: item.qty,
        price: item.price,
        stock: item.product.stock + item.qty, // Add back the quantity for stock check
      }));
      setOrderItems(items);

      // Set payment method
      setPaymentMethod(order.paymentMethod || "cash");
    }
  }, [order]);

  // Fetch products
  const { data: products = [], isLoading: productsLoading } = useQuery({
    queryKey: ["products"],
    queryFn: api.products.getAll,
  });

  // Fetch customers to search
  const { data: customers = [] } = useQuery({
    queryKey: ["customers"],
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
        setCustomerEmail(foundCustomer.email || "");
        setOrderType("online");
        toast.success(`Customer found: ${foundCustomer.name}`);
      } else {
        setCustomer(null);
        setCustomerName("");
        setCustomerEmail("");
        setOrderType("offline");
        toast.info("New customer - please enter name");
      }
    } else if (!isEditMode && phone.length !== 10) {
      setCustomer(null);
      setCustomerName("");
      setCustomerEmail("");
      setOrderType("offline");
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
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      queryClient.invalidateQueries({ queryKey: ["products"] });
      queryClient.invalidateQueries({ queryKey: ["reports"] });
      queryClient.invalidateQueries({ queryKey: ["analytics"] });
      toast.success("Order created successfully!");
      onSuccess?.();
      onClose();
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to create order");
    },
  });

  // Update order mutation
  const updateOrderMutation = useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: string;
      data: {
        customerId?: string | null;
        items?: Array<{ productId: string; qty: number }>;
        paymentMethod?: PaymentMethod;
      };
    }) => api.orders.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      queryClient.invalidateQueries({ queryKey: ["products"] });
      queryClient.invalidateQueries({ queryKey: ["reports"] });
      queryClient.invalidateQueries({ queryKey: ["analytics"] });
      toast.success("Order updated successfully!");
      onSuccess?.();
      onClose();
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to update order");
    },
  });

  const handleAddItem = () => {
    if (!selectedProduct || !quantity) {
      toast.error("Please select a product and quantity");
      return;
    }

    const product = products.find((p: any) => p.id === selectedProduct);
    if (!product) return;

    const qty = parseInt(quantity);
    if (qty <= 0) {
      toast.error("Quantity must be greater than 0");
      return;
    }

    // Check current stock (considering items already in cart)
    const currentCartQty =
      orderItems.find((item) => item.productId === product.id)?.quantity || 0;
    const totalRequestedQty = qty + currentCartQty;

    if (product.stock < totalRequestedQty) {
      toast.error(`Insufficient stock. Available: ${product.stock}`);
      return;
    }

    // Check if product already in order
    const existingItemIndex = orderItems.findIndex(
      (item) => item.productId === product.id
    );
    if (existingItemIndex >= 0) {
      // Update existing item quantity
      const updatedItems = [...orderItems];
      updatedItems[existingItemIndex].quantity += qty;
      setOrderItems(updatedItems);
    } else {
      // Add new item
      const newItem: OrderItem = {
        productId: product.id,
        productName: product.name,
        quantity: qty,
        price: product.price,
        stock: product.stock,
      };
      setOrderItems([...orderItems, newItem]);
    }

    setSelectedProduct("");
    setQuantity("1");
    toast.success("Item added to order");
  };

  const handleRemoveItem = (index: number) => {
    setOrderItems(orderItems.filter((_, i) => i !== index));
  };

  const handleUpdateQuantity = (index: number, newQuantity: number) => {
    if (newQuantity < 1) {
      toast.error("Quantity must be at least 1");
      return;
    }

    const item = orderItems[index];
    if (newQuantity > item.stock) {
      toast.error(`Insufficient stock. Available: ${item.stock}`);
      return;
    }

    const updatedItems = [...orderItems];
    updatedItems[index].quantity = newQuantity;
    setOrderItems(updatedItems);
  };

  const calculateSubtotal = () => {
    return orderItems.reduce(
      (sum, item) => sum + item.quantity * item.price,
      0
    );
  };

  const calculateTax = () => {
    const subtotal = calculateSubtotal();
    return subtotal * 0.18; // 18% GST
  };

  const calculateTotal = () => {
    return calculateSubtotal() + calculateTax();
  };

  const getPaymentMethodIcon = (method: PaymentMethod) => {
    switch (method) {
      case "cash":
        return <Wallet className="w-4 h-4" />;
      case "card":
        return <CreditCard className="w-4 h-4" />;
      case "upi":
        return <Smartphone className="w-4 h-4" />;
      default:
        return <MoreHorizontal className="w-4 h-4" />;
    }
  };

  const getPaymentMethodLabel = (method: PaymentMethod) => {
    return api.payments.formatPaymentMethod(method);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate phone for offline orders with customer info
    if (orderType === "offline" && phone && phone.length !== 10) {
      toast.error("Please enter a valid 10-digit phone number");
      return;
    }

    // Validate phone for online orders
    if (orderType === "online" && (!phone || phone.length !== 10)) {
      toast.error(
        "Please enter a valid 10-digit phone number for online orders"
      );
      return;
    }

    if (orderItems.length === 0) {
      toast.error("Please add at least one item to the order");
      return;
    }

    try {
      let customerId: string | null = null;

      // Handle customer creation/selection based on order type
      if (orderType === "online") {
        if (!customer) {
          // Create new customer for online order
          if (!customerName.trim()) {
            toast.error("Please enter customer name");
            return;
          }

          if (!phone || phone.length !== 10) {
            toast.error("Please enter a valid 10-digit phone number");
            return;
          }

          const newCustomer = await createCustomerMutation.mutateAsync({
            name: customerName,
            phone,
            email: customerEmail || undefined,
          });
          customerId = newCustomer.id;
        } else {
          // Use existing customer
          customerId = customer.id;
        }
      } else {
        // Offline/walk-in order, no customer ID
        customerId = null;
      }

      // Prepare order data
      const orderData = {
        customerId,
        items: orderItems.map((item) => ({
          productId: item.productId,
          qty: item.quantity,
        })),
        paymentMethod,
      };

      // Create or update order
      if (isEditMode && order) {
        await updateOrderMutation.mutateAsync({
          id: order.id,
          data: orderData,
        });
      } else {
        await createOrderMutation.mutateAsync(orderData);
      }
    } catch (error) {
      // Error handling is done in mutation onError
    }
  };

  const isLoading =
    createOrderMutation.isPending ||
    updateOrderMutation.isPending ||
    createCustomerMutation.isPending;

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
        className="bg-card rounded-2xl shadow-medium w-full max-w-4xl max-h-[90vh] overflow-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-card border-b border-border p-4 sm:p-6 flex items-center justify-between">
          <div className="flex flex-col">
            <h2 className="text-xl sm:text-2xl font-bold">
              {isEditMode ? "Edit Order" : "Create Order"}
            </h2>
            <div className="flex items-center gap-2 mt-1">
              <span
                className={`px-2 py-0.5 text-xs rounded-full ${
                  orderType === "online"
                    ? "bg-blue-500/20 text-blue-600"
                    : "bg-gray-500/20 text-gray-600"
                }`}
              >
                {orderType === "online" ? "🌐 Online" : "🏪 Offline"}
              </span>
              <span
                className={`px-2 py-0.5 text-xs rounded-full ${
                  paymentMethod === "cash"
                    ? "bg-green-500/20 text-green-600"
                    : paymentMethod === "upi"
                    ? "bg-blue-500/20 text-blue-600"
                    : paymentMethod === "card"
                    ? "bg-purple-500/20 text-purple-600"
                    : "bg-gray-500/20 text-gray-600"
                }`}
              >
                {getPaymentMethodIcon(paymentMethod)}
                {getPaymentMethodLabel(paymentMethod)}
              </span>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="rounded-xl"
            disabled={isLoading}
          >
            <X className="w-5 h-5" />
          </Button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-6">
          {/* Order Type Selection */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Order Type</h3>
            <RadioGroup
              value={orderType}
              onValueChange={(value: "online" | "offline") =>
                setOrderType(value)
              }
              className="flex gap-4"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="offline" id="offline" />
                <Label
                  htmlFor="offline"
                  className="flex items-center gap-2 cursor-pointer"
                >
                  <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center">
                    🏪
                  </div>
                  <div>
                    <p className="font-medium">Offline/Walk-in</p>
                    <p className="text-xs text-muted-foreground">
                      No customer account needed
                    </p>
                  </div>
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="online" id="online" />
                <Label
                  htmlFor="online"
                  className="flex items-center gap-2 cursor-pointer"
                >
                  <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center">
                    🌐
                  </div>
                  <div>
                    <p className="font-medium">Online</p>
                    <p className="text-xs text-muted-foreground">
                      Customer account required
                    </p>
                  </div>
                </Label>
              </div>
            </RadioGroup>
          </div>

          {/* Customer Details - Only show for online orders */}
          {orderType === "online" && (
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
                        setPhone(
                          e.target.value.replace(/\D/g, "").slice(0, 10)
                        );
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
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">{customer.name}</p>
                        <p className="text-muted-foreground text-xs">
                          {customer.email || "No email"}
                        </p>
                        <p className="text-muted-foreground text-xs">
                          Orders: {customer.orders?.length || 0}
                        </p>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setCustomer(null);
                          setCustomerName("");
                          setCustomerEmail("");
                        }}
                        className="text-xs"
                      >
                        Change
                      </Button>
                    </div>
                  </div>
                )}

                {phone.length === 10 && !customer && (
                  <div className="space-y-3">
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
          )}

          {/* Offline Order Phone (Optional) */}
          {orderType === "offline" && (
            <div className="space-y-2">
              <Label htmlFor="offlinePhone">Phone Number (Optional)</Label>
              <Input
                id="offlinePhone"
                type="tel"
                value={phone}
                onChange={(e) => {
                  setPhone(e.target.value.replace(/\D/g, "").slice(0, 10));
                  setPhoneManuallyChanged(true);
                }}
                placeholder="Enter 10-digit phone for receipt"
                className="rounded-xl"
                maxLength={10}
                disabled={isLoading}
              />
              {phone.length === 10 && (
                <div className="space-y-2 mt-3">
                  <Label htmlFor="offlineCustomerName">
                    Customer Name (Optional)
                  </Label>
                  <Input
                    id="offlineCustomerName"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    placeholder="Enter name for receipt"
                    className="rounded-xl"
                    disabled={isLoading}
                  />
                </div>
              )}
            </div>
          )}

          {/* Payment Method */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Payment Method</h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {api.payments.getMethods().map((method) => (
                <Button
                  key={method.value}
                  type="button"
                  variant={
                    paymentMethod === method.value ? "default" : "outline"
                  }
                  className={`rounded-xl h-auto py-4 flex flex-col items-center gap-2 ${
                    paymentMethod === method.value
                      ? method.value === "cash"
                        ? "bg-green-600 hover:bg-green-700"
                        : method.value === "upi"
                        ? "bg-blue-600 hover:bg-blue-700"
                        : method.value === "card"
                        ? "bg-purple-600 hover:bg-purple-700"
                        : "bg-gray-600 hover:bg-gray-700"
                      : ""
                  }`}
                  onClick={() =>
                    setPaymentMethod(method.value as PaymentMethod)
                  }
                  disabled={isLoading}
                >
                  <span className="text-2xl">
                    {api.payments.getPaymentMethodIcon(
                      method.value as PaymentMethod
                    )}
                  </span>
                  <span className="text-sm font-medium">{method.label}</span>
                </Button>
              ))}
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
                  <Select
                    value={selectedProduct}
                    onValueChange={setSelectedProduct}
                    disabled={isLoading}
                  >
                    <SelectTrigger className="rounded-xl">
                      <SelectValue placeholder="Select product" />
                    </SelectTrigger>
                    <SelectContent>
                      {products.map((product: any) => (
                        <SelectItem key={product.id} value={product.id}>
                          <div className="flex justify-between items-center w-full">
                            <span>{product.name}</span>
                            <span className="text-xs text-muted-foreground">
                              {formatCurrency(product.price)} ({product.stock}{" "}
                              in stock)
                            </span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
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
              <div className="bg-accent/50 rounded-xl p-4 space-y-3">
                <div className="space-y-2">
                  {orderItems.map((item, index) => (
                    <div
                      key={index}
                      className="bg-background rounded-lg p-3 space-y-2"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <p className="font-medium text-sm">
                            {item.productName}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Price: {formatCurrency(item.price)} | Stock:{" "}
                            {item.stock}
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
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            onClick={() =>
                              handleUpdateQuantity(index, item.quantity - 1)
                            }
                            className="w-6 h-6 rounded-md"
                            disabled={item.quantity <= 1}
                          >
                            -
                          </Button>
                          <Input
                            type="number"
                            min="1"
                            max={item.stock}
                            value={item.quantity}
                            onChange={(e) =>
                              handleUpdateQuantity(
                                index,
                                parseInt(e.target.value) || 1
                              )
                            }
                            className="w-16 h-8 text-center"
                          />
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            onClick={() =>
                              handleUpdateQuantity(index, item.quantity + 1)
                            }
                            className="w-6 h-6 rounded-md"
                            disabled={item.quantity >= item.stock}
                          >
                            +
                          </Button>
                        </div>
                        <span className="font-semibold">
                          {formatCurrency(item.quantity * item.price)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Order Summary */}
                <div className="pt-3 border-t border-border space-y-2">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Subtotal:</span>
                    <span>{formatCurrency(calculateSubtotal())}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">GST (18%):</span>
                    <span>{formatCurrency(calculateTax())}</span>
                  </div>
                  <div className="pt-2 border-t border-border flex justify-between items-center">
                    <span className="font-semibold">Total:</span>
                    <span className="text-xl font-bold">
                      {formatCurrency(calculateTotal())}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Order Summary Card */}
          <div className="bg-accent/50 rounded-xl p-4 space-y-3">
            <h4 className="font-semibold">Order Summary</h4>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground">Order Type</p>
                <p className="font-medium">
                  {orderType === "online" ? "🌐 Online" : "🏪 Offline"}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">Payment Method</p>
                <p className="font-medium">
                  {getPaymentMethodLabel(paymentMethod)}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">Customer</p>
                <p className="font-medium">
                  {orderType === "online"
                    ? customer
                      ? customer.name
                      : "New Customer"
                    : customerName || "Walk-in Customer"}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">Items</p>
                <p className="font-medium">{orderItems.length} items</p>
              </div>
            </div>
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
                  {isEditMode ? "Updating..." : "Creating..."}
                </>
              ) : (
                <div className="flex flex-col items-center">
                  <span>{isEditMode ? "Update Order" : "Create Order"}</span>
                  <span className="text-xs opacity-80 mt-0.5">
                    Total: {formatCurrency(calculateTotal())}
                  </span>
                </div>
              )}
            </Button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  );
};

export default OrderForm;
