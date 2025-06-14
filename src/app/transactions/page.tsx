"use client";

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import type { ColumnDef, RowSelectionState } from "@tanstack/react-table";
import { ArrowUpDown, Eye, Sparkles, UploadCloud, Trash2, AlertCircle, PlusCircle, MoreHorizontal, Settings2, Edit } from "lucide-react"; // Edit3 removed as Edit is used.
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
  FormLabel as RHFFormLabel,
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
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { format, parse, parseISO, isValid } from 'date-fns';
import { categorizeTransaction } from '@/ai/flows/categorize-transaction';
import { identifyTaxDeductions } from '@/ai/flows/identify-tax-deductions';
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
  recalculateAllAccountBalances,
  removeDuplicateTransactions,
  deleteTransaction as deleteTransactionAction,
  deleteTransactionsBatch as deleteTransactionsBatchAction,
  updateMultipleTransactionFields,
} from '@/lib/actions';
import * as XLSX from 'xlsx';
import { CategoryManagerModal } from '@/components/CategoryManagerModal';
import { getCategories, addCategory, updateCategory, deleteCategory } from '@/lib/actions/categories';

interface Category {
  id: string;
  name: string;
  color: string;
  isDefault: boolean;
}

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
  categories: Category[];
}> = ({ isOpen, onOpenChange, onTransactionAdded, accounts, categories }) => {
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
    if (isOpen) {
        form.reset({
            description: "",
            amount: 0,
            date: format(new Date(), 'yyyy-MM-dd'),
            category: "",
            accountId: accounts.length > 0 ? accounts[0].id : "",
            type: "expense",
        });
    }
  }, [isOpen, accounts, form]);


  const onSubmit = async (data: TransactionFormData) => {
    const newTransactionData: Omit<Transaction, 'id' | 'loadTimestamp' | 'sourceFileName'> = {
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
      onTransactionAdded();
      onOpenChange(false);
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
                  <RHFFormLabel>Description</RHFFormLabel>
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
                    <RHFFormLabel>Amount</RHFFormLabel>
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
                    <RHFFormLabel>Type</RHFFormLabel>
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
                    <RHFFormLabel>Date</RHFFormLabel>
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
                    <RHFFormLabel>Category</RHFFormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl><SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger></FormControl>
                      <SelectContent>
                        {categories.map(cat => (
                          <SelectItem key={cat.id} value={cat.name}>
                            <div className="flex items-center gap-2">
                              <div
                                className="w-3 h-3 rounded-full"
                                style={{ backgroundColor: cat.color }}
                              />
                              {cat.name}
                            </div>
                          </SelectItem>
                        ))}
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
                    <RHFFormLabel>Account</RHFFormLabel>
                    <Select onValueChange={field.onChange} value={field.value || ""} disabled={accounts.length === 0}>
                      <FormControl><SelectTrigger><SelectValue placeholder="Select account" /></SelectTrigger></FormControl>
                      <SelectContent>
                        {accounts.map(acc => <SelectItem key={acc.id} value={acc.id}>{acc.name} ({acc.bankName})</SelectItem>)}
                      </SelectContent>
                    </Select>
                    {accounts.length === 0 && <FormDescription>No accounts available. Create accounts via CSV upload or on the Accounts page.</FormDescription>}
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
  const [selectedAccountId, setSelectedAccountId] = useState<string>("");
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen && existingAccounts.length > 0 && !selectedAccountId) {
      setSelectedAccountId(existingAccounts[0].id);
    } else if (isOpen && existingAccounts.length === 0) {
        setSelectedAccountId(""); // Clear selection if no accounts
    }
  }, [isOpen, existingAccounts, selectedAccountId]);


  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!selectedAccountId) {
      toast({ title: "Account Required", description: "Please select an account for this upload.", variant: "destructive" });
      return;
    }
    setIsProcessing(true);
    const fileName = file.name;
    const fileExt = fileName.split('.').pop()?.toLowerCase();
    let headerLine = '';
    let dataLines: string[] = [];
    let actualHeader: string[] = [];
    let isXlsx = false;
    if (fileExt === 'csv') {
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
        headerLine = lines[0];
        dataLines = lines.slice(1);
        actualHeader = headerLine.split(',').map(h => h.trim());
        await processParsedFile(actualHeader, dataLines, fileName, statementType);
      };
      reader.onerror = () => {
        toast({ title: "Error reading file", description: "Could not read file.", variant: "destructive" });
        setIsProcessing(false);
        if (fileInputRef.current) fileInputRef.current.value = "";
      };
      reader.readAsText(file);
    } else if (fileExt === 'xlsx') {
      isXlsx = true;
      const reader = new FileReader();
      reader.onload = async (e) => {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const json = XLSX.utils.sheet_to_json<string[]>(worksheet, { header: 1 });
        if (!json || json.length < 1) {
          toast({ title: "Invalid XLSX", description: "XLSX file must have at least a header row.", variant: "destructive" });
          setIsProcessing(false);
          return;
        }
        actualHeader = (json[0] as string[]).map(h => h.trim());
        dataLines = json.slice(1).map(row => (row as string[]).map(cell => `"${cell ?? ''}"`).join(','));
        await processParsedFile(actualHeader, dataLines, fileName, statementType);
      };
      reader.onerror = () => {
        toast({ title: "Error reading file", description: "Could not read file.", variant: "destructive" });
        setIsProcessing(false);
        if (fileInputRef.current) fileInputRef.current.value = "";
      };
      reader.readAsArrayBuffer(file);
    } else {
      toast({ title: "Unsupported File Type", description: "Please upload a CSV or XLSX file.", variant: "destructive" });
      setIsProcessing(false);
      return;
    }
  };

  const processParsedFile = async (
    actualHeader: string[],
    dataLines: string[],
    fileName: string,
    statementType: StatementType
  ) => {
    try {
      const mappingResult = await mapCsvHeader({
        csvHeader: actualHeader.join(','),
        requiredFields: [...REQUIRED_TRANSACTION_FIELDS],
      });
      if (!mappingResult.Date || !mappingResult.Amount || !mappingResult.Description) {
        toast({ title: "Header Mapping Failed", description: "AI could not map essential fields (Date, Amount, Description). Please check file header.", variant: "destructive" });
        setIsProcessing(false);
        return;
      }
      const parsedTransactions = parseCSVContent(
        actualHeader,
        dataLines,
        mappingResult,
        selectedAccountId,
        statementType
      );
      if (parsedTransactions.length > 0) {
        const batchResult = await addTransactionsBatch(parsedTransactions, fileName);
        toast({ title: "File Processed", description: `${batchResult.successCount} of ${parsedTransactions.length} transactions loaded.` });
        if (batchResult.errors.length > 0) {
          console.error("Errors during batch transaction add:", batchResult.errors);
          toast({ title: "Import Issues", description: `${batchResult.errors.length} transactions had issues. Check console.`, variant: "destructive" });
        }
      } else {
        toast({ title: "No Transactions", description: "No transactions were parsed from the file." });
      }
      onDataUploaded();
      onOpenChange(false);
    } catch (error: any) {
      console.error("File processing error:", error);
      toast({ title: "Error Processing File", description: error.message || "Could not process file with AI mapping.", variant: "destructive" });
    } finally {
      setIsProcessing(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
      setSelectedAccountId(existingAccounts.length > 0 ? existingAccounts[0].id : "");
    }
  };

  const parseCSVContent = (
    actualHeader: string[],
    dataLines: string[],
    mapping: MapCsvHeaderOutput,
    csvAccountId: string, 
    selectedStatementType: StatementType
  ): Omit<Transaction, 'id' | 'loadTimestamp' | 'sourceFileName'>[] => {

    const transactions: Omit<Transaction, 'id' | 'loadTimestamp' | 'sourceFileName'>[] = [];

    const columnIndexMap: Partial<Record<typeof REQUIRED_TRANSACTION_FIELDS[number], number>> = {};
    for (const requiredField of REQUIRED_TRANSACTION_FIELDS) {
        const csvColumnName = mapping[requiredField as keyof MapCsvHeaderOutput];
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

    const getDateValue = (index?: number, allValues?: string[]): string | undefined => (index !== undefined && allValues) ? allValues[index] : undefined;
    const getStringValue = (index?: number, allValues?: string[]): string => ((index !== undefined && allValues) ? allValues[index] : "") || "";
    const getNumericValue = (index?: number, allValues?: string[]): number => {
        if (index === undefined || !allValues || allValues[index] === undefined || allValues[index].trim() === "") {
          return NaN;
        }
        let s = allValues[index].trim();
        s = s.replace(/[$,€£]/g, '').replace(/,/g, '');
        if (s.startsWith('(') && s.endsWith(')')) {
          s = '-' + s.substring(1, s.length - 1);
        }
        const num = parseFloat(s);
        return isNaN(num) ? NaN : num;
    };


    for (let i = 0; i < dataLines.length; i++) {
      const line = dataLines[i];
      if (line.trim() === "") continue;

      const values = line.split(',').map(v => v.trim().replace(/^"|"$/g, ''));
      if (values.length !== actualHeader.length) {
        console.warn(`Skipping malformed row ${i + 1}: column count mismatch. Expected ${actualHeader.length}, got ${values.length}. Line: "${line}"`);
        continue;
      }

      const dateStr = getDateValue(columnIndexMap.Date, values);
      if (!dateStr) {
          console.warn(`Skipping row ${i + 1} due to missing date.`);
          continue;
      }
      let parsedDate = parse(dateStr, 'yyyy-MM-dd', new Date());
      if (!isValid(parsedDate)) parsedDate = parse(dateStr, 'MM/dd/yyyy', new Date());
      if (!isValid(parsedDate)) parsedDate = parse(dateStr, 'dd-MM-yyyy', new Date());
      if (!isValid(parsedDate)) parsedDate = parse(dateStr, 'M/d/yy', new Date());
      if (!isValid(parsedDate)) parsedDate = parse(dateStr, 'yyyy/MM/dd', new Date()); // Added another common format

      if (!isValid(parsedDate)) {
          console.warn(`Skipping row ${i+1} due to invalid date format: ${dateStr}`);
          continue;
      }

      let rawCsvAmount = getNumericValue(columnIndexMap.Amount, values);
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

      let category = getStringValue(columnIndexMap.Category, values) || "Uncategorized";

      transactions.push({
        accountId: csvAccountId, 
        date: parsedDate.toISOString(),
        description: getStringValue(columnIndexMap.Description, values) || "N/A",
        amount: finalAmount,
        category: category,
        status: 'posted',
      });
    }
    return transactions;
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => {
        onOpenChange(open);
        if (!open) {
            if (fileInputRef.current) fileInputRef.current.value = "";
            setSelectedAccountId(existingAccounts.length > 0 ? existingAccounts[0].id : "");
            setStatementType("debit");
        }
    }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center"><UploadCloud className="mr-2 h-5 w-5" /> Upload Transactions (CSV)</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div>
            <Label className="text-sm font-medium" htmlFor="csv-account-select">Account for this CSV</Label>
            <Select 
              value={selectedAccountId} 
              onValueChange={setSelectedAccountId}
              disabled={existingAccounts.length === 0}
            >
              <SelectTrigger id="csv-account-select">
                <SelectValue placeholder="Select an account" />
              </SelectTrigger>
              <SelectContent>
                {existingAccounts.map(acc => (
                  <SelectItem key={acc.id} value={acc.id}>{acc.name} ({acc.bankName})</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {existingAccounts.length === 0 && <p className="text-xs text-muted-foreground mt-1">No accounts found. Please add an account on the Accounts page first.</p>}
          </div>

          <div>
            <Label className="text-sm font-medium">Statement Type</Label>
            <RadioGroup
              value={statementType}
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
          <Input type="file" accept=".csv,.xlsx" onChange={handleFileChange} disabled={isProcessing || existingAccounts.length === 0 || !selectedAccountId} ref={fileInputRef} />
          {isProcessing && <p className="text-sm text-muted-foreground mt-2">Processing file with AI...</p>}
          <p className="text-xs text-muted-foreground mt-2">
            The system will attempt to automatically map your CSV columns.
            Required concepts: Date, Description, Amount. Optional: Type (income/expense), Category.
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
    setIsConfirmRemoveOpen(false);
    try {
      const result = await removeDuplicateTransactions();
      if (result.success) {
        toast({
          title: "Duplicates Removed",
          description: `${result.duplicatesRemoved} duplicate transaction(s) were removed.`,
        });
        onDataUpdated();
        onOpenChange(false);
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


const bulkTransactionUpdateFormSchema = z.object({
  date: z.string().optional().refine(val => !val || isValid(parseISO(val)), { message: "Invalid date format" }),
  description: z.string().optional(),
  amount: z.string().optional().refine(val => !val || !isNaN(parseFloat(val)), { message: "Amount must be a valid number"}),
  category: z.string().optional(),
  accountId: z.string().optional(),
});

type BulkTransactionUpdateFormData = z.infer<typeof bulkTransactionUpdateFormSchema>;

const BulkTransactionUpdateDialog: React.FC<{
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  selectedTransactionIds: string[];
  onUpdateComplete: () => void;
  accounts: Account[];
}> = ({ isOpen, onOpenChange, selectedTransactionIds, onUpdateComplete, accounts }) => {
  const { toast } = useToast();
  const [isUpdating, setIsUpdating] = useState(false);

  const form = useForm<BulkTransactionUpdateFormData>({
    resolver: zodResolver(bulkTransactionUpdateFormSchema),
    defaultValues: {
      date: "",
      description: "",
      amount: "",
      category: "",
      accountId: "",
    }
  });

 useEffect(() => {
    if (isOpen) {
      form.reset({ 
        date: "",
        description: "",
        amount: "",
        category: "",
        accountId: "",
      });
    }
  }, [isOpen, form]);


  const handleUpdate = async (data: BulkTransactionUpdateFormData) => {
    if (selectedTransactionIds.length === 0) {
      toast({ title: "No Transactions Selected", description: "Please select transactions to update.", variant: "destructive"});
      return;
    }
    
    const updates: { category?: string; date?: string; description?: string; amount?: number; accountId?: string;} = {};
    if (data.category) updates.category = data.category;
    if (data.date) updates.date = parseISO(data.date).toISOString();
    if (data.description && data.description.trim() !== "") updates.description = data.description;
    if (data.amount && data.amount.trim() !== "") updates.amount = parseFloat(data.amount);
    if (data.accountId) updates.accountId = data.accountId;


    if (Object.keys(updates).length === 0) {
      toast({ title: "No Changes", description: "Please provide at least one field to update.", variant: "default"});
      return;
    }

    setIsUpdating(true);
    const result = await updateMultipleTransactionFields(selectedTransactionIds, updates);
    if (result.success) {
      toast({ title: "Bulk Update Successful", description: `${result.count} transactions updated.`});
      onUpdateComplete();
      onOpenChange(false);
    } else {
      toast({ title: "Bulk Update Failed", description: result.error || "Could not update transactions.", variant: "destructive"});
    }
    setIsUpdating(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { onOpenChange(open); if (!open) form.reset();}}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Update Transaction Data</DialogTitle>
          <DialogDescription>
            Update fields for {selectedTransactionIds.length} selected transaction(s). Only filled fields will be updated.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
        <form onSubmit={form.handleSubmit(handleUpdate)} className="space-y-4 py-4">
          <FormField
            control={form.control}
            name="date"
            render={({ field }) => (
              <FormItem>
                <RHFFormLabel>New Date (Optional)</RHFFormLabel>
                <FormControl><Input type="date" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="description"
            render={({ field }) => (
              <FormItem>
                <RHFFormLabel>New Description (Optional)</RHFFormLabel>
                <FormControl><Input placeholder="Enter new description" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="amount"
            render={({ field }) => (
              <FormItem>
                <RHFFormLabel>New Amount (Optional)</RHFFormLabel>
                <FormControl><Input type="number" step="0.01" placeholder="e.g., -25.50 or 100" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="category"
            render={({ field }) => (
              <FormItem>
                <RHFFormLabel>New Category (Optional)</RHFFormLabel>
                <Select onValueChange={field.onChange} value={field.value || ""}>
                  <FormControl><SelectTrigger><SelectValue placeholder="Select new category" /></SelectTrigger></FormControl>
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
                <RHFFormLabel>New Account (Optional)</RHFFormLabel>
                <Select onValueChange={field.onChange} value={field.value || ""}>
                  <FormControl><SelectTrigger><SelectValue placeholder="Select new account" /></SelectTrigger></FormControl>
                  <SelectContent>
                    {accounts.map(acc => <SelectItem key={acc.id} value={acc.id}>{acc.name} ({acc.bankName})</SelectItem>)}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
          <DialogFooter>
            <DialogClose asChild><Button variant="outline" type="button" disabled={isUpdating}>Cancel</Button></DialogClose>
            <Button type="submit" disabled={isUpdating}>
              {isUpdating ? "Updating..." : "Update Transactions"}
            </Button>
          </DialogFooter>
        </form>
        </Form>
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
  const [isBulkUpdateOpen, setIsBulkUpdateOpen] = useState(false);
  const [transactionToDeleteId, setTransactionToDeleteId] = useState<string | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoadingCategories, setIsLoadingCategories] = useState(true);


  const fetchData = useCallback(async () => {
    setIsLoading(true);
    const [dbAccounts, dbTransactions] = await Promise.all([
      getAccounts(),
      getTransactions()
    ]);
    setAccounts(dbAccounts);
    setTransactions(dbTransactions);
    setRowSelection({});
    setIsLoading(false);
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    const loadCategories = async () => {
      try {
        const loadedCategories = await getCategories();
        setCategories(loadedCategories);
        setIsLoadingCategories(false);
      } catch (error) {
        console.error('Failed to load categories:', error);
        setIsLoadingCategories(false);
      }
    };
    loadCategories();
  }, []);

  const selectedTransactionIds = useMemo(() => {
    return Object.keys(rowSelection).filter(key => rowSelection[key]);
  }, [rowSelection]);

  const handleOpenInsights = (transaction: Transaction) => {
    setSelectedTransactionForInsights(transaction);
    setIsInsightsOpen(true);
  };

  const handleDeleteSingleTransaction = async () => {
    if (!transactionToDeleteId || transactionToDeleteId === 'bulk') return;
    const result = await deleteTransactionAction(transactionToDeleteId);
    if (result.success) {
      toast({ title: "Transaction Deleted", description: "The transaction has been removed." });
      fetchData();
    } else {
      toast({ title: "Error Deleting", description: result.error || "Could not delete transaction.", variant: "destructive" });
    }
    setTransactionToDeleteId(null);
  };

 const handleBulkDelete = async () => {
    if (selectedTransactionIds.length === 0) {
      toast({
        title: "No Transactions Selected",
        description: "Please select transactions to delete.",
        variant: "destructive"
      });
      setTransactionToDeleteId(null);
      return;
    }

    const result = await deleteTransactionsBatchAction(selectedTransactionIds);
    if (result.success) {
      toast({ title: "Bulk Delete Successful", description: `${result.count} transactions deleted.` });
      fetchData();
    } else {
      toast({ title: "Bulk Delete Failed", description: result.error || "Could not delete selected transactions.", variant: "destructive" });
    }
    setTransactionToDeleteId(null);
  };

  const handleAddCategory = async (name: string, color: string) => {
    try {
      await addCategory(name, color);
      const updatedCategories = await getCategories();
      setCategories(updatedCategories);
    } catch (error) {
      console.error('Failed to add category:', error);
    }
  };

  const handleUpdateCategory = async (id: string, name: string, color: string) => {
    try {
      await updateCategory(id, name, color);
      const updatedCategories = await getCategories();
      setCategories(updatedCategories);
    } catch (error) {
      console.error('Failed to update category:', error);
    }
  };

  const handleDeleteCategory = async (id: string) => {
    try {
      await deleteCategory(id);
      const updatedCategories = await getCategories();
      setCategories(updatedCategories);
    } catch (error) {
      console.error('Failed to delete category:', error);
    }
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
      accessorKey: "loadTimestamp",
      header: ({ column }) => (
        <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
          Load Time <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      ),
      cell: ({ row }) => {
        const timestamp = row.getValue("loadTimestamp") as string | undefined;
        try {
          return timestamp ? format(parseISO(timestamp), "MMM dd, yyyy HH:mm") : "N/A";
        } catch (e) {
          console.error("Error formatting loadTimestamp:", e, "Value:", timestamp);
          return "Invalid Date";
        }
      }
    },
    {
      accessorKey: "sourceFileName",
      header: ({ column }) => (
        <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
          Source File <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      ),
      cell: ({ row }) => {
        const fileName = row.getValue("sourceFileName") as string | undefined | null;
        return <span className="truncate block max-w-xs">{fileName || "N/A"}</span>;
      }
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
  ], [accounts, rowSelection, toast, fetchData]);


  if (isLoading) {
    return <div className="flex justify-center items-center h-64"><p>Loading data...</p></div>;
  }

  const numSelected = selectedTransactionIds.length;


  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start gap-2">
        <div className="flex flex-wrap gap-2">
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
          <Card className="p-2 border-dashed w-full sm:w-auto mt-2 sm:mt-0">
            <div className="flex flex-wrap gap-2 items-center">
              <span className="text-sm text-muted-foreground">{numSelected} selected</span>
              <Button variant="outline" size="sm" onClick={() => setIsBulkUpdateOpen(true)}>
                <Edit className="mr-2 h-4 w-4" /> Update Data
              </Button>
              <Button variant="destructive" size="sm" onClick={() => setTransactionToDeleteId('bulk')}>
                <Trash2 className="mr-2 h-4 w-4" /> Delete Selected
              </Button>
            </div>
          </Card>
        )}
      </div>

      <AddTransactionFormDialog
        isOpen={isAddTransactionOpen}
        onOpenChange={setIsAddTransactionOpen}
        onTransactionAdded={fetchData}
        accounts={accounts}
        categories={categories}
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
      <BulkTransactionUpdateDialog
        isOpen={isBulkUpdateOpen}
        onOpenChange={setIsBulkUpdateOpen}
        selectedTransactionIds={selectedTransactionIds}
        onUpdateComplete={fetchData}
        accounts={accounts}
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

      <CategoryManagerModal
        categories={categories}
        onAddCategory={handleAddCategory}
        onUpdateCategory={handleUpdateCategory}
        onDeleteCategory={handleDeleteCategory}
      />

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
