
'use client';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { useRouter } from 'next/navigation';
import { LogOut, Settings, Menu, Sun, Moon } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import Nav from './nav';
import Link from 'next/link';
import { AnalyzeUpIcon } from './analyze-up-icon';
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from './ui/sheet';
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


export function Header() {
  const router = useRouter();
  const { user } = useUser();
  const auth = useAuth();
  const { theme, setTheme } = useTheme();


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
      </div>
    </header>
  );
}
