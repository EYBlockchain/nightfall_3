## functionality required:

### db
add leaf (do not allow overwriting)
update leaf (allow overwriting) (in the event of an orphaned block)
delete leaf (in the event of an orphaned block)

add leaves (do not allow overwriting)
update leaves (allow overwriting) (in the event of an orphaned block)
delete leaf (in the event of an orphaned block)

update leaf (e.g. to add metatdata that I am the owner, or am no-longer the owner)
update leaves (e.g. to add metatdata that I am the owner, or am no-longer the owner)

ALLOW LEAVES TO BE STRUCTS (when writing the schema)
Just have intermediate hash nodes as hex hashes (i.e. don't allow extra metadata for now?)

node: {
  nodeIndex: number,
  value: string, // hex
}

leaf: {
  nodeIndex: number, // index within entire tree
  leafIndex: number, // index within leaves
  value: string, //hex
  blockNumber: number // the block number in which the leaf was added (so we can see how out-of-date our db is!!!)
  add a link to the commitment's id in the other db?
}

another (trivially simple) schema perhaps:

{ latestBlock: number } // the block number in which the leaf was added (so we can see how out-of-date our db is!!!)

latest tree recalculation data:
{
  latestIndex:
  latestLeaf: //gives the data for the leaf at latestIndex
  latestBlockNumber:
  latestRoot:
}

lock Node : will update the 'isLocked' field of a node to true, to indicate that this node will never again change when the tree is updated

get leaf (by index) (by value)
get leaves (get some leaves by indices) (by values)
get all leaves
get Leaves In Chunks (by indices)

get root (same as getting node )

get node (by index)
add node (for when we're calculating the new merkle root, we'll want to store each node?)
update node (for when we're calculating the new merkle root, we'll want to store each node?)

get leafCount

set treeHeight (only at the beginning of time, then do not allow change once set)
get treeHeight

get Path (based on leaf index) (make sure to return the root too!!)
get Path (based on leaf value) (make sure to return the root!!)

get Slbling Path (based on leaf index) (make sure to return the root too!!)
get Sibling Path (based on leaf value) (make sure to return the root!!)

get tree (gets the entire tree!!!)


check for missing data upon retrieval of nodes / leaves from the db??? probably enforce 'required' fields when the items are placed into the db.

### merkle tree calcs

Start Filter


get Path (by leaf index) - send request to db for the path

get Sibling Path (by leaf index) - send request to db for the path

update Tree - updates the tree based on the latest-stored leaves in the tree

    will call on the following functions:

    // (ignore:) split leaves into chunks (of size 2^k)

    // (ignore:) calculate sub-tree of height...?

    recursively calculate tree starting at the root, and recursively just calculating the 'current node' from the two child-nodes. The recursion will go all the way down to the leaves, before coming back up - this should be the quickest semi-asynchronous way of doing things. It should check the 'isLocked' field of each node, to avoid unnecessary hash  calculations.





updateTreeByIndex - updates the tree, not necessarily using the latest index

recalculate Tree In Memory (possibly not possible, but would allow for us to not overwrite the tree)


Check Leaves

Update latest leaf





### utils

hash




### smart contract calls / tx's / getters
check root exists on-chain
check leaf exists on-chain
get leaf
get leaves
set leaf
set leaves
