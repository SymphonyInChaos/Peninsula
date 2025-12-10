"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Plus,
  Loader2,
  AlertCircle,
  Trash2,
  Edit,
  Clock,
  CheckCircle2,
  Truck,
  XCircle,
  RotateCcw,
  MoreVertical,
} from "lucide-react";
import { toast } from "sonner";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { api } from "@/lib/api";
import OrderForm from "@/components/forms/OrderForm";
import { cn } from "@/lib/utils";
import { cva } from "class-variance-authority";

// Define proper types for the API response
interface BackendOrder {
  id: string;
  customerId: string | null;
  total: number;
  createdAt: string;
  updatedAt: string;
  paymentMethod: string;
  status: string;
  paymentReference: string | null;
  cashierId: string | null;
  customer?: {
    id: string;
    name: string;
    phone?: string | null;
    email?: string | null;
  };
  items?: Array<{
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
      sku?: string;
      category?: string;
    };
  }>;
}

interface PaginatedResponse {
  orders: BackendOrder[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    pages: number;
  };
}

interface TransformedOrder {
  sequentialId: number;
  id: string;
  customer: string;
  date: string;
  status: "pending" | "processing" | "completed" | "cancelled" | "refunded";
  total: number;
  items: {
    count: number;
    details: Array<{
      name: string;
      quantity: number;
      price: number;
      total: number;
    }>;
  };
  paymentMethod: string;
  cashier: string;
  updatedAt: string;
}

const badgeVariants = cva("capitalize text-white", {
  variants: {
    variant: {
      completed: "bg-green-500 hover:bg-green-600",
      processing: "bg-yellow-500 hover:bg-yellow-600",
      pending: "bg-red-500 hover:bg-red-600",
      cancelled: "bg-gray-500 hover:bg-gray-600",
      refunded: "bg-purple-500 hover:bg-purple-600",
    },
  },
  defaultVariants: {
    variant: "pending",
  },
});

const transformOrder = (
  order: BackendOrder,
  index: number
): TransformedOrder => {
  const mapStatus = (backendStatus: string): TransformedOrder["status"] => {
    const status = backendStatus.toLowerCase();
    if (status.includes("complete") || status.includes("delivered")) {
      return "completed";
    }
    if (
      status.includes("process") ||
      status.includes("confirm") ||
      status.includes("ship")
    ) {
      return "processing";
    }
    if (status.includes("pending") || status.includes("new")) {
      return "pending";
    }
    if (status.includes("cancel")) {
      return "cancelled";
    }
    if (status.includes("refund")) {
      return "refunded";
    }
    return "pending";
  };

  // Extract item details
  const itemDetails =
    order.items?.map((item) => ({
      name: item.product?.name || "Unknown Product",
      quantity: item.qty,
      price: item.price,
      total: item.qty * item.price,
    })) || [];

  const date = new Date(order.createdAt).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });

  const updatedDate = new Date(order.updatedAt).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });

  const paymentMethod = order.paymentMethod?.toLowerCase() || "cash";
  const uiPaymentMethod = ["cash", "card", "upi", "wallet", "qr"].includes(
    paymentMethod
  )
    ? paymentMethod
    : "other";

  return {
    sequentialId: index + 1,
    id: order.id,
    customer:
      order.customer?.name ||
      (order.customerId ? `Customer ${order.customerId}` : "Walk-in Customer"),
    date,
    status: mapStatus(order.status),
    total: order.total,
    items: {
      count: itemDetails.length,
      details: itemDetails,
    },
    paymentMethod: uiPaymentMethod,
    cashier: order.cashierId || "System",
    updatedAt: updatedDate,
  };
};

