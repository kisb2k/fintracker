// src/ai/flows/detect-unusual-spending.ts
'use server';

/**
 * @fileOverview Detects unusual spending patterns in transaction history.
 *
 * - detectUnusualSpending - A function that detects unusual spending patterns.
 * - DetectUnusualSpendingInput - The input type for the detectUnusualSpending function.
 * - DetectUnusualSpendingOutput - The return type for the detectUnusualSpending function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const DetectUnusualSpendingInputSchema = z.object({
  transactionHistory: z.string().describe('The user transaction history as a JSON string.'),
  accountType: z.string().describe('The account type, e.g., checking, credit card.'),
  accountId: z.string().describe('The account ID.'),
});
export type DetectUnusualSpendingInput = z.infer<typeof DetectUnusualSpendingInputSchema>;

const DetectUnusualSpendingOutputSchema = z.object({
  unusualSpendingDetected: z.boolean().describe('Whether unusual spending is detected.'),
  explanation: z.string().describe('Explanation of why the spending is considered unusual.'),
  suggestedActions: z.string().describe('Suggested actions for the user to take.'),
});
export type DetectUnusualSpendingOutput = z.infer<typeof DetectUnusualSpendingOutputSchema>;

export async function detectUnusualSpending(input: DetectUnusualSpendingInput): Promise<DetectUnusualSpendingOutput> {
  return detectUnusualSpendingFlow(input);
}

const detectUnusualSpendingPrompt = ai.definePrompt({
  name: 'detectUnusualSpendingPrompt',
  input: {
    schema: DetectUnusualSpendingInputSchema,
  },
  output: {
    schema: DetectUnusualSpendingOutputSchema,
  },
  prompt: `You are an AI assistant specializing in personal finance. Your task is to analyze the user's transaction history and identify any unusual spending patterns.

  Here is the transaction history for account ID {{{accountId}}} ({{{accountType}}} account):
  {{transactionHistory}}

  Determine if there are any unusual spending patterns, such as:
  - Unusually large transactions compared to the user's average spending.
  - Significant changes in spending frequency.
  - Transactions in unfamiliar locations or categories.

  Based on your analysis, determine if unusualSpendingDetected is true or false. Provide a detailed explanation for your decision and suggest actions for the user to take.
  Ensure that the output is valid JSON.
  `,
});

const detectUnusualSpendingFlow = ai.defineFlow(
  {
    name: 'detectUnusualSpendingFlow',
    inputSchema: DetectUnusualSpendingInputSchema,
    outputSchema: DetectUnusualSpendingOutputSchema,
  },
  async input => {
    try {
      const {output} = await detectUnusualSpendingPrompt(input);
      return output!;
    } catch (e) {
      console.error('Error in detectUnusualSpendingFlow:', e);
      throw e;
    }
  }
);
