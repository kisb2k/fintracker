
"use client";

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardFooter, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
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
  DialogClose
} from "@/components/ui/dialog";
// Default categories are no longer the primary source for budget form
// import { transactionCategories as defaultCategories } from '@/lib/mock-data';
import type { Budget, Transaction, BudgetRecurrenceFrequency, BudgetCategoryLimit, BudgetUpsertData } from '@/lib/types';
import { 
  format, parseISO, isValid, formatISO,
  startOfDay, endOfDay, isWithinInterval,
  addWeeks, addMonths, addYears, addDays, subMonths, subYears, subWeeks,
  startOfWeek, endOfWeek,
  startOfMonth, endOfMonth,
  startOfQuarter, endOfQuarter,
  startOfYear, endOfYear,
  isBefore, isAfter,
} from 'date-fns';
import { PlusCircle, Edit, Trash2, Target, ListFilter, CalendarDays, X } from 'lucide-react'; // GripVertical removed
import { useForm, Controller, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useToast } from "@/hooks/use-toast";
import { getTransactions, addBudget, getBudgets, updateBudget, deleteBudget as deleteBudgetAction } from '@/lib/actions';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle as RAlertDialogTitle,
} from "@/components/ui/alert-dialog";


const recurrenceFrequencies: BudgetRecurrenceFrequency[] = ['weekly', 'biweekly', 'monthly', 'quarterly', 'annually'];

const budgetCategoryLimitSchema = z.object({
  category: z.string().min(1, "Category name is required"),
  amountLimit: z.coerce.number().positive("Limit must be a positive number"),
});

const budgetFormSchema = z.object({
  name: z.string().min(1, "Budget name is required"),
  categoriesAndLimits: z.array(budgetCategoryLimitSchema).min(1, "At least one category with a limit is required"),
  isRecurring: z.boolean().optional(),
  recurrenceFrequency: z.string().nullable().optional(),
  formStartDate: z.string().refine((val) => isValid(parseISO(val)), { message: "Start date is required and must be valid" }),
  formEndDate: z.string().refine((val) => isValid(parseISO(val)), { message: "End date is required and must be valid" }),
}).refine(data => {
  if (data.isRecurring && !data.recurrenceFrequency) {
    return false;
  }
  return true;
}, {
  message: "Recurrence frequency is required for recurring budgets.",
  path: ["recurrenceFrequency"],
}).refine(data => parseISO(data.formEndDate) >= parseISO(data.formStartDate), {
  message: "End date must be after or the same as start date for the initial period or non-recurring budget.",
  path: ["formEndDate"],
});

type BudgetFormData = BudgetUpsertData;


interface BudgetFormProps {
  onSubmitBudget: (data: BudgetFormData, id?: string) => Promise<void>;
  initialData?: Budget;
  onClose: () => void;
  availableCategories: string[];
  // openAddCategoryDialog prop removed
}

