
"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DollarSign, TrendingUp, TrendingDown, ListChecks, Info, PieChart as PieChartIcon, Eye } from "lucide-react";
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import type { Transaction, Account, Budget, SpendingChartDataPoint, CategoryTransactionDetails } from "@/lib/types";
import { format, parseISO, startOfMonth, endOfMonth, isWithinInterval } from 'date-fns';
import { Button } from '@/components/ui/button';
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
import { detectUnusualSpending } from '@/ai/flows/detect-unusual-spending';
import type { DetectUnusualSpendingOutput } from '@/ai/flows/detect-unusual-spending';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { getAccounts, getTransactions, getBudgets } from '@/lib/actions';
import { ScrollArea } from '@/components/ui/scroll-area';

const CategoryDetailsDialog: React.FC<{
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  details: CategoryTransactionDetails | null;
}> = ({ isOpen, onOpenChange, details }) => {
  if (!details) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Transactions for: {details.categoryName}</DialogTitle>
          <DialogDescription>
            Total Spent: ${details.totalSpent.toFixed(2)}
            {details.limit !== undefined && ` / Limit: $${details.limit.toFixed(2)}`} (Current Month)
          </DialogDescription>
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
                <TableRow><TableCell colSpan={3} className="text-center">No transactions for this category this month.</TableCell></TableRow>
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
    return <p className="text-muted-foreground text-center py-10">No spending data available for the default budget this month.</p>;
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


const UnusualSpendingAlert: React.FC<{ transactions: Transaction[], accounts: Account[] }> = ({ transactions, accounts }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [aiResult, setAiResult] = useState<DetectUnusualSpendingOutput | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleDetectUnusualSpending = async () => {
    if (transactions.length === 0 || accounts.length === 0) {
      setError("Not enough data to analyze spending. Please add transactions and accounts.");
      return;
    }
    setIsLoading(true);
    setError(null);
    setAiResult(null);
    try {
      const firstAccount = accounts[0];
      const result = await detectUnusualSpending({
        transactionHistory: JSON.stringify(transactions.slice(0, 50)), // Limit history for performance
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
        <CardTitle className="text-sm font-medium">Unusual Spending Detection</CardTitle>
        <Info className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <Button onClick={handleDetectUnusualSpending} disabled={isLoading || transactions.length === 0} className="mb-4">
          {isLoading ? "Analyzing..." : "Check for Unusual Spending"}
        </Button>
        {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
        {aiResult && (
          <Alert variant={aiResult.unusualSpendingDetected ? "destructive" : "default"}>
            <AlertTitle>
              {aiResult.unusualSpendingDetected ? "Unusual Spending Detected!" : "No Unusual Spending Detected"}
            </AlertTitle>
            <AlertDescription>
              <p className="mb-2">{aiResult.explanation}</p>
              {aiResult.unusualSpendingDetected && <p><strong>Suggestions:</strong> {aiResult.suggestedActions}</p>}
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
};


export default function DashboardPage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [defaultBudget, setDefaultBudget] = useState<Budget | null>(null);
  const [spendingChartData, setSpendingChartData] = useState<SpendingChartDataPoint[]>([]);
  
  const [isCategoryDetailsOpen, setIsCategoryDetailsOpen] = useState(false);
  const [selectedCategoryDetails, setSelectedCategoryDetails] = useState<CategoryTransactionDetails | null>(null);

  const [totalBalance, setTotalBalance] = useState(0);
  const [monthlyIncome, setMonthlyIncome] = useState(0);
  const [monthlyExpenses, setMonthlyExpenses] = useState(0);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    const [dbAccounts, dbTransactions, dbBudgets] = await Promise.all([
      getAccounts(),
      getTransactions(),
      getBudgets()
    ]);
    setAccounts(dbAccounts);
    setTransactions(dbTransactions);
    setBudgets(dbBudgets);

    const foundDefaultBudget = dbBudgets.find(b => b.isDefault) || (dbBudgets.length > 0 ? dbBudgets[0] : null);
    setDefaultBudget(foundDefaultBudget);

    setIsLoading(false);
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    if (isLoading || !transactions.length) return;

    const currentMonthStart = startOfMonth(new Date());
    const currentMonthEnd = endOfMonth(new Date());

    const balance = accounts.reduce((sum, acc) => sum + acc.balance, 0);
    setTotalBalance(balance);
    
    const income = transactions
      .filter(t => {
        const tDate = parseISO(t.date);
        return t.amount > 0 && isWithinInterval(tDate, { start: currentMonthStart, end: currentMonthEnd });
      })
      .reduce((sum, t) => sum + t.amount, 0);
    setMonthlyIncome(income);

    const expenses = transactions
      .filter(t => {
        const tDate = parseISO(t.date);
        return t.amount < 0 && isWithinInterval(tDate, { start: currentMonthStart, end: currentMonthEnd });
      })
      .reduce((sum, t) => sum + Math.abs(t.amount), 0);
    setMonthlyExpenses(expenses);

    // Prepare data for SpendingChart based on default budget
    if (defaultBudget && defaultBudget.categories.length > 0) {
      const currentMonthTransactions = transactions.filter(t => {
        const tDate = parseISO(t.date);
        return isWithinInterval(tDate, { start: currentMonthStart, end: currentMonthEnd });
      });

      const newChartData = defaultBudget.categories.map(catLimit => {
        const spentInCat = currentMonthTransactions
          .filter(t => t.category === catLimit.category && t.amount < 0)
          .reduce((sum, t) => sum + Math.abs(t.amount), 0);
        return {
          name: catLimit.category,
          Spending: parseFloat(spentInCat.toFixed(2)),
          limit: catLimit.amountLimit,
        };
      });
      setSpendingChartData(newChartData);
    } else {
      setSpendingChartData([]); // Clear chart data if no default budget or no categories
    }

  }, [accounts, transactions, isLoading, defaultBudget]);

  const handleCategoryChartClick = (categoryName: string) => {
    if (!defaultBudget) return;

    const currentMonthStart = startOfMonth(new Date());
    const currentMonthEnd = endOfMonth(new Date());

    const categoryLimitObj = defaultBudget.categories.find(c => c.category === categoryName);

    const transactionsForCategory = transactions.filter(t => 
      t.category === categoryName && 
      t.amount < 0 && // Only expenses
      isWithinInterval(parseISO(t.date), { start: currentMonthStart, end: currentMonthEnd })
    ).sort((a,b) => parseISO(b.date).getTime() - parseISO(a.date).getTime());

    const totalSpentForCategory = transactionsForCategory.reduce((sum, t) => sum + Math.abs(t.amount), 0);
    
    setSelectedCategoryDetails({
      categoryName,
      transactions: transactionsForCategory,
      totalSpent: totalSpentForCategory,
      limit: categoryLimitObj?.amountLimit
    });
    setIsCategoryDetailsOpen(true);
  };


  if (isLoading) {
    return <div className="flex justify-center items-center h-64"><p>Loading dashboard data...</p></div>;
  }

  return (
    <div className="flex flex-col gap-6">
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
            <CardTitle className="text-sm font-medium">Monthly Income</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">+${monthlyIncome.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground">This month</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Monthly Expenses</CardTitle>
            <TrendingDown className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">-${monthlyExpenses.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground">This month</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <PieChartIcon className="h-5 w-5 mr-2 text-primary"/>
              Spending by Default Budget Category (Current Month)
            </CardTitle>
            {!defaultBudget && <CardDescription className="mt-1">No default budget set. Please set one on the Budgets page.</CardDescription>}
          </CardHeader>
          <CardContent>
            <SpendingChart data={spendingChartData} onCategoryClick={handleCategoryChartClick} />
          </CardContent>
        </Card>
        <UnusualSpendingAlert transactions={transactions} accounts={accounts} />
      </div>
      
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Recent Transactions</CardTitle>
          <ListChecks className="h-5 w-5 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <RecentTransactions transactions={transactions} />
        </CardContent>
      </Card>
      <CategoryDetailsDialog 
        isOpen={isCategoryDetailsOpen}
        onOpenChange={setIsCategoryDetailsOpen}
        details={selectedCategoryDetails}
      />
    </div>
  );
}

