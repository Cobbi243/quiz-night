// =====================================================================
// FIREBASE CONFIG — встав сюди свої значення з Firebase Console
// =====================================================================
//
// Як отримати ці значення:
// 1. Зайди на https://console.firebase.google.com/
// 2. Створи новий проєкт (Add project)
// 3. Перейди в Project Settings (⚙️) → General → внизу натисни </> (Web app)
// 4. Зареєструй застосунок, скопіюй об'єкт firebaseConfig
// 5. Встав значення нижче
//
// Потім у Firebase Console:
// - Realtime Database → Create Database → Start in test mode
// - Authentication → Get started → Sign-in method → Anonymous → Enable
//
// =====================================================================

window.QUIZ_CONFIG = {
  firebase: {
    apiKey: "AIzaSyDKEsnf_CUmY-jZ_33xl1k1vtBpA9Q5mag",
    authDomain: "quiz-night-7c5f2.firebaseapp.com",
	databaseURL: "https://quiz-night-7c5f2-default-rtdb.europe-west1.firebasedatabase.app",
    projectId: "quiz-night-7c5f2",
    storageBucket: "quiz-night-7c5f2.firebasestorage.app",
    messagingSenderId: "1079132831455",
    appId: "1:1079132831455:web:deb90b5cfd2ab6cead736a"	  
  },

  // AI-генерація потребує Anthropic API key.
  // УВАГА: ключ буде видно у фронтенд-коді! Використовуй тільки для особистого
  // користування або проксі через свій бекенд. Залиш порожнім щоб вимкнути AI.
  anthropicApiKey: ""
};
