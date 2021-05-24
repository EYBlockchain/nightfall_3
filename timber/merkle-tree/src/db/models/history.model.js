import { Schema } from 'mongoose';

// This schema stores historic information relating to the whole tree.
// It's basically the latest recalculation that existed before the root
// was updated to 'root'

export default new Schema(
  {
    root: {
      type: String,
      required: true,
      unique: true,
    },
    oldRoot: {
      type: String,
      default: null,
      unique: true,
    },
    frontier: {
      type: Array,
      default: new Array(33),
    },
    leafIndex: Number,
    currentLeafCount: Number,
    blockNumber: Number,
  },

  { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } },
);
