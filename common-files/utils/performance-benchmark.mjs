import { performance } from 'node:perf_hooks';

class PerformanceBenchmark {
  #events = new Set();

  start(id) {
    this.#events.add({
      id,
      type: 'start',
      now: performance.now(),
    });
  }

  stop(id) {
    this.#events.add({
      id,
      type: 'stop',
      now: performance.now(),
    });
  }

  stats(id = null) {
    const groupEvents = [...this.#events.values()].reduce((accumulator, currentValue) => {
      return {
        ...accumulator,
        [currentValue.id]: {
          ...accumulator?.[currentValue.id],
          [currentValue.type]: [
            ...(accumulator[currentValue.id]?.[currentValue.type] ?? []),
            currentValue.now,
          ],
        },
      };
    }, {});

    const stats = Object.entries(groupEvents).reduce((accumulator, [key, value]) => {
      const count = value.start.length;
      const duration = value.stop.map((item, index) => ({
        start: value.start[index],
        stop: item,
        duration: item - value.start[index],
      }));
      const durationMap = duration.map(i => i.duration);
      const durationMax = Math.max(...durationMap);
      const ducrationMin = Math.min(...durationMap);
      const durationMean = durationMap.reduce((a, b) => a + b, 0) / count;

      return {
        ...accumulator,
        [key]: {
          id: key,
          count,
          duration,
          durationMax,
          ducrationMin,
          durationMean,
        },
      };
    }, {});

    return id ? stats[id] : stats;
  }

  reset() {
    this.#events.clear();
  }
}

export default PerformanceBenchmark;
