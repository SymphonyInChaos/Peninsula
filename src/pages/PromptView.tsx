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
  Send,
  Boxes,
  Option,
  PlusCircle,
  ArrowBigDownDash,
  ArrowDown,
  ArrowUp,
  AlertTriangle,
} from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { GridPattern } from "@/components/ui/GridBg";
import { cn } from "@/lib/utils";
import { useNavigate } from "react-router-dom";

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
  const [showHelpModal, setShowHelpModal] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [showCommand, setShowCommand] = useState(false);
  const { toggleViewMode, logout } = useStore();
  const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:5000";
 const navigate = useNavigate();
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
        fieldToEdit: fieldToEdit || lastMessage?.fieldToEdit,
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

      // Render orders for a customer
      if (data.orders && Array.isArray(data.orders)) {
        return (
          <div className="mt-3 space-y-2">
            <div className="text-sm font-medium text-muted-foreground">
              Recent Orders:
            </div>
            {data.orders.map((order: any, idx: number) => (
              <div key={idx} className="bg-background rounded-lg p-3 border">
                <div className="flex justify-between items-start">
                  <div>
                    <div className="font-medium">Order {order.id}</div>
                    <div className="text-sm text-muted-foreground">
                      Total: ${order.total?.toFixed(2)} •{" "}
                      {order.items?.length || 0} items
                    </div>
                  </div>
                  <div className="text-right text-xs text-muted-foreground">
                    {new Date(order.createdAt).toLocaleDateString()}
                  </div>
                </div>
                {order.items && order.items.length > 0 && (
                  <div className="mt-2 pt-2 border-t">
                    {order.items.map((item: any, itemIdx: number) => (
                      <div
                        key={itemIdx}
                        className="flex justify-between text-xs"
                      >
                        <span>
                          {item.product?.name} × {item.qty}
                        </span>
                        <span>
                          ${((item.price || 0) * (item.qty || 0)).toFixed(2)}
                        </span>
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

  // Help Modal Component
  const HelpModal = () => (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-background rounded-2xl shadow-xl max-w-2xl w-full max-h-[80vh] overflow-hidden"
      >
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-2xl font-thin">Available Commands</h2>
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
              <h3 className="text-lg font-thin mb-3 flex items-center gap-2">
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
                  <p>
                    Confirm actions when prompted for destructive operations
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* <div className="flex justify-end p-6 border-t">
          <Button onClick={() => setShowHelpModal(false)}>Got it!</Button>
        </div> */}
      </motion.div>
    </div>
  );

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="border-b border-border bg-card/50 backdrop-blur-[2px] shadow-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 sm:px-6 h-14 sm:h-16 flex items-center justify-between">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="w-6 h-6 sm:w-8 sm:h-8 bg-primary  flex items-center justify-center">
              <Boxes className="w-4 h-4 sm:w-5 sm:h-5 text-primary-foreground" />
            </div>
            <h1 className="text-lg sm:text-xl font-light italic tracking-tight">
              Peninsula

            </h1>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <Button
              variant="outline"
              onClick={() => setShowHelpModal(true)}
              className="text-center text-xs"
            >
              <HelpCircle className="w-4 h-4" />
              <span className="hidden sm:inline">Help</span>
            </Button>
            <Button
              variant="outline"
              onClick={clearConversation}
              className="  text-xs sm:text-sm px-3 sm:px-4"
              disabled={isProcessing}
            >
              Clear Chat
            </Button>
            <Button
              variant="outline"
              onClick={()=>{navigate('/dashboard')}}
              className="rounded-none text-xs sm:text-sm px-3 sm:px-4
             bg-gradient-to-br from-blue-300 via-white to-blue-200
             hover:bg-gradient-to-tl hover:from-blue-200 hover:via-white hover:to-blue-300
             border border-blue-400 hover:border-blue-300
             shadow-sm hover:shadow-md
             transition-all ease-in-out duration-300
             italic font-sans"
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
      <div className="flex flex-col">
        {/* Chat Area */}
        <div className="flex-1 container mx-auto px-4 sm:px-6 py-6 overflow-y-auto">
          <div className="max-w-3xl mx-auto flex flex-col space-y-4  mb-24" >

            {/* Welcome Message */}
            {messages.length === 0 && (
              <motion.div
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.5, ease: "easeOut" }}
                className="text-center space-y-4 py-12"
              >
                <GridPattern
                  width={60}
                  height={60}
                  x={-1}
                  y={-1}
                  strokeDasharray={"4 4"}
                  className={cn(
                    "[mask-image:radial-gradient(400px_circle_at_center,green,transparent)]",
                  )}
                />
                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-md">
                  <span className="italic text-black relative font-thin font-serif">
                    <span className="font-semibold font-sans italic text-purple-700">AI powered</span> Assistant

                    {/* Upward curved underline */}
                    <svg
                      className="absolute left-0 right-0 -bottom-1 mx-auto w-full h-2"
                      viewBox="0 0 100 20"
                      preserveAspectRatio="none"
                    >
                      <path
                        d="M5 15 Q50 0 95 15"
                        stroke="url(#grad)"
                        strokeWidth="2"
                        fill="transparent"
                        strokeLinecap="round"
                      />
                      <defs>
                        <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="0%">
                          <stop offset="0%" stopColor="#cf86efff" />
                          <stop offset="100%" stopColor="#291580ff" />
                        </linearGradient>
                      </defs>
                    </svg>
                  </span>
                </div>



                <h2 className="text-5xl sm:text-6xl font-thin tracking-wide">
                  Everything <span className="font-mono font-semibold italic text-orange-500">at;</span> <br />One Command
                </h2>
                <p className="text-muted-foreground text-sm sm:text-md mt-2">
                  The smartest way to manage customers and products in natural language — just type what you need.
                </p>


                <Button
                  onClick={() => setShowHelpModal(true)}
                  variant="outline"
                  className="mt-4 font-light 
           bg-gradient-to-br from-green-200 via-white to-green-100
           hover:bg-gradient-to-tl hover:from-teal-100 hover:via-white hover:to-teal-200
           border border-green-400
           hover:border-teal-300
           text-black
           shadow-sm hover:shadow-md
           transition-all ease-in-out duration-300
           rounded-md
           z-[1000000]"

                >


                  <HelpCircle className="w-4 h-4 mr-2" />
                  View Available Commands
                </Button>
              </motion.div>
            )}

            {/* Messages */}
            {messages?.map((message) => (
              <motion.div
                key={message.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{
                  duration: 0.35,
                  ease: "easeOut"
                }}
                className={`flex gap-3 ${message.type === "user" ? "justify-end" : "justify-start"
                  }`}
              >
                {message.type === "assistant" && (
                  <div className="flex-shrink-0 mt-1">
                    {getIcon(message.type, message.needsConfirmation)}
                  </div>
                )}

                <motion.div
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, ease: "easeOut" }}
                  className={`max-w-[80%] rounded-2xl p-4 ${message.type === "user"
                    ? "bg-primary text-primary-foreground"
                    : "bg-card border shadow"
                    }`}
                >
                  {renderMessageContent(message)}
                </motion.div>

                {message.type === "user" && (
                  <div className="flex-shrink-0 mt-1">
                    {getIcon(message.type)}
                  </div>
                )}
              </motion.div>
            ))}


            {/* Loading indicator */}
            {isProcessing && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex justify-start gap-3"
              >
                <Loader2 className="w-5 h-5 text-blue-500 animate-spin mt-1" />

                <div className="bg-card border shadow rounded-2xl p-4">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Processing...
                  </div>
                </div>
              </motion.div>
            )}

            <div ref={messagesEndRef} />
            {messages?.length > 0 && (
              <div className="w-full flex justify-center mt-4">
                <div
                  className="flex items-center gap-2  
      px-4 py-2 
      text-xs "
                >
                  <AlertTriangle className="w-4 h-4 text-yellow-700" />
                  <span className="text-center">
                    The responses and actions may not be fully accurate as the system is in beta.
                  </span>
                </div>
              </div>
            )}
            {/* </div> */}


          </div>
        </div>

        {/* Fixed Input Area */}
        <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-3xl px-4 overflow-hidden">
          <div className="bg-background border-t border-r border-l  border-dashed border-black dark:border-white rounded-t-sm shadow-lg shadow-black/20 p-4">

            {/* Input Row */}
            <div className="flex gap-2">
              <Button
                className="bg-white text-black border border-dashed border-black 
               hover:bg-white hover:text-black hover:shadow-md
               transition-all duration-200
               rounded-sm p-3 flex items-center justify-center"
                onClick={() => setShowCommand(!showCommand)}
              >
                {showCommand ? <ArrowDown className="w-4 h-4" /> : <ArrowUp className="w-4 h-4" />}
              </Button>

              <Textarea
                placeholder="Type your command..."
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    processCommand(input);
                  }
                }}
                className="flex-1 resize-none min-h-[60px] rounded-sm "
                disabled={isProcessing}
              />

              <Button
                onClick={() => processCommand(input)}
                disabled={!input.trim() || isProcessing}
                className="self-stretch px-6 bg-white text-black hover:bg-white hover:text-black border border-dashed border-black hover:shadow-md
                           transition-all duration-200
                           rounded-sm flex items-center justify-center"
                size="lg"
              >
                {isProcessing ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
              </Button>

            </div>

            {/* Quick Actions */}
            {showCommand && <div className="my-2 w-full border-t  border-dashed border-gray-400" />}
            <div
              className={`flex flex-wrap gap-2 mt-3 transition-all duration-300 
                ${showCommand ? "opacity-100 max-h-[300px]" : "opacity-0 max-h-0 overflow-hidden"}`}
            >
              {[
                "Create customer Alex",
                "Edit customer c1",
                "Delete customer c2",
                "List customers",
                "View customer c1",
                "Create product Laptop",
                "Edit product p1",
                "List products",
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
