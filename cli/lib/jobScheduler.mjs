/**
 * This is cron library to create scheduler
 * for any give job
 */
import cron from 'node-cron';

export default function createJob(cronExp, job) {
  if (!cron.validate(cronExp)) {
    throw Error('Invalid cron expression string');
  }
  if (!(job instanceof Function)) {
    throw Error('No valid Job');
  }
  return cron.schedule(cronExp, job);
}
