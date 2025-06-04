"use client";

import React, { useState, useEffect, useMemo } from 'react';
import type { ColumnDef } from "@tanstack/react-table";
import { ArrowUpDown, Eye, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { DataTable } from "@/components/ui/data-table";
import { mockTransactions, transactionCategories as allCategories, mockAccounts } from "@/lib/mock-data";
import type { Transaction, CategorizedTransaction, TaxDeductionInfo } from "@/lib/types";
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
import { format, parseISO } from 'date-fns';
import { categorizeTransaction } from '@/ai/flows/categorize-transaction.ts';
import { identifyTaxDeductions } from '@/ai/flows/identify-tax-deductions.ts';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from '@/components/ui/badge';
import { useToast } from "@/hooks/use-toast";


const transactionFormSchema = z.object({
  description: z.string().min(1, "Description is required"),
  amount: z.coerce.number().refine(val => val !== 0, "Amount cannot be zero"),
  date: z.string().min(1, "Date is required"),
  category: z.string().min(1, "Category is required"),
  accountId: z.string().min(1, "Account is required"),
  type: z.enum(["income", "expense"]),
});

type TransactionFormData = z.infer<typeof transactionFormSchema>;

const AddTransactionForm: React.FC<{ onAddTransaction: (newTx: Transaction) => void }> = ({ onAddTransaction }) => {
  const { toast } = useToast();
  const form = useForm<TransactionFormData>({
    resolver: zodResolver(transactionFormSchema),
    defaultValues: {
      description: "",
      amount: 0,
      date: format(new Date(), 'yyyy-MM-dd'),
      category: "",
      accountId: "",
      type: "expense",
    },
  });

  const onSubmit = (data: TransactionFormData) => {
    const newTransaction: Transaction = {
      id: `txn_${Date.now()}`,
      accountId: data.accountId,
      date: new Date(data.date).toISOString(),
      description: data.description,
      amount: data.type === 'expense' ? -Math.abs(data.amount) : Math.abs(data.amount),
      category: data.category,
      status: 'posted',
    };
    onAddTransaction(newTransaction);
    toast({ title: "Transaction Added", description: `${data.description} successfully added.` });
    form.reset();
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
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl><SelectTrigger><SelectValue placeholder="Select account" /></SelectTrigger></FormControl>
                      <SelectContent>
                        {mockAccounts.map(acc => <SelectItem key={acc.id} value={acc.id}>{acc.name} ({acc.bankName})</SelectItem>)}
                      </SelectContent>
                    </Select>
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
    try {
      const result = await categorizeTransaction({ transactionDescription: transaction.description });
      setCategoryResult({
        originalDescription: transaction.description,
        suggestedCategory: result.category,
        confidence: result.confidence,
      });
    } catch (e) {
      setError("Failed to categorize transaction.");
    }
    setIsLoadingCategory(false);
  };

  const handleTaxDeduction = async () => {
    setIsLoadingTax(true);
    setError(null);
    try {
      const result = await identifyTaxDeductions({ transactionData: JSON.stringify([transaction]) });
      // Assuming the AI returns JSON string that needs parsing.
      // And the output is an array, we take the first if it exists.
      const deductions = JSON.parse(result.taxDeductions);
      setTaxResult(deductions.length > 0 ? deductions : null);

    } catch (e) {
      console.error("Tax deduction error:", e);
      setError("Failed to identify tax deductions.");
      setTaxResult(null); // Explicitly set to null on error or no deductions
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
                <p><strong>Reason:</strong> {taxResult[0].reason || 'AI analysis suggests this might be deductible.'}</p>
              </AlertDescription>
            </Alert>
          )}
          {taxResult === null && !isLoadingTax && !error && (
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


export default function TransactionsPage() {
  const [transactions, setTransactions] = useState<Transaction[]>(mockTransactions);
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);

  const handleAddTransaction = (newTx: Transaction) => {
    setTransactions(prev => [newTx, ...prev]);
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
      cell: ({ row }) => format(parseISO(row.getValue("date")), "MMM dd, yyyy"),
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
        const account = mockAccounts.find(acc => acc.id === row.getValue("accountId"));
        return account ? account.name : "Unknown";
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
  ], []);


  return (
    <Dialog onOpenChange={(isOpen) => { if (!isOpen) setSelectedTransaction(null); }}>
      <div className="space-y-6">
        <AddTransactionForm onAddTransaction={handleAddTransaction} />
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
          </CardContent>
        </Card>
        {selectedTransaction && <TransactionInsights transaction={selectedTransaction} />}
      </div>
    </Dialog>
  );
}
