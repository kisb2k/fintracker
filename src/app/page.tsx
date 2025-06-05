
"use client";

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { DollarSign, TrendingUp, TrendingDown, ListChecks, Info, PieChart as PieChartIcon, Eye, CalendarDays } from "lucide-react";
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import type { Transaction, Account, Budget, SpendingChartDataPoint, CategoryTransactionDetails } from "@/lib/types";
import { format, parseISO, startOfMonth, endOfMonth, isWithinInterval, subMonths, subDays, startOfDay, endOfDay } from 'date-fns';
import { Button } from '@/components/ui/button';
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
  DialogDescription as RHFDialogDescription, // Renamed to avoid conflict
  DialogFooter,
  DialogTrigger,
  DialogClose,
} from "@/components/ui/dialog";
import { detectUnusualSpending } from '@/ai/flows/detect-unusual-spending';
import type { DetectUnusualSpendingOutput } from '@/ai/flows/detect-unusual-spending';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { getAccounts, getTransactions, getBudgets } from '@/lib/actions';
import { ScrollArea } from '@/components/ui/scroll-area';

const periodOptions = [
  { key: 'currentMonth', label: 'Current Month' },
  { key: 'lastMonth', label: 'Last Month' },
  { key: 'last30Days', label: 'Last 30 Days' },
];

