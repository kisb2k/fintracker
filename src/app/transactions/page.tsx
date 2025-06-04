
"use client";

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import type { ColumnDef } from "@tanstack/react-table";
import { ArrowUpDown, Eye, Sparkles, UploadCloud } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { DataTable } from "@/components/ui/data-table";
import { mockTransactions as initialMockTransactions, transactionCategories as allCategories, mockAccounts as initialMockAccounts } from "@/lib/mock-data";
import type { Transaction, Account, CategorizedTransaction, TaxDeductionInfo } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
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
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { format, parse, parseISO, isValid } from 'date-fns';
import { categorizeTransaction } from '@/ai/flows/categorize-transaction.ts';
import { identifyTaxDeductions } from '@/ai/flows/identify-tax-deductions.ts';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from '@/components/ui/badge';
import { useToast } from "@/hooks/use-toast";

const transactionFormSchema = z.object({
  description: z.string().min(1, "Description is required"),
  amount: z.coerce.number().positive("Amount must be positive. Use Type field for income/expense."),
  date: z.string().min(1, "Date is required"),
  category: z.string().min(1, "Category is required"),
  accountId: z.string().min(1, "Account is required"),
  type: z.enum(["income", "expense"]),
});

type TransactionFormData = z.infer<typeof transactionFormSchema>;

