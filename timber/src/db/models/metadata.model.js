import { Schema } from 'mongoose';

// This schema stores information relating to the whole tree.

export default new Schema(
  {
    _id: {
      type: Number,
      default: 1,
    }, // force only one of these documents to ever exist, with _id = 1

    treeHeight: {
      type: Number,
      default: 32,
    },
    contractAddress: {
      type: String,
      default: '0', // '0' can be interpreted as 'no known contract'
    },
    contractInterface: {
      type: String, // a jsonified object
      default: '0', // '0' can be interpreted as 'no known contract'
    },

    latestRecalculation: {
      blockNumber: Number,
      leafIndex: Number,
      root: String,
      frontier: {
        type: Array,
        default: new Array(33),
      },
      /*
        The frontier contains one value from each level of the tree.
        By 'level' (as opposed to 'row') we mean: the leaves are at level '0' and the root is at level 'H = config.TREE_HEIGHT'.
        frontier: [
          leafValue, // level_0 corresponds to frontier[0]
          level1NodeValue, // level_1 corresponds to frontier[1]
          ...
          rootValue, // level_H corresponds to frontier[H]
        ]
      */
    },

    latestLeaf: {
      blockNumber: Number,
      leafIndex: Number,
    },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } },
);
