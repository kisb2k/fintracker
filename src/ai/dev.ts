
import { config } from 'dotenv';
config();

import '@/ai/flows/categorize-transaction.ts';
import '@/ai/flows/identify-tax-deductions.ts';
import '@/ai/flows/detect-unusual-spending.ts';
import '@/ai/flows/map-csv-header-flow.ts'; // Added new flow