const getPeriodDates = (periodKey: string): { start: Date, end: Date } => {
  const now = new Date();
  switch (periodKey) {
    case 'lastMonth':
      const lastMonthStart = startOfMonth(subMonths(now, 1));
      const lastMonthEnd = endOfMonth(subMonths(now, 1));
      return { start: lastMonthStart, end: lastMonthEnd };
    case 'last30Days':
      const thirtyDaysAgo = startOfDay(subDays(now, 29)); // 29 to include today as 30th day
      return { start: thirtyDaysAgo, end: endOfDay(now) };
    case 'currentMonth':
    default:
      const currentMonthStart = startOfMonth(now);
      const currentMonthEnd = endOfMonth(now);
      return { start: currentMonthStart, end: currentMonthEnd };
  }
};


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
          label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
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
      setRecentTransactions(transactions.slice(0, 5));
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
    if (transactionsInPeriod.length === 0 || accounts.length === 0) {
      setError(`Not enough data for ${periodLabel} to analyze spending. Please add transactions and accounts.`);
      return;
    }
    setIsLoading(true);
    setError(null);
    setAiResult(null);
    try {
      const firstAccount = accounts[0]; // AI flow takes one account for context, though history can be mixed
      const result = await detectUnusualSpending({
        transactionHistory: JSON.stringify(transactionsInPeriod.slice(0, 100)), // Limit history for performance
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
      </CardContent>
    </Card>
  );
};


export default function DashboardPage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [allTransactions, setAllTransactions] = useState<Transaction[]>([]); // All transactions from DB
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [defaultBudget, setDefaultBudget] = useState<Budget | null>(null);
  const [spendingChartData, setSpendingChartData] = useState<SpendingChartDataPoint[]>([]);
  
  const [isCategoryDetailsOpen, setIsCategoryDetailsOpen] = useState(false);
  const [selectedCategoryDetails, setSelectedCategoryDetails] = useState<CategoryTransactionDetails | null>(null);

  const [totalBalance, setTotalBalance] = useState(0); // This remains overall balance
  const [periodIncome, setPeriodIncome] = useState(0);
  const [periodExpenses, setPeriodExpenses] = useState(0);

  const [selectedPeriodKey, setSelectedPeriodKey] = useState<string>('currentMonth');
  const [displayPeriodStart, setDisplayPeriodStart] = useState<Date>(startOfMonth(new Date()));
  const [displayPeriodEnd, setDisplayPeriodEnd] = useState<Date>(endOfMonth(new Date()));
  
  const selectedPeriodLabel = useMemo(() => {
    return periodOptions.find(p => p.key === selectedPeriodKey)?.label || "Selected Period";
  }, [selectedPeriodKey]);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    const [dbAccounts, dbTransactions, dbBudgets] = await Promise.all([
      getAccounts(),
      getTransactions(),
      getBudgets()
    ]);
    setAccounts(dbAccounts);
    setAllTransactions(dbTransactions);
    setBudgets(dbBudgets);

    const foundDefaultBudget = dbBudgets.find(b => b.isDefault) || (dbBudgets.length > 0 ? dbBudgets[0] : null);
    setDefaultBudget(foundDefaultBudget);

    setIsLoading(false);
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    const { start, end } = getPeriodDates(selectedPeriodKey);
    setDisplayPeriodStart(start);
    setDisplayPeriodEnd(end);
  }, [selectedPeriodKey]);

  const transactionsInSelectedPeriod = useMemo(() => {
    if (isLoading || !allTransactions.length) return [];
    return allTransactions.filter(t => {
      const tDate = parseISO(t.date);
      return isWithinInterval(tDate, { start: displayPeriodStart, end: displayPeriodEnd });
    });
  }, [allTransactions, isLoading, displayPeriodStart, displayPeriodEnd]);


  useEffect(() => {
    if (isLoading) return; // Ensure data is loaded before calculations

    // Total balance is always across all accounts, irrespective of period
    const balance = accounts.reduce((sum, acc) => sum + acc.balance, 0);
    setTotalBalance(balance);
    
    // Income and expenses are for the selected period
    const income = transactionsInSelectedPeriod
      .filter(t => t.amount > 0)
      .reduce((sum, t) => sum + t.amount, 0);
    setPeriodIncome(income);

    const expenses = transactionsInSelectedPeriod
      .filter(t => t.amount < 0)
      .reduce((sum, t) => sum + Math.abs(t.amount), 0);
    setPeriodExpenses(expenses);

    // Prepare data for SpendingChart based on default budget AND selected period
    if (defaultBudget && defaultBudget.categories.length > 0) {
      const newChartData = defaultBudget.categories.map(catLimit => {
        const spentInCat = transactionsInSelectedPeriod
          .filter(t => t.category === catLimit.category && t.amount < 0)
          .reduce((sum, t) => sum + Math.abs(t.amount), 0);
        return {
          name: catLimit.category,
          Spending: parseFloat(spentInCat.toFixed(2)),
          limit: catLimit.amountLimit, // The limit itself doesn't change with period
        };
      });
      setSpendingChartData(newChartData);
    } else {
      setSpendingChartData([]); // Clear chart data if no default budget or no categories
    }

  }, [accounts, transactionsInSelectedPeriod, isLoading, defaultBudget, displayPeriodStart, displayPeriodEnd]);

  const handleCategoryChartClick = (categoryName: string) => {
    if (!defaultBudget) return;

    const categoryLimitObj = defaultBudget.categories.find(c => c.category === categoryName);

    const transactionsForCategoryInPeriod = transactionsInSelectedPeriod.filter(t => 
      t.category === categoryName && 
      t.amount < 0 // Only expenses
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
      <div className="flex justify-end">
        <Select value={selectedPeriodKey} onValueChange={setSelectedPeriodKey}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Select period" />
          </SelectTrigger>
          <SelectContent>
            {periodOptions.map(option => (
              <SelectItem key={option.key} value={option.key}>{option.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

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
            <div className="text-2xl font-bold text-green-600">+${periodIncome.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground">For selected period</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Expenses ({selectedPeriodLabel})</CardTitle>
            <TrendingDown className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">-${periodExpenses.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground">For selected period</p>
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
             {defaultBudget && displayPeriodStart && displayPeriodEnd && (
              <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                <CalendarDays className="h-3 w-3"/>
                {format(displayPeriodStart, 'MMM dd, yyyy')} - {format(displayPeriodEnd, 'MMM dd, yyyy')}
              </p>
            )}
          </CardHeader>
          <CardContent>
            <SpendingChart data={spendingChartData} onCategoryClick={handleCategoryChartClick} />
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
    </div>
  );
}


    