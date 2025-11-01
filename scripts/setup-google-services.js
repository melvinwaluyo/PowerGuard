const fs = require('fs');
const path = require('path');

/**
 * Script to generate google-services.json from EAS secret during build
 * This file is needed for Firebase/FCM on Android
 */

const GOOGLE_SERVICES_JSON = process.env.GOOGLE_SERVICES_JSON;

if (!GOOGLE_SERVICES_JSON) {
  console.error('Error: GOOGLE_SERVICES_JSON environment variable is not set!');
  console.error('Please set it using: eas secret:create --scope project --name GOOGLE_SERVICES_JSON --value "$(cat google-services.json)" --type string');
  process.exit(1);
}

const targetPath = path.join(__dirname, '..', 'android', 'app', 'google-services.json');
const targetDir = path.dirname(targetPath);

// Ensure android/app directory exists
if (!fs.existsSync(targetDir)) {
  fs.mkdirSync(targetDir, { recursive: true });
}

// Write the google-services.json file
try {
  // Parse to validate it's proper JSON
  const parsedJson = JSON.parse(GOOGLE_SERVICES_JSON);

  // Write formatted JSON
  fs.writeFileSync(targetPath, JSON.stringify(parsedJson, null, 2));

  console.log('✓ Successfully created google-services.json at:', targetPath);
} catch (error) {
  console.error('Error creating google-services.json:', error.message);
  process.exit(1);
}
