
"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
// import { mockAccounts as initialMockAccounts } from '@/lib/mock-data'; // Keep for existing manual/mock accounts
import type { Account } from '@/lib/types';
import { PlusCircle, Landmark, WalletCards, Trash2, CreditCard, DollarSign, Bitcoin } from 'lucide-react';
import { useToast } from "@/hooks/use-toast";
import { getAccounts, recalculateAllAccountBalances } from '@/lib/actions'; // Import getAccounts

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
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  const fetchAccountsData = useCallback(async () => {
    setIsLoading(true);
    // It might be beneficial to recalculate balances before fetching
    // if other parts of the app are adding transactions without explicitly updating balances.
    // However, if addTransaction/addTransactionsBatch correctly call recalculate, this might not be strictly needed here.
    // For robustness, let's ensure balances are up-to-date when this page loads.
    await recalculateAllAccountBalances();
    const dbAccounts = await getAccounts();
    setAccounts(dbAccounts);
    setIsLoading(false);
  }, []);

  useEffect(() => {
    fetchAccountsData();
  }, [fetchAccountsData]);

  const handleDeleteAccount = (accountId: string) => {
    // Note: This is a client-side removal for now.
    // True DB deletion would require a server action and consideration for related transactions.
    setAccounts(prev => prev.filter(acc => acc.id !== accountId));
    toast({ title: "Account Removed (Visually)", description: "The account has been removed from this view. Database deletion is not yet implemented.", variant: "destructive"});
  };
  
  if (isLoading) {
    return <div className="flex justify-center items-center h-64"><p>Loading accounts...</p></div>;
  }

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
            <p className="text-muted-foreground">No accounts found in the database.</p>
             <p className="text-sm text-muted-foreground mt-2">
              Accounts can be populated by uploading a transaction CSV file on the Transactions page.
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
            This page displays accounts stored in the application's database.
          </p>
          <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1 mt-2">
            <li>Account information (like names, IDs, types) is populated from uploaded transaction CSV files on the 'Transactions' page.</li>
            <li>Balances shown here are calculated based on the transactions associated with each account in the database.</li>
            <li>Manual account management (add, edit, true delete) can be added as a future enhancement.</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
