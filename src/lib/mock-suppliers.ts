import { Supplier } from './types';

export const mockSuppliers: Supplier[] = [
    {
        id: 'SUP001',
        tenantId: 'tenant-1',
        name: 'Apex Apparel',
        contactName: 'Jane Doe',
        email: 'contact@apexapparel.com',
        phone: '123-456-7890',
        address: '123 Fashion Ave, New York, NY 10001',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
    },
    {
        id: 'SUP002',
        tenantId: 'tenant-1',
        name: 'Gadgetronix',
        contactName: 'John Smith',
        email: 'sales@gadgetronix.com',
        phone: '987-654-3210',
        address: '456 Tech Park, San Francisco, CA 94107',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
    },
    {
        id: 'SUP003',
        tenantId: 'tenant-1',
        name: 'Global Goods Co.',
        contactName: 'Maria Garcia',
        email: 'support@globalgoods.com',
        phone: '555-123-4567',
        address: '789 Import Rd, Miami, FL 33101',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
    },
];
