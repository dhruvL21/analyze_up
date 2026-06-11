
'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import Link from 'next/link';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/firebase';
import { resetPassword } from '@/firebase/auth/auth-service';
import { Loader2 } from 'lucide-react';
import { AnalyzeUpIcon } from '@/components/analyze-up-icon';

export default function ForgotPasswordPage() {
  const { toast } = useToast();
  const auth = useAuth();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handlePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth) return;
    setLoading(true);

    try {
      await resetPassword(auth, email);
      setSubmitted(true);
    } catch (error: any) {
      console.error(error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message || 'Failed to send password reset email.',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-background p-4">
      <Card className="w-full max-w-sm ios-glass rounded-2xl">
        <CardHeader className="text-center">
            <div className='flex justify-center items-center mb-4'>
                 <AnalyzeUpIcon className="h-8 w-8 text-primary" />
                <CardTitle className='ml-2 text-3xl'>AnalyzeUp</CardTitle>
            </div>
          <CardDescription>
            {submitted
              ? 'Check your inbox for a password reset link.'
              : 'Enter your email to reset your password.'}
          </CardDescription>
        </CardHeader>
        {!submitted ? (
          <form onSubmit={handlePasswordReset}>
            <CardContent className="grid gap-4">
              <div className="grid gap-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="m@example.com"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
            </CardContent>
            <CardFooter className="flex flex-col gap-4">
              <Button className="w-full" type="submit" disabled={loading} size="lg">
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Send Reset Link
              </Button>
            </CardFooter>
          </form>
        ) : (
             <CardContent>
                <p className='text-center text-muted-foreground'>If you don&apos;t see the email, please check your spam folder.</p>
            </CardContent>
        )}
        <p className="mt-4 px-6 pb-6 text-center text-sm">
          Remember your password?&nbsp;
          <Link href="/login" passHref>
             <Button variant="link">Sign in</Button>
          </Link>
        </p>
      </Card>
    </div>
  );
}
