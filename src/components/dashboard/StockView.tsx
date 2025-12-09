import React, { useState, useEffect, useCallback } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  RefreshCw,
  Package,
  TrendingDown,
  TrendingUp,
  ArrowUpDown,
  AlertTriangle,
} from "lucide-react";
import { api } from "@/lib/api";

const StockView = () => {
  const [movements, setMovements] = useState([]);
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [typeFilter, setTypeFilter] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");

  // Fetch stock movements
  const fetchMovements = useCallback(async () => {
    try {
      setLoading(true);
      const data = await api.stockMovements.getAll(
        typeFilter !== "all" ? typeFilter : undefined
      );
      setMovements(data || []);
      setError(null);
    } catch (err) {
      console.error("Error fetching stock movements:", err);
      setError("Failed to fetch stock movements");
    } finally {
      setLoading(false);
    }
  }, [typeFilter]);

  // Fetch stock report
  const fetchReport = async () => {
    try {
      const data = await api.stockMovements.getReport();
      setReport(data);
    } catch (err) {
      console.error("Error fetching stock report:", err);
    }
  };

  // Seed sample data
  const seedData = async () => {
    try {
      setLoading(true);
      await api.stockMovements.seedSampleData();
      await fetchMovements();
      await fetchReport();
    } catch (err) {
      console.error("Error seeding data:", err);
      setError("Failed to seed data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMovements();
    fetchReport();
  }, [fetchMovements]);

  // Get badge variant based on movement type
  const getTypeBadge = (type) => {
    const variants = {
      sale: {
        className: "bg-red-100 text-red-800 hover:bg-red-100",
        icon: TrendingDown,
      },
      restock: {
        className: "bg-green-100 text-green-800 hover:bg-green-100",
        icon: TrendingUp,
      },
      adjustment: {
        className: "bg-yellow-100 text-yellow-800 hover:bg-yellow-100",
        icon: ArrowUpDown,
      },
      refund: {
        className: "bg-blue-100 text-blue-800 hover:bg-blue-100",
        icon: AlertTriangle,
      },
    };
    const variant = variants[type] || {
      className: "bg-gray-100 text-gray-800",
      icon: Package,
    };
    const Icon = variant.icon;
    return (
      <Badge className={variant.className} data-testid={`badge-${type}`}>
        <Icon className="w-3 h-3 mr-1" />
        {type.charAt(0).toUpperCase() + type.slice(1)}
      </Badge>
    );
  };

  // Format date
  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  // Filter movements by search term
  const filteredMovements = movements.filter((movement) => {
    if (!searchTerm) return true;
    const search = searchTerm.toLowerCase();
    return (
      movement.productName?.toLowerCase().includes(search) ||
      movement.reason?.toLowerCase().includes(search) ||
      movement.id.toLowerCase().includes(search)
    );
  });

  return (
    <div
      className="p-6 space-y-6 bg-gray-50 min-h-screen"
      data-testid="stock-view"
    >
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1
            className="text-3xl font-bold text-gray-900"
            data-testid="stock-view-title"
          >
            Stock Movements
          </h1>
          <p className="text-gray-600 mt-1">
            Track and manage inventory changes
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={seedData}
            disabled={loading}
            data-testid="seed-data-btn"
          >
            <Package className="w-4 h-4 mr-2" />
            Seed Sample Data
          </Button>
          <Button
            onClick={() => {
              fetchMovements();
              fetchReport();
            }}
            disabled={loading}
            data-testid="refresh-btn"
          >
            <RefreshCw
              className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`}
            />
            Refresh
          </Button>
        </div>
      </div>

      {/* Stock Report Summary */}
      {report && (
        <div
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4"
          data-testid="stock-report"
        >
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Total Movements</CardDescription>
              <CardTitle className="text-2xl" data-testid="total-movements">
                {report.totalMovements}
              </CardTitle>
            </CardHeader>
          </Card>
          <Card className="border-red-200 bg-red-50">
            <CardHeader className="pb-2">
              <CardDescription className="text-red-700">Sales</CardDescription>
              <CardTitle
                className="text-2xl text-red-800"
                data-testid="total-sales"
              >
                {report.totalSales} ({report.totalQuantitySold} units)
              </CardTitle>
            </CardHeader>
          </Card>
          <Card className="border-green-200 bg-green-50">
            <CardHeader className="pb-2">
              <CardDescription className="text-green-700">
                Restocks
              </CardDescription>
              <CardTitle
                className="text-2xl text-green-800"
                data-testid="total-restocks"
              >
                {report.totalRestocks} ({report.totalQuantityRestocked} units)
              </CardTitle>
            </CardHeader>
          </Card>
          <Card className="border-yellow-200 bg-yellow-50">
            <CardHeader className="pb-2">
              <CardDescription className="text-yellow-700">
                Adjustments
              </CardDescription>
              <CardTitle
                className="text-2xl text-yellow-800"
                data-testid="total-adjustments"
              >
                {report.totalAdjustments} ({report.totalQuantityAdjusted} units)
              </CardTitle>
            </CardHeader>
          </Card>
          <Card className="border-blue-200 bg-blue-50">
            <CardHeader className="pb-2">
              <CardDescription className="text-blue-700">
                Refunds
              </CardDescription>
              <CardTitle
                className="text-2xl text-blue-800"
                data-testid="total-refunds"
              >
                {report.totalRefunds} ({report.totalQuantityRefunded} units)
              </CardTitle>
            </CardHeader>
          </Card>
        </div>
      )}

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4">
            <div className="w-64">
              <Select
                value={typeFilter}
                onValueChange={setTypeFilter}
                data-testid="type-filter"
              >
                <SelectTrigger>
                  <SelectValue placeholder="Filter by type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="sale">Sale</SelectItem>
                  <SelectItem value="restock">Restock</SelectItem>
                  <SelectItem value="adjustment">Adjustment</SelectItem>
                  <SelectItem value="refund">Refund</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex-1 min-w-64">
              <Input
                placeholder="Search by product name, reason, or ID..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                data-testid="search-input"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Error Display */}
      {error && (
        <Card className="border-red-300 bg-red-50">
          <CardContent className="pt-6">
            <p className="text-red-700" data-testid="error-message">
              {error}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Stock Movements Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="w-5 h-5" />
            Stock Movement Records
            <Badge variant="secondary" className="ml-2">
              {filteredMovements.length} records
            </Badge>
          </CardTitle>
          <CardDescription>
            Complete history of all stock movements including sales, restocks,
            adjustments, and refunds
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div
              className="flex justify-center items-center py-12"
              data-testid="loading-spinner"
            >
              <RefreshCw className="w-8 h-8 animate-spin text-gray-400" />
              <span className="ml-2 text-gray-500">Loading...</span>
            </div>
          ) : filteredMovements.length === 0 ? (
            <div className="text-center py-12" data-testid="no-data">
              <Package className="w-12 h-12 mx-auto text-gray-300" />
              <p className="mt-4 text-gray-500">No stock movements found</p>
              <Button
                variant="outline"
                className="mt-4"
                onClick={seedData}
                data-testid="seed-data-empty-btn"
              >
                Seed Sample Data
              </Button>
            </div>
          ) : (
            <div className="rounded-md border" data-testid="stock-table">
              <Table>
                <TableHeader>
                  <TableRow className="bg-gray-50">
                    <TableHead className="font-semibold">ID</TableHead>
                    <TableHead className="font-semibold">Product</TableHead>
                    <TableHead className="font-semibold">Type</TableHead>
                    <TableHead className="font-semibold text-right">
                      Quantity
                    </TableHead>
                    <TableHead className="font-semibold text-right">
                      Old Stock
                    </TableHead>
                    <TableHead className="font-semibold text-right">
                      New Stock
                    </TableHead>
                    <TableHead className="font-semibold">Reason</TableHead>
                    <TableHead className="font-semibold">Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredMovements.map((movement) => (
                    <TableRow
                      key={movement.id}
                      data-testid={`movement-row-${movement.id}`}
                    >
                      <TableCell className="font-mono text-xs text-gray-500">
                        {movement.id.substring(0, 12)}...
                      </TableCell>
                      <TableCell className="font-medium">
                        {movement.productName || "Unknown Product"}
                      </TableCell>
                      <TableCell>{getTypeBadge(movement.type)}</TableCell>
                      <TableCell className="text-right font-semibold">
                        <span
                          className={
                            movement.type === "sale" ||
                            movement.type === "adjustment"
                              ? "text-red-600"
                              : "text-green-600"
                          }
                        >
                          {movement.type === "sale"
                            ? "-"
                            : movement.type === "restock" ||
                              movement.type === "refund"
                            ? "+"
                            : ""}
                          {Math.abs(movement.quantity)}
                        </span>
                      </TableCell>
                      <TableCell className="text-right text-gray-600">
                        {movement.oldStock}
                      </TableCell>
                      <TableCell className="text-right">
                        <span
                          className={
                            movement.newStock < movement.oldStock
                              ? "text-red-600 font-medium"
                              : "text-green-600 font-medium"
                          }
                        >
                          {movement.newStock}
                        </span>
                      </TableCell>
                      <TableCell className="text-gray-600 max-w-xs truncate">
                        {movement.reason || "-"}
                      </TableCell>
                      <TableCell className="text-gray-500 text-sm">
                        {formatDate(movement.createdAt)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default StockView;
