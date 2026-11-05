package net.nanthrax.moussaillon.services;

import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.YearMonth;
import java.util.EnumSet;
import java.util.List;
import java.util.Map;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

public class CapaciteAtelierTest {

    @Test
    void testPaques() {
        assertEquals(LocalDate.of(2024, 3, 31), CapaciteAtelier.paques(2024));
        assertEquals(LocalDate.of(2025, 4, 20), CapaciteAtelier.paques(2025));
        assertEquals(LocalDate.of(2026, 4, 5), CapaciteAtelier.paques(2026));
    }

    @Test
    void testJoursFeries() {
        assertTrue(CapaciteAtelier.jourFerie(LocalDate.of(2026, 1, 1)));
        assertTrue(CapaciteAtelier.jourFerie(LocalDate.of(2026, 4, 6)));
        // Ascension et lundi de Pentecôte
        assertTrue(CapaciteAtelier.jourFerie(LocalDate.of(2026, 5, 14)));
        assertTrue(CapaciteAtelier.jourFerie(LocalDate.of(2026, 5, 25)));
        assertTrue(CapaciteAtelier.jourFerie(LocalDate.of(2026, 7, 14)));
        assertTrue(CapaciteAtelier.jourFerie(LocalDate.of(2026, 11, 11)));
        assertFalse(CapaciteAtelier.jourFerie(LocalDate.of(2026, 7, 15)));
        assertFalse(CapaciteAtelier.jourFerie(LocalDate.of(2026, 4, 5)));
    }

    @Test
    void testJoursTravailles() {
        assertEquals(CapaciteAtelier.SEMAINE_DEFAUT, CapaciteAtelier.joursTravailles(null));
        assertEquals(CapaciteAtelier.SEMAINE_DEFAUT, CapaciteAtelier.joursTravailles(" "));
        assertEquals(EnumSet.of(DayOfWeek.TUESDAY, DayOfWeek.SATURDAY), CapaciteAtelier.joursTravailles("6, 2"));
        assertThrows(IllegalArgumentException.class, () -> CapaciteAtelier.joursTravailles("1,8"));
        assertThrows(IllegalArgumentException.class, () -> CapaciteAtelier.joursTravailles("lundi"));

        assertNull(CapaciteAtelier.formatJours(CapaciteAtelier.joursTravailles("5,4,3,2,1")));
        assertEquals("2,3,4,5,6", CapaciteAtelier.formatJours(CapaciteAtelier.joursTravailles("6,5,4,3,2")));
    }

    @Test
    void testHeuresParMois() {
        // Mai 2026 : 21 jours du lundi au vendredi, dont 4 fériés (1er, 8, Ascension le 14, Pentecôte le 25)
        LocalDate debut = LocalDate.of(2026, 5, 1);
        LocalDate fin = LocalDate.of(2026, 5, 31);
        // Absences : 18 au 20 mai, puis 13 au 15 mai (le 14 est férié, il n'est pas compté deux fois)
        List<CapaciteAtelier.Absence> absences = List.of(
                new CapaciteAtelier.Absence(LocalDate.of(2026, 5, 18), LocalDate.of(2026, 5, 20)),
                new CapaciteAtelier.Absence(LocalDate.of(2026, 5, 13), LocalDate.of(2026, 5, 15)));

        CapaciteAtelier.Heures mai = CapaciteAtelier.parMois(35, CapaciteAtelier.SEMAINE_DEFAUT, absences, debut, fin)
                .get(YearMonth.of(2026, 5));
        assertEquals(147, mai.contrat, 0.001);
        assertEquals(28, mai.feries, 0.001);
        assertEquals(35, mai.absences, 0.001);
        assertEquals(5, mai.joursAbsence);
        assertEquals(84, mai.disponibles(), 0.001);

        // 30 h sur 4 jours (du mardi au vendredi) : 7,5 h par jour
        CapaciteAtelier.Heures quatreJours = CapaciteAtelier.parMois(30,
                EnumSet.range(DayOfWeek.TUESDAY, DayOfWeek.FRIDAY), List.of(), debut, fin).get(YearMonth.of(2026, 5));
        // 17 jours travaillés (vendredi 1er, puis du mardi 5 au vendredi 29), dont 3 fériés (1er, 8 et 14 mai)
        assertEquals(17 * 7.5, quatreJours.contrat, 0.001);
        assertEquals(3 * 7.5, quatreJours.feries, 0.001);

        // Sans durée hebdomadaire : capacité inconnue
        Map<YearMonth, CapaciteAtelier.Heures> sansHoraire = CapaciteAtelier.parMois(0, CapaciteAtelier.SEMAINE_DEFAUT, List.of(), debut, fin);
        assertTrue(sansHoraire.isEmpty());
    }
}
