// Ouvre un PDF dans un nouvel onglet pour l'imprimer, ou le télécharge si le navigateur bloque l'ouverture
export function ouvrirPdf(pdf: Blob, nom: string) {
    const url = URL.createObjectURL(pdf);
    const onglet = window.open(url, '_blank');
    if (!onglet) {
        const lien = document.createElement('a');
        lien.href = url;
        lien.download = nom;
        document.body.appendChild(lien);
        lien.click();
        document.body.removeChild(lien);
    }
    // L'onglet doit avoir chargé le PDF avant que son adresse soit libérée
    setTimeout(() => URL.revokeObjectURL(url), 60000);
}
