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
}