const AddTransactionForm: React.FC<{ 
  onAddTransaction: (newTx: Transaction) => void;
  accounts: Account[];
}> = ({ onAddTransaction, accounts }) => {
  const { toast } = useToast();
  const form = useForm<TransactionFormData>({
    resolver: zodResolver(transactionFormSchema),
    defaultValues: {
      description: "",
      amount: 0,
      date: format(new Date(), 'yyyy-MM-dd'),
      category: "",
      accountId: accounts[0]?.id || "",
      type: "expense",
    },
  });

  useEffect(() => {
    // Reset accountId if accounts list changes and current selection is not valid
    if (accounts.length > 0 && !accounts.find(acc => acc.id === form.getValues("accountId"))) {
      form.setValue("accountId", accounts[0].id);
    } else if (accounts.length === 0 && form.getValues("accountId") !== "") {
      form.setValue("accountId", "");
    }
  }, [accounts, form]);


  const onSubmit = (data: TransactionFormData) => {
    const newTransaction: Transaction = {
      id: `txn_${Date.now()}`,
      accountId: data.accountId,
      date: new Date(data.date).toISOString(),
      description: data.description,
      amount: data.type === 'expense' ? -Math.abs(data.amount) : Math.abs(data.amount),
      category: data.category,
      status: 'posted', // Manually added transactions are considered posted
    };
    onAddTransaction(newTransaction);
    toast({ title: "Transaction Added", description: `${data.description} successfully added.` });
    form.reset({
        description: "",
        amount: 0,
        date: format(new Date(), 'yyyy-MM-dd'),
        category: "",
        accountId: accounts[0]?.id || "",
        type: "expense",
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Add New Transaction</CardTitle>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl><Input placeholder="e.g., Coffee with client" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="amount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Amount</FormLabel>
                    <FormControl><Input type="number" step="0.01" placeholder="0.00" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Type</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl><SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger></FormControl>
                      <SelectContent>
                        <SelectItem value="expense">Expense</SelectItem>
                        <SelectItem value="income">Income</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
             <FormField
                control={form.control}
                name="date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Date</FormLabel>
                    <FormControl><Input type="date" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
               <FormField
                control={form.control}
                name="category"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Category</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl><SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger></FormControl>
                      <SelectContent>
                        {allCategories.map(cat => <SelectItem key={cat} value={cat}>{cat}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="accountId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Account</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value} disabled={accounts.length === 0}>
                      <FormControl><SelectTrigger><SelectValue placeholder="Select account" /></SelectTrigger></FormControl>
                      <SelectContent>
                        {accounts.map(acc => <SelectItem key={acc.id} value={acc.id}>{acc.name} ({acc.bankName})</SelectItem>)}
                      </SelectContent>
                    </Select>
                    {accounts.length === 0 && <FormDescription>Upload a transaction file to populate accounts or add them manually (feature pending).</FormDescription>}
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <Button type="submit" className="w-full md:w-auto">Add Transaction</Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
};


const TransactionInsights: React.FC<{ transaction: Transaction }> = ({ transaction }) => {
  const [isLoadingCategory, setIsLoadingCategory] = useState(false);
  const [isLoadingTax, setIsLoadingTax] = useState(false);
  const [categoryResult, setCategoryResult] = useState<CategorizedTransaction | null>(null);
  const [taxResult, setTaxResult] = useState<TaxDeductionInfo[] | null>(null); // Changed to array
  const [error, setError] = useState<string | null>(null);

  const handleCategorize = async () => {
    setIsLoadingCategory(true);
    setError(null);
    setCategoryResult(null);
    try {
      const result = await categorizeTransaction({ transactionDescription: transaction.description });
      setCategoryResult({
        originalDescription: transaction.description,
        suggestedCategory: result.category,
        confidence: result.confidence,
      });
    } catch (e) {
      setError("Failed to categorize transaction.");
      console.error("Categorization error:", e);
    }
    setIsLoadingCategory(false);
  };

  const handleTaxDeduction = async () => {
    setIsLoadingTax(true);
    setError(null);
    setTaxResult(null);
    try {
      const result = await identifyTaxDeductions({ transactionData: JSON.stringify([transaction]) });
      const deductions = JSON.parse(result.taxDeductions) as TaxDeductionInfo[]; // Ensure parsing as array
      
      // Filter for deductions relevant to the current transaction
      const relevantDeductions = deductions.filter(d => d.transactionId === transaction.id || !d.transactionId); // Looser match if transactionId is missing from AI output
      
      if(relevantDeductions.length > 0) {
        setTaxResult(relevantDeductions);
      } else {
        // If AI returns empty array or no matching transactionId
        setTaxResult([]); // Set to empty array to indicate "no deductions found" explicitly
      }

    } catch (e) {
      console.error("Tax deduction error:", e);
      setError("Failed to identify tax deductions or parse result.");
      setTaxResult([]); // Set to empty array on error
    }
    setIsLoadingTax(false);
  };


  return (
    <DialogContent className="sm:max-w-md">
      <DialogHeader>
        <DialogTitle>AI Insights for: {transaction.description}</DialogTitle>
        <DialogDescription>
          Amount: ${Math.abs(transaction.amount).toFixed(2)} on {format(parseISO(transaction.date), "MM/dd/yyyy")}
        </DialogDescription>
      </DialogHeader>
      <div className="space-y-4 py-4">
        {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
        
        <div>
          <h3 className="font-semibold mb-2">Smart Categorization</h3>
          <Button onClick={handleCategorize} disabled={isLoadingCategory} size="sm">
            {isLoadingCategory ? "Analyzing Category..." : "Suggest Category"} <Sparkles className="ml-2 h-4 w-4"/>
          </Button>
          {categoryResult && (
            <Alert className="mt-2">
              <AlertTitle>Suggested Category: {categoryResult.suggestedCategory}</AlertTitle>
              <AlertDescription>Confidence: {(categoryResult.confidence * 100).toFixed(0)}%</AlertDescription>
            </Alert>
          )}
        </div>

        <div>
          <h3 className="font-semibold mb-2">Tax Deduction Potential</h3>
           <Button onClick={handleTaxDeduction} disabled={isLoadingTax} size="sm">
            {isLoadingTax ? "Analyzing Tax Info..." : "Check Tax Deductions"} <Sparkles className="ml-2 h-4 w-4"/>
          </Button>
          {taxResult && taxResult.length > 0 && (
             <Alert className="mt-2" variant="default">
              <AlertTitle>Potential Tax Deduction Found!</AlertTitle>
              <AlertDescription>
                {taxResult.map((deduction, index) => (
                  <p key={index}><strong>Reason:</strong> {deduction.reason || deduction.description || 'AI analysis suggests this might be deductible.'}</p>
                ))}
              </AlertDescription>
            </Alert>
          )}
          {taxResult && taxResult.length === 0 && !isLoadingTax && !error && ( // Check for empty array
            <p className="text-sm text-muted-foreground mt-2">No specific tax deduction identified for this transaction by the AI.</p>
          )}
        </div>
      </div>
      <DialogFooter>
        <DialogTrigger asChild><Button variant="outline">Close</Button></DialogTrigger>
      </DialogFooter>
    </DialogContent>
  );
};

const FileUploadCard: React.FC<{
  onFileUpload: (transactions: Transaction[], accounts: Account[]) => void;
  existingAccounts: Account[];
}> = ({ onFileUpload, existingAccounts }) => {
  const { toast } = useToast();
  const [isParsing, setIsParsing] = useState(false);

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsParsing(true);
    const reader = new FileReader();
    reader.onload = async (e) => {
      const text = e.target?.result as string;
      if (!text) {
        toast({ title: "Error reading file", description: "File content is empty.", variant: "destructive" });
        setIsParsing(false);
        return;
      }
      try {
        const { parsedTransactions, newOrUpdatedAccounts } = parseCSV(text, existingAccounts);
        onFileUpload(parsedTransactions, newOrUpdatedAccounts);
        toast({ title: "File Processed", description: `${parsedTransactions.length} transactions loaded.` });
      } catch (error: any) {
        toast({ title: "Error Parsing File", description: error.message || "Could not parse CSV.", variant: "destructive" });
      } finally {
        setIsParsing(false;
        // Reset file input to allow uploading the same file again if needed
        event.target.value = ""; 
      }
    };
    reader.onerror = () => {
        toast({ title: "Error reading file", description: "Could not read file.", variant: "destructive"});
        setIsParsing(false);
        event.target.value = "";
    };
    reader.readAsText(file);
  };

  // Expected CSV Header: Date,Description,Amount,Type,Category,Account Name
  const parseCSV = (csvText: string, currentAccounts: Account[]): { parsedTransactions: Transaction[], newOrUpdatedAccounts: Account[] } => {
    const lines = csvText.split(/\r\n|\n/).filter(line => line.trim() !== '');
    if (lines.length < 2) throw new Error("CSV file must have a header and at least one data row.");

    const header = lines[0].split(',').map(h => h.trim());
    const expectedHeaders = ["Date", "Description", "Amount", "Type", "Category", "Account Name"];
    // Basic header check - can be more robust
    if (!expectedHeaders.every(eh => header.includes(eh))) {
        throw new Error(`CSV header mismatch. Expected: "${expectedHeaders.join(", ")}". Got: "${header.join(", ")}"`);
    }
    
    const dateIndex = header.indexOf("Date");
    const descriptionIndex = header.indexOf("Description");
    const amountIndex = header.indexOf("Amount");
    const typeIndex = header.indexOf("Type");
    const categoryIndex = header.indexOf("Category");
    const accountNameIndex = header.indexOf("Account Name");

    const transactions: Transaction[] = [];
    const uniqueAccountNames = new Set<string>(currentAccounts.map(a => a.name));
    let tempAccounts = [...currentAccounts];

    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',');
      if (values.length !== header.length) {
        console.warn(`Skipping malformed row ${i + 1}: ${lines[i]}`);
        continue;
      }

      const accountName = values[accountNameIndex]?.trim();
      let account = tempAccounts.find(acc => acc.name === accountName);
      if (!account && accountName) {
        uniqueAccountNames.add(accountName);
        const newAccountId = `acc_csv_${uniqueAccountNames.size}_${Date.now()}`;
        account = {
          id: newAccountId,
          name: accountName,
          bankName: "Uploaded File", // Or derive from somewhere if possible
          balance: 0, // Initial balance, could be updated later
          type: 'checking', // Default type
        };
        tempAccounts.push(account);
      }

      if (!account) {
        console.warn(`Skipping row ${i+1} due to missing account for name: ${accountName}`);
        continue;
      }
      
      const dateStr = values[dateIndex]?.trim();
      // Try parsing common date formats, be more robust in production
      const parsedDate = parse(dateStr, 'yyyy-MM-dd', new Date()); 
      if (!isValid(parsedDate)) {
          console.warn(`Skipping row ${i+1} due to invalid date: ${dateStr}`);
          continue;
      }

      const amount = parseFloat(values[amountIndex]?.trim());
      const type = values[typeIndex]?.trim().toLowerCase() as "income" | "expense";
      
      if (isNaN(amount) || (type !== "income" && type !== "expense")) {
          console.warn(`Skipping row ${i+1} due to invalid amount or type: Amount=${values[amountIndex]}, Type=${values[typeIndex]}`);
          continue;
      }

      transactions.push({
        id: `csv_txn_${Date.now()}_${i}`,
        accountId: account.id,
        date: parsedDate.toISOString(),
        description: values[descriptionIndex]?.trim() || "N/A",
        amount: type === 'expense' ? -Math.abs(amount) : Math.abs(amount),
        category: values[categoryIndex]?.trim() || "Uncategorized",
        status: 'posted',
      });
    }
    return { parsedTransactions: transactions, newOrUpdatedAccounts: tempAccounts };
  };


  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center">
          <UploadCloud className="mr-2 h-5 w-5" /> Upload Transactions (CSV)
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Input type="file" accept=".csv" onChange={handleFileChange} disabled={isParsing} />
        {isParsing && <p className="text-sm text-muted-foreground mt-2">Parsing file...</p>}
        <p className="text-xs text-muted-foreground mt-2">
          Expected CSV format: Date (YYYY-MM-DD), Description, Amount, Type (income/expense), Category, Account Name
        </p>
      </CardContent>
    </Card>
  );
};


export default function TransactionsPage() {
  const [transactions, setTransactions] = useState<Transaction[]>(initialMockTransactions);
  const [accounts, setAccounts] = useState<Account[]>(initialMockAccounts);
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);

  const handleAddTransaction = (newTx: Transaction) => {
    setTransactions(prev => [newTx, ...prev]);
  };

  const handleFileUpload = useCallback((uploadedTransactions: Transaction[], updatedAccounts: Account[]) => {
    setTransactions(uploadedTransactions);
    setAccounts(updatedAccounts); // Update accounts list based on what was parsed or created
  }, []);

  const columns: ColumnDef<Transaction>[] = useMemo(() => [
    {
      id: "select",
      header: ({ table }) => (
        <Checkbox
          checked={table.getIsAllPageRowsSelected()}
          onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
          aria-label="Select all"
        />
      ),
      cell: ({ row }) => (
        <Checkbox
          checked={row.getIsSelected()}
          onCheckedChange={(value) => row.toggleSelected(!!value)}
          aria-label="Select row"
        />
      ),
      enableSorting: false,
      enableHiding: false,
    },
    {
      accessorKey: "date",
      header: ({ column }) => (
        <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
          Date <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      ),
      cell: ({ row }) => {
          const dateValue = row.getValue("date");
          try {
            return format(parseISO(dateValue as string), "MMM dd, yyyy");
          } catch (e) {
            return "Invalid Date";
          }
        }
    },
    {
      accessorKey: "description",
      header: "Description",
    },
    {
      accessorKey: "category",
      header: "Category",
      cell: ({ row }) => <Badge variant="outline">{row.getValue("category")}</Badge>
    },
    {
      accessorKey: "amount",
      header: ({ column }) => (
        <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
          Amount <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      ),
      cell: ({ row }) => {
        const amount = parseFloat(row.getValue("amount"));
        const formatted = new Intl.NumberFormat("en-US", {
          style: "currency",
          currency: "USD",
        }).format(amount);
        return <div className={`text-right font-medium ${amount < 0 ? 'text-red-600' : 'text-green-600'}`}>{formatted}</div>;
      },
    },
    {
      accessorKey: "accountId",
      header: "Account",
      cell: ({row}) => {
        const account = accounts.find(acc => acc.id === row.getValue("accountId"));
        return account ? account.name : "Unknown Account";
      }
    },
    {
      id: "actions",
      cell: ({ row }) => {
        const transaction = row.original;
        return (
          <DialogTrigger asChild>
            <Button variant="ghost" className="h-8 w-8 p-0" onClick={() => setSelectedTransaction(transaction)}>
              <Eye className="h-4 w-4" /> <span className="sr-only">View Details / AI Insights</span>
            </Button>
          </DialogTrigger>
        );
      },
    },
  ], [accounts]);


  return (
    <Dialog onOpenChange={(isOpen) => { if (!isOpen) setSelectedTransaction(null); }}>
      <div className="space-y-6">
        <FileUploadCard onFileUpload={handleFileUpload} existingAccounts={accounts} />
        <AddTransactionForm onAddTransaction={handleAddTransaction} accounts={accounts} />
        <Card>
          <CardHeader>
            <CardTitle>Transaction History</CardTitle>
          </CardHeader>
          <CardContent>
            <DataTable
              columns={columns}
              data={transactions}
              filterColumnId="description"
              filterPlaceholder="Filter by description..."
            />
            {transactions.length === 0 && (
                <div className="text-center py-10">
                    <p className="text-muted-foreground">No transactions to display. Upload a CSV file or add transactions manually.</p>
                </div>
            )}
          </CardContent>
        </Card>
        {selectedTransaction && <TransactionInsights transaction={selectedTransaction} />}
      </div>
    </Dialog>
  );
}
