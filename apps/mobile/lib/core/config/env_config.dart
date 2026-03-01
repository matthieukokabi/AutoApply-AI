import 'dart:io' show Platform;
import 'package:flutter_dotenv/flutter_dotenv.dart';

/// Centralized environment configuration.
///
/// Reads from `.env` file via flutter_dotenv.
/// Falls back to sensible defaults for development.
class EnvConfig {
  static bool _initialized = false;

  /// Initialize dotenv. Call once in main() before runApp().
  static Future<void> init() async {
    if (_initialized) return;
    try {
      await dotenv.load(fileName: '.env');
    } catch (_) {
      // .env file missing — use defaults
    }
    _initialized = true;
  }

  /// Current environment: development, staging, production.
  static String get environment =>
      dotenv.env['ENVIRONMENT'] ?? 'development';

  static bool get isProduction => environment == 'production';
  static bool get isDevelopment => environment == 'development';

  /// API base URL with platform-aware default for dev.
  static String get apiBaseUrl {
    final envUrl = dotenv.env['API_BASE_URL'];
    if (envUrl != null && envUrl.isNotEmpty) return envUrl;

    // Default: use localhost for iOS, 10.0.2.2 for Android emulator
    if (Platform.isAndroid) {
      return 'http://10.0.2.2:3000/api';
    }
    return 'http://localhost:3000/api';
  }
}
