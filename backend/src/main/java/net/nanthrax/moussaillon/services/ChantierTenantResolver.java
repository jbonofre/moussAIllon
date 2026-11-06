package net.nanthrax.moussaillon.services;

import io.quarkus.hibernate.orm.PersistenceUnitExtension;
import io.quarkus.hibernate.orm.runtime.tenant.TenantResolver;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;

/**
 * Donne à Hibernate le chantier de la session qui s'ouvre (une par transaction, ou une par requête hors
 * transaction) : la colonne chantier de chaque table est filtrée sur ce chantier et renseignée à l'enregistrement.
 */
@PersistenceUnitExtension
@ApplicationScoped
public class ChantierTenantResolver implements TenantResolver {

    @Inject
    ChantierContexte contexte;

    @Override
    public String getDefaultTenantId() {
        return ChantierContexte.AUCUN;
    }

    @Override
    public String resolveTenantId() {
        return contexte.code();
    }

    @Override
    public boolean isRoot(String tenantId) {
        return ChantierContexte.RACINE.equals(tenantId);
    }

}
