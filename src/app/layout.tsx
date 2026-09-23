import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { Toaster } from '@/components/ui/toaster';
import { ThemeProvider } from '@/components/theme-provider';
import { DataProvider } from '@/context/data-context';
import ClientOnly from '@/components/ClientOnly';
import { FirebaseClientProvider } from '@/firebase/client-provider';
import { FirebaseErrorListener } from '@/components/FirebaseErrorListener';

const inter = Inter({ subsets: ['latin'], variable: '--font-sans' });

export const metadata: Metadata = {
  title: 'AnalyzeUp',
  description: 'A modern inventory management platform for growing businesses.',
  verification: {
    google: 'Kme1cRKkJTNrqxNoLJLwMRA-33kdA1SSWhW8WcPuEwU',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full dark" style={{ colorScheme: 'dark' }} suppressHydrationWarning>
      <head>
        <meta name="google-site-verification" content="Kme1cRKkJTNrqxNoLJLwMRA-33kdA1SSWhW8WcPuEwU" />
      </head>
      <body className={`${inter.variable} font-sans antialiased h-full bg-background dark`} suppressHydrationWarning>
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          forcedTheme="dark"
          enableSystem={false}
          disableTransitionOnChange
        >
          <FirebaseClientProvider>
            <DataProvider>
              {children}
              <FirebaseErrorListener />
            </DataProvider>
          </FirebaseClientProvider>
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}
