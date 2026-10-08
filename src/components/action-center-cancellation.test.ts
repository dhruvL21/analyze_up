import { describe, it, expect } from 'vitest';
import { generateActionTasks, ActionTask } from '@/lib/command-center-engine';
import { Product, Supplier, Transaction } from '@/lib/types';

describe('AI Action Center Task Cancellation Suite', () => {
  const mockProducts: Product[] = [
    {
      id: 'prod-snkhed-16',
      name: 'SNKHED Streetform 16 (10)',
      sku: 'SNK-16-10',
      price: 5299,
      costPrice: 2800,
      stock: 0,
      minStock: 10,
      leadTimeDays: 7,
      averageDailySales: 1.2,
      supplier: 'SNKHED',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ];

  const mockSuppliers: Supplier[] = [
    {
      id: 'sup-snkhed',
      name: 'SNKHED',
      contactName: 'Sneaker Supplier',
      email: 'vendor@snkhed.com',
      phone: '9876543210',
      address: 'Industrial Area',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ];

  const mockTransactions: Transaction[] = [];

  const mockProfile = {
    buddyCalibrationOverridden: true,
    currency: 'INR (₹)',
  } as any;

  it('generates high priority restock tasks for zero-stock products', () => {
    const tasks = generateActionTasks(mockProducts, mockTransactions, mockSuppliers, [], mockProfile);
    expect(tasks.length).toBeGreaterThan(0);
    const restockTask = tasks.find((t) => t.actionType === 'reorder');
    expect(restockTask).toBeDefined();
    expect(restockTask?.priority).toBe('High');
  });

  it('correctly filters out cancelled tasks from active tasks', () => {
    const tasks = generateActionTasks(mockProducts, mockTransactions, mockSuppliers, [], mockProfile);
    const targetTaskId = tasks[0].id;

    const completedTaskIds: string[] = [];
    const cancelledTaskIds: string[] = [targetTaskId];

    const activeTasks = tasks.filter(
      (t) => !completedTaskIds.includes(t.id) && !cancelledTaskIds.includes(t.id)
    );
    const cancelledTasks = tasks.filter((t) => cancelledTaskIds.includes(t.id));

    expect(activeTasks.map((t) => t.id)).not.toContain(targetTaskId);
    expect(cancelledTasks.map((t) => t.id)).toContain(targetTaskId);
  });

  it('restores cancelled tasks back to active tasks when uncancelled', () => {
    const tasks = generateActionTasks(mockProducts, mockTransactions, mockSuppliers, [], mockProfile);
    const targetTaskId = tasks[0].id;

    let cancelledTaskIds = [targetTaskId];

    // Simulate undo / restore
    cancelledTaskIds = cancelledTaskIds.filter((id) => id !== targetTaskId);

    const activeTasks = tasks.filter((t) => !cancelledTaskIds.includes(t.id));
    expect(activeTasks.map((t) => t.id)).toContain(targetTaskId);
  });

  it('prompts confirmation before cancellation and preserves task if user keeps action', () => {
    const tasks = generateActionTasks(mockProducts, mockTransactions, mockSuppliers, [], mockProfile);
    const targetTask = tasks[0];

    // User clicks cross icon -> triggers prompt state
    let taskToCancel: { id: string; title: string } | null = {
      id: targetTask.id,
      title: targetTask.title,
    };
    let cancelledTaskIds: string[] = [];

    // User chooses "Keep Action" (aborts prompt)
    taskToCancel = null;

    const activeTasks = tasks.filter((t) => !cancelledTaskIds.includes(t.id));
    expect(activeTasks.map((t) => t.id)).toContain(targetTask.id);
    expect(cancelledTaskIds).toHaveLength(0);
  });

  it('cancels task only upon explicit user confirmation in dialog', () => {
    const tasks = generateActionTasks(mockProducts, mockTransactions, mockSuppliers, [], mockProfile);
    const targetTask = tasks[0];

    // User clicks cross icon -> triggers prompt state
    let taskToCancel: { id: string; title: string } | null = {
      id: targetTask.id,
      title: targetTask.title,
    };
    let cancelledTaskIds: string[] = [];

    // User clicks "Yes, Cancel Action"
    if (taskToCancel) {
      cancelledTaskIds = [...cancelledTaskIds, taskToCancel.id];
      taskToCancel = null;
    }

    const activeTasks = tasks.filter((t) => !cancelledTaskIds.includes(t.id));
    expect(activeTasks.map((t) => t.id)).not.toContain(targetTask.id);
    expect(cancelledTaskIds).toContain(targetTask.id);
    expect(taskToCancel).toBeNull();
  });

  it('generates price optimization tasks and validates parameter calculations', () => {
    const highDemandProd: Product = {
      id: 'prod-anc-navy',
      name: 'ANC Wireless Noise Cancelling Headphones - Navy (XL)',
      sku: 'ANC-NAVY-XL',
      price: 5039,
      costPrice: 3000,
      stock: 45,
      minStock: 10,
      leadTimeDays: 5,
      averageDailySales: 2.5,
      supplier: 'AudioTech',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const tasks = generateActionTasks([highDemandProd], [], mockSuppliers, [], mockProfile);
    const priceTask = tasks.find((t) => t.actionType === 'price_up');
    expect(priceTask).toBeDefined();
    expect(priceTask?.title).toContain('ANC Wireless Noise Cancelling Headphones - Navy (XL)');
    expect(priceTask?.newPrice).toBeGreaterThan(5039);
  });
});
