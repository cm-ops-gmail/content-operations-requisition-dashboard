
'use client';

import Link from 'next/link';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from '@/components/ui/sheet';
import { Menu, LogIn, LogOut } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';

export default function Header() {
  const { user, isMounted, logout } = useAuth();
  
  const publicLinks = [
    { href: '/', label: 'Home' },
  ];

  const userLinks = [
    { href: '/', label: 'Dashboard' },
    { href: '/admin', label: 'Admin Panel' },
  ];

  const linksToShow = user ? userLinks : publicLinks;

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto flex h-16 max-w-7xl items-center justify-between px-4 md:px-6">
        <Link href="/" className="flex items-center gap-2 font-bold text-lg">
          <Image src="/logo.png" alt="Content Operations Logo" width="120" height="120" />
          <span className="hidden sm:inline-block">Requisition Form Dashboard</span>
        </Link>
        
        <div className="flex items-center gap-4">
            <nav className="hidden md:flex items-center gap-6 text-sm font-medium">
            {linksToShow.map((link) => (
                <Link key={link.href} href={link.href} className="transition-colors hover:text-foreground/80 text-foreground/60">
                {link.label}
                </Link>
            ))}
            </nav>

          {isMounted && (
            user ? (
              <>
                <Button onClick={logout} variant="outline" size="sm" className="hidden md:flex">
                    <LogOut className="mr-2 h-4 w-4" />
                    Logout
                </Button>
              </>
            ) : (
              <>
                <Button asChild>
                  <Link href="/tickets/new">Create New Ticket</Link>
                </Button>
                <Button asChild variant="outline">
                  <Link href="/login">
                    <LogIn className="mr-2 h-4 w-4" />
                    Admin Login
                  </Link>
                </Button>
              </>
            )
          )}


          <Sheet>
            <SheetTrigger asChild>
              <Button variant="outline" size="icon" className="md:hidden">
                <Menu className="h-5 w-5" />
                <span className="sr-only">Toggle navigation menu</span>
              </Button>
            </SheetTrigger>
            <SheetContent side="right">
              <SheetTitle className="sr-only">Mobile Menu</SheetTitle>
              <div className="flex h-full flex-col">
                <div className="flex-1">
                  <Link href="/" className="flex items-center gap-2 text-lg font-semibold mb-4 border-b pb-4">
                      <Image src="/logo.png" alt="Content Operations Logo" width="35" height="35" />
                      <span>10MS OPS PMS</span>
                  </Link>
                  <nav className="grid gap-6 text-lg font-medium mt-8">
                    {linksToShow.map((link) => (
                        <Link key={link.href} href={link.href} className="text-muted-foreground hover:text-foreground">
                        {link.label}
                        </Link>
                    ))}
                  </nav>
                </div>
                <div className="mt-auto p-4 space-y-4 border-t">
                   <Button asChild className="w-full">
                     <Link href="/tickets/new">Create New Ticket</Link>
                   </Button>
                   {isMounted && (
                      user ? (
                        <Button onClick={logout} variant="outline" className="w-full">
                            <LogOut className="mr-2 h-4 w-4" />
                            Logout
                        </Button>
                      ) : (
                        <Button asChild variant="outline" className="w-full">
                          <Link href="/login">
                            <LogIn className="mr-2 h-4 w-4" />
                            Admin Login
                          </Link>
                        </Button>
                      )
                   )}
                </div>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}
