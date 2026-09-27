import { Injectable, signal } from '@angular/core';
import { GoogleAuthProvider, onAuthStateChanged, signInWithPopup, signOut, type User } from 'firebase/auth';
import { firebaseAuth } from './firebase';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly auth = firebaseAuth();
  readonly user = signal<User | null | undefined>(undefined);
  readonly ready: Promise<void>;

  constructor() {
    let resolve!: () => void;
    this.ready = new Promise<void>((r) => (resolve = r));
    onAuthStateChanged(this.auth, (u) => {
      this.user.set(u);
      resolve();
    });
  }

  async signInWithGoogle(): Promise<void> {
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    await signInWithPopup(this.auth, provider);
  }

  signOut(): Promise<void> {
    return signOut(this.auth);
  }
}
