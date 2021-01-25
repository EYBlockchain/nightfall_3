import { Schema } from 'mongoose';

// This schema stores historic information relating to the whole tree.

export default new Schema(
  {
    root: {
      type: String,
      required: true,
      unique: true,
    },
    frontier: {
      type: Array,
      default: new Array(33),
    },
    leafIndex: Number,
    blockNumber: Number,
  },

  { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } },
);
