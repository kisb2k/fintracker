
"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardFooter, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import { mockBudgets, transactionCategories } from '@/lib/mock-data'; // mockTransactions removed
import type { Budget, Transaction } from '@/lib/types';
import { format, parseISO, isWithinInterval, startOfDay, endOfDay } from 'date-fns';
import { PlusCircle, Edit, Trash2, Target } from 'lucide-react';
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useToast } from "@/hooks/use-toast";
import { getTransactions } from '@/lib/actions'; // Import getTransactions

const budgetFormSchema = z.object({
  name: z.string().min(1, "Budget name is required"),
  category: z.string().min(1, "Category is required"),
  limit: z.coerce.number().positive("Limit must be a positive number"),
  startDate: z.string().refine((val) => isValid(parseISO(val)), { message: "Start date is required and must be valid"}),
  endDate: z.string().refine((val) => isValid(parseISO(val)), { message: "End date is required and must be valid"}),
}).refine(data => parseISO(data.endDate) >= parseISO(data.startDate), {
  message: "End date must be after or the same as start date",
  path: ["endDate"], // path of error
});

type BudgetFormData = z.infer<typeof budgetFormSchema>;

const BudgetForm: React.FC<{
  onSubmitBudget: (data: BudgetFormData, id?: string) => void;
  initialData?: Budget;
  onClose: () => void;
}> = ({ onSubmitBudget, initialData, onClose }) => {
  const form = useForm<BudgetFormData>({
    resolver: zodResolver(budgetFormSchema),
    defaultValues: initialData ? {
      name: initialData.name,
      category: initialData.category,
      limit: initialData.limit,
      startDate: format(parseISO(initialData.startDate), 'yyyy-MM-dd'),
      endDate: format(parseISO(initialData.endDate), 'yyyy-MM-dd'),
    } : {
      name: "",
      category: "",
      limit: 100,
      startDate: format(new Date(new Date().getFullYear(), new Date().getMonth(), 1), 'yyyy-MM-dd'),
      endDate: format(new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0), 'yyyy-MM-dd'),
    },
  });

  const handleSubmit = (data: BudgetFormData) => {
    onSubmitBudget(data, initialData?.id);
  };

  return (
    <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
      <div>
        <Label htmlFor="name">Budget Name</Label>
        <Input id="name" {...form.register("name")} placeholder="e.g., Monthly Groceries" />
        {form.formState.errors.name && <p className="text-sm text-destructive">{form.formState.errors.name.message}</p>}
      </div>
      <div>
        <Label htmlFor="category">Category</Label>
        <Select onValueChange={(value) => form.setValue("category", value)} defaultValue={form.getValues("category")}>
          <SelectTrigger id="category"><SelectValue placeholder="Select category" /></SelectTrigger>
          <SelectContent>
            {transactionCategories.filter(c => c !== "Income").map(cat => <SelectItem key={cat} value={cat}>{cat}</SelectItem>)}
          </SelectContent>
        </Select>
        {form.formState.errors.category && <p className="text-sm text-destructive">{form.formState.errors.category.message}</p>}
      </div>
      <div>
        <Label htmlFor="limit">Limit ($)</Label>
        <Input id="limit" type="number" step="0.01" {...form.register("limit")} placeholder="e.g., 400" />
        {form.formState.errors.limit && <p className="text-sm text-destructive">{form.formState.errors.limit.message}</p>}
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="startDate">Start Date</Label>
          <Input id="startDate" type="date" {...form.register("startDate")} />
          {form.formState.errors.startDate && <p className="text-sm text-destructive">{form.formState.errors.startDate.message}</p>}
        </div>
        <div>
          <Label htmlFor="endDate">End Date</Label>
          <Input id="endDate" type="date" {...form.register("endDate")} />
          {form.formState.errors.endDate && <p className="text-sm text-destructive">{form.formState.errors.endDate.message}</p>}
        </div>
      </div>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
        <Button type="submit">{initialData ? "Save Changes" : "Create Budget"}</Button>
      </DialogFooter>
    </form>
  );
};

