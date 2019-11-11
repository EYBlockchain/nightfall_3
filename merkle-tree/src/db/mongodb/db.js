/**
 * @module db.js
 * @author iAmMichaelConnor
 * @desc js wrappers for mongoose & mongodb functions
 */

import config from 'config';
import { COLLECTIONS } from '../common/constants';
import { nodeSchema, metadataSchema } from '../models';

const mongo = config.get('mongo');

/**
Class created from within src/middleware/assign-db-connection
@param {object} db - an instance of mongoose.createConnection (a 'Connection' instance in mongoose terminoligy)
@param {string} username - username
*/
export default class DB {
  constructor(db, username) {
    this.database = db;
    this.username = username;
    if (!username) return;
    this.createModelsForUser();
  }

  addUser(name, password) {
    return this.database.db.addUser(name, password, {
      roles: [
        {
          role: 'read',
          db: mongo.databaseName,
        },
      ],
    });
  }

  /**
  A model is a class with which we construct documents
  */
  createModelsForUser() {
    const { username, database } = this;
    this.Models = {
      node: database.model(`${username}_${COLLECTIONS.NODE}`, nodeSchema),
      metadata: database.model(`${username}_${COLLECTIONS.METADATA}`, metadataSchema),
    };
  }

  /**
  Save data as a document (an instance of a particular Model) in a collection.
  @param {string} modelName - the name of the Model class.
  @param {object} data - the data to be stored as a document (an instance of a Model) in the collection.
  */
  async save(modelName, data) {
    try {
      // A Model is a class with which we construct documents:
      const Model = this.Models[modelName];
      // Construct a document from the Model:
      const doc = new Model(data);
      // Save the document to the db:
      const dbResponse = await doc.save();

      console.log('\nsrc/db/mongodb/db save()');
      console.log('dbResponse:');
      console.log(dbResponse);

      return Promise.resolve(dbResponse);
    } catch (e) {
      console.log('DB error', e);
      return Promise.reject(e);
    }
  }

  /**
  Save data as a document (an instance of a particular Model) in a collection.
  @param {string} modelName - the name of the Model class.
  @param {array} docs - an array of many documents to store at once in the collection.
  */
  async insertMany(modelName, docs) {
    try {
      // A Model is a class with which we construct documents:
      const Model = this.Models[modelName];

      // insert the documents into the db:
      const dbResponse = await Model.insertMany(docs); // insertMany uses a single write operation, rather than iterating through.

      console.log('\nsrc/db/mongodb/db insertMany()');
      console.log('dbResponse:');
      console.log(dbResponse);

      return Promise.resolve(dbResponse);
    } catch (e) {
      console.log('DB error', e);
      return Promise.reject(e);
    }
  }

  /**
  Retrieve a single document (an instance of a particular Model) from a collection.
  @param {string} modelName - the name of the Model class.
  @param {object} query - query parameters. Default is empty.
  */
  async getDoc(modelName, query = {}, projections = null) {
    try {
      // A Model is a class with which we construct documents. We can also access any document constructed from a particular Model class through that Model class:
      const Model = this.Models[modelName];
      const doc = await Model.findOne(query, projections);

      console.log('\nsrc/db/mongodb/db getDoc()');
      console.log('doc:');
      console.log(doc);

      return Promise.resolve(doc);
    } catch (e) {
      return Promise.reject(e);
    }
  }

  /**
  Retrieve documents (instances of a particular Model) from a collection.
  @param {string} modelName - the name of the Model class.
  @param {object} query - query parameters. Default is empty.
  @param {array} projections - to filter for particular keys, include the key as a string in an array, e.g. projections = ['field1', 'field2'] will output only these two fields of the document.
  @param {object} sort - specify fields by which to sort and whether ascending or descending. E.g. {field1: 1} will sort in ascending order (-1 for descending)
  */
  async getDocs(modelName, query = {}, projections = null, sort = {}, limit) {
    try {
      // A Model is a class with which we construct documents. We can also access all documents constructed from a particular Model class through that Model class:
      const Model = this.Models[modelName];
      const docs = await Model.find(query, projections)
        .sort(sort) // sort the output results
        .limit(limit) // output only the 'top' n results
        .exec();

      console.log('\nsrc/db/mongodb/db getDocs()');
      console.log('docs:');
      console.log(docs);

      return Promise.resolve(docs);
    } catch (e) {
      console.log('DB error', e);
      return Promise.reject(e);
    }
  }

  /**
  Update a single document (an instance of a particular Model) in a collection.
  @param {string} modelName - the name of the Model class.
  @param {object} query - the query conditions which filter to the document we want to update.
  @param {object} updateData - the data with which to update the document.
  @param {object} options - extra mongoose options. E.g. the upsert = true option inserts a new document (from the modelName Model class) containing the updateData, if no existing document matches the conditions.
  */
  async updateDoc(modelName, query, updateData, options = {}) {
    try {
      // A Model is a class with which we construct documents. We can also access any document constructed from a particular Model class through that Model class:
      const Model = this.Models[modelName];
      const doc = await Model.updateOne(query, updateData, options);

      console.log('\nsrc/db/mongodb/db updateDoc()');
      console.log('doc:');
      console.log(doc);

      return Promise.resolve(doc);
    } catch (e) {
      return Promise.reject(e);
    }
  }

