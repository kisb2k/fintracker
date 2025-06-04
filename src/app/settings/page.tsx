"use client";

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download, Moon, Sun, Palette } from 'lucide-react';
import { mockTransactions } from '@/lib/mock-data'; // For dummy export
import type { Transaction } from '@/lib/types';
import { useToast } from "@/hooks/use-toast";
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';

// Helper to convert array of objects to CSV string
const convertToCSV = (data: Transaction[]): string => {
  if (!data || data.length === 0) {
    return "";
  }
  const headers = Object.keys(data[0]).join(',');
  const rows = data.map(row => 
    Object.values(row).map(value => 
      typeof value === 'string' ? `"${value.replace(/"/g, '""')}"` : value
    ).join(',')
  );
  return [headers, ...rows].join('\n');
};

export default function SettingsPage() {
  const { toast } = useToast();
  const [isDarkMode, setIsDarkMode] = useState(false); // Local state for demo

  const handleExportData = () => {
    const csvData = convertToCSV(mockTransactions);
    const blob = new Blob([csvData], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    if (link.download !== undefined) {
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', 'fintrack_transactions.csv');
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast({ title: "Data Exported", description: "Your transaction data has been downloaded as CSV." });
    } else {
       toast({ title: "Export Failed", description: "Your browser does not support this feature.", variant: "destructive"});
    }
  };

  const toggleTheme = () => {
    // In a real app, this would persist to localStorage/context and update <html> class
    setIsDarkMode(prev => !prev); 
    document.documentElement.classList.toggle('dark', !isDarkMode);
    toast({ title: "Theme Changed", description: `Switched to ${!isDarkMode ? 'Dark' : 'Light'} Mode.` });
  };

  return (
    <div className="space-y-8 max-w-2xl mx-auto">
      <Card>
        <CardHeader>
          <CardTitle className="font-headline text-xl">Data Export</CardTitle>
          <CardDescription>Export your financial data for offline use or backup.</CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={handleExportData}>
            <Download className="mr-2 h-4 w-4" /> Export Transaction Data (CSV)
          </Button>
           <p className="text-sm text-muted-foreground mt-2">
            This will download all your transaction history in CSV format.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="font-headline text-xl">Appearance</CardTitle>
          <CardDescription>Customize the look and feel of FinTrack.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between p-3 border rounded-md">
            <div className="flex items-center">
              {isDarkMode ? <Moon className="mr-3 h-5 w-5 text-primary" /> : <Sun className="mr-3 h-5 w-5 text-primary" />}
              <Label htmlFor="theme-toggle" className="text-base">Dark Mode</Label>
            </div>
            <Switch
              id="theme-toggle"
              checked={isDarkMode}
              onCheckedChange={toggleTheme}
            />
          </div>
           {/* Placeholder for more theme options */}
           <div className="flex items-center justify-between p-3 border rounded-md opacity-50 cursor-not-allowed">
            <div className="flex items-center">
                <Palette className="mr-3 h-5 w-5 text-muted-foreground" />
                <Label htmlFor="theme-color" className="text-base text-muted-foreground">Primary Color</Label>
            </div>
            <div className="w-8 h-8 rounded-full bg-primary border-2 border-primary-foreground shadow-md"></div>
            {/* <Button variant="outline" size="sm" disabled>Change</Button> */}
          </div>
          <p className="text-xs text-muted-foreground">
            More theme customization options coming soon.
          </p>
        </CardContent>
      </Card>

       <Card>
        <CardHeader>
          <CardTitle className="font-headline text-xl">AI Settings</CardTitle>
          <CardDescription>Manage preferences for AI-powered insights.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between p-3 border rounded-md">
            <Label htmlFor="ai-categorization" className="text-base">Enable Smart Categorization</Label>
            <Switch id="ai-categorization" defaultChecked />
          </div>
          <div className="flex items-center justify-between p-3 border rounded-md">
            <Label htmlFor="ai-tax-deduction" className="text-base">Enable Tax Deduction Alerts</Label>
            <Switch id="ai-tax-deduction" defaultChecked />
          </div>
          <div className="flex items-center justify-between p-3 border rounded-md">
            <Label htmlFor="ai-spending-alerts" className="text-base">Enable Unusual Spending Alerts</Label>
            <Switch id="ai-spending-alerts" defaultChecked />
          </div>
           <p className="text-sm text-muted-foreground mt-2">
            Adjust how AI assists you in managing your finances. These settings apply to new analyses.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
