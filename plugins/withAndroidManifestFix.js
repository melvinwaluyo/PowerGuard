const { withDangerousMod, AndroidConfig } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

/**
 * Config plugin to fix Firebase notification color manifest merger conflict
 * This adds tools:replace="android:resource" to the notification color meta-data
 */
const withAndroidManifestFix = (config) => {
  return withDangerousMod(config, [
    'android',
    async (config) => {
      const manifestPath = path.join(
        config.modRequest.platformProjectRoot,
        'app/src/main/AndroidManifest.xml'
      );

      let manifestContent = fs.readFileSync(manifestPath, 'utf-8');

      // Add tools namespace if not present
      if (!manifestContent.includes('xmlns:tools=')) {
        manifestContent = manifestContent.replace(
          '<manifest xmlns:android="http://schemas.android.com/apk/res/android">',
          '<manifest xmlns:android="http://schemas.android.com/apk/res/android"\n    xmlns:tools="http://schemas.android.com/tools">'
        );
      }

      // Add tools:replace to Firebase notification color meta-data
      // Handle both self-closing and non-self-closing tags
      manifestContent = manifestContent.replace(
        /<meta-data android:name="com\.google\.firebase\.messaging\.default_notification_color" android:resource="@color\/notification_icon_color"\s*\/?>/g,
        '<meta-data android:name="com.google.firebase.messaging.default_notification_color" android:resource="@color/notification_icon_color" tools:replace="android:resource"/>'
      );

      fs.writeFileSync(manifestPath, manifestContent, 'utf-8');
      console.log('✅ Fixed Firebase notification color manifest conflict');

      return config;
    },
  ]);
};

module.exports = withAndroidManifestFix;