export default function BudgetsPage() {
  const [budgets, setBudgets] = useState<Budget[]>(mockBudgets); // Budgets still from mock, not DB
  const [allTransactions, setAllTransactions] = useState<Transaction[]>([]);
  const [isLoadingTransactions, setIsLoadingTransactions] = useState(true);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingBudget, setEditingBudget] = useState<Budget | undefined>(undefined);
  const { toast } = useToast();

  const fetchDbTransactions = useCallback(async () => {
    setIsLoadingTransactions(true);
    const dbTransactions = await getTransactions();
    setAllTransactions(dbTransactions);
    setIsLoadingTransactions(false);
  }, []);

  useEffect(() => {
    fetchDbTransactions();
  }, [fetchDbTransactions]);

  const calculateSpentForBudget = useCallback((budget: Budget, transactions: Transaction[]): number => {
    return transactions
      .filter(t => 
        t.category === budget.category &&
        t.amount < 0 && // Only expenses count towards budget
        isWithinInterval(parseISO(t.date), { 
          start: startOfDay(parseISO(budget.startDate)), 
          end: endOfDay(parseISO(budget.endDate)) 
        })
      )
      .reduce((sum, t) => sum + Math.abs(t.amount), 0);
  }, []);

  useEffect(() => {
    // Recalculate spent amounts when transactions or budgets change
    if (!isLoadingTransactions) {
        const updatedBudgets = budgets.map(budget => ({
        ...budget,
        spent: calculateSpentForBudget(budget, allTransactions),
      }));
      // Only update if there's a change to avoid infinite loops if setBudgets causes re-render
      if (JSON.stringify(updatedBudgets) !== JSON.stringify(budgets)) {
        setBudgets(updatedBudgets);
      }
    }
  }, [allTransactions, budgets, isLoadingTransactions, calculateSpentForBudget]);


  const handleBudgetSubmit = (data: BudgetFormData, id?: string) => {
    const budgetStartDate = startOfDay(parseISO(data.startDate)).toISOString();
    const budgetEndDate = endOfDay(parseISO(data.endDate)).toISOString();

    if (id) { // Editing existing budget
      setBudgets(prev => prev.map(b => b.id === id ? { 
        ...b, 
        ...data, 
        limit: Number(data.limit),
        startDate: budgetStartDate,
        endDate: budgetEndDate,
        spent: calculateSpentForBudget({ ...b, ...data, startDate: budgetStartDate, endDate: budgetEndDate }, allTransactions)
       } : b));
      toast({ title: "Budget Updated", description: `${data.name} has been updated.`});
    } else { // Creating new budget
      const newBudgetBase: Omit<Budget, 'spent'> = {
        id: `bud_${Date.now()}`,
        ...data,
        limit: Number(data.limit),
        startDate: budgetStartDate,
        endDate: budgetEndDate,
      };
      const newBudget: Budget = {
        ...newBudgetBase,
        spent: calculateSpentForBudget(newBudgetBase, allTransactions),
      };
      setBudgets(prev => [newBudget, ...prev]);
      toast({ title: "Budget Created", description: `${data.name} has been created.`});
    }
    setIsFormOpen(false);
    setEditingBudget(undefined);
  };

  const handleEditBudget = (budget: Budget) => {
    setEditingBudget(budget);
    setIsFormOpen(true);
  };
  
  const handleDeleteBudget = (budgetId: string) => {
    setBudgets(prev => prev.filter(b => b.id !== budgetId));
    toast({ title: "Budget Deleted", description: "The budget has been removed.", variant: "destructive" });
  };

  if (isLoadingTransactions) {
    return <div className="flex justify-center items-center h-64"><p>Loading budget data...</p></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-semibold font-headline">My Budgets</h1>
        <Dialog open={isFormOpen} onOpenChange={(open) => {
          setIsFormOpen(open);
          if (!open) setEditingBudget(undefined);
        }}>
          <DialogTrigger asChild>
            <Button onClick={() => { setEditingBudget(undefined); setIsFormOpen(true); }}>
              <PlusCircle className="mr-2 h-4 w-4" /> Create New Budget
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingBudget ? "Edit Budget" : "Create New Budget"}</DialogTitle>
              <DialogDescription>
                {editingBudget ? "Update the details of your budget." : "Set up a new budget to track your spending."}
              </DialogDescription>
            </DialogHeader>
            <BudgetForm 
              onSubmitBudget={handleBudgetSubmit} 
              initialData={editingBudget}
              onClose={() => { setIsFormOpen(false); setEditingBudget(undefined);}}
            />
          </DialogContent>
        </Dialog>
      </div>

      {budgets.length === 0 ? (
        <Card className="text-center py-10">
          <CardContent className="flex flex-col items-center gap-4">
            <Target className="h-16 w-16 text-muted-foreground" />
            <p className="text-muted-foreground">No budgets created yet.</p>
            <Button onClick={() => { setEditingBudget(undefined); setIsFormOpen(true); }}>
                Create Your First Budget
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {budgets.map((budget) => {
            const progress = budget.limit > 0 ? (budget.spent / budget.limit) * 100 : 0;
            const remaining = budget.limit - budget.spent;
            const isOverBudget = budget.spent > budget.limit;
            
            let progressColor: string;
            if (isOverBudget) progressColor = 'hsl(var(--destructive))';
            else if (progress > 75) progressColor = 'hsl(var(--chart-4))'; // Using an orange-ish chart color for warning
            else progressColor = 'hsl(var(--primary))';


            return (
              <Card key={budget.id} className="flex flex-col">
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle>{budget.name}</CardTitle>
                      <CardDescription>{budget.category}</CardDescription>
                    </div>
                     <div className="flex gap-1">
                        <Button variant="ghost" size="icon" onClick={() => handleEditBudget(budget)}>
                          <Edit className="h-4 w-4" /> <span className="sr-only">Edit</span>
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDeleteBudget(budget.id)} className="text-destructive hover:text-destructive">
                           <Trash2 className="h-4 w-4" /> <span className="sr-only">Delete</span>
                        </Button>
                      </div>
                  </div>
                </CardHeader>
                <CardContent className="flex-grow">
                  <div className="mb-2">
                    <span className="text-2xl font-bold">${budget.spent.toFixed(2)}</span>
                    <span className="text-sm text-muted-foreground"> / ${budget.limit.toFixed(2)}</span>
                  </div>
                  <Progress 
                    value={Math.min(progress, 100)} 
                    className="h-3" 
                    style={{ '--progress-color': progressColor } as React.CSSProperties}
                  />
                   <style jsx global>{`
                    .h-3 > div[role="progressbar"] {
                      background-color: var(--progress-color) !important;
                    }
                  `}</style>


                  <p className={`mt-2 text-sm ${isOverBudget ? 'text-destructive' : 'text-muted-foreground'}`}>
                    {isOverBudget 
                      ? `$${Math.abs(remaining).toFixed(2)} over budget` 
                      : `$${remaining.toFixed(2)} remaining`}
                  </p>
                </CardContent>
                <CardFooter>
                  <p className="text-xs text-muted-foreground">
                    {format(parseISO(budget.startDate), 'MMM dd')} - {format(parseISO(budget.endDate), 'MMM dd, yyyy')}
                  </p>
                </CardFooter>
              </Card>
            );
          })}
        </div>
      )}
      <Card>
        <CardHeader><CardTitle>Note on Budget Data</CardTitle></CardHeader>
        <CardContent>
            <p className="text-sm text-muted-foreground">
                Budget definitions are currently managed in memory (using mock data as a base) and are not persisted in the database.
                However, the "spent" amounts for these budgets are calculated using transaction data fetched from the SQLite database.
            </p>
        </CardContent>
      </Card>
    </div>
  );
}

