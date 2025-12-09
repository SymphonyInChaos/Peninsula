import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { Mail, Search, Loader2, AlertCircle, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { Alert, AlertDescription } from "@/components/ui/alert";
import CustomerForm from "@/components/forms/CustomerForm";

interface BackendCustomer {
  id: string;
  name: string;
  phone?: string | null;
  email?: string | null;
  createdAt: string;
  orders: Array<{
    id: string;
    total: number;
  }>;
}

interface TransformedCustomer {
  id: string; // Display ID (1,2,3...)
  originalId: string; // Backend UUID for API calls
  name: string;
  email: string;
  orders: number;
  totalSpent: number;
  joinedDate: string;
}

const CustomersView = () => {
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingCustomer, setEditingCustomer] =
    useState<BackendCustomer | null>(null);
  const [deletingCustomer, setDeletingCustomer] =
    useState<BackendCustomer | null>(null);

  const {
    data: customers,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["customers"],
    queryFn: api.customers.getAll,
  });

  // Transform customers with sequential IDs
  const transformedCustomers = useMemo((): TransformedCustomer[] => {
    if (!customers) return [];

    return customers.map((customer, index) => {
      const ordersCount = customer.orders?.length || 0;
      const totalSpent =
        customer.orders?.reduce((sum, order) => sum + order.total, 0) || 0;
      const joinedDate = new Date(customer.createdAt).toLocaleDateString(
        "en-US",
        {
          year: "numeric",
          month: "short",
          day: "numeric",
        }
      );

      return {
        id: (index + 1).toString(), // Display ID starting from 1
        originalId: customer.id, // Keep original ID for API calls
        name: customer.name,
        email: customer.email || "N/A",
        orders: ordersCount,
        totalSpent,
        joinedDate,
      };
    });
  }, [customers]);

  // Filter customers based on search query
  const filteredCustomers = useMemo(() => {
    if (!searchQuery) return transformedCustomers;

    const query = searchQuery.toLowerCase();
    return transformedCustomers.filter(
      (customer) =>
        customer.name.toLowerCase().includes(query) ||
        customer.email.toLowerCase().includes(query)
    );
  }, [transformedCustomers, searchQuery]);

  // Find original customer by display ID
  const getOriginalCustomer = (
    displayId: string
  ): BackendCustomer | undefined => {
    const index = parseInt(displayId) - 1;
    return customers?.[index];
  };

  const deleteCustomerMutation = useMutation({
    mutationFn: api.customers.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      toast.success("Customer deleted successfully");
      setDeletingCustomer(null);
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to delete customer");
    },
  });

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
          Failed to load customers. Please make sure the backend server is
          running.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <>
      <div className="space-y-4 sm:space-y-6">
        {/* Actions Bar */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 sm:gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search customers by name or email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 rounded-xl"
            />
          </div>
          <Button
            onClick={() => {
              setEditingCustomer(null);
              setShowForm(true);
            }}
            className="rounded-2xl whitespace-nowrap"
          >
            Add Customer
          </Button>
        </div>

        {/* Customers Table - Desktop */}
        <div className="hidden md:block bg-card shadow-soft rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left py-4 px-6 font-semibold text-sm text-muted-foreground">
                    #
                  </th>
                  <th className="text-left py-4 px-6 font-semibold text-sm text-muted-foreground">
                    Name
                  </th>
                  <th className="text-left py-4 px-6 font-semibold text-sm text-muted-foreground">
                    Email
                  </th>
                  <th className="text-left py-4 px-6 font-semibold text-sm text-muted-foreground">
                    Orders
                  </th>
                  <th className="text-left py-4 px-6 font-semibold text-sm text-muted-foreground">
                    Total Spent
                  </th>
                  <th className="text-left py-4 px-6 font-semibold text-sm text-muted-foreground">
                    Joined
                  </th>
                  <th className="text-left py-4 px-6 font-semibold text-sm text-muted-foreground">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredCustomers.length === 0 ? (
                  <tr>
                    <td
                      colSpan={7}
                      className="py-8 text-center text-muted-foreground"
                    >
                      {searchQuery
                        ? "No customers match your search"
                        : "No customers found"}
                    </td>
                  </tr>
                ) : (
                  filteredCustomers.map((customer) => (
                    <tr
                      key={customer.id}
                      className="border-t border-border hover:bg-muted/30 transition-colors"
                    >
                      <td className="py-4 px-6 text-sm font-medium">
                        {customer.id}
                      </td>
                      <td className="py-4 px-6 font-medium">{customer.name}</td>
                      <td className="py-4 px-6 text-muted-foreground">
                        <div className="flex items-center gap-2">
                          <Mail className="w-4 h-4" />
                          {customer.email}
                        </div>
                      </td>
                      <td className="py-4 px-6">{customer.orders}</td>
                      <td className="py-4 px-6 font-medium">
                        ${customer.totalSpent.toFixed(2)}
                      </td>
                      <td className="py-4 px-6 text-muted-foreground">
                        {customer.joinedDate}
                      </td>
                      <td className="py-4 px-6">
                        <div className="flex gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="rounded-lg"
                            onClick={() => {
                              const originalCustomer = getOriginalCustomer(
                                customer.id
                              );
                              setEditingCustomer(originalCustomer || null);
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
                              const originalCustomer = getOriginalCustomer(
                                customer.id
                              );
                              setDeletingCustomer(originalCustomer || null);
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

        {/* Customers Cards - Mobile */}
        <div className="md:hidden space-y-3">
          {filteredCustomers.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              {searchQuery
                ? "No customers match your search"
                : "No customers found"}
            </div>
          ) : (
            filteredCustomers.map((customer) => (
              <div
                key={customer.id}
                className="bg-card shadow-soft rounded-xl p-4 space-y-3"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-semibold">{customer.name}</h3>
                    <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                      <Mail className="w-3 h-3" />
                      {customer.email}
                    </p>
                  </div>
                </div>
                <div className="grid grid-cols-4 gap-2 text-sm">
                  <div>
                    <p className="text-muted-foreground text-xs">#</p>
                    <p className="font-medium">{customer.id}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs">Orders</p>
                    <p className="font-medium">{customer.orders}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs">Spent</p>
                    <p className="font-medium">
                      ${customer.totalSpent.toFixed(2)}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs">Joined</p>
                    <p className="font-medium text-xs">{customer.joinedDate}</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 rounded-lg"
                    onClick={() => {
                      const originalCustomer = getOriginalCustomer(customer.id);
                      setEditingCustomer(originalCustomer || null);
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
                      const originalCustomer = getOriginalCustomer(customer.id);
                      setDeletingCustomer(originalCustomer || null);
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
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
          <div className="bg-card shadow-soft rounded-2xl p-4 sm:p-6">
            <div className="text-xs sm:text-sm text-muted-foreground mb-1">
              Total Customers
            </div>
            <div className="text-2xl sm:text-3xl font-bold">
              {transformedCustomers.length}
            </div>
          </div>
          <div className="bg-card shadow-soft rounded-2xl p-4 sm:p-6">
            <div className="text-xs sm:text-sm text-muted-foreground mb-1">
              Avg. Orders per Customer
            </div>
            <div className="text-2xl sm:text-3xl font-bold">
              {transformedCustomers.length > 0
                ? (
                    transformedCustomers.reduce((sum, c) => sum + c.orders, 0) /
                    transformedCustomers.length
                  ).toFixed(1)
                : "0"}
            </div>
          </div>
          <div className="bg-card shadow-soft rounded-2xl p-4 sm:p-6">
            <div className="text-xs sm:text-sm text-muted-foreground mb-1">
              Total Customer Value
            </div>
            <div className="text-2xl sm:text-3xl font-bold text-green-600">
              $
              {transformedCustomers
                .reduce((sum, c) => sum + c.totalSpent, 0)
                .toFixed(2)}
            </div>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {showForm && (
          <CustomerForm
            customer={editingCustomer}
            onClose={() => {
              setShowForm(false);
              setEditingCustomer(null);
            }}
            onSuccess={() => {
              setShowForm(false);
              setEditingCustomer(null);
            }}
          />
        )}
      </AnimatePresence>

      <AlertDialog
        open={!!deletingCustomer}
        onOpenChange={(open) => !open && setDeletingCustomer(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Customer</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete{" "}
              <strong>{deletingCustomer?.name}</strong>? This will also delete
              all associated orders. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteCustomerMutation.isPending}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deletingCustomer) {
                  deleteCustomerMutation.mutate(deletingCustomer.id);
                }
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleteCustomerMutation.isPending}
            >
              {deleteCustomerMutation.isPending ? (
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

export default CustomersView;
