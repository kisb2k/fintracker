
"use client";

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import type { ColumnDef } from "@tanstack/react-table";
import { ArrowUpDown, Eye, Sparkles, UploadCloud } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { DataTable } from "@/components/ui/data-table";
// import { mockTransactions as initialMockTransactions, transactionCategories as allCategories, mockAccounts as initialMockAccounts } from '@/lib/mock-data';
import { transactionCategories as allCategories } from '@/lib/mock-data';
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
  FormDescription,
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
import { mapCsvHeader, type MapCsvHeaderOutput } from '@/ai/flows/map-csv-header-flow';
import { REQUIRED_TRANSACTION_FIELDS } from '@/lib/constants';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from '@/components/ui/badge';
import { useToast } from "@/hooks/use-toast";
import { 
  getAccounts, 
  addAccount, 
  getTransactions, 
  addTransaction, 
  addTransactionsBatch,
  recalculateAndUpdateAccountBalance,
  recalculateAllAccountBalances
} from '@/lib/actions';

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
  onTransactionAdded: () => void; // Callback to refresh data
  accounts: Account[];
}> = ({ onTransactionAdded, accounts }) => {
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
    if (accounts.length > 0 && !form.getValues("accountId")) {
      form.setValue("accountId", accounts[0].id);
    } else if (accounts.length === 0 && form.getValues("accountId") !== "") {
      form.setValue("accountId", "");
    }
  }, [accounts, form]);


  const onSubmit = async (data: TransactionFormData) => {
    const newTransactionData: Omit<Transaction, 'id'> = {
      accountId: data.accountId,
      date: new Date(data.date).toISOString(), // Ensure date is stored as ISO string
      description: data.description,
      amount: data.type === 'expense' ? -Math.abs(data.amount) : Math.abs(data.amount),
      category: data.category,
      status: 'posted', 
    };
    
    const result = await addTransaction(newTransactionData);
    if (result) {
      toast({ title: "Transaction Added", description: `${data.description} successfully added.` });
      await recalculateAndUpdateAccountBalance(result.accountId); // Recalculate balance for the affected account
      onTransactionAdded(); // Refresh data on the page
      form.reset({
          description: "",
          amount: 0,
          date: format(new Date(), 'yyyy-MM-dd'),
          category: "",
          accountId: accounts[0]?.id || "",
          type: "expense",
      });
    } else {
      toast({ title: "Error", description: "Failed to add transaction.", variant: "destructive" });
    }
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
                    <FormControl><Input type="date" {...field} value={field.value ? format(new Date(field.value), 'yyyy-MM-dd') : ''} /></FormControl>
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
                    {accounts.length === 0 && <FormDescription>No accounts available. Upload a CSV with account info or add accounts manually.</FormDescription>}
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
  const [taxResult, setTaxResult] = useState<TaxDeductionInfo[] | null>(null);
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
      const deductions = JSON.parse(result.taxDeductions) as TaxDeductionInfo[]; 
      
      const relevantDeductions = deductions.filter(d => d.transactionId === transaction.id || !d.transactionId); 
      
      if(relevantDeductions.length > 0) {
        setTaxResult(relevantDeductions);
      } else {
        setTaxResult([]); 
      }

    } catch (e) {
      console.error("Tax deduction error:", e);
      setError("Failed to identify tax deductions or parse result.");
      setTaxResult([]); 
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
          {taxResult && taxResult.length === 0 && !isLoadingTax && !error && ( 
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
  onDataUploaded: () => void; // Callback to refresh data
  existingAccounts: Account[];
}> = ({ onDataUploaded, existingAccounts }) => {
  const { toast } = useToast();
  const [isProcessing, setIsProcessing] = useState(false);

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsProcessing(true);
    const reader = new FileReader();

    reader.onload = async (e) => {
      const csvText = e.target?.result as string;
      if (!csvText) {
        toast({ title: "Error reading file", description: "File content is empty.", variant: "destructive" });
        setIsProcessing(false);
        return;
      }

      const lines = csvText.split(/\r\n|\n/).filter(line => line.trim() !== '');
      if (lines.length < 1) {
        toast({ title: "Invalid CSV", description: "CSV file must have at least a header row.", variant: "destructive" });
        setIsProcessing(false);
        return;
      }
      
      const headerLine = lines[0];
      const dataLines = lines.slice(1);

      try {
        const mappingResult = await mapCsvHeader({
          csvHeader: headerLine,
          requiredFields: [...REQUIRED_TRANSACTION_FIELDS],
        });
        
        if (!mappingResult.Date || !mappingResult.Amount || !mappingResult.Description) {
            toast({ title: "Header Mapping Failed", description: "AI could not map essential fields (Date, Amount, Description). Please check CSV header.", variant: "destructive" });
            setIsProcessing(false);
            return;
        }

        const { parsedTransactions, newAccountsToCreate } = parseCSVContent(
          headerLine.split(',').map(h => h.trim()), 
          dataLines, 
          mappingResult, 
          existingAccounts
        );

        // Add new accounts to DB
        for (const accData of newAccountsToCreate) {
          await addAccount(accData);
        }
        
        // Add transactions to DB
        if (parsedTransactions.length > 0) {
          const batchResult = await addTransactionsBatch(parsedTransactions);
          toast({ title: "File Processed", description: `${batchResult.successCount} of ${parsedTransactions.length} transactions loaded.` });
          if (batchResult.errors.length > 0) {
            console.error("Errors during batch transaction add:", batchResult.errors);
            toast({ title: "Import Issues", description: `${batchResult.errors.length} transactions had issues. Check console.`, variant: "destructive"});
          }
        } else {
            toast({ title: "No Transactions", description: "No transactions were parsed from the file." });
        }
        await recalculateAllAccountBalances(); // Recalculate all account balances after batch import
        onDataUploaded(); // Refresh data on the page

      } catch (error: any) {
        console.error("File processing error:", error);
        toast({ title: "Error Processing File", description: error.message || "Could not process CSV with AI mapping.", variant: "destructive" });
      } finally {
        setIsProcessing(false);
        if (event.target) event.target.value = ""; 
      }
    };
    reader.onerror = () => {
        toast({ title: "Error reading file", description: "Could not read file.", variant: "destructive"});
        setIsProcessing(false);
        if (event.target) event.target.value = "";
    };
    reader.readAsText(file);
  };

  const parseCSVContent = (
    actualHeader: string[],
    dataLines: string[],
    mapping: MapCsvHeaderOutput,
    currentAccounts: Account[]
  ): { parsedTransactions: Omit<Transaction, 'id'>[], newAccountsToCreate: (Omit<Account, 'id' | 'balance'> & { id: string, balance?: number })[] } => {
    
    const transactions: Omit<Transaction, 'id'>[] = [];
    const newAccountsMap = new Map<string, Omit<Account, 'id' | 'balance'> & { id: string, balance?: number }>();
    const existingAccountMap = new Map(currentAccounts.map(acc => [acc.name.toLowerCase(), acc.id]));
    let tempAccountIdCounter = Date.now(); // For generating temporary unique IDs for new accounts from CSV

    const columnIndexMap: Partial<Record<typeof REQUIRED_TRANSACTION_FIELDS[number], number>> = {};
    for (const requiredField of REQUIRED_TRANSACTION_FIELDS) {
        const csvColumnName = mapping[requiredField];
        if (csvColumnName) {
            const index = actualHeader.indexOf(csvColumnName);
            if (index !== -1) {
                columnIndexMap[requiredField] = index;
            }
        }
    }

    if (columnIndexMap.Date === undefined || columnIndexMap.Amount === undefined || columnIndexMap.Description === undefined) {
        throw new Error("Essential fields (Date, Amount, Description) could not be mapped or found in the CSV header.");
    }

    for (let i = 0; i < dataLines.length; i++) {
      const line = dataLines[i];
      if (line.trim() === "") continue; 

      const values = line.split(',').map(v => v.trim().replace(/^"|"$/g, '')); // Trim and remove surrounding quotes
      if (values.length !== actualHeader.length) {
        console.warn(`Skipping malformed row ${i + 1}: column count mismatch. Expected ${actualHeader.length}, got ${values.length}. Line: "${line}"`);
        continue;
      }

      const getDateValue = (index?: number): string | undefined => index !== undefined ? values[index] : undefined;
      const getStringValue = (index?: number): string => (index !== undefined ? values[index] : "") || "";
      const getNumericValue = (index?: number): number => index !== undefined ? parseFloat(values[index]) : NaN;
      
      const accountNameCsvColumn = mapping['Account Name'];
      const accountNameIndex = accountNameCsvColumn ? actualHeader.indexOf(accountNameCsvColumn) : -1;
      const accountName = accountNameIndex !== -1 ? getStringValue(accountNameIndex) : "Default Account";
      
      let accountId = existingAccountMap.get(accountName.toLowerCase());

      if (!accountId) {
          const newTempId = `csv_acc_${tempAccountIdCounter++}`;
          if (!newAccountsMap.has(accountName.toLowerCase())) {
            newAccountsMap.set(accountName.toLowerCase(), {
                id: newTempId, // This ID will be used for adding to DB
                name: accountName,
                bankName: "Uploaded File", 
                type: 'checking', // Default type
            });
          }
          accountId = newAccountsMap.get(accountName.toLowerCase())!.id;
      }
      
      const dateStr = getDateValue(columnIndexMap.Date);
      if (!dateStr) {
          console.warn(`Skipping row ${i + 1} due to missing date.`);
          continue;
      }
      let parsedDate = parse(dateStr, 'yyyy-MM-dd', new Date());
      if (!isValid(parsedDate)) parsedDate = parse(dateStr, 'MM/dd/yyyy', new Date());
      if (!isValid(parsedDate)) parsedDate = parse(dateStr, 'dd-MM-yyyy', new Date());
      if (!isValid(parsedDate)) parsedDate = parse(dateStr, 'M/d/yy', new Date()); // Common short format

      if (!isValid(parsedDate)) {
          console.warn(`Skipping row ${i+1} due to invalid date format: ${dateStr}`);
          continue;
      }

      let amount = getNumericValue(columnIndexMap.Amount);
      if (isNaN(amount)) {
          console.warn(`Skipping row ${i+1} due to invalid or missing amount. Value: "${values[columnIndexMap.Amount!]}"`);
          continue;
      }

      let transactionType: "income" | "expense" = "expense"; 
      const typeCsvColumn = mapping.Type;
      const typeIndex = typeCsvColumn ? actualHeader.indexOf(typeCsvColumn) : -1;

      if (typeIndex !== -1) {
          const typeValue = getStringValue(typeIndex).toLowerCase();
          if (typeValue.includes("income") || typeValue.includes("credit") || typeValue.includes("deposit")) {
              transactionType = "income";
          } else if (typeValue.includes("expense") || typeValue.includes("debit") || typeValue.includes("withdrawal") || typeValue.includes("payment")) {
              transactionType = "expense";
          }
      } else {
          if (amount > 0) transactionType = "income";
          else if (amount < 0) transactionType = "expense";
      }
      
      amount = Math.abs(amount); 

      const categoryCsvColumn = mapping.Category;
      const categoryIndex = categoryCsvColumn ? actualHeader.indexOf(categoryCsvColumn) : -1;
      const category = categoryIndex !== -1 ? getStringValue(categoryIndex) : "Uncategorized";
      
      transactions.push({
        accountId: accountId!,
        date: parsedDate.toISOString(),
        description: getStringValue(columnIndexMap.Description) || "N/A",
        amount: transactionType === 'expense' ? -amount : amount,
        category: category,
        status: 'posted',
      });
    }
    return { parsedTransactions: transactions, newAccountsToCreate: Array.from(newAccountsMap.values()) };
  };


  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center">
          <UploadCloud className="mr-2 h-5 w-5" /> Upload Transactions (CSV)
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Input type="file" accept=".csv" onChange={handleFileChange} disabled={isProcessing} />
        {isProcessing && <p className="text-sm text-muted-foreground mt-2">Processing file with AI...</p>}
        <p className="text-xs text-muted-foreground mt-2">
          The system will attempt to automatically map your CSV columns.
          Required concepts: Date, Description, Amount. Optional: Type (income/expense), Category, Account Name.
        </p>
      </CardContent>
    </Card>
  );
};


export default function TransactionsPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    const [dbAccounts, dbTransactions] = await Promise.all([
      getAccounts(),
      getTransactions()
    ]);
    setAccounts(dbAccounts);
    setTransactions(dbTransactions);
    setIsLoading(false);
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);


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
        return <div className={`text-right font-medium ${amount < 0 ? 'text-destructive' : 'text-green-600'}`}>{formatted}</div>;
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


  if (isLoading) {
    return <div className="flex justify-center items-center h-64"><p>Loading data...</p></div>;
  }

  return (
    <Dialog onOpenChange={(isOpen) => { if (!isOpen) setSelectedTransaction(null); }}>
      <div className="space-y-6">
        <FileUploadCard onDataUploaded={fetchData} existingAccounts={accounts} />
        <AddTransactionForm onTransactionAdded={fetchData} accounts={accounts} />
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
            {transactions.length === 0 && !isLoading && (
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
