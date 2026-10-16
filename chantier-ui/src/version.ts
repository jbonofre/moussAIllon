import dayjs from 'dayjs';

// Injectés au build par vite.config.ts (version du package.json et date du build).
// Valeurs de repli quand non défini.
export const APP_VERSION: string = import.meta.env.VITE_APP_VERSION || 'dev';

const rawBuildDate = import.meta.env.VITE_APP_BUILD_DATE || '';
export const BUILD_DATE: string = rawBuildDate && dayjs(rawBuildDate).isValid()
    ? dayjs(rawBuildDate).format('DD/MM/YYYY HH:mm')
    : '';

export const VERSION_LABEL: string = BUILD_DATE
    ? `v${APP_VERSION} · build ${BUILD_DATE}`
    : `v${APP_VERSION}`;
