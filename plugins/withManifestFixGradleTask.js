const { withAppBuildGradle } = require('@expo/config-plugins');

/**
 * Config plugin to add a Gradle task that fixes the Android manifest
 * This task runs BEFORE the manifest merge, ensuring the fix is applied
 */
const withManifestFixGradleTask = (config) => {
  return withAppBuildGradle(config, (config) => {
    const gradleContent = config.modResults.contents;

    // Add a task that runs the fix-manifest.js script
    const fixManifestTask = `
// Custom task to fix Android manifest before merge
tasks.register('fixAndroidManifest', Exec) {
    description = 'Fixes Firebase notification color manifest conflict'
    workingDir rootProject.projectDir.parent
    commandLine 'node', 'scripts/fix-manifest.js'

    doFirst {
        println '🔧 Running manifest fix script...'
    }
}

// Make all manifest processing tasks depend on our fix
tasks.configureEach { task ->
    if (task.name.contains('process') && task.name.contains('MainManifest')) {
        task.dependsOn('fixAndroidManifest')
    }
}
`;

    // Insert the task at the end of the file, before the last closing brace
    if (!gradleContent.includes('fixAndroidManifest')) {
      config.modResults.contents = gradleContent + '\n' + fixManifestTask;
      console.log('✅ Added manifest fix Gradle task');
    }

    return config;
  });
};

module.exports = withManifestFixGradleTask;
