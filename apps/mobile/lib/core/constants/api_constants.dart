class ApiConstants {
  // For local dev on iOS simulator use localhost,
  // for Android emulator use 10.0.2.2
  static const String baseUrl = 'http://localhost:3000/api';

  // Auth
  static const String signIn = '/auth/sign-in';
  static const String signUp = '/auth/sign-up';

  // Profile
  static const String profile = '/profile';
  static const String profileUpload = '/profile/upload';

  // Jobs
  static const String jobs = '/jobs';

  // Applications
  static const String applications = '/applications';

  // Tailor
  static const String tailor = '/tailor';

  // Preferences
  static const String preferences = '/preferences';

  // Stats
  static const String stats = '/stats';

  // Onboarding
  static const String onboarding = '/onboarding';
}
