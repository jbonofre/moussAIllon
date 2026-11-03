import { message } from 'antd';

// Impression via une iframe masquée, pour ne pas ouvrir de nouvel onglet/fenêtre.
// L'impression attend le chargement des images (photos, logo) pour ne pas les perdre.
export const openPrintDocument = (contentHtml: string) => {
    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    document.body.appendChild(iframe);

    const cleanup = () => {
        if (iframe.parentNode) {
            iframe.parentNode.removeChild(iframe);
        }
    };

    const iframeWindow = iframe.contentWindow;
    if (!iframeWindow) {
        cleanup();
        message.error("Impossible de lancer l'impression.");
        return;
    }

    iframeWindow.document.open();
    iframeWindow.document.write(contentHtml);
    iframeWindow.document.close();
    iframeWindow.focus();

    const doPrint = () => {
        iframeWindow.print();
        setTimeout(cleanup, 1000);
    };

    const images = Array.from(iframeWindow.document.getElementsByTagName('img'));
    let pending = images.filter(img => !img.complete).length;
    if (pending === 0) {
        doPrint();
        return;
    }
    const onSettle = () => { pending--; if (pending === 0) doPrint(); };
    images.forEach(img => {
        if (!img.complete) {
            img.addEventListener('load', onSettle, { once: true });
            img.addEventListener('error', onSettle, { once: true });
        }
    });
};
