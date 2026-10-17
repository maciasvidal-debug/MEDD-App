import { bench, describe } from 'vitest';
import { openDB } from 'idb';
import 'fake-indexeddb/auto';

describe('saveManySurveys IDB bulk operation optimization', async () => {
  const db = await openDB('bench-db', 1, {
    upgrade(db) {
      db.createObjectStore('surveys', { keyPath: 'id' });
    }
  });

  const surveys = Array.from({ length: 2000 }, (_, i) => ({ id: `id-${i}`, value: i }));

  bench('current implementation (for..of)', async () => {
    const tx = db.transaction('surveys', 'readwrite');
    for (const s of surveys) {
      tx.store.put(s);
    }
    await tx.done;
  });

  bench('standard for loop with cached length', async () => {
    const tx = db.transaction('surveys', 'readwrite');
    for (let i = 0, len = surveys.length; i < len; i++) {
      tx.store.put(surveys[i]);
    }
    await tx.done;
  });

  bench('Promise.all with array map', async () => {
    const tx = db.transaction('surveys', 'readwrite');
    await Promise.all(surveys.map(s => tx.store.put(s)));
    await tx.done;
  });
});
