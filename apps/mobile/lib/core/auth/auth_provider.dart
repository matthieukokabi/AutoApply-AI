import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import '../services/auth_service.dart';

/// Authentication state and token management.
///
/// Uses the backend `/api/auth/mobile` endpoint which
/// verifies credentials with Clerk and returns a JWT.

const _tokenKey = 'auth_session_token';
const _userIdKey = 'auth_user_id';
const _emailKey = 'auth_email';
const _storage = FlutterSecureStorage();

enum AuthStatus { initial, authenticated, unauthenticated, loading }

class AuthState {
  final AuthStatus status;
  final String? token;
  final String? userId;
  final String? email;
  final String? error;

  const AuthState({
    this.status = AuthStatus.initial,
    this.token,
    this.userId,
    this.email,
    this.error,
  });

  AuthState copyWith({
    AuthStatus? status,
    String? token,
    String? userId,
    String? email,
    String? error,
  }) =>
      AuthState(
        status: status ?? this.status,
        token: token ?? this.token,
        userId: userId ?? this.userId,
        email: email ?? this.email,
        error: error,
      );

  bool get isAuthenticated => status == AuthStatus.authenticated;
  bool get isLoading => status == AuthStatus.loading;
}

class AuthNotifier extends StateNotifier<AuthState> {
  final AuthService _authService;

  AuthNotifier(this._authService) : super(const AuthState()) {
    _init();
  }

  /// Check for existing session on app start.
  Future<void> _init() async {
    try {
      final token = await _storage.read(key: _tokenKey);
      final userId = await _storage.read(key: _userIdKey);
      final email = await _storage.read(key: _emailKey);

      if (token != null && token.isNotEmpty) {
        state = AuthState(
          status: AuthStatus.authenticated,
          token: token,
          userId: userId,
          email: email,
        );
      } else {
        state = const AuthState(status: AuthStatus.unauthenticated);
      }
    } catch (_) {
      state = const AuthState(status: AuthStatus.unauthenticated);
    }
  }

  /// Sign in with email and password via the backend.
  Future<void> signIn(String email, String password) async {
    try {
      state = state.copyWith(status: AuthStatus.loading, error: null);

      final result = await _authService.signIn(
        email: email.trim(),
        password: password,
      );

      await _persistSession(result);

      state = AuthState(
        status: AuthStatus.authenticated,
        token: result.token,
        userId: result.userId,
        email: result.email,
      );
    } on AuthException catch (e) {
      state = state.copyWith(
        status: AuthStatus.unauthenticated,
        error: e.message,
      );
    } catch (e) {
      state = state.copyWith(
        status: AuthStatus.unauthenticated,
        error: 'An unexpected error occurred. Please try again.',
      );
    }
  }

  /// Create a new account.
  Future<void> signUp(String email, String password) async {
    try {
      state = state.copyWith(status: AuthStatus.loading, error: null);

      final result = await _authService.signUp(
        email: email.trim(),
        password: password,
      );

      await _persistSession(result);

      state = AuthState(
        status: AuthStatus.authenticated,
        token: result.token,
        userId: result.userId,
        email: result.email,
      );
    } on AuthException catch (e) {
      state = state.copyWith(
        status: AuthStatus.unauthenticated,
        error: e.message,
      );
    } catch (e) {
      state = state.copyWith(
        status: AuthStatus.unauthenticated,
        error: 'An unexpected error occurred. Please try again.',
      );
    }
  }

  /// Sign out and clear stored session.
  Future<void> signOut() async {
    await _storage.delete(key: _tokenKey);
    await _storage.delete(key: _userIdKey);
    await _storage.delete(key: _emailKey);
    state = const AuthState(status: AuthStatus.unauthenticated);
  }

  /// Store a token directly (e.g. from deep link or web auth redirect).
  Future<void> setToken(String token) async {
    await _storage.write(key: _tokenKey, value: token);
    state = AuthState(
      status: AuthStatus.authenticated,
      token: token,
    );
  }

  /// Clear any auth error.
  void clearError() {
    if (state.error != null) {
      state = state.copyWith(error: null);
    }
  }

  Future<void> _persistSession(AuthResult result) async {
    await _storage.write(key: _tokenKey, value: result.token);
    await _storage.write(key: _userIdKey, value: result.userId);
    await _storage.write(key: _emailKey, value: result.email);
  }
}

/// Auth service provider (singleton).
final authServiceProvider = Provider<AuthService>((ref) {
  return AuthService();
});

/// Auth state provider.
final authProvider = StateNotifierProvider<AuthNotifier, AuthState>((ref) {
  final authService = ref.watch(authServiceProvider);
  return AuthNotifier(authService);
});
