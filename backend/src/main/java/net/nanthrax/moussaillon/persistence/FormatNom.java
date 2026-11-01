package net.nanthrax.moussaillon.persistence;

import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

/**
 * Champ de nom (personne, société, adresse, désignation...) remis en casse « Titre » à chaque
 * enregistrement s'il a été saisi tout en majuscules ou tout en minuscules : « FOO BAR » et
 * « foo bar » deviennent « Foo Bar ». L'entité doit déclarer
 * {@code @EntityListeners(FormatNomListener.class)}.
 */
@Retention(RetentionPolicy.RUNTIME)
@Target(ElementType.FIELD)
public @interface FormatNom {
}
