import './globals.css';
import { AuthProvider } from '@/lib/auth-context';

export const metadata = {
  title: 'UNIFY | Adaptive Placement Intelligence',
  description: 'A visually immersive, AI-powered internship and placement platform',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="antialiased" style={{ background: '#010104', color: '#F0F0F5' }}>
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
