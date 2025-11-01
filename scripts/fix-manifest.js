#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

/**
 * Post-prebuild script to fix Firebase notification color manifest conflict
 * This adds tools:replace="android:resource" to the notification color meta-data
 */

const manifestPath = path.join(__dirname, '..', 'android', 'app', 'src', 'main', 'AndroidManifest.xml');

// Check if android folder exists (only runs after prebuild)
if (!fs.existsSync(manifestPath)) {
  console.log('ℹ️  Android manifest not found - skipping fix (run prebuild first)');
  process.exit(0);
}

try {
  let manifestContent = fs.readFileSync(manifestPath, 'utf-8');

  // Check if we need to apply the fix
  const hasFirebaseColor = manifestContent.includes('com.google.firebase.messaging.default_notification_color');
  const hasToolsReplace = manifestContent.includes('tools:replace="android:resource"');
  const hasToolsNamespace = manifestContent.includes('xmlns:tools=');

  if (hasFirebaseColor && !hasToolsReplace) {
    let modified = false;

    // Step 1: Add xmlns:tools namespace if not present
    if (!hasToolsNamespace) {
      manifestContent = manifestContent.replace(
        /<manifest xmlns:android="http:\/\/schemas\.android\.com\/apk\/res\/android">/,
        '<manifest xmlns:android="http://schemas.android.com/apk/res/android"\n    xmlns:tools="http://schemas.android.com/tools">'
      );
      console.log('✅ Added xmlns:tools namespace to manifest');
      modified = true;
    }

    // Step 2: Add tools:replace attribute to Firebase notification color
    const firebaseColorPattern = /(<meta-data\s+android:name="com\.google\.firebase\.messaging\.default_notification_color"\s+android:resource="@color\/notification_icon_color")(\s*\/>)/;

    const updatedContent = manifestContent.replace(
      firebaseColorPattern,
      '$1 tools:replace="android:resource"$2'
    );

    if (updatedContent !== manifestContent) {
      fs.writeFileSync(manifestPath, updatedContent, 'utf-8');
      console.log('✅ Added tools:replace="android:resource" to Firebase notification color meta-data');
      modified = true;
    } else if (!modified) {
      console.log('⚠️  Could not apply manifest fix - regex did not match');
    }

    if (modified && updatedContent === manifestContent) {
      // Only namespace was added, still need to write it
      fs.writeFileSync(manifestPath, manifestContent, 'utf-8');
    }
  } else if (hasToolsReplace) {
    console.log('✅ Manifest already has tools:replace - no action needed');
  } else {
    console.log('ℹ️  Firebase notification color meta-data not found - no action needed');
  }
} catch (error) {
  console.error('❌ Error fixing manifest:', error.message);
  process.exit(1);
}
