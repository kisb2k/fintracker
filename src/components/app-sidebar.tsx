
"use client";

import React from 'react'; // Removed useState and useEffect
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

  // Removed mounted state and useEffect

  // The Sidebar component itself uses isMobile from context to switch between
  // desktop (div) and mobile (Sheet) rendering.
  // useIsMobile hook ensures isMobile is false on server and initial client render,
  // then updates to true on mobile clients after hydration.
  return (
    <Sidebar 
      collapsible={isMobile ? "offcanvas" : "icon"} 
      variant="sidebar" 
      side="left"
    >
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
                    state === 'collapsed' && !isMobile && 'justify-center' // Ensure justify-center only for collapsed desktop
                  )}
                >
                  <a>
                    <item.icon />
                    {/* Show label if expanded, or if mobile (offcanvas typically shows labels) */}
                    {(state === 'expanded' || isMobile) && <span>{item.label}</span>}
                  </a>
                </SidebarMenuButton>
              </Link>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarContent>
      <SidebarFooter className="p-4">
         {/* Show collapse button if expanded and not on mobile where it's handled by sheet overlay/trigger */}
        {state === 'expanded' && !isMobile && (
           <Button variant="ghost" className="w-full justify-start text-sidebar-foreground hover:bg-sidebar-accent" onClick={toggleSidebar}>
             <PanelLeft className="mr-2" /> Collapse
           </Button>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}

