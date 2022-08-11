#! /bin/bash

docker exec -t nightfall_3_optimist_1 bash -c \
    'mongo --quiet --eval "db = db.getSiblingDB(\"optimist_data\");
    db.blocks.drop( { writeConcern: { w: \"majority\" } } );
    db.nullifiers.drop( { writeConcern: { w: \"majority\" } } );
    db.transactions.drop( { writeConcern: { w: \"majority\" } } );
    db.timber.drop( { writeConcern: { w: \"majority\" } } );
    db.metadata.drop( { writeConcern: { w: \"majority\" } } );
    db.metadata.insert( { \"_id\" : ObjectId(\"60913a97d2515d00e807ba07\"), \"proposer\" : \"0x9C8B2276D490141Ae1440Da660E470E7C0349C63\" })"'