// Status card component
const StatusCard = ({
  title,
  count,
  totalAmount,
  status,
  className,
}: {
  title: string;
  count: number;
  totalAmount: number;
  status: "pending" | "processing" | "completed" | "cancelled" | "refunded";
  className?: string;
}) => {
  const statusConfig = {
    pending: {
      bgColor: "bg-red-50 border-red-200",
      textColor: "text-red-600",
      amountColor: "text-red-700",
      icon: "⏳",
    },
    processing: {
      bgColor: "bg-yellow-50 border-yellow-200",
      textColor: "text-yellow-600",
      amountColor: "text-yellow-700",
      icon: "🔄",
    },
    completed: {
      bgColor: "bg-green-50 border-green-200",
      textColor: "text-green-600",
      amountColor: "text-green-700",
      icon: "✅",
    },
    cancelled: {
      bgColor: "bg-gray-50 border-gray-200",
      textColor: "text-gray-600",
      amountColor: "text-gray-700",
      icon: "❌",
    },
    refunded: {
      bgColor: "bg-purple-50 border-purple-200",
      textColor: "text-purple-600",
      amountColor: "text-purple-700",
      icon: "↩️",
    },
  };

  const config = statusConfig[status];

  return (
    <div className={cn("rounded-lg border p-6", config.bgColor, className)}>
      <div className="flex items-start justify-between">
        <div>
          <div className="text-sm text-muted-foreground mb-1">{title}</div>
          <div className="text-3xl font-bold">{count}</div>
          <div className="text-sm text-muted-foreground mt-2">Orders</div>
        </div>
        <div className="text-2xl">{config.icon}</div>
      </div>
      <div className="mt-4 pt-4 border-t border-border/50">
        <div className="text-sm text-muted-foreground">Total Amount</div>
        <div className={cn("text-xl font-semibold", config.amountColor)}>
          ₹{totalAmount.toFixed(2)}
        </div>
      </div>
    </div>
  );
};

