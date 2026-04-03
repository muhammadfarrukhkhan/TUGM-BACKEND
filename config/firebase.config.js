
const { initializeApp } = require("@firebase/app");
const { getStorage} = require("@firebase/storage");
require("dotenv").config()

// const firebaseConfig = {
//   apiKey:process.env.apiKey,
//   authDomain:process.env.authDomain,
//   projectId:process.env.projectId,
//   storageBucket:process.env.storageBucket,
//   messagingSenderId:process.env.messagingSenderId,
//   appId:process.env.appId,
//   measurementId:process.env.measurementId,
// };
const firebaseConfig = {
  apiKey: "AIzaSyBu5IAQX4kB-gYxecTvudHLOLTR_rektFA",
  authDomain: "tugm-23d0e.firebaseapp.com",
  databaseURL: "https://tugm-23d0e-default-rtdb.firebaseio.com",
  projectId: "tugm-23d0e",
  storageBucket: "tugm-23d0e.firebasestorage.app",
  messagingSenderId: "831109988241",
  appId: "1:831109988241:web:1c010009c59ba03ae2e430",
  measurementId: "G-RW1HZSN17Y"
};
const app = initializeApp(firebaseConfig);
const storage = getStorage(app);


module.exports = {storage}