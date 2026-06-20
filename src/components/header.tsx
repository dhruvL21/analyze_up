
'use client';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { useRouter, usePathname } from 'next/navigation';
import { useState } from 'react';
import { LogOut, Settings, Menu, Sun, Moon, X, LayoutDashboard, Boxes, ShoppingCart, Truck, BarChart3, PieChart } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import Nav from './nav';
import Link from 'next/link';
import { AnalyzeUpIcon } from './analyze-up-icon';
import { useUser, useAuth } from '@/firebase';
import { signOut } from '@/firebase/auth/auth-service';
import { useTheme } from 'next-themes';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';

const mobileNavItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/dashboard/inventory', label: 'Inventory', icon: Boxes },
  { href: '/dashboard/orders', label: 'Orders', icon: ShoppingCart },
  { href: '/dashboard/suppliers', label: 'Suppliers', icon: Truck },
  { href: '/dashboard/reports', label: 'Reports', icon: BarChart3 },
  { href: '/dashboard/reports/visualizer', label: 'Visualizer', icon: PieChart },
];

const containerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.04,
      delayChildren: 0.05,
    }
  }
};

const itemVariants = {
  hidden: { opacity: 0, y: -12, scale: 0.95 },
  show: { 
    opacity: 1, 
    y: 0,
    scale: 1,
    transition: {
      type: "spring",
      stiffness: 300,
      damping: 24
    }
  }
};

export function Header() {
  const router = useRouter();
  const pathname = usePathname();
  const { user } = useUser();
  const auth = useAuth();
  const { theme, setTheme } = useTheme();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const handleLogout = async () => {
    if (auth) {
      await signOut(auth);
      router.push('/');
    }
  };

  return (
    <header className="sticky top-0 z-20 flex h-16 w-full items-center justify-between gap-2 px-4 lg:px-6 navbar">
      <div className="flex flex-shrink-0 items-center gap-2 font-semibold">
        <Link href="/dashboard" className="flex items-center gap-2">
          <AnalyzeUpIcon className="h-6 w-6 text-primary" />
          <span className="text-xl font-semibold">AnalyzeUp</span>
        </Link>
      </div>

      <div className="hidden flex-1 justify-center md:flex">
        <Nav />
      </div>

      <div className="flex flex-shrink-0 items-center justify-end gap-1">
        <TooltipProvider>
          {/* Theme Toggle - Desktop Only */}
          <div className="hidden md:block">
            <Tooltip>
              <TooltipTrigger asChild>
                  <Button 
                      variant="ghost" 
                      size="icon" 
                      className='rounded-full' 
                      onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
                  >
                      <Sun className="h-[1.2rem] w-[1.2rem] rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
                      <Moon className="absolute h-[1.2rem] w-[1.2rem] rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
                      <span className="sr-only">Toggle theme</span>
                  </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Toggle Theme</p>
              </TooltipContent>
            </Tooltip>
          </div>

          {/* Settings - Desktop Only */}
          <div className="hidden md:block">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className='rounded-full'
                  onClick={() => router.push('/dashboard/settings')}
                >
                  <Settings className="h-5 w-5" />
                  <span className="sr-only">Settings</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Settings</p>
              </TooltipContent>
            </Tooltip>
          </div>

          {/* Settings Dropdown - Mobile Only */}
          <div className="md:hidden">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="rounded-full"
                >
                  <Settings className="h-5 w-5" />
                  <span className="sr-only">Settings Menu</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52 ios-glass">
                <DropdownMenuItem onClick={() => router.push('/dashboard/settings')} className="cursor-pointer">
                  <Settings className="mr-2 h-4 w-4" />
                  Account Settings
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')} className="cursor-pointer">
                  {theme === 'light' ? (
                    <>
                      <Moon className="mr-2 h-4 w-4" />
                      Dark Mode
                    </>
                  ) : (
                    <>
                      <Sun className="mr-2 h-4 w-4" />
                      Light Mode
                    </>
                  )}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleLogout} className="text-destructive cursor-pointer">
                  <LogOut className="mr-2 h-4 w-4" />
                  Log Out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Log out - Desktop Only */}
          <div className="hidden md:block">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className='rounded-full' onClick={handleLogout}>
                  <LogOut className="h-5 w-5" />
                  <span className="sr-only">Log out</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Log out</p>
              </TooltipContent>
            </Tooltip>
          </div>
        </TooltipProvider>
        <Button variant="ghost" className="relative h-9 w-9 rounded-full">
          <Avatar className="h-9 w-9">
            <AvatarImage
              src={user?.photoURL || ''}
              alt="User avatar"
            />
            <AvatarFallback>{user?.displayName?.charAt(0) || user?.email?.charAt(0) || 'U'}</AvatarFallback>
          </Avatar>
        </Button>

        {/* Mobile Hamburger Menu Icon - Far Right */}
        <div className="md:hidden flex items-center">
          <Button
            variant="ghost"
            size="icon"
            className="rounded-full h-9 w-9 relative z-30"
            onClick={() => setIsMenuOpen(!isMenuOpen)}
          >
            <motion.div
              animate={{ rotate: isMenuOpen ? 90 : 0 }}
              transition={{ type: "spring", stiffness: 300, damping: 20 }}
              className="flex items-center justify-center"
            >
              {isMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </motion.div>
          </Button>
        </div>
      </div>

      {/* Mobile Navigation Dropdown Overlay */}
      <AnimatePresence>
        {isMenuOpen && (
          <>
            {/* Backdrop blur */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={() => setIsMenuOpen(false)}
              className="fixed inset-0 top-16 bg-black/40 backdrop-blur-sm z-30 md:hidden"
            />

            {/* Slide Down Menu Content */}
            <motion.div
              initial={{ opacity: 0, y: -20, height: 0 }}
              animate={{ opacity: 1, y: 0, height: 'auto' }}
              exit={{ opacity: 0, y: -20, height: 0 }}
              transition={{ type: 'spring', stiffness: 260, damping: 26 }}
              className="absolute top-16 left-0 right-0 z-40 bg-background/95 backdrop-blur-xl border-b border-border shadow-2xl p-6 md:hidden overflow-hidden flex flex-col gap-4 rounded-b-2xl"
            >
              <motion.div
                variants={containerVariants}
                initial="hidden"
                animate="show"
                className="flex flex-col gap-2.5"
              >
                <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider px-3 mb-1">
                  Navigation Menu
                </div>
                {mobileNavItems.map((item) => {
                  const isActive = item.href === '/dashboard' 
                    ? pathname === '/dashboard' 
                    : item.href === '/dashboard/reports'
                      ? pathname.startsWith('/dashboard/reports') && !pathname.startsWith('/dashboard/reports/visualizer')
                      : pathname.startsWith(item.href);

                  return (
                    <motion.div key={item.href} variants={itemVariants}>
                      <Link
                        href={item.href}
                        onClick={() => setIsMenuOpen(false)}
                        className={cn(
                          "flex items-center gap-3.5 rounded-xl px-4 py-3 text-base font-medium transition-all duration-200 relative border border-border/20 shadow-sm",
                          isActive 
                            ? "bg-primary/10 text-primary border-primary/20" 
                            : "text-muted-foreground hover:text-foreground bg-secondary/20 hover:bg-secondary/40"
                        )}
                      >
                        <item.icon className="h-5 w-5" />
                        {item.label}
                      </Link>
                    </motion.div>
                  );
                })}
              </motion.div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </header>
  );
}
