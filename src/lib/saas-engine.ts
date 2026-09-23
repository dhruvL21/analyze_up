// 1. Types & Data Models
export type WorkspaceRole = 'OWNER' | 'ADMIN' | 'MANAGER' | 'STAFF' | 'VIEWER';

export type PlanType = 'FREE' | 'STARTER' | 'GROWTH' | 'PRO' | 'FOUNDER' | 'SCALE';

export type SubscriptionState = 'TRIAL' | 'ACTIVE' | 'PAST_DUE' | 'CANCELLED' | 'EXPIRED';

export type FeatureKey =
  | 'AI_COPILOT'
  | 'FORECASTING'
  | 'PROACTIVE_MONITORING'
  | 'SHOPIFY_SYNC'
  | 'ADVANCED_REPORTS'
  | 'TEAM_INVITES'
  | 'AUDIT_LOGS'
  | 'EXPORT_DATA';

export type UsageKey = 'products' | 'aiQueries' | 'reports' | 'teamMembers' | 'shopifySyncs';

export interface MonthlyUsageRecord {
  billingMonth: string; // e.g. "2026-09"
  aiQueriesCount: number;
  reportsCount: number;
  lastResetDate: string;
  plan?: string;
  planKey?: PlanType;
  updatedAt?: any;
}

export function getCurrentBillingMonth(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

export function isNewBillingMonth(storedMonth?: string | null): boolean {
  if (!storedMonth) return false;
  return storedMonth !== getCurrentBillingMonth();
}

export function createInitialMonthlyUsage(month?: string): MonthlyUsageRecord {
  return {
    billingMonth: month || getCurrentBillingMonth(),
    aiQueriesCount: 0,
    reportsCount: 0,
    lastResetDate: new Date().toISOString(),
  };
}

export interface WorkspacePermission {
  key: string;
  label: string;
  description: string;
}

export interface WorkspaceMember {
  userId: string;
  email: string;
  name: string;
  role: WorkspaceRole;
  joinedAt: string;
  avatarUrl?: string;
}

export interface WorkspaceInvitation {
  id: string;
  email: string;
  role: WorkspaceRole;
  invitedBy: string;
  token: string;
  expiresAt: string;
  status: 'PENDING' | 'ACCEPTED' | 'EXPIRED';
}

export interface Workspace {
  id: string;
  tenantId: string;
  name: string;
  ownerId: string;
  plan: PlanType;
  subscriptionState: SubscriptionState;
  currency: string;
  timezone: string;
  createdAt: string;
  currentPeriodEnd: string;
  members: WorkspaceMember[];
}

export interface PlanConfig {
  key: PlanType;
  name: string;
  stage: string;
  tagline: string;
  priceMonthly: number; // In INR
  priceMonthlyUSD: number;
  priceYearly: number; // In INR (Save ~2 months)
  priceYearlyUSD: number;
  priceSubtext: string;
  description: string;
  highlightedText: string;
  productLimit: number;
  transactionsLimit: number;
  aiQueriesLimit: number;
  reportsLimit: number;
  teamMembersLimit: number;
  shopifyStoresLimit: number;
  shopifySyncAllowed: boolean;
  forecastingAllowed: boolean;
  proactiveMonitoringAllowed: boolean;
  auditLogsAllowed: boolean;
  popular?: boolean;
  ctaText: string;
  features: string[];
}

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  userId: string;
  userName: string;
  userRole: WorkspaceRole;
  action: string;
  details: string;
  category: 'INVITATION' | 'ROLE_CHANGE' | 'PRODUCT' | 'BILLING' | 'SETTINGS' | 'INTEGRATION';
}

