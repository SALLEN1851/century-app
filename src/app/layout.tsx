import { Inter } from 'next/font/google';
import './globals.css';
import Providers from './providers';
import Link from 'next/link';
import HeaderActions from '@/components/HeaderActions';

const inter = Inter({ subsets: ['latin'] });

export const metadata = {
  title: 'GRAVA Coach',
  description: 'Gravel Training • Fueling • Recovery (WHOOP-integrated)',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <Providers>
          {/* <header className="border-b border-stone-200/70 dark:border-stone-800/70 bg-stone-50/70 dark:bg-stone-950/70 backdrop-blur">
            <div className="mx-auto max-w-7xl px-6 py-4 flex items-center justify-between">
              <Link href="/" className="flex items-center gap-2">
                <span className="inline-block rounded-md bg-amber-600 text-stone-50 px-2 py-0.5 text-sm font-bold">
                  GRAVA
                </span>
                <span className="text-base md:text-lg font-semibold tracking-tight">Coach</span>
              </Link>
              <HeaderActions />
            </div>
          </header> */}

          <main className="min-h-dvh bg-gradient-to-b from-stone-100 via-stone-50 to-stone-100 dark:from-stone-950 dark:via-stone-900 dark:to-stone-950 text-stone-900 dark:text-stone-100">
            {children}
          </main>
        </Providers>
      </body>
    </html>
  );
}
