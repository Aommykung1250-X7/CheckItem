import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyCkz93LxB41HPbQG3IDTYfOmFuwMtaRYlE",
  authDomain: "checkitem-107ca.firebaseapp.com",
  projectId: "checkitem-107ca",
  storageBucket: "checkitem-107ca.firebasestorage.app",
  messagingSenderId: "595102529618",
  appId: "1:595102529618:web:81a7a27ce5f065a938078b"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);