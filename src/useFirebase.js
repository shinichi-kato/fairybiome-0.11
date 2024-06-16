import {useState, useEffect} from 'react';
import {initializeApp, getApp, getApps} from 'firebase/app';
import {getFirestore} from 'firebase/firestore';

/**
 * .envに格納された情報を利用してfirebaseを初期化
 * @return {Array} firebase,firestore 両オブジェクト
 */
export default function useFirebase() {
  const [firebase, setFirebase] = useState(null);
  const [firestore, setFirestore] = useState(null);

  useEffect(() => {
    let fb;
    if (getApps().length === 0) {
      fb = initializeApp({
        apiKey: process.env.GATSBY_FIREBASE_API_KEY,
        authDomain: process.env.GATSBY_FIREBASE_AUTH_DOMAIN,
        projectId: process.env.GATSBY_FIREBASE_PROJECT_ID,
        storageBucket: process.env.GATSBY_FIREBASE_STORAGE_BUCKET,
        messagingSenderId: process.env.GATSBY_FIREBASE_MESSAGING_SENDER_ID,
        appId: process.env.GATSBY_FIREBASE_APP_ID,
        measurementId: process.env.GATSBY_FIREBASE_MEASUREMENT_ID,
      });
    } else {
      fb = getApp();
    }

    setFirebase(fb);
    setFirestore(getFirestore(fb));
  }, []);

  return [firebase, firestore];
}
