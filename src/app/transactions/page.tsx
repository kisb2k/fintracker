
"use client";

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import type { ColumnDef, RowSelectionState } from "@tanstack/react-table";
import { ArrowUpDown, Eye, Sparkles, UploadCloud, Trash2, AlertCircle, PlusCircle, MoreHorizontal, Settings2, Edit3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { DataTable } from "@/components/ui/data-table";
import { transactionCategories as allCategories } from '@/lib/mock-data';
import type { Transaction, Account, CategorizedTransaction, TaxDeductionInfo } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
  FormLabel,
  FormMessage,
  FormDescription,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
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
import { Badge } from "@/components/ui/badge';
import { useToast } from "@/hooks/use-toast";
import { 
  getAccounts, 
  addAccount, 
  getTransactions, 
  addTransaction, 
  addTransactionsBatch,
  recalculateAndUpdateAccountBalance,
  recalculateAllAccountBalances,
  removeDuplicateTransactions,
  deleteTransaction as deleteTransactionAction,
  deleteTransactionsBatch as deleteTransactionsBatchAction,
  updateTransactionCategoryBatch as updateTransactionCategoryBatchAction,
} from '@/lib/actions';

const transactionFormSchema = z.object({
  description: z.string().min(1, "Description is required"),
  amount: z.coerce.number().positive("Amount must be positive. Use Type field for income/expense."),
  date: z.string().min(1, "Date is required").refine(val => isValid(parseISO(val)), { message: "Invalid date format" }),
  category: z.string().min(1, "Category is required"),
  accountId: z.string().min(1, "Account is required"),
  type: z.enum(["income", "expense"]),
});

type TransactionFormData = z.infer<typeof transactionFormSchema>;

type StatementType = "debit" | "credit";

const AddTransactionFormDialog: React.FC<{ 
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onTransactionAdded: () => void; 
  accounts: Account[];
}> = ({ isOpen, onOpenChange, onTransactionAdded, accounts }) => {
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
      date: new Date(data.date).toISOString(), 
      description: data.description,
      amount: data.type === 'expense' ? -Math.abs(data.amount) : Math.abs(data.amount),
      category: data.category,
      status: 'posted', 
    };
    
    const result = await addTransaction(newTransactionData);
    if (result) {
      toast({ title: "Transaction Added", description: `${data.description} successfully added.` });
      // Recalculation handled in addTransaction server action
      onTransactionAdded(); 
      form.reset({
          description: "",
          amount: 0,
          date: format(new Date(), 'yyyy-MM-dd'),
          category: "",
          accountId: accounts[0]?.id || "",
          type: "expense",
      });
      onOpenChange(false); // Close dialog
    } else {
      toast({ title: "Error", description: "Failed to add transaction.", variant: "destructive" });
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add New Transaction</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
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
                    <Select onValueChange={field.onChange} value={field.value || ""} disabled={accounts.length === 0}>
                      <FormControl><SelectTrigger><SelectValue placeholder="Select account" /></SelectTrigger></FormControl>
                      <SelectContent>
                        {accounts.map(acc => <SelectItem key={acc.id} value={acc.id}>{acc.name} ({acc.bankName})</SelectItem>)}
                      </SelectContent>
                    </Select>
                    {accounts.length === 0 && <FormDescription>No accounts available. Create accounts via CSV upload.</FormDescription>}
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <DialogFooter>
              <DialogClose asChild><Button type="button" variant="outline">Cancel</Button></DialogClose>
              <Button type="submit">Add Transaction</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};


const TransactionInsightsDialog: React.FC<{ 
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  transaction: Transaction | null;
}> = ({ isOpen, onOpenChange, transaction }) => {
  const [isLoadingCategory, setIsLoadingCategory] = useState(false);
  const [isLoadingTax, setIsLoadingTax] = useState(false);
  const [categoryResult, setCategoryResult] = useState<CategorizedTransaction | null>(null);
  const [taxResult, setTaxResult] = useState<TaxDeductionInfo[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Reset state when dialog opens with a new transaction or closes
    if (isOpen && transaction) {
        setCategoryResult(null);
        setTaxResult(null);
        setError(null);
    }
  }, [isOpen, transaction]);

  if (!transaction) return null;

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
      setTaxResult(relevantDeductions.length > 0 ? relevantDeductions : []);
    } catch (e) {
      console.error("Tax deduction error:", e);
      setError("Failed to identify tax deductions or parse result.");
      setTaxResult([]); 
    }
    setIsLoadingTax(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
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
          <DialogClose asChild><Button variant="outline">Close</Button></DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

const FileUploadDialog: React.FC<{
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onDataUploaded: () => void; 
  existingAccounts: Account[];
}> = ({ isOpen, onOpenChange, onDataUploaded, existingAccounts }) => {
  const { toast } = useToast();
  const [isProcessing, setIsProcessing] = useState(false);
  const [statementType, setStatementType] = useState<StatementType>("debit");
  const fileInputRef = React.useRef<HTMLInputElement>(null);


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
          existingAccounts,
          statementType
        );

        for (const accData of newAccountsToCreate) {
          await addAccount(accData);
        }
        
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
        // Balance recalculation handled in addTransactionsBatch
        onDataUploaded(); 
        onOpenChange(false); // Close dialog

      } catch (error: any) {
        console.error("File processing error:", error);
        toast({ title: "Error Processing File", description: error.message || "Could not process CSV with AI mapping.", variant: "destructive" });
      } finally {
        setIsProcessing(false);
        if (fileInputRef.current) fileInputRef.current.value = ""; 
      }
    };
    reader.onerror = () => {
        toast({ title: "Error reading file", description: "Could not read file.", variant: "destructive"});
        setIsProcessing(false);
        if (fileInputRef.current) fileInputRef.current.value = "";
    };
    reader.readAsText(file);
  };

  const parseCSVContent = (
    actualHeader: string[],
    dataLines: string[],
    mapping: MapCsvHeaderOutput,
    currentAccounts: Account[],
    selectedStatementType: StatementType
  ): { parsedTransactions: Omit<Transaction, 'id'>[], newAccountsToCreate: (Omit<Account, 'id' | 'balance'> & { id: string, balance?: number })[] } => {
    
    const transactions: Omit<Transaction, 'id'>[] = [];
    const newAccountsMap = new Map<string, Omit<Account, 'id' | 'balance'> & { id: string, balance?: number }>();
    const existingAccountMap = new Map(currentAccounts.map(acc => [acc.name.toLowerCase(), acc.id]));
    let tempAccountIdCounter = Date.now();

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

      const values = line.split(',').map(v => v.trim().replace(/^"|"$/g, '')); 
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
                id: newTempId, 
                name: accountName,
                bankName: "Uploaded File", 
                type: selectedStatementType === 'credit' ? 'credit card' : 'checking', 
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
      if (!isValid(parsedDate)) parsedDate = parse(dateStr, 'M/d/yy', new Date()); 

      if (!isValid(parsedDate)) {
          console.warn(`Skipping row ${i+1} due to invalid date format: ${dateStr}`);
          continue;
      }

      let rawCsvAmount = getNumericValue(columnIndexMap.Amount);
      if (isNaN(rawCsvAmount)) {
          console.warn(`Skipping row ${i+1} due to invalid or missing amount. Value: "${values[columnIndexMap.Amount!]}"`);
          continue;
      }

      let finalAmount: number;
      if (selectedStatementType === 'credit') {
        finalAmount = -rawCsvAmount; 
      } else { 
        finalAmount = rawCsvAmount;
      }
      
      const typeCsvColumn = mapping.Type;
      const typeIndex = typeCsvColumn ? actualHeader.indexOf(typeCsvColumn) : -1;
      let category = getStringValue(columnIndexMap.Category) || "Uncategorized";

      if (typeIndex !== -1) {
          const typeValue = getStringValue(typeIndex).toLowerCase();
      }
      
      transactions.push({
        accountId: accountId!,
        date: parsedDate.toISOString(),
        description: getStringValue(columnIndexMap.Description) || "N/A",
        amount: finalAmount,
        category: category,
        status: 'posted',
      });
    }
    return { parsedTransactions: transactions, newAccountsToCreate: Array.from(newAccountsMap.values()) };
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center"><UploadCloud className="mr-2 h-5 w-5" /> Upload Transactions (CSV)</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div>
            <Label className="text-sm font-medium">Statement Type</Label>
            <RadioGroup
              defaultValue="debit"
              onValueChange={(value: string) => setStatementType(value as StatementType)}
              className="flex gap-4 mt-1"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="debit" id="debit-type-dialog" />
                <Label htmlFor="debit-type-dialog">Debit/Bank Account</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="credit" id="credit-type-dialog" />
                <Label htmlFor="credit-type-dialog">Credit Card</Label>
              </div>
            </RadioGroup>
          </div>
          <Input type="file" accept=".csv" onChange={handleFileChange} disabled={isProcessing} ref={fileInputRef} />
          {isProcessing && <p className="text-sm text-muted-foreground mt-2">Processing file with AI...</p>}
          <p className="text-xs text-muted-foreground mt-2">
            The system will attempt to automatically map your CSV columns.
            Required concepts: Date, Description, Amount. Optional: Type (income/expense), Category, Account Name.
          </p>
        </div>
         <DialogFooter>
            <DialogClose asChild><Button type="button" variant="outline">Cancel</Button></DialogClose>
          </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};


