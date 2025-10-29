// Register background tasks BEFORE app starts
import "./tasks/backgroundLocation";
import "./tasks/backgroundFetch";

// Then start the app
import "expo-router/entry";
