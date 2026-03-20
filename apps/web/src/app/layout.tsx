import type { Metadata } from 'next';
import './globals.css';
import { NicknameProvider } from '@/components/providers/NicknameProvider';
import { LanguageProvider } from '@/components/providers/LanguageProvider';
import { AuthProvider } from '@/components/providers/AuthProvider';
import { PatchNotesFloatingButton } from '@/components/PatchNotesFloatingButton';
import { FeedbackButton } from '@/components/FeedbackButton';
import { AchievementToastProvider } from '@/components/ui/AchievementToasts';
import { LevelUpToastProvider } from '@/components/ui/LevelUpToasts';
import { PartyProvider } from '@/components/providers/PartyProvider';
import { ProgressionProvider } from '@/components/providers/ProgressionProvider';
import { OnlinePresenceProvider } from '@/components/providers/OnlinePresenceProvider';

export const metadata: Metadata = {
  title: 'Web Games',
  description: 'Multiplayer & Singleplayer Browser Games',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Web Games',
  },
  other: {
    'mobile-web-app-capable': 'yes',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="de" data-theme="dark">
      {/* Runs before hydration: apply stored theme + lang to avoid flash */}
      <head>
        <meta name="theme-color" content="#09090b" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
        <script dangerouslySetInnerHTML={{ __html: `(function(){try{var t=localStorage.getItem('webgames:theme');document.documentElement.dataset.theme=t==='light'?'light':'dark';}catch(e){document.documentElement.dataset.theme='dark';}try{var l=localStorage.getItem('webgames:lang');document.documentElement.lang=l==='en'?'en':'de';}catch(e){}})();` }} />
      </head>
      <body className="antialiased overflow-x-hidden">
        <LanguageProvider>
          <AuthProvider>
            <ProgressionProvider>
            <AchievementToastProvider>
              <LevelUpToastProvider>
                <PartyProvider>
                  <NicknameProvider>
                    <OnlinePresenceProvider>{children}</OnlinePresenceProvider>
                  </NicknameProvider>
                </PartyProvider>
              </LevelUpToastProvider>
            </AchievementToastProvider>
            </ProgressionProvider>
          </AuthProvider>
        </LanguageProvider>
        <PatchNotesFloatingButton />
        <FeedbackButton />
      </body>
    </html>
  );
}