const DataManagementDialog: React.FC<{ 
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onDataUpdated: () => void 
}> = ({ isOpen, onOpenChange, onDataUpdated }) => {
  const { toast } = useToast();
  const [isRemovingDuplicates, setIsRemovingDuplicates] = useState(false);
  const [isConfirmRemoveOpen, setIsConfirmRemoveOpen] = useState(false);

  const handleRemoveDuplicates = async () => {
    setIsRemovingDuplicates(true);
    setIsConfirmRemoveOpen(false); // Close confirmation dialog
    try {
      const result = await removeDuplicateTransactions();
      if (result.success) {
        toast({
          title: "Duplicates Removed",
          description: `${result.duplicatesRemoved} duplicate transaction(s) were removed.`,
        });
        onDataUpdated(); // Refresh data
        onOpenChange(false); // Close main dialog
      } else {
        toast({
          title: "Error Removing Duplicates",
          description: result.error || "An unexpected error occurred.",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error removing duplicates:", error);
      toast({
        title: "Operation Failed",
        description: "Could not remove duplicate transactions.",
        variant: "destructive",
      });
    }
    setIsRemovingDuplicates(false);
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Data Management</DialogTitle>
            <DialogDescription>Tools to help manage your transaction data.</DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Button variant="outline" onClick={() => setIsConfirmRemoveOpen(true)} disabled={isRemovingDuplicates} className="w-full">
              <Trash2 className="mr-2 h-4 w-4" />
              {isRemovingDuplicates ? "Removing..." : "Remove Duplicate Transactions"}
            </Button>
            <p className="text-xs text-muted-foreground mt-2 text-center">
              Checks for transactions with the exact same account, date, amount, and description.
            </p>
          </div>
          <DialogFooter>
            <DialogClose asChild><Button type="button" variant="outline">Close</Button></DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={isConfirmRemoveOpen} onOpenChange={setIsConfirmRemoveOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action will permanently remove duplicate transactions from your database.
              Duplicates are identified by the same account, date, amount, and description.
              This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleRemoveDuplicates} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Yes, Remove Duplicates
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

const BulkCategoryUpdateDialog: React.FC<{
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  selectedTransactionIds: string[];
  onUpdateComplete: () => void;
}> = ({ isOpen, onOpenChange, selectedTransactionIds, onUpdateComplete }) => {
  const { toast } = useToast();
  const [newCategory, setNewCategory] = useState("");
  const [isUpdating, setIsUpdating] = useState(false);

  const handleUpdateCategory = async () => {
    if (!newCategory || selectedTransactionIds.length === 0) {
      toast({ title: "Cannot Update", description: "Please select a category and ensure transactions are selected.", variant: "destructive"});
      return;
    }
    setIsUpdating(true);
    const result = await updateTransactionCategoryBatchAction(selectedTransactionIds, newCategory);
    if (result.success) {
      toast({ title: "Bulk Update Successful", description: `${result.count} transactions updated to category: ${newCategory}.`});
      onUpdateComplete();
      onOpenChange(false);
    } else {
      toast({ title: "Bulk Update Failed", description: result.error || "Could not update categories.", variant: "destructive"});
    }
    setIsUpdating(false);
  };
  
  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Bulk Update Category</DialogTitle>
          <DialogDescription>
            Update the category for {selectedTransactionIds.length} selected transaction(s).
          </DialogDescription>
        </DialogHeader>
        <div className="py-4 space-y-4">
          <FormItem>
            <FormLabel>New Category</FormLabel>
            <Select onValueChange={setNewCategory} value={newCategory}>
              <FormControl><SelectTrigger><SelectValue placeholder="Select new category" /></SelectTrigger></FormControl>
              <SelectContent>
                {allCategories.map(cat => <SelectItem key={cat} value={cat}>{cat}</SelectItem>)}
              </SelectContent>
            </Select>
          </FormItem>
        </div>
        <DialogFooter>
          <DialogClose asChild><Button variant="outline" disabled={isUpdating}>Cancel</Button></DialogClose>
          <Button onClick={handleUpdateCategory} disabled={isUpdating || !newCategory}>
            {isUpdating ? "Updating..." : "Update Category"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};


export default function TransactionsPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [selectedTransactionForInsights, setSelectedTransactionForInsights] = useState<Transaction | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const { toast } = useToast();

  const [isAddTransactionOpen, setIsAddTransactionOpen] = useState(false);
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [isDataManagementOpen, setIsDataManagementOpen] = useState(false);
  const [isInsightsOpen, setIsInsightsOpen] = useState(false);
  const [isBulkCategoryUpdateOpen, setIsBulkCategoryUpdateOpen] = useState(false);
  const [transactionToDeleteId, setTransactionToDeleteId] = useState<string | null>(null);


  const fetchData = useCallback(async () => {
    setIsLoading(true);
    const [dbAccounts, dbTransactions] = await Promise.all([
      getAccounts(),
      getTransactions()
    ]);
    setAccounts(dbAccounts);
    setTransactions(dbTransactions);
    setRowSelection({}); // Clear selection on data refresh
    setIsLoading(false);
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const selectedTransactionIds = useMemo(() => {
    return Object.keys(rowSelection).filter(key => rowSelection[key]);
  }, [rowSelection]);

  const handleOpenInsights = (transaction: Transaction) => {
    setSelectedTransactionForInsights(transaction);
    setIsInsightsOpen(true);
  };

  const handleDeleteSingleTransaction = async () => {
    if (!transactionToDeleteId) return;
    const result = await deleteTransactionAction(transactionToDeleteId);
    if (result.success) {
      toast({ title: "Transaction Deleted", description: "The transaction has been removed." });
      fetchData(); // Refresh data
    } else {
      toast({ title: "Error Deleting", description: result.error || "Could not delete transaction.", variant: "destructive" });
    }
    setTransactionToDeleteId(null); // Close confirmation
  };
  
  const handleBulkDelete = async () => {
    const idsToDelete = transactions.filter(t => rowSelection[t.id]).map(t => t.id);
    if (idsToDelete.length === 0) {
        toast({ title: "No transactions selected", variant: "destructive" });
        setTransactionToDeleteId(null); // Close confirmation (as it's reused)
        return;
    }
    const result = await deleteTransactionsBatchAction(idsToDelete);
    if (result.success) {
        toast({ title: "Bulk Delete Successful", description: `${result.count} transactions deleted.` });
        fetchData();
    } else {
        toast({ title: "Bulk Delete Failed", description: result.error || "Could not delete transactions.", variant: "destructive" });
    }
    setTransactionToDeleteId(null); // Close confirmation dialog
  };


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
           <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="h-8 w-8 p-0">
                <span className="sr-only">Open menu</span>
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => handleOpenInsights(transaction)}>
                <Sparkles className="mr-2 h-4 w-4" /> AI Insights
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => setTransactionToDeleteId(transaction.id)}
                className="text-destructive focus:text-destructive"
              >
                <Trash2 className="mr-2 h-4 w-4" /> Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        );
      },
    },
  ], [accounts, rowSelection]);


  if (isLoading) {
    return <div className="flex justify-center items-center h-64"><p>Loading data...</p></div>;
  }

  const numSelected = Object.keys(rowSelection).filter(key => rowSelection[key]).length;


  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-center gap-2">
        <div className="flex gap-2">
            <Button onClick={() => setIsAddTransactionOpen(true)}>
            <PlusCircle className="mr-2 h-4 w-4" /> Add New
            </Button>
            <Button variant="outline" onClick={() => setIsUploadOpen(true)}>
            <UploadCloud className="mr-2 h-4 w-4" /> Upload CSV
            </Button>
            <Button variant="outline" onClick={() => setIsDataManagementOpen(true)}>
            <Settings2 className="mr-2 h-4 w-4" /> Manage Data
            </Button>
        </div>
        {numSelected > 0 && (
          <div className="flex gap-2 mt-2 sm:mt-0">
            <Button variant="outline" onClick={() => setIsBulkCategoryUpdateOpen(true)}>
              <Edit3 className="mr-2 h-4 w-4" /> Update Category ({numSelected})
            </Button>
            <Button variant="destructive" onClick={() => setTransactionToDeleteId('bulk')}> {/* Use 'bulk' to signify bulk delete confirm */}
              <Trash2 className="mr-2 h-4 w-4" /> Delete Selected ({numSelected})
            </Button>
          </div>
        )}
      </div>

      <AddTransactionFormDialog 
        isOpen={isAddTransactionOpen}
        onOpenChange={setIsAddTransactionOpen}
        onTransactionAdded={fetchData}
        accounts={accounts}
      />
      <FileUploadDialog
        isOpen={isUploadOpen}
        onOpenChange={setIsUploadOpen}
        onDataUploaded={fetchData}
        existingAccounts={accounts}
      />
      <DataManagementDialog
        isOpen={isDataManagementOpen}
        onOpenChange={setIsDataManagementOpen}
        onDataUpdated={fetchData}
      />
      <TransactionInsightsDialog
        isOpen={isInsightsOpen}
        onOpenChange={setIsInsightsOpen}
        transaction={selectedTransactionForInsights}
      />
      <BulkCategoryUpdateDialog
        isOpen={isBulkCategoryUpdateOpen}
        onOpenChange={setIsBulkCategoryUpdateOpen}
        selectedTransactionIds={transactions.filter(t => rowSelection[t.id]).map(t => t.id)}
        onUpdateComplete={fetchData}
      />
      
      <AlertDialog open={!!transactionToDeleteId} onOpenChange={(open) => !open && setTransactionToDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              {transactionToDeleteId === 'bulk' 
                ? `This will permanently delete ${numSelected} selected transaction(s).`
                : "This action will permanently delete the transaction."}
              This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setTransactionToDeleteId(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={transactionToDeleteId === 'bulk' ? handleBulkDelete : handleDeleteSingleTransaction} 
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Yes, Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>


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
            rowSelection={rowSelection}
            setRowSelection={setRowSelection}
          />
          {transactions.length === 0 && !isLoading && (
              <div className="text-center py-10">
                  <p className="text-muted-foreground">No transactions to display. Upload a CSV file or add transactions manually.</p>
              </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