const OrdersView = () => {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editingOrder, setEditingOrder] = useState<BackendOrder | null>(null);
  const [deletingOrder, setDeletingOrder] = useState<BackendOrder | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [paymentFilter, setPaymentFilter] = useState<string>("all");

  // Fix the useQuery hook with proper types
  const {
    data: ordersData,
    isLoading,
    error,
  } = useQuery<BackendOrder[]>({
    queryKey: ["orders"],
    queryFn: async () => {
      try {
        const response = await api.orders.getAll();
        // Handle different response structures
        if (Array.isArray(response)) {
          return response;
        }
        // Backend returns { orders: [], pagination: {} }
        return (response as PaginatedResponse)?.orders || [];
      } catch (err) {
        console.error("Error fetching orders:", err);
        throw err;
      }
    },
    refetchOnWindowFocus: false,
    retry: 2,
  });

  const deleteOrderMutation = useMutation({
    mutationFn: (id: string) => api.orders.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      queryClient.invalidateQueries({ queryKey: ["products"] });
      toast.success("Order deleted successfully");
      setDeletingOrder(null);
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to delete order");
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({
      orderId,
      status,
    }: {
      orderId: string;
      status: string;
    }) => {
      return api.orders.updateStatus(orderId, status);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      toast.success("Order status updated successfully");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to update order status");
    },
  });

  const rowVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: (i: number) => ({
      opacity: 1,
      y: 0,
      transition: {
        delay: i * 0.05,
        duration: 0.3,
        ease: "easeInOut",
      },
    }),
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          Failed to load orders. Please make sure the backend server is running.
          Error: {error.message}
        </AlertDescription>
      </Alert>
    );
  }

  const orders = ordersData || [];
  const transformedOrders = orders.map(transformOrder);

  const filteredOrders = transformedOrders.filter((order) => {
    const statusMatch = statusFilter === "all" || order.status === statusFilter;
    const paymentMatch =
      paymentFilter === "all" || order.paymentMethod === paymentFilter;
    return statusMatch && paymentMatch;
  });

  // Calculate statistics
  const pendingOrders = transformedOrders.filter((o) => o.status === "pending");
  const processingOrders = transformedOrders.filter(
    (o) => o.status === "processing"
  );
  const completedOrders = transformedOrders.filter(
    (o) => o.status === "completed"
  );
  const cancelledOrders = transformedOrders.filter(
    (o) => o.status === "cancelled"
  );
  const refundedOrders = transformedOrders.filter(
    (o) => o.status === "refunded"
  );

  const pendingTotal = pendingOrders.reduce((sum, o) => sum + o.total, 0);
  const processingTotal = processingOrders.reduce((sum, o) => sum + o.total, 0);
  const completedTotal = completedOrders.reduce((sum, o) => sum + o.total, 0);
  const cancelledTotal = cancelledOrders.reduce((sum, o) => sum + o.total, 0);
  const refundedTotal = refundedOrders.reduce((sum, o) => sum + o.total, 0);
  const allOrdersTotal = transformedOrders.reduce((sum, o) => sum + o.total, 0);

  const tableHeaders = [
    { key: "sequentialId", label: "ID" },
    { key: "customer", label: "Customer" },
    { key: "date", label: "Date" },
    { key: "items", label: "Items" },
    { key: "total", label: "Total" },
    { key: "paymentMethod", label: "Payment" },
    { key: "cashier", label: "Cashier" },
    { key: "status", label: "Status" },
    { key: "actions", label: "Actions" },
  ];

  const handleStatusUpdate = (orderId: string, status: string) => {
    updateStatusMutation.mutate({ orderId, status });
  };

  return (
    <>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Orders</h1>
            <p className="text-muted-foreground">
              Manage and track all your orders
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              onClick={() => {
                setEditingOrder(null);
                setShowForm(true);
              }}
            >
              <Plus className="w-4 h-4 mr-2" />
              Create Order
            </Button>
          </div>
        </div>

        {/* Order Status Statistics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          {/* All Orders Card */}
          <div className="bg-card rounded-lg border p-6">
            <div className="flex items-start justify-between">
              <div>
                <div className="text-sm text-muted-foreground mb-1">
                  Total Orders
                </div>
                <div className="text-3xl font-bold">
                  {transformedOrders.length}
                </div>
                <div className="text-sm text-muted-foreground mt-2">
                  All Statuses
                </div>
              </div>
              <div className="text-2xl">📦</div>
            </div>
            <div className="mt-4 pt-4 border-t border-border/50">
              <div className="text-sm text-muted-foreground">Total Revenue</div>
              <div className="text-xl font-semibold text-green-600">
                ₹{allOrdersTotal.toFixed(2)}
              </div>
            </div>
          </div>

          {/* Status-specific cards */}
          <StatusCard
            title="Pending"
            count={pendingOrders.length}
            totalAmount={pendingTotal}
            status="pending"
          />

          <StatusCard
            title="Processing"
            count={processingOrders.length}
            totalAmount={processingTotal}
            status="processing"
          />

          <StatusCard
            title="Completed"
            count={completedOrders.length}
            totalAmount={completedTotal}
            status="completed"
          />

          <StatusCard
            title="Cancelled"
            count={cancelledOrders.length}
            totalAmount={cancelledTotal}
            status="cancelled"
          />

          <StatusCard
            title="Refunded"
            count={refundedOrders.length}
            totalAmount={refundedTotal}
            status="refunded"
          />
        </div>

        {/* Filters */}
        <div className="flex gap-4 items-center">
          <div className="flex-1 max-w-xs">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Filter by Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="processing">Processing</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
                <SelectItem value="refunded">Refunded</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex-1 max-w-xs">
            <Select value={paymentFilter} onValueChange={setPaymentFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Filter by Payment" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Payments</SelectItem>
                <SelectItem value="cash">Cash</SelectItem>
                <SelectItem value="card">Card</SelectItem>
                <SelectItem value="upi">UPI</SelectItem>
                <SelectItem value="wallet">Wallet</SelectItem>
                <SelectItem value="qr">QR</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {(statusFilter !== "all" || paymentFilter !== "all") && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setStatusFilter("all");
                setPaymentFilter("all");
              }}
            >
              Clear Filters
            </Button>
          )}
        </div>

        {/* Orders Table */}
        <div className="rounded-lg border bg-card text-card-foreground shadow-sm">
          <div className="relative w-full overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  {tableHeaders.map((header) => (
                    <TableHead key={header.key}>{header.label}</TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredOrders.length > 0 ? (
                  filteredOrders.map((order, index) => (
                    <motion.tr
                      key={order.id}
                      custom={index}
                      initial="hidden"
                      animate="visible"
                      variants={rowVariants}
                      className="border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted"
                    >
                      <TableCell className="font-medium">
                        {order.sequentialId}
                      </TableCell>
                      <TableCell className="font-medium">
                        {order.customer}
                      </TableCell>
                      <TableCell>{order.date}</TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-medium">
                            {order.items.count} items
                          </span>
                          <div className="text-xs text-muted-foreground mt-1 space-y-0.5">
                            {order.items.details
                              .slice(0, 2)
                              .map((item, idx) => (
                                <div key={idx} className="flex justify-between">
                                  <span>
                                    {item.name} × {item.quantity}
                                  </span>
                                  <span>₹{item.total.toFixed(2)}</span>
                                </div>
                              ))}
                            {order.items.details.length > 2 && (
                              <div className="text-xs italic">
                                +{order.items.details.length - 2} more items
                              </div>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="font-semibold">
                        ₹{order.total.toFixed(2)}
                      </TableCell>
                      <TableCell>
                        <span className="capitalize">
                          {order.paymentMethod}
                        </span>
                      </TableCell>
                      <TableCell>{order.cashier}</TableCell>
                      <TableCell>
                        <Badge
                          className={cn(
                            badgeVariants({ variant: order.status })
                          )}
                        >
                          {order.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          {/* Status Dropdown */}
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                disabled={updateStatusMutation.isPending}
                              >
                                {updateStatusMutation.isPending ? (
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                  <MoreVertical className="w-4 h-4" />
                                )}
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem
                                onClick={() =>
                                  handleStatusUpdate(order.id, "pending")
                                }
                              >
                                <Clock className="w-4 h-4 mr-2" />
                                Set Pending
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() =>
                                  handleStatusUpdate(order.id, "processing")
                                }
                              >
                                <Truck className="w-4 h-4 mr-2" />
                                Set Processing
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() =>
                                  handleStatusUpdate(order.id, "completed")
                                }
                              >
                                <CheckCircle2 className="w-4 h-4 mr-2" />
                                Set Completed
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() =>
                                  handleStatusUpdate(order.id, "cancelled")
                                }
                              >
                                <XCircle className="w-4 h-4 mr-2" />
                                Set Cancelled
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() =>
                                  handleStatusUpdate(order.id, "refunded")
                                }
                              >
                                <RotateCcw className="w-4 h-4 mr-2" />
                                Set Refunded
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>

                          {/* Edit Button */}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              const rawOrder = orders.find(
                                (o) => o.id === order.id
                              );
                              setEditingOrder(rawOrder || null);
                              setShowForm(true);
                            }}
                          >
                            <Edit className="w-4 h-4" />
                          </Button>

                          {/* Delete Button */}
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-destructive hover:text-destructive"
                            onClick={() => {
                              const rawOrder = orders.find(
                                (o) => o.id === order.id
                              );
                              setDeletingOrder(rawOrder || null);
                            }}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </motion.tr>
                  ))
                ) : (
                  <TableRow>
                    <TableCell
                      colSpan={tableHeaders.length}
                      className="h-24 text-center"
                    >
                      {transformedOrders.length === 0
                        ? "No orders found. Try creating a new order or check if the backend is running."
                        : statusFilter !== "all" || paymentFilter !== "all"
                        ? "No orders match the selected filters."
                        : "No orders found."}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      </div>

      {/* Order Form Modal */}
      {showForm && (
        <OrderForm
          order={editingOrder}
          onClose={() => {
            setShowForm(false);
            setEditingOrder(null);
          }}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ["orders"] });
            setShowForm(false);
            setEditingOrder(null);
          }}
        />
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog
        open={!!deletingOrder}
        onOpenChange={(open) => !open && setDeletingOrder(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Order</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this order? This action cannot be
              undone. This will also restore product stock.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteOrderMutation.isPending}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deletingOrder) {
                  deleteOrderMutation.mutate(deletingOrder.id);
                }
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleteOrderMutation.isPending}
            >
              {deleteOrderMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Deleting...
                </>
              ) : (
                "Delete"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default OrdersView;
