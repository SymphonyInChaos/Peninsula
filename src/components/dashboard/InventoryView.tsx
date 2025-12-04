import { useState } from 'react';
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
import { Plus, Search, Trash2 } from 'lucide-react';
// import InventoryForm from '@/components/forms/InventoryForm';

interface InventoryItem {
  id: string;
  name: string;
  unit: string;
  price: number;
  vendor: string;
  dateIn: string;
  expDate: string;
}

// Mock Data
const mockInventory: InventoryItem[] = [
  { id: 'INV001', name: 'Product A', unit: '10 pcs', price: 15.5, vendor: 'Vendor X', dateIn: '2025-12-01', expDate: '2026-12-01' },
  { id: 'INV002', name: 'Product B', unit: '20 pcs', price: 25.0, vendor: 'Vendor Y', dateIn: '2025-11-20', expDate: '2026-11-20' },
  { id: 'INV003', name: 'Product C', unit: '5 pcs', price: 8.75, vendor: 'Vendor Z', dateIn: '2025-12-03', expDate: '2026-06-03' },
];

const InventoryView = () => {
  const [inventory, setInventory] = useState<InventoryItem[]>(mockInventory);
  const [searchQuery, setSearchQuery] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
  const [deletingItem, setDeletingItem] = useState<InventoryItem | null>(null);

  const filteredInventory = inventory.filter(
    (item) =>
      item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.vendor.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleDelete = (id: string) => {
    setInventory((prev) => prev.filter((item) => item.id !== id));
    setDeletingItem(null);
  };

  return (
    <>
      <div className="space-y-4 sm:space-y-6">
        {/* Actions Bar */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 sm:gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search inventory..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 rounded-xl"
            />
          </div>
          <Button
            onClick={() => {
              setEditingItem(null);
              setShowForm(true);
            }}
            className="rounded-2xl whitespace-nowrap"
          >
            <Plus className="w-4 h-4 mr-2" />
            <span className="hidden sm:inline">Add Item</span>
            <span className="sm:hidden">Add</span>
          </Button>
        </div>

        {/* Desktop Table */}
        <div className="hidden md:block bg-card shadow-soft rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left py-4 px-6 font-semibold text-sm text-muted-foreground">Name</th>
                  <th className="text-left py-4 px-6 font-semibold text-sm text-muted-foreground">Unit / Pcs</th>
                  <th className="text-left py-4 px-6 font-semibold text-sm text-muted-foreground">Price</th>
                  <th className="text-left py-4 px-6 font-semibold text-sm text-muted-foreground">Vendor</th>
                  <th className="text-left py-4 px-6 font-semibold text-sm text-muted-foreground">Date In</th>
                  <th className="text-left py-4 px-6 font-semibold text-sm text-muted-foreground">Expiry Date</th>
                  <th className="text-left py-4 px-6 font-semibold text-sm text-muted-foreground">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredInventory.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-muted-foreground">
                      No items found
                    </td>
                  </tr>
                ) : (
                  filteredInventory.map((item) => (
                    <tr key={item.id} className="border-t border-border hover:bg-muted/30 transition-colors">
                      <td className="py-4 px-6 font-medium">{item.name}</td>
                      <td className="py-4 px-6">{item.unit}</td>
                      <td className="py-4 px-6">${item.price.toFixed(2)}</td>
                      <td className="py-4 px-6">{item.vendor}</td>
                      <td className="py-4 px-6">{item.dateIn}</td>
                      <td className="py-4 px-6">{item.expDate}</td>
                      <td className="py-4 px-6">
                        <div className="flex gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="rounded-lg"
                            onClick={() => {
                              setEditingItem(item);
                              setShowForm(true);
                            }}
                          >
                            Edit
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="rounded-lg text-destructive hover:text-destructive"
                            onClick={() => setDeletingItem(item)}
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

        {/* Mobile Cards */}
        <div className="md:hidden space-y-3">
          {filteredInventory.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">No items found</div>
          ) : (
            filteredInventory.map((item) => (
              <div key={item.id} className="bg-card shadow-soft rounded-xl p-4 space-y-3">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-semibold">{item.name}</h3>
                    <p className="text-sm text-muted-foreground">{item.vendor}</p>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2 text-sm">
                  <div>
                    <p className="text-muted-foreground text-xs">Unit</p>
                    <p className="font-medium">{item.unit}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs">Price</p>
                    <p className="font-medium">${item.price.toFixed(2)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs">Date In</p>
                    <p className="font-medium">{item.dateIn}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs">Expiry</p>
                    <p className="font-medium">{item.expDate}</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 rounded-lg"
                    onClick={() => {
                      setEditingItem(item);
                      setShowForm(true);
                    }}
                  >
                    Edit
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="rounded-lg text-destructive hover:text-destructive"
                    onClick={() => setDeletingItem(item)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* <AnimatePresence>
        {showForm && (
          <InventoryForm
            item={editingItem}
            onClose={() => {
              setShowForm(false);
              setEditingItem(null);
            }}
            onSuccess={(updatedItem: InventoryItem) => {
              if (editingItem) {
                setInventory((prev) =>
                  prev.map((item) => (item.id === updatedItem.id ? updatedItem : item))
                );
              } else {
                setInventory((prev) => [updatedItem, ...prev]);
              }
              setShowForm(false);
              setEditingItem(null);
            }}
          />
        )}
      </AnimatePresence> */}

      <AlertDialog
        open={!!deletingItem}
        onOpenChange={(open) => !open && setDeletingItem(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Inventory Item</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete <strong>{deletingItem?.name}</strong>? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deletingItem && handleDelete(deletingItem.id)}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default InventoryView;
