import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Plus, Loader2, AlertCircle, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { api } from '@/lib/api';
import OrderForm from '@/components/forms/OrderForm';

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

interface TransformedOrder {
  id: string;
  customer: string;
  date: string;
  status: 'pending' | 'processing' | 'shipped' | 'delivered';
  total: number;
  items: number;
}

const transformOrder = (order: BackendOrder): TransformedOrder => {
  const itemsCount = order.items?.length || 0;
  const date = new Date(order.createdAt).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
  const customerName = order.customer?.name || 'Guest';

  return {
    id: order.id,
    customer: customerName,
    date,
    status: 'processing', // Default status since backend doesn't track status
    total: order.total,
    items: itemsCount,
  };
};

const OrdersView = () => {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editingOrder, setEditingOrder] = useState<any>(null);
  const [deletingOrder, setDeletingOrder] = useState<any>(null);
  const { data: orders, isLoading, error } = useQuery({
    queryKey: ['orders'],
    queryFn: api.orders.getAll,
  });

  const deleteOrderMutation = useMutation({
    mutationFn: api.orders.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
      toast.success('Order deleted successfully');
      setDeletingOrder(null);
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to delete order');
    },
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'delivered':
        return 'bg-green-100 text-green-700';
      case 'shipped':
        return 'bg-blue-100 text-blue-700';
      case 'processing':
        return 'bg-yellow-100 text-yellow-700';
      case 'pending':
        return 'bg-gray-100 text-gray-700';
      default:
        return 'bg-gray-100 text-gray-700';
    }
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

  return (
    <>
      <div className="space-y-4 sm:space-y-6">
        {/* Add Order Button */}
        <div className="flex justify-end">
          <Button 
            onClick={() => {
              setEditingOrder(null);
              setShowForm(true);
            }} 
            className="rounded-2xl"
          >
            <Plus className="w-4 h-4 mr-2" />
            Create Order
          </Button>
        </div>

        {/* Orders Table - Desktop */}
        <div className="hidden md:block bg-card shadow-soft rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left py-4 px-6 font-semibold text-sm text-muted-foreground">Order ID</th>
                  <th className="text-left py-4 px-6 font-semibold text-sm text-muted-foreground">Customer</th>
                  <th className="text-left py-4 px-6 font-semibold text-sm text-muted-foreground">Date</th>
                  <th className="text-left py-4 px-6 font-semibold text-sm text-muted-foreground">Items</th>
                  <th className="text-left py-4 px-6 font-semibold text-sm text-muted-foreground">Total</th>
                  <th className="text-left py-4 px-6 font-semibold text-sm text-muted-foreground">Status</th>
                  <th className="text-left py-4 px-6 font-semibold text-sm text-muted-foreground">Actions</th>
                </tr>
              </thead>
              <tbody>
                {transformedOrders.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-muted-foreground">
                      No orders found
                    </td>
                  </tr>
                ) : (
                  transformedOrders.map((order) => (
                    <tr key={order.id} className="border-t border-border hover:bg-muted/30 transition-colors">
                      <td className="py-4 px-6 text-sm font-medium">{order.id}</td>
                      <td className="py-4 px-6 font-medium">{order.customer}</td>
                      <td className="py-4 px-6 text-muted-foreground">{order.date}</td>
                      <td className="py-4 px-6">{order.items}</td>
                      <td className="py-4 px-6 font-medium">${order.total.toFixed(2)}</td>
                      <td className="py-4 px-6">
                        <span className={`inline-flex px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(order.status)}`}>
                          {order.status}
                        </span>
                      </td>
                      <td className="py-4 px-6">
                        <div className="flex gap-2">
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="rounded-lg"
                            onClick={() => {
                              const rawOrder = orders?.find((o: any) => o.id === order.id);
                              setEditingOrder(rawOrder);
                              setShowForm(true);
                            }}
                          >
                            Edit
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="rounded-lg text-destructive hover:text-destructive"
                            onClick={() => {
                              const rawOrder = orders?.find((o: any) => o.id === order.id);
                              setDeletingOrder(rawOrder);
                            }}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Orders Cards - Mobile */}
        <div className="md:hidden space-y-3">
          {transformedOrders.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">No orders found</div>
          ) : (
            transformedOrders.map((order) => (
              <div key={order.id} className="bg-card shadow-soft rounded-xl p-4 space-y-3">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-semibold text-sm">{order.id}</h3>
                    <p className="text-sm text-muted-foreground">{order.customer}</p>
                  </div>
                  <span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(order.status)}`}>
                    {order.status}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-2 text-sm">
                  <div>
                    <p className="text-muted-foreground text-xs">Items</p>
                    <p className="font-medium">{order.items}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs">Total</p>
                    <p className="font-medium">${order.total.toFixed(2)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs">Date</p>
                    <p className="font-medium text-xs">{order.date}</p>
                  </div>
                </div>
              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="flex-1 rounded-lg"
                  onClick={() => {
                    const rawOrder = orders?.find((o: any) => o.id === order.id);
                    setEditingOrder(rawOrder);
                    setShowForm(true);
                  }}
                >
                  Edit
                </Button>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="rounded-lg text-destructive hover:text-destructive"
                  onClick={() => {
                    const rawOrder = orders?.find((o: any) => o.id === order.id);
                    setDeletingOrder(rawOrder);
                  }}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
              </div>
            ))
          )}
        </div>

        {/* Summary Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
          <div className="bg-card shadow-soft rounded-2xl p-4 sm:p-6">
            <div className="text-xs sm:text-sm text-muted-foreground mb-1">Total Orders</div>
            <div className="text-2xl sm:text-3xl font-bold">{transformedOrders.length}</div>
          </div>
          <div className="bg-card shadow-soft rounded-2xl p-4 sm:p-6">
            <div className="text-xs sm:text-sm text-muted-foreground mb-1">Pending</div>
            <div className="text-2xl sm:text-3xl font-bold text-gray-600">
              {transformedOrders.filter((o) => o.status === 'pending').length}
            </div>
          </div>
          <div className="bg-card shadow-soft rounded-2xl p-4 sm:p-6">
            <div className="text-xs sm:text-sm text-muted-foreground mb-1">Processing</div>
            <div className="text-2xl sm:text-3xl font-bold text-yellow-600">
              {transformedOrders.filter((o) => o.status === 'processing').length}
            </div>
          </div>
          <div className="bg-card shadow-soft rounded-2xl p-4 sm:p-6">
            <div className="text-xs sm:text-sm text-muted-foreground mb-1">Total Revenue</div>
            <div className="text-2xl sm:text-3xl font-bold text-green-600">
              ${transformedOrders.reduce((sum, o) => sum + o.total, 0).toFixed(2)}
            </div>
          </div>
        </div>
      </div>

      <AnimatePresence>
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
      </AnimatePresence>

      <AlertDialog open={!!deletingOrder} onOpenChange={(open) => !open && setDeletingOrder(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Order</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete order <strong>{deletingOrder?.id}</strong>? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteOrderMutation.isPending}>Cancel</AlertDialogCancel>
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
                'Delete'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default OrdersView;
