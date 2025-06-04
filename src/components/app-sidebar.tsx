
"use client";

import React, { useState, useEffect } from 'react'; // Added useState and useEffect
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Banknote,
  LayoutDashboard,
  ListChecks,
  Target,
  Landmark,
  Settings,
  PanelLeft,
} from 'lucide-react';
import {
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarFooter,
  useSidebar,
} from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const navItems = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/transactions', label: 'Transactions', icon: ListChecks },
  { href: '/budgets', label: 'Budgets', icon: Target },
  { href: '/accounts', label: 'Accounts', icon: Landmark },
  { href: '/settings', label: 'Settings', icon: Settings },
];

export function AppSidebar() {
  const pathname = usePathname();
  const { state, toggleSidebar, isMobile } = useSidebar();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    // Render a layout consistent with the server's initial render (isMobile=false)
    // This ensures the first client render matches the server output.
    // `collapsible="icon"` is what the server would derive since `isMobile` from `useIsMobile` is initially `false`.
    // The `Sidebar` component itself will also get `isMobile=false` from context initially.
    return (
      <Sidebar collapsible="icon" variant="sidebar" side="left">
        <SidebarHeader className="p-4">
          <div className="flex items-center gap-2">
            <Banknote className="h-8 w-8 text-sidebar-primary" />
            {/* Show title if sidebar is expanded or not yet mounted (to match server state if defaultOpen is true) */}
            {state === 'expanded' && (
              <h1 className="text-xl font-semibold text-sidebar-foreground">FinTrack</h1>
            )}
          </div>
        </SidebarHeader>
        <SidebarContent>
          <SidebarMenu>
            {navItems.map((item) => (
              <SidebarMenuItem key={item.href}>
                <Link href={item.href} passHref legacyBehavior>
                  <SidebarMenuButton
                    asChild
                    isActive={pathname === item.href}
                    tooltip={item.label}
                    className={cn(
                      "justify-start",
                       // Apply collapsed style if sidebar state is collapsed
                      state === 'collapsed' && 'justify-center'
                    )}
                  >
                    <a>
                      <item.icon />
                       {/* Show label if sidebar is expanded */}
                      {state === 'expanded' && <span>{item.label}</span>}
                    </a>
                  </SidebarMenuButton>
                </Link>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarContent>
        <SidebarFooter className="p-4">
          {state === 'expanded' && (
             <Button variant="ghost" className="w-full justify-start text-sidebar-foreground hover:bg-sidebar-accent" onClick={toggleSidebar}>
               <PanelLeft className="mr-2" /> Collapse
             </Button>
          )}
        </SidebarFooter>
      </Sidebar>
    );
  }

  // After mounting, `isMobile` reflects the true client environment.
  return (
    <Sidebar collapsible={isMobile ? "offcanvas" : "icon"} variant="sidebar" side="left">
      <SidebarHeader className="p-4">
        <div className="flex items-center gap-2">
          <Banknote className="h-8 w-8 text-sidebar-primary" />
          {state === 'expanded' && (
            <h1 className="text-xl font-semibold text-sidebar-foreground">FinTrack</h1>
          )}
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarMenu>
          {navItems.map((item) => (
            <SidebarMenuItem key={item.href}>
              <Link href={item.href} passHref legacyBehavior>
                <SidebarMenuButton
                  asChild
                  isActive={pathname === item.href}
                  tooltip={item.label}
                  className={cn(
                    "justify-start",
                    state === 'collapsed' && 'justify-center'
                  )}
                >
                  <a>
                    <item.icon />
                    {state === 'expanded' && <span>{item.label}</span>}
                  </a>
                </SidebarMenuButton>
              </Link>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarContent>
      <SidebarFooter className="p-4">
        {state === 'expanded' && (
           <Button variant="ghost" className="w-full justify-start text-sidebar-foreground hover:bg-sidebar-accent" onClick={toggleSidebar}>
             <PanelLeft className="mr-2" /> Collapse
           </Button>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}
