import { describe, it, expect } from 'vitest';
import { getMinimalRiskSignals, ProcurementRiskItem } from './supplier-intelligence-engine';

describe('Minimal Procurement Risk Signals Engine', () => {
  it('extracts minimal, scannable tags for single-supplier dependency risks', () => {
    const risk: ProcurementRiskItem = {
      id: 'risk-1',
      productName: 'Ergonomic Mechanical Keyboard (RGB) - White (Standard)',
      sku: 'KB-RGB-W',
      supplierName: 'SiliconValley Tech Components',
      riskLevel: 'HIGH',
      type: 'single_supplier_dependency',
      problem: 'High supplier dependency on SiliconValley Tech Components for critical SKU.',
      reason: "100% of this top-selling product's supply depends on SiliconValley Tech Components, whose delivery time is 9.7 days.",
      recommendation: 'Consider qualifying a secondary supplier to reduce procurement vulnerability.',
      impact: 'Protects daily sales velocity of 2.4 units/day against supplier disruptions.',
    };

    const signals = getMinimalRiskSignals(risk);
    expect(signals.primaryTag).toBe('100% Single-Sourced');
    expect(signals.metricTag).toBe('9.7d Lead Time');
    expect(signals.actionLabel).toBe('Add backup supplier');
  });

  it('extracts minimal tags for late delivery risks', () => {
    const risk: ProcurementRiskItem = {
      id: 'risk-2',
      productName: 'Organic Cotton Crewneck T-Shirt - White (L)',
      sku: 'TS-WHT-L',
      supplierName: 'Apex Apparel Global',
      riskLevel: 'HIGH',
      type: 'late_delivery',
      problem: 'Repeated late deliveries from Apex Apparel Global.',
      reason: 'On-time delivery rate has dropped to 64% across recent purchase orders.',
      recommendation: 'Renegotiate delivery SLAs or adjust safety stock reorder thresholds.',
      impact: 'Prevents customer order delays.',
    };

    const signals = getMinimalRiskSignals(risk);
    expect(signals.primaryTag).toBe('Frequent Delays');
    expect(signals.metricTag).toBe('64% On-Time');
    expect(signals.actionLabel).toBe('Renegotiate SLAs');
  });

  it('extracts minimal tags for price increase risks', () => {
    const risk: ProcurementRiskItem = {
      id: 'risk-3',
      productName: 'Ultra-Slim 4K USB-C Hub (7-in-1)',
      sku: 'HUB-7IN1',
      supplierName: 'SiliconValley Tech Components',
      riskLevel: 'MEDIUM',
      type: 'cost_increase',
      problem: 'Purchase cost increased 18% from SiliconValley Tech Components.',
      reason: 'Recent price hike reduces gross margin across 5 supplied products.',
      recommendation: 'Review supplier pricing, request volume discount, or compare alternative suppliers.',
      impact: 'Protects projected quarterly product profit margin.',
    };

    const signals = getMinimalRiskSignals(risk);
    expect(signals.primaryTag).toBe('+18% Cost Hike');
    expect(signals.metricTag).toBe('Margin Impact');
    expect(signals.actionLabel).toBe('Request volume discount');
  });

  it('extracts minimal tags for high cancellation and lead time spike', () => {
    const cancelRisk: ProcurementRiskItem = {
      id: 'risk-4',
      productName: 'Sample Product',
      sku: 'SMP-1',
      supplierName: 'Test Supplier',
      riskLevel: 'HIGH',
      type: 'high_cancellation',
      problem: 'High cancellation',
      reason: 'High rate',
      recommendation: 'Audit',
      impact: 'Supply stability',
    };
    expect(getMinimalRiskSignals(cancelRisk).primaryTag).toBe('High Cancellations');

    const leadRisk: ProcurementRiskItem = {
      id: 'risk-5',
      productName: 'Sample Product 2',
      sku: 'SMP-2',
      supplierName: 'Test Supplier 2',
      riskLevel: 'HIGH',
      type: 'lead_time_spike',
      problem: 'Lead time spike',
      reason: 'Long delivery',
      recommendation: 'Buffer',
      impact: 'Runway',
    };
    expect(getMinimalRiskSignals(leadRisk).primaryTag).toBe('Lead Time Spike');
  });
});
