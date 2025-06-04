"use client";

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter as DialogModalFooter, // Renamed to avoid conflict if CardFooter was also named DialogFooter
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { mockAccounts } from '@/lib/mock-data';
import type { Account } from '@/lib/types';
import { PlusCircle, Landmark, WalletCards, Edit, Trash2, CreditCard, DollarSign, Bitcoin } from 'lucide-react';
import Image from 'next/image';
import { useToast } from "@/hooks/use-toast";

// Dummy Plaid Link Handler - in a real app, this would use Plaid's SDK
const usePlaidLink = (onSuccess: (publicToken: string, metadata: any) => void) => {
  const openPlaidLink = (bank: 'chase' | 'discover') => {
    // Simulate Plaid Link opening and success
    console.log(`Simulating Plaid Link for ${bank}`);
    setTimeout(() => {
      const mockPublicToken = `mock_public_token_${bank}_${Date.now()}`;
      const mockMetadata = {
        institution: { name: bank === 'chase' ? 'Chase' : 'Discover', institution_id: bank },
        accounts: [
          { id: `mock_acc_${bank}_checking`, name: `${bank === 'chase' ? 'Chase' : 'Discover'} Checking`, type: 'checking', subtype: 'checking', mask: Math.floor(1000 + Math.random() * 9000).toString() },
          { id: `mock_acc_${bank}_savings`, name: `${bank === 'chase' ? 'Chase' : 'Discover'} Savings`, type: 'savings', subtype: 'savings', mask: Math.floor(1000 + Math.random() * 9000).toString() },
        ],
      };
      onSuccess(mockPublicToken, mockMetadata);
    }, 1500);
  };
  return { openPlaidLink, isReady: true }; // Simulate ready state
};

const BankItem: React.FC<{ name: string; iconUrl: string; dataAiHint: string; onSelect: () => void }> = ({ name, iconUrl, dataAiHint, onSelect }) => (
  <Button variant="outline" className="w-full justify-start h-auto py-3 px-4" onClick={onSelect}>
    <Image src={iconUrl} alt={`${name} logo`} width={32} height={32} className="mr-3 rounded" data-ai-hint={dataAiHint} />
    Connect to {name}
  </Button>
);

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
  const [accounts, setAccounts] = useState<Account[]>(mockAccounts);
  const [isLinkingBank, setIsLinkingBank] = useState(false);
  const { toast } = useToast();

  const handlePlaidSuccess = async (publicToken: string, metadata: any) => {
    setIsLinkingBank(false); // Close dialog
    // Simulate token exchange and fetching account details
    console.log('Plaid public token:', publicToken);
    console.log('Plaid metadata:', metadata);

    // Create new mock accounts based on Plaid metadata
    const newAccountsFromPlaid: Account[] = metadata.accounts.map((acc: any) => ({
      id: `plaid_${acc.id}`,
      name: acc.name,
      bankName: metadata.institution.name === 'Chase' ? 'Chase' : 'Discover',
      balance: Math.random() * 10000, // Random balance for mock
      type: acc.type as Account['type'], // Assuming type matches
      lastFour: acc.mask,
    }));

    setAccounts(prev => [...prev, ...newAccountsFromPlaid]);
    toast({ title: "Bank Linked!", description: `${metadata.institution.name} connected successfully.` });
  };
  
  const { openPlaidLink, isReady } = usePlaidLink(handlePlaidSuccess);

  const handleDeleteAccount = (accountId: string) => {
    setAccounts(prev => prev.filter(acc => acc.id !== accountId));
    toast({ title: "Account Unlinked", description: "The account has been removed.", variant: "destructive"});
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-semibold font-headline">Linked Accounts</h1>
        <Dialog open={isLinkingBank} onOpenChange={setIsLinkingBank}>
          <DialogTrigger asChild>
            <Button><PlusCircle className="mr-2 h-4 w-4" /> Link New Account</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Link a New Bank Account</DialogTitle>
              <DialogDescription>
                Select your bank to securely connect your account using our trusted partner.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3 py-4">
              <BankItem name="Chase" iconUrl="https://placehold.co/64x64.png" dataAiHint="Chase logo" onSelect={() => isReady && openPlaidLink('chase')} />
              <BankItem name="Discover" iconUrl="https://placehold.co/64x64.png" dataAiHint="Discover logo" onSelect={() => isReady && openPlaidLink('discover')} />
              {/* Add more banks or a search input here */}
            </div>
             <DialogModalFooter>
                <Button variant="outline" onClick={() => setIsLinkingBank(false)}>Cancel</Button>
            </DialogModalFooter>
          </DialogContent>
        </Dialog>
      </div>

      {accounts.length === 0 ? (
         <Card className="text-center py-10">
          <CardContent className="flex flex-col items-center gap-4">
            <Landmark className="h-16 w-16 text-muted-foreground" />
            <p className="text-muted-foreground">No accounts linked yet.</p>
             <DialogTrigger asChild>
                <Button onClick={() => setIsLinkingBank(true)}>Link Your First Account</Button>
            </DialogTrigger>
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
                {/* <Button variant="ghost" size="sm"><Edit className="h-4 w-4 mr-1" /> Edit</Button> */}
                <Button variant="outline" size="sm" onClick={() => handleDeleteAccount(account.id)} className="text-destructive hover:text-destructive hover:border-destructive">
                  <Trash2 className="h-4 w-4 mr-1" /> Unlink
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
