
'use server';
/**
 * @fileOverview An AI agent for mapping CSV header columns to predefined transaction fields.
 *
 * - mapCsvHeader - A function that uses an LLM to map CSV header columns.
 * - MapCsvHeaderInput - The input type for the mapCsvHeader function.
 * - MapCsvHeaderOutput - The return type for the mapCsvHeader function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';
import { REQUIRED_TRANSACTION_FIELDS } from '@/lib/constants';

// Dynamically create the Zod schema for the output based on REQUIRED_TRANSACTION_FIELDS
const fieldMappingProperties = REQUIRED_TRANSACTION_FIELDS.reduce(
  (acc, field) => {
    acc[field] = z.string().nullable().describe(`The column name from the CSV header that maps to the '${field}' field. Null if no suitable column is found.`);
    return acc;
  },
  {} as Record<typeof REQUIRED_TRANSACTION_FIELDS[number], z.ZodNullable<z.ZodString>>
);

const MapCsvHeaderInputSchema = z.object({
  csvHeader: z.string().describe('A string containing the comma-separated header row of the CSV file.'),
  requiredFields: z.array(z.string()).describe('An array of strings representing the canonical field names your application expects for a transaction (e.g., "Date", "Description", "Amount").'),
});
export type MapCsvHeaderInput = z.infer<typeof MapCsvHeaderInputSchema>;

const MapCsvHeaderOutputSchema = z.object(fieldMappingProperties);
export type MapCsvHeaderOutput = z.infer<typeof MapCsvHeaderOutputSchema>;

export async function mapCsvHeader(input: MapCsvHeaderInput): Promise<MapCsvHeaderOutput> {
  return mapCsvHeaderFlow(input);
}

const prompt = ai.definePrompt({
  name: 'mapCsvHeaderPrompt',
  input: {schema: MapCsvHeaderInputSchema},
  output: {schema: MapCsvHeaderOutputSchema},
  prompt: `You are an intelligent CSV parsing assistant. Your task is to map columns from a given CSV header to a predefined set of required transaction fields.

CSV Header Provided:
{{{csvHeader}}}

Required Transaction Fields:
{{#each requiredFields}}
- {{{this}}}
{{/each}}

Instructions:
For each "Required Transaction Field" listed above, identify the single best-matching column name from the "CSV Header Provided".
- The matching should be flexible (e.g., "Transaction Date", "Date of Txn", "Date" should all map to "Date").
- For the 'Amount' field, prioritize a single column representing the net transaction amount. If the CSV has separate 'Debit' and 'Credit' columns, you can state that, but for the mapping, try to pick the most general 'Amount' column if one exists or specify how to derive it. For simplicity in this task, prefer a single column for 'Amount'.
- For the 'Type' field, look for columns indicating if the transaction is an "income" or "expense", or "credit" or "debit".
- If a required field cannot be confidently matched to any column in the CSV header, the value for that field in your response should be null.

Return a JSON object where keys are the "Required Transaction Fields" and values are the corresponding matched column names from the "CSV Header Provided", or null if no match is found.
Example required fields: ["Date", "Description", "Amount"]
Example CSV Header: "Transaction Date,Details,Cost"
Example Output: { "Date": "Transaction Date", "Description": "Details", "Amount": "Cost" }
`,
});

const mapCsvHeaderFlow = ai.defineFlow(
  {
    name: 'mapCsvHeaderFlow',
    inputSchema: MapCsvHeaderInputSchema,
    outputSchema: MapCsvHeaderOutputSchema,
  },
  async input => {
    // Ensure the requiredFields in the input for the prompt matches the canonical ones used for the output schema definition
    const consistentInput = {
        ...input,
        requiredFields: [...REQUIRED_TRANSACTION_FIELDS] // Use the canonical list for the prompt
    };
    const {output} = await prompt(consistentInput);
    return output!;
  }
);
