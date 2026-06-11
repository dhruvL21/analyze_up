
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
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
import { signIn } from '@/firebase/auth/auth-service';
import { useAuth } from '@/firebase';
import { Loader2 } from 'lucide-react';
import { AnalyzeUpIcon } from '@/components/analyze-up-icon';

export default function LoginPage() {
  const router = useRouter();
  const { toast } = useToast();
  const auth = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth) return;
    setLoading(true);

    try {
      await signIn(auth, email, password);
      toast({
        title: 'Login Successful',
        description: "Welcome back!",
      });
      router.push('/dashboard');
    } catch (error: any) {
      let description = 'An unexpected error occurred.';
      if (error.code === 'auth/invalid-credential') {
        description = 'Invalid email or password. Please try again.';
      } else if (error.message) {
        description = error.message;
        console.error(error);
      }
      
      toast({
        variant: 'destructive',
        title: 'Login Failed',
        description: description,
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
          <CardDescription>Enter your credentials to access your account</CardDescription>
        </CardHeader>
        <form onSubmit={handleSignIn}>
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
            <div className="grid gap-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
          </CardContent>
          <CardFooter className="flex flex-col gap-4">
            <Button className="w-full" type="submit" disabled={loading} size="lg">
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Sign In
            </Button>
             <div className="text-center text-sm">
                <Link href="/forgot-password" passHref>
                    <Button variant="link" className="text-muted-foreground">Forgot your password?</Button>
                </Link>
            </div>
          </CardFooter>
        </form>
         <p className="mt-4 px-6 pb-6 text-center text-sm">
            Don&apos;t have an account?&nbsp;
            <Link href="/register" passHref>
                <Button variant="link">Sign up</Button>
            </Link>
        </p>
      </Card>
    </div>
  );
}
