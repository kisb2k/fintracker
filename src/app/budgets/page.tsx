
"use client";

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardFooter, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
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
import { mockBudgets, transactionCategories as defaultCategories } from '@/lib/mock-data';
import type { Budget, Transaction, BudgetRecurrenceFrequency } from '@/lib/types';
import { 
  format, parseISO, isValid, formatISO, // Added formatISO
  startOfDay, endOfDay, isWithinInterval,
  addWeeks, addMonths, addYears, addDays, subMonths, // Added addDays, subMonths
  startOfWeek, endOfWeek,
  startOfMonth, endOfMonth,
  startOfQuarter, endOfQuarter,
  startOfYear, endOfYear,
  differenceInCalendarMonths,
  differenceInCalendarWeeks,
  differenceInCalendarYears,
  differenceInCalendarQuarters,
  isBefore, isAfter,
  getWeek
} from 'date-fns';
import { PlusCircle, Edit, Trash2, Target, GripVertical, ListFilter, CalendarDays } from 'lucide-react';
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useToast } from "@/hooks/use-toast";
import { getTransactions } from '@/lib/actions';

const recurrenceFrequencies: BudgetRecurrenceFrequency[] = ['weekly', 'biweekly', 'monthly', 'quarterly', 'annually'];

const budgetFormSchema = z.object({
  name: z.string().min(1, "Budget name is required"),
  category: z.string().min(1, "Category is required"),
  limit: z.coerce.number().positive("Limit must be a positive number"),
  isRecurring: z.boolean().optional(),
  recurrenceFrequency: z.string().optional().nullable(), // string to match SelectItem value
  // For non-recurring, startDate and endDate define the single period.
  // For recurring, startDate is originalStartDate, and endDate is the end of the *first* period.
  startDate: z.string().refine((val) => isValid(parseISO(val)), { message: "Start date is required and must be valid" }),
  endDate: z.string().refine((val) => isValid(parseISO(val)), { message: "End date is required and must be valid" }),
}).refine(data => {
  if (data.isRecurring && !data.recurrenceFrequency) {
    return false; // recurrenceFrequency is required if isRecurring is true
  }
  return true;
}, {
  message: "Recurrence frequency is required for recurring budgets.",
  path: ["recurrenceFrequency"],
}).refine(data => parseISO(data.endDate) >= parseISO(data.startDate), {
  message: "End date must be after or the same as start date for the initial period.",
  path: ["endDate"],
});

type BudgetFormData = z.infer<typeof budgetFormSchema>;

