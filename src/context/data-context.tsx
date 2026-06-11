
'use client';

import React, { createContext, useContext, useState, ReactNode, useMemo, useCallback, useEffect } from 'react';
import type { Product, PurchaseOrder, Supplier, Transaction, Category } from '@/lib/types';
import { mockProducts } from '@/lib/mock-products';
import { mockOrders } from '@/lib/mock-orders';
import { mockSuppliers } from '@/lib/mock-suppliers';
import { mockTransactions } from '@/lib/mock-transactions';
import { useToast } from '@/hooks/use-toast';
import { useUser, useFirestore } from '@/firebase';
import { collection, addDoc, updateDoc, deleteDoc, doc, serverTimestamp, writeBatch, getDocs, query, limit } from 'firebase/firestore';
import { useCollection } from '@/firebase/firestore/use-collection';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';


// Mock categories for the form dropdowns
const mockCategories: Category[] = [
    { id: 'tops', name: 'Tops', description: '' },
    { id: 'bottoms', name: 'Bottoms', description: '' },
    { id: 'accessories', name: 'Accessories', description: '' },
    { id: 'essentials', name: 'Essentials', description: '' },
];


interface DataContextProps {
  products: Product[];
  orders: PurchaseOrder[];
  suppliers: Supplier[];
  transactions: Transaction[];
  categories: Category[];
  addProduct: (product: Omit<Product, 'id' | 'createdAt' | 'updatedAt' | 'userId'>) => Promise<void>;
  updateProduct: (product: Product) => Promise<void>;
  deleteProduct: (productId: string) => Promise<void>;
  addOrder: (order: Omit<PurchaseOrder, 'id' | 'createdAt' | 'updatedAt' | 'userId'>) => Promise<void>;
  deleteOrder: (orderId: string) => Promise<void>;
  updateOrderStatus: (orderId: string, status: string) => Promise<void>;
  addSupplier: (supplier: Omit<Supplier, 'id' | 'createdAt' | 'updatedAt' | 'userId'>) => Promise<void>;
  deleteSupplier: (supplierId: string) => Promise<void>;
  addCategory: (category: Omit<Category, 'id' | 'userId'>) => Promise<void>;
  addTransaction: (transaction: Omit<Transaction, 'id' | 'createdAt' | 'updatedAt' | 'tenantId'>) => Promise<void>;
  recordSale: (productId: string, quantity: number) => Promise<void>;
  bulkAddProducts: (products: Omit<Product, 'id' | 'createdAt' | 'updatedAt' | 'userId'>[]) => Promise<void>;
  bulkAddTransactions: (transactions: Omit<Transaction, 'id' | 'createdAt' | 'updatedAt' | 'tenantId'>[]) => Promise<void>;
  clearAllData: () => Promise<void>;
  isLoading: boolean;
}

const DataContext = createContext<DataContextProps | undefined>(undefined);

// Helper function to remove duplicates from an array of objects by a given key
const uniqueBy = <T extends Record<string, any>>(array: T[] | null, key: keyof T): T[] => {
  if (!array) return [];
  return Array.from(new Map(array.map(item => [item[key], item])).values());
}


// Helper function to remove undefined values from an object for Firestore compatibility
const cleanObject = (obj: any) => {
  const result: any = {};
  Object.keys(obj).forEach((key) => {
    if (obj[key] !== undefined) {
      result[key] = obj[key];
    }
  });
  return result;
};


