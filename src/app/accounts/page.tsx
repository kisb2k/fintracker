
"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { usePlaidLink, type PlaidLinkOptions, type PlaidLinkOnSuccess } from 'react-plaid-link';
import { createLinkToken, exchangePublicToken } from './actions'; // Import server actions
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter as DialogModalFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
// Input and Label are not used for Plaid Link directly but might be for manual accounts (if kept)
// import { Input } from "@/components/ui/input";
// import { Label } from "@/components/ui/label";
import { mockAccounts } from '@/lib/mock-data'; // Keep for existing manual/mock accounts
import type { Account } from '@/lib/types';
import { PlusCircle, Landmark, WalletCards, Edit, Trash2, CreditCard, DollarSign, Bitcoin, RefreshCw } from 'lucide-react';
import Image from 'next/image';
import { useToast } from "@/hooks/use-toast";

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
  const [accounts, setAccounts] = useState<Account[]>(mockAccounts); // Start with mock/manual accounts
  const [isPlaidModalOpen, setIsPlaidModalOpen] = useState(false);
  const [linkToken, setLinkToken] = useState<string | null>(null);
  const [isFetchingLinkToken, setIsFetchingLinkToken] = useState(false);
  const { toast } = useToast();

  const getLinkToken = useCallback(async () => {
    setIsFetchingLinkToken(true);
    try {
      const token = await createLinkToken();
      if (token) {
        setLinkToken(token);
      } else {
        toast({ title: "Error", description: "Could not initialize Plaid Link. Please try again.", variant: "destructive" });
      }
    } catch (error) {
      toast({ title: "Error", description: "Failed to connect to Plaid service.", variant: "destructive" });
      console.error("Error fetching link token:", error);
    } finally {
      setIsFetchingLinkToken(false);
    }
  }, [toast]);

  useEffect(() => {
    // Fetch link token when the component mounts or when the dialog is about to open
    if (isPlaidModalOpen && !linkToken && !isFetchingLinkToken) {
      getLinkToken();
    }
  }, [isPlaidModalOpen, linkToken, getLinkToken, isFetchingLinkToken]);

  const onSuccess = useCallback<PlaidLinkOnSuccess>(
    async (publicToken, metadata) => {
      setIsPlaidModalOpen(false); // Close dialog
      toast({ title: "Processing...", description: "Securely linking your bank account." });
      const response = await exchangePublicToken(publicToken, metadata);

      if (response.error || !response.accounts) {
        toast({ title: "Linking Failed", description: response.error || "Could not fetch account details.", variant: "destructive" });
      } else {
        // Add newly linked accounts, avoiding duplicates if any by ID
        // This is a simple client-side merge; a real app would handle this more robustly with a backend
        setAccounts(prev => {
            const existingIds = new Set(prev.map(acc => acc.id));
            const newUniqueAccounts = response.accounts!.filter(acc => !existingIds.has(acc.id));
            return [...prev, ...newUniqueAccounts];
        });
        toast({ title: "Bank Linked!", description: `${metadata.institution?.name || 'Bank'} connected successfully.` });
      }
      setLinkToken(null); // Reset link token for next use
    },
    [toast]
  );

  const plaidConfig: PlaidLinkOptions = {
    token: linkToken,
    onSuccess,
    onExit: (err, metadata) => {
      console.log('Plaid Link exited.', err, metadata);
      setIsPlaidModalOpen(false);
      if (err) {
        // toast({ title: "Plaid Link Closed", description: `Reason: ${err.display_message || err.error_message || 'Unknown error'}`, variant: "destructive" });
      }
       setLinkToken(null); // Reset link token
    },
    onEvent: (eventName, metadata) => {
      console.log('Plaid Link event:', eventName, metadata);
    }
  };

  const { open, ready, error } = usePlaidLink(plaidConfig);

  useEffect(() => {
    if (error) {
      toast({ title: "Plaid Error", description: error.message, variant: "destructive" });
      console.error("Plaid Link error state:", error);
    }
  }, [error, toast]);
  
  const handleOpenPlaid = () => {
    if (!linkToken && !isFetchingLinkToken) {
        getLinkToken(); // Fetch token if not already available
    }
    setIsPlaidModalOpen(true); // This will trigger useEffect to fetch token if needed
    // The PlaidLink modal will open once 'ready' and 'linkToken' are available
  };
  
  useEffect(() => {
    if (isPlaidModalOpen && ready && linkToken) {
      open();
    }
  }, [isPlaidModalOpen, ready, linkToken, open]);


  const handleDeleteAccount = (accountId: string) => {
    // In a real app, you might need to call an API to 'unlink' an item from Plaid
    // or just remove it from your local datastore.
    setAccounts(prev => prev.filter(acc => acc.id !== accountId));
    toast({ title: "Account Unlinked", description: "The account has been removed.", variant: "destructive"});
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-semibold font-headline">Linked Accounts</h1>
        {/* The DialogTrigger for Plaid is now manual via Button onClick */}
        <Button onClick={handleOpenPlaid} disabled={isFetchingLinkToken || (isPlaidModalOpen && !ready)}>
          <PlusCircle className="mr-2 h-4 w-4" />
          {isFetchingLinkToken ? "Initializing..." : "Link New Bank Account"}
        </Button>
      </div>

      {/* This Dialog is just a placeholder if PlaidLink opens its own modal */}
      {/* We control Plaid Link opening via `open()` directly when conditions are met */}
      {/* No actual Dialog component from shadcn is needed to *display* Plaid Link */}

      {accounts.length === 0 ? (
         <Card className="text-center py-10">
          <CardContent className="flex flex-col items-center gap-4">
            <Landmark className="h-16 w-16 text-muted-foreground" />
            <p className="text-muted-foreground">No accounts linked yet.</p>
            <Button onClick={handleOpenPlaid} disabled={isFetchingLinkToken || (isPlaidModalOpen && !ready)}>
                <PlusCircle className="mr-2 h-4 w-4" /> Link Your First Account
            </Button>
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
              </CardContent>
              <CardFooter className="flex justify-end gap-2">
                {/* Edit might be complex for Plaid-linked accounts, could be for manual accounts */}
                {/* <Button variant="ghost" size="sm"><Edit className="h-4 w-4 mr-1" /> Edit</Button> */}
                <Button variant="outline" size="sm" onClick={() => handleDeleteAccount(account.id)} className="text-destructive hover:text-destructive hover:border-destructive">
                  <Trash2 className="h-4 w-4 mr-1" /> Unlink
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}
      {/* Button to re-fetch link token if needed, for debugging/testing */}
      {isPlaidModalOpen && !linkToken && !isFetchingLinkToken && (
         <div className="mt-4 text-center">
            <p className="text-muted-foreground mb-2">Plaid Link initialization failed or token expired.</p>
            <Button variant="outline" onClick={getLinkToken} disabled={isFetchingLinkToken}>
                <RefreshCw className={`mr-2 h-4 w-4 ${isFetchingLinkToken ? 'animate-spin' : ''}`} /> Retry
            </Button>
        </div>
      )}
    </div>
  );
}