  /**
  Update many documents (instances of a particular Model) in a collection.
  @param {string} modelName - the name of the Model class.
  @param {object} query - the query conditions which filter to the document we want to update.
  @param {object} updateData - the data with which to update the document.
  @param {object} options - extra mongoose options. E.g. the upsert = true option inserts a new document (from the modelName Model class) containing the updateData, if no existing document matches the conditions.
  */
  async bulkWrite(modelName, bulkUpdates) {
    try {
      // A Model is a class with which we construct documents. We can also access any document constructed from a particular Model class through that Model class:
      const Model = this.Models[modelName];
      const dbResponse = await Model.collection.bulkWrite(bulkUpdates); // CAUTION: we've used 'Model.collection...' rather than mongoose's built-in 'Model.' '' functions, and so validation might be being skipped!

      console.log('src/db/mongodb/db bulkWrite()');
      console.log('dbResponse:');
      console.log(dbResponse);

      return Promise.resolve(dbResponse);
    } catch (e) {
      return Promise.reject(e);
    }
  }

  /**
  Aggregation operations process data records and return computed results. Aggregation operations group values from multiple documents together, and can perform a variety of operations on the grouped data to RETURN A SINGLE RESULT.
  @param {string} modelName - the name of the Model class.
  @param {object} query - the query conditions which filter to the document we want to update.
  @param {array} stages - an array containing additional 'stage' objects. See https://docs.mongodb.com/manual/reference/operator/aggregation-pipeline/
  @param {object} projections - Specifies the fields to return in the documents that match the query filter. To return all fields in the matching documents, omit this parameter.
  @param {object} options - extra mongoose options.
  */
  async aggregate(modelName, query, stages, projections, options) {
    try {
      const Model = this.Models[modelName];

      const pipeline = [{ $match: query }];

      if (stages) pipeline.push(...stages);

      if (projections) pipeline.push(projections);

      if (options) pipeline.push(options);

      const data = await Model.aggregate(pipeline);

      return Promise.resolve(data);
    } catch (e) {
      return Promise.reject(e);
    }
  }

  /**
  Count the number of documents (instances of a particular Model) in a collection.
  We can use 'countDocuments' for fast counting of indexed documents.
  @param {string} modelName - the name of the Model class.
  @param {object} query - query parameters. Default is empty.
  */
  async countDocuments(modelName, query = {}) {
    try {
      // A Model is a class with which we construct documents. We can also access all documents constructed from a particular Model class through that Model class:
      const Model = this.Models[modelName];
      const count = await Model.countDocuments(query);

      console.log('\nsrc/db/mongodb/db countDocuments()');
      console.log('count:');
      console.log(count);

      return Promise.resolve(count);
    } catch (e) {
      console.log('DB error', e);
      return Promise.reject(e);
    }
  }

  /**
  TODO: Not used currently - delete?
  Aggregation operations process data records and return computed results. Aggregation operations group values from multiple documents together, and can perform a variety of operations on the grouped data to RETURN A SINGLE RESULT.
  @param {string} modelName - the name of the Model class.
  @param {object} conditions - the conditions which filter to the documents we want to aggregate together.
  @param {object} projection - Specifies the fields to return in the documents that match the query filter. To return all fields in the matching documents, omit this parameter.
  @param {object} options - extra mongoose options.
  */
  async aggregation(modelName, conditions, projection, options) {
    try {
      const Model = this.Models[modelName];
      const pipeline = [{ $match: conditions }];

      if (projection) pipeline.push(projection);

      if (options) pipeline.push(options);

      const data = await Model.aggregate(pipeline);

      return Promise.resolve(data);
    } catch (e) {
      return Promise.reject(e);
    }
  }

  // TODO: Not used currently - delete?
  async populate(modelName, data, populates) {
    try {
      const Model = this.Models[modelName];
      return await Model.populate(data, populates);
    } catch (e) {
      return Promise.reject(e);
    }
  }

  async getDocsPaginated(
    modelName,
    query,
    projection = { path: '', select: '' },
    sort = {},
    pageNo = 1,
    limit = 5,
  ) {
    try {
      const Model = this.Models[modelName];
      const data = await Model.find(query)
        .limit(limit)
        .skip(limit * (pageNo - 1))
        .sort(sort)
        .populate(projection)
        .exec();
      const totalCount = await Model.find(query)
        .countDocuments()
        .exec();
      return Promise.resolve({ data, totalCount });
    } catch (e) {
      console.log('DB error', e);
      return Promise.reject(e);
    }
  }

  /**
  TODO: remove because unused?
  */
  async getDocsRefined(modelName, query, projection, sort = {}, pageNo, limit) {
    try {
      const Model = this.Models[modelName];
      const mQuery = Model.find(query);
      if (limit) {
        mQuery.limit(limit);
      }
      if (pageNo) {
        mQuery.skip(limit * (pageNo - 1));
      }
      if (sort) {
        mQuery.sort(sort);
      }
      if (projection) {
        mQuery.populate(projection);
      }

      const docs = await mQuery.exec();
      return Promise.resolve({ docs });
    } catch (e) {
      return Promise.reject(e);
    }
  }

  /**
  TODO: remove because unused?
  */
  async getListData(modelName, query, page) {
    try {
      const Model = this.Models[modelName];
      const data = await Model.find(query)
        .skip(page.index * page.size)
        .limit(page.size)
        .exec();
      return Promise.resolve(data);
    } catch (e) {
      return Promise.reject(e);
    }
  }
}