// 2. Centralized Plan Definitions
export const PLAN_CONFIGS: Record<PlanType, PlanConfig> = {
  FREE: {
    key: 'FREE',
    name: 'Free',
    stage: 'STAGE 1',
    tagline: 'For validating the idea',
    priceMonthly: 0,
    priceMonthlyUSD: 0,
    priceYearly: 0,
    priceYearlyUSD: 0,
    priceSubtext: 'Free forever, no card needed',
    description: "You're pre-revenue, testing the idea, or have a handful of SKUs. Just enough to prove this beats a spreadsheet — not enough to run a real, growing catalog.",
    highlightedText: 'prove this beats a spreadsheet',
    productLimit: 50,
    transactionsLimit: 150,
    aiQueriesLimit: 10,
    reportsLimit: 10,
    teamMembersLimit: 1,
    shopifyStoresLimit: 0,
    shopifySyncAllowed: false,
    forecastingAllowed: false,
    proactiveMonitoringAllowed: false,
    auditLogsAllowed: false,
    popular: false,
    ctaText: 'Start Free',
    features: [
      '50 Products',
      '150 Transactions/mo',
      '10 AI Queries/month',
      'Business Dashboard',
      'Business Health Score',
      'Basic Inventory Intelligence',
      'CSV & Excel Import (up to 100 rows)',
      '1 Team Member',
    ],
  },
  STARTER: {
    key: 'STARTER',
    name: 'Founder',
    stage: 'STAGE 2',
    tagline: 'For running it solo, live',
    priceMonthly: 499,
    priceMonthlyUSD: 6,
    priceYearly: 4990,
    priceYearlyUSD: 60,
    priceSubtext: 'Billed monthly, cancel anytime',
    description: "You're live on Shopify or D2C, doing it all yourself. Your real fear is stockouts or overstock because it's all in your head.",
    highlightedText: 'stockouts or overstock',
    productLimit: 750,
    transactionsLimit: 5000,
    aiQueriesLimit: 100,
    reportsLimit: 50,
    teamMembersLimit: 2,
    shopifyStoresLimit: 1,
    shopifySyncAllowed: true,
    forecastingAllowed: true,
    proactiveMonitoringAllowed: true,
    auditLogsAllowed: false,
    popular: false,
    ctaText: 'Upgrade to Founder',
    features: [
      '750 Products',
      '5,000 Transactions/mo',
      '100 AI Queries/month',
      '30-Day Demand Forecasting',
      'Shopify Integration',
      'Reorder Recommendations',
      'Supplier Intelligence',
      '2 Team Members',
    ],
  },
  FOUNDER: {
    key: 'FOUNDER',
    name: 'Founder',
    stage: 'STAGE 2',
    tagline: 'For running it solo, live',
    priceMonthly: 499,
    priceMonthlyUSD: 6,
    priceYearly: 4990,
    priceYearlyUSD: 60,
    priceSubtext: 'Billed monthly, cancel anytime',
    description: "You're live on Shopify or D2C, doing it all yourself. Your real fear is stockouts or overstock because it's all in your head.",
    highlightedText: 'stockouts or overstock',
    productLimit: 750,
    transactionsLimit: 5000,
    aiQueriesLimit: 100,
    reportsLimit: 50,
    teamMembersLimit: 2,
    shopifyStoresLimit: 1,
    shopifySyncAllowed: true,
    forecastingAllowed: true,
    proactiveMonitoringAllowed: true,
    auditLogsAllowed: false,
    popular: false,
    ctaText: 'Upgrade to Founder',
    features: [
      '750 Products',
      '5,000 Transactions/mo',
      '100 AI Queries/month',
      '30-Day Demand Forecasting',
      'Shopify Integration',
      'Reorder Recommendations',
      'Supplier Intelligence',
      '2 Team Members',
    ],
  },
  GROWTH: {
    key: 'GROWTH',
    name: 'Growth',
    stage: 'STAGE 3',
    tagline: 'For running it with a team',
    priceMonthly: 999,
    priceMonthlyUSD: 12,
    priceYearly: 9990,
    priceYearlyUSD: 120,
    priceSubtext: 'Billed monthly, cancel anytime',
    description: "You've hired people and can't personally check stock anymore. You need the system to flag what needs a decision so the team can act without you.",
    highlightedText: 'flag what needs a decision',
    productLimit: 5000,
    transactionsLimit: 25000,
    aiQueriesLimit: 500,
    reportsLimit: 200,
    teamMembersLimit: 5,
    shopifyStoresLimit: 1,
    shopifySyncAllowed: true,
    forecastingAllowed: true,
    proactiveMonitoringAllowed: true,
    auditLogsAllowed: true,
    popular: true,
    ctaText: 'Upgrade to Growth →',
    features: [
      '5,000 Products',
      '25,000 Transactions/mo',
      '500 AI Queries/month',
      '90-Day Demand Forecasting',
      'Advanced Inventory Intelligence',
      'AI Action Center',
      'What-If Simulator',
      '5 Team Members',
    ],
  },
  PRO: {
    key: 'PRO',
    name: 'Scale',
    stage: 'STAGE 4',
    tagline: 'For scaling past yourself',
    priceMonthly: 2499,
    priceMonthlyUSD: 30,
    priceYearly: 24990,
    priceYearlyUSD: 300,
    priceSubtext: 'Billed monthly, cancel anytime',
    description: "You have real revenue and 12 months of runway to think about. You don't need more data — you need the app to interpret it and act, because time is scarcer than money now.",
    highlightedText: 'interpret it and act',
    productLimit: 25000,
    transactionsLimit: 100000,
    aiQueriesLimit: 2000,
    reportsLimit: 1000,
    teamMembersLimit: 15,
    shopifyStoresLimit: 10,
    shopifySyncAllowed: true,
    forecastingAllowed: true,
    proactiveMonitoringAllowed: true,
    auditLogsAllowed: true,
    popular: false,
    ctaText: 'Upgrade to Scale',
    features: [
      '25,000 Products',
      '100,000 Transactions/mo',
      '2,000 AI Queries/month',
      '180-Day Demand Forecasting',
      'Multi-Store Shopify',
      'Advanced Supplier Intelligence',
      'Advanced AI Copilot',
      '15 Team Members',
    ],
  },
  SCALE: {
    key: 'SCALE',
    name: 'Scale',
    stage: 'STAGE 4',
    tagline: 'For scaling past yourself',
    priceMonthly: 2499,
    priceMonthlyUSD: 30,
    priceYearly: 24990,
    priceYearlyUSD: 300,
    priceSubtext: 'Billed monthly, cancel anytime',
    description: "You have real revenue and 12 months of runway to think about. You don't need more data — you need the app to interpret it and act, because time is scarcer than money now.",
    highlightedText: 'interpret it and act',
    productLimit: 25000,
    transactionsLimit: 100000,
    aiQueriesLimit: 2000,
    reportsLimit: 1000,
    teamMembersLimit: 15,
    shopifyStoresLimit: 10,
    shopifySyncAllowed: true,
    forecastingAllowed: true,
    proactiveMonitoringAllowed: true,
    auditLogsAllowed: true,
    popular: false,
    ctaText: 'Upgrade to Scale',
    features: [
      '25,000 Products',
      '100,000 Transactions/mo',
      '2,000 AI Queries/month',
      '180-Day Demand Forecasting',
      'Multi-Store Shopify',
      'Advanced Supplier Intelligence',
      'Advanced AI Copilot',
      '15 Team Members',
    ],
  },
};

