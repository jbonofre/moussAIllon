package net.nanthrax.moussaillon.services;

import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.MonthDay;
import java.time.YearMonth;
import java.util.EnumSet;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * Capacité de travail d'un technicien : sa durée hebdomadaire répartie à parts égales sur ses jours travaillés,
 * moins les jours fériés (France métropolitaine) et ses absences.
 */
final class CapaciteAtelier {

    static final Set<DayOfWeek> SEMAINE_DEFAUT = EnumSet.range(DayOfWeek.MONDAY, DayOfWeek.FRIDAY);

    private static final Set<MonthDay> FERIES_FIXES = Set.of(
            MonthDay.of(1, 1), MonthDay.of(5, 1), MonthDay.of(5, 8), MonthDay.of(7, 14),
            MonthDay.of(8, 15), MonthDay.of(11, 1), MonthDay.of(11, 11), MonthDay.of(12, 25));

    private CapaciteAtelier() {
    }

    /** Jours travaillés d'une fiche technicien (« 1,2,3,4,5 », 1 = lundi) ; du lundi au vendredi s'ils sont vides. */
    static Set<DayOfWeek> joursTravailles(String jours) {
        if (jours == null || jours.isBlank()) {
            return SEMAINE_DEFAUT;
        }
        Set<DayOfWeek> resultat = EnumSet.noneOf(DayOfWeek.class);
        for (String jour : jours.split(",")) {
            try {
                resultat.add(DayOfWeek.of(Integer.parseInt(jour.trim())));
            } catch (RuntimeException e) {
                throw new IllegalArgumentException("Jours travaillés invalides (attendu 1 = lundi ... 7 = dimanche) : " + jours);
            }
        }
        return resultat;
    }

    // Jours travaillés à enregistrer : null pour la semaine par défaut
    static String formatJours(Set<DayOfWeek> jours) {
        if (jours.equals(SEMAINE_DEFAUT)) {
            return null;
        }
        return jours.stream().sorted().map(j -> String.valueOf(j.getValue())).collect(Collectors.joining(","));
    }

    static boolean jourFerie(LocalDate jour) {
        if (FERIES_FIXES.contains(MonthDay.from(jour))) {
            return true;
        }
        LocalDate paques = paques(jour.getYear());
        // Lundi de Pâques, Ascension, lundi de Pentecôte
        return jour.equals(paques.plusDays(1)) || jour.equals(paques.plusDays(39)) || jour.equals(paques.plusDays(50));
    }

    // Dimanche de Pâques (calendrier grégorien, algorithme de Meeus/Jones/Butcher)
    static LocalDate paques(int annee) {
        int a = annee % 19;
        int b = annee / 100;
        int c = annee % 100;
        int d = b / 4;
        int e = b % 4;
        int f = (b + 8) / 25;
        int g = (b - f + 1) / 3;
        int h = (19 * a + b - d - g + 15) % 30;
        int i = c / 4;
        int k = c % 4;
        int l = (32 + 2 * e + 2 * i - h - k) % 7;
        int m = (a + 11 * h + 22 * l) / 451;
        int mois = (h + l - 7 * m + 114) / 31;
        int jour = (h + l - 7 * m + 114) % 31 + 1;
        return LocalDate.of(annee, mois, jour);
    }

    /** Absence du premier au dernier jour inclus. */
    record Absence(LocalDate debut, LocalDate fin) {
        boolean couvre(LocalDate jour) {
            return !jour.isBefore(debut) && !jour.isAfter(fin);
        }
    }

    /** Heures de travail d'un mois : prévues au contrat, perdues (jours fériés, absences) et disponibles. */
    static final class Heures {
        double contrat;
        double feries;
        double absences;
        int joursAbsence;

        double disponibles() {
            return contrat - feries - absences;
        }
    }

    /** Heures de travail par mois d'un technicien, du premier au dernier jour inclus. */
    static Map<YearMonth, Heures> parMois(double heuresHebdomadaires, Set<DayOfWeek> jours, List<Absence> absences,
                                         LocalDate debut, LocalDate fin) {
        Map<YearMonth, Heures> parMois = new HashMap<>();
        if (heuresHebdomadaires <= 0 || jours.isEmpty()) {
            return parMois;
        }
        double heuresParJour = heuresHebdomadaires / jours.size();
        for (LocalDate jour = debut; !jour.isAfter(fin); jour = jour.plusDays(1)) {
            if (!jours.contains(jour.getDayOfWeek())) {
                continue;
            }
            Heures heures = parMois.computeIfAbsent(YearMonth.from(jour), m -> new Heures());
            heures.contrat += heuresParJour;
            LocalDate jourTravaille = jour;
            if (jourFerie(jour)) {
                heures.feries += heuresParJour;
            } else if (absences.stream().anyMatch(a -> a.couvre(jourTravaille))) {
                heures.absences += heuresParJour;
                heures.joursAbsence++;
            }
        }
        return parMois;
    }

}
