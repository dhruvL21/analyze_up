
'use client';
import { Header } from '@/components/header';
import { useUser } from '@/firebase';
import { useRouter, usePathname } from 'next/navigation';
import { useEffect } from 'react';
import Link from 'next/link';
import { LayoutDashboard, Boxes, ShoppingCart, Truck, BarChart3 } from 'lucide-react';
import { cn } from '@/lib/utils';

function DashboardLoading() {
    return (
        <div className="flex flex-col h-screen">
         <div className="sticky top-0 z-20 flex h-16 w-full items-center justify-between gap-4 border-b bg-background/70 px-4 backdrop-blur-xl lg:px-6 animate-pulse">
            <div className="h-8 w-32 bg-secondary rounded-lg"></div>
            <div className="h-8 w-64 bg-secondary rounded-lg hidden md:block"></div>
            <div className="flex items-center gap-2">
                <div className="h-8 w-8 bg-secondary rounded-full"></div>
                <div className="h-8 w-8 bg-secondary rounded-full"></div>
                <div className="h-9 w-9 bg-secondary rounded-full"></div>
            </div>
         </div>
         <main className="flex-1 p-4 sm:p-6 md:p-8 bg-background overflow-auto">
         </main>
       </div>
    )
}

const bottomNavItems = [
  { href: '/dashboard', label: 'Home', icon: LayoutDashboard },
  { href: '/dashboard/inventory', label: 'Inventory', icon: Boxes },
  { href: '/dashboard/orders', label: 'Orders', icon: ShoppingCart },
  { href: '/dashboard/suppliers', label: 'Suppliers', icon: Truck },
  { href: '/dashboard/reports', label: 'Reports', icon: BarChart3 },
];

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useUser();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!loading && !user) {
      router.push('/');
    }
  }, [user, loading, router]);

  if (loading || !user) {
    return <DashboardLoading />;
  }

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      <Header />
      <main className="flex-1 p-4 sm:p-6 md:p-8 pb-20 md:pb-8 overflow-y-auto">{children}</main>

      {/* Mobile Bottom Navigation Bar */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 md:hidden flex h-16 items-center justify-around border-t border-border/40 bg-background/80 backdrop-blur-lg px-2 shadow-[0_-4px_16px_rgba(0,0,0,0.1)]">
        {bottomNavItems.map((item) => {
          const isActive = item.href === '/dashboard' 
            ? pathname === '/dashboard' 
            : pathname.startsWith(item.href);
          
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-col items-center justify-center flex-1 py-1.5 transition-all duration-200 text-muted-foreground hover:text-primary active:scale-95",
                isActive && "text-primary"
              )}
            >
              <item.icon className={cn("h-5 w-5 transition-transform duration-200", isActive && "scale-110")} />
              <span className="text-[10px] mt-1 font-medium select-none">{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}

    