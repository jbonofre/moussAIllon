package net.nanthrax.moussaillon.persistence;

import org.hibernate.cache.spi.access.CollectionDataAccess;
import org.hibernate.engine.spi.SharedSessionContractImplementor;
import org.hibernate.mapping.Collection;
import org.hibernate.metamodel.spi.RuntimeModelCreationContext;
import org.hibernate.persister.collection.BasicCollectionPersister;

import java.util.Set;

/**
 * Collection à table de jointure (@ManyToMany, @OneToMany sans clé étrangère dans l'élément) dont la mise à jour
 * reste possible avec le filtre du chantier. Hibernate met à jour une telle liste en la recréant (suppression puis
 * réinsertion de ses lignes), ce qu'il refuse quand un filtre est actif, la liste chargée pouvant être partielle.
 * Ce n'est pas le cas du filtre du chantier : les éléments d'une collection sont tous du chantier de leur
 * propriétaire. Les autres filtres gardent la protection d'Hibernate.
 */
public class ChantierCollectionPersister extends BasicCollectionPersister {

    // Nom du filtre qu'Hibernate associe à @TenantId (TenantIdBinder.FILTER_NAME, classe interne).
    static final String FILTRE_CHANTIER = "_tenantId";

    public ChantierCollectionPersister(Collection collectionBinding, CollectionDataAccess cacheAccessStrategy,
                                       RuntimeModelCreationContext creationContext) {
        super(collectionBinding, cacheAccessStrategy, creationContext);
    }

    @Override
    public boolean isAffectedByEnabledFilters(SharedSessionContractImplementor session) {
        if (Set.of(FILTRE_CHANTIER).equals(session.getLoadQueryInfluencers().getEnabledFilterNames())) {
            return false;
        }
        return super.isAffectedByEnabledFilters(session);
    }

}
