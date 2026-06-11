
'use client';
import { Header } from '@/components/header';
import { useUser } from '@/firebase';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

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

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useUser();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.push('/');
    }
  }, [user, loading, router]);

  if (loading || !user) {
    return <DashboardLoading />;
  }

  return (
    <div className="flex flex-col h-screen">
      <Header />
      <main className="flex-1 p-4 sm:p-6 md:p-8 overflow-y-auto">{children}</main>
    </div>
  );
}

    