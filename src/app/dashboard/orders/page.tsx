
'use client';

import React, { useState, useEffect } from 'react';
import { PlusCircle, MoreHorizontal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { PurchaseOrder } from '@/lib/types';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useData } from '@/context/data-context';

type OrderStatus = "Pending" | "Fulfilled" | "Cancelled";

export default function OrdersPage() {
  const { orders, suppliers, products, addOrder, deleteOrder, updateOrderStatus, isLoading } = useData();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [viewingOrder, setViewingOrder] = useState<PurchaseOrder | null>(null);

  useEffect(() => {
    if (isLoading || orders.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            entry.target.classList.add("revealed");
          } else {
            entry.target.classList.remove("revealed");
          }
        });
      },
      {
        root: null,
        threshold: 0.1,
        rootMargin: "0px 0px -10% 0px"
      }
    );

    const items = document.querySelectorAll(".scroll-reveal-item");
    items.forEach(el => observer.observe(el));

    return () => items.forEach(el => observer.unobserve(el));
  }, [orders, isLoading]);


  const handleFormSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const newOrderData = {
      supplierId: formData.get('supplierId') as string,
      status: 'Pending' as OrderStatus,
      orderDate: new Date().toISOString(),
      expectedDeliveryDate: new Date(new Date().setDate(new Date().getDate() + 7)).toISOString(),
      quantity: Number(formData.get('quantity')),
      productId: formData.get('productId') as string,
    };
    
    addOrder(newOrderData);
    setDialogOpen(false);
  };

  const getStatusVariant = (status: OrderStatus): "secondary" | "outline" | "destructive" | "default" => {
    switch (status) {
      case 'Fulfilled':
        return 'secondary';
      case 'Pending':
        return 'outline';
      case 'Cancelled':
        return 'destructive';
      default:
        return 'default';
    }
  };

  return (
    <>
      <div className="flex flex-col gap-6">
        <div className="flex items-center">
          <h1 className="text-lg font-semibold md:text-2xl">Orders</h1>
          <div className="ml-auto flex items-center gap-2">
            <Button
              size="sm"
              className="h-8 gap-1"
              onClick={() => setDialogOpen(true)}
            >
              <PlusCircle className="h-3.5 w-3.5" />
              <span className="sr-only sm:not-sr-only sm:whitespace-nowrap">
                Create Order
              </span>
            </Button>
          </div>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Recent Orders</CardTitle>
            <CardDescription>
              A list of recent purchase orders from your suppliers.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Order</TableHead>
                    <TableHead>Supplier</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="hidden md:table-cell">Date</TableHead>
                    <TableHead className="text-right">Quantity</TableHead>
                    <TableHead>
                      <span className="sr-only">Actions</span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {orders.map((order) => (
                    <TableRow key={order.id} className="scroll-reveal-item">
                      <TableCell className="font-medium">{order.id.substring(0,8)}...</TableCell>
                      <TableCell>{suppliers.find(s => s.id === order.supplierId)?.name || order.supplierId}</TableCell>
                      <TableCell>
                        <Badge variant={getStatusVariant(order.status as OrderStatus)}>
                          {order.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        {new Date(order.orderDate).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="text-right">
                        {order.quantity}
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              aria-haspopup="true"
                              size="icon"
                              variant="ghost"
                            >
                              <MoreHorizontal className="h-4 w-4" />
                              <span className="sr-only">Toggle menu</span>
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuLabel className="bg-primary/10 text-primary text-[10px] uppercase tracking-wider font-bold text-center py-1 rounded-sm mb-1 select-none">Actions</DropdownMenuLabel>
                            <DropdownMenuItem
                              onClick={() => setViewingOrder(order)}
                            >
                              View Details
                            </DropdownMenuItem>
                            {order.status === 'Pending' && (
                              <DropdownMenuItem
                                onClick={() => updateOrderStatus(order.id, 'Fulfilled')}
                              >
                                Mark as Fulfilled
                              </DropdownMenuItem>
                            )}
                             <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <DropdownMenuItem
                                  onSelect={(e) => e.preventDefault()}
                                  className="text-destructive"
                                >
                                  Delete
                                </DropdownMenuItem>
                              </AlertDialogTrigger>
                              <AlertDialogContent className="w-[95vw] sm:max-w-md rounded-xl">
                                <AlertDialogHeader>
                                  <AlertDialogTitle>
                                    Are you sure?
                                  </AlertDialogTitle>
                                  <AlertDialogDescription>
                                    This action cannot be undone. This will
                                    permanently delete the purchase order.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={() => deleteOrder(order.id)}
                                  >
                                    Delete
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* Mobile Card List View */}
            <div className="md:hidden divide-y divide-border/50">
              {orders.map((order) => {
                const supplierName = suppliers.find(s => s.id === order.supplierId)?.name || order.supplierId;
                const productName = products.find(p => p.id === order.productId)?.name || order.productId;
                return (
                  <div key={order.id} className="flex flex-col gap-2 p-4 hover:bg-muted/10 transition-colors">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-sm text-foreground">Order: {order.id.substring(0,8)}...</span>
                      <Badge variant={getStatusVariant(order.status as OrderStatus)}>
                        {order.status}
                      </Badge>
                    </div>
                    <div className="flex flex-col gap-0.5">
                      <p className="text-xs text-muted-foreground"><span className="font-medium text-foreground">Supplier:</span> {supplierName}</p>
                      <p className="text-xs text-muted-foreground"><span className="font-medium text-foreground">Product:</span> {productName}</p>
                    </div>
                    <div className="flex items-center justify-between mt-1 pt-1.5 border-t border-border/20">
                      <span className="text-xs text-muted-foreground">{new Date(order.orderDate).toLocaleDateString()}</span>
                      <div className="flex items-center gap-3">
                        <span className="text-xs font-semibold text-foreground">Qty: {order.quantity}</span>
                        
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              aria-haspopup="true"
                              size="icon"
                              variant="ghost"
                              className="rounded-full h-8 w-8"
                            >
                              <MoreHorizontal className="h-4 w-4" />
                              <span className="sr-only">Toggle menu</span>
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuLabel className="bg-primary/10 text-primary text-[10px] uppercase tracking-wider font-bold text-center py-1 rounded-sm mb-1 select-none">Actions</DropdownMenuLabel>
                            <DropdownMenuItem
                              onClick={() => setViewingOrder(order)}
                            >
                              View Details
                            </DropdownMenuItem>
                            {order.status === 'Pending' && (
                              <DropdownMenuItem
                                onClick={() => updateOrderStatus(order.id, 'Fulfilled')}
                              >
                                Mark as Fulfilled
                              </DropdownMenuItem>
                            )}
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <DropdownMenuItem
                                  onSelect={(e) => e.preventDefault()}
                                  className="text-destructive"
                                >
                                  Delete
                                </DropdownMenuItem>
                              </AlertDialogTrigger>
                              <AlertDialogContent className="w-[95vw] sm:max-w-md rounded-xl">
                                <AlertDialogHeader>
                                  <AlertDialogTitle>
                                    Are you sure?
                                  </AlertDialogTitle>
                                  <AlertDialogDescription>
                                    This action cannot be undone. This will
                                    permanently delete the purchase order.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={() => deleteOrder(order.id)}
                                  >
                                    Delete
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Create Order Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="w-[95vw] sm:max-w-md max-h-[90vh] overflow-y-auto ios-glass">
          <DialogHeader>
            <DialogTitle>Create New Order</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleFormSubmit} className="grid gap-4 py-4">
            <div className="grid grid-cols-1 sm:grid-cols-4 items-center gap-4">
              <Label htmlFor="supplierId" className="sm:text-right">
                Supplier
              </Label>
              <Select name="supplierId" required>
                <SelectTrigger className="sm:col-span-3">
                  <SelectValue placeholder="Select a supplier" />
                </SelectTrigger>
                <SelectContent>
                  {suppliers.map((sup) => (
                    <SelectItem key={sup.id} value={sup.id}>
                      {sup.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
             <div className="grid grid-cols-1 sm:grid-cols-4 items-center gap-4">
              <Label htmlFor="productId" className="sm:text-right">
                Product
              </Label>
              <Select name="productId" required>
                <SelectTrigger className="sm:col-span-3">
                  <SelectValue placeholder="Select a product" />
                </SelectTrigger>
                <SelectContent>
                  {products.map((prod) => (
                    <SelectItem key={prod.id} value={prod.id}>
                      {prod.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-4 items-center gap-4">
              <Label htmlFor="quantity" className="sm:text-right">
                Quantity
              </Label>
              <Input
                id="quantity"
                name="quantity"
                type="number"
                step="1"
                className="sm:col-span-3"
                required
              />
            </div>
            <DialogFooter>
              <DialogClose asChild>
                <Button type="button" variant="secondary">
                  Cancel
                </Button>
              </DialogClose>
              <Button type="submit">Create Order</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* View Order Details Dialog */}
      <Dialog open={!!viewingOrder} onOpenChange={() => setViewingOrder(null)}>
        <DialogContent className="w-[95vw] sm:max-w-md max-h-[90vh] overflow-y-auto ios-glass">
          <DialogHeader>
            <DialogTitle>Order Details</DialogTitle>
            <DialogDescription>Order ID: {viewingOrder?.id.substring(0,8)}...</DialogDescription>
          </DialogHeader>
          {viewingOrder && (
            <div className="space-y-4 py-4">
              <div>
                <Label>Supplier</Label>
                <p className="text-sm text-muted-foreground">{suppliers.find(s => s.id === viewingOrder.supplierId)?.name || viewingOrder.supplierId}</p>
              </div>
               <div>
                <Label>Product</Label>
                <p className="text-sm text-muted-foreground">{products.find(p => p.id === viewingOrder.productId)?.name || viewingOrder.productId}</p>
              </div>
              <div>
                <Label>Date</Label>
                <p className="text-sm text-muted-foreground">{new Date(viewingOrder.orderDate).toLocaleDateString()}</p>
              </div>
              <div>
                <Label>Status</Label>
                <div>
                  <Badge variant={getStatusVariant(viewingOrder.status as OrderStatus)}>
                    {viewingOrder.status}
                  </Badge>
                </div>
              </div>
              <div>
                <Label>Quantity</Label>
                <p className="text-sm text-muted-foreground">{viewingOrder.quantity}</p>
              </div>
            </div>
          )}
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="secondary">
                Close
              </Button>
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
