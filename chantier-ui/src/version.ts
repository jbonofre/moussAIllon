import dayjs from 'dayjs';

// Injectés au build via les scripts npm (REACT_APP_VERSION = $npm_package_version,
// REACT_APP_BUILD_DATE = date du build). Valeurs de repli quand non défini (ex: react-scripts lancé directement).
export const APP_VERSION: string = process.env.REACT_APP_VERSION || 'dev';

const rawBuildDate = process.env.REACT_APP_BUILD_DATE || '';
export const BUILD_DATE: string = rawBuildDate && dayjs(rawBuildDate).isValid()
    ? dayjs(rawBuildDate).format('DD/MM/YYYY HH:mm')
    : '';

export const VERSION_LABEL: string = BUILD_DATE
    ? `v${APP_VERSION} · build ${BUILD_DATE}`
    : `v${APP_VERSION}`;