export const ORDERED_PLANS: PlanType[] = ['FREE', 'STARTER', 'GROWTH', 'PRO'];

// 2b. Coupon & Testing Phase Pass Engine
export interface CouponValidationResult {
  valid: boolean;
  code: string;
  discountPercent: number;
  planKey: PlanType;
  planName: string;
  description: string;
  message: string;
}

export const VALID_TESTING_COUPONS: Record<
  string,
  { discountPercent: number; planKey: PlanType; planName: string; description: string }
> = {
  BETA100: {
    discountPercent: 100,
    planKey: 'PRO',
    planName: 'Scale',
    description: 'Scale 100% Free Pass',
  },
  TESTFREE: {
    discountPercent: 100,
    planKey: 'PRO',
    planName: 'Scale',
    description: 'Scale Full Access Pass',
  },
  FREEPRO: {
    discountPercent: 100,
    planKey: 'PRO',
    planName: 'Scale',
    description: 'Scale Community Pass',
  },
  ANALYZEFREE: {
    discountPercent: 100,
    planKey: 'PRO',
    planName: 'Scale',
    description: 'AnalyzeUp Launch VIP Pass',
  },
  TESTING: {
    discountPercent: 100,
    planKey: 'PRO',
    planName: 'Scale',
    description: 'Scale VIP Pass',
  },
  LAUNCHFREE: {
    discountPercent: 100,
    planKey: 'PRO',
    planName: 'Scale',
    description: 'Founder Launch Free Access',
  },
  FOUNDERPASS: {
    discountPercent: 100,
    planKey: 'PRO',
    planName: 'Scale',
    description: 'Founder VIP Pass',
  },
  VIPFREE: {
    discountPercent: 100,
    planKey: 'PRO',
    planName: 'Scale',
    description: 'VIP Unlimited Pass',
  },
  FREE: {
    discountPercent: 100,
    planKey: 'PRO',
    planName: 'Scale',
    description: 'Scale Pass',
  },
  PROMO100: {
    discountPercent: 100,
    planKey: 'PRO',
    planName: 'Scale',
    description: 'Scale Promo Pass',
  },
  SPECIAL100: {
    discountPercent: 100,
    planKey: 'PRO',
    planName: 'Scale',
    description: 'Special VIP Promo Pass',
  },
};

