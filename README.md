# merkle-tree microservice

Create an append-only merkle tree on-chain, with minimal gas cost.

Leaves are submitted to a `MerkleTree` smart-contract by users.

A local (off-chain) merkle-tree database is populated with the nodes of the tree, based on on-chain events.

---

## Quick Start:

### Prerequisites

Mac and Linux machines are supported.

The merkle-tree miscroservice requires the following software to run:

- Docker
- Python
- Node.js (tested with node 10.15.3) with npm and node-gyp.
- Xcode Command line tools:
  - If running macOS, install Xcode then run `xcode-select --install` to install command line tools.

### Starting servers

Start Docker:

-  On Mac, open Docker.app.

### Installing the merkle-tree microservice

Clone the merkle-tree repository and use a terminal to enter the directory.

### Starting the merkle-tree microservice

If you have pulled new changes from the repo, then first run

```sh
docker-compose build
```
We're ready to go!

```sh
docker-compose up
```

It's up and running!



If you want to close the application, make sure to stop containers and remove containers, networks, volumes, and images which were created by `up`, using

```sh
docker-compose down -v
```

### To run unit tests

See the [deployment README](deployer/test/README.md).


---

## api

The `merkle-tree` container (or 'service') exposes several useful endpoints.

If the microservices are started with the default `./docker-compose.yml` file, these endpoints can be accessed by other containers on the same docker network through <http://merkle-tree:80>.

To access the `merkle-tree` service from your local machine, use <http://localhost:8000> by default.

A postman collection (for local testing) is provided at [./merkle-tree/test/postman-collections/](merkle-tree/test/postman-collections/).

See `./merkle-tree/routes` for all api routes.

---

## Explanations:

---

### on-chain  

The leaves of the tree are not stored on-chain, they're emitted as events.

The intermediate-nodes of the tree (between the leaves and the root) are not stored on-chain.

Only a 'frontier' is stored on-chain (see the detailed explanation below).  

---

### off-chain  

We filter the blockchain for `newLeaf` event emissions, which contain:

```
newLeafEvent: {
  leafIndex: 1234,
  leafValue: '0xacb5678',
  root: '0xdef9012'
}
```

We then insert each leaf into a local mongodb database.  

With this database, we can reconstruct the entire merkle tree.

---

### technical details


We consistently use the following indexing throughout the codebase:

```
Level Row                            nodeIndices                      frontier indices
  4    0                                  0                                  [4,
                           /                             \
  3    1                  1                               2                   3,
                   /             \                 /             \
  2    2          3               4               5               6           2,
               /     \         /      \        /      \        /      \
  1    3      7       8       9       10      11      12      13      14      1,
             /  \    /  \    /  \    /  \    /  \    /  \    /  \    /  \
  0    4    15  16  17  18  19  20  21  22  23  24  25  26  27  28  29  30    0]

leafIndices: 0   1   2   3   4   5   6   7   8   9  10  11  12  13  14  15

```

#### On-chain logic

We start with an empty `frontier = [ , , , , ]`.  

The frontier will represent the right-most fixed nodeValues at each level of the tree. So `frontier[0]` will be the right-most fixed nodeValue at level `0`, and so on up the tree. By 'fixed nodeValue', we mean that the `nodeValue` will never again change; it is permanently fixed regardless of future leaf appends.

A user submits the 0th leaf (`leafIndex = 0`) to the `MerkleTree` smart contract.

We add it to `leafIndex = 0` (`nodeIndex = 15`) in the contract's local stack (but not to persistent storage, because we can more cheaply emit this leaf's data as an event).

Let's provide a visualisation:

```
// Inserting a leaf with nodeValue = '15.0' into the tree

                                nodeValues                                frontier
                                    0                                     [    ,
                  /                                    \          
                 0                                      0                      ,
         /               \                   /               \       
        0                 0                 0                 0                ,
     /      \          /      \          /      \          /      \       
    0        0        0        0        0        0        0        0           ,
  /   \    /   \    /   \    /   \    /   \    /   \    /   \    /   \       
15.0   0  0     0  0     0  0     0  0     0  0     0  0     0  0     0        ]

  0    1  2     3  4     5  6     7  8     9 10    11 12    13 14    15 <-- leafIndices

```

