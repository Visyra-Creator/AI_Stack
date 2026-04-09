# Welcome to your Expo app 👋

This is an [Expo](https://expo.dev) project created with [`create-expo-app`](https://www.npmjs.com/package/create-expo-app).

## Get started

1. Install dependencies

   ```bash
   npm install
   ```

2. Start the app

   ```bash
   npx expo start
   ```

In the output, you'll find options to open the app in a

- [development build](https://docs.expo.dev/develop/development-builds/introduction/)
- [Android emulator](https://docs.expo.dev/workflow/android-studio-emulator/)
- [iOS simulator](https://docs.expo.dev/workflow/ios-simulator/)
- [Expo Go](https://expo.dev/go), a limited sandbox for trying out app development with Expo

## Local Android builds

If `npx eas build -p android --local` fails with a Gradle error like `Unsupported class file major version 70`, your local Java runtime is too new for the Android/Gradle toolchain.

On macOS with `zsh`, install JDK 17 with the Homebrew cask `temurin@17`, then make sure both `JAVA_HOME` and `PATH` point to it before retrying the build:

```bash
brew install --cask temurin@17
export JAVA_HOME=$(/usr/libexec/java_home -v 17)
export PATH="$JAVA_HOME/bin:$PATH"
hash -r
java -version
```

If `java -version` still shows Java 26, open a new terminal window or check for other shell startup files overriding `JAVA_HOME` or `PATH`.

If Gradle reports `SDK location not found`, make sure Android Studio's SDK is installed and either `ANDROID_HOME` or `ANDROID_SDK_ROOT` points to it. The build hook `eas-build-pre-build` now writes `android/local.properties` automatically when that environment variable is available.

Example:

```bash
export ANDROID_SDK_ROOT="$HOME/Library/Android/sdk"
```

You can also run a quick preflight check:

```bash
npm run check:android-sdk
```

It prints whether the SDK path is set and whether `android/local.properties` is already present or will be generated during the build hook.

You can start developing by editing the files inside the **app** directory. This project uses [file-based routing](https://docs.expo.dev/router/introduction).

## Get a fresh project

When you're ready, run:

```bash
npm run reset-project
```

This command will move the starter code to the **app-example** directory and create a blank **app** directory where you can start developing.

## Learn more

To learn more about developing your project with Expo, look at the following resources:

- [Expo documentation](https://docs.expo.dev/): Learn fundamentals, or go into advanced topics with our [guides](https://docs.expo.dev/guides).
- [Learn Expo tutorial](https://docs.expo.dev/tutorial/introduction/): Follow a step-by-step tutorial where you'll create a project that runs on Android, iOS, and the web.

## Join the community

Join our community of developers creating universal apps.

- [Expo on GitHub](https://github.com/expo/expo): View our open source platform and contribute.
- [Discord community](https://chat.expo.dev): Chat with Expo users and ask questions.
