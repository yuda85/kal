import { readFileSync } from 'node:fs';
import { assertFails, assertSucceeds, initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, writeBatch } from 'firebase/firestore';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';

let env: RulesTestEnvironment;

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-kal',
    firestore: { rules: readFileSync('firestore.rules', 'utf8') },
  });
});

afterAll(async () => {
  await env.cleanup();
});

beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), 'owners/alice'), { since: '2026-09-27' });
    await setDoc(doc(ctx.firestore(), 'users/alice/entries/e1'), { kcal: 100 });
    await setDoc(doc(ctx.firestore(), 'users/alice'), { heightCm: 178 });
  });
});

describe('firestore rules', () => {
  it('lets anyone read a user profile and sub-collections', async () => {
    const db = env.unauthenticatedContext().firestore();
    await assertSucceeds(getDoc(doc(db, 'users/alice')));
    await assertSucceeds(getDoc(doc(db, 'users/alice/entries/e1')));
  });

  it('lets the registered owner write', async () => {
    const db = env.authenticatedContext('alice').firestore();
    await assertSucceeds(setDoc(doc(db, 'users/alice/entries/e2'), { kcal: 200 }));
    await assertSucceeds(setDoc(doc(db, 'users/alice'), { heightCm: 179 }));
  });

  it('lets the owner commit a 25-document batch', async () => {
    const db = env.authenticatedContext('alice').firestore();
    const batch = writeBatch(db);
    for (let i = 0; i < 25; i++) batch.set(doc(db, `users/alice/entries/b${i}`), { kcal: i });
    await assertSucceeds(batch.commit());
  });

  it('blocks a signed-in stranger from writing their own tree', async () => {
    const db = env.authenticatedContext('bob').firestore();
    await assertFails(setDoc(doc(db, 'users/bob/entries/e1'), { kcal: 1 }));
  });

  it('blocks another signed-in user from writing the owner tree', async () => {
    const db = env.authenticatedContext('bob').firestore();
    await assertFails(setDoc(doc(db, 'users/alice/entries/e3'), { kcal: 1 }));
  });

  it('blocks unauthenticated writes', async () => {
    const db = env.unauthenticatedContext().firestore();
    await assertFails(setDoc(doc(db, 'users/alice/entries/e4'), { kcal: 1 }));
  });

  it('blocks clients from registering owners', async () => {
    const db = env.authenticatedContext('bob').firestore();
    await assertFails(setDoc(doc(db, 'owners/bob'), { since: 'now' }));
  });

  it('blocks writes outside users/ and owners/', async () => {
    const db = env.authenticatedContext('alice').firestore();
    await assertFails(setDoc(doc(db, 'other/x'), { a: 1 }));
  });
});
