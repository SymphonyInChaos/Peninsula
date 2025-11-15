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
  Eye
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
  fieldToEdit?: string;
}

const PromptView = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
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

      const response = await fetch(`${API_BASE}/api/commands`, {
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
          fieldToEdit: data.fieldToEdit,
        });
      } else {
        addMessage({
          type: "assistant",
          content: data.error || data.response || "Sorry, I encountered an error. Please try again.",
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

  const handleConfirmation = async (confirmed: boolean, actionType?: string, customerData?: any, fieldToEdit?: string) => {
    // Get the last message that needs confirmation
    const lastMessage = [...messages].reverse().find(msg => msg.needsConfirmation);
    
    if (!conversationId) {
      addMessage({
        type: "assistant",
        content: "I'm not sure what you're confirming. Please try your command again.",
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
        fieldToEdit: fieldToEdit || lastMessage?.fieldToEdit
      };

      console.log("Sending confirmation:", confirmBody);

      const response = await fetch(`${API_BASE}/api/commands/confirm`, {
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
        fieldToEdit: message.fieldToEdit,
        conversationId: conversationId
      });

      return (
        <div className="space-y-3">
          <p className="whitespace-pre-line">{message.content}</p>
          <div className="flex gap-2">
            <Button
              onClick={() => handleConfirmation(true, message.actionType, message.customerData, message.fieldToEdit)}
              disabled={isProcessing}
              className="bg-green-600 hover:bg-green-700"
            >
              {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : "Yes, proceed"}
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
            <div key={idx} className="bg-background rounded-lg p-3 text-sm border">
              {item.name && (
                <div className="font-medium text-base mb-1">{item.name}</div>
              )}
              {item.available !== undefined && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Stock:</span>
                  <span className={item.available > 0 ? "text-green-600" : "text-red-600"}>
                    {item.available} available
                  </span>
                </div>
              )}
              {item.price && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Price:</span>
                  <span>${typeof item.price === 'number' ? item.price.toFixed(2) : item.price}</span>
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

      // Render customers list
      if (data.customers && Array.isArray(data.customers)) {
        return (
          <div className="mt-3 space-y-2">
            {data.customers.map((customer: any, idx: number) => (
              <div key={idx} className="bg-background rounded-lg p-3 border">
                <div className="flex justify-between items-start">
                  <div>
                    <div className="font-medium">{customer.name}</div>
                    <div className="text-sm text-muted-foreground">ID: {customer.id}</div>
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

      // Render orders for a customer
      if (data.orders && Array.isArray(data.orders)) {
        return (
          <div className="mt-3 space-y-2">
            <div className="text-sm font-medium text-muted-foreground">Recent Orders:</div>
            {data.orders.map((order: any, idx: number) => (
              <div key={idx} className="bg-background rounded-lg p-3 border">
                <div className="flex justify-between items-start">
                  <div>
                    <div className="font-medium">Order {order.id}</div>
                    <div className="text-sm text-muted-foreground">
                      Total: ${order.total?.toFixed(2)} • {order.items?.length || 0} items
                    </div>
                  </div>
                  <div className="text-right text-xs text-muted-foreground">
                    {new Date(order.createdAt).toLocaleDateString()}
                  </div>
                </div>
                {order.items && order.items.length > 0 && (
                  <div className="mt-2 pt-2 border-t">
                    {order.items.map((item: any, itemIdx: number) => (
                      <div key={itemIdx} className="flex justify-between text-xs">
                        <span>{item.product?.name} × {item.qty}</span>
                        <span>${((item.price || 0) * (item.qty || 0)).toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                )}
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
                Customer Management
              </h2>
              <p className="text-muted-foreground text-lg">
                Create, edit, delete, and manage your customers with natural language
              </p>
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
                placeholder="Type your command... (e.g., 'Create customer John', 'Edit customer c1', 'Delete customer Sarah', 'List customers', 'View customer c1')"
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
                "Create customer Alex",
                "Edit customer c1",
                "Delete customer c2", 
                "List customers",
                "View customer c1"
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
    </div>
  );
};

export default PromptView;