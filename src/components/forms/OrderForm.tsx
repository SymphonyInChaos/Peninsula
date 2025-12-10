// components/forms/OrderForm.tsx
"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
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
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, ShoppingCart, User, CreditCard, Package } from "lucide-react";

const orderSchema = z.object({
  customerId: z.string().min(1, "Customer is required"),
  items: z.array(
    z.object({
      productId: z.string(),
      quantity: z.number().min(1),
      price: z.number(),
    })
  ),
  total: z.number().min(0),
  paymentMethod: z.enum(["cash", "card", "upi", "wallet", "qr", "other"]),
  status: z
    .enum(["pending", "processing", "completed", "cancelled", "refunded"])
    .optional(),
  notes: z.string().optional(),
});

type OrderFormData = z.infer<typeof orderSchema>;

interface OrderFormProps {
  order?: any;
  onClose: () => void;
  onSuccess: () => void;
}

const OrderForm = ({ order, onClose, onSuccess }: OrderFormProps) => {
  const [selectedProducts, setSelectedProducts] = useState<any[]>(
    order?.items?.map((item: any) => ({
      productId: item.productId,
      name: item.product?.name,
      price: item.price,
      quantity: item.qty,
    })) || []
  );

  const queryClient = useQueryClient();
  const isEditing = !!order;

  const form = useForm<OrderFormData>({
    resolver: zodResolver(orderSchema),
    defaultValues: {
      customerId: order?.customerId || "",
      items:
        order?.items?.map((item: any) => ({
          productId: item.productId,
          quantity: item.qty,
          price: item.price,
        })) || [],
      total: order?.total || 0,
      paymentMethod: order?.paymentMethod || "cash",
      status: order?.status || "pending",
      notes: "",
    },
  });

  const createMutation = useMutation({
    mutationFn: api.orders.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      queryClient.invalidateQueries({ queryKey: ["products"] });
      toast.success("Order created successfully");
      onSuccess();
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to create order");
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) =>
      api.orders.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      queryClient.invalidateQueries({ queryKey: ["products"] });
      toast.success("Order updated successfully");
      onSuccess();
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to update order");
    },
  });

  const onSubmit = (data: OrderFormData) => {
    const orderData = {
      ...data,
      items: selectedProducts.map((product) => ({
        productId: product.productId,
        qty: product.quantity,
        price: product.price,
      })),
      total: selectedProducts.reduce(
        (sum, product) => sum + product.price * product.quantity,
        0
      ),
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
                Edit Order #{order.id.slice(0, 8)}
              </>
            ) : (
              <>
                <ShoppingCart className="w-5 h-5" />
                Create New Order
              </>
            )}
          </DialogTitle>
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
                      <FormLabel>Customer</FormLabel>
                      <Select
                        value={field.value}
                        onValueChange={field.onChange}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select customer" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {/* This would be populated from a customers query */}
                          <SelectItem value="walk-in">
                            Walk-in Customer
                          </SelectItem>
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
                          <SelectItem value="pending">
                            <div className="flex items-center gap-2">
                              <div className="w-2 h-2 rounded-full bg-red-500" />
                              Pending
                            </div>
                          </SelectItem>
                          <SelectItem value="processing">
                            <div className="flex items-center gap-2">
                              <div className="w-2 h-2 rounded-full bg-yellow-500" />
                              Processing
                            </div>
                          </SelectItem>
                          <SelectItem value="completed">
                            <div className="flex items-center gap-2">
                              <div className="w-2 h-2 rounded-full bg-green-500" />
                              Completed
                            </div>
                          </SelectItem>
                          <SelectItem value="cancelled">
                            <div className="flex items-center gap-2">
                              <div className="w-2 h-2 rounded-full bg-gray-500" />
                              Cancelled
                            </div>
                          </SelectItem>
                          <SelectItem value="refunded">
                            <div className="flex items-center gap-2">
                              <div className="w-2 h-2 rounded-full bg-purple-500" />
                              Refunded
                            </div>
                          </SelectItem>
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
                  onClick={() => {
                    // Add product functionality
                    setSelectedProducts([
                      ...selectedProducts,
                      {
                        productId: Date.now().toString(),
                        name: "New Product",
                        price: 0,
                        quantity: 1,
                      },
                    ]);
                  }}
                >
                  Add Product
                </Button>
              </div>

              {/* Products list would go here */}
              <div className="border rounded-lg p-4">
                {selectedProducts.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No products added yet
                  </div>
                ) : (
                  <div className="space-y-3">
                    {selectedProducts.map((product, index) => (
                      <div
                        key={index}
                        className="flex items-center justify-between p-3 bg-muted/30 rounded-lg"
                      >
                        <div className="flex-1">
                          <div className="font-medium">{product.name}</div>
                          <div className="text-sm text-muted-foreground">
                            ₹{product.price} × {product.quantity}
                          </div>
                        </div>
                        <div className="font-semibold">
                          ₹{(product.price * product.quantity).toFixed(2)}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Order Total */}
              <div className="flex justify-end">
                <div className="text-right">
                  <div className="text-sm text-muted-foreground">Total</div>
                  <div className="text-2xl font-bold">
                    ₹
                    {selectedProducts
                      .reduce(
                        (sum, product) =>
                          sum + product.price * product.quantity,
                        0
                      )
                      .toFixed(2)}
                  </div>
                </div>
              </div>
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
              <Button type="submit" disabled={isLoading}>
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
