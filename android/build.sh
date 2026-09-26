#!/bin/sh
# Prefer explicit environment configuration, then Android Studio's usual paths.
set -eu
cd "$(dirname "$0")"
if [ -z "${JAVA_HOME:-}" ]; then
  for fittrack_jdk in '/Applications/Android Studio.app/Contents/jbr/Contents/Home' '/opt/android-studio/jbr' "$HOME/android-studio/jbr"; do
    if [ -x "$fittrack_jdk/bin/java" ]; then export JAVA_HOME="$fittrack_jdk"; break; fi
  done
fi
if [ -z "${ANDROID_HOME:-}" ] && [ -z "${ANDROID_SDK_ROOT:-}" ] && [ ! -f local.properties ]; then
  for fittrack_sdk in "$HOME/Library/Android/sdk" "$HOME/Android/Sdk"; do
    if [ -d "$fittrack_sdk/platforms" ]; then export ANDROID_HOME="$fittrack_sdk"; break; fi
  done
fi
exec ./gradlew "$@"
