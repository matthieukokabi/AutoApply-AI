import '../config/env_config.dart';

class ApiConstants {
  /// Base URL from environment config.
  /// Dev iOS: http://localhost:3000/api
  /// Dev Android: http://10.0.2.2:3000/api
  /// Production: https://autoapply.works/api
  static String get baseUrl => EnvConfig.apiBaseUrl;

  // Auth (mobile-specific endpoint)
  static const String mobileAuth = '/auth/mobile';

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