const BudgetForm: React.FC<BudgetFormProps> = ({ onSubmitBudget, initialData, onClose, availableCategories }) => {
  const form = useForm<BudgetFormData>({
    resolver: zodResolver(budgetFormSchema),
    defaultValues: initialData ? {
      name: initialData.name,
      categoriesAndLimits: initialData.categories.map(c => ({ category: c.category, amountLimit: c.amountLimit })),
      isRecurring: initialData.isRecurring || false,
      recurrenceFrequency: initialData.recurrenceFrequency || null,
      formStartDate: format(parseISO(initialData.originalStartDate || initialData.startDate), 'yyyy-MM-dd'),
      formEndDate: format(parseISO(initialData.endDate), 'yyyy-MM-dd'),
    } : {
      name: "",
      categoriesAndLimits: [],
      isRecurring: false,
      recurrenceFrequency: null,
      formStartDate: format(startOfMonth(new Date()), 'yyyy-MM-dd'),
      formEndDate: format(endOfMonth(new Date()), 'yyyy-MM-dd'),
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "categoriesAndLimits",
  });

  const [selectedCategoryForNewLimit, setSelectedCategoryForNewLimit] = useState("");

  const handleAddCategoryToBudget = () => {
    if (selectedCategoryForNewLimit && !fields.find(f => f.category === selectedCategoryForNewLimit)) {
      append({ category: selectedCategoryForNewLimit, amountLimit: 100 });
      setSelectedCategoryForNewLimit("");
    }
  };
  
  const isRecurring = form.watch("isRecurring");

  const handleSubmit = async (data: BudgetFormData) => {
    await onSubmitBudget(data, initialData?.id);
  };

  return (
    <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
      <div className="space-y-1">
        <Label htmlFor="name-bf">Budget Name</Label>
        <Input id="name-bf" placeholder="e.g., Monthly Groceries" {...form.register("name")} />
        {form.formState.errors.name && <p className="text-sm text-destructive">{form.formState.errors.name.message}</p>}
      </div>
      
      <div>
        <Label>Categories & Limits</Label>
        <div className="flex gap-2 my-2">
          <Select onValueChange={setSelectedCategoryForNewLimit} value={selectedCategoryForNewLimit}>
            <SelectTrigger className="flex-grow"><SelectValue placeholder="Select category to add..." /></SelectTrigger>
            <SelectContent>
              {availableCategories
                .filter(cat => cat.toLowerCase() !== "income" && !fields.some(f => f.category === cat))
                .map(cat => <SelectItem key={cat} value={cat}>{cat}</SelectItem>)}
                {availableCategories.length === 0 && <SelectItem value="no-cats" disabled>No categories found in transactions</SelectItem>}
            </SelectContent>
          </Select>
          <Button type="button" onClick={handleAddCategoryToBudget} variant="outline" size="sm" disabled={availableCategories.length === 0}>Add</Button>
           {/* "New Category?" link removed */}
        </div>
        <ScrollArea className="h-40 w-full rounded-md border p-2 space-y-2">
          {fields.map((fieldItem, index) => (
            <div key={fieldItem.id} className="flex items-center gap-2 p-1 border rounded">
              <span className="font-medium text-sm flex-1">{fieldItem.category}</span>
              <Controller
                control={form.control}
                name={`categoriesAndLimits.${index}.amountLimit`}
                render={({ field }) => (
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="Limit"
                    className="w-24 h-8 text-sm"
                    name={field.name}
                    onBlur={field.onBlur}
                    ref={field.ref}
                    value={(typeof field.value === 'number' && isNaN(field.value)) || field.value === undefined ? '' : field.value}
                    onChange={e => {
                      const stringValue = e.target.value;
                      if (stringValue === '') {
                        field.onChange(undefined);
                      } else {
                        const numValue = parseFloat(stringValue);
                        field.onChange(isNaN(numValue) ? undefined : numValue);
                      }
                    }}
                  />
                )}
              />
              <Button type="button" variant="ghost" size="icon" onClick={() => remove(index)} className="h-7 w-7">
                <X className="h-4 w-4 text-destructive"/>
              </Button>
            </div>
          ))}
          {fields.length === 0 && <p className="text-xs text-muted-foreground text-center py-2">No categories added to this budget yet.</p>}
        </ScrollArea>
        {form.formState.errors.categoriesAndLimits && <p className="text-sm text-destructive">{form.formState.errors.categoriesAndLimits.message || form.formState.errors.categoriesAndLimits.root?.message}</p>}
         {form.formState.errors.categoriesAndLimits?.map((_, index) =>
            form.formState.errors.categoriesAndLimits?.[index]?.amountLimit && (
                <p key={`limit-error-${index}`} className="text-sm text-destructive mt-1">
                    Category "{form.getValues(`categoriesAndLimits.${index}.category`)}": {form.formState.errors.categoriesAndLimits?.[index]?.amountLimit?.message}
                </p>
            )
        )}
      </div>

      <Controller
        control={form.control}
        name="isRecurring"
        render={({ field }) => (
          <div className="flex items-center space-x-2">
            <Checkbox id="isRecurring-bf" checked={field.value} onCheckedChange={field.onChange} />
            <Label htmlFor="isRecurring-bf">Is this a recurring budget?</Label>
          </div>
        )}
      />

      {isRecurring && (
        <div className="space-y-1">
          <Label htmlFor="recurrenceFrequency-bf">Recurrence Frequency</Label>
           <Controller
            control={form.control}
            name="recurrenceFrequency"
            render={({ field }) => (
                <Select onValueChange={field.onChange} value={field.value || undefined} defaultValue={field.value || undefined}>
                    <SelectTrigger id="recurrenceFrequency-bf"><SelectValue placeholder="Select frequency" /></SelectTrigger>
                    <SelectContent>
                    {recurrenceFrequencies.map(freq => <SelectItem key={freq} value={freq} className="capitalize">{freq}</SelectItem>)}
                    </SelectContent>
                </Select>
            )}
            />
          {form.formState.errors.recurrenceFrequency && <p className="text-sm text-destructive">{form.formState.errors.recurrenceFrequency.message}</p>}
        </div>
      )}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1">
          <Label htmlFor="formStartDate-bf">{isRecurring ? "Series Start Date" : "Start Date"}</Label>
          <Input id="formStartDate-bf" type="date" {...form.register("formStartDate")} />
          {form.formState.errors.formStartDate && <p className="text-sm text-destructive">{form.formState.errors.formStartDate.message}</p>}
        </div>
        <div className="space-y-1">
          <Label htmlFor="formEndDate-bf">{isRecurring ? "End of First Period" : "End Date"}</Label>
          <Input id="formEndDate-bf" type="date" {...form.register("formEndDate")} />
          {form.formState.errors.formEndDate && <p className="text-sm text-destructive">{form.formState.errors.formEndDate.message}</p>}
        </div>
      </div>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
        <Button type="submit">{initialData ? "Save Changes" : "Create Budget"}</Button>
      </DialogFooter>
    </form>
  );
};

// AddCategoryDialog removed as it's no longer used.

export default function BudgetsPage() {
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [allTransactions, setAllTransactions] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingBudget, setEditingBudget] = useState<Budget | undefined>(undefined);
  const { toast } = useToast();

  // customCategories state and isAddCategoryDialogOpen state removed
  const [deletingBudgetId, setDeletingBudgetId] = useState<string | null>(null);

  const [selectedBudgetId, setSelectedBudgetId] = useState<string | null>(null);
  const [currentBudgetPeriods, setCurrentBudgetPeriods] = useState<Array<{ name: string; startDate: string; endDate: string }>>([]);
  
  const [viewedPeriodDetails, setViewedPeriodDetails] = useState<{
    budget: Budget;
    periodStartDate: string;
    periodEndDate: string;
    categorySpending: Record<string, { spent: number; limit: number }>;
    totalSpent: number;
    overallLimit: number;
  } | null>(null);

  const availableCategories = useMemo(() => {
    if (allTransactions.length === 0) return [];
    const uniqueCategories = [...new Set(allTransactions.map(t => t.category).filter(Boolean))]; // Filter out undefined/null categories
    return uniqueCategories.sort((a,b) => a.localeCompare(b));
  }, [allTransactions]);


  const fetchBudgetData = useCallback(async () => {
    setIsLoading(true);
    const [dbBudgets, dbTransactions] = await Promise.all([
        getBudgets(),
        getTransactions()
    ]);
    setBudgets(dbBudgets);
    setAllTransactions(dbTransactions);
    setIsLoading(false);
  }, []);

  useEffect(() => {
    fetchBudgetData();
  }, [fetchBudgetData]);

  const calculateSpentForPeriod = useCallback((
    budgetCategoriesWithLimits: BudgetCategoryLimit[],
    periodStartDateStr: string,
    periodEndDateStr: string,
    transactions: Transaction[]
  ): { categorySpending: Record<string, { spent: number; limit: number }>, totalSpent: number, overallLimit: number } => {
    
    const categorySpending: Record<string, { spent: number; limit: number }> = {};
    let totalSpent = 0;
    let overallLimit = 0;

    const periodStart = startOfDay(parseISO(periodStartDateStr));
    const periodEnd = endOfDay(parseISO(periodEndDateStr));

    budgetCategoriesWithLimits.forEach(catLimit => {
      categorySpending[catLimit.category] = { spent: 0, limit: catLimit.amountLimit };
      overallLimit += catLimit.amountLimit;
    });

    transactions
      .filter(t =>
        budgetCategoriesWithLimits.some(cl => cl.category === t.category) &&
        t.amount < 0 &&
        isValid(parseISO(t.date)) &&
        isWithinInterval(parseISO(t.date), { start: periodStart, end: periodEnd })
      )
      .forEach(t => {
        const absAmount = Math.abs(t.amount);
        totalSpent += absAmount;
        if (categorySpending[t.category]) {
            categorySpending[t.category].spent += absAmount;
        }
      });
    return { categorySpending, totalSpent, overallLimit };
  }, []);
  
  const getPeriodBoundaries = useCallback((startDate: Date, freq: BudgetRecurrenceFrequency): { periodStart: Date; periodEnd: Date; periodName: string } => {
    let periodStart: Date, periodEnd: Date, periodName: string;
    let nameFmt: string;

    switch (freq) {
        case 'weekly':
            periodStart = startOfWeek(startDate, { weekStartsOn: 1 });
            periodEnd = endOfWeek(startDate, { weekStartsOn: 1 });
            nameFmt = "'Week of' MMM dd, yyyy ('W'ww)";
            break;
        case 'biweekly':
            periodStart = startDate;
            periodEnd = endOfDay(addDays(addWeeks(startDate, 2), -1));
            nameFmt = "'Bi-Week' MMM dd, yyyy";
            break;
        case 'monthly':
            periodStart = startOfMonth(startDate);
            periodEnd = endOfMonth(startDate);
            nameFmt = "MMMM yyyy";
            break;
        case 'quarterly':
            periodStart = startOfQuarter(startDate);
            periodEnd = endOfQuarter(startDate);
            nameFmt = "QQQ yyyy";
            break;
        case 'annually':
            periodStart = startOfYear(startDate);
            periodEnd = endOfYear(startDate);
            nameFmt = "yyyy";
            break;
        default:
            periodStart = startOfMonth(startDate);
            periodEnd = endOfMonth(startDate);
            nameFmt = "MMMM yyyy";
    }
    periodName = format(periodStart, nameFmt);
    return { periodStart: startOfDay(periodStart), periodEnd: endOfDay(periodEnd), periodName };
  }, []);


  const generateBudgetPeriods = useCallback((budget: Budget | undefined, numPast = 6, numFuture = 6): Array<{ name: string; startDate: string; endDate: string }> => {
    if (!budget) return [];

    const periods: Array<{ name: string; startDate: string; endDate: string }> = [];
    const today = new Date();
    
    if (!budget.isRecurring || !budget.originalStartDate) {
        if (budget.originalStartDate && budget.endDate) {
             const { periodName } = getPeriodBoundaries(parseISO(budget.originalStartDate), budget.recurrenceFrequency || 'monthly');
             return [{ name: periodName, startDate: budget.originalStartDate, endDate: budget.endDate }];
        }
        return [];
    }

    const originalStartDateParsed = parseISO(budget.originalStartDate);
    if(!isValid(originalStartDateParsed) || !budget.recurrenceFrequency) return [];

    let currentSeedDate = originalStartDateParsed;
    while(isValid(currentSeedDate) && isBefore(getPeriodBoundaries(currentSeedDate, budget.recurrenceFrequency).periodEnd, today)) {
        switch (budget.recurrenceFrequency) {
            case 'weekly': currentSeedDate = addWeeks(currentSeedDate, 1); break;
            case 'biweekly': currentSeedDate = addWeeks(currentSeedDate, 2); break;
            case 'monthly': currentSeedDate = addMonths(currentSeedDate, 1); break;
            case 'quarterly': currentSeedDate = addMonths(currentSeedDate, 3); break;
            case 'annually': currentSeedDate = addYears(currentSeedDate, 1); break;
        }
        if (isAfter(currentSeedDate, addYears(today, 10))) break;
    }


    let tempDateForPast = currentSeedDate;
    for (let i = 0; i < numPast; i++) {
        const { periodStart, periodEnd, periodName } = getPeriodBoundaries(tempDateForPast, budget.recurrenceFrequency);
        if (isAfter(periodStart, originalStartDateParsed) || periodStart.getTime() === originalStartDateParsed.getTime()) {
             periods.unshift({ name: periodName, startDate: formatISO(periodStart), endDate: formatISO(periodEnd) });
        } else if (i === 0 && periodStart.getTime() < originalStartDateParsed.getTime() && periodEnd.getTime() >= originalStartDateParsed.getTime()) {
            periods.unshift({ name: periodName, startDate: formatISO(originalStartDateParsed), endDate: formatISO(periodEnd) });
        }


        let prevTempDate: Date;
         switch (budget.recurrenceFrequency) {
            case 'weekly': prevTempDate = subWeeks(tempDateForPast, 1); break;
            case 'biweekly': prevTempDate = subWeeks(tempDateForPast, 2); break;
            case 'monthly': prevTempDate = subMonths(tempDateForPast, 1); break;
            case 'quarterly': prevTempDate = subMonths(tempDateForPast, 3); break;
            case 'annually': prevTempDate = subYears(tempDateForPast, 1); break;
            default: prevTempDate = tempDateForPast;
        }
        if (isBefore(prevTempDate, originalStartDateParsed) && getPeriodBoundaries(prevTempDate, budget.recurrenceFrequency).periodEnd < originalStartDateParsed) break;
        if (prevTempDate.getTime() === tempDateForPast.getTime() && tempDateForPast.getTime() !== originalStartDateParsed.getTime()) break;
        tempDateForPast = prevTempDate;
         if (isBefore(tempDateForPast, subYears(today, 10))) break;
    }
    
    const currentSeedPeriodDetails = getPeriodBoundaries(currentSeedDate, budget.recurrenceFrequency);
    if (!periods.find(p => p.startDate === formatISO(currentSeedPeriodDetails.periodStart))) {
        const insertIndex = periods.findIndex(p => parseISO(p.startDate) > currentSeedPeriodDetails.periodStart);
        const periodToAdd = { name: currentSeedPeriodDetails.periodName, startDate: formatISO(currentSeedPeriodDetails.periodStart), endDate: formatISO(currentSeedPeriodDetails.periodEnd) };
        if (insertIndex === -1) periods.push(periodToAdd);
        else periods.splice(insertIndex, 0, periodToAdd);
    }

    let tempDateForFuture = currentSeedDate;
    if (isBefore(getPeriodBoundaries(tempDateForFuture, budget.recurrenceFrequency).periodEnd, today)) {
         switch (budget.recurrenceFrequency) {
            case 'weekly': tempDateForFuture = addWeeks(tempDateForFuture, 1); break;
            case 'biweekly': tempDateForFuture = addWeeks(tempDateForFuture, 2); break;
            case 'monthly': tempDateForFuture = addMonths(tempDateForFuture, 1); break;
            case 'quarterly': tempDateForFuture = addMonths(tempDateForFuture, 3); break;
            case 'annually': tempDateForFuture = addYears(tempDateForFuture, 1); break;
        }
    }


    for (let i = 0; i < numFuture; i++) {
        if (i > 0 || formatISO(getPeriodBoundaries(tempDateForFuture, budget.recurrenceFrequency).periodStart) !== currentSeedPeriodDetails.startDate) {
            const { periodStart, periodEnd, periodName } = getPeriodBoundaries(tempDateForFuture, budget.recurrenceFrequency);
             if (!periods.find(p => p.startDate === formatISO(periodStart))) {
                periods.push({ name: periodName, startDate: formatISO(periodStart), endDate: formatISO(periodEnd) });
            }
        }
        
        let nextTempDate: Date;
         switch (budget.recurrenceFrequency) {
            case 'weekly': nextTempDate = addWeeks(tempDateForFuture, 1); break;
            case 'biweekly': nextTempDate = addWeeks(tempDateForFuture, 2); break;
            case 'monthly': nextTempDate = addMonths(tempDateForFuture, 1); break;
            case 'quarterly': nextTempDate = addMonths(tempDateForFuture, 3); break;
            case 'annually': nextTempDate = addYears(tempDateForFuture, 1); break;
            default: nextTempDate = tempDateForFuture;
        }
        if (nextTempDate.getTime() === tempDateForFuture.getTime()) break;
        tempDateForFuture = nextTempDate;
         if (isAfter(tempDateForFuture, addYears(today, 10))) break;
    }
    
    const uniquePeriodsMap = new Map<string, { name: string; startDate: string; endDate: string }>();
    periods.forEach(p => { if(isValid(parseISO(p.startDate))) uniquePeriodsMap.set(p.startDate, p);});
    
    return Array.from(uniquePeriodsMap.values())
      .sort((a,b) => parseISO(a.startDate).getTime() - parseISO(b.startDate).getTime());

  }, [getPeriodBoundaries]);

  useEffect(() => {
    if (selectedBudgetId) {
      const budget = budgets.find(b => b.id === selectedBudgetId);
      if (budget) {
        const periods = generateBudgetPeriods(budget);
        setCurrentBudgetPeriods(periods);
        
        const todayInstance = new Date();
        let periodToView = periods.find(p => isValid(parseISO(p.startDate)) && isValid(parseISO(p.endDate)) && isWithinInterval(todayInstance, {start: parseISO(p.startDate), end: parseISO(p.endDate)}));
        
        if (!periodToView && periods.length > 0) {
            const pastOrCurrentPeriods = periods.filter(p => isValid(parseISO(p.startDate)) && parseISO(p.startDate) <= todayInstance);
            if(pastOrCurrentPeriods.length > 0){
                periodToView = pastOrCurrentPeriods[pastOrCurrentPeriods.length -1];
            } else {
                periodToView = periods[0];
            }
        }

        if (periodToView && budget && budget.categories) {
          const { categorySpending, totalSpent, overallLimit } = calculateSpentForPeriod(budget.categories, periodToView.startDate, periodToView.endDate, allTransactions);
          setViewedPeriodDetails({
            budget,
            periodStartDate: periodToView.startDate,
            periodEndDate: periodToView.endDate,
            categorySpending,
            totalSpent,
            overallLimit
          });
        } else {
          setViewedPeriodDetails(null);
        }
      } else {
        setCurrentBudgetPeriods([]);
        setViewedPeriodDetails(null);
      }
    } else {
      setCurrentBudgetPeriods([]);
      setViewedPeriodDetails(null);
    }
  }, [selectedBudgetId, budgets, allTransactions, calculateSpentForPeriod, generateBudgetPeriods]);


  const handleBudgetSubmit = async (data: BudgetFormData, id?: string) => {
    if (id) {
      const result = await updateBudget(id, data);
      if (result.budget) {
        toast({ title: "Budget Updated", description: `${result.budget.name} has been updated.`});
        fetchBudgetData();
      } else {
        toast({ title: "Error", description: result.error || "Failed to update budget.", variant: "destructive" });
      }
    } else {
      const result = await addBudget(data);
       if (result.budget) {
        toast({ title: "Budget Created", description: `${result.budget.name} has been created.`});
        fetchBudgetData();
        setSelectedBudgetId(result.budget.id);
      } else {
        toast({ title: "Error", description: result.error || "Failed to create budget.", variant: "destructive" });
      }
    }
    setIsFormOpen(false);
    setEditingBudget(undefined);
  };

  const handleEditBudget = (budgetToEdit: Budget) => {
    setEditingBudget(budgetToEdit);
    setIsFormOpen(true);
  };
  
  const handleDeleteBudgetConfirm = async () => {
    if (!deletingBudgetId) return;
    const result = await deleteBudgetAction(deletingBudgetId);
    if (result.success) {
        toast({ title: "Budget Deleted", description: "The budget has been removed." });
        fetchBudgetData();
        if (selectedBudgetId === deletingBudgetId) {
            setSelectedBudgetId(null);
        }
    } else {
        toast({ title: "Error Deleting Budget", description: result.error || "Could not delete the budget.", variant: "destructive" });
    }
    setDeletingBudgetId(null);
  };


  // handleAddCategory function removed as categories are now transaction-driven

  const handlePeriodSelect = (periodStartDate: string, periodEndDate: string) => {
    if (!selectedBudgetId) return;
    const budget = budgets.find(b => b.id === selectedBudgetId);
    if (budget && budget.categories) {
      const { categorySpending, totalSpent, overallLimit } = calculateSpentForPeriod(budget.categories, periodStartDate, periodEndDate, allTransactions);
      setViewedPeriodDetails({
        budget,
        periodStartDate,
        periodEndDate,
        categorySpending,
        totalSpent,
        overallLimit,
      });
    }
  };


  if (isLoading) {
    return <div className="flex justify-center items-center h-64"><p>Loading budget data...</p></div>;
  }

  const overallProgress = viewedPeriodDetails && viewedPeriodDetails.overallLimit > 0
    ? Math.min((viewedPeriodDetails.totalSpent / viewedPeriodDetails.overallLimit) * 100, 100)
    : 0;
  const overallRemaining = viewedPeriodDetails ? viewedPeriodDetails.overallLimit - viewedPeriodDetails.totalSpent : 0;
  const isOverBudgetOverall = viewedPeriodDetails ? viewedPeriodDetails.totalSpent > viewedPeriodDetails.overallLimit : false;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap justify-between items-center gap-4">
        <div className="flex gap-2">
            <Dialog open={isFormOpen} onOpenChange={(open) => {
              setIsFormOpen(open);
              if (!open) setEditingBudget(undefined);
            }}>
              <DialogTrigger asChild>
                <Button onClick={() => { setEditingBudget(undefined); setIsFormOpen(true); }}>
                  <PlusCircle className="mr-2 h-4 w-4" /> Create New Budget
                </Button>
              </DialogTrigger>
              <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
                <DialogHeader>
                  <DialogTitle>{editingBudget ? "Edit Budget" : "Create New Budget"}</DialogTitle>
                </DialogHeader>
                <BudgetForm
                  onSubmitBudget={handleBudgetSubmit}
                  initialData={editingBudget}
                  onClose={() => { setIsFormOpen(false); setEditingBudget(undefined);}}
                  availableCategories={availableCategories}
                  // openAddCategoryDialog prop removed
                />
              </DialogContent>
            </Dialog>
            {/* "Add New Category" button removed from top bar */}
        </div>
        <div className="min-w-[250px]">
            <Select onValueChange={setSelectedBudgetId} value={selectedBudgetId || ""}>
                <SelectTrigger><SelectValue placeholder="Choose a budget to view..." /></SelectTrigger>
                <SelectContent>
                    {budgets.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
                    {budgets.length === 0 && <SelectItem value="no-budgets" disabled>No budgets found in DB</SelectItem>}
                </SelectContent>
            </Select>
        </div>
      </div>

      {/* AddCategoryDialog component usage removed */}
       <AlertDialog open={!!deletingBudgetId} onOpenChange={(open) => !open && setDeletingBudgetId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <RAlertDialogTitle>Are you sure?</RAlertDialogTitle>
            <AlertDialogDescription>
              This action will permanently delete this budget and all its category limits. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDeletingBudgetId(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteBudgetConfirm} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Yes, Delete Budget
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>


      {selectedBudgetId && currentBudgetPeriods.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><ListFilter className="h-5 w-5"/> Budget Periods for: {budgets.find(b=>b.id === selectedBudgetId)?.name}</CardTitle>
            <CardDescription>Select a period to see details.</CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-auto max-h-40 whitespace-nowrap">
              <div className="flex gap-2 pb-2">
                {currentBudgetPeriods.map(period => (
                  <Button
                    key={period.startDate}
                    variant={viewedPeriodDetails?.periodStartDate === period.startDate ? "default" : "outline"}
                    onClick={() => handlePeriodSelect(period.startDate, period.endDate)}
                    disabled={!isValid(parseISO(period.startDate)) || !isValid(parseISO(period.endDate))}
                  >
                    {period.name}
                  </Button>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      )}

      {viewedPeriodDetails ? (
        <Card className="shadow-lg">
          <CardHeader>
            <div className="flex justify-between items-start">
                <div>
                    <CardTitle className="text-xl">{viewedPeriodDetails.budget.name} - Period Details</CardTitle>
                     <div className="flex flex-wrap gap-1 mt-1">
                        {viewedPeriodDetails.budget.categories.map(catItem => <Badge key={catItem.category} variant="secondary">{catItem.category}</Badge>)}
                    </div>
                </div>
                <div className="flex gap-1">
                    <Button variant="ghost" size="icon" onClick={() => handleEditBudget(viewedPeriodDetails.budget)}>
                        <Edit className="h-4 w-4" /> <span className="sr-only">Edit Budget Definition</span>
                    </Button>
                     <Button variant="ghost" size="icon" onClick={() => setDeletingBudgetId(viewedPeriodDetails.budget.id)} className="text-destructive hover:text-destructive">
                        <Trash2 className="h-4 w-4" /> <span className="sr-only">Delete Budget Definition</span>
                    </Button>
                </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="mb-4 p-4 border rounded-lg bg-muted/30">
                <h3 className="text-lg font-semibold mb-1">Overall Budget Progress</h3>
                <div className="mb-1">
                <span className="text-2xl font-bold">${viewedPeriodDetails.totalSpent.toFixed(2)}</span>
                <span className="text-md text-muted-foreground"> / ${viewedPeriodDetails.overallLimit.toFixed(2)}</span>
                </div>
                <Progress
                value={overallProgress}
                className="h-3"
                style={{ '--progress-color': isOverBudgetOverall ? 'hsl(var(--destructive))' : (overallProgress > 75 ? 'hsl(var(--chart-4))' : 'hsl(var(--primary))') } as React.CSSProperties}
                />
                <p className={`mt-1 text-sm ${isOverBudgetOverall ? 'text-destructive' : 'text-muted-foreground'}`}>
                {isOverBudgetOverall
                    ? `$${Math.abs(overallRemaining).toFixed(2)} over budget`
                    : `$${overallRemaining.toFixed(2)} remaining`}
                </p>
            </div>
            
            
            <div className="mt-6">
                <h4 className="text-md font-semibold mb-2">Spending by Category:</h4>
                <div className="space-y-3">
                    {Object.entries(viewedPeriodDetails.categorySpending)
                      .sort(([catA], [catB]) => catA.localeCompare(catB))
                      .map(([category, data]) => {
                        const progress = data.limit > 0 ? Math.min((data.spent / data.limit) * 100, 100) : 0;
                        const remaining = data.limit - data.spent;
                        const isOverBudget = data.spent > data.limit;
                        return (
                            <div key={category} className="p-3 border rounded-md bg-muted/20 hover:bg-muted/40 transition-colors">
                                <div className="flex justify-between items-baseline mb-1">
                                    <span className="text-sm font-medium">{category}</span>
                                     <span className="text-xs text-muted-foreground">Limit: ${data.limit.toFixed(2)}</span>
                                </div>
                                 <Progress
                                    value={progress}
                                    className="h-2 mb-1"
                                    style={{ '--progress-color': isOverBudget ? 'hsl(var(--destructive))' : (progress > 75 ? 'hsl(var(--chart-4))' : 'hsl(var(--primary))') } as React.CSSProperties}
                                />
                                <div className="flex justify-between items-baseline text-xs">
                                    <span className={`font-medium ${isOverBudget ? 'text-destructive': ''}`}>Spent: ${data.spent.toFixed(2)}</span>
                                    <span className={`${isOverBudget ? 'text-destructive' : 'text-muted-foreground'}`}>
                                        {isOverBudget ? `$${Math.abs(remaining).toFixed(2)} Over` : `$${remaining.toFixed(2)} Left`}
                                    </span>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

          </CardContent>
          <CardFooter>
            <p className="text-sm text-muted-foreground flex items-center gap-2">
              <CalendarDays className="h-4 w-4"/>
              Period: {isValid(parseISO(viewedPeriodDetails.periodStartDate)) ? format(parseISO(viewedPeriodDetails.periodStartDate), 'MMM dd, yyyy') : 'Invalid Start'} - {isValid(parseISO(viewedPeriodDetails.periodEndDate)) ? format(parseISO(viewedPeriodDetails.periodEndDate), 'MMM dd, yyyy') : 'Invalid End'}
            </p>
          </CardFooter>
        </Card>
      ) : selectedBudgetId ? (
         <Card className="text-center py-10">
          <CardContent className="flex flex-col items-center gap-4">
            <Target className="h-16 w-16 text-muted-foreground" />
            <p className="text-muted-foreground">Select a period above to view budget details.</p>
             {currentBudgetPeriods.length === 0 && <p className="text-sm text-muted-foreground">No periods generated for this budget. This might be due to the budget's start date or recurrence settings.</p>}
          </CardContent>
        </Card>
      ) : (
         <Card className="text-center py-10">
          <CardContent className="flex flex-col items-center gap-4">
            <Target className="h-16 w-16 text-muted-foreground" />
            <p className="text-muted-foreground">No budget selected. Choose a budget from the dropdown or create a new one.</p>
            {budgets.length === 0 && !isLoading && <p className="text-sm text-muted-foreground">No budgets found in the database. Create one to get started!</p>}
          </CardContent>
        </Card>
      )}
       <Card>
        <CardHeader><CardTitle>Note on Budget Data</CardTitle></CardHeader>
        <CardContent>
            <p className="text-sm text-muted-foreground">
                Budget definitions (including categories, limits, and recurrence rules) are now stored in and fetched from the application's database.
                Categories available for budgeting are derived from your existing transaction history.
                The "spent" amounts are calculated using transaction data from the database for the selected period.
            </p>
        </CardContent>
      </Card>
       <style jsx global>{`
        .h-2 > div[role="progressbar"], .h-3 > div[role="progressbar"], .h-4 > div[role="progressbar"] {
          background-color: var(--progress-color) !important;
        }
      `}</style>
    </div>
  );
}

