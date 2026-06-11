import { Transaction } from './types';

export const mockTransactions: Transaction[] = [
    {
        id: 'TRN001',
        tenantId: 'tenant-1',
        productId: 'PROD001',
        locationId: 'LOC001',
        type: 'Sale',
        quantity: 2,
        price: 25.0,
        transactionDate: new Date(new Date().setDate(new Date().getDate() - 1)).toISOString(),
        createdAt: new Date(new Date().setDate(new Date().getDate() - 1)).toISOString(),
        updatedAt: new Date(new Date().setDate(new Date().getDate() - 1)).toISOString(),
    },
    {
        id: 'TRN002',
        tenantId: 'tenant-1',
        productId: 'PROD002',
        locationId: 'LOC001',
        type: 'Purchase',
        quantity: 10,
        price: 149.99,
        transactionDate: new Date(new Date().setDate(new Date().getDate() - 3)).toISOString(),
        createdAt: new Date(new Date().setDate(new Date().getDate() - 3)).toISOString(),
        updatedAt: new Date(new Date().setDate(new Date().getDate() - 3)).toISOString(),
    },
    {
        id: 'TRN003',
        tenantId: 'tenant-1',
        productId: 'PROD003',
        locationId: 'LOC001',
        type: 'Sale',
        quantity: 5,
        price: 35.5,
        transactionDate: new Date(new Date().setDate(new Date().getDate() - 2)).toISOString(),
        createdAt: new Date(new Date().setDate(new Date().getDate() - 2)).toISOString(),
        updatedAt: new Date(new Date().setDate(new Date().getDate() - 2)).toISOString(),
    }
];
