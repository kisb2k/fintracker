
"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardFooter, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogTrigger,
  DialogClose,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel as RHFFormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Account, AccountFormData } from '@/lib/types';
import { PlusCircle, Landmark, WalletCards, Trash2, CreditCard, DollarSign, Bitcoin, Edit } from 'lucide-react';
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { getAccounts, addAccount, updateAccountDetails, deleteAccount as deleteAccountAction, recalculateAllAccountBalances } from '@/lib/actions';

const accountTypes: Account['type'][] = ['checking', 'savings', 'credit card', 'cash', 'crypto', 'other', 'investment', 'loan'];

const accountFormSchema = z.object({
  name: z.string().min(2, "Account name must be at least 2 characters."),
  bankName: z.string().min(2, "Bank name must be at least 2 characters."),
  type: z.enum(accountTypes as [Account['type'], ...Account['type'][]], { // Zod enum needs at least one value
    errorMap: () => ({ message: "Please select a valid account type." }),
  }),
  lastFour: z.string().optional().nullable().refine(val => !val || /^\d{4}$/.test(val), {
    message: "Last four must be 4 digits if provided.",
  }),
});


const AccountForm: React.FC<{
  onSubmitForm: (data: AccountFormData) => Promise<{success: boolean, error?: string} | {account?: Account | null, error?: string}>;
  initialData?: Account;
  onClose: () => void;
  existingAccountNames?: string[]; // For edit mode, to exclude current name from uniqueness check
}> = ({ onSubmitForm, initialData, onClose, existingAccountNames = [] }) => {
  const { toast } = useToast();
  const form = useForm<AccountFormData>({
    resolver: zodResolver(accountFormSchema),
    defaultValues: initialData ? {
      name: initialData.name,
      bankName: initialData.bankName,
      type: initialData.type,
      lastFour: initialData.lastFour || "",
    } : {
      name: "",
      bankName: "",
      type: "checking",
      lastFour: "",
    },
  });

  const handleSubmit = async (data: AccountFormData) => {
    // Client-side check for name uniqueness if not editing the same name
    // Note: Server-side check is still the source of truth
    if (!initialData || data.name !== initialData.name) {
        if (existingAccountNames.map(n => n.toLowerCase()).includes(data.name.toLowerCase())) {
            form.setError("name", { type: "manual", message: "An account with this name already exists." });
            return;
        }
    }

    const result = await onSubmitForm(data);
    if ('success' in result && result.success) {
      toast({ title: initialData ? "Account Updated" : "Account Added", description: `${data.name} has been ${initialData ? 'updated' : 'added'}.` });
      onClose();
    } else if ('account' in result && result.account) {
      toast({ title: initialData ? "Account Updated" : "Account Added", description: `${data.name} has been ${initialData ? 'updated' : 'added'}.` });
      onClose();
    }
    else {
      const errorMessage = ('error' in result && result.error) || (initialData ? "Failed to update account." : "Failed to add account.");
      toast({ title: "Error", description: errorMessage, variant: "destructive" });
      if (errorMessage.toLowerCase().includes("name already exists")) {
        form.setError("name", { type: "manual", message: errorMessage });
      }
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <RHFFormLabel>Account Name</RHFFormLabel>
              <FormControl><Input placeholder="e.g., My Main Checking" {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="bankName"
          render={({ field }) => (
            <FormItem>
              <RHFFormLabel>Bank Name/Platform</RHFFormLabel>
              <FormControl><Input placeholder="e.g., Chase, Coinbase" {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="type"
          render={({ field }) => (
            <FormItem>
              <RHFFormLabel>Account Type</RHFFormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl><SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger></FormControl>
                <SelectContent>
                  {accountTypes.map(type => <SelectItem key={type} value={type} className="capitalize">{type}</SelectItem>)}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="lastFour"
          render={({ field }) => (
            <FormItem>
              <RHFFormLabel>Last Four Digits (Optional)</RHFFormLabel>
              <FormControl><Input placeholder="e.g., 1234" {...field} value={field.value ?? ""} /></FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          <Button type="submit">{initialData ? "Save Changes" : "Add Account"}</Button>
        </DialogFooter>
      </form>
    </Form>
  );
};


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
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);
  const [deletingAccountId, setDeletingAccountId] = useState<string | null>(null);
  const [existingAccountNames, setExistingAccountNames] = useState<string[]>([]);


  const fetchAccountsData = useCallback(async () => {
    setIsLoading(true);
    await recalculateAllAccountBalances(); // Ensure balances are fresh before fetching
    const dbAccounts = await getAccounts();
    setAccounts(dbAccounts);
    setExistingAccountNames(dbAccounts.map(acc => acc.name));
    setIsLoading(false);
  }, []);

  useEffect(() => {
    fetchAccountsData();
  }, [fetchAccountsData]);

  const handleAddAccount = async (data: AccountFormData) => {
    return addAccount(data).then(result => {
      if (result.account) fetchAccountsData(); // Re-fetch all accounts
      return result;
    });
  };

  const handleEditAccount = async (data: AccountFormData) => {
    if (!editingAccount) return {success: false, error: "No account selected for editing."};
    return updateAccountDetails(editingAccount.id, data).then(result => {
      if (result.success) fetchAccountsData();
      return result;
    });
  };

  const openEditDialog = (account: Account) => {
    setEditingAccount(account);
    setIsAddDialogOpen(true); // Re-use dialog, but it will be in "edit mode"
  };

  const openAddDialog = () => {
    setEditingAccount(null); // Clear editing account to ensure it's in "add mode"
    setIsAddDialogOpen(true);
  }
  
  const handleDeleteConfirm = async () => {
    if (!deletingAccountId) return;
    const result = await deleteAccountAction(deletingAccountId);
    if (result.success) {
      toast({ title: "Account Deleted", description: "The account has been removed." });
      fetchAccountsData();
    } else {
      toast({ title: "Error Deleting Account", description: result.error || "Could not delete the account.", variant: "destructive" });
    }
    setDeletingAccountId(null);
  };

  if (isLoading) {
    return <div className="flex justify-center items-center h-64"><p>Loading accounts...</p></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-semibold font-headline">Managed Accounts</h1>
        <Button onClick={openAddDialog}>
          <PlusCircle className="mr-2 h-4 w-4" /> Add New Account
        </Button>
      </div>

      <Dialog open={isAddDialogOpen} onOpenChange={(open) => {
          setIsAddDialogOpen(open);
          if (!open) setEditingAccount(null); // Clear editing state when dialog closes
        }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingAccount ? "Edit Account" : "Add New Account"}</DialogTitle>
            <DialogDescription>
              {editingAccount ? "Update the details of this account." : "Enter the details for the new account."}
            </DialogDescription>
          </DialogHeader>
          <AccountForm
            onSubmitForm={editingAccount ? handleEditAccount : handleAddAccount}
            initialData={editingAccount || undefined}
            onClose={() => { setIsAddDialogOpen(false); setEditingAccount(null); }}
            existingAccountNames={existingAccountNames.filter(name => name !== editingAccount?.name)}
          />
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deletingAccountId} onOpenChange={(open) => !open && setDeletingAccountId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action will permanently delete this account. This cannot be undone.
              Accounts with existing transactions cannot be deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDeletingAccountId(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteConfirm} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Yes, Delete Account
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>


      {accounts.length === 0 ? (
         <Card className="text-center py-10">
          <CardContent className="flex flex-col items-center gap-4">
            <Landmark className="h-16 w-16 text-muted-foreground" />
            <p className="text-muted-foreground">No accounts found in the database.</p>
             <p className="text-sm text-muted-foreground mt-2">
              Use the "Add New Account" button to create your first account, or upload a transaction CSV on the Transactions page (this will auto-create a default account if one with that name isn't found).
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {accounts.map((account) => (
            <Card key={account.id} className="shadow-lg hover:shadow-xl transition-shadow duration-300 flex flex-col">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-lg font-medium">{account.name}</CardTitle>
                <AccountIcon type={account.type} />
              </CardHeader>
              <CardContent className="flex-grow">
                <div className="text-3xl font-bold text-primary">
                  ${account.balance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
                <p className="text-sm text-muted-foreground capitalize">
                  {account.bankName} - {account.type}
                  {account.lastFour && ` (**** ${account.lastFour})`}
                </p>
                 <p className="text-xs text-muted-foreground mt-1">ID: {account.id}</p>
              </CardContent>
              <CardFooter className="flex justify-end gap-2 border-t pt-4">
                <Button variant="outline" size="sm" onClick={() => openEditDialog(account)}>
                  <Edit className="h-4 w-4 mr-1" /> Edit
                </Button>
                <Button variant="outline" size="sm" onClick={() => setDeletingAccountId(account.id)} className="text-destructive hover:text-destructive hover:border-destructive">
                  <Trash2 className="h-4 w-4 mr-1" /> Delete
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
            <li>Accounts can be added manually using the "Add New Account" button.</li>
            <li>Basic account information (name, type, bank) can be edited.</li>
            <li>Accounts can be deleted if they have no associated transactions.</li>
            <li>Balances shown here are calculated based on the transactions associated with each account in the database.</li>
            <li>The CSV upload on the 'Transactions' page now requires you to select an existing account.</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
