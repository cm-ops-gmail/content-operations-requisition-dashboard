import type { Metadata } from 'next';
import './globals.css';
import { Toaster } from '@/components/ui/toaster';
import Header from '@/components/Header';
import { AuthProvider } from '@/hooks/use-auth';

export const metadata: Metadata = {
  title: 'Content OPS Project and Ticket Management System',
  description: 'Project and Ticket Management System',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="font-body antialiased">
        <AuthProvider>
            <div className="flex min-h-screen w-full flex-col">
              <Header />
              <main className="flex-1">{children}</main>
            </div>
            <Toaster />
        </AuthProvider>
      </body>
    </html>
  );
}
