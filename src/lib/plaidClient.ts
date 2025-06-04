
import { PlaidApi, Configuration, PlaidEnvironments } from 'plaid';

const PLAID_CLIENT_ID = process.env.PLAID_CLIENT_ID;
const PLAID_SECRET_SANDBOX = process.env.PLAID_SECRET_SANDBOX;
// Add other environment secrets (development, production) as needed
// const PLAID_SECRET_DEVELOPMENT = process.env.PLAID_SECRET_DEVELOPMENT;

const PLAID_ENV = process.env.PLAID_ENV || 'sandbox';

// Determine the Plaid environment based on PLAID_ENV
const environment = PLAID_ENV === 'sandbox' ? PlaidEnvironments.sandbox :
                    PLAID_ENV === 'development' ? PlaidEnvironments.development :
                    PlaidEnvironments.production; // Default to production if not specified or other

const plaidConfig = new Configuration({
  basePath: environment,
  baseOptions: {
    headers: {
      'PLAID-CLIENT-ID': PLAID_CLIENT_ID,
      'PLAID-SECRET': PLAID_SECRET_SANDBOX, // Use the appropriate secret for the environment
      // For production, you'd use PLAID_SECRET_PRODUCTION
    },
  },
});

export const plaidClient = new PlaidApi(plaidConfig);