We use the unusual notation `15.0` to mean "the `nodeValue` from the 0th update of nodeIndex `15`".

We now need to hash up the merkle tree to update the root. In order to do this, we need the `nodeValues` of the sibling-path of `leafIndex = 0`.

The 0th leaf is an easy case where the sibling-path nodes are always to the right of the leaf's path:

```
// Showing the sibling-path of leafIndex = 0

                                nodeValues                                frontier
                                    0                                     [    ,
                  /                                    \          
                 0                                     *0*                     ,
         /               \                   /               \       
        0                *0*                0                 0                ,
     /      \          /      \          /      \          /      \       
    0       *0*       0        0        0        0        0        0           ,
  /   \    /   \    /   \    /   \    /   \    /   \    /   \    /   \       
15.0  *0* 0     0  0     0  0     0  0     0  0     0  0     0  0     0        ]

  0    1  2     3  4     5  6     7  8     9 10    11 12    13 14    15 <-- leafIndices

*0* = "sibling-path nodeValue"

```
Hashing up the tree is easy in this case; if a sibling-node is to the right, then it must never have been updated before, and hence must have `nodeValue` `0`.

So it's easy to update the tree:

```
// Hashing computation to update the root for a newly inserted leaf at leafIndex = 0

frontier        nodeValue  = hash ( left input   ,   right input   )       zeros  
 [  ,              7.0     = hash (   15.0       ,        0        )    <--  0
    ,              3.0     = hash (    7.0       ,        0        )    <--  0
    ,              1.0     = hash (    3.0       ,        0        )    <--  0
    ,              0.0     = hash (    1.0       ,        0        )    <--  0
    ]
```

We will only use the `frontier` to inject sibling-nodes which are to the left of a leaf's path. More on that later.

Our updated tree can be visualised like this:

```
// Updating the path from leafIndex = 0 to the root:

                              nodeValues                                  frontier
                                  0.0                                      [   ,
                  /                                    \     
                1.0                                     0                      ,
         /               \                   /               \
       3.0                0                 0                 0                ,
     /      \          /      \          /      \          /      \
   7.0       0        0        0        0        0        0        0           ,
  /   \    /   \    /   \    /   \    /   \    /   \    /   \    /   \
15.0   0  0     0  0     0  0     0  0     0  0     0  0     0  0     0        ]

  0    1  2     3  4     5  6     7  8     9 10    11 12    13 14    15 <-- leafIndices

```
By `7.0`, we mean "the `nodeValue` from the 0th update of nodeIndex `7`", etc.

Note that nothing has yet been stored in persistent storage on-chain.

Notice now, that the `nodeValue` `15.0` will never change in future. Notice also that when we come to insert a new leaf to `leafIndex = 1`, its sister-path will include `nodeValue` `15.0` on its left. Therefore, when we come to update the root to include the new leaf, we will need to left-inject `nodeValue` `15.0` into our hashing computation.

Now the purpose of the `frontier` starts to become clear. We will add `nodeValue` `15.0` to `frontier[0]` (persistent storage), so that we can later left-inject it into our hashing computation when we come to insert `leafIndex = 1`.


```
// Adding a nodeValue to frontier[0]

                              nodeValues                                     frontier
                                  0.0                                          [    ,
                  /                                    \
                1.0                                     0                           ,
         /               \                   /               \
       3.0                0                 0                 0                     ,
     /      \          /      \          /      \          /      \
   7.0       0        0        0        0        0        0        0                ,
  /   \    /   \    /   \    /   \    /   \    /   \    /   \    /   \
15.0   0  0     0  0     0  0     0  0     0  0     0  0     0  0     0   -->   15.0]

  0    1  2     3  4     5  6     7  8     9 10    11 12    13 14    15 <-- leafIndices

```


Let's add some more leaves (always appending them from left to right):

A user submits the 1th leaf (`leafIndex = 1`) to the `MerkleTree` smart contract.

We add it to `leafIndex = 1` (`nodeIndex = 16`) in the contract's local stack (but not to persistent storage, because we can more cheaply emit this leaf's data as an event).

Let's provide a visualisation:

