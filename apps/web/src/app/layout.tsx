import type { Metadata } from 'next';
import './globals.css';
import { NicknameProvider } from '@/components/providers/NicknameProvider';

export const metadata: Metadata = {
  title: 'Web Games Platform',
  description: 'Real-time multiplayer web games',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-theme="dark">
      {/* Runs before hydration: removes "dark" class if user chose light theme */}
      <head>
        <script dangerouslySetInnerHTML={{ __html: `(function(){try{var t=localStorage.getItem('webgames:theme');document.documentElement.dataset.theme=t==='light'?'light':'dark';}catch(e){document.documentElement.dataset.theme='dark';}})();` }} />
      </head>
      <body className="antialiased">
        <NicknameProvider>{children}</NicknameProvider>
      </body>
    </html>
  );
}
