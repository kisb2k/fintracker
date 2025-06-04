"use client";

import { usePathname } from 'next/navigation';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { User } from 'lucide-react';

const getPageTitle = (pathname: string): string => {
  if (pathname === '/') return 'Dashboard';
  const name = pathname.substring(1);
  return name.charAt(0).toUpperCase() + name.slice(1);
};

export function NavHeader() {
  const pathname = usePathname();
  const pageTitle = getPageTitle(pathname);

  return (
    <header className="sticky top-0 z-10 flex h-16 items-center gap-4 border-b bg-background px-4 md:px-6">
      <div className="md:hidden">
        <SidebarTrigger />
      </div>
      <div className="flex-1">
        <h1 className="text-lg font-semibold md:text-xl font-headline">{pageTitle}</h1>
      </div>
      <div className="flex items-center gap-4">
        {/* Placeholder for potential actions or search */}
        <Avatar>
          <AvatarImage src="https://placehold.co/40x40.png" alt="User Avatar" data-ai-hint="person avatar" />
          <AvatarFallback><User /></AvatarFallback>
        </Avatar>
      </div>
    </header>
  );
}
