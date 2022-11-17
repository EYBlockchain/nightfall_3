import { v4 as uuidv4 } from 'uuid';
import cls from 'cls-hooked';

const store = cls.createNamespace('correlation-id-namespace');

const CORRELATION_ID_KEY = 'correlation-id';

function withId(fn, id) {
  store.run(() => {
    store.set(CORRELATION_ID_KEY, id || uuidv4());
    fn();
  });
}

function getId() {
  return store.get(CORRELATION_ID_KEY);
}

export default {
  withId,
  getId,
  bindEmitter: store.bindEmitter.bind(store),
  bind: store.bind.bind(store),
};