export function validateCouponCode(inputCode: string): CouponValidationResult {
  const normalized = (inputCode || '').trim().toUpperCase();
  if (!normalized) {
    return {
      valid: false,
      code: '',
      discountPercent: 0,
      planKey: 'FREE',
      planName: 'Free',
      description: '',
      message: 'Please enter a promo code.',
    };
  }

  if (VALID_TESTING_COUPONS[normalized]) {
    const coupon = VALID_TESTING_COUPONS[normalized];
    return {
      valid: true,
      code: normalized,
      discountPercent: coupon.discountPercent,
      planKey: coupon.planKey,
      planName: coupon.planName,
      description: coupon.description,
      message: `🎉 Promo code applied! Scale is unlocked 100% free.`,
    };
  }

  // Also support any custom promo code that ends with '100' or contains 'FREE', 'PROMO', 'TEST', 'PASS', 'VIP', or 'BETA' for maximum flexibility
  if (
    normalized.includes('FREE') ||
    normalized.includes('PROMO') ||
    normalized.includes('TEST') ||
    normalized.includes('BETA') ||
    normalized.includes('VIP') ||
    normalized.includes('PASS') ||
    normalized.endsWith('100')
  ) {
    return {
      valid: true,
      code: normalized,
      discountPercent: 100,
      planKey: 'PRO',
      planName: 'Scale',
      description: 'Scale 100% Free Pass',
      message: '🎉 Promo code applied! Scale is unlocked 100% free.',
    };
  }

  return {
    valid: false,
    code: normalized,
    discountPercent: 0,
    planKey: 'FREE',
    planName: 'Free',
    description: '',
    message: 'Invalid promo code. Please check your code and try again.',
  };
}

// 2c. Full Feature Comparison Definitions
export interface FeatureComparisonRow {
  name: string;
  free: string | boolean;
  founder: string | boolean;
  growth: string | boolean;
  scale: string | boolean;
}

export interface FeatureCategoryGroup {
  category: string;
  rows: FeatureComparisonRow[];
}

export const PLAN_FEATURE_CATEGORIES: FeatureCategoryGroup[] = [
  {
    category: '1. DATA & USAGE',
    rows: [
      { name: 'Products', free: '50', founder: '750', growth: '5,000', scale: '25,000' },
      { name: 'Transactions', free: '150/mo', founder: '5,000/mo', growth: '25,000/mo', scale: '100,000/mo' },
      { name: 'AI Queries', free: '10/month', founder: '100/month', growth: '500/month', scale: '2,000/month' },
      { name: 'Team Members', free: '1', founder: '2', growth: '5', scale: '15' },
      { name: 'Connected Shopify Stores', free: false, founder: '1 Store', growth: '1 Store', scale: 'Multi-Store' },
    ],
  },
  {
    category: '2. BUSINESS INTELLIGENCE',
    rows: [
      { name: 'Business Dashboard', free: true, founder: true, growth: true, scale: true },
      { name: 'Business Health Score', free: true, founder: true, growth: true, scale: true },
      { name: 'Inventory Intelligence', free: true, founder: true, growth: true, scale: true },
      { name: 'Dead Stock Detection', free: false, founder: true, growth: true, scale: true },
      { name: 'Stockout Prediction', free: false, founder: true, growth: true, scale: true },
      { name: 'Reorder Recommendations', free: false, founder: true, growth: true, scale: true },
    ],
  },
  {
    category: '3. FORECASTING & AI',
    rows: [
      { name: 'AI Copilot', free: true, founder: true, growth: true, scale: true },
      { name: 'AI Action Center', free: false, founder: false, growth: true, scale: true },
      { name: '30-Day Demand Forecasting', free: false, founder: true, growth: true, scale: true },
      { name: '90-Day Demand Forecasting', free: false, founder: false, growth: true, scale: true },
      { name: '180-Day Demand Forecasting', free: false, founder: false, growth: false, scale: true },
      { name: 'What-If Simulator', free: false, founder: false, growth: true, scale: true },
    ],
  },
  {
    category: '4. SUPPLIER & OPERATIONS',
    rows: [
      { name: 'Supplier Intelligence', free: false, founder: true, growth: true, scale: true },
      { name: 'Returns Intelligence', free: false, founder: false, growth: true, scale: true },
      { name: 'Automated Reports', free: false, founder: true, growth: true, scale: true },
      { name: 'Audit Logs', free: false, founder: false, growth: true, scale: true },
    ],
  },
  {
    category: '5. INTEGRATIONS',
    rows: [
      { name: 'CSV / Excel Import', free: true, founder: true, growth: true, scale: true },
      { name: 'Shopify Integration', free: false, founder: true, growth: true, scale: true },
      { name: 'Multi-Store Shopify', free: false, founder: false, growth: false, scale: true },
    ],
  },
  {
    category: '6. TEAM & SUPPORT',
    rows: [
      { name: 'Team Permissions', free: false, founder: false, growth: true, scale: true },
      { name: 'Priority Support', free: false, founder: true, growth: true, scale: true },
      { name: 'Dedicated Support', free: false, founder: false, growth: false, scale: true },
    ],
  },
];

