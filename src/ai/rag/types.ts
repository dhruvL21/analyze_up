/**
 * Production-Grade RAG & Business Intelligence Types for AnalyzeUp
 */

export type SourceType =
  | 'product'
  | 'order'
  | 'transaction'
  | 'supplier'
  | 'customer'
  | 'inventory'
  | 'financial'
  | 'return';

export interface VectorDocument {
  id: string;
  businessId: string;
  sourceRecordId: string;
  sourceType: SourceType;
  text: string;
  contentHash: string;
  metadata: Record<string, unknown>;
  embedding?: number[];
  createdAt: string;
  updatedAt: string;
}

export type EmbeddingVector = number[];

export interface SearchResult {
  document: VectorDocument;
  similarity: number;
  matchType: 'semantic' | 'exact' | 'hybrid';
}

export interface Citation {
  sourceRecordId: string;
  sourceType: SourceType | string;
  label: string;
  snippet?: string;
  metadata?: Record<string, unknown>;
}

export type QueryIntent =
  | 'GREETING'
  | 'CAPABILITIES'
  | 'CONVERSATIONAL'
  | 'GENERAL_KNOWLEDGE'
  | 'PRODUCT_LOOKUP'
  | 'ORDER_LOOKUP'
  | 'INVENTORY'
  | 'SALES_ANALYTICS'
  | 'FINANCIAL_ANALYTICS'
  | 'SUPPLIER_ANALYSIS'
  | 'CUSTOMER_ANALYSIS'
  | 'TREND_ANALYSIS'
  | 'OPERATIONAL_FOCUS'
  | 'QUALITATIVE_SEARCH'
  | 'GENERAL_BUSINESS';

export interface AnalyticsBreakdownItem {
  label: string;
  value: number;
  formatted: string;
  extra?: Record<string, unknown>;
}

export interface AnalyticsResult {
  metricName: string;
  value: number | string;
  formattedValue: string;
  summarySentence: string;
  breakdown?: AnalyticsBreakdownItem[];
  rawData?: Record<string, unknown>;
}

export interface RAGContext {
  query: string;
  intent: QueryIntent;
  relevantChunks: SearchResult[];
  analyticsResult?: AnalyticsResult;
  businessSummary: string;
  citations: Citation[];
}

export interface ChatHistoryMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface RAGQueryRequest {
  businessId: string;
  query: string;
  chatHistory?: ChatHistoryMessage[];
  products: any[];
  transactions: any[];
  suppliers?: any[];
  orders?: any[];
  returns?: any[];
  businessProfile?: any | null;
  dataReadiness?: any;
  options?: {
    topK?: number;
    threshold?: number;
    forceIntent?: QueryIntent;
  };
}

export interface KnowledgeBaseStats {
  totalVectors: number;
  processedRecords: number;
  lastIndexedAt: string;
  status: 'PENDING' | 'INDEXING' | 'COMPLETED' | 'FAILED';
}

export interface RAGResponse {
  answer: string;
  intent: QueryIntent;
  citations: Citation[];
  analytics?: AnalyticsResult;
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
  executionTimeMs: number;
  knowledgeBaseStats: {
    totalVectors: number;
    relevantVectors: number;
  };
}
