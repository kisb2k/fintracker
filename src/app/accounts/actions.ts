
'use server';

import { plaidClient } from '@/lib/plaidClient';
import { Products, CountryCode, LinkTokenCreateRequest } from 'plaid';
import type { AccountBase } from 'plaid';
import type { Account } from '@/lib/types';

// This is a placeholder for a real user ID from your authentication system
const MOCK_USER_ID = 'user_good';

export async function createLinkToken(): Promise<string | null> {
  try {
    const request: LinkTokenCreateRequest = {
      user: {
        client_user_id: MOCK_USER_ID, // Replace with actual user ID
      },
      client_name: 'FinTrack',
      products: [Products.Auth, Products.Transactions], // Specify products you need
      country_codes: [CountryCode.Us], // Specify country codes
      language: 'en',
      // redirect_uri: 'http://localhost:9002/accounts', // Optional: for OAuth flows
    };
    const response = await plaidClient.linkTokenCreate(request);
    return response.data.link_token;
  } catch (error) {
    console.error('Error creating link token:', error);
    return null;
  }
}

interface ExchangePublicTokenResponse {
  accounts?: Account[];
  error?: string;
  itemId?: string; // Useful for associating with user in DB
  accessToken?: string; // For demo only, DO NOT return to client in prod. Store in DB.
}

// Helper to map Plaid account types to your app's Account['type']
function mapPlaidAccountType(plaidType: AccountBase.TypeEnum, plaidSubtype: AccountBase.SubtypeEnum | null | undefined): Account['type'] {
  switch (plaidType) {
    case 'depository':
      if (plaidSubtype === 'checking') return 'checking';
      if (plaidSubtype === 'savings') return 'savings';
      return 'checking'; // Default for depository
    case 'credit':
      return 'credit card';
    case 'investment': // Plaid has investment types, mapping to 'savings' for simplicity here
    case 'brokerage':
      return 'savings'; // Or add an 'investment' type to your app
    case 'loan': // Plaid has loan types
      return 'other'; // Or add a 'loan' type
    default:
      return 'other';
  }
}


export async function exchangePublicToken(publicToken: string, metadata: any): Promise<ExchangePublicTokenResponse> {
  try {
    const exchangeResponse = await plaidClient.itemPublicTokenExchange({ public_token: publicToken });
    const accessToken = exchangeResponse.data.access_token;
    const itemId = exchangeResponse.data.item_id;

    // In a real app, you would store the accessToken and itemId securely in your database,
    // associated with your authenticated user. For this demo, we'll just fetch accounts.
    // DO NOT send the access_token back to the client in a production app.

    const accountsResponse = await plaidClient.accountsGet({ access_token: accessToken });
    const rawPlaidAccounts = accountsResponse.data.accounts;

    const mappedAccounts: Account[] = rawPlaidAccounts.map((plaidAccount: AccountBase) => ({
      id: plaidAccount.account_id,
      name: plaidAccount.name || `${metadata.institution.name} ${plaidAccount.subtype || plaidAccount.type}`,
      bankName: metadata.institution.name || 'Unknown Bank',
      balance: plaidAccount.balances.current || 0,
      type: mapPlaidAccountType(plaidAccount.type, plaidAccount.subtype),
      lastFour: plaidAccount.mask || undefined,
    }));
    
    return { accounts: mappedAccounts, itemId, accessToken: "NOT_FOR_CLIENT_DemoPurposesOnly_StoreInDB" };

  } catch (error: any) {
    console.error('Error exchanging public token or fetching accounts:', error.response?.data || error.message);
    return { error: 'Failed to link bank account. Please try again.' };
  }
}
