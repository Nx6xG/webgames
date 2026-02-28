/**
 * Describes a game available on the platform.
 * Register new games by adding a GameManifest to the catalog.
 */
export interface GameManifest {
    /** Unique identifier, must match the engine id in apps/ws */
    id: string;
    /** Display name */
    name: string;
    /** Short description shown on the home page */
    description: string;
    /** e.g. ["strategy", "classic", "multiplayer"] */
    categories: string[];
    version: string;
    /** URL segment: /games/{routeSlug} */
    routeSlug: string;
    minPlayers: number;
    maxPlayers: number;
}
//# sourceMappingURL=manifest.d.ts.map