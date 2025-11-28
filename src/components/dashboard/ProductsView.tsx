import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
import { Plus, Search, Loader2, AlertCircle, Trash2 } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import ProductForm from '@/components/forms/ProductForm';

interface BackendProduct {
  id: string;
  name: string;
  price: number;
  stock: number;
  createdAt: string;
  updatedAt: string;
}

interface TransformedProduct {
  id: string;
  name: string;
  category: string;
  stock: number;
  price: number;
  status: 'in-stock' | 'low-stock' | 'out-of-stock';
}

const getStatusFromStock = (stock: number): 'in-stock' | 'low-stock' | 'out-of-stock' => {
  if (stock === 0) return 'out-of-stock';
  if (stock < 20) return 'low-stock';
  return 'in-stock';
};

const transformProduct = (product: BackendProduct): TransformedProduct => {
  return {
    id: product.id,
    name: product.name,
    category: 'General', // Default category since backend doesn't have it
    stock: product.stock,
    price: product.price,
    status: getStatusFromStock(product.stock),
  };
};

const ProductsView = () => {
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingProduct, setEditingProduct] = useState<any>(null);
  const [deletingProduct, setDeletingProduct] = useState<any>(null);
  const { data: products, isLoading, error } = useQuery({
    queryKey: ['products'],
    queryFn: api.products.getAll,
  });

  const deleteProductMutation = useMutation({
    mutationFn: api.products.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      toast.success('Product deleted successfully');
      setDeletingProduct(null);
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to delete product');
    },
  });

  const transformedProducts = products?.map(transformProduct) || [];
  const filteredProducts = transformedProducts.filter(
    (product) =>
      product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      product.category.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'in-stock':
        return 'bg-green-100 text-green-700';
      case 'low-stock':
        return 'bg-yellow-100 text-yellow-700';
      case 'out-of-stock':
        return 'bg-red-100 text-red-700';
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
          Failed to load products. Please make sure the backend server is running.
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
              placeholder="Search products..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 rounded-xl"
            />
          </div>
          <Button 
            onClick={() => {
              setEditingProduct(null);
              setShowForm(true);
            }} 
            className="rounded-2xl whitespace-nowrap"
          >
            <Plus className="w-4 h-4 mr-2" />
            <span className="hidden sm:inline">Add Product</span>
            <span className="sm:hidden">Add</span>
          </Button>
        </div>

        {/* Products Table - Desktop */}
        <div className="hidden md:block bg-card shadow-soft rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left py-4 px-6 font-semibold text-sm text-muted-foreground">ID</th>
                  <th className="text-left py-4 px-6 font-semibold text-sm text-muted-foreground">Product Name</th>
                  <th className="text-left py-4 px-6 font-semibold text-sm text-muted-foreground">Category</th>
                  <th className="text-left py-4 px-6 font-semibold text-sm text-muted-foreground">Stock</th>
                  <th className="text-left py-4 px-6 font-semibold text-sm text-muted-foreground">Price</th>
                  <th className="text-left py-4 px-6 font-semibold text-sm text-muted-foreground">Status</th>
                  <th className="text-left py-4 px-6 font-semibold text-sm text-muted-foreground">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredProducts.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-muted-foreground">
                      No products found
                    </td>
                  </tr>
                ) : (
                  filteredProducts.map((product) => (
                    <tr key={product.id} className="border-t border-border hover:bg-muted/30 transition-colors">
                      <td className="py-4 px-6 text-sm font-medium">{product.id}</td>
                      <td className="py-4 px-6 font-medium">{product.name}</td>
                      <td className="py-4 px-6 text-muted-foreground">{product.category}</td>
                      <td className="py-4 px-6">{product.stock}</td>
                      <td className="py-4 px-6">${product.price.toFixed(2)}</td>
                      <td className="py-4 px-6">
                        <span className={`inline-flex px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(product.status)}`}>
                          {product.status}
                        </span>
                      </td>
                    <td className="py-4 px-6">
                      <div className="flex gap-2">
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="rounded-lg"
                          onClick={() => {
                            const rawProduct = products?.find((p: any) => p.id === product.id);
                            setEditingProduct(rawProduct);
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
                            const rawProduct = products?.find((p: any) => p.id === product.id);
                            setDeletingProduct(rawProduct);
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

        {/* Products Cards - Mobile */}
        <div className="md:hidden space-y-3">
          {filteredProducts.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">No products found</div>
          ) : (
            filteredProducts.map((product) => (
              <div key={product.id} className="bg-card shadow-soft rounded-xl p-4 space-y-3">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-semibold">{product.name}</h3>
                    <p className="text-sm text-muted-foreground">{product.category}</p>
                  </div>
                  <span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(product.status)}`}>
                    {product.status}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-2 text-sm">
                  <div>
                    <p className="text-muted-foreground text-xs">Stock</p>
                    <p className="font-medium">{product.stock}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs">Price</p>
                    <p className="font-medium">${product.price.toFixed(2)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs">ID</p>
                    <p className="font-medium text-xs">{product.id}</p>
                  </div>
                </div>
              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="flex-1 rounded-lg"
                  onClick={() => {
                    const rawProduct = products?.find((p: any) => p.id === product.id);
                    setEditingProduct(rawProduct);
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
                    const rawProduct = products?.find((p: any) => p.id === product.id);
                    setDeletingProduct(rawProduct);
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
            <div className="text-xs sm:text-sm text-muted-foreground mb-1">Total Products</div>
            <div className="text-2xl sm:text-3xl font-bold">{transformedProducts.length}</div>
          </div>
          <div className="bg-card shadow-soft rounded-2xl p-4 sm:p-6">
            <div className="text-xs sm:text-sm text-muted-foreground mb-1">Low Stock Items</div>
            <div className="text-2xl sm:text-3xl font-bold text-yellow-600">
              {transformedProducts.filter((p) => p.status === 'low-stock').length}
            </div>
          </div>
          <div className="bg-card shadow-soft rounded-2xl p-4 sm:p-6">
            <div className="text-xs sm:text-sm text-muted-foreground mb-1">Out of Stock</div>
            <div className="text-2xl sm:text-3xl font-bold text-red-600">
              {transformedProducts.filter((p) => p.status === 'out-of-stock').length}
            </div>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {showForm && (
          <ProductForm 
            product={editingProduct}
            onClose={() => {
              setShowForm(false);
              setEditingProduct(null);
            }} 
            onSuccess={() => {
              setShowForm(false);
              setEditingProduct(null);
            }} 
          />
        )}
      </AnimatePresence>

      <AlertDialog open={!!deletingProduct} onOpenChange={(open) => !open && setDeletingProduct(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Product</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete <strong>{deletingProduct?.name}</strong>? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteProductMutation.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deletingProduct) {
                  deleteProductMutation.mutate(deletingProduct.id);
                }
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleteProductMutation.isPending}
            >
              {deleteProductMutation.isPending ? (
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

export default ProductsView;
