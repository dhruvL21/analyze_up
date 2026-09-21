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
  priceMonthly: number; // In INR
  priceMonthlyUSD: number;
  priceYearly: number; // In INR (Save ~2 months)
  priceYearlyUSD: number;
  productLimit: number;
  transactionsLimit: number;
  aiQueriesLimit: number;
  reportsLimit: number;
  teamMembersLimit: number;
  shopifySyncAllowed: boolean;
  forecastingAllowed: boolean;
  proactiveMonitoringAllowed: boolean;
  auditLogsAllowed: boolean;
  popular?: boolean;
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
    priceMonthly: 0,
    priceMonthlyUSD: 0,
    priceYearly: 0,
    priceYearlyUSD: 0,
    productLimit: 500,
    transactionsLimit: 2000,
    aiQueriesLimit: 20,
    reportsLimit: 10,
    teamMembersLimit: 1,
    shopifySyncAllowed: false,
    forecastingAllowed: false,
    proactiveMonitoringAllowed: false,
    auditLogsAllowed: false,
    popular: false,
    features: [
      '500 Products',
      '2,000 Transactions',
      '20 AI Queries / month',
      'Business Dashboard',
      'Business Health Score',
      'Inventory Intelligence',
      'CSV & Excel Import',
    ],
  },
  STARTER: {
    key: 'STARTER',
    name: 'Founder',
    priceMonthly: 499,
    priceMonthlyUSD: 6,
    priceYearly: 4990,
    priceYearlyUSD: 60,
    productLimit: 2500,
    transactionsLimit: 10000,
    aiQueriesLimit: 100,
    reportsLimit: 50,
    teamMembersLimit: 2,
    shopifySyncAllowed: true,
    forecastingAllowed: true,
    proactiveMonitoringAllowed: true,
    auditLogsAllowed: false,
    popular: false,
    features: [
      '2,500 Products',
      '10,000 Transactions',
      '100 AI Queries / month',
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
    priceMonthly: 499,
    priceMonthlyUSD: 6,
    priceYearly: 4990,
    priceYearlyUSD: 60,
    productLimit: 2500,
    transactionsLimit: 10000,
    aiQueriesLimit: 100,
    reportsLimit: 50,
    teamMembersLimit: 2,
    shopifySyncAllowed: true,
    forecastingAllowed: true,
    proactiveMonitoringAllowed: true,
    auditLogsAllowed: false,
    popular: false,
    features: [
      '2,500 Products',
      '10,000 Transactions',
      '100 AI Queries / month',
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
    priceMonthly: 999,
    priceMonthlyUSD: 12,
    priceYearly: 9990,
    priceYearlyUSD: 120,
    productLimit: 10000,
    transactionsLimit: 50000,
    aiQueriesLimit: 500,
    reportsLimit: 200,
    teamMembersLimit: 5,
    shopifySyncAllowed: true,
    forecastingAllowed: true,
    proactiveMonitoringAllowed: true,
    auditLogsAllowed: true,
    popular: true,
    features: [
      '10,000 Products',
      '50,000 Transactions',
      '500 AI Queries / month',
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
    priceMonthly: 2499,
    priceMonthlyUSD: 30,
    priceYearly: 24990,
    priceYearlyUSD: 300,
    productLimit: 50000,
    transactionsLimit: 250000,
    aiQueriesLimit: 2000,
    reportsLimit: 1000,
    teamMembersLimit: 15,
    shopifySyncAllowed: true,
    forecastingAllowed: true,
    proactiveMonitoringAllowed: true,
    auditLogsAllowed: true,
    popular: false,
    features: [
      '50,000 Products',
      '250,000 Transactions',
      '2,000 AI Queries / month',
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
    priceMonthly: 2499,
    priceMonthlyUSD: 30,
    priceYearly: 24990,
    priceYearlyUSD: 300,
    productLimit: 50000,
    transactionsLimit: 250000,
    aiQueriesLimit: 2000,
    reportsLimit: 1000,
    teamMembersLimit: 15,
    shopifySyncAllowed: true,
    forecastingAllowed: true,
    proactiveMonitoringAllowed: true,
    auditLogsAllowed: true,
    popular: false,
    features: [
      '50,000 Products',
      '250,000 Transactions',
      '2,000 AI Queries / month',
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
      { name: 'Products', free: '500', founder: '2,500', growth: '10,000', scale: '50,000' },
      { name: 'Transactions', free: '2,000', founder: '10,000', growth: '50,000', scale: '250,000' },
      { name: 'AI Queries', free: '20/month', founder: '100/month', growth: '500/month', scale: '2,000/month' },
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
