import { openai, isOpenAIConfigured } from '@/ai/openai';
import type {
  RAGQueryRequest,
  RAGResponse,
  VectorDocument,
  KnowledgeBaseStats,
  QueryIntent,
  Citation,
  SearchResult,
  AnalyticsResult,
} from './types';
import {
  chunkProducts,
  chunkTransactions,
  chunkSuppliers,
  chunkPurchaseOrders,
  chunkReturns,
  chunkFinancialAggregates,
} from './chunker';
import { generateBatchEmbeddings } from './embeddings';
import { globalVectorStore, IVectorStore } from './vector-store';
import { classifyQueryIntent } from './query-classifier';
import { executeDeterministicAnalytics } from './analytics-engine';
import { HybridRetriever } from './retriever';
import { buildRAGPromptContext } from './context-builder';
import { evaluateDataReadiness } from '@/lib/data-readiness-engine';

// Tracks indexing state per business
const indexingStatusMap = new Map<string, KnowledgeBaseStats>();

/**
 * Builds and indexes the complete business knowledge base into vector embeddings.
 * Supports incremental indexing (skips unchanged documents).
 */
export async function buildBusinessKnowledgeBase(
  businessId: string,
  products: any[] = [],
  transactions: any[] = [],
  suppliers: any[] = [],
  orders: any[] = [],
  returns: any[] = [],
  profile?: any | null,
  vectorStore: IVectorStore = globalVectorStore
): Promise<KnowledgeBaseStats> {
  if (!businessId) throw new Error('[RAG Orchestrator] businessId is required for knowledge base');

  indexingStatusMap.set(businessId, {
    totalVectors: 0,
    processedRecords: 0,
    lastIndexedAt: new Date().toISOString(),
    status: 'INDEXING',
  });

  try {
    // 1. Generate Entity-Level Chunks
    const productDocs = chunkProducts(products, businessId, transactions);
    const txDocs = chunkTransactions(transactions, businessId);
    const supplierDocs = chunkSuppliers(suppliers, businessId, products, orders);
    const orderDocs = chunkPurchaseOrders(orders, businessId);
    const returnDocs = chunkReturns(returns, businessId);
    const financialDocs = chunkFinancialAggregates(products, transactions, businessId, profile);

    const allDocs: VectorDocument[] = [
      ...productDocs,
      ...txDocs,
      ...supplierDocs,
      ...orderDocs,
      ...returnDocs,
      ...financialDocs,
    ];

    // 2. Generate Vector Embeddings (in batches with hashing and caching)
    const embeddingInputs = allDocs.map((d) => ({
      text: d.text,
      contentHash: d.contentHash,
    }));

    const embeddings = await generateBatchEmbeddings(embeddingInputs);

    // 3. Attach Embeddings to Documents
    allDocs.forEach((doc, idx) => {
      doc.embedding = embeddings[idx];
    });

    // 4. Upsert into Isolated Multi-Tenant Vector Store
    const { upserted, unchanged } = await vectorStore.upsert(businessId, allDocs);

    const stats: KnowledgeBaseStats = {
      totalVectors: allDocs.length,
      processedRecords: upserted + unchanged,
      lastIndexedAt: new Date().toISOString(),
      status: 'COMPLETED',
    };

    indexingStatusMap.set(businessId, stats);
    return stats;
  } catch (err) {
    console.error(`[RAG Orchestrator] Error indexing knowledge base for business ${businessId}:`, err);
    const failedStats: KnowledgeBaseStats = {
      totalVectors: 0,
      processedRecords: 0,
      lastIndexedAt: new Date().toISOString(),
      status: 'FAILED',
    };
    indexingStatusMap.set(businessId, failedStats);
    return failedStats;
  }
}

/**
 * Executes a full production RAG query flow:
 * 1. Intent Classification -> 2. Deterministic Analytics -> 3. Vector Retrieval -> 4. Context Build -> 5. LLM Synthesis
 */
