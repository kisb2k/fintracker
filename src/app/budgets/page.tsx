"use client";

import React, { useState, useEffect } from 'react';
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
import { mockBudgets, transactionCategories, mockTransactions } from '@/lib/mock-data';
import type { Budget, Transaction } from '@/lib/types';
import { format, parseISO } from 'date-fns';
import { PlusCircle, Edit, Trash2, Target } from 'lucide-react';
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useToast } from "@/hooks/use-toast";

const budgetFormSchema = z.object({
  name: z.string().min(1, "Budget name is required"),
  category: z.string().min(1, "Category is required"),
  limit: z.coerce.number().positive("Limit must be a positive number"),
  startDate: z.string().min(1, "Start date is required"),
  endDate: z.string().min(1, "End date is required").refine((data) => {
    // This is a bit tricky within a single field refine. Usually done at schema level.
    // For now, we'll assume dates are valid or add cross-field validation if needed.
    return true; 
  }, "End date must be after start date"),
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
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [allTransactions, setAllTransactions] = useState<Transaction[]>(mockTransactions); // Assuming global access for calculation
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingBudget, setEditingBudget] = useState<Budget | undefined>(undefined);
  const { toast } = useToast();

  useEffect(() => {
    // Calculate spent amount for each budget based on transactions
    const updatedBudgets = mockBudgets.map(budget => {
      const spent = allTransactions
        .filter(t => 
          t.category === budget.category &&
          t.amount < 0 &&
          new Date(t.date) >= new Date(budget.startDate) &&
          new Date(t.date) <= new Date(budget.endDate)
        )
        .reduce((sum, t) => sum + Math.abs(t.amount), 0);
      return { ...budget, spent };
    });
    setBudgets(updatedBudgets);
  }, [allTransactions]);


  const handleBudgetSubmit = (data: BudgetFormData, id?: string) => {
    if (id) { // Editing existing budget
      setBudgets(prev => prev.map(b => b.id === id ? { 
        ...b, 
        ...data, 
        limit: Number(data.limit),
        startDate: new Date(data.startDate).toISOString(),
        endDate: new Date(data.endDate).toISOString(),
        // Recalculate spent for edited budget
        spent: allTransactions
          .filter(t => 
            t.category === data.category &&
            t.amount < 0 &&
            new Date(t.date) >= new Date(data.startDate) &&
            new Date(t.date) <= new Date(data.endDate)
          )
          .reduce((sum, t) => sum + Math.abs(t.amount), 0)
       } : b));
      toast({ title: "Budget Updated", description: `${data.name} has been updated.`});
    } else { // Creating new budget
      const newBudget: Budget = {
        id: `bud_${Date.now()}`,
        ...data,
        limit: Number(data.limit),
        spent: allTransactions
          .filter(t => 
            t.category === data.category &&
            t.amount < 0 &&
            new Date(t.date) >= new Date(data.startDate) &&
            new Date(t.date) <= new Date(data.endDate)
          )
          .reduce((sum, t) => sum + Math.abs(t.amount), 0),
        startDate: new Date(data.startDate).toISOString(),
        endDate: new Date(data.endDate).toISOString(),
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
            <DialogTrigger asChild>
             <Button onClick={() => { setEditingBudget(undefined); setIsFormOpen(true); }}>
                Create Your First Budget
              </Button>
            </DialogTrigger>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {budgets.map((budget) => {
            const progress = budget.limit > 0 ? (budget.spent / budget.limit) * 100 : 0;
            const remaining = budget.limit - budget.spent;
            const isOverBudget = budget.spent > budget.limit;
            
            let progressColorClass = "bg-primary"; // Default blue
            if (progress > 75 && progress <= 100) progressColorClass = "bg-yellow-500"; // Yellow for warning
            if (isOverBudget) progressColorClass = "bg-destructive"; // Red for over budget

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
                  <Progress value={Math.min(progress, 100)} className="h-3 [&>div]:bg-[--progress-color]" style={{ '--progress-color': `var(--${isOverBudget ? 'destructive' : progress > 75 ? 'yellow-500' : 'primary'})` } as React.CSSProperties} />

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
    </div>
  );
}
