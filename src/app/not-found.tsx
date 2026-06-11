
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { TriangleAlert } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-background text-foreground">
      <div className="text-center space-y-4">
        <TriangleAlert className="mx-auto h-16 w-16 text-destructive" />
        <h1 className="text-6xl font-bold">404</h1>
        <p className="text-xl text-muted-foreground">
          Oops! The page you're looking for could not be found.
        </p>
        <p className="text-sm text-muted-foreground">
          It might have been moved or deleted.
        </p>
        <Button asChild>
          <Link href="/dashboard">Return to Dashboard</Link>
        </Button>
      </div>
    </div>
  );
}