const BudgetForm: React.FC<{
  onSubmitBudget: (data: BudgetFormData, id?: string) => void;
  initialData?: Budget;
  onClose: () => void;
  availableCategories: string[];
}> = ({ onSubmitBudget, initialData, onClose, availableCategories }) => {
  const form = useForm<BudgetFormData>({
    resolver: zodResolver(budgetFormSchema),
    defaultValues: initialData ? {
      name: initialData.name,
      category: initialData.category,
      limit: initialData.limit,
      isRecurring: initialData.isRecurring || false,
      recurrenceFrequency: initialData.recurrenceFrequency || null,
      startDate: format(parseISO(initialData.originalStartDate || initialData.startDate), 'yyyy-MM-dd'),
      endDate: format(parseISO(initialData.endDate), 'yyyy-MM-dd'),
    } : {
      name: "",
      category: "",
      limit: 100,
      isRecurring: false,
      recurrenceFrequency: null,
      startDate: format(startOfMonth(new Date()), 'yyyy-MM-dd'),
      endDate: format(endOfMonth(new Date()), 'yyyy-MM-dd'),
    },
  });

  const isRecurring = form.watch("isRecurring");

  const handleSubmit = (data: BudgetFormData) => {
    onSubmitBudget(data, initialData?.id);
  };

  return (
    <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
      <FormField
        control={form.control}
        name="name"
        render={({ field }) => (
          <div className="space-y-1">
            <Label htmlFor="name">Budget Name</Label>
            <Input id="name" placeholder="e.g., Monthly Groceries" {...field} />
            {form.formState.errors.name && <p className="text-sm text-destructive">{form.formState.errors.name.message}</p>}
          </div>
        )}
      />
      <FormField
        control={form.control}
        name="category"
        render={({ field }) => (
          <div className="space-y-1">
            <Label htmlFor="category">Category</Label>
            <Select onValueChange={field.onChange} defaultValue={field.value}>
              <SelectTrigger id="category"><SelectValue placeholder="Select category" /></SelectTrigger>
              <SelectContent>
                {availableCategories.filter(c => c.toLowerCase() !== "income").map(cat => <SelectItem key={cat} value={cat}>{cat}</SelectItem>)}
              </SelectContent>
            </Select>
            {form.formState.errors.category && <p className="text-sm text-destructive">{form.formState.errors.category.message}</p>}
          </div>
        )}
      />
      <FormField
        control={form.control}
        name="limit"
        render={({ field }) => (
          <div className="space-y-1">
            <Label htmlFor="limit">Limit ($)</Label>
            <Input id="limit" type="number" step="0.01" placeholder="e.g., 400" {...field} />
            {form.formState.errors.limit && <p className="text-sm text-destructive">{form.formState.errors.limit.message}</p>}
          </div>
        )}
      />
      <FormField
        control={form.control}
        name="isRecurring"
        render={({ field }) => (
          <div className="flex items-center space-x-2">
            <Checkbox id="isRecurring" checked={field.value} onCheckedChange={field.onChange} />
            <Label htmlFor="isRecurring">Is this a recurring budget?</Label>
          </div>
        )}
      />
      {isRecurring && (
         <FormField
          control={form.control}
          name="recurrenceFrequency"
          render={({ field }) => (
            <div className="space-y-1">
              <Label htmlFor="recurrenceFrequency">Recurrence Frequency</Label>
              <Select onValueChange={field.onChange} defaultValue={field.value || undefined}>
                <SelectTrigger id="recurrenceFrequency"><SelectValue placeholder="Select frequency" /></SelectTrigger>
                <SelectContent>
                  {recurrenceFrequencies.map(freq => <SelectItem key={freq} value={freq} className="capitalize">{freq}</SelectItem>)}
                </SelectContent>
              </Select>
              {form.formState.errors.recurrenceFrequency && <p className="text-sm text-destructive">{form.formState.errors.recurrenceFrequency.message}</p>}
            </div>
          )}
        />
      )}
      <div className="grid grid-cols-2 gap-4">
         <FormField
          control={form.control}
          name="startDate"
          render={({ field }) => (
            <div className="space-y-1">
              <Label htmlFor="startDate">{isRecurring ? "Original Start Date" : "Start Date"}</Label>
              <Input id="startDate" type="date" {...field} />
              {form.formState.errors.startDate && <p className="text-sm text-destructive">{form.formState.errors.startDate.message}</p>}
            </div>
          )}
        />
        <FormField
          control={form.control}
          name="endDate"
          render={({ field }) => (
             <div className="space-y-1">
              <Label htmlFor="endDate">{isRecurring ? "End of First Period" : "End Date"}</Label>
              <Input id="endDate" type="date" {...field} />
              {form.formState.errors.endDate && <p className="text-sm text-destructive">{form.formState.errors.endDate.message}</p>}
            </div>
          )}
        />
      </div>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
        <Button type="submit">{initialData ? "Save Changes" : "Create Budget"}</Button>
      </DialogFooter>
    </form>
  );
};

