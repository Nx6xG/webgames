import { redirect } from 'next/navigation';

/**
 * Legacy route — the WS-session leaderboard was superseded by the cloud-backed
 * /leaderboards page. Redirect so old bookmarks keep working.
 */
export default function LeaderboardPage() {
  redirect('/leaderboards');
}
