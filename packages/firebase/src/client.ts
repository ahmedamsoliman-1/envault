import {
  getApp,
  getApps,
  initializeApp,
  type FirebaseOptions,
} from "firebase/app";
import { connectAuthEmulator, getAuth, type Auth } from "firebase/auth";

let emulatorConnected = false;

export function getFirebaseClientAuth(
  options: FirebaseOptions,
  emulatorUrl?: string,
): Auth {
  const app = getApps().length === 0 ? initializeApp(options) : getApp();
  const auth = getAuth(app);

  if (emulatorUrl && !emulatorConnected) {
    connectAuthEmulator(auth, emulatorUrl, { disableWarnings: true });
    emulatorConnected = true;
  }

  return auth;
}
