// Register background tasks BEFORE app starts
import "./tasks/backgroundGeofencing";
import "./tasks/backgroundFetch";

// Then start the app
import "expo-router/entry";
