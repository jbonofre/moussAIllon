package net.nanthrax.moussaillon.services;

import java.util.ArrayList;
import java.util.List;

public class ImportResult {
    public int total;
    public int created;
    public int updated;
    public int skipped;
    public int errors;
    public List<String> errorDetails = new ArrayList<>();

    // Import du catalogue : lignes reconnues comme bateau, moteur, hélice ou remorque
    public int bateaux;
    public int moteurs;
    public int helices;
    public int remorques;
    // Mode de détection utilisé pour les nouvelles lignes (voir CatalogueTypeDetector.Mode), null si aucune
    public String detection;
}
