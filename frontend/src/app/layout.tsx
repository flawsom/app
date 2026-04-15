import './globals.css';
import { AuthProvider } from '@/lib/auth-context';
import { QueryProvider } from '@/lib/query-provider';

export const metadata = {
  title: 'UNIFY | Adaptive Placement Intelligence',
  description: 'The OS that predicts and improves hiring outcomes',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <head>
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#010104" />
      </head>
      <body className="antialiased" style={{ background: '#010104', color: '#F0F0F5' }}>
        <QueryProvider>
          <AuthProvider>
            {children}
          </AuthProvider>
        </QueryProvider>
      </body>
    </html>
  );
}
