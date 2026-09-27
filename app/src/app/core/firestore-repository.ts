import { Injectable } from '@angular/core';
import { collection, deleteDoc, doc, onSnapshot, query, setDoc, where, writeBatch } from 'firebase/firestore';
import { mergeManual, type Day, type Entry, type Goal, type PlannedWrites, type Profile, type Recipe, type WeighIn } from '../domain';
import { firestore } from './firebase';
import { KalRepository, type SetupWrite, type Unsubscribe } from './repository';

@Injectable()
export class FirestoreKalRepository extends KalRepository {
  private readonly db = firestore();

  private userDoc(uid: string) {
    return doc(this.db, 'users', uid);
  }

  private col(uid: string, name: string) {
    return collection(this.db, 'users', uid, name);
  }

  watchProfile(uid: string, cb: (p: Profile | null) => void): Unsubscribe {
    return onSnapshot(this.userDoc(uid), (s) => cb(s.exists() ? (s.data() as Profile) : null));
  }

  watchGoals(uid: string, cb: (goals: Goal[]) => void): Unsubscribe {
    return onSnapshot(this.col(uid, 'goals'), (qs) => cb(qs.docs.map((d) => ({ ...(d.data() as Omit<Goal, 'id'>), id: d.id }))));
  }

  watchEntries(uid: string, from: string, cb: (entries: Entry[]) => void): Unsubscribe {
    const q = query(this.col(uid, 'entries'), where('date', '>=', from));
    return onSnapshot(q, (qs) => cb(qs.docs.map((d) => ({ ...(d.data() as Omit<Entry, 'id'>), id: d.id }))));
  }

  watchDays(uid: string, cb: (days: Day[]) => void): Unsubscribe {
    return onSnapshot(this.col(uid, 'days'), (qs) => cb(qs.docs.map((d) => ({ ...(d.data() as Omit<Day, 'date'>), date: d.id }))));
  }

  watchWeighIns(uid: string, cb: (weighIns: WeighIn[]) => void): Unsubscribe {
    return onSnapshot(this.col(uid, 'weights'), (qs) => cb(qs.docs.map((d) => ({ ...(d.data() as Omit<WeighIn, 'date'>), date: d.id }))));
  }

  watchRecipes(uid: string, cb: (recipes: Recipe[]) => void): Unsubscribe {
    return onSnapshot(this.col(uid, 'recipes'), (qs) => cb(qs.docs.map((d) => ({ ...(d.data() as Omit<Recipe, 'id'>), id: d.id }))));
  }

  applyWrites(uid: string, writes: PlannedWrites, days: Day[]): Promise<void> {
    const batch = writeBatch(this.db);
    for (const { id, ...data } of writes.entries) batch.set(doc(this.col(uid, 'entries'), id), data);
    for (const { id, ...data } of writes.recipes) {
      batch.set(doc(this.col(uid, 'recipes'), id), { ...data, updatedAt: new Date().toISOString() });
    }
    for (const { date, ...data } of writes.weights) batch.set(doc(this.col(uid, 'weights'), date), data);
    const manualByDate = new Map(days.map((d) => [d.date, d.manual]));
    for (const a of writes.activities) {
      const manual = mergeManual(manualByDate.get(a.date), a);
      manualByDate.set(a.date, manual);
      batch.set(doc(this.col(uid, 'days'), a.date), { manual }, { merge: true });
    }
    return batch.commit();
  }

  saveEntry(uid: string, entry: Entry): Promise<void> {
    const { id, ...data } = entry;
    return setDoc(doc(this.col(uid, 'entries'), id), data);
  }

  deleteEntry(uid: string, id: string): Promise<void> {
    return deleteDoc(doc(this.col(uid, 'entries'), id));
  }

  deleteRecipe(uid: string, id: string): Promise<void> {
    return deleteDoc(doc(this.col(uid, 'recipes'), id));
  }

  saveSetup(uid: string, setup: SetupWrite): Promise<void> {
    const batch = writeBatch(this.db);
    batch.set(this.userDoc(uid), { ...setup.profile, computed: setup.computed });
    if (setup.previousGoalId && setup.previousGoalId !== setup.goal.id) {
      batch.set(doc(this.col(uid, 'goals'), setup.previousGoalId), { active: false }, { merge: true });
    }
    const { id: goalId, ...goal } = setup.goal;
    batch.set(doc(this.col(uid, 'goals'), goalId), goal);
    const { date, ...weighIn } = setup.weighIn;
    batch.set(doc(this.col(uid, 'weights'), date), weighIn);
    return batch.commit();
  }
}
