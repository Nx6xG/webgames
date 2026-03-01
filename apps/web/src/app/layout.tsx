import type { Metadata } from 'next';
import './globals.css';
import { NicknameProvider } from '@/components/providers/NicknameProvider';
import { LanguageProvider } from '@/components/providers/LanguageProvider';

export const metadata: Metadata = {
  title: 'Web Games Platform',
  description: 'Real-time multiplayer web games',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="de" data-theme="dark">
      {/* Runs before hydration: apply stored theme + lang to avoid flash */}
      <head>
        <script dangerouslySetInnerHTML={{ __html: `(function(){try{var t=localStorage.getItem('webgames:theme');document.documentElement.dataset.theme=t==='light'?'light':'dark';}catch(e){document.documentElement.dataset.theme='dark';}try{var l=localStorage.getItem('webgames:lang');document.documentElement.lang=l==='en'?'en':'de';}catch(e){}})();` }} />
      </head>
      <body className="antialiased">
        <LanguageProvider>
          <NicknameProvider>{children}</NicknameProvider>
        </LanguageProvider>
      </body>
    </html>
  );
}
