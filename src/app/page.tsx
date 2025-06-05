
"use client";

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { DollarSign, TrendingUp, TrendingDown, ListChecks, Info, PieChart as PieChartIcon, Eye, CalendarDays, Target } from "lucide-react";
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import type { Transaction, Account, Budget, SpendingChartDataPoint, CategoryTransactionDetails, BudgetRecurrenceFrequency, BudgetCategoryLimit } from "@/lib/types";
import {
  format, parseISO, isWithinInterval,
  startOfDay, endOfDay,
  addWeeks, addMonths, addYears, addDays,
  subWeeks, subMonths, subYears,
  startOfWeek, endOfWeek,
  startOfMonth, endOfMonth,
  startOfQuarter, endOfQuarter,
  startOfYear, endOfYear,
  isBefore, isAfter, isValid, formatISO
} from 'date-fns';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription as RHFDialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { detectUnusualSpending } from '@/ai/flows/detect-unusual-spending';
import type { DetectUnusualSpendingOutput } from '@/ai/flows/detect-unusual-spending';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { getAccounts, getTransactions, getBudgets } from '@/lib/actions';
import { ScrollArea } from '@/components/ui/scroll-area';


const CategoryDetailsDialog: React.FC<{
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  details: CategoryTransactionDetails | null;
  periodLabel: string;
}> = ({ isOpen, onOpenChange, details, periodLabel }) => {
  if (!details) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Transactions for: {details.categoryName}</DialogTitle>
          <RHFDialogDescription>
            Total Spent: ${details.totalSpent.toFixed(2)}
            {details.limit !== undefined && ` / Limit: $${details.limit.toFixed(2)}`} ({periodLabel})
          </RHFDialogDescription>
        </DialogHeader>
        <ScrollArea className="max-h-[60vh] my-4">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Description</TableHead>
                <TableHead className="text-right">Amount</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {details.transactions.length > 0 ? details.transactions.map(t => (
                <TableRow key={t.id}>
                  <TableCell>{format(parseISO(t.date), 'MMM dd, yyyy')}</TableCell>
                  <TableCell>{t.description}</TableCell>
                  <TableCell className="text-right text-red-600">-${Math.abs(t.amount).toFixed(2)}</TableCell>
                </TableRow>
              )) : (
                <TableRow><TableCell colSpan={3} className="text-center">No transactions for this category in the selected period.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </ScrollArea>
        <DialogFooter>
          <DialogClose asChild><Button variant="outline">Close</Button></DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};


const SpendingChart: React.FC<{
  data: SpendingChartDataPoint[];
  onCategoryClick: (categoryName: string) => void;
}> = ({ data, onCategoryClick }) => {

  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#82Ca9D', '#A4DE6C', '#D0ED57', '#FFC658'];

  if (data.length === 0) {
    return <p className="text-muted-foreground text-center py-10">No spending data available for the default budget in the selected period.</p>;
  }

  return (
    <ResponsiveContainer width="100%" height={300}>
      <PieChart>
        <Pie
          data={data}
          cx="50%"
          cy="50%"
          labelLine={false}
          outerRadius={100}
          fill="#8884d8"
          dataKey="Spending"
          nameKey="name"
          label={({ name, percent, Spending }) => {
            if (Spending === 0 && data.reduce((sum, entry) => sum + entry.Spending, 0) === 0) return name; // Show name if all spending is 0
            return `${name} ${(percent * 100).toFixed(0)}%`;
          }}
          onClick={(payload) => {
            if (payload && payload.name) {
              onCategoryClick(payload.name as string);
            }
          }}
        >
          {data.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} className="cursor-pointer focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2" />
          ))}
        </Pie>
        <Tooltip formatter={(value: number, name: string, entry: any) => {
          const limit = entry.payload.limit;
          let tooltipText = `$${value.toFixed(2)}`;
          if (limit !== undefined) {
            tooltipText += ` (Limit: $${limit.toFixed(2)})`;
          }
          return [tooltipText, name];
        }} />
        <Legend />
      </PieChart>
    </ResponsiveContainer>
  );
};