// 3. Central Feature Entitlement Check
export function canUseFeature(plan: PlanType = 'FREE', feature: FeatureKey): boolean {
  const config = PLAN_CONFIGS[plan] || PLAN_CONFIGS.FREE;

  switch (feature) {
    case 'AI_COPILOT':
      return true;
    case 'FORECASTING':
      return config.forecastingAllowed;
    case 'PROACTIVE_MONITORING':
      return config.proactiveMonitoringAllowed;
    case 'SHOPIFY_SYNC':
      return config.shopifySyncAllowed;
    case 'ADVANCED_REPORTS':
      return plan === 'GROWTH' || plan === 'PRO';
    case 'TEAM_INVITES':
      return config.teamMembersLimit > 1;
    case 'AUDIT_LOGS':
      return config.auditLogsAllowed;
    case 'EXPORT_DATA':
      return true;
    default:
      return true;
  }
}

// 4. Central Usage Limit Check
export function checkUsageLimit(
  plan: PlanType = 'FREE',
  usageKey: UsageKey,
  currentCount: number
): {
  allowed: boolean;
  limit: number;
  usagePercent: number;
  isWarning80: boolean;
  isBlocked100: boolean;
  message: string;
} {
  const config = PLAN_CONFIGS[plan] || PLAN_CONFIGS.FREE;

  let limit = 100;
  if (usageKey === 'products') limit = config.productLimit;
  if (usageKey === 'aiQueries') limit = config.aiQueriesLimit;
  if (usageKey === 'reports') limit = config.reportsLimit;
  if (usageKey === 'teamMembers') limit = config.teamMembersLimit;
  if (usageKey === 'shopifySyncs') limit = plan === 'FREE' ? 0 : 50;

  const usagePercent = Math.min(100, Math.round((currentCount / limit) * 100));
  const isWarning80 = usagePercent >= 80 && usagePercent < 100;
  const isBlocked100 = currentCount >= limit;
  const allowed = !isBlocked100;

  let message = `Using ${currentCount} of ${limit} allowed ${usageKey}.`;
  if (isWarning80) {
    message = `⚠️ Warning: You have reached ${usagePercent}% of your monthly ${usageKey} limit (${currentCount}/${limit}). Upgrade plan to avoid interruption.`;
  }
  if (isBlocked100) {
    message = `🚫 Monthly limit reached: You have used all ${limit} ${usageKey} on the ${config.name}. Please upgrade to continue.`;
  }

  return {
    allowed,
    limit,
    usagePercent,
    isWarning80,
    isBlocked100,
    message,
  };
}

// 5. Role-Based Permissions Matrix
export function hasPermission(role: WorkspaceRole = 'OWNER', permissionKey: string): boolean {
  if (role === 'OWNER') return true;

  const rolePermissions: Record<WorkspaceRole, string[]> = {
    OWNER: ['ALL'],
    ADMIN: [
      'view_dashboard',
      'manage_products',
      'manage_inventory',
      'manage_orders',
      'manage_suppliers',
      'manage_purchase_orders',
      'view_reports',
      'generate_reports',
      'use_ai_copilot',
      'manage_integrations',
      'manage_team',
      'manage_workspace',
    ],
    MANAGER: [
      'view_dashboard',
      'manage_products',
      'manage_inventory',
      'manage_orders',
      'manage_suppliers',
      'manage_purchase_orders',
      'view_reports',
      'generate_reports',
      'use_ai_copilot',
    ],
    STAFF: [
      'view_dashboard',
      'manage_products',
      'manage_inventory',
      'manage_orders',
      'view_reports',
      'use_ai_copilot',
    ],
    VIEWER: ['view_dashboard', 'view_reports'],
  };

  const allowedList = rolePermissions[role] || [];
  return allowedList.includes('ALL') || allowedList.includes(permissionKey);
}

// 6. Audit Logger System
const AUDIT_LOG_STORAGE_KEY = 'analyzeup_workspace_audit_log_v1';