// Custom style for Progress component's indicator
const GlobalProgressStyle = () => (
  <style jsx global>{`
    .h-3 > div[role="progressbar"] {
      background-color: var(--progress-color) !important;
    }
  `}</style>
);

// This should be placed in your RootLayout or a global CSS file if not already handled by Tailwind.
// However, for ShadCN Progress, direct style manipulation on the Indicator is often needed if you want dynamic colors beyond primary.
// The provided Progress component's styling might make this tricky.
// The inline style with CSS variable is a common workaround.
// The provided `Progress` component from shadcn uses `bg-primary` for the indicator.
// To override it dynamically, we can pass a style prop with a CSS variable like above.
// And ensure that the `ProgressPrimitive.Indicator` in `progress.tsx` can accept this.
// It seems the current `Progress` component in `components/ui/progress.tsx` is:
// <ProgressPrimitive.Indicator
// className="h-full w-full flex-1 bg-primary transition-all"
// style={{ transform: `translateX(-${100 - (value || 0)}%)` }}
// />
// To make the color dynamic via CSS variable, we'd ideally change `bg-primary` to something like `bg-[var(--progress-color)]`
// and ensure `--progress-color` is defined.
// For now, the inline style approach combined with a <style jsx global> tag as shown above is a workaround.
// A cleaner solution would be to modify the Progress component itself to accept a color prop or use a CSS variable for its background.
// Given the constraints, the `style={{ '--progress-color': progressColor } as React.CSSProperties}` on the Progress component
// and the `<style jsx global>` should work.

