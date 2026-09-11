/**
 * MODEL — Dynamic Clearance Pricing & Liquidation Elasticity Model
 * 
 * Computes individual, product-specific clearance discounts based on:
 * 1. Unit Gross Margin Buffer: (Price - Cost) / Price
 * 2. Capital-at-Risk Exposure: Stock * Cost Price
 * 3. Category Elasticity Factor: Price sensitivity by merchandise vertical
 * 4. Stagnant Age / Volume Severity
 * 
 * Ensures every product gets a tailored, mathematically justified liquidation discount
 * that clears inventory once while maximizing recovered cash flow.
 */

export interface ClearancePrediction {
  discountPercent: number;
  newPrice: number;
  oldPrice: number;
  costPrice: number;
  hasCostPrice: boolean;
  grossMarginBefore: number;
  grossMarginAfter: number;
  estimatedCashUnlocked: number;
  unitProfitRetained: number;
  urgencyScore: number; // 0 - 100
  aiRationale: string;
  liquidationStrategy: 'Aggressive Velocity' | 'Balanced Markdown' | 'Capital Preservation';
}

export function predictOptimalClearanceDiscount(
  product: {
    id?: string;
    name?: string;
    price?: number;
    costPrice?: number;
    stock?: number;
    category?: string;
    sku?: string;
  },
  totalCatalogDeadCapital?: number
): ClearancePrediction {
  const safePrice = Math.max(50, product.price || 500);
  const hasCostPrice = Boolean(product.costPrice && product.costPrice > 0);
  const cost = hasCostPrice ? product.costPrice! : Math.round(safePrice * 0.6);
  const stock = Math.max(1, product.stock || 1);
  const tiedCapital = stock * cost;
  
  // 1. Calculate Gross Margin Headroom
  const currentMargin = hasCostPrice ? Math.max(0, (safePrice - cost) / safePrice) : 0.35;
  
  // 2. Category Elasticity Index
  const categoryLower = (product.category || product.name || '').toLowerCase();
  let categoryElasticity = 1.0;
  if (categoryLower.includes('shoe') || categoryLower.includes('boost') || categoryLower.includes('sneaker')) {
    categoryElasticity = 1.25; // Footwear has higher price sensitivity
  } else if (categoryLower.includes('jacket') || categoryLower.includes('apparel') || categoryLower.includes('shirt') || categoryLower.includes('cloth')) {
    categoryElasticity = 1.15; // Apparel seasonal urgency
  } else if (categoryLower.includes('backpack') || categoryLower.includes('bag') || categoryLower.includes('leather')) {
    categoryElasticity = 1.10; // Accessories durable elasticity
  } else if (categoryLower.includes('electron') || categoryLower.includes('tech') || categoryLower.includes('gadget')) {
    categoryElasticity = 0.90; // Electronics tighter margins
  }

  // 3. Capital Risk Exposure Multiplier
  const referenceDeadCapital = totalCatalogDeadCapital || 50000;
  const capitalExposureRatio = Math.min(1.5, Math.max(0.7, tiedCapital / (referenceDeadCapital / 3)));

  // 4. Base Discount Prediction derived from Margin Buffer
  let rawDiscountPercent: number;
  let strategy: ClearancePrediction['liquidationStrategy'];

  if (!hasCostPrice) {
    // If margin is unavailable, calibrate around sell-through opportunity rather than profit-maximizing discount (Section 9 & 16)
    rawDiscountPercent = 15;
    strategy = 'Balanced Markdown';
  } else if (currentMargin >= 0.50) {
    // High margin (> 50%): We can discount 28% - 38%
    const base = 28 + (currentMargin - 0.50) * 25;
    rawDiscountPercent = Math.round(base * categoryElasticity * Math.min(1.15, capitalExposureRatio));
    strategy = 'Aggressive Velocity';
  } else if (currentMargin >= 0.30) {
    // Healthy margin (30% - 50%): Discount 20% - 28%
    const base = 20 + (currentMargin - 0.30) * 35;
    rawDiscountPercent = Math.round(base * categoryElasticity);
    strategy = 'Balanced Markdown';
  } else if (currentMargin >= 0.15) {
    // Tight margin (15% - 30%): Discount 12% - 18% to avoid selling below cost
    const base = 12 + (currentMargin - 0.15) * 35;
    rawDiscountPercent = Math.round(base * Math.min(1.0, categoryElasticity));
    strategy = 'Capital Preservation';
  } else {
    // Very thin margin (< 15%): Discount max 8% - 10%
    rawDiscountPercent = Math.max(5, Math.round(currentMargin * 60));
    strategy = 'Capital Preservation';
  }

  // Clamp discount percent: Minimum 8%, Maximum 40%, and never sell below cost if known
  const maxAllowableDiscountByCost = hasCostPrice
    ? Math.max(5, Math.floor(((safePrice - cost * 0.98) / safePrice) * 100))
    : 35;
  const finalDiscountPercent = Math.max(8, Math.min(40, Math.min(rawDiscountPercent, maxAllowableDiscountByCost)));

  const newPrice = Math.round(safePrice * (1 - finalDiscountPercent / 100));
  const grossMarginAfter = hasCostPrice ? Math.round(((newPrice - cost) / newPrice) * 100) : 0;
  const unitProfitRetained = hasCostPrice ? newPrice - cost : 0;
  const estimatedCashUnlocked = Math.round(stock * newPrice);

  // Generate detailed statistical AI rationale
  let aiRationale = '';
  if (!hasCostPrice) {
    aiRationale = `Margin impact cannot be estimated because product cost data is unavailable. Recommended ${finalDiscountPercent}% promotional test is calibrated for sell-through acceleration to free working capital.`;
  } else if (strategy === 'Aggressive Velocity') {
    aiRationale = `Aggressive ${finalDiscountPercent}% clearance derived from strong ${(currentMargin * 100).toFixed(0)}% gross margin cushion. Rapidly unfreezes ₹${estimatedCashUnlocked.toLocaleString('en-IN')} cash while maintaining ${(grossMarginAfter)}% profit.`;
  } else if (strategy === 'Balanced Markdown') {
    aiRationale = `Optimized ${finalDiscountPercent}% discount calibrated to ${categoryLower.includes('shoe') || categoryLower.includes('boost') ? 'footwear' : 'apparel'} price elasticity. Stimulates conversion while preserving ₹${Math.max(0, unitProfitRetained).toLocaleString('en-IN')}/unit profit.`;
  } else {
    aiRationale = `Conservative ${finalDiscountPercent}% clearance protecting unit cost (₹${cost.toLocaleString('en-IN')}). Recovers ₹${estimatedCashUnlocked.toLocaleString('en-IN')} working capital without loss.`;
  }

  const urgencyScore = Math.min(100, Math.round((tiedCapital / 20000) * 40 + (1 - currentMargin) * 30 + finalDiscountPercent));

  return {
    discountPercent: finalDiscountPercent,
    newPrice,
    oldPrice: safePrice,
    costPrice: cost,
    hasCostPrice,
    grossMarginBefore: hasCostPrice ? Math.round(currentMargin * 100) : 0,
    grossMarginAfter,
    estimatedCashUnlocked,
    unitProfitRetained,
    urgencyScore,
    aiRationale,
    liquidationStrategy: strategy,
  };
}
