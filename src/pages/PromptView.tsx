import { useState, useRef, useEffect } from "react";
import { motion } from "framer-motion";
import { useStore } from "@/store/useStore";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Package,
  ArrowRight,
  Sparkles,
  LogOut,
  CheckCircle,
  XCircle,
  UserPlus,
  Trash2,
  Edit3,
  Loader2,
  Users,
  Eye,
  HelpCircle,
  X,
  ShoppingCart,
  BarChart3,
  TrendingUp,
  DollarSign,
  AlertTriangle,
  History,
} from "lucide-react";

interface Message {
  id: string;
  type: "user" | "assistant";
  content: string;
  timestamp: Date;
  data?: any;
  needsConfirmation?: boolean;
  actionType?: string;
  customerData?: any;
  productData?: any;
  orderData?: any;
  fieldToEdit?: string;
}

const PromptView = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [showHelpModal, setShowHelpModal] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { toggleViewMode, logout } = useStore();
  const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:5000";

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const addMessage = (message: Omit<Message, "id" | "timestamp">) => {
    const newMessage: Message = {
      ...message,
      id: Date.now().toString(),
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, newMessage]);
  };

  const processCommand = async (userInput: string) => {
    if (!userInput.trim()) return;

    // Add user message
    addMessage({
      type: "user",
      content: userInput,
    });

    setIsProcessing(true);
    setInput("");

    try {
      const requestBody = {
        text: userInput,
        idempotencyKey: crypto.randomUUID(),
        conversationId: conversationId || undefined,
      };

      console.log("Sending request:", requestBody);

      const response = await fetch(`${API_BASE}/api/command`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      });

      const data = await response.json();
      console.log("API Response:", data);

      if (response.ok) {
        // Store conversation ID for context
        if (data.conversationId) {
          setConversationId(data.conversationId);
        }

        // Add assistant message
        addMessage({
          type: "assistant",
          content: data.response,
          data: data.data,
          needsConfirmation: data.needsConfirmation,
          actionType: data.actionType,
          customerData: data.customerData,
          productData: data.productData,
          orderData: data.orderData,
          fieldToEdit: data.fieldToEdit,
        });
      } else {
        addMessage({
          type: "assistant",
          content:
            data.error ||
            data.response ||
            "Sorry, I encountered an error. Please try again.",
        });
      }
    } catch (error) {
      console.error("API Error:", error);
      addMessage({
        type: "assistant",
        content: "Network error. Please check your connection and try again.",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleConfirmation = async (
    confirmed: boolean,
    actionType?: string,
    customerData?: any,
    productData?: any,
    orderData?: any,
    fieldToEdit?: string
  ) => {
    // Get the last message that needs confirmation
    const lastMessage = [...messages]
      .reverse()
      .find((msg) => msg.needsConfirmation);

    if (!conversationId) {
      addMessage({
        type: "assistant",
        content:
          "I'm not sure what you're confirming. Please try your command again.",
      });
      return;
    }

    setIsProcessing(true);

    try {
      const confirmBody = {
        conversationId: conversationId,
        confirmed,
        actionType: actionType || lastMessage?.actionType,
        customerData: customerData || lastMessage?.customerData,
        productData: productData || lastMessage?.productData,
        orderData: orderData || lastMessage?.orderData,
        fieldToEdit: fieldToEdit || lastMessage?.fieldToEdit,
      };

      console.log("Sending confirmation:", confirmBody);

      const response = await fetch(`${API_BASE}/api/command/confirm`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(confirmBody),
      });

      const data = await response.json();
      console.log("Confirmation response:", data);

      // Add the confirmation result as a new message
      addMessage({
        type: "assistant",
        content: data.response,
        data: data.data,
      });

      // Clear conversation after confirmation
      setConversationId(null);
    } catch (error) {
      console.error("Confirmation error:", error);
      addMessage({
        type: "assistant",
        content: "Confirmation failed. Please try again.",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleQuickAction = (example: string) => {
    setInput(example);
    setTimeout(() => {
      processCommand(example);
    }, 100);
  };

  const renderMessageContent = (message: Message) => {
    if (message.needsConfirmation) {
      console.log("Confirmation message data:", {
        actionType: message.actionType,
        customerData: message.customerData,
        productData: message.productData,
        orderData: message.orderData,
        fieldToEdit: message.fieldToEdit,
        conversationId: conversationId,
      });

      return (
        <div className="space-y-3">
          <p className="whitespace-pre-line">{message.content}</p>
          <div className="flex gap-2">
            <Button
              onClick={() =>
                handleConfirmation(
                  true,
                  message.actionType,
                  message.customerData,
                  message.productData,
                  message.orderData,
                  message.fieldToEdit
                )
              }
              disabled={isProcessing}
              className="bg-green-600 hover:bg-green-700"
            >
              {isProcessing ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                "Yes, proceed"
              )}
            </Button>
            <Button
              onClick={() => handleConfirmation(false)}
              disabled={isProcessing}
              variant="outline"
            >
              Cancel
            </Button>
          </div>
        </div>
      );
    }

    return (
      <div className="space-y-3">
        <p className="whitespace-pre-line">{message.content}</p>
        {message.data && renderMessageData(message.data, message.type)}
      </div>
    );
  };

  const renderMessageData = (data: any, type: string) => {
    if (Array.isArray(data)) {
      return (
        <div className="mt-3 space-y-2">
          {data.map((item, idx) => (
            <div
              key={idx}
              className="bg-background rounded-lg p-3 text-sm border"
            >
              {item.name && (
                <div className="font-medium text-base mb-1">{item.name}</div>
              )}
              {item.available !== undefined && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Stock:</span>
                  <span
                    className={
                      item.available > 0 ? "text-green-600" : "text-red-600"
                    }
                  >
                    {item.available} available
                  </span>
                </div>
              )}
              {item.price && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Price:</span>
                  <span>
                    $
                    {typeof item.price === "number"
                      ? item.price.toFixed(2)
                      : item.price}
                  </span>
                </div>
              )}
            </div>
          ))}
        </div>
      );
    }

    if (data && typeof data === "object") {
      // Render customer details
      if (data.customer) {
        const customer = data.customer;
        return (
          <div className="mt-3 bg-background rounded-lg p-4 border space-y-3">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <div className="text-muted-foreground text-xs">Customer ID</div>
                <div className="font-medium">{customer.id}</div>
              </div>
              <div>
                <div className="text-muted-foreground text-xs">Name</div>
                <div className="font-medium">{customer.name}</div>
              </div>
              {customer.email && (
                <div className="col-span-2">
                  <div className="text-muted-foreground text-xs">Email</div>
                  <div className="font-medium">{customer.email}</div>
                </div>
              )}
              {customer.phone && (
                <div className="col-span-2">
                  <div className="text-muted-foreground text-xs">Phone</div>
                  <div className="font-medium">{customer.phone}</div>
                </div>
              )}
            </div>
          </div>
        );
      }

      // Render product details
      if (data.product) {
        const product = data.product;
        return (
          <div className="mt-3 bg-background rounded-lg p-4 border space-y-3">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <div className="text-muted-foreground text-xs">Product ID</div>
                <div className="font-medium">{product.id}</div>
              </div>
              <div>
                <div className="text-muted-foreground text-xs">Name</div>
                <div className="font-medium">{product.name}</div>
              </div>
              <div className="col-span-2">
                <div className="text-muted-foreground text-xs">Description</div>
                <div className="font-medium">
                  {product.description || "Not provided"}
                </div>
              </div>
              <div>
                <div className="text-muted-foreground text-xs">Price</div>
                <div className="font-medium">${product.price?.toFixed(2)}</div>
              </div>
              <div>
                <div className="text-muted-foreground text-xs">Stock</div>
                <div
                  className={`font-medium ${
                    product.stock < 10 ? "text-red-600" : "text-green-600"
                  }`}
                >
                  {product.stock}
                </div>
              </div>
            </div>
          </div>
        );
      }

      // Render order details
      if (data.order) {
        const order = data.order;
        const itemsList = order.items?.map((item: any, idx: number) => (
          <div key={idx} className="flex justify-between text-sm py-1">
            <span>
              {item.product?.name} × {item.qty}
            </span>
            <span>${((item.price || 0) * (item.qty || 0)).toFixed(2)}</span>
          </div>
        ));

        return (
          <div className="mt-3 bg-background rounded-lg p-4 border space-y-3">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <div className="text-muted-foreground text-xs">Order ID</div>
                <div className="font-medium">{order.id}</div>
              </div>
              <div>
                <div className="text-muted-foreground text-xs">Customer</div>
                <div className="font-medium">{order.customer?.name}</div>
              </div>
              <div>
                <div className="text-muted-foreground text-xs">
                  Total Amount
                </div>
                <div className="font-medium">${order.total?.toFixed(2)}</div>
              </div>
              <div>
                <div className="text-muted-foreground text-xs">Date</div>
                <div className="font-medium">
                  {new Date(order.createdAt).toLocaleDateString()}
                </div>
              </div>
            </div>
            {order.items && order.items.length > 0 && (
              <div className="pt-3 border-t">
                <div className="text-muted-foreground text-xs mb-2">Items:</div>
                {itemsList}
              </div>
            )}
          </div>
        );
      }

      // Render report dashboard
      if (data.overview) {
        return (
          <div className="mt-3 bg-background rounded-lg p-4 border space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-green-50 dark:bg-green-950/20 rounded-lg p-3">
                <div className="flex items-center gap-2 mb-1">
                  <DollarSign className="w-4 h-4 text-green-600" />
                  <div className="text-xs text-muted-foreground">
                    Today's Revenue
                  </div>
                </div>
                <div className="text-xl font-bold text-green-700">
                  ${data.overview.today?.revenue?.toFixed(2) || "0.00"}
                </div>
              </div>
              <div className="bg-blue-50 dark:bg-blue-950/20 rounded-lg p-3">
                <div className="flex items-center gap-2 mb-1">
                  <ShoppingCart className="w-4 h-4 text-blue-600" />
                  <div className="text-xs text-muted-foreground">
                    Today's Orders
                  </div>
                </div>
                <div className="text-xl font-bold text-blue-700">
                  {data.overview.today?.orders || 0}
                </div>
              </div>
              <div className="bg-yellow-50 dark:bg-yellow-950/20 rounded-lg p-3">
                <div className="flex items-center gap-2 mb-1">
                  <AlertTriangle className="w-4 h-4 text-yellow-600" />
                  <div className="text-xs text-muted-foreground">
                    Low Stock Items
                  </div>
                </div>
                <div className="text-xl font-bold text-yellow-700">
                  {data.overview.inventory?.lowStockItems || 0}
                </div>
              </div>
              <div className="bg-purple-50 dark:bg-purple-950/20 rounded-lg p-3">
                <div className="flex items-center gap-2 mb-1">
                  <BarChart3 className="w-4 h-4 text-purple-600" />
                  <div className="text-xs text-muted-foreground">
                    Inventory Value
                  </div>
                </div>
                <div className="text-xl font-bold text-purple-700">
                  ${data.overview.inventory?.totalValue?.toFixed(2) || "0.00"}
                </div>
              </div>
            </div>

            {/* Performance Indicator */}
            <div className="pt-3 border-t">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">
                  Today's Performance:
                </span>
                <span
                  className={`px-2 py-1 rounded-full text-xs font-medium ${
                    data.alerts?.todayPerformance === "good"
                      ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                      : data.alerts?.todayPerformance === "average"
                      ? "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200"
                      : "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200"
                  }`}
                >
                  {data.alerts?.todayPerformance === "good"
                    ? "✅ Good"
                    : data.alerts?.todayPerformance === "average"
                    ? "⚠️ Average"
                    : "❌ Needs Attention"}
                </span>
              </div>
            </div>
          </div>
        );
      }

      // Render sales report
      if (data.summary && data.summary.totalSales !== undefined) {
        return (
          <div className="mt-3 bg-background rounded-lg p-4 border space-y-3">
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-green-50 dark:bg-green-950/20 rounded-lg p-3">
                <div className="text-xs text-muted-foreground mb-1">
                  Total Sales
                </div>
                <div className="text-lg font-bold text-green-700">
                  ${data.summary.totalSales?.toFixed(2) || "0.00"}
                </div>
              </div>
              <div className="bg-blue-50 dark:bg-blue-950/20 rounded-lg p-3">
                <div className="text-xs text-muted-foreground mb-1">Orders</div>
                <div className="text-lg font-bold text-blue-700">
                  {data.summary.orderCount || 0}
                </div>
              </div>
              <div className="bg-purple-50 dark:bg-purple-950/20 rounded-lg p-3">
                <div className="text-xs text-muted-foreground mb-1">
                  Avg Order
                </div>
                <div className="text-lg font-bold text-purple-700">
                  ${data.summary.avgOrderValue?.toFixed(2) || "0.00"}
                </div>
              </div>
            </div>

            {data.topProducts && data.topProducts.length > 0 && (
              <div className="pt-3 border-t">
                <div className="text-sm font-medium mb-2">Top Products:</div>
                <div className="space-y-2">
                  {data.topProducts
                    .slice(0, 3)
                    .map((product: any, idx: number) => (
                      <div
                        key={idx}
                        className="flex justify-between items-center"
                      >
                        <span className="text-sm">{product.name}</span>
                        <span className="font-medium">
                          ${product.totalSales?.toFixed(2) || "0.00"}
                        </span>
                      </div>
                    ))}
                </div>
              </div>
            )}
          </div>
        );
      }

      // Render low stock report
      if (data.products && Array.isArray(data.products)) {
        const criticalItems = data.products.filter(
          (p: any) => p.urgency === "high"
        );

        return (
          <div className="mt-3 bg-background rounded-lg p-4 border space-y-3">
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-red-50 dark:bg-red-950/20 rounded-lg p-3">
                <div className="text-xs text-muted-foreground mb-1">
                  Low Stock Items
                </div>
                <div className="text-lg font-bold text-red-700">
                  {data.summary?.totalLowStock || 0}
                </div>
              </div>
              <div className="bg-yellow-50 dark:bg-yellow-950/20 rounded-lg p-3">
                <div className="text-xs text-muted-foreground mb-1">
                  Out of Stock
                </div>
                <div className="text-lg font-bold text-yellow-700">
                  {data.summary?.outOfStock || 0}
                </div>
              </div>
            </div>

            {criticalItems.length > 0 && (
              <div className="pt-3 border-t">
                <div className="text-sm font-medium mb-2">Critical Items:</div>
                <div className="space-y-2">
                  {criticalItems
                    .slice(0, 5)
                    .map((product: any, idx: number) => (
                      <div
                        key={idx}
                        className="flex justify-between items-center"
                      >
                        <div>
                          <span className="text-sm font-medium">
                            {product.name}
                          </span>
                          <div className="text-xs text-muted-foreground">
                            {product.reorderSuggestion}
                          </div>
                        </div>
                        <span
                          className={`font-bold ${
                            product.stock === 0
                              ? "text-red-600"
                              : "text-yellow-600"
                          }`}
                        >
                          {product.stock} left
                        </span>
                      </div>
                    ))}
                </div>
              </div>
            )}
          </div>
        );
      }

      // Render inventory valuation
      if (data.summary && data.summary.totalInventoryValue !== undefined) {
        return (
          <div className="mt-3 bg-background rounded-lg p-4 border space-y-3">
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-green-50 dark:bg-green-950/20 rounded-lg p-3">
                <div className="text-xs text-muted-foreground mb-1">
                  Total Value
                </div>
                <div className="text-lg font-bold text-green-700">
                  ${data.summary.totalInventoryValue?.toFixed(2) || "0.00"}
                </div>
              </div>
              <div className="bg-blue-50 dark:bg-blue-950/20 rounded-lg p-3">
                <div className="text-xs text-muted-foreground mb-1">
                  Total Items
                </div>
                <div className="text-lg font-bold text-blue-700">
                  {data.summary.totalItems || 0}
                </div>
              </div>
            </div>

            {data.topValuable && data.topValuable.length > 0 && (
              <div className="pt-3 border-t">
                <div className="text-sm font-medium mb-2">
                  Most Valuable Items:
                </div>
                <div className="space-y-2">
                  {data.topValuable
                    .slice(0, 3)
                    .map((item: any, idx: number) => (
                      <div
                        key={idx}
                        className="flex justify-between items-center"
                      >
                        <div>
                          <span className="text-sm font-medium">
                            {item.name}
                          </span>
                          <div className="text-xs text-muted-foreground">
                            Stock: {item.stock}
                          </div>
                        </div>
                        <span className="font-medium text-green-700">
                          ${item.totalValue?.toFixed(2) || "0.00"}
                        </span>
                      </div>
                    ))}
                </div>
              </div>
            )}
          </div>
        );
      }

      // Render sales trend
      if (data.trends && Array.isArray(data.trends)) {
        return (
          <div className="mt-3 bg-background rounded-lg p-4 border space-y-3">
            <div className="text-sm font-medium mb-2">Sales Trend:</div>
            <div className="space-y-2">
              {data.trends.slice(0, 5).map((trend: any, idx: number) => (
                <div key={idx} className="flex justify-between items-center">
                  <span className="text-sm">{trend.period}</span>
                  <div className="flex items-center gap-2">
                    <span className="font-medium">
                      ${trend.totalSales?.toFixed(2) || "0.00"}
                    </span>
                    <span
                      className={`text-xs px-2 py-1 rounded ${
                        trend.change > 0
                          ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                          : trend.change < 0
                          ? "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200"
                          : "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200"
                      }`}
                    >
                      {trend.change > 0 ? "+" : ""}
                      {trend.change?.toFixed(1) || 0}%
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      }

      // Render customers list
      if (data.customers && Array.isArray(data.customers)) {
        return (
          <div className="mt-3 space-y-2">
            {data.customers.map((customer: any, idx: number) => (
              <div key={idx} className="bg-background rounded-lg p-3 border">
                <div className="flex justify-between items-start">
                  <div>
                    <div className="font-medium">{customer.name}</div>
                    <div className="text-sm text-muted-foreground">
                      ID: {customer.id}
                    </div>
                  </div>
                  <div className="text-right text-sm">
                    <div>{customer.orders?.length || 0} orders</div>
                    <div className="text-xs text-muted-foreground">
                      {customer.phone && `📞 ${customer.phone}`}
                      {customer.email && ` 📧 ${customer.email}`}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        );
      }

      // Render orders list
      if (data.orders && Array.isArray(data.orders)) {
        return (
          <div className="mt-3 space-y-2">
            {data.orders.map((order: any, idx: number) => (
              <div key={idx} className="bg-background rounded-lg p-3 border">
                <div className="flex justify-between items-start">
                  <div>
                    <div className="font-medium">Order {order.id}</div>
                    <div className="text-sm text-muted-foreground">
                      Customer: {order.customer?.name}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-medium">
                      ${order.total?.toFixed(2)}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {order.items?.length || 0} items
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        );
      }

      // Generic object rendering
      return (
        <div className="mt-3 bg-background rounded-lg p-3 text-sm border">
          {Object.entries(data).map(([key, value]) => (
            <div key={key} className="flex justify-between py-1">
              <span className="text-muted-foreground capitalize">{key}:</span>
              <span className="font-medium">{String(value)}</span>
            </div>
          ))}
        </div>
      );
    }

    return null;
  };

  const getIcon = (type: string, needsConfirmation?: boolean) => {
    if (type === "user") {
      return (
        <div className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center text-white text-xs">
          U
        </div>
      );
    }

    if (needsConfirmation) {
      return <Edit3 className="w-5 h-5 text-yellow-500" />;
    }

    return <CheckCircle className="w-5 h-5 text-green-500" />;
  };

  const clearConversation = () => {
    setMessages([]);
    setConversationId(null);
    setInput("");
  };

  // Help Modal Component
  const HelpModal = () => (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-background rounded-2xl shadow-xl max-w-2xl w-full max-h-[80vh] overflow-hidden"
      >
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-2xl font-bold">Available Commands</h2>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setShowHelpModal(false)}
            className="rounded-xl"
          >
            <X className="w-5 h-5" />
          </Button>
        </div>

        <div className="p-6 overflow-y-auto max-h-[60vh]">
          <div className="space-y-6">
            {/* Customer Commands */}
            <div>
              <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                <Users className="w-5 h-5 text-blue-500" />
                Customer Management
              </h3>
              <div className="grid gap-3">
                <div className="bg-accent/50 rounded-lg p-4">
                  <h4 className="font-medium mb-2">Create Customer</h4>
                  <p className="text-sm text-muted-foreground mb-2">
                    Create a new customer with name, email, and phone
                  </p>
                  <div className="space-y-1 text-xs">
                    <div className="font-mono bg-background px-2 py-1 rounded">
                      Create customer John
                    </div>
                    <div className="font-mono bg-background px-2 py-1 rounded">
                      Add customer Sarah
                    </div>
                    <div className="font-mono bg-background px-2 py-1 rounded">
                      New customer Mike
                    </div>
                  </div>
                </div>

                <div className="bg-accent/50 rounded-lg p-4">
                  <h4 className="font-medium mb-2">Edit Customer</h4>
                  <p className="text-sm text-muted-foreground mb-2">
                    Edit customer details (name, email, phone)
                  </p>
                  <div className="space-y-1 text-xs">
                    <div className="font-mono bg-background px-2 py-1 rounded">
                      Edit customer c1
                    </div>
                    <div className="font-mono bg-background px-2 py-1 rounded">
                      Update customer John
                    </div>
                    <div className="font-mono bg-background px-2 py-1 rounded">
                      Change customer c2
                    </div>
                  </div>
                </div>

                <div className="bg-accent/50 rounded-lg p-4">
                  <h4 className="font-medium mb-2">Delete Customer</h4>
                  <p className="text-sm text-muted-foreground mb-2">
                    Remove a customer and their orders
                  </p>
                  <div className="space-y-1 text-xs">
                    <div className="font-mono bg-background px-2 py-1 rounded">
                      Delete customer c1
                    </div>
                    <div className="font-mono bg-background px-2 py-1 rounded">
                      Remove customer Sarah
                    </div>
                  </div>
                </div>

                <div className="bg-accent/50 rounded-lg p-4">
                  <h4 className="font-medium mb-2">View Customers</h4>
                  <p className="text-sm text-muted-foreground mb-2">
                    List or view customer details
                  </p>
                  <div className="space-y-1 text-xs">
                    <div className="font-mono bg-background px-2 py-1 rounded">
                      List customers
                    </div>
                    <div className="font-mono bg-background px-2 py-1 rounded">
                      View customer c1
                    </div>
                    <div className="font-mono bg-background px-2 py-1 rounded">
                      Show customers
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Product Commands */}
            <div>
              <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                <Package className="w-5 h-5 text-green-500" />
                Product Management
              </h3>
              <div className="grid gap-3">
                <div className="bg-accent/50 rounded-lg p-4">
                  <h4 className="font-medium mb-2">Create Product</h4>
                  <p className="text-sm text-muted-foreground mb-2">
                    Create a new product with name, description, price, and
                    stock
                  </p>
                  <div className="space-y-1 text-xs">
                    <div className="font-mono bg-background px-2 py-1 rounded">
                      Create product Laptop
                    </div>
                    <div className="font-mono bg-background px-2 py-1 rounded">
                      Add product iPhone
                    </div>
                    <div className="font-mono bg-background px-2 py-1 rounded">
                      New product Monitor
                    </div>
                  </div>
                </div>

                <div className="bg-accent/50 rounded-lg p-4">
                  <h4 className="font-medium mb-2">Edit Product</h4>
                  <p className="text-sm text-muted-foreground mb-2">
                    Edit product details (name, description, price, stock)
                  </p>
                  <div className="space-y-1 text-xs">
                    <div className="font-mono bg-background px-2 py-1 rounded">
                      Edit product p1
                    </div>
                    <div className="font-mono bg-background px-2 py-1 rounded">
                      Update product Laptop
                    </div>
                    <div className="font-mono bg-background px-2 py-1 rounded">
                      Change product p2
                    </div>
                  </div>
                </div>

                <div className="bg-accent/50 rounded-lg p-4">
                  <h4 className="font-medium mb-2">Delete Product</h4>
                  <p className="text-sm text-muted-foreground mb-2">
                    Remove a product
                  </p>
                  <div className="space-y-1 text-xs">
                    <div className="font-mono bg-background px-2 py-1 rounded">
                      Delete product p1
                    </div>
                    <div className="font-mono bg-background px-2 py-1 rounded">
                      Remove product Laptop
                    </div>
                  </div>
                </div>

                <div className="bg-accent/50 rounded-lg p-4">
                  <h4 className="font-medium mb-2">View Products</h4>
                  <p className="text-sm text-muted-foreground mb-2">
                    List or view product details
                  </p>
                  <div className="space-y-1 text-xs">
                    <div className="font-mono bg-background px-2 py-1 rounded">
                      List products
                    </div>
                    <div className="font-mono bg-background px-2 py-1 rounded">
                      View product p1
                    </div>
                    <div className="font-mono bg-background px-2 py-1 rounded">
                      Show products
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Order Commands */}
            <div>
              <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                <ShoppingCart className="w-5 h-5 text-purple-500" />
                Order Management
              </h3>
              <div className="grid gap-3">
                <div className="bg-accent/50 rounded-lg p-4">
                  <h4 className="font-medium mb-2">Create Order</h4>
                  <p className="text-sm text-muted-foreground mb-2">
                    Create a new order for a customer
                  </p>
                  <div className="space-y-1 text-xs">
                    <div className="font-mono bg-background px-2 py-1 rounded">
                      Create order for c1
                    </div>
                    <div className="font-mono bg-background px-2 py-1 rounded">
                      New order for John
                    </div>
                    <div className="font-mono bg-background px-2 py-1 rounded">
                      Add order for customer c2
                    </div>
                  </div>
                </div>

                <div className="bg-accent/50 rounded-lg p-4">
                  <h4 className="font-medium mb-2">View Orders</h4>
                  <p className="text-sm text-muted-foreground mb-2">
                    List or view order details
                  </p>
                  <div className="space-y-1 text-xs">
                    <div className="font-mono bg-background px-2 py-1 rounded">
                      List orders
                    </div>
                    <div className="font-mono bg-background px-2 py-1 rounded">
                      View order o1
                    </div>
                    <div className="font-mono bg-background px-2 py-1 rounded">
                      Show orders for customer c1
                    </div>
                  </div>
                </div>

                <div className="bg-accent/50 rounded-lg p-4">
                  <h4 className="font-medium mb-2">Delete Order</h4>
                  <p className="text-sm text-muted-foreground mb-2">
                    Cancel or remove an order
                  </p>
                  <div className="space-y-1 text-xs">
                    <div className="font-mono bg-background px-2 py-1 rounded">
                      Delete order o1
                    </div>
                    <div className="font-mono bg-background px-2 py-1 rounded">
                      Cancel order o2
                    </div>
                    <div className="font-mono bg-background px-2 py-1 rounded">
                      Remove order o3
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Reports Commands */}
            <div>
              <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-orange-500" />
                Reports & Analytics
              </h3>
              <div className="grid gap-3">
                <div className="bg-accent/50 rounded-lg p-4">
                  <h4 className="font-medium mb-2">Dashboard</h4>
                  <p className="text-sm text-muted-foreground mb-2">
                    Get overview of business performance
                  </p>
                  <div className="space-y-1 text-xs">
                    <div className="font-mono bg-background px-2 py-1 rounded">
                      Show dashboard
                    </div>
                    <div className="font-mono bg-background px-2 py-1 rounded">
                      Get dashboard
                    </div>
                  </div>
                </div>

                <div className="bg-accent/50 rounded-lg p-4">
                  <h4 className="font-medium mb-2">Sales Reports</h4>
                  <p className="text-sm text-muted-foreground mb-2">
                    Daily sales and trends
                  </p>
                  <div className="space-y-1 text-xs">
                    <div className="font-mono bg-background px-2 py-1 rounded">
                      Daily sales
                    </div>
                    <div className="font-mono bg-background px-2 py-1 rounded">
                      Sales trend
                    </div>
                    <div className="font-mono bg-background px-2 py-1 rounded">
                      Sales for 2024-01-15
                    </div>
                  </div>
                </div>

                <div className="bg-accent/50 rounded-lg p-4">
                  <h4 className="font-medium mb-2">Inventory Reports</h4>
                  <p className="text-sm text-muted-foreground mb-2">
                    Stock levels and valuation
                  </p>
                  <div className="space-y-1 text-xs">
                    <div className="font-mono bg-background px-2 py-1 rounded">
                      Low stock report
                    </div>
                    <div className="font-mono bg-background px-2 py-1 rounded">
                      Low stock below 5
                    </div>
                    <div className="font-mono bg-background px-2 py-1 rounded">
                      Inventory valuation
                    </div>
                  </div>
                </div>

                <div className="bg-accent/50 rounded-lg p-4">
                  <h4 className="font-medium mb-2">Customer Reports</h4>
                  <p className="text-sm text-muted-foreground mb-2">
                    Customer purchase history
                  </p>
                  <div className="space-y-1 text-xs">
                    <div className="font-mono bg-background px-2 py-1 rounded">
                      Customer history
                    </div>
                    <div className="font-mono bg-background px-2 py-1 rounded">
                      Customer history for c1
                    </div>
                    <div className="font-mono bg-background px-2 py-1 rounded">
                      Purchase history
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* How to Use */}
            <div className="bg-blue-50 dark:bg-blue-950/20 rounded-lg p-4">
              <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-blue-500" />
                How to Use
              </h3>
              <div className="space-y-2 text-sm">
                <div className="flex items-start gap-2">
                  <div className="w-2 h-2 bg-blue-500 rounded-full mt-2 flex-shrink-0"></div>
                  <p>
                    Type commands in natural language - the AI understands
                    various phrasings
                  </p>
                </div>
                <div className="flex items-start gap-2">
                  <div className="w-2 h-2 bg-blue-500 rounded-full mt-2 flex-shrink-0"></div>
                  <p>Follow the conversational flow when creating or editing</p>
                </div>
                <div className="flex items-start gap-2">
                  <div className="w-2 h-2 bg-blue-500 rounded-full mt-2 flex-shrink-0"></div>
                  <p>
                    Use customer IDs (c1, c2) or names to reference customers
                  </p>
                </div>
                <div className="flex items-start gap-2">
                  <div className="w-2 h-2 bg-blue-500 rounded-full mt-2 flex-shrink-0"></div>
                  <p>Use product IDs (p1, p2) or names to reference products</p>
                </div>
                <div className="flex items-start gap-2">
                  <div className="w-2 h-2 bg-blue-500 rounded-full mt-2 flex-shrink-0"></div>
                  <p>Use order IDs (o1, o2) to reference specific orders</p>
                </div>
                <div className="flex items-start gap-2">
                  <div className="w-2 h-2 bg-blue-500 rounded-full mt-2 flex-shrink-0"></div>
                  <p>
                    Confirm actions when prompted for destructive operations
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="flex justify-end p-6 border-t">
          <Button onClick={() => setShowHelpModal(false)}>Got it!</Button>
        </div>
      </motion.div>
    </div>
  );

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 sm:px-6 h-14 sm:h-16 flex items-center justify-between">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="w-8 h-8 sm:w-10 sm:h-10 bg-primary rounded-xl flex items-center justify-center">
              <Package className="w-4 h-4 sm:w-5 sm:h-5 text-primary-foreground" />
            </div>
            <h1 className="text-lg sm:text-xl font-light font-sans tracking-tight">
              Peninsula AI Assistant
            </h1>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <Button
              variant="outline"
              onClick={() => setShowHelpModal(true)}
              className="rounded-2xl text-xs sm:text-sm px-3 sm:px-4"
            >
              <HelpCircle className="w-4 h-4 mr-2" />
              <span className="hidden sm:inline">Help</span>
            </Button>
            <Button
              variant="outline"
              onClick={clearConversation}
              className="rounded-2xl text-xs sm:text-sm px-3 sm:px-4"
              disabled={isProcessing}
            >
              Clear Chat
            </Button>
            <Button
              variant="outline"
              onClick={toggleViewMode}
              className="rounded-2xl text-xs sm:text-sm px-3 sm:px-4"
            >
              <span className="hidden sm:inline">Traditional View</span>
              <span className="sm:hidden">Traditional</span>
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={logout}
              className="rounded-xl"
            >
              <LogOut className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </header>

      {/* Chat Area */}
      <div className="flex-1 container mx-auto px-4 sm:px-6 py-6 overflow-hidden">
        <div className="max-w-3xl mx-auto h-full flex flex-col">
          {/* Welcome Message */}
          {messages.length === 0 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-center space-y-4 py-12"
            >
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-accent rounded-full text-sm text-accent-foreground">
                <Sparkles className="w-4 h-4" />
                <span>AI-Powered Assistant</span>
              </div>
              <h2 className="text-3xl sm:text-4xl font-bold">
                Customer, Product & Order Management
              </h2>
              <p className="text-muted-foreground text-lg">
                Manage customers, products, orders, and reports with natural
                language commands
              </p>
              <Button
                onClick={() => setShowHelpModal(true)}
                variant="outline"
                className="mt-4"
              >
                <HelpCircle className="w-4 h-4 mr-2" />
                View Available Commands
              </Button>
            </motion.div>
          )}

          {/* Messages */}
          <div className="flex-1 overflow-y-auto space-y-4 mb-4">
            {messages.map((message) => (
              <motion.div
                key={message.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={`flex gap-3 ${
                  message.type === "user" ? "justify-end" : "justify-start"
                }`}
              >
                {message.type === "assistant" && (
                  <div className="flex-shrink-0 mt-1">
                    {getIcon(message.type, message.needsConfirmation)}
                  </div>
                )}
                <div
                  className={`max-w-[80%] rounded-2xl p-4 ${
                    message.type === "user"
                      ? "bg-primary text-primary-foreground"
                      : "bg-card border shadow-medium"
                  }`}
                >
                  {renderMessageContent(message)}
                </div>
                {message.type === "user" && (
                  <div className="flex-shrink-0 mt-1">
                    {getIcon(message.type)}
                  </div>
                )}
              </motion.div>
            ))}
            {isProcessing && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex justify-start gap-3"
              >
                <div className="flex-shrink-0 mt-1">
                  <Loader2 className="w-5 h-5 text-blue-500 animate-spin" />
                </div>
                <div className="bg-card border shadow-medium rounded-2xl p-4">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Processing...
                  </div>
                </div>
              </motion.div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Area */}
          <div className="border-t pt-4">
            <div className="flex gap-2">
              <Textarea
                placeholder="Type your command... (e.g., 'Show dashboard', 'Create customer John', 'Daily sales', 'Low stock report', 'Create order for c1')"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    processCommand(input);
                  }
                }}
                className="flex-1 resize-none min-h-[60px]"
                disabled={isProcessing}
              />
              <Button
                onClick={() => processCommand(input)}
                disabled={!input.trim() || isProcessing}
                className="self-stretch px-6"
                size="lg"
              >
                {isProcessing ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <ArrowRight className="w-4 h-4" />
                )}
              </Button>
            </div>

            {/* Quick Actions */}
            <div className="flex flex-wrap gap-2 mt-3">
              {[
                "Show dashboard",
                "Daily sales",
                "Low stock report",
                "Inventory valuation",
                "Sales trend",
                "Customer history",
                "Create customer Alex",
                "Edit customer c1",
                "Delete customer c2",
                "List customers",
                "View customer c1",
                "Create product Laptop",
                "Edit product p1",
                "List products",
                "Create order for c1",
                "View order o1",
                "List orders",
                "Delete order o2",
              ].map((example) => (
                <Button
                  key={example}
                  variant="outline"
                  size="sm"
                  onClick={() => handleQuickAction(example)}
                  disabled={isProcessing}
                  className="text-xs h-8"
                >
                  {example}
                </Button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Help Modal */}
      {showHelpModal && <HelpModal />}
    </div>
  );
};

export default PromptView;