```
// Inserting a leaf with nodeValue = '16.0' into the tree

                              nodeValues                                     frontier
                                  0.0                                          [    ,
                  /                                    \
                1.0                                     0                           ,
         /               \                   /               \
       3.0                0                 0                 0                     ,
     /      \          /      \          /      \          /      \
   7.0       0        0        0        0        0        0        0                ,
  /   \    /   \    /   \    /   \    /   \    /   \    /   \    /   \
15.0 16.0 0     0  0     0  0     0  0     0  0     0  0     0  0     0         15.0]

  0    1  2     3  4     5  6     7  8     9 10    11 12    13 14    15 <-- leafIndices

```

But this visualisation is misleading, because most of this data wasn't stored in persistent storage. In actual fact all the smart contract knows is:

```
// Data known by the smart contract (or implied, in the case of all the 0's):

                              nodeValues                                     frontier
                                   ?                                           [    ,
                  /                                    \
                 ?                                      0                           ,
         /               \                   /               \
        ?                 0                 0                 0                     ,
     /      \          /      \          /      \          /      \
    ?        0        0        0        0        0        0        0                ,
  /   \    /   \    /   \    /   \    /   \    /   \    /   \    /   \
 ?   16.0 0     0  0     0  0     0  0     0  0     0  0     0  0     0         15.0]

  0    1  2     3  4     5  6     7  8     9 10    11 12    13 14    15 <-- leafIndices

```

In order to insert `nodeValue` `16.0` into the tree, we will need the `nodeValues` of the sibling-path of `leafIndex = 1`, and we will also need to know whether those sibling-nodes are on the left or the right of the path up the tree:

```
// Hashing computation to update the root for a newly inserted leaf at leafIndex = 0

frontier        nodeValue  = hash ( left input   ,   right input   )       zeros  
[15.0,             7.1     = hash (      ?       ,        ?        )         0
     ,             3.1     = hash (      ?       ,        ?        )         0
     ,             1.1     = hash (      ?       ,        ?        )         0
     ,             0.1     = hash (      ?       ,        ?        )         0
     ]
```

We can actually deduce the 'left-ness' or 'right-ness' of a leaf's path up the tree from the binary representation the leaf's leafIndex:


```
                               binary leafIndices                              
                                        *                                  
                    /                                     \    
>>                 0                                       1
          /                 \                     /                 \
>>       00                  01                  10                  11
      /       \           /       \           /       \           /       \
>>  000       001       010       011       100       101       110       111
   /   \     /   \     /   \     /   \     /   \     /   \     /   \     /   \
 0000 0001 0010 0011 0100 0101 0110 0111 1000 1001 1010 1011 1100 1101 1110 1111

   0    1    2    3    4    5    6    7    8    9   10   11   12   13   14   15 <-- leafIndices

```

Notice how for `leafIndex = 1 = 0b0001` the path is on the right, left, left, left as we work up the tree? _(Associate a binary `1` with `right` and a binary `0` with `left`, and you'll see a pattern for the 'left-ness' or 'right-ness' of the path up the tree from a particular leafIndex)_:

```
// Path up the tree

                               nodeValues                                     
                                  root                                          
                  /                                    \
                left                                    S                       
         /                \                   /               \
       left                S                 0                 0       
     /      \           /      \          /      \          /      \
   left       S        0        0        0        0        0        0    
  /   \     /   \    /   \    /   \    /   \    /   \    /   \    /   \
 S   right

     0b0001 = "left <- left <- left <- right"

S = "sibling-node"

```

Now we can hash up the tree, by injecting the sister-path to the opposing 'left, right, right, right' positions (as indicated by the arrows below):

```
// Hashing computation to update the root for a newly inserted leaf at leafIndex = 1

frontier        nodeValue  = hash ( left input   ,   right input   )       zeros  
 [15.0,   -->      7.1     = hash (   15.0       ,      16.0       )         0
      ,            3.1     = hash (    7.1       ,        0        )    <--  0
      ,            1.1     = hash (    3.1       ,        0        )    <--  0
      ,            0.1     = hash (    1.1       ,        0        )    <--  0
      ]
```

Now we've udpated the tree, how do we decide which nodeValue to add to the `frontier`?

We use the following algorithm to decide which index (or storage 'slot') of the `frontier` to update:
