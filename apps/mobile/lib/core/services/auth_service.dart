import 'package:dio/dio.dart';
import '../config/env_config.dart';

/// Handles authentication against the AutoApply backend.
///
/// Uses the `/api/auth/mobile` endpoint which verifies
/// credentials with Clerk and returns a mobile JWT token.
class AuthService {
  late final Dio _dio;

  AuthService() {
    _dio = Dio(BaseOptions(
      baseUrl: EnvConfig.apiBaseUrl,
      connectTimeout: const Duration(seconds: 15),
      receiveTimeout: const Duration(seconds: 15),
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
    ));
  }

  /// Sign in with email and password.
  /// Returns `{ token, userId, email }` on success.
  /// Throws [AuthException] on failure.
  Future<AuthResult> signIn({
    required String email,
    required String password,
  }) async {
    try {
      final response = await _dio.post('/auth/mobile', data: {
        'email': email,
        'password': password,
        'action': 'sign-in',
      });

      final data = response.data as Map<String, dynamic>;
      return AuthResult(
        token: data['token'] as String,
        userId: data['userId'] as String,
        email: data['email'] as String,
      );
    } on DioException catch (e) {
      final message = _extractErrorMessage(e);
      throw AuthException(message);
    } catch (e) {
      throw AuthException('An unexpected error occurred');
    }
  }

  /// Create a new account with email and password.
  /// Returns `{ token, userId, email }` on success.
  /// Throws [AuthException] on failure.
  Future<AuthResult> signUp({
    required String email,
    required String password,
  }) async {
    try {
      final response = await _dio.post('/auth/mobile', data: {
        'email': email,
        'password': password,
        'action': 'sign-up',
      });

      final data = response.data as Map<String, dynamic>;
      return AuthResult(
        token: data['token'] as String,
        userId: data['userId'] as String,
        email: data['email'] as String,
      );
    } on DioException catch (e) {
      final message = _extractErrorMessage(e);
      throw AuthException(message);
    } catch (e) {
      throw AuthException('An unexpected error occurred');
    }
  }

  String _extractErrorMessage(DioException e) {
    if (e.response?.data is Map<String, dynamic>) {
      final data = e.response!.data as Map<String, dynamic>;
      return data['error'] as String? ?? 'Authentication failed';
    }
    if (e.type == DioExceptionType.connectionTimeout ||
        e.type == DioExceptionType.receiveTimeout) {
      return 'Connection timed out. Please check your internet connection.';
    }
    if (e.type == DioExceptionType.connectionError) {
      return 'Unable to connect to the server. Please try again later.';
    }
    return 'Authentication failed';
  }
}

/// Result of a successful authentication.
class AuthResult {
  final String token;
  final String userId;
  final String email;

  const AuthResult({
    required this.token,
    required this.userId,
    required this.email,
  });
}

/// Exception thrown when authentication fails.
class AuthException implements Exception {
  final String message;
  const AuthException(this.message);

  @override
  String toString() => message;
}
