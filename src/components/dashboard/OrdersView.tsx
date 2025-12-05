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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Plus, Loader2, AlertCircle, Trash2, Edit } from "lucide-react";
import { toast } from "sonner";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { api } from "@/lib/api";
import OrderForm from "@/components/forms/OrderForm";
import { cn } from "@/lib/utils";
import { cva } from "class-variance-authority";

interface BackendOrder {
  id: string;
  customerId: string;
  total: number;
  createdAt: string;
  updatedAt: string;
  paymentMethod: string;
  status: string;
  paymentReference: string;
  cashierId: string;
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
    };
  }>;
}

interface TransformedOrder {
  sequentialId: number;
  id: string;
  customer: string;
  date: string;
  status: "pending" | "processing" | "completed";
  total: number;
  items: number;
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
    switch (backendStatus) {
      case "completed":
        return "completed";
      case "processing":
        return "processing";
      default:
        return "pending";
    }
  };

  const itemsCount = order.items?.length || 0;
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

  return {
    sequentialId: index + 1,
    id: order.id,
    customer: order.customer?.name || `Customer ${order.customerId}`,
    date,
    status: mapStatus(order.status),
    total: order.total,
    items: itemsCount,
    paymentMethod: order.paymentMethod,
    cashier: order.cashierId,
    updatedAt: updatedDate,
  };
};

const OrdersView = () => {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editingOrder, setEditingOrder] = useState<any>(null);
  const [deletingOrder, setDeletingOrder] = useState<any>(null);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [paymentFilter, setPaymentFilter] = useState<string>("all");

  const {
    data: orders,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["orders"],
    queryFn: api.orders.getAll,
  });

  const deleteOrderMutation = useMutation({
    mutationFn: api.orders.delete,
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
        </AlertDescription>
      </Alert>
    );
  }

  const transformedOrders = orders?.map(transformOrder) || [];

  const filteredOrders = transformedOrders.filter((order) => {
    const statusMatch = statusFilter === "all" || order.status === statusFilter;
    const paymentMatch =
      paymentFilter === "all" || order.paymentMethod === paymentFilter;
    return statusMatch && paymentMatch;
  });

  const tableHeaders: { key: keyof TransformedOrder; label: string }[] = [
    { key: "sequentialId", label: "ID" },
    { key: "customer", label: "Customer" },
    { key: "date", label: "Date" },
    { key: "items", label: "Items" },
    { key: "total", label: "Total" },
    { key: "paymentMethod", label: "Payment" },
    { key: "cashier", label: "Cashier" },
    { key: "status", label: "Status" },
  ];

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

        <div className="rounded-lg border bg-card text-card-foreground shadow-sm">
          <div className="relative w-full overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  {tableHeaders.map((header) => (
                    <TableHead key={header.key}>{header.label}</TableHead>
                  ))}
                  <TableHead>Actions</TableHead>
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
                      <TableCell>{order.items}</TableCell>
                      <TableCell className="font-semibold">
                        ${order.total.toFixed(2)}
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
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              const rawOrder = orders?.find(
                                (o: any) => o.id === order.id
                              );
                              setEditingOrder(rawOrder);
                              setShowForm(true);
                            }}
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-destructive hover:text-destructive"
                            onClick={() => {
                              const rawOrder = orders?.find(
                                (o: any) => o.id === order.id
                              );
                              setDeletingOrder(rawOrder);
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
                      colSpan={tableHeaders.length + 1}
                      className="h-24 text-center"
                    >
                      {statusFilter !== "all" || paymentFilter !== "all"
                        ? "No orders match the selected filters."
                        : "No orders found."}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-card rounded-lg border p-6">
            <div className="text-sm text-muted-foreground mb-1">
              Total Orders
            </div>
            <div className="text-3xl font-bold">{filteredOrders.length}</div>
          </div>
          <div className="bg-card rounded-lg border p-6">
            <div className="text-sm text-muted-foreground mb-1">Processing</div>
            <div className="text-3xl font-bold text-yellow-600">
              {filteredOrders.filter((o) => o.status === "processing").length}
            </div>
          </div>
          <div className="bg-card rounded-lg border p-6">
            <div className="text-sm text-muted-foreground mb-1">Completed</div>
            <div className="text-3xl font-bold text-green-600">
              {filteredOrders.filter((o) => o.status === "completed").length}
            </div>
          </div>
          <div className="bg-card rounded-lg border p-6">
            <div className="text-sm text-muted-foreground mb-1">
              Total Revenue
            </div>
            <div className="text-3xl font-bold text-green-600">
              ${filteredOrders.reduce((sum, o) => sum + o.total, 0).toFixed(2)}
            </div>
          </div>
        </div>
      </div>

      {showForm && (
        <OrderForm
          order={editingOrder}
          onClose={() => {
            setShowForm(false);
            setEditingOrder(null);
          }}
          onSuccess={() => {
            setShowForm(false);
            setEditingOrder(null);
          }}
        />
      )}

      <AlertDialog
        open={!!deletingOrder}
        onOpenChange={(open) => !open && setDeletingOrder(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Order</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this order? This action cannot be
              undone.
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
