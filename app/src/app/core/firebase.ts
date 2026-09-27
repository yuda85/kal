import { initializeApp, type FirebaseApp } from 'firebase/app';
import { getAuth, type Auth } from 'firebase/auth';
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager, type Firestore } from 'firebase/firestore';
import { firebaseConfig } from './firebase-config';

let app: FirebaseApp | undefined;
let db: Firestore | undefined;
let auth: Auth | undefined;

function firebaseApp(): FirebaseApp {
  return (app ??= initializeApp(firebaseConfig));
}

export function firestore(): Firestore {
  return (db ??= initializeFirestore(firebaseApp(), {
    localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
    ignoreUndefinedProperties: true,
  }));
}

export function firebaseAuth(): Auth {
  return (auth ??= getAuth(firebaseApp()));
}
