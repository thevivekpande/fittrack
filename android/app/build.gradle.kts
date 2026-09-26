plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

android {
    namespace = "com.fittrack.app"
    compileSdk = 36
    defaultConfig {
        applicationId = "com.fittrack.app"
        minSdk = 28
        targetSdk = 36
        versionCode = 1
        versionName = "1.0.0"
    }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions { jvmTarget = "17" }
    buildTypes {
        release {
            isMinifyEnabled = false
            proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"), "proguard-rules.pro")
        }
    }
    lint { abortOnError = true }
}

dependencies {
    implementation("androidx.activity:activity-ktx:1.9.3")
    implementation("androidx.core:core-ktx:1.15.0")
    implementation("androidx.lifecycle:lifecycle-runtime-ktx:2.8.7")
    implementation("androidx.webkit:webkit:1.12.1")
    implementation("androidx.health.connect:connect-client:1.1.0")
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-android:1.9.0")
    testImplementation("junit:junit:4.13.2")
    testImplementation("org.json:json:20240303")
}

tasks.register("verifyWebAssets") {
    doLast {
        check(file("src/main/assets/web/index.html").isFile) {
            "Missing FitTrack web build. Run npm run build then node scripts/prepare-android.mjs from the repository root."
        }
    }
}
tasks.named("preBuild").configure { dependsOn("verifyWebAssets") }