const AddCategoryDialog: React.FC<{
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onAddCategory: (categoryName: string) => void;
}> = ({ isOpen, onOpenChange, onAddCategory }) => {
  const [newCategoryName, setNewCategoryName] = useState("");
  const { toast } = useToast();

  const handleSubmit = () => {
    if (!newCategoryName.trim()) {
      toast({ title: "Error", description: "Category name cannot be empty.", variant: "destructive" });
      return;
    }
    onAddCategory(newCategoryName.trim());
    setNewCategoryName("");
    onOpenChange(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add New Category</DialogTitle>
          <DialogDescription>Create a new category for your budgets and transactions.</DialogDescription>
        </DialogHeader>
        <div className="space-y-2 py-4">
          <Label htmlFor="newCategoryName">Category Name</Label>
          <Input 
            id="newCategoryName" 
            value={newCategoryName} 
            onChange={(e) => setNewCategoryName(e.target.value)}
            placeholder="e.g., Subscriptions"
          />
        </div>
        <DialogFooter>
          <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
          <Button onClick={handleSubmit}>Add Category</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};


export default function BudgetsPage() {
  const [budgets, setBudgets] = useState<Budget[]>(mockBudgets);
  const [allTransactions, setAllTransactions] = useState<Transaction[]>([]);
  const [isLoadingTransactions, setIsLoadingTransactions] = useState(true);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingBudget, setEditingBudget] = useState<Budget | undefined>(undefined);
  const { toast } = useToast();

  const [customCategories, setCustomCategories] = useState<string[]>([]);
  const [isAddCategoryDialogOpen, setIsAddCategoryDialogOpen] = useState(false);

  const [selectedBudgetId, setSelectedBudgetId] = useState<string | null>(null);
  const [currentBudgetPeriods, setCurrentBudgetPeriods] = useState<Array<{ name: string; startDate: string; endDate: string }>>([]);
  const [viewedPeriod, setViewedPeriod] = useState<{
    budget: Budget; // The base budget definition
    periodStartDate: string;
    periodEndDate: string;
    spent: number;
    limit: number; // This is budget.limit
  } | null>(null);

  const availableCategories = useMemo(() => {
    const combined = [...new Set([...defaultCategories, ...customCategories])];
    return combined.sort((a,b) => a.localeCompare(b));
  }, [customCategories]);

  const fetchDbTransactions = useCallback(async () => {
    setIsLoadingTransactions(true);
    const dbTransactions = await getTransactions();
    setAllTransactions(dbTransactions);
    setIsLoadingTransactions(false);
  }, []);

  useEffect(() => {
    fetchDbTransactions();
  }, [fetchDbTransactions]);

  const calculateSpentForPeriod = useCallback((category: string, periodStartDate: string, periodEndDate: string, transactions: Transaction[]): number => {
    return transactions
      .filter(t => 
        t.category === category &&
        t.amount < 0 && // Only count expenses towards budget spending
        isWithinInterval(parseISO(t.date), { 
          start: startOfDay(parseISO(periodStartDate)), 
          end: endOfDay(parseISO(periodEndDate)) 
        })
      )
      .reduce((sum, t) => sum + Math.abs(t.amount), 0);
  }, []);
  
  const generateBudgetPeriods = useCallback((budget: Budget | undefined, numPast = 6, numFuture = 6): Array<{ name: string; startDate: string; endDate: string }> => {
    if (!budget) return [];
    
    if (!budget.isRecurring || !budget.originalStartDate || !budget.recurrenceFrequency) {
        // For non-recurring, or invalid recurring setup, return its defined period
        return [{ name: "Budget Period", startDate: budget.startDate, endDate: budget.endDate }];
    }

    const periods: Array<{ name: string; startDate: string; endDate: string }> = [];
    const today = new Date();
    
    let iterationLimit = numPast + 1 + numFuture + 50; // Safety break

    // Function to advance date based on frequency
    const advanceDate = (date: Date, freq: BudgetRecurrenceFrequency): Date => {
        switch (freq) {
            case 'weekly': return startOfWeek(addWeeks(date, 1), { weekStartsOn: 1 }); // Ensure it aligns to start of week
            case 'biweekly': return startOfDay(addWeeks(date, 2)); // Bi-weekly usually aligns to exact start day
            case 'monthly': return startOfMonth(addMonths(date, 1));
            case 'quarterly': return startOfQuarter(addMonths(date, 3));
            case 'annually': return startOfYear(addYears(date, 1));
            default: return date; 
        }
    };
    
    // Function to get period end and name format
    const getPeriodDetails = (start: Date, freq: BudgetRecurrenceFrequency): { end: Date; nameFmt: string } => {
        let end: Date;
        let nameFmt = "MMM yyyy";
        switch (freq) {
            case 'weekly':
                end = endOfWeek(start, { weekStartsOn: 1 });
                nameFmt = "'Week of' MMM dd, yyyy (W" + format(start, 'ww') +")";
                break;
            case 'biweekly':
                end = addDays(addWeeks(start, 2), -1); // Two weeks from start, minus one day
                nameFmt = "'Bi-Week' MMM dd, yyyy";
                break;
            case 'monthly':
                end = endOfMonth(start);
                nameFmt = "MMMM yyyy";
                break;
            case 'quarterly':
                end = endOfQuarter(start);
                nameFmt = "QQQ yyyy";
                break;
            case 'annually':
                end = endOfYear(start);
                nameFmt = "yyyy";
                break;
            default: 
                end = endOfMonth(start); // Fallback, should not happen
        }
        return { end, nameFmt };
    };

    // Generate past periods up to original start date or numPast
    let currentPeriodStartForPast = parseISO(budget.originalStartDate);
    const pastPeriodsTemp: Array<{ name: string; startDate: string; endDate: string }> = [];
    
    // First, find the period that contains today (or the latest past period if today is before originalStartDate)
    let seedPeriodStart = parseISO(budget.originalStartDate);
    while (isBefore(seedPeriodStart, today) && iterationLimit-- > 0) {
        const { end: seedPeriodEnd } = getPeriodDetails(seedPeriodStart, budget.recurrenceFrequency);
        if (isWithinInterval(today, { start: seedPeriodStart, end: endOfDay(seedPeriodEnd) })) {
            break; 
        }
        if (isAfter(seedPeriodStart, today) && isBefore(parseISO(budget.originalStartDate), seedPeriodStart)) { // if today is before any generated period
             seedPeriodStart = advanceDate(subMonths(seedPeriodStart,1), budget.recurrenceFrequency); // Go back one period if current is too far ahead
             break;
        }
        const nextSeedStart = advanceDate(seedPeriodStart, budget.recurrenceFrequency);
        if (isBefore(nextSeedStart, seedPeriodStart) || nextSeedStart.getTime() === seedPeriodStart.getTime()) { // Break if no progress
            iterationLimit = 0; break;
        }
        seedPeriodStart = nextSeedStart;

        if (isAfter(seedPeriodStart, addYears(today, 5))) { iterationLimit = 0; break; } // safety for runaway loop forward
    }
    
    // Now go backwards from seedPeriodStart to generate `numPast` periods
    currentPeriodStartForPast = seedPeriodStart;
    for (let i = 0; i < numPast && iterationLimit-- > 0; i++) {
        const { end: periodEnd, nameFmt: periodNameFmt } = getPeriodDetails(currentPeriodStartForPast, budget.recurrenceFrequency);
        if (isAfter(currentPeriodStartForPast, parseISO(budget.originalStartDate)) || currentPeriodStartForPast.getTime() === parseISO(budget.originalStartDate).getTime()){
            pastPeriodsTemp.push({
                name: format(currentPeriodStartForPast, periodNameFmt),
                startDate: formatISO(startOfDay(currentPeriodStartForPast)),
                endDate: formatISO(endOfDay(periodEnd))
            });
        } else {
            break; // Stop if we go before original start date
        }
        
        let prevPeriodStartCandidate: Date;
        switch (budget.recurrenceFrequency) {
            case 'weekly': prevPeriodStartCandidate = startOfWeek(addWeeks(currentPeriodStartForPast, -1), {weekStartsOn: 1}); break;
            case 'biweekly': prevPeriodStartCandidate = startOfDay(addWeeks(currentPeriodStartForPast, -2)); break;
            case 'monthly': prevPeriodStartCandidate = startOfMonth(addMonths(currentPeriodStartForPast, -1)); break;
            case 'quarterly': prevPeriodStartCandidate = startOfQuarter(addMonths(currentPeriodStartForPast, -3)); break;
            case 'annually': prevPeriodStartCandidate = startOfYear(addYears(currentPeriodStartForPast, -1)); break;
            default: prevPeriodStartCandidate = currentPeriodStartForPast; // Should not happen
        }

        if (isBefore(prevPeriodStartCandidate, parseISO(budget.originalStartDate)) && prevPeriodStartCandidate.getTime() !== parseISO(budget.originalStartDate).getTime() ) {
             if (currentPeriodStartForPast.getTime() === parseISO(budget.originalStartDate).getTime() && !pastPeriodsTemp.find(p => p.startDate === formatISO(startOfDay(parseISO(budget.originalStartDate!))))) {
                // Add original start if missed
             } else {
                break;
             }
        }
         if (prevPeriodStartCandidate.getTime() === currentPeriodStartForPast.getTime() && currentPeriodStartForPast.getTime() !== parseISO(budget.originalStartDate).getTime()) {iterationLimit=0; break;} // Break if stuck
        currentPeriodStartForPast = prevPeriodStartCandidate;
         if (isBefore(currentPeriodStartForPast, subYears(today, 5))) { iterationLimit = 0; break; } // safety for runaway loop backward

    }
    // Add the original start date period if it wasn't captured and is distinct
     const originalStartDatePeriodExists = pastPeriodsTemp.some(p => parseISO(p.startDate).getTime() === parseISO(budget.originalStartDate!).getTime());
    if (!originalStartDatePeriodExists) {
        const {end: origEnd, nameFmt: origNameFmt} = getPeriodDetails(parseISO(budget.originalStartDate!), budget.recurrenceFrequency);
        pastPeriodsTemp.push({
            name: format(parseISO(budget.originalStartDate!), origNameFmt),
            startDate: formatISO(startOfDay(parseISO(budget.originalStartDate!))),
            endDate: formatISO(endOfDay(origEnd))
        });
    }

    periods.push(...pastPeriodsTemp.reverse()); // Reverse to get chronological order

    // Generate future periods starting from the period after seedPeriodStart
    let currentPeriodStartForFuture = advanceDate(seedPeriodStart, budget.recurrenceFrequency);
    // Ensure we don't add seedPeriodStart again if it was already added
    if (periods.length > 0 && parseISO(periods[periods.length-1].startDate).getTime() >= currentPeriodStartForFuture.getTime()){
         currentPeriodStartForFuture = advanceDate(parseISO(periods[periods.length-1].startDate), budget.recurrenceFrequency);
    }


    for (let i = 0; i < numFuture && iterationLimit-- > 0; i++) {
        const { end: periodEnd, nameFmt: periodNameFmt } = getPeriodDetails(currentPeriodStartForFuture, budget.recurrenceFrequency);
        
        periods.push({
            name: format(currentPeriodStartForFuture, periodNameFmt),
            startDate: formatISO(startOfDay(currentPeriodStartForFuture)),
            endDate: formatISO(endOfDay(periodEnd))
        });
        
        const nextFutureStart = advanceDate(currentPeriodStartForFuture, budget.recurrenceFrequency);
        if (isBefore(nextFutureStart, currentPeriodStartForFuture) || nextFutureStart.getTime() === currentPeriodStartForFuture.getTime()) { // Break if no progress
            iterationLimit = 0; break;
        }
        currentPeriodStartForFuture = nextFutureStart;
        if (isAfter(currentPeriodStartForFuture, addYears(today, 5))) { iterationLimit = 0; break; } // safety for runaway loop forward
    }
    
    // Ensure unique periods and sort them
    const uniquePeriodsMap = new Map<string, { name: string; startDate: string; endDate: string }>();
    periods.forEach(p => uniquePeriodsMap.set(p.startDate, p));
    const uniquePeriods = Array.from(uniquePeriodsMap.values())
      .sort((a,b) => parseISO(a.startDate).getTime() - parseISO(b.startDate).getTime());
      
    // Ensure we have a period containing today if possible or the latest past/earliest future
    const todayIso = formatISO(startOfDay(today));
    const hasCurrentOrFutureRelevant = uniquePeriods.some(p => isWithinInterval(parseISO(todayIso), {start: parseISO(p.startDate), end: parseISO(p.endDate)}) || isAfter(parseISO(p.startDate), parseISO(todayIso)) );
    const hasPastRelevant = uniquePeriods.some(p => isBefore(parseISO(p.endDate), parseISO(todayIso)));

    if(!hasCurrentOrFutureRelevant && !hasPastRelevant && budget.originalStartDate){ // If no periods generated and there's an original start date.
        const {end: origEnd, nameFmt: origNameFmt} = getPeriodDetails(parseISO(budget.originalStartDate), budget.recurrenceFrequency);
        return [{
            name: format(parseISO(budget.originalStartDate), origNameFmt),
            startDate: formatISO(startOfDay(parseISO(budget.originalStartDate))),
            endDate: formatISO(endOfDay(origEnd))
        }];
    }
    
    return uniquePeriods;

  }, []);


  useEffect(() => {
    if (selectedBudgetId) {
      const budget = budgets.find(b => b.id === selectedBudgetId);
      if (budget) {
        const periods = generateBudgetPeriods(budget);
        setCurrentBudgetPeriods(periods);
        
        const todayInstance = new Date();
        let periodToView = periods.find(p => isWithinInterval(todayInstance, {start: parseISO(p.startDate), end: parseISO(p.endDate)}));
        
        if (!periodToView && periods.length > 0) {
            const pastOrCurrentPeriods = periods.filter(p => parseISO(p.startDate) <= todayInstance);
            if(pastOrCurrentPeriods.length > 0){
                periodToView = pastOrCurrentPeriods[pastOrCurrentPeriods.length -1]; // latest past or current
            } else { 
                periodToView = periods[0]; // earliest future
            }
        }

        if (periodToView) {
          const spent = calculateSpentForPeriod(budget.category, periodToView.startDate, periodToView.endDate, allTransactions);
          setViewedPeriod({
            budget,
            periodStartDate: periodToView.startDate,
            periodEndDate: periodToView.endDate,
            spent,
            limit: budget.limit,
          });
        } else {
          setViewedPeriod(null); // No suitable period found (e.g. budget starts far in future)
        }
      } else {
        setCurrentBudgetPeriods([]);
        setViewedPeriod(null);
      }
    } else {
      setCurrentBudgetPeriods([]);
      setViewedPeriod(null);
    }
  }, [selectedBudgetId, budgets, allTransactions, calculateSpentForPeriod, generateBudgetPeriods]);


  const handleBudgetSubmit = (data: BudgetFormData, id?: string) => {
    const baseBudgetProperties = {
        name: data.name,
        category: data.category,
        limit: Number(data.limit),
        isRecurring: data.isRecurring || false,
        recurrenceFrequency: data.isRecurring ? data.recurrenceFrequency as BudgetRecurrenceFrequency : null,
        originalStartDate: data.isRecurring ? formatISO(startOfDay(parseISO(data.startDate))) : null,
    };

    // For non-recurring, startDate and endDate are directly from form.
    // For recurring, form's startDate is originalStartDate. form's endDate helps define the *first* period's length.
    // The actual startDate/endDate for display will be derived from generateBudgetPeriods.
    // So, for the 'Budget' object, we can store the form's startDate/endDate as the initial period.
    const initialPeriodStartDate = formatISO(startOfDay(parseISO(data.startDate)));
    const initialPeriodEndDate = formatISO(endOfDay(parseISO(data.endDate)));
    
    const budgetWithPeriod: Omit<Budget, 'id' | 'spent'> = {
        ...baseBudgetProperties,
        startDate: initialPeriodStartDate, 
        endDate: initialPeriodEndDate,
    };


    if (id) { // Editing existing budget
      setBudgets(prev => prev.map(b => b.id === id ? { 
        ...b, 
        ...budgetWithPeriod,
        // Spent is dynamic, so no need to set it here; it's calculated on view.
       } : b));
      toast({ title: "Budget Updated", description: `${data.name} has been updated.`});
    } else { // Creating new budget
      const newBudgetId = `bud_${Date.now()}`;
      const newBudget: Budget = {
        id: newBudgetId,
        ...budgetWithPeriod,
        spent: 0, // Initial spent is 0, will be calculated on view.
      };
      setBudgets(prev => [newBudget, ...prev]);
      toast({ title: "Budget Created", description: `${data.name} has been created.`});
      setSelectedBudgetId(newBudgetId); // Auto-select the new budget
    }
    setIsFormOpen(false);
    setEditingBudget(undefined);
  };

  const handleEditBudget = (budgetToEdit: Budget) => {
    setEditingBudget(budgetToEdit);
    setIsFormOpen(true);
  };
  
  const handleDeleteBudget = (budgetId: string) => {
    setBudgets(prev => prev.filter(b => b.id !== budgetId));
    if (selectedBudgetId === budgetId) {
      setSelectedBudgetId(null); // Clear selection if deleted budget was selected
    }
    toast({ title: "Budget Deleted", description: "The budget has been removed.", variant: "destructive" });
  };

  const handleAddCategory = (categoryName: string) => {
    if (!customCategories.map(c => c.toLowerCase()).includes(categoryName.toLowerCase()) && !defaultCategories.map(c => c.toLowerCase()).includes(categoryName.toLowerCase())) {
      setCustomCategories(prev => [...prev, categoryName]);
      toast({ title: "Category Added", description: `${categoryName} has been added.` });
    } else {
      toast({ title: "Category Exists", description: `${categoryName} already exists.`, variant: "default" });
    }
  };

  const handlePeriodSelect = (periodStartDate: string, periodEndDate: string) => {
    if (!selectedBudgetId) return;
    const budget = budgets.find(b => b.id === selectedBudgetId);
    if (budget) {
      const spent = calculateSpentForPeriod(budget.category, periodStartDate, periodEndDate, allTransactions);
      setViewedPeriod({
        budget,
        periodStartDate,
        periodEndDate,
        spent,
        limit: budget.limit,
      });
    }
  };

  if (isLoadingTransactions) {
    return <div className="flex justify-center items-center h-64"><p>Loading budget data...</p></div>;
  }

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
              <DialogContent className="max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>{editingBudget ? "Edit Budget" : "Create New Budget"}</DialogTitle>
                </DialogHeader>
                <BudgetForm 
                  onSubmitBudget={handleBudgetSubmit} 
                  initialData={editingBudget}
                  onClose={() => { setIsFormOpen(false); setEditingBudget(undefined);}}
                  availableCategories={availableCategories}
                />
              </DialogContent>
            </Dialog>
            <Button variant="outline" onClick={() => setIsAddCategoryDialogOpen(true)}>
                 <GripVertical className="mr-2 h-4 w-4" /> Add New Category
            </Button>
        </div>
        <div className="min-w-[250px]">
            <Select onValueChange={setSelectedBudgetId} value={selectedBudgetId || ""}>
                <SelectTrigger><SelectValue placeholder="Choose a budget to view..." /></SelectTrigger>
                <SelectContent>
                    {budgets.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
                </SelectContent>
            </Select>
        </div>
      </div>

      <AddCategoryDialog 
        isOpen={isAddCategoryDialogOpen}
        onOpenChange={setIsAddCategoryDialogOpen}
        onAddCategory={handleAddCategory}
      />

      {selectedBudgetId && currentBudgetPeriods.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><ListFilter className="h-5 w-5"/> Budget Periods for: {budgets.find(b=>b.id === selectedBudgetId)?.name}</CardTitle>
            <CardDescription>Select a period to see details.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {currentBudgetPeriods.map(period => (
                <Button 
                  key={period.startDate} 
                  variant={viewedPeriod?.periodStartDate === period.startDate ? "default" : "outline"}
                  onClick={() => handlePeriodSelect(period.startDate, period.endDate)}
                >
                  {period.name}
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {viewedPeriod ? (
        <Card className="shadow-lg">
          <CardHeader>
            <div className="flex justify-between items-start">
                <div>
                    <CardTitle className="text-xl">{viewedPeriod.budget.name} - Period Details</CardTitle>
                    <CardDescription>{viewedPeriod.budget.category}</CardDescription>
                </div>
                <div className="flex gap-1">
                    <Button variant="ghost" size="icon" onClick={() => handleEditBudget(viewedPeriod.budget)}>
                        <Edit className="h-4 w-4" /> <span className="sr-only">Edit Budget Definition</span>
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => handleDeleteBudget(viewedPeriod.budget.id)} className="text-destructive hover:text-destructive">
                        <Trash2 className="h-4 w-4" /> <span className="sr-only">Delete Budget Definition</span>
                    </Button>
                </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="mb-2">
              <span className="text-3xl font-bold">${viewedPeriod.spent.toFixed(2)}</span>
              <span className="text-lg text-muted-foreground"> / ${viewedPeriod.limit.toFixed(2)}</span>
            </div>
            <Progress 
              value={viewedPeriod.limit > 0 ? Math.min((viewedPeriod.spent / viewedPeriod.limit) * 100, 100) : 0} 
              className="h-4" 
              style={{ '--progress-color': viewedPeriod.spent > viewedPeriod.limit ? 'hsl(var(--destructive))' : (viewedPeriod.spent / viewedPeriod.limit > 0.75 ? 'hsl(var(--chart-4))' : 'hsl(var(--primary))') } as React.CSSProperties}
            />
            <p className={`mt-2 text-md ${viewedPeriod.spent > viewedPeriod.limit ? 'text-destructive' : 'text-muted-foreground'}`}>
              {viewedPeriod.spent > viewedPeriod.limit 
                ? `$${Math.abs(viewedPeriod.limit - viewedPeriod.spent).toFixed(2)} over budget` 
                : `$${(viewedPeriod.limit - viewedPeriod.spent).toFixed(2)} remaining`}
            </p>
          </CardContent>
          <CardFooter>
            <p className="text-sm text-muted-foreground flex items-center gap-2">
              <CalendarDays className="h-4 w-4"/>
              Period: {format(parseISO(viewedPeriod.periodStartDate), 'MMM dd, yyyy')} - {format(parseISO(viewedPeriod.periodEndDate), 'MMM dd, yyyy')}
            </p>
          </CardFooter>
        </Card>
      ) : selectedBudgetId ? (
         <Card className="text-center py-10">
          <CardContent className="flex flex-col items-center gap-4">
            <Target className="h-16 w-16 text-muted-foreground" />
            <p className="text-muted-foreground">Select a period above to view budget details.</p>
             {currentBudgetPeriods.length === 0 && <p className="text-sm text-muted-foreground">No periods generated for this budget yet, or budget definition issue.</p>}
          </CardContent>
        </Card>
      ) : (
         <Card className="text-center py-10">
          <CardContent className="flex flex-col items-center gap-4">
            <Target className="h-16 w-16 text-muted-foreground" />
            <p className="text-muted-foreground">No budget selected. Choose a budget from the dropdown or create a new one.</p>
          </CardContent>
        </Card>
      )}
       <Card>
        <CardHeader><CardTitle>Note on Budget Data</CardTitle></CardHeader>
        <CardContent>
            <p className="text-sm text-muted-foreground">
                Budget definitions (including recurrence rules and custom categories) are currently managed in memory and are not persisted in the database.
                The "spent" amounts for these budgets are calculated using transaction data fetched from the SQLite database for the selected period.
            </p>
        </CardContent>
      </Card>
       <style jsx global>{`
        .h-3 > div[role="progressbar"], .h-4 > div[role="progressbar"] {
          background-color: var(--progress-color) !important;
        }
      `}</style>
    </div>
  );
}

// isValid is not directly available from date-fns root, it's a named export.
// This is already handled by the import.

// Global style for Progress component indicator.
// The inline style with CSS variable is a common workaround.
const GlobalProgressStyle = () => (
  <style jsx global>{`
    .h-3 > div[role="progressbar"], .h-4 > div[role="progressbar"] {
      background-color: var(--progress-color) !important;
    }
  `}</style>
);
const subYears = (date: Date, years: number): Date => {
  const newDate = new Date(date);
  newDate.setFullYear(newDate.getFullYear() - years);
  return newDate;
};
