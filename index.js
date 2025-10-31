// Register background tasks BEFORE app starts
import "./tasks/backgroundGeofencing";
import "./tasks/backgroundFetch";

// Register FCM background handler BEFORE app starts
import { setBackgroundMessageHandler } from "./services/fcm";
setBackgroundMessageHandler();

// Then start the app
import "expo-router/entry";
