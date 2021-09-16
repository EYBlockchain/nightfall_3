#! /bin/bash

docker exec -t nightfall_3_timber-database1_1 bash -c \
    'mongo --quiet --eval "db = db.getSiblingDB(\"merkle_tree\");
    db.admin_state_nodes.drop( { writeConcern: { w: \"majority\" } } );
    db.admin_state_histories.drop( { writeConcern: { w: \"majority\" } } );
    db.admin_state_metadatas.drop( { writeConcern: { w: \"majority\" } } );
    db.admin_state_metadatas.insert( { \"_id\" : 1, \"__v\" : 0, \"contractAddress\" : \"0x9b1f7F645351AF3631a656421eD2e40f2802E6c0\", \"created_at\" : ISODate(\"2021-05-03T08:18:08.739Z\"), \"updated_at\" : ISODate(\"2021-05-03T08:18:08.739Z\") })"'

docker exec -t nightfall_3_optimist1_1 bash -c \
    'mongo --quiet --eval "db = db.getSiblingDB(\"optimist_data\");
    db.blocks.drop( { writeConcern: { w: \"majority\" } } );
    db.nullifiers.drop( { writeConcern: { w: \"majority\" } } );
    db.transactions.drop( { writeConcern: { w: \"majority\" } } );
    db.metadata.drop( { writeConcern: { w: \"majority\" } } );
    db.metadata.insert( { \"_id\" : ObjectId(\"60913a97d2515d00e807ba07\"), \"proposer\" : \"0x9C8B2276D490141Ae1440Da660E470E7C0349C63\" })"'
