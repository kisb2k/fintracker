
"use client";

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { mockAccounts as initialMockAccounts } from '@/lib/mock-data'; // Keep for existing manual/mock accounts
import type { Account } from '@/lib/types';
import { PlusCircle, Landmark, WalletCards, Edit, Trash2, CreditCard, DollarSign, Bitcoin } from 'lucide-react';
import { useToast } from "@/hooks/use-toast";

// Note: Plaid integration (usePlaidLink, createLinkToken, exchangePublicToken) has been removed.
// This page will now primarily display accounts, which might come from mock data or future file uploads.

const AccountIcon: React.FC<{ type: Account['type'] }> = ({ type }) => {
  switch (type) {
    case 'checking': return <Landmark className="h-5 w-5 text-primary" />;
    case 'savings': return <DollarSign className="h-5 w-5 text-green-500" />;
    case 'credit card': return <CreditCard className="h-5 w-5 text-orange-500" />;
    case 'cash': return <WalletCards className="h-5 w-5 text-sky-500" />;
    case 'crypto': return <Bitcoin className="h-5 w-5 text-yellow-500" />;
    default: return <Landmark className="h-5 w-5 text-muted-foreground" />;
  }
};

export default function AccountsPage() {
  // For now, accounts are still sourced from mockData.
  // In a full file-based system, this state would be populated by an accounts file upload
  // or derived from transaction file uploads.
  const [accounts, setAccounts] = useState<Account[]>(initialMockAccounts);
  const { toast } = useToast();

  // Placeholder for deleting an account (if manually managed or from a file)
  const handleDeleteAccount = (accountId: string) => {
    setAccounts(prev => prev.filter(acc => acc.id !== accountId));
    toast({ title: "Account Removed", description: "The account has been removed from view.", variant: "destructive"});
  };

  // Placeholder for adding/editing accounts manually or via file - future enhancement
  // const handleAddOrEditAccount = () => {
  //   toast({ title: "Feature Coming Soon", description: "Managing accounts via file upload or manual entry will be implemented here."});
  // };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-semibold font-headline">Managed Accounts</h1>
        {/* Button for adding accounts - to be implemented with file upload or manual form */}
        {/* <Button onClick={handleAddOrEditAccount}>
          <PlusCircle className="mr-2 h-4 w-4" />
          Manage Accounts
        </Button> */}
      </div>

      {accounts.length === 0 ? (
         <Card className="text-center py-10">
          <CardContent className="flex flex-col items-center gap-4">
            <Landmark className="h-16 w-16 text-muted-foreground" />
            <p className="text-muted-foreground">No accounts found.</p>
            {/* <Button onClick={handleAddOrEditAccount}>
                <PlusCircle className="mr-2 h-4 w-4" /> Add Your First Account
            </Button> */}
             <p className="text-sm text-muted-foreground mt-2">
              Account data can be populated by uploading a transaction file on the Transactions page.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {accounts.map((account) => (
            <Card key={account.id} className="shadow-lg hover:shadow-xl transition-shadow duration-300">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-lg font-medium">{account.name}</CardTitle>
                <AccountIcon type={account.type} />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-primary">
                  ${account.balance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
                <p className="text-sm text-muted-foreground capitalize">
                  {account.bankName} - {account.type}
                  {account.lastFour && ` (**** ${account.lastFour})`}
                </p>
                 <p className="text-xs text-muted-foreground mt-1">ID: {account.id}</p>
              </CardContent>
              <CardFooter className="flex justify-end gap-2">
                {/* Manual edit/delete might be complex if accounts are solely derived from transaction files */}
                {/* <Button variant="ghost" size="sm"><Edit className="h-4 w-4 mr-1" /> Edit</Button> */}
                <Button variant="outline" size="sm" onClick={() => handleDeleteAccount(account.id)} className="text-destructive hover:text-destructive hover:border-destructive">
                  <Trash2 className="h-4 w-4 mr-1" /> Remove
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}
       <Card>
        <CardHeader>
          <CardTitle>About Account Data</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            This page displays accounts. Previously, this was managed via Plaid integration. Now, with file-based imports:
          </p>
          <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1 mt-2">
            <li>Account information (like names and IDs) can be inferred from an uploaded transaction CSV file on the 'Transactions' page.</li>
            <li>Balances shown here are based on initial mock data or simple calculations and may not reflect real-time totals from uploaded files without further development.</li>
            <li>A dedicated feature to upload an "accounts file" or manually manage accounts in more detail could be added in the future.</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
