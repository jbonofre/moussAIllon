package net.nanthrax.moussaillon.persistence;

import org.hibernate.mapping.Collection;
import org.hibernate.persister.collection.BasicCollectionPersister;
import org.hibernate.persister.collection.CollectionPersister;
import org.hibernate.persister.internal.StandardPersisterClassResolver;

/**
 * Persisters standard d'Hibernate, sauf pour les collections à table de jointure : {@link ChantierCollectionPersister}.
 * Déclaré par la propriété hibernate.persister.resolver (application.properties).
 */
public class ChantierPersisterClassResolver extends StandardPersisterClassResolver {

    @Override
    public Class<? extends CollectionPersister> getCollectionPersisterClass(Collection metadata) {
        Class<? extends CollectionPersister> persister = super.getCollectionPersisterClass(metadata);
        return persister == BasicCollectionPersister.class ? ChantierCollectionPersister.class : persister;
    }

}