export function logWorkspaceAction(
  userId: string,
  userName: string,
  userRole: WorkspaceRole,
  action: string,
  details: string,
  category: AuditLogEntry['category'] = 'SETTINGS'
): AuditLogEntry {
  const entry: AuditLogEntry = {
    id: `audit-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    timestamp: new Date().toISOString(),
    userId,
    userName,
    userRole,
    action,
    details,
    category,
  };

  try {
    const existing = getStoredAuditLogs(userId);
    const updated = [entry, ...existing.slice(0, 49)];
    if (typeof window !== 'undefined') {
      localStorage.setItem(`analyzeup_saas_audit_logs_${userId}`, JSON.stringify(updated));
    }
  } catch (err) {
    console.error('Failed to log workspace audit action:', err);
  }

  return entry;
}

export function getStoredAuditLogs(userId?: string): AuditLogEntry[] {
  if (typeof window === 'undefined') return [];
  if (!userId) return [];
  try {
    const raw = localStorage.getItem(`analyzeup_saas_audit_logs_${userId}`);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

// 7. Workspace Members Store
export function getStoredWorkspaceMembers(defaultUser?: { uid?: string; email?: string; displayName?: string }): WorkspaceMember[] {
  if (typeof window === 'undefined') return [];
  const key = defaultUser?.uid ? `analyzeup_workspace_members_${defaultUser.uid}` : 'analyzeup_workspace_members_v1';
  try {
    const raw = localStorage.getItem(key);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch {
    // fallback
  }

  const defaultMembers: WorkspaceMember[] = [
    {
      userId: defaultUser?.uid || 'user-1',
      email: defaultUser?.email || 'founder@business.com',
      name: defaultUser?.displayName || 'Business Founder',
      role: 'OWNER',
      joinedAt: '2026-01-15',
    },
  ];
  return defaultMembers;
}

export function saveStoredWorkspaceMembers(members: WorkspaceMember[], userId?: string): void {
  if (typeof window === 'undefined') return;
  const key = userId ? `analyzeup_workspace_members_${userId}` : 'analyzeup_workspace_members_v1';
  try {
    localStorage.setItem(key, JSON.stringify(members));
  } catch (err) {
    console.error('Failed to save workspace members:', err);
  }
}

// 8. Questionnaire & Deterministic Plan Recommendation Engine
export interface PlanQuestionnaireAnswers {
  businessType: string;
  productCountRange: string;
  monthlyOrdersRange: string;
  salesChannels: string[];
  teamSizeRange: string;
  primaryNeeds: string[];
  growthExpectation: string;
}

export interface PlanFitMetric {
  label: string;
  requiredDisplay: string;
  capacityDisplay: string;
  requiredValue: number;
  capacityValue: number;
  percentage: number;
  isWithinLimit: boolean;
}

export interface PlanRecommendationResult {
  recommendedPlanKey: PlanType | 'CUSTOM';
  planName: string;
  isBeyondStandardPlans: boolean;
  userSummary: {
    businessType: string;
    productEstimate: string;
    orderEstimate: string;
    shopifyStoresEstimate: number;
    teamSizeEstimate: string;
    primaryNeeds: string[];
    growthExpectation: string;
  };
  whyThisPlan: string[];
  metrics: PlanFitMetric[];
}

export function recommendPlan(answers: PlanQuestionnaireAnswers): PlanRecommendationResult {
  let productReq = 50;
  let productDisplay = 'Under 100';
  if (answers.productCountRange === '100–500') {
    productReq = 500;
    productDisplay = '500';
  } else if (answers.productCountRange === '500–2,000') {
    productReq = 2000;
    productDisplay = '2,000';
  } else if (answers.productCountRange === '2,000–10,000') {
    productReq = 10000;
    productDisplay = '10,000';
  } else if (answers.productCountRange === '10,000+') {
    productReq = 25000;
    productDisplay = '10,000+';
  } else {
    productReq = 50;
    productDisplay = 'Under 100';
  }

  let orderReq = 100;
  let orderDisplay = 'Under 100';
  if (answers.monthlyOrdersRange === '100–1,000') {
    orderReq = 1000;
    orderDisplay = '1,000';
  } else if (answers.monthlyOrdersRange === '1,000–5,000') {
    orderReq = 5000;
    orderDisplay = '5,000';
  } else if (answers.monthlyOrdersRange === '5,000–20,000') {
    orderReq = 20000;
    orderDisplay = '20,000';
  } else if (answers.monthlyOrdersRange === '20,000+') {
    orderReq = 50000;
    orderDisplay = '20,000+';
  } else {
    orderReq = 100;
    orderDisplay = 'Under 100';
  }

  let teamReq = 1;
  let teamDisplay = '1 user';
  if (answers.teamSizeRange === '2–3') {
    teamReq = 3;
    teamDisplay = '3 users';
  } else if (answers.teamSizeRange === '4–10') {
    teamReq = 10;
    teamDisplay = '10 users';
  } else if (answers.teamSizeRange === '11–25') {
    teamReq = 20;
    teamDisplay = '20 users';
  } else if (answers.teamSizeRange === '25+') {
    teamReq = 50;
    teamDisplay = '25+ users';
  } else {
    teamReq = 1;
    teamDisplay = '1 user';
  }

  const channels = answers.salesChannels || [];
  const needs = answers.primaryNeeds || [];

  const requiresShopify = channels.includes('Shopify') || needs.includes('Shopify management');
  const requiresMultiStore =
    needs.includes('Multiple stores') ||
    (channels.includes('Multiple channels') && needs.includes('Shopify management'));

  const storesReq = requiresMultiStore ? 2 : requiresShopify ? 1 : 0;

  // Check for beyond standard plans (Scale max: 25,000 products, 100,000 orders, 15 team members)
  const isBeyondStandard =
    teamReq > 15 ||
    (answers.productCountRange === '10,000+' && answers.monthlyOrdersRange === '20,000+' && teamReq > 15);

  if (isBeyondStandard) {
    return {
      recommendedPlanKey: 'CUSTOM',
      planName: 'Enterprise / Custom',
      isBeyondStandardPlans: true,
      userSummary: {
        businessType: answers.businessType || 'D2C / E-commerce',
        productEstimate: productDisplay,
        orderEstimate: orderDisplay,
        shopifyStoresEstimate: storesReq,
        teamSizeEstimate: teamDisplay,
        primaryNeeds: needs.length > 0 ? needs : ['Enterprise Catalog Management'],
        growthExpectation: answers.growthExpectation || 'Scaling past standard limits',
      },
      whyThisPlan: [
        'Your business requirements exceed our standard public plan tiers',
        `Requires support for ${teamDisplay} (standard plans support up to 15 team seats)`,
        'Dedicated high-throughput database synchronization & custom API endpoints',
        'Custom enterprise service level agreement (SLA) & dedicated account manager',
      ],
      metrics: [
        {
          label: 'Products',
          requiredDisplay: productDisplay,
          capacityDisplay: '25,000+ (Custom)',
          requiredValue: productReq,
          capacityValue: 25000,
          percentage: 100,
          isWithinLimit: true,
        },
        {
          label: 'Monthly Transactions',
          requiredDisplay: orderDisplay,
          capacityDisplay: '100,000+ (Custom)',
          requiredValue: orderReq,
          capacityValue: 100000,
          percentage: 100,
          isWithinLimit: true,
        },
        {
          label: 'Shopify Stores',
          requiredDisplay: `${storesReq}`,
          capacityDisplay: 'Unlimited',
          requiredValue: storesReq,
          capacityValue: 10,
          percentage: 100,
          isWithinLimit: true,
        },
        {
          label: 'Team Members',
          requiredDisplay: teamDisplay,
          capacityDisplay: '15 (Standard Max)',
          requiredValue: teamReq,
          capacityValue: 15,
          percentage: 100,
          isWithinLimit: false,
        },
      ],
    };
  }

  // Deterministic evaluation against public plans in order: FREE -> STARTER (Founder) -> GROWTH -> PRO (Scale)
  // Recommends the lowest plan that satisfies all user requirements (no upselling)
  const candidateKeys: PlanType[] = ['FREE', 'STARTER', 'GROWTH', 'PRO'];
  let chosenKey: PlanType = 'PRO';

  for (const key of candidateKeys) {
    const config = PLAN_CONFIGS[key];

    // 1. Product capacity check
    if (config.productLimit < productReq) continue;

    // 2. Transaction capacity check
    if (config.transactionsLimit < orderReq) continue;

    // 3. Team capacity check
    if (config.teamMembersLimit < teamReq) continue;

    // 4. Shopify store support check
    if (requiresShopify && !config.shopifySyncAllowed) continue;

    // 5. Multi-store check
    if (requiresMultiStore && config.shopifyStoresLimit < 2) continue;

    // 6. Advanced features check
    if (needs.includes('Multiple stores') && key !== 'PRO' && key !== 'SCALE') continue;

    // All criteria satisfied by this tier!
    chosenKey = key;
    break;
  }

  const chosenConfig = PLAN_CONFIGS[chosenKey];

  // Generate specific transparent reasons why this plan was chosen
  const whyReasons: string[] = [
    `Supports your product volume (${productDisplay} within ${chosenConfig.productLimit.toLocaleString()} limit)`,
    `Supports your transaction volume (${orderDisplay} orders within ${chosenConfig.transactionsLimit.toLocaleString()} limit)`,
  ];

  if (requiresMultiStore) {
    whyReasons.push(`Supports your multi-store Shopify operations (${storesReq} stores)`);
  } else if (requiresShopify) {
    whyReasons.push(`Includes dedicated live Shopify integration`);
  } else {
    whyReasons.push(`Includes standard CSV & Excel catalog data import`);
  }

  if (teamReq > 1) {
    whyReasons.push(`Provides multi-user team seats (${teamDisplay} within ${chosenConfig.teamMembersLimit} seats limit)`);
  } else {
    whyReasons.push(`Tailored for solo founder execution without paying for unused team seats`);
  }

  if (chosenKey === 'FREE') {
    whyReasons.push(`100% free forever — ideal for validating your business concept`);
  } else if (chosenKey === 'STARTER' || chosenKey === 'FOUNDER') {
    whyReasons.push(`Includes 30-day demand forecasting & supplier reorder intelligence`);
  } else if (chosenKey === 'GROWTH') {
    whyReasons.push(`Includes 90-day demand forecasting, AI action center & What-If simulator`);
  } else {
    whyReasons.push(`Includes 180-day forecasting, multi-store sync & advanced AI copilot`);
  }

  // Visual fit metrics
  const metrics: PlanFitMetric[] = [
    {
      label: 'Products',
      requiredDisplay: productDisplay,
      capacityDisplay: chosenConfig.productLimit.toLocaleString(),
      requiredValue: productReq,
      capacityValue: chosenConfig.productLimit,
      percentage: Math.min(100, Math.round((productReq / chosenConfig.productLimit) * 100)),
      isWithinLimit: productReq <= chosenConfig.productLimit,
    },
    {
      label: 'Monthly Transactions',
      requiredDisplay: orderDisplay,
      capacityDisplay: chosenConfig.transactionsLimit.toLocaleString(),
      requiredValue: orderReq,
      capacityValue: chosenConfig.transactionsLimit,
      percentage: Math.min(100, Math.round((orderReq / chosenConfig.transactionsLimit) * 100)),
      isWithinLimit: orderReq <= chosenConfig.transactionsLimit,
    },
    {
      label: 'Shopify Stores',
      requiredDisplay: `${storesReq}`,
      capacityDisplay: `${chosenConfig.shopifyStoresLimit === 0 ? '0' : chosenConfig.shopifyStoresLimit >= 10 ? 'Multi-Store (10+)' : chosenConfig.shopifyStoresLimit}`,
      requiredValue: storesReq,
      capacityValue: Math.max(1, chosenConfig.shopifyStoresLimit),
      percentage: Math.min(100, Math.round((storesReq / Math.max(1, chosenConfig.shopifyStoresLimit)) * 100)),
      isWithinLimit: storesReq <= chosenConfig.shopifyStoresLimit,
    },
    {
      label: 'Team Members',
      requiredDisplay: teamDisplay,
      capacityDisplay: `${chosenConfig.teamMembersLimit} users`,
      requiredValue: teamReq,
      capacityValue: chosenConfig.teamMembersLimit,
      percentage: Math.min(100, Math.round((teamReq / chosenConfig.teamMembersLimit) * 100)),
      isWithinLimit: teamReq <= chosenConfig.teamMembersLimit,
    },
  ];

  return {
    recommendedPlanKey: chosenKey,
    planName: chosenConfig.name,
    isBeyondStandardPlans: false,
    userSummary: {
      businessType: answers.businessType || 'D2C / E-commerce',
      productEstimate: productDisplay,
      orderEstimate: orderDisplay,
      shopifyStoresEstimate: storesReq,
      teamSizeEstimate: teamDisplay,
      primaryNeeds: needs.length > 0 ? needs : ['Inventory Intelligence'],
      growthExpectation: answers.growthExpectation || 'Growing steadily',
    },
    whyThisPlan: whyReasons,
    metrics,
  };
}

export function getStructuredPricingContext(): string {
  const plansText = ORDERED_PLANS.map((key) => {
    const p = PLAN_CONFIGS[key];
    return `### Plan: ${p.name.toUpperCase()} (Internal Key: ${key})
- Stage: ${p.stage}
- Tagline: "${p.tagline}"
- Price: ₹${p.priceMonthly.toLocaleString('en-IN')}/month ($${p.priceMonthlyUSD}/month) | Yearly: ₹${p.priceYearly.toLocaleString('en-IN')}/year ($${p.priceYearlyUSD}/year)
- Price Subtext: "${p.priceSubtext}"
- Limits:
  * Products: ${p.productLimit.toLocaleString()} products
  * Transactions: ${p.transactionsLimit.toLocaleString()} transactions/month
  * AI Queries: ${p.aiQueriesLimit.toLocaleString()} queries/month
  * Team Members: ${p.teamMembersLimit} user${p.teamMembersLimit > 1 ? 's' : ''}
  * Connected Shopify Stores: ${p.shopifyStoresLimit === 0 ? 'Not included' : p.shopifyStoresLimit >= 10 ? 'Multi-Store (up to 10 stores)' : '1 Store'}
- Features Included:
${p.features.map((f) => `  * ${f}`).join('\n')}
- Narrative Description: "${p.description}"
`;
  }).join('\n');

  return `ANALYZEUP OFFICIAL PRICING & PLANS CONFIGURATION (Single Source of Truth)

${plansText}

IMPORTANT POLICY & UPGRADE RULES:
1. Users can start with Free or any plan, and upgrade or downgrade at any time.
2. If requirements exceed 25,000 products, 100,000 transactions/mo, or 15 team members, users need an Enterprise/Custom plan and should contact AnalyzeUp support.
3. Free does NOT support Shopify integration. Minimum plan for Shopify is Founder (₹499/mo).
4. For multi-store Shopify, Scale (₹2,499/mo) is required.
5. Always recommend the LOWEST plan that satisfies the user's requirements (no upselling).`;
}

