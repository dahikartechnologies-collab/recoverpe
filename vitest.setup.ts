// src/lib/firebase.ts initialises the Firebase client app at import time, and
// several server modules reach it transitively through the cookie helpers.
// Dummy config keeps that initialisation from throwing under test; no network
// call is ever made.
process.env.NEXT_PUBLIC_FIREBASE_API_KEY ||= "test-api-key";
process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ||= "test.firebaseapp.com";
process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ||= "test-project";
process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ||= "test-project.appspot.com";
process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ||= "0000000000";
process.env.NEXT_PUBLIC_FIREBASE_APP_ID ||= "1:0000000000:web:testapp";