const RecentTransactions: React.FC<{ transactions: Transaction[] }> = ({ transactions }) => {
  const [recentTransactions, setRecentTransactions] = useState<Transaction[]>([]);
  useEffect(() => {
    if (transactions) {
      const sortedTransactions = [...transactions].sort((a, b) => parseISO(b.date).getTime() - parseISO(a.date).getTime());
      setRecentTransactions(sortedTransactions.slice(0, 5));
    }
  }, [transactions]);

  if(recentTransactions.length === 0) {
    return <p className="text-muted-foreground text-center py-4">No recent transactions.</p>;
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Date</TableHead>
          <TableHead>Description</TableHead>
          <TableHead>Category</TableHead>
          <TableHead className="text-right">Amount</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {recentTransactions.map((transaction) => (
          <TableRow key={transaction.id}>
            <TableCell>{format(parseISO(transaction.date), 'MMM dd, yyyy')}</TableCell>
            <TableCell>{transaction.description}</TableCell>
            <TableCell><Badge variant="secondary">{transaction.category}</Badge></TableCell>
            <TableCell className={`text-right ${transaction.amount > 0 ? 'text-green-600' : 'text-red-600'}`}>
              {transaction.amount > 0 ? '+' : ''}${Math.abs(transaction.amount).toFixed(2)}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
};


const UnusualSpendingAlert: React.FC<{ transactionsInPeriod: Transaction[], accounts: Account[], periodLabel: string }> = ({ transactionsInPeriod, accounts, periodLabel }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [aiResult, setAiResult] = useState<DetectUnusualSpendingOutput | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleDetectUnusualSpending = async () => {
    if (transactionsInPeriod.length === 0) {
      setError(`Not enough transaction data for ${periodLabel} to analyze spending.`);
      setAiResult(null);
      return;
    }
    if (accounts.length === 0) {
       setError(`No accounts found. AI analysis requires at least one account.`);
       setAiResult(null);
       return;
    }
    setIsLoading(true);
    setError(null);
    setAiResult(null);
    try {
      const firstAccount = accounts[0];
      const result = await detectUnusualSpending({
        transactionHistory: JSON.stringify(transactionsInPeriod.slice(0, 100)), // Limit history size for performance
        accountId: firstAccount?.id || 'N/A',
        accountType: firstAccount?.type || 'N/A',
      });
      setAiResult(result);
    } catch (e) {
      setError("Failed to analyze spending. Please try again.");
      console.error(e);
    }
    setIsLoading(false);
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">Unusual Spending Detection ({periodLabel})</CardTitle>
        <Info className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <Button onClick={handleDetectUnusualSpending} disabled={isLoading || transactionsInPeriod.length === 0} className="mb-4">
          {isLoading ? "Analyzing..." : `Check for Unusual Spending in ${periodLabel}`}
        </Button>
        {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
        {aiResult && (
          <Alert variant={aiResult.unusualSpendingDetected ? "destructive" : "default"}>
            <AlertTitle>
              {aiResult.unusualSpendingDetected ? "Unusual Spending Detected!" : "No Unusual Spending Detected"}
            </AlertTitle>
            <RHFDialogDescription>
              <p className="mb-2">{aiResult.explanation}</p>
              {aiResult.unusualSpendingDetected && <p><strong>Suggestions:</strong> {aiResult.suggestedActions}</p>}
            </RHFDialogDescription>
          </Alert>
        )}
         {!aiResult && !isLoading && !error && transactionsInPeriod.length > 0 && (
          <p className="text-sm text-muted-foreground">Click the button above to analyze spending for this period.</p>
        )}
      </CardContent>
    </Card>
  );
};

// Adapted from Budgets page
const getPeriodBoundaries = (startDate: Date, freq: BudgetRecurrenceFrequency): { periodStart: Date; periodEnd: Date; periodName: string } => {
  let periodStart: Date, periodEnd: Date, periodName: string;
  let nameFmt: string;

  switch (freq) {
      case 'weekly':
          periodStart = startOfWeek(startDate, { weekStartsOn: 1 });
          periodEnd = endOfWeek(startDate, { weekStartsOn: 1 });
          nameFmt = "'Week of' MMM dd, yyyy ('W'ww)";
          break;
      case 'biweekly':
          periodStart = startDate; // For bi-weekly, the start date itself is the anchor of its period
          periodEnd = endOfDay(addDays(addWeeks(startDate, 2),-1));
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
      default: // Should not happen with typed frequency
          periodStart = startOfMonth(startDate);
          periodEnd = endOfMonth(startDate);
          nameFmt = "MMMM yyyy";
  }
  periodName = format(periodStart, nameFmt);
  return { periodStart: startOfDay(periodStart), periodEnd: endOfDay(periodEnd), periodName };
};

const generateBudgetPeriods = (budget: Budget | undefined | null, numPast = 6, numFuture = 6): Array<{ name: string; startDate: string; endDate: string }> => {
  if (!budget) return [];

  const periods: Array<{ name: string; startDate: string; endDate: string }> = [];
  const today = new Date();

  if (!budget.isRecurring || !budget.originalStartDate) {
      if (budget.originalStartDate && budget.endDate) { // Non-recurring budget
           const periodName = `Period: ${format(parseISO(budget.originalStartDate), 'MMM dd')} - ${format(parseISO(budget.endDate), 'MMM dd, yyyy')}`;
           return [{ name: periodName, startDate: budget.originalStartDate, endDate: budget.endDate }];
      }
      return []; // Not enough info for non-recurring
  }

  const originalStartDateParsed = parseISO(budget.originalStartDate);
  if(!isValid(originalStartDateParsed) || !budget.recurrenceFrequency) return [];

  // Determine the "current" seed date for generating periods around today
  let currentSeedDate = originalStartDateParsed;
  while(isValid(currentSeedDate) && isBefore(getPeriodBoundaries(currentSeedDate, budget.recurrenceFrequency).periodEnd, today)) {
      switch (budget.recurrenceFrequency) {
          case 'weekly': currentSeedDate = addWeeks(currentSeedDate, 1); break;
          case 'biweekly': currentSeedDate = addWeeks(currentSeedDate, 2); break; // Bi-weekly advances by 2 weeks
          case 'monthly': currentSeedDate = addMonths(currentSeedDate, 1); break;
          case 'quarterly': currentSeedDate = addMonths(currentSeedDate, 3); break;
          case 'annually': currentSeedDate = addYears(currentSeedDate, 1); break;
      }
      if (isAfter(currentSeedDate, addYears(today, 10))) break; // Safety break for far future
  }

  // Generate past periods
  let tempDateForPast = currentSeedDate;
  for (let i = 0; i < numPast; i++) {
      const { periodStart, periodEnd, periodName } = getPeriodBoundaries(tempDateForPast, budget.recurrenceFrequency);
       // Ensure periods don't go effectively before the budget's original start date
      if (isAfter(periodStart, originalStartDateParsed) || periodStart.getTime() === originalStartDateParsed.getTime()) {
           periods.unshift({ name: periodName, startDate: formatISO(periodStart), endDate: formatISO(periodEnd) });
      } else if (periodStart.getTime() < originalStartDateParsed.getTime() && periodEnd.getTime() >= originalStartDateParsed.getTime()) {
           // Special case for the very first period if it partially overlaps originalStartDate
          periods.unshift({ name: periodName, startDate: formatISO(originalStartDateParsed), endDate: formatISO(periodEnd) });
      }


      let prevTempDate: Date;
       switch (budget.recurrenceFrequency) {
          case 'weekly': prevTempDate = subWeeks(tempDateForPast, 1); break;
          case 'biweekly': prevTempDate = subWeeks(tempDateForPast, 2); break;
          case 'monthly': prevTempDate = subMonths(tempDateForPast, 1); break;
          case 'quarterly': prevTempDate = subMonths(tempDateForPast, 3); break;
          case 'annually': prevTempDate = subYears(tempDateForPast, 1); break;
          default: prevTempDate = tempDateForPast; // Should not happen
      }
       // Stop if we go before the original start date for good
      if (isBefore(prevTempDate, originalStartDateParsed) && getPeriodBoundaries(prevTempDate, budget.recurrenceFrequency).periodEnd < originalStartDateParsed) break;
      if (prevTempDate.getTime() === tempDateForPast.getTime() && tempDateForPast.getTime() !== originalStartDateParsed.getTime()) break; // Safety break for no change
      tempDateForPast = prevTempDate;
       if (isBefore(tempDateForPast, subYears(today, 10))) break; // Further safety break
  }

  // Add current period (derived from currentSeedDate) if not already added
  const currentSeedPeriodDetails = getPeriodBoundaries(currentSeedDate, budget.recurrenceFrequency);
  if (!periods.find(p => p.startDate === formatISO(currentSeedPeriodDetails.periodStart))) {
      const insertIndex = periods.findIndex(p => parseISO(p.startDate) > currentSeedPeriodDetails.periodStart);
      const periodToAdd = { name: currentSeedPeriodDetails.periodName, startDate: formatISO(currentSeedPeriodDetails.periodStart), endDate: formatISO(currentSeedPeriodDetails.periodEnd) };
      if (insertIndex === -1) periods.push(periodToAdd);
      else periods.splice(insertIndex, 0, periodToAdd);
  }

  // Generate future periods
  let tempDateForFuture = currentSeedDate;
   // If currentSeedDate's period is in the past (relative to today), advance to the next period to start future generation
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
       // Ensure we don't re-add the "current" (seed) period if it was already handled
      if (i > 0 || formatISO(getPeriodBoundaries(tempDateForFuture, budget.recurrenceFrequency).periodStart) !== currentSeedPeriodDetails.startDate) {
          const { periodStart, periodEnd, periodName } = getPeriodBoundaries(tempDateForFuture, budget.recurrenceFrequency);
           if (!periods.find(p => p.startDate === formatISO(periodStart))) { // Avoid duplicates
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
          default: nextTempDate = tempDateForFuture; // Should not happen
      }
      if (nextTempDate.getTime() === tempDateForFuture.getTime()) break; // Safety break
      tempDateForFuture = nextTempDate;
       if (isAfter(tempDateForFuture, addYears(today, 10))) break; // Further safety break
  }

  // Deduplicate and sort periods
  const uniquePeriodsMap = new Map<string, { name: string; startDate: string; endDate: string }>();
  periods.forEach(p => { if(isValid(parseISO(p.startDate))) uniquePeriodsMap.set(p.startDate, p);});

  return Array.from(uniquePeriodsMap.values())
    .sort((a,b) => parseISO(a.startDate).getTime() - parseISO(b.startDate).getTime());
};


export default function DashboardPage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [allTransactions, setAllTransactions] = useState<Transaction[]>([]);
  // const [budgets, setBudgets] = useState<Budget[]>([]); // Not needed directly, defaultBudget is key
  const [isLoading, setIsLoading] = useState(true);
  const [defaultBudget, setDefaultBudget] = useState<Budget | null>(null);
  const [spendingChartData, setSpendingChartData] = useState<SpendingChartDataPoint[]>([]);

  const [isCategoryDetailsOpen, setIsCategoryDetailsOpen] = useState(false);
  const [selectedCategoryDetails, setSelectedCategoryDetails] = useState<CategoryTransactionDetails | null>(null);

  const [totalBalance, setTotalBalance] = useState(0);
  const [periodIncome, setPeriodIncome] = useState(0);
  const [periodExpenses, setPeriodExpenses] = useState(0);

  const [dashboardBudgetPeriods, setDashboardBudgetPeriods] = useState<Array<{ name: string; startDate: string; endDate: string }>>([]);
  const [selectedDashboardPeriod, setSelectedDashboardPeriod] = useState<{ name: string; startDate: string; endDate: string } | null>(null);
  const initialPeriodSetForBudgetIdRef = React.useRef<string | null>(null);


  const displayPeriodStart = useMemo(() => selectedDashboardPeriod ? parseISO(selectedDashboardPeriod.startDate) : null, [selectedDashboardPeriod]);
  const displayPeriodEnd = useMemo(() => selectedDashboardPeriod ? parseISO(selectedDashboardPeriod.endDate) : null, [selectedDashboardPeriod]);

  const selectedPeriodLabel = useMemo(() => {
    return selectedDashboardPeriod?.name || "Selected Period";
  }, [selectedDashboardPeriod]);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    const [dbAccounts, dbTransactions, dbBudgets] = await Promise.all([
      getAccounts(),
      getTransactions(),
      getBudgets()
    ]);
    setAccounts(dbAccounts);
    setAllTransactions(dbTransactions);
    // setBudgets(dbBudgets); // No longer need to store all budgets here

    const foundDefaultBudget = dbBudgets.find(b => b.isDefault) || (dbBudgets.length > 0 ? dbBudgets[0] : null);
    setDefaultBudget(foundDefaultBudget);

    setIsLoading(false);
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    if (defaultBudget) {
      const periods = generateBudgetPeriods(defaultBudget);
      setDashboardBudgetPeriods(periods);

      if (periods.length > 0) {
        // Only set/reset selectedDashboardPeriod if the defaultBudget itself has changed
        // or if no period is currently selected for the active defaultBudget
        if (initialPeriodSetForBudgetIdRef.current !== defaultBudget.id || !selectedDashboardPeriod) {
          const todayInstance = new Date();
          let periodToView = periods.find(p =>
            isValid(parseISO(p.startDate)) &&
            isValid(parseISO(p.endDate)) &&
            isWithinInterval(todayInstance, { start: parseISO(p.startDate), end: parseISO(p.endDate) })
          );

          if (!periodToView) { // If no current period, find most recent past or first future
            const pastOrCurrentPeriods = periods.filter(p =>
              isValid(parseISO(p.startDate)) && parseISO(p.startDate) <= todayInstance
            );
            if (pastOrCurrentPeriods.length > 0) {
              periodToView = pastOrCurrentPeriods[pastOrCurrentPeriods.length - 1]; // Most recent past
            } else {
              periodToView = periods[0]; // First available (likely future)
            }
          }
          setSelectedDashboardPeriod(periodToView || null);
          initialPeriodSetForBudgetIdRef.current = defaultBudget.id;
        }
      } else { // No periods for this budget
        setSelectedDashboardPeriod(null);
        initialPeriodSetForBudgetIdRef.current = defaultBudget.id; // Mark as processed
      }
    } else { // No default budget
      setDashboardBudgetPeriods([]);
      setSelectedDashboardPeriod(null);
      initialPeriodSetForBudgetIdRef.current = null;
    }
  }, [defaultBudget]); // Only depends on defaultBudget


  const transactionsInSelectedPeriod = useMemo(() => {
    if (isLoading || !allTransactions.length || !displayPeriodStart || !displayPeriodEnd) return [];
    return allTransactions.filter(t => {
      const tDate = parseISO(t.date);
      if (!isValid(tDate) || !isValid(displayPeriodStart) || !isValid(displayPeriodEnd)) return false;
      return isWithinInterval(tDate, { start: displayPeriodStart, end: displayPeriodEnd });
    });
  }, [allTransactions, isLoading, displayPeriodStart, displayPeriodEnd]);


  useEffect(() => {
    // Guard for initial loading or if essential data isn't ready
    if (isLoading || !selectedDashboardPeriod || !defaultBudget) {
      setTotalBalance(accounts.reduce((sum, acc) => sum + acc.balance, 0)); // Recalc total balance even if other data is reset
      setPeriodIncome(0);
      setPeriodExpenses(0);
      setSpendingChartData([]);
      return;
    }
    
    const balance = accounts.reduce((sum, acc) => sum + acc.balance, 0);
    setTotalBalance(balance);

    const income = transactionsInSelectedPeriod
      .filter(t => t.amount > 0)
      .reduce((sum, t) => sum + t.amount, 0);
    setPeriodIncome(income);

    const expenses = transactionsInSelectedPeriod
      .filter(t => t.amount < 0)
      .reduce((sum, t) => sum + Math.abs(t.amount), 0);
    setPeriodExpenses(expenses);

    if (defaultBudget.categories && defaultBudget.categories.length > 0) {
      const newChartData = defaultBudget.categories.map(catLimit => {
        const spentInCat = transactionsInSelectedPeriod
          .filter(t => t.category === catLimit.category && t.amount < 0)
          .reduce((sum, t) => sum + Math.abs(t.amount), 0);
        return {
          name: catLimit.category,
          Spending: spentInCat, // Use direct number
          limit: catLimit.amountLimit,
        };
      // Filter: show if spending OR if limit is defined and positive
      }).filter(cd => cd.Spending > 0 || (typeof cd.limit === 'number' && cd.limit > 0));
      setSpendingChartData(newChartData);
    } else {
      setSpendingChartData([]); // If no categories in default budget
    }

  }, [accounts, transactionsInSelectedPeriod, isLoading, defaultBudget, selectedDashboardPeriod]);

  const handleCategoryChartClick = (categoryName: string) => {
    if (!defaultBudget || !selectedDashboardPeriod || !displayPeriodStart || !displayPeriodEnd) return;

    const categoryLimitObj = defaultBudget.categories.find(c => c.category === categoryName);

    const transactionsForCategoryInPeriod = transactionsInSelectedPeriod.filter(t =>
      t.category === categoryName &&
      t.amount < 0 &&
      isValid(parseISO(t.date)) && 
      isWithinInterval(parseISO(t.date), { start: displayPeriodStart, end: displayPeriodEnd })
    ).sort((a,b) => parseISO(b.date).getTime() - parseISO(a.date).getTime());

    const totalSpentForCategoryInPeriod = transactionsForCategoryInPeriod.reduce((sum, t) => sum + Math.abs(t.amount), 0);

    setSelectedCategoryDetails({
      categoryName,
      transactions: transactionsForCategoryInPeriod,
      totalSpent: totalSpentForCategoryInPeriod,
      limit: categoryLimitObj?.amountLimit
    });
    setIsCategoryDetailsOpen(true);
  };


  if (isLoading) {
    return <div className="flex justify-center items-center h-64"><p>Loading dashboard data...</p></div>;
  }

  return (
    <div className="flex flex-col gap-6">
      {defaultBudget && dashboardBudgetPeriods.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CalendarDays className="h-5 w-5 text-primary"/> Default Budget Periods: {defaultBudget.name}
            </CardTitle>
            <CardDescription>Select a period to view dashboard data for your default budget.</CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-auto max-h-40 whitespace-nowrap">
              <div className="flex gap-2 pb-2">
                {dashboardBudgetPeriods.map(period => (
                  <Button
                    key={period.startDate}
                    variant={selectedDashboardPeriod?.startDate === period.startDate ? "default" : "outline"}
                    onClick={() => setSelectedDashboardPeriod(period)}
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
      {!defaultBudget && !isLoading && (
        <Alert>
          <Target className="h-4 w-4" />
          <AlertTitle>No Default Budget Set</AlertTitle>
          <AlertDescription>
            Please set a default budget on the Budgets page to see period-specific data and charts here.
          </AlertDescription>
        </Alert>
      )}


      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Balance</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${totalBalance.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground">Across all accounts</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Income ({selectedPeriodLabel})</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {selectedDashboardPeriod ? `+$${periodIncome.toFixed(2)}` : 'N/A'}
            </div>
            <p className="text-xs text-muted-foreground">
              {selectedDashboardPeriod ? `For period: ${selectedDashboardPeriod.name}` : 'Select default budget & period'}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Expenses ({selectedPeriodLabel})</CardTitle>
            <TrendingDown className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
             {selectedDashboardPeriod ? `-$${periodExpenses.toFixed(2)}` : 'N/A'}
            </div>
            <p className="text-xs text-muted-foreground">
              {selectedDashboardPeriod ? `For period: ${selectedDashboardPeriod.name}` : 'Select default budget & period'}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <PieChartIcon className="h-5 w-5 mr-2 text-primary"/>
              Spending by Default Budget ({selectedPeriodLabel})
            </CardTitle>
            {!defaultBudget && <CardDescription className="mt-1">No default budget set. Please set one on the Budgets page.</CardDescription>}
            {defaultBudget && selectedDashboardPeriod && displayPeriodStart && displayPeriodEnd && (
              <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                <CalendarDays className="h-3 w-3"/>
                {format(displayPeriodStart, 'MMM dd, yyyy')} - {format(displayPeriodEnd, 'MMM dd, yyyy')}
              </p>
            )}
          </CardHeader>
          <CardContent>
            {defaultBudget && selectedDashboardPeriod ? (
              <SpendingChart data={spendingChartData} onCategoryClick={handleCategoryChartClick} />
            ) : (
              <p className="text-muted-foreground text-center py-10">
                {defaultBudget ? "Select a period to view spending." : "Set a default budget and select a period to view spending chart."}
              </p>
            )}
          </CardContent>
        </Card>
        <UnusualSpendingAlert transactionsInPeriod={transactionsInSelectedPeriod} accounts={accounts} periodLabel={selectedPeriodLabel} />
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Recent Transactions</CardTitle>
          <ListChecks className="h-5 w-5 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <RecentTransactions transactions={allTransactions} />
        </CardContent>
      </Card>
      <CategoryDetailsDialog
        isOpen={isCategoryDetailsOpen}
        onOpenChange={setIsCategoryDetailsOpen}
        details={selectedCategoryDetails}
        periodLabel={selectedPeriodLabel}
      />
        <style jsx global>{`
        .h-2 > div[role="progressbar"], .h-3 > div[role="progressbar"], .h-4 > div[role="progressbar"] {
          background-color: var(--progress-color) !important;
        }
      `}</style>
    </div>
  );
}
    
