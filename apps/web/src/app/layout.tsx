import type { Metadata } from 'next';
import './globals.css';
import { NicknameProvider } from '@/components/providers/NicknameProvider';
import { LanguageProvider } from '@/components/providers/LanguageProvider';
import { AuthProvider } from '@/components/providers/AuthProvider';
import { PatchNotesFloatingButton } from '@/components/PatchNotesFloatingButton';
import { AchievementToastProvider } from '@/components/ui/AchievementToasts';
import { LevelUpToastProvider } from '@/components/ui/LevelUpToasts';
import { PartyProvider } from '@/components/providers/PartyProvider';
import { ProgressionProvider } from '@/components/providers/ProgressionProvider';

export const metadata: Metadata = {
  title: 'Web Games',
  description: 'Echtzeit-Multiplayer-Spiele im Browser. Spiele zusammen.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="de" data-theme="dark">
      {/* Runs before hydration: apply stored theme + lang to avoid flash */}
      <head>
        <script dangerouslySetInnerHTML={{ __html: `(function(){try{var t=localStorage.getItem('webgames:theme');document.documentElement.dataset.theme=t==='light'?'light':'dark';}catch(e){document.documentElement.dataset.theme='dark';}try{var l=localStorage.getItem('webgames:lang');document.documentElement.lang=l==='en'?'en':'de';}catch(e){}})();` }} />
      </head>
      <body className="antialiased overflow-x-hidden">
        <LanguageProvider>
          <AuthProvider>
            <ProgressionProvider>
            <AchievementToastProvider>
              <LevelUpToastProvider>
                <PartyProvider>
                  <NicknameProvider>{children}</NicknameProvider>
                </PartyProvider>
              </LevelUpToastProvider>
            </AchievementToastProvider>
            </ProgressionProvider>
          </AuthProvider>
        </LanguageProvider>
        <PatchNotesFloatingButton />
      </body>
    </html>
  );
}
