import { PurchaseOrder } from './types';

export const mockOrders: PurchaseOrder[] = [
    {
        id: 'PO-001',
        tenantId: 'tenant-1',
        supplierId: 'SUP001',
        orderDate: new Date(new Date().setDate(new Date().getDate() - 10)).toISOString(),
        expectedDeliveryDate: new Date(new Date().setDate(new Date().getDate() - 3)).toISOString(),
        status: 'Fulfilled',
        productId: 'PROD001',
        quantity: 50,
        createdAt: new Date(new Date().setDate(new Date().getDate() - 10)).toISOString(),
        updatedAt: new Date(new Date().setDate(new Date().getDate() - 3)).toISOString(),
    },
    {
        id: 'PO-002',
        tenantId: 'tenant-1',
        supplierId: 'SUP002',
        orderDate: new Date(new Date().setDate(new Date().getDate() - 5)).toISOString(),
        expectedDeliveryDate: new Date(new Date().setDate(new Date().getDate() + 2)).toISOString(),
        status: 'Pending',
        productId: 'PROD002',
        quantity: 20,
        createdAt: new Date(new Date().setDate(new Date().getDate() - 5)).toISOString(),
        updatedAt: new Date(new Date().setDate(new Date().getDate() - 5)).toISOString(),
    },
    {
        id: 'PO-003',
        tenantId: 'tenant-1',
        supplierId: 'SUP003',
        orderDate: new Date(new Date().setDate(new Date().getDate() - 20)).toISOString(),
        expectedDeliveryDate: new Date(new Date().setDate(new Date().getDate() - 15)).toISOString(),
        status: 'Cancelled',
        productId: 'PROD003',
        quantity: 100,
        createdAt: new Date(new Date().setDate(new Date().getDate() - 20)).toISOString(),
        updatedAt: new Date(new Date().setDate(new Date().getDate() - 18)).toISOString(),
    },
     {
        id: 'PO-004',
        tenantId: 'tenant-1',
        supplierId: 'SUP001',
        orderDate: new Date(new Date().setDate(new Date().getDate() - 2)).toISOString(),
        expectedDeliveryDate: new Date(new Date().setDate(new Date().getDate() + 5)).toISOString(),
        status: 'Pending',
        productId: 'PROD007',
        quantity: 30,
        createdAt: new Date(new Date().setDate(new Date().getDate() - 2)).toISOString(),
        updatedAt: new Date(new Date().setDate(new Date().getDate() - 2)).toISOString(),
    },
    {
        id: 'PO-005',
        tenantId: 'tenant-1',
        supplierId: 'SUP003',
        orderDate: new Date(new Date().setDate(new Date().getDate() - 8)).toISOString(),
        expectedDeliveryDate: new Date(new Date().setDate(new Date().getDate() - 4)).toISOString(),
        status: 'Fulfilled',
        productId: 'PROD009',
        quantity: 25,
        createdAt: new Date(new Date().setDate(new Date().getDate() - 8)).toISOString(),
        updatedAt: new Date(new Date().setDate(new Date().getDate() - 4)).toISOString(),
    },
    {
        id: 'PO-006',
        tenantId: 'tenant-1',
        supplierId: 'SUP002',
        orderDate: new Date(new Date().setDate(new Date().getDate() - 3)).toISOString(),
        expectedDeliveryDate: new Date(new Date().setDate(new Date().getDate() + 12)).toISOString(),
        status: 'Pending',
        productId: 'PROD010',
        quantity: 20,
        createdAt: new Date(new Date().setDate(new Date().getDate() - 3)).toISOString(),
        updatedAt: new Date(new Date().setDate(new Date().getDate() - 3)).toISOString(),
    },
    ...Array.from({ length: 74 }, (_, i) => {
        const id = 7 + i;
        const suppliers = ['SUP001', 'SUP002', 'SUP003'];
        const statuses: ('Pending' | 'Fulfilled' | 'Cancelled')[] = ['Pending', 'Fulfilled', 'Cancelled'];
        const orderDate = new Date(new Date().setDate(new Date().getDate() - Math.floor(Math.random() * 30)));
        const status = statuses[i % statuses.length];
        let expectedDeliveryDate;
        if (status === 'Fulfilled') {
            expectedDeliveryDate = new Date(orderDate.getTime());
            expectedDeliveryDate.setDate(orderDate.getDate() + Math.floor(Math.random() * 5) + 2);
        } else {
            expectedDeliveryDate = new Date(orderDate.getTime());
            expectedDeliveryDate.setDate(orderDate.getDate() + Math.floor(Math.random() * 10) + 5);
        }

        return {
            id: `PO-${String(id).padStart(3, '0')}`,
            tenantId: 'tenant-1',
            supplierId: suppliers[i % suppliers.length],
            orderDate: orderDate.toISOString(),
            expectedDeliveryDate: expectedDeliveryDate.toISOString(),
            status: status,
            productId: `PROD${String(i + 1).padStart(3, '0')}`,
            quantity: Math.floor(Math.random() * 91) + 10,
            createdAt: orderDate.toISOString(),
            updatedAt: orderDate.toISOString(),
        };
    })
];
