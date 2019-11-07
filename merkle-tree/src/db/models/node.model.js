import { Schema } from 'mongoose';

// This schema stores information relating to each node of the tree. Note that a leaf shares this same schema.

export default new Schema(
  {
    value: {
      // The value at this node of the tree.
      // For non-leaves, this will be the hash of its two children.
      // For leaves this is some string of information.
      type: String,
      required: true,
    },
    nodeIndex: {
      type: Number,
      required: true,
      unique: true,
      // index: true, // not sure if this is necessary, if we're using 'unique', because I think 'unique' gives us indexing.
    },
    leafIndex: {
      type: Number,
      unique: true, // establish this as a unique index
      sparse: true, // the index is 'sparse' (not all documents in the collection will have a leafIndex, so we can skip them)
    },
    /**
    TODO: make blockNumber 'required' if a leaf?
    */
    blockNumber: {
      // the blockNumber during which this leaf was emitted
      type: Number,
    },
    isLocked: {
      type: Boolean, // true if the value at this node will never again change.
      default: false,
    },
  },

  // { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } },
);
