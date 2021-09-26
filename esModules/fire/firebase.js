

// Your web app's Firebase configuration
var firebaseConfig = {
  apiKey: "AIzaSyAUG8-nBmseDwQHtsL-FXoNApwCljBjj9Q",
  authDomain: "viola-1.firebaseapp.com",
  databaseURL: "https://viola-1.firebaseio.com",
  projectId: "viola-1",
  storageBucket: "viola-1.appspot.com",
  messagingSenderId: "680410080758",
  appId: "1:680410080758:web:8b284da2319c63efca13d7"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);

firebase.auth().setPersistence(firebase.auth.Auth.Persistence.LOCAL);
