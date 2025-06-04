"use client";

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DollarSign, TrendingUp, TrendingDown, ListChecks, Info } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { mockAccounts, mockTransactions, mockBudgets } from "@/lib/mock-data";
import type { Transaction } from "@/lib/types";
import { format } from 'date-fns';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import { detectUnusualSpending } from '@/ai/flows/detect-unusual-spending';
import type { DetectUnusualSpendingOutput } from '@/ai/flows/detect-unusual-spending';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

const SpendingChart = () => {
  const [chartData, setChartData] = useState<any[]>([]);

  useEffect(() => {
    const spendingByCategory = mockTransactions
      .filter(t => t.amount < 0)
      .reduce((acc, transaction) => {
        const category = transaction.category || 'Uncategorized';
        acc[category] = (acc[category] || 0) + Math.abs(transaction.amount);
        return acc;
      }, {} as Record<string, number>);

    const formattedData = Object.entries(spendingByCategory).map(([name, value]) => ({
      name,
      Spending: parseFloat(value.toFixed(2)),
    }));
    setChartData(formattedData);
  }, []);
  
  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#82Ca9D'];

  if (chartData.length === 0) {
    return <p className="text-muted-foreground">No spending data available for chart.</p>;
  }

  return (
    <ResponsiveContainer width="100%" height={300}>
      <PieChart>
        <Pie
          data={chartData}
          cx="50%"
          cy="50%"
          labelLine={false}
          outerRadius={100}
          fill="#8884d8"
          dataKey="Spending"
          nameKey="name"
          label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
        >
          {chartData.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
          ))}
        </Pie>
        <Tooltip formatter={(value: number) => `$${value.toFixed(2)}`} />
        <Legend />
      </PieChart>
    </ResponsiveContainer>
  );
};


const RecentTransactions = () => {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  useEffect(() => {
    setTransactions(mockTransactions.slice(0, 5));
  }, []);

  if(transactions.length === 0) {
    return <p className="text-muted-foreground">No recent transactions.</p>;
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
        {transactions.map((transaction) => (
          <TableRow key={transaction.id}>
            <TableCell>{format(new Date(transaction.date), 'MMM dd, yyyy')}</TableCell>
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


const UnusualSpendingAlert: React.FC = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [aiResult, setAiResult] = useState<DetectUnusualSpendingOutput | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleDetectUnusualSpending = async () => {
    setIsLoading(true);
    setError(null);
    setAiResult(null);
    try {
      const result = await detectUnusualSpending({
        transactionHistory: JSON.stringify(mockTransactions),
        // Pick first account for simplicity
        accountId: mockAccounts[0]?.id || 'N/A',
        accountType: mockAccounts[0]?.type || 'N/A',
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
        <Button onClick={handleDetectUnusualSpending} disabled={isLoading} className="mb-4">
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
  const [totalBalance, setTotalBalance] = useState(0);
  const [monthlyIncome, setMonthlyIncome] = useState(0);
  const [monthlyExpenses, setMonthlyExpenses] = useState(0);

  useEffect(() => {
    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();

    const balance = mockAccounts.reduce((sum, acc) => sum + acc.balance, 0);
    setTotalBalance(balance);
    
    const income = mockTransactions
      .filter(t => {
        const tDate = new Date(t.date);
        return t.amount > 0 && tDate.getMonth() === currentMonth && tDate.getFullYear() === currentYear;
      })
      .reduce((sum, t) => sum + t.amount, 0);
    setMonthlyIncome(income);

    const expenses = mockTransactions
      .filter(t => {
        const tDate = new Date(t.date);
        return t.amount < 0 && tDate.getMonth() === currentMonth && tDate.getFullYear() === currentYear;
      })
      .reduce((sum, t) => sum + Math.abs(t.amount), 0);
    setMonthlyExpenses(expenses);
  }, []);

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
            <CardTitle>Spending by Category</CardTitle>
          </CardHeader>
          <CardContent>
            <SpendingChart />
          </CardContent>
        </Card>
        <UnusualSpendingAlert />
      </div>
      
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Recent Transactions</CardTitle>
          <ListChecks className="h-5 w-5 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <RecentTransactions />
        </CardContent>
      </Card>
    </div>
  );
}
