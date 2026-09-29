import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  getActionableAction,
  executeNotificationAction,
} from '@/lib/notification-action-engine';
import { detectBusinessEvents } from '@/lib/business-event-engine';
import { getAuditLogs, setActiveAuditUserId } from '@/lib/audit-store';
import { BusinessEvent, Product, Supplier, BusinessProfile } from '@/lib/types';

describe('Notification Center Actionable Engine Suite', () => {
  const mockProducts: Product[] = [
    {
      id: 'prod-hoodie-1',
      name: 'Premium Cotton Hoodie',
      sku: 'SKU-HOODIE-1',
      price: 1000,
      costPrice: 500,
      stock: 2,
      minStock: 10,
      supplier: 'Apex Apparel',
      category: 'Clothing',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'prod-deadstock-1',
      name: 'Vintage Silk Scarf',
      sku: 'SKU-SCARF-1',
      price: 800,
      costPrice: 400,
      stock: 45,
      minStock: 5,
      supplier: 'Silk Mills Ltd',
      category: 'Accessories',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'prod-loss-1',
      name: 'Loss Leader Mug',
      sku: 'SKU-MUG-1',
      price: 300,
      costPrice: 350,
      stock: 20,
      minStock: 5,
      category: 'Home',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ];

  const mockSuppliers: Supplier[] = [
    {
      id: 'sup-1',
      name: 'Apex Apparel',
      contactName: 'John Doe',
      email: 'contact@apex.com',
      phone: '9876543210',
      address: '123 Textile Ave',
      category: 'Clothing',
      leadTimeDays: 7,
      rating: 4.8,
      performanceScore: 95,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ];

  const mockProfile: BusinessProfile = {
    businessName: 'My Fashion Store',
    businessType: 'Retail',
    businessSize: 'Solo',
    currency: 'INR',
    shopifyConnected: false,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('1. Purely Informational Notifications (No Action / No Execute Button)', () => {
    it('returns null for Health Score Need Attention alert (should NOT render execute badge)', () => {
      const event: BusinessEvent = {
        id: 'event-health-score-low',
        type: 'HEALTH_SCORE_CHANGE',
        category: 'finance',
        severity: 'HIGH',
        status: 'ACTIVE',
        impactScore: 85,
        entityId: 'business-health-summary',
        entityName: 'Business Health Score',
        title: 'Business Health Score Needs Attention: 73/100',
        description: 'Operations are stable with balanced inventory velocity and healthy order fulfillment.',
        impactFormatted: 'Health Quotient: Good',
        recommendation: 'Address inventory stockout risks and dead-stock lockups.',
        firstDetected: new Date().toISOString(),
        lastUpdated: new Date().toISOString(),
        actionPayload: {
          actionType: 'navigate',
          targetRoute: '/dashboard/insights',
        },
      };

      const result = getActionableAction(event, mockProducts, mockProfile, null, mockSuppliers);
      expect(result).toBeNull();
    });

    it('returns null for At-Risk Customers alert (should NOT render execute badge)', () => {
      const event: BusinessEvent = {
        id: 'event-at-risk-customers',
        type: 'AT_RISK_CUSTOMERS',
        category: 'finance',
        severity: 'HIGH',
        status: 'ACTIVE',
        impactScore: 78,
        entityId: 'at-risk-segment',
        entityName: 'At-Risk Customer Segment',
        title: '2 At-Risk Repeat Customers',
        description: '2 historical repeat customers have exceeded their typical repurchase interval by 2x.',
        impactFormatted: 'Revenue churn risk',
        recommendation: 'Launch a win-back campaign targeting at-risk customer segment.',
        firstDetected: new Date().toISOString(),
        lastUpdated: new Date().toISOString(),
        actionPayload: {
          actionType: 'navigate',
          targetRoute: '/dashboard/executive',
        },
      };

      const result = getActionableAction(event, mockProducts, mockProfile, null, mockSuppliers);
      expect(result).toBeNull();
    });

    it('returns null for Return Rate Surge and Revenue Concentration alerts', () => {
      const returnEvent: BusinessEvent = {
        id: 'event-return-rate-high',
        type: 'RETURN_RATE_SURGE',
        category: 'returns',
        severity: 'HIGH',
        status: 'ACTIVE',
        impactScore: 72,
        entityId: 'return-rate-metric',
        entityName: 'Catalog Returns',
        title: 'High Return Rate Alert: 12%',
        description: 'Customer return rate exceeds 5% threshold.',
        impactFormatted: 'High refund volume',
        recommendation: 'Audit product quality logs.',
        firstDetected: new Date().toISOString(),
        lastUpdated: new Date().toISOString(),
        actionPayload: {
          actionType: 'navigate',
          targetRoute: '/dashboard/returns',
        },
      };

      const concentrationEvent: BusinessEvent = {
        id: 'event-revenue-concentration',
        type: 'REVENUE_CONCENTRATION_RISK',
        category: 'finance',
        severity: 'HIGH',
        status: 'ACTIVE',
        impactScore: 82,
        entityId: 'concentration-risk',
        entityName: 'Revenue Dependency',
        title: 'High Revenue Concentration Risk',
        description: 'Top SKU generates over 60% of revenue.',
        impactFormatted: 'Dependency risk',
        recommendation: 'Diversify product catalog.',
        firstDetected: new Date().toISOString(),
        lastUpdated: new Date().toISOString(),
        actionPayload: {
          actionType: 'navigate',
          targetRoute: '/dashboard/executive',
        },
      };

      expect(getActionableAction(returnEvent, mockProducts, mockProfile)).toBeNull();
      expect(getActionableAction(concentrationEvent, mockProducts, mockProfile)).toBeNull();
    });

    it('returns null for Grouped Stockout Summary alert (requires navigating rather than single action)', () => {
      const event: BusinessEvent = {
        id: 'event-group-stockout-critical',
        type: 'STOCKOUT_RISK',
        category: 'inventory',
        severity: 'CRITICAL',
        status: 'ACTIVE',
        impactScore: 92,
        entityId: 'grouped-inventory-stockout',
        entityName: '5 Catalog Products',
        title: '5 Products at High Stockout Risk',
        description: 'Multiple items will deplete before supplier lead times.',
        impactFormatted: 'High revenue risk',
        recommendation: 'Review procurement schedule.',
        firstDetected: new Date().toISOString(),
        lastUpdated: new Date().toISOString(),
        actionPayload: {
          actionType: 'navigate',
          targetRoute: '/dashboard/forecasting',
        },
      };

      expect(getActionableAction(event, mockProducts, mockProfile)).toBeNull();
    });

    it('returns null if the referenced product ID does not exist in catalog', () => {
      const event: BusinessEvent = {
        id: 'event-stockout-nonexistent',
        type: 'STOCKOUT_RISK',
        category: 'inventory',
        severity: 'CRITICAL',
        status: 'ACTIVE',
        impactScore: 90,
        entityId: 'missing-product-999',
        entityName: 'Ghost Item',
        title: 'Stockout Alert: Ghost Item',
        description: 'Ghost item is out of stock.',
        impactFormatted: 'Missing product',
        recommendation: 'Reorder.',
        firstDetected: new Date().toISOString(),
        lastUpdated: new Date().toISOString(),
        actionPayload: {
          actionType: 'reorder',
          targetId: 'missing-product-999',
          reorderQty: 25,
        },
      };

      expect(getActionableAction(event, mockProducts, mockProfile)).toBeNull();
    });
  });

  describe('2. Actionable Notifications (Execute Button & Permission Request)', () => {
    it('returns actionable reorder action with correct quantity, cost, and button label', () => {
      const event: BusinessEvent = {
        id: 'event-stockout-hoodie',
        type: 'STOCKOUT_RISK',
        category: 'inventory',
        severity: 'CRITICAL',
        status: 'ACTIVE',
        impactScore: 95,
        entityId: 'prod-hoodie-1',
        entityName: 'Premium Cotton Hoodie',
        title: 'OUT OF STOCK: Premium Cotton Hoodie',
        description: 'Premium Cotton Hoodie is running out of stock.',
        impactFormatted: 'Revenue loss risk',
        recommendation: 'Issue PO for 30 units with Apex Apparel.',
        firstDetected: new Date().toISOString(),
        lastUpdated: new Date().toISOString(),
        actionPayload: {
          actionType: 'reorder',
          targetId: 'prod-hoodie-1',
          reorderQty: 30,
        },
      };

      const result = getActionableAction(event, mockProducts, mockProfile, null, mockSuppliers);
      expect(result).not.toBeNull();
      expect(result?.type).toBe('reorder');
      expect(result?.buttonLabel).toBe('Execute Reorder');
      expect(result?.reorderQty).toBe(30);
      expect(result?.totalCost).toBe(30 * 500); // 30 * costPrice(500) = 15,000
      expect(result?.modalTitle).toContain('Confirm Reorder: Premium Cotton Hoodie');
      expect(result?.modalDescription).toContain('30 units from Apex Apparel');
    });

    it('returns null for clearance discount if sales history has less than 30 days (avoids premature discounts)', () => {
      const event: BusinessEvent = {
        id: 'event-deadstock-scarf',
        type: 'DEAD_STOCK_SURGE',
        category: 'inventory',
        severity: 'HIGH',
        status: 'ACTIVE',
        impactScore: 84,
        entityId: 'prod-deadstock-1',
        entityName: 'Vintage Silk Scarf',
        title: 'Dead Stock Alert: Vintage Silk Scarf',
        description: '45 unsold units.',
        impactFormatted: '₹18,000 Capital Locked',
        recommendation: 'Apply 20% clearance discount.',
        firstDetected: new Date().toISOString(),
        lastUpdated: new Date().toISOString(),
        actionPayload: {
          actionType: 'discount',
          targetId: 'prod-deadstock-1',
          discountPercent: 20,
        },
      };

      // Transactions span only 5 days (insufficient history to reliably identify dead stock)
      const now = Date.now();
      const shortHistoryTransactions = [
        {
          id: 'tx-1',
          type: 'Sale',
          productId: 'prod-hoodie-1',
          quantity: 2,
          amount: 2000,
          transactionDate: new Date(now - 5 * 86400000).toISOString(),
          createdAt: new Date(now - 5 * 86400000).toISOString(),
        } as any,
        {
          id: 'tx-2',
          type: 'Sale',
          productId: 'prod-hoodie-1',
          quantity: 1,
          amount: 1000,
          transactionDate: new Date(now - 1 * 86400000).toISOString(),
          createdAt: new Date(now - 1 * 86400000).toISOString(),
        } as any,
      ];

      const result = getActionableAction(event, mockProducts, mockProfile, null, mockSuppliers, shortHistoryTransactions);
      expect(result).toBeNull();
    });

    it('returns null for clearance discount if product has recorded sales (healthy inventory, not dead stock)', () => {
      const event: BusinessEvent = {
        id: 'event-deadstock-hoodie',
        type: 'DEAD_STOCK_SURGE',
        category: 'inventory',
        severity: 'HIGH',
        status: 'ACTIVE',
        impactScore: 84,
        entityId: 'prod-hoodie-1',
        entityName: 'Premium Cotton Hoodie',
        title: 'Dead Stock Alert: Hoodie',
        description: 'Stock alert.',
        impactFormatted: 'Capital Locked',
        recommendation: 'Apply discount.',
        firstDetected: new Date().toISOString(),
        lastUpdated: new Date().toISOString(),
        actionPayload: {
          actionType: 'discount',
          targetId: 'prod-hoodie-1',
          discountPercent: 20,
        },
      };

      // 45 days of sales history where hoodie has active sales
      const now = Date.now();
      const activeTransactions = [
        {
          id: 'tx-1',
          type: 'Sale',
          productId: 'prod-hoodie-1',
          quantity: 5,
          amount: 5000,
          transactionDate: new Date(now - 45 * 86400000).toISOString(),
          createdAt: new Date(now - 45 * 86400000).toISOString(),
        } as any,
        {
          id: 'tx-2',
          type: 'Sale',
          productId: 'prod-hoodie-1',
          quantity: 3,
          amount: 3000,
          transactionDate: new Date(now - 2 * 86400000).toISOString(),
          createdAt: new Date(now - 2 * 86400000).toISOString(),
        } as any,
      ];

      const result = getActionableAction(event, mockProducts, mockProfile, null, mockSuppliers, activeTransactions);
      expect(result).toBeNull();
    });

    it('returns actionable clearance discount action ONLY when >= 30 days of sales history exist AND product has 0 sales', () => {
      const event: BusinessEvent = {
        id: 'event-deadstock-scarf',
        type: 'DEAD_STOCK_SURGE',
        category: 'inventory',
        severity: 'HIGH',
        status: 'ACTIVE',
        impactScore: 84,
        entityId: 'prod-deadstock-1',
        entityName: 'Vintage Silk Scarf',
        title: 'Dead Stock Alert: Vintage Silk Scarf',
        description: '45 unsold units with ₹18,000 tied up.',
        impactFormatted: '₹18,000 Capital Locked',
        recommendation: 'Apply 20% clearance discount.',
        firstDetected: new Date().toISOString(),
        lastUpdated: new Date().toISOString(),
        actionPayload: {
          actionType: 'discount',
          targetId: 'prod-deadstock-1',
          discountPercent: 20,
        },
      };

      // 40 days of history, but scarf has zero sales
      const now = Date.now();
      const verifiedTransactions = [
        {
          id: 'tx-1',
          type: 'Sale',
          productId: 'prod-hoodie-1',
          quantity: 5,
          amount: 5000,
          transactionDate: new Date(now - 40 * 86400000).toISOString(),
          createdAt: new Date(now - 40 * 86400000).toISOString(),
        } as any,
        {
          id: 'tx-2',
          type: 'Sale',
          productId: 'prod-hoodie-1',
          quantity: 3,
          amount: 3000,
          transactionDate: new Date(now - 2 * 86400000).toISOString(),
          createdAt: new Date(now - 2 * 86400000).toISOString(),
        } as any,
      ];

      // Scarf created 40 days ago
      const productsWithAging = mockProducts.map(p =>
        p.id === 'prod-deadstock-1'
          ? { ...p, createdAt: new Date(now - 40 * 86400000).toISOString() }
          : p
      );

      const result = getActionableAction(event, productsWithAging, mockProfile, null, mockSuppliers, verifiedTransactions);
      expect(result).not.toBeNull();
      expect(result?.type).toBe('discount');
      expect(result?.buttonLabel).toBe('Apply 20% Discount');
      expect(result?.discountPercent).toBe(20);
      expect(result?.currentPrice).toBe(800);
      expect(result?.targetPrice).toBe(640); // 800 - 20% = 640
      expect(result?.modalTitle).toContain('Confirm Clearance Discount');
    });

    it('returns actionable price optimization for margin erosion', () => {
      const event: BusinessEvent = {
        id: 'event-margin-mug',
        type: 'MARGIN_EROSION',
        category: 'finance',
        severity: 'CRITICAL',
        status: 'ACTIVE',
        impactScore: 90,
        entityId: 'prod-loss-1',
        entityName: 'Loss Leader Mug',
        title: 'Loss-Making SKU: Loss Leader Mug',
        description: 'Cost price (₹350) exceeds retail price (₹300).',
        impactFormatted: 'Negative margin',
        recommendation: 'Increase retail price above ₹438.',
        firstDetected: new Date().toISOString(),
        lastUpdated: new Date().toISOString(),
        actionPayload: {
          actionType: 'price_up',
          targetId: 'prod-loss-1',
          targetPrice: 438,
        },
      };

      const result = getActionableAction(event, mockProducts, mockProfile, null, mockSuppliers);
      expect(result).not.toBeNull();
      expect(result?.type).toBe('price_up');
      expect(result?.buttonLabel).toBe('Optimize Price');
      expect(result?.currentPrice).toBe(300);
      expect(result?.targetPrice).toBe(438);
    });
  });

  describe('3. Execution with User Permission', () => {
    it('executes reorder: creates PO, updates stock, and resolves event', async () => {
      const addOrderMock = vi.fn().mockResolvedValue({});
      const updateProductMock = vi.fn().mockResolvedValue({});

      const event: BusinessEvent = {
        id: 'event-stockout-hoodie-exec',
        type: 'STOCKOUT_RISK',
        category: 'inventory',
        severity: 'CRITICAL',
        status: 'ACTIVE',
        impactScore: 95,
        entityId: 'prod-hoodie-1',
        entityName: 'Premium Cotton Hoodie',
        title: 'OUT OF STOCK: Premium Cotton Hoodie',
        description: 'Stock depleted.',
        impactFormatted: 'Revenue risk',
        recommendation: 'Reorder 20 units.',
        firstDetected: new Date().toISOString(),
        lastUpdated: new Date().toISOString(),
        actionPayload: {
          actionType: 'reorder',
          targetId: 'prod-hoodie-1',
          reorderQty: 20,
        },
      };

      const action = getActionableAction(event, mockProducts, mockProfile, null, mockSuppliers)!;
      expect(action).not.toBeNull();

      const execResult = await executeNotificationAction({
        event,
        action,
        addOrder: addOrderMock,
        updateProduct: updateProductMock,
        businessProfile: mockProfile,
      });

      expect(execResult.success).toBe(true);
      expect(addOrderMock).toHaveBeenCalledWith(
        expect.objectContaining({
          productId: 'prod-hoodie-1',
          quantity: 20,
          status: 'Fulfilled',
        })
      );
      expect(updateProductMock).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'prod-hoodie-1',
          stock: 22, // 2 (initial) + 20 (reorder) = 22
        })
      );
    });

    it('executes clearance discount: applies discounted price, liquidationStatus, and resolves event', async () => {
      const addOrderMock = vi.fn().mockResolvedValue({});
      const updateProductMock = vi.fn().mockResolvedValue({});

      const event: BusinessEvent = {
        id: 'event-deadstock-scarf-exec',
        type: 'DEAD_STOCK_SURGE',
        category: 'inventory',
        severity: 'HIGH',
        status: 'ACTIVE',
        impactScore: 84,
        entityId: 'prod-deadstock-1',
        entityName: 'Vintage Silk Scarf',
        title: 'Dead Stock Alert: Vintage Silk Scarf',
        description: 'Unsold units.',
        impactFormatted: 'Capital locked',
        recommendation: 'Discount 20%.',
        firstDetected: new Date().toISOString(),
        lastUpdated: new Date().toISOString(),
        actionPayload: {
          actionType: 'discount',
          targetId: 'prod-deadstock-1',
          discountPercent: 20,
        },
      };

      const action = getActionableAction(event, mockProducts, mockProfile, null, mockSuppliers)!;
      expect(action).not.toBeNull();

      const execResult = await executeNotificationAction({
        event,
        action,
        addOrder: addOrderMock,
        updateProduct: updateProductMock,
        businessProfile: mockProfile,
      });

      expect(execResult.success).toBe(true);
      expect(updateProductMock).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'prod-deadstock-1',
          price: 640,
          compareAtPrice: 800,
          discountPercent: 20,
          liquidationStatus: 'Liquidated',
        }),
        expect.anything()
      );
    });

    it('executes price_up (Optimize Price): updates product price and records directly into audit log', async () => {
      const updateProductMock = vi.fn().mockResolvedValue({});
      const testUid = 'user-test-audit-123';
      setActiveAuditUserId(testUid);

      const event: BusinessEvent = {
        id: 'event-margin-mug-exec',
        type: 'MARGIN_EROSION',
        category: 'finance',
        severity: 'CRITICAL',
        status: 'ACTIVE',
        impactScore: 90,
        entityId: 'prod-loss-1',
        entityName: 'Loss Leader Mug',
        title: 'Loss-Making SKU: Loss Leader Mug',
        description: 'Cost exceeds retail.',
        impactFormatted: 'Negative margin',
        recommendation: 'Increase retail price to ₹438.',
        firstDetected: new Date().toISOString(),
        lastUpdated: new Date().toISOString(),
        actionPayload: {
          actionType: 'price_up',
          targetId: 'prod-loss-1',
          targetPrice: 438,
        },
      };

      const action = getActionableAction(event, mockProducts, mockProfile, null, mockSuppliers)!;
      expect(action).not.toBeNull();

      const execResult = await executeNotificationAction({
        event,
        action,
        addOrder: vi.fn(),
        updateProduct: updateProductMock,
        businessProfile: mockProfile,
        user: { uid: testUid },
      });

      expect(execResult.success).toBe(true);
      expect(updateProductMock).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'prod-loss-1',
          price: 438,
        }),
        expect.anything()
      );

      // Verify audit record was created
      const auditLogs = getAuditLogs(testUid);
      expect(auditLogs.length).toBeGreaterThan(0);
      const auditEntry = auditLogs.find(l => l.productName === 'Loss Leader Mug');
      expect(auditEntry).toBeDefined();
      expect(auditEntry?.actionType).toBe('price_up');
      expect(auditEntry?.title).toContain('Price Optimized');
      expect(auditEntry?.newValue).toContain('438');
    });

    it('returns empty events when products and transactions are empty (zero data / reset workspace)', () => {
      const events = detectBusinessEvents([], []);
      expect(events).toEqual([]);
    });
  });

  describe('4. Business Event Engine Dead Stock Gating by Sales History', () => {
    it('does NOT emit DEAD_STOCK_SURGE if transactions span less than 30 days', () => {
      const now = Date.now();
      const shortTransactions = [
        {
          id: 'tx-1',
          type: 'Sale',
          productId: 'prod-hoodie-1',
          quantity: 2,
          amount: 2000,
          transactionDate: new Date(now - 7 * 86400000).toISOString(),
          createdAt: new Date(now - 7 * 86400000).toISOString(),
        } as any,
      ];

      const events = detectBusinessEvents(mockProducts, shortTransactions, mockSuppliers, [], [], mockProfile);
      const deadStockEvents = events.filter(e => e.type === 'DEAD_STOCK_SURGE');
      expect(deadStockEvents.length).toBe(0);
    });

    it('emits DEAD_STOCK_SURGE only when sales history >= 30 days and item has 0 sales', () => {
      const now = Date.now();
      const verifiedTransactions = [
        {
          id: 'tx-1',
          type: 'Sale',
          productId: 'prod-hoodie-1',
          quantity: 5,
          amount: 5000,
          transactionDate: new Date(now - 45 * 86400000).toISOString(),
          createdAt: new Date(now - 45 * 86400000).toISOString(),
        } as any,
        {
          id: 'tx-2',
          type: 'Sale',
          productId: 'prod-hoodie-1',
          quantity: 3,
          amount: 3000,
          transactionDate: new Date(now - 2 * 86400000).toISOString(),
          createdAt: new Date(now - 2 * 86400000).toISOString(),
        } as any,
      ];

      const productsWithAging = mockProducts.map(p =>
        p.id === 'prod-deadstock-1'
          ? { ...p, createdAt: new Date(now - 45 * 86400000).toISOString() }
          : p
      );

      const events = detectBusinessEvents(productsWithAging, verifiedTransactions, mockSuppliers, [], [], mockProfile);
      const deadStockEvents = events.filter(e => e.type === 'DEAD_STOCK_SURGE');
      expect(deadStockEvents.length).toBeGreaterThan(0);
      expect(deadStockEvents[0].entityId).toBe('prod-deadstock-1');
      expect(deadStockEvents[0].actionPayload?.actionType).toBe('discount');
    });
  });
});