export async function executeRAGQuery(
  request: RAGQueryRequest,
  vectorStore: IVectorStore = globalVectorStore
): Promise<RAGResponse> {
  const startTime = Date.now();
  const {
    businessId,
    query,
    chatHistory = [],
    products = [],
    transactions = [],
    suppliers = [],
    orders = [],
    returns = [],
    businessProfile,
    options = {},
  } = request;

  if (!businessId) throw new Error('[RAG Orchestrator] businessId is required for multi-tenant query');

  // 1. Classify Query Intent
  const intent: QueryIntent = options.forceIntent || classifyQueryIntent(query);

  const isDirectLLM =
    intent === 'GREETING' ||
    intent === 'CAPABILITIES' ||
    intent === 'CONVERSATIONAL' ||
    intent === 'GENERAL_KNOWLEDGE';

  let retrievedResults: SearchResult[] = [];
  let citations: Citation[] = [];
  let analytics: AnalyticsResult | null = null;

  if (isDirectLLM) {
    // For direct LLM queries (greetings, capabilities, general business advice outside store data):
    // DO NOT retrieve unrelated store vectors or calculate irrelevant product metrics.
    retrievedResults = [];
    citations = [];
    analytics = null;
  } else {
    // For app / store data related queries:
    // Ensure Knowledge Base is indexed
    const currentStats = await vectorStore.getStats(businessId);
    const cachedStats = indexingStatusMap.get(businessId);
    const totalRecords = products.length + transactions.length + suppliers.length + orders.length + returns.length;
    if ((currentStats.totalVectors === 0 || cachedStats?.processedRecords !== totalRecords) && totalRecords > 0) {
      await buildBusinessKnowledgeBase(
        businessId,
        products,
        transactions,
        suppliers,
        orders,
        returns,
        businessProfile,
        vectorStore
      );
    }

    // Deterministic Analytics (100% exact numerical answers)
    analytics = executeDeterministicAnalytics(
      intent,
      query,
      products,
      transactions,
      suppliers,
      orders,
      returns,
      businessProfile
    );

    // Hybrid Semantic + Keyword Vector Retrieval
    const retriever = new HybridRetriever(vectorStore);
    const retrieval = await retriever.retrieve(businessId, query, {
      topK: options.topK || 8,
      minScore: options.threshold || 0.15,
    });
    retrievedResults = retrieval.results;
    citations = retrieval.citations;
  }

  // 2. Build Compact, Verified Prompt Context with Data Readiness Envelope
  const dataReadiness = request.dataReadiness || evaluateDataReadiness(products, transactions);
  const builtContext = buildRAGPromptContext(
    query,
    intent,
    retrievedResults,
    analytics,
    citations,
    businessProfile,
    dataReadiness
  );

  let finalAnswer = '';
  let confidence: 'HIGH' | 'MEDIUM' | 'LOW' = 'HIGH';

  // 3. Call OpenAI LLM
  if (isOpenAIConfigured()) {
    try {
      const messagesPayload: any[] = [
        { role: 'system', content: builtContext.systemPrompt },
        ...chatHistory.slice(-4).map((m) => ({ role: m.role, content: m.content })),
        { role: 'user', content: builtContext.userPrompt },
      ];

      // Tune temperature based on intent
      const temperature =
        intent === 'GREETING' || intent === 'CONVERSATIONAL'
          ? 0.7
          : intent === 'GENERAL_KNOWLEDGE'
          ? 0.5
          : intent === 'CAPABILITIES'
          ? 0.3
          : 0.15;

      const maxTokens =
        intent === 'GREETING' || intent === 'CONVERSATIONAL'
          ? 350
          : intent === 'CAPABILITIES'
          ? 600
          : 1200;

      const response = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: messagesPayload,
        temperature,
        max_tokens: maxTokens,
      });

      finalAnswer = response.choices[0]?.message?.content || '';
    } catch (llmErr) {
      console.warn('[RAG Orchestrator] OpenAI LLM call failed, falling back to synthesis:', llmErr);
    }
  }

  // 4. Intelligent Fallback (guarantees clean, user-friendly output in all conditions)
  if (!finalAnswer) {
    if (intent === 'GREETING') {
      finalAnswer = `Hello! 👋 I am your **AnalyzeUp AI** Business Copilot.\n\nHow can I help you today? You can ask me about your store's sales, gross margins, inventory levels, dead stock, orders, or any general business and e-commerce questions!`;
    } else if (intent === 'CAPABILITIES') {
      finalAnswer =
        `Here is what I can do for you as **AnalyzeUp AI**:\n\n` +
        `• 📊 **Sales & Revenue Analytics**: Calculate total revenue, gross profit, profit margins, and Average Order Value (AOV).\n` +
        `• 📦 **Inventory & Dead Stock Optimization**: Identify stagnant dead stock, stockout risks, safety stock levels, and unlock tied-up working capital.\n` +
        `• 🚚 **Orders & Procurement**: Track orders, lookup SKUs, evaluate vendor lead times, and monitor fulfillment.\n` +
        `• 💡 **General Business & Strategy**: Answer any general e-commerce questions, marketing advice, formulas, or operational strategies.\n\n` +
        `What would you like to explore today?`;
    } else if (intent === 'CONVERSATIONAL') {
      finalAnswer = `You're very welcome! Feel free to ask anytime you need insights into your store data or business strategy.`;
    } else if (intent === 'GENERAL_KNOWLEDGE') {
      finalAnswer =
        `I am ready to help answer your e-commerce and business questions!\n\n` +
        `You can also ask about your store's specific data (e.g. *"What is our gross profit?"*, *"Which products are dead stock?"*).`;
    } else if (analytics) {
      finalAnswer =
        `### 🎯 Executive Summary\n\n` +
        `${analytics.summarySentence}\n\n` +
        `### 📊 Key Insights & Metrics\n` +
        `• **Primary Finding**: **${analytics.formattedValue}** (${analytics.metricName})\n` +
        (analytics.breakdown && analytics.breakdown.length > 0
          ? analytics.breakdown.slice(0, 5).map((b) => `• **${b.label}**: ${b.formatted}`).join('\n') + '\n\n'
          : '\n') +
        `### 💡 Recommended Action Plan\n` +
        `1. **Immediate Execution**: Prioritize critical stock replenishment and clearance tasks highlighted above.\n` +
        `2. **Working Capital Protection**: Maintain minimum safety stock thresholds to avoid tying up excess cash.\n` +
        `3. **Supplier Coordination**: Confirm lead times and fulfillment schedules with primary vendors.`;
    } else if (retrievedResults.length > 0) {
      finalAnswer =
        `### 🎯 Executive Summary\n\n` +
        `Retrieved **${retrievedResults.length} relevant business records** matching your query.\n\n` +
        `### 📊 Key Insights & Observations\n` +
        retrievedResults
          .slice(0, 4)
          .map((r, i) => {
            const meta = r.document.metadata || {};
            const title = (meta.name as string) || (meta.sku as string) || (meta.orderNumber as string) || `Record #${i + 1}`;
            const firstSentence = r.document.text.split('.')[0] + '.';
            return `• **${title}** (${r.document.sourceType.toUpperCase()}): ${firstSentence}`;
          })
          .join('\n') +
        `\n\n### 💡 Recommended Action Plan\n` +
        `1. **Review Cited Records**: Check the verified source items below for detailed SKU/Order data.\n` +
        `2. **Drill Down**: Use the specific SKU or order IDs above to adjust inventory or fulfillment settings.`;
    } else {
      finalAnswer =
        `### 🎯 Executive Summary\n\n` +
        `No direct matching records found for "${query}" in your active workspace dataset.\n\n` +
        `### 💡 Next Steps\n` +
        `• Try asking about specific product names, SKUs (e.g. "SKU-HEAD-101"), or categories.\n` +
        `• You can also ask high-level questions like *"What is our gross profit?"* or *"Which products are dead stock?"*.\n` +
        `• Or ask general e-commerce/business questions outside your data!`;
      confidence = 'LOW';
    }
  }

  const executionTimeMs = Date.now() - startTime;

  return {
    answer: finalAnswer,
    intent,
    citations: builtContext.citations,
    analytics: analytics || undefined,
    confidence,
    executionTimeMs,
    knowledgeBaseStats: {
      totalVectors: (await vectorStore.getStats(businessId)).totalVectors,
      relevantVectors: retrievedResults.length,
    },
  };
}
