'use server';

import { openai } from '@/ai/openai';

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export async function askAnalyzeUpChat(
  userMessage: string,
  chatHistory: ChatMessage[],
  products: any[],
  transactions: any[]
): Promise<string> {
  const systemPrompt = `
You are "Ask AnalyzeUp", a smart, expert AI business intelligence copilot integrated into the AnalyzeUp dashboard.
Your job is to answer questions about the user's business, sales performance, inventory levels, and general strategic growth.

You have access to the real-time business data below:

1. Current Products in Stock:
${JSON.stringify(products, null, 2)}

2. Recent Sales/Purchase Transactions:
${JSON.stringify(transactions, null, 2)}

INSTRUCTIONS:
1. Answer the user's question clearly, concisely, and professionally.
2. Ground all your answers strictly in the provided data. Do not make up facts or figures.
3. If the user asks a question about why profit dropped or what to reorder, look at the transactions and products to calculate and provide specific recommendations (like products that are out of stock or have low stock runway).
4. If there is no data in the database (i.e. products list is empty), explain that they haven't uploaded or added any inventory items yet, but provide high-level educational guidance and encourage them to import sample datasets.
5. Format your response nicely using markdown (bullet points, bold text, etc.) where appropriate.
6. Support Indian Rupee (₹) symbol for currency values.
`;

  try {
    const formattedMessages = [
      { role: 'system', content: systemPrompt },
      ...chatHistory.map((msg) => ({
        role: msg.role,
        content: msg.content,
      })),
      { role: 'user', content: userMessage },
    ];

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: formattedMessages as any,
      temperature: 0,
    });

    const reply = response.choices[0].message.content || "I couldn't generate a response. Please try again.";
    return reply;
  } catch (error) {
    console.error('Error in askAnalyzeUpChat:', error);
    return "Sorry, I encountered an error while analyzing your data. Please check your connection and try again.";
  }
}