export const DataProvider = ({ children }: { children: ReactNode }) => {
  const { toast } = useToast();
  const { user } = useUser();
  const firestore = useFirestore();

  const productsRef = useMemo(() => user && firestore ? collection(firestore, 'users', user.uid, 'products') : null, [user, firestore]);
  const ordersRef = useMemo(() => user && firestore ? collection(firestore, 'users', user.uid, 'orders') : null, [user, firestore]);
  const suppliersRef = useMemo(() => user && firestore ? collection(firestore, 'users', user.uid, 'suppliers') : null, [user, firestore]);
  const transactionsRef = useMemo(() => user && firestore ? collection(firestore, 'users', user.uid, 'transactions') : null, [user, firestore]);
  const categoriesRef = useMemo(() => user && firestore ? collection(firestore, 'users', user.uid, 'categories') : null, [user, firestore]);

  const { data: productsData, loading: productsLoading } = useCollection<Product>(productsRef);
  const { data: ordersData, loading: ordersLoading } = useCollection<PurchaseOrder>(ordersRef);
  const { data: suppliersData, loading: suppliersLoading } = useCollection<Supplier>(suppliersRef);
  const { data: transactionsData, loading: transactionsLoading } = useCollection<Transaction>(transactionsRef);
  const { data: categoriesData, loading: categoriesLoading } = useCollection<Category>(categoriesRef);

  const products = useMemo(() => uniqueBy(productsData, 'id'), [productsData]);
  const orders = useMemo(() => uniqueBy(ordersData, 'id'), [ordersData]);
  const suppliers = useMemo(() => uniqueBy(suppliersData, 'name'), [suppliersData]);
  const transactions = useMemo(() => uniqueBy(transactionsData, 'id'), [transactionsData]);
  const categories = useMemo(() => uniqueBy(categoriesData, 'name'), [categoriesData]);

  const isLoading = productsLoading || ordersLoading || suppliersLoading || transactionsLoading || categoriesLoading;

  const addCategory = useCallback(async (categoryData: Omit<Category, 'id' | 'userId'>) => {
     if (!firestore || !user || !categoriesRef) {
        toast({ variant: 'destructive', title: 'Error', description: 'Could not add category.' });
        throw new Error("Not authenticated");
    }
    const newCategory = {
      ...categoryData,
      userId: user.uid,
    };
    addDoc(categoriesRef, newCategory).catch((serverError) => {
        errorEmitter.emit('permission-error', new FirestorePermissionError({
            path: categoriesRef.path,
            operation: 'create',
            requestResourceData: newCategory,
        }));
    });
  }, [firestore, user, categoriesRef, toast]);


  const addProduct = useCallback(async (productData: Omit<Product, 'id' | 'createdAt' | 'updatedAt' | 'userId'>) => {
    if (!firestore || !user || !productsRef || !transactionsRef) return;
    
    const batch = writeBatch(firestore);
    const newProductRef = doc(productsRef);
    
    const newProduct = {
      ...productData,
      userId: user.uid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      averageDailySales: Math.floor(Math.random() * 10) + 1,
      leadTimeDays: Math.floor(Math.random() * 10) + 5,
    };
    batch.set(newProductRef, newProduct);

    if (newProduct.stock > 0) {
      const transRef = doc(transactionsRef);
      batch.set(transRef, {
        userId: user.uid,
        productId: newProductRef.id,
        locationId: 'MAIN-WAREHOUSE',
        type: 'Purchase',
        quantity: newProduct.stock,
        transactionDate: serverTimestamp(),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }

    await batch.commit().catch((serverError) => {
        errorEmitter.emit('permission-error', new FirestorePermissionError({
            path: productsRef.path,
            operation: 'create',
            requestResourceData: newProduct,
        }));
    });
    toast({ title: 'Product Added', description: `${productData.name} has been added.` });
  }, [firestore, user, productsRef, transactionsRef, toast]);

  const addTransaction = useCallback(async (transactionData: Omit<Transaction, 'id' | 'createdAt' | 'updatedAt' | 'tenantId'>) => {
    if (!firestore || !user || !transactionsRef) {
      toast({ variant: 'destructive', title: 'Error', description: 'Could not add transaction.' });
      throw new Error("Not authenticated");
    }

    const newTransaction = cleanObject({
      ...transactionData,
      tenantId: user.uid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    try {
      await addDoc(transactionsRef, newTransaction);
    } catch (serverError: any) {
      errorEmitter.emit('permission-error', new FirestorePermissionError({
        path: transactionsRef.path,
        operation: 'create',
        requestResourceData: newTransaction,
      }));
    }
  }, [firestore, user, transactionsRef, toast]);
  
  const bulkAddProducts = useCallback(async (productsData: Omit<Product, 'id' | 'createdAt' | 'updatedAt' | 'userId'>[]) => {
    if (!firestore || !user || !productsRef || !transactionsRef) return;
    
    const batch = writeBatch(firestore);
    
    productsData.forEach(productData => {
      const newProductRef = doc(productsRef);
      const newProduct = {
        ...productData,
        userId: user.uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        averageDailySales: Math.floor(Math.random() * 10) + 1,
        leadTimeDays: Math.floor(Math.random() * 10) + 5,
      };
      batch.set(newProductRef, newProduct);

      if (newProduct.stock > 0) {
        const transRef = doc(transactionsRef);
        batch.set(transRef, {
          userId: user.uid,
          productId: newProductRef.id,
          locationId: 'MAIN-WAREHOUSE',
          type: 'Purchase',
          quantity: newProduct.stock,
          transactionDate: serverTimestamp(),
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }
    });
    
    await batch.commit().catch((serverError) => {
      errorEmitter.emit('permission-error', new FirestorePermissionError({
        path: productsRef.path,
        operation: 'create',
        requestResourceData: 'Bulk Product Add',
      }));
    });
    
    toast({ title: 'Bulk Import Success', description: `${productsData.length} products have been imported.` });
  }, [firestore, user, productsRef, transactionsRef, toast]);

  const bulkUpdateProducts = useCallback(async (updates: (Partial<Product> & { id: string })[]) => {
    if (!firestore || !user || !productsRef) return;
    
    const batch = writeBatch(firestore);
    
    updates.forEach(update => {
      const productRef = doc(productsRef, update.id);
      batch.update(productRef, {
        ...update,
        updatedAt: serverTimestamp(),
      });
    });
    
    await batch.commit().catch((serverError) => {
      console.error("Bulk update failed:", serverError);
    });
  }, [firestore, user, productsRef]);

  const bulkAddTransactions = useCallback(async (transactionsData: Omit<Transaction, 'id' | 'createdAt' | 'updatedAt' | 'tenantId'>[]) => {
    if (!firestore || !user || !transactionsRef) return;
    
    const batch = writeBatch(firestore);
    
    transactionsData.forEach(transactionData => {
      const newTransactionRef = doc(transactionsRef);
      const newTransaction = cleanObject({
        ...transactionData,
        tenantId: user.uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      batch.set(newTransactionRef, newTransaction);
    });
    
    await batch.commit().catch((serverError) => {
      errorEmitter.emit('permission-error', new FirestorePermissionError({
        path: transactionsRef.path,
        operation: 'create',
        requestResourceData: 'Bulk Transaction Add',
      }));
    });
    
    toast({ title: 'Transactions Imported', description: `${transactionsData.length} records have been added.` });
  }, [firestore, user, transactionsRef, toast]);

  const updateProduct = useCallback(async (updatedProduct: Product) => {
    if (!firestore || !user) return;
    const productRef = doc(firestore, 'users', user.uid, 'products', updatedProduct.id);
    const { id, ...updateData } = updatedProduct;
    const dataToUpdate = { ...updateData, updatedAt: serverTimestamp() };
    updateDoc(productRef, dataToUpdate).catch((serverError) => {
        errorEmitter.emit('permission-error', new FirestorePermissionError({
            path: productRef.path,
            operation: 'update',
            requestResourceData: dataToUpdate,
        }));
    });
    toast({ title: 'Product Updated', description: `${updatedProduct.name} has been updated.` });
  }, [firestore, user, toast]);
  
  const deleteProduct = useCallback(async (productId: string) => {
    if (!firestore || !user) return;
    const productRef = doc(firestore, 'users', user.uid, 'products', productId);
    deleteDoc(productRef).catch((serverError) => {
        errorEmitter.emit('permission-error', new FirestorePermissionError({
            path: productRef.path,
            operation: 'delete',
        }));
    });
    toast({ title: 'Product Deleted', description: 'The product has been removed.' });
  }, [firestore, user, toast]);

  const addOrder = useCallback(async (orderData: Omit<PurchaseOrder, 'id' | 'createdAt' | 'updatedAt' | 'userId'>) => {
    if (!firestore || !user || !ordersRef || !transactionsRef) return;

    const batch = writeBatch(firestore);
    
    const newOrderRef = doc(ordersRef);
    const newOrder = cleanObject({
        ...orderData,
        id: newOrderRef.id,
        userId: user.uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
    });
    batch.set(newOrderRef, newOrder);

    // If order is created as Fulfilled, handle stock reduction immediately
    if (orderData.status === 'Fulfilled') {
        const productRef = doc(firestore, 'users', user.uid, 'products', orderData.productId);
        const product = products.find(p => p.id === orderData.productId);
        if (product) {
            batch.update(productRef, { 
                stock: Math.max(0, product.stock - orderData.quantity),
                updatedAt: serverTimestamp()
            });

            const transactionRef = doc(transactionsRef);
            batch.set(transactionRef, cleanObject({
                id: transactionRef.id,
                tenantId: user.uid,
                productId: product.id,
                productName: product.name,
                sku: product.sku,
                category: product.categoryId,
                locationId: 'MAIN-WAREHOUSE',
                type: 'Sale',
                quantity: orderData.quantity,
                price: product.price,
                transactionDate: serverTimestamp(),
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
            }));
        }
    }

    await batch.commit().catch((serverError) => {
        errorEmitter.emit('permission-error', new FirestorePermissionError({
            path: 'batch-write',
            operation: 'create',
            requestResourceData: { order: newOrder },
        }));
    });
    const supplierName = suppliers.find(s => s.id === newOrder.supplierId)?.name || 'the customer';
    toast({ title: 'Order Created', description: `New order for ${supplierName} has been recorded.` });
  }, [firestore, user, ordersRef, suppliers, toast]);

  const deleteOrder = useCallback(async (orderId: string) => {
    if (!firestore || !user) return;
    const orderRef = doc(firestore, 'users', user.uid, 'orders', orderId);
    deleteDoc(orderRef).catch((serverError) => {
        errorEmitter.emit('permission-error', new FirestorePermissionError({
            path: orderRef.path,
            operation: 'delete',
        }));
    });
    toast({ title: 'Order Deleted', description: 'The purchase order has been removed.' });
  }, [firestore, user, toast]);

  const updateOrderStatus = useCallback(async (orderId: string, status: string) => {
    if (!firestore || !user || !transactionsRef) return;
    const orderRef = doc(firestore, 'users', user.uid, 'orders', orderId);
    const orderToUpdate = orders.find(o => o.id === orderId);
    if (!orderToUpdate) return;

    const batch = writeBatch(firestore);
    
    batch.update(orderRef, { status, updatedAt: serverTimestamp() });

    if (status === 'Fulfilled') {
        const productRef = doc(firestore, 'users', user.uid, 'products', orderToUpdate.productId);
        const product = products.find(p => p.id === orderToUpdate.productId);
        if (product) {
            // Decrement stock for a sale
            batch.update(productRef, { 
                stock: Math.max(0, product.stock - orderToUpdate.quantity),
                updatedAt: serverTimestamp()
            });

            // Record a Sale Transaction
            const transactionRef = doc(transactionsRef);
            batch.set(transactionRef, cleanObject({
                id: transactionRef.id,
                tenantId: user.uid,
                productId: product.id,
                productName: product.name,
                sku: product.sku,
                category: product.categoryId,
                locationId: 'MAIN-WAREHOUSE',
                type: 'Sale',
                quantity: orderToUpdate.quantity,
                price: product.price,
                transactionDate: serverTimestamp(),
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
            }));
            toast({ title: 'Order Fulfilled', description: `Order ${orderId.substring(0,8)}... has been marked as fulfilled.` });
        }
    } else {
        toast({ title: 'Order Status Updated', description: `Order ${orderId.substring(0,8)}... has been marked as ${status}.` });
    }
    
    batch.commit().catch((serverError) => {
        errorEmitter.emit('permission-error', new FirestorePermissionError({
            path: 'batch-write',
            operation: 'update',
        }));
    });
  }, [firestore, user, orders, products, transactionsRef, toast]);

  const addSupplier = useCallback(async (supplierData: Omit<Supplier, 'id' | 'createdAt' | 'updatedAt' | 'userId'>) => {
     if (!firestore || !user || !suppliersRef) return;
     if (suppliers.find((s) => s.name.toLowerCase() === supplierData.name.toLowerCase())) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'A supplier with this name already exists.',
      });
      return;
    }
    const newSupplier = {
      ...supplierData,
      userId: user.uid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };
    addDoc(suppliersRef, newSupplier).catch((serverError) => {
        errorEmitter.emit('permission-error', new FirestorePermissionError({
            path: suppliersRef.path,
            operation: 'create',
            requestResourceData: newSupplier,
        }));
    });
    toast({ title: 'Supplier Added', description: `${supplierData.name} has been added.` });
  }, [firestore, user, suppliers, suppliersRef, toast]);

  const recordSale = useCallback(async (productId: string, quantity: number) => {
    if (!firestore || !user || !transactionsRef) return;
    
    const product = products.find(p => p.id === productId);
    if (!product || product.stock < quantity) {
        toast({ variant: 'destructive', title: 'Error', description: 'Insufficient stock or product not found.' });
        return;
    }

    const batch = writeBatch(firestore);
    const productRef = doc(firestore, 'users', user.uid, 'products', productId);
    const transactionRef = doc(transactionsRef);

    batch.update(productRef, { 
      stock: product.stock - quantity,
      updatedAt: serverTimestamp() 
    });

    batch.set(transactionRef, {
      id: transactionRef.id,
      tenantId: user.uid,
      productId,
      locationId: 'MAIN-WAREHOUSE',
      type: 'Sale',
      quantity,
      price: product.price, // Record current price for historical accuracy
      transactionDate: new Date().toISOString(),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    await batch.commit().catch(err => {
        console.error('Sale recording failed:', err);
        toast({ variant: 'destructive', title: 'Error', description: 'Failed to record sale.' });
    });

    toast({ title: 'Sale Recorded', description: `Sold ${quantity} units of ${product.name}.` });
  }, [firestore, user, transactionsRef, products, toast]);

  const deleteSupplier = useCallback(async (supplierId: string) => {
    if (!firestore || !user) return;
    const supplierRef = doc(firestore, 'users', user.uid, 'suppliers', supplierId);
    deleteDoc(supplierRef).catch((serverError) => {
        errorEmitter.emit('permission-error', new FirestorePermissionError({
            path: supplierRef.path,
            operation: 'delete',
        }));
    });
    toast({ title: 'Supplier Deleted', description: 'The supplier has been removed.' });
  }, [firestore, user, toast]);
  
  const clearAllData = useCallback(async () => {
    if (!firestore || !user || !productsData || !ordersData || !suppliersData || !transactionsData || !categoriesData) return;
    
    const uid = user.uid;
    const batch = writeBatch(firestore);
    
    // Delete all products
    productsData.forEach(p => batch.delete(doc(firestore, 'users', uid, 'products', p.id)));
    // Delete all orders
    ordersData.forEach(o => batch.delete(doc(firestore, 'users', uid, 'orders', o.id)));
    // Delete all suppliers
    suppliersData.forEach(s => batch.delete(doc(firestore, 'users', uid, 'suppliers', s.id)));
    // Delete all transactions
    transactionsData.forEach(t => batch.delete(doc(firestore, 'users', uid, 'transactions', t.id)));
    // Delete all categories
    categoriesData.forEach(c => batch.delete(doc(firestore, 'users', uid, 'categories', c.id)));
    
    await batch.commit().catch(err => {
      console.error('Batch delete failed:', err);
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to clear some data.' });
    });
    
    toast({ title: 'Workspace Reset', description: 'All records have been permanently removed.' });
  }, [firestore, user, productsData, ordersData, suppliersData, transactionsData, categoriesData, toast]);
  
  // Seed removed - User requested empty application
  useEffect(() => {
    if (!user) return;
    const wipeKey = `analyzeup_initial_wipe_${user.uid}`;
    const hasWiped = localStorage.getItem(wipeKey);
    if (!hasWiped && !productsLoading && !isLoading) {
      clearAllData().then(() => {
        localStorage.setItem(wipeKey, 'true');
      });
    }
  }, [user, clearAllData, productsLoading, isLoading]);

  const value = useMemo(() => ({
    products,
    orders,
    suppliers,
    transactions,
    categories,
    addProduct,
    updateProduct,
    deleteProduct,
    addOrder,
    deleteOrder,
    updateOrderStatus,
    addSupplier,
    deleteSupplier,
    addCategory,
    addTransaction,
    recordSale,
    bulkAddProducts,
    bulkUpdateProducts,
    bulkAddTransactions,
    clearAllData,
    isLoading,
  }), [
    products,
    orders,
    suppliers,
    transactions,
    categories,
    isLoading,
    addProduct,
    updateProduct,
    deleteProduct,
    addOrder,
    deleteOrder,
    updateOrderStatus,
    addSupplier,
    deleteSupplier,
    addCategory,
    addTransaction,
    recordSale,
    bulkAddProducts,
    bulkUpdateProducts,
    bulkAddTransactions,
    clearAllData,
  ]);

  return (
    <DataContext.Provider value={value}>
      {children}
    </DataContext.Provider>
  );
};

export const useData = () => {
  const context = useContext(DataContext);
  if (context === undefined) {
    throw new Error('useData must be used within a DataProvider');
  }
  return context;
};
