import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

/// Authentication state and token management.
///
/// In production, this would integrate with Clerk's Flutter SDK.
/// For now we use a session-token approach: the web app Clerk session
/// token is stored securely after login and attached to API requests.

const _tokenKey = 'auth_session_token';
const _storage = FlutterSecureStorage();

enum AuthStatus { initial, authenticated, unauthenticated }

class AuthState {
  final AuthStatus status;
  final String? token;
  final String? error;

  const AuthState({
    this.status = AuthStatus.initial,
    this.token,
    this.error,
  });

  AuthState copyWith({AuthStatus? status, String? token, String? error}) =>
      AuthState(
        status: status ?? this.status,
        token: token ?? this.token,
        error: error,
      );

  bool get isAuthenticated => status == AuthStatus.authenticated;
}

class AuthNotifier extends StateNotifier<AuthState> {
  AuthNotifier() : super(const AuthState()) {
    _init();
  }

  Future<void> _init() async {
    try {
      final token = await _storage.read(key: _tokenKey);
      if (token != null && token.isNotEmpty) {
        state = AuthState(
          status: AuthStatus.authenticated,
          token: token,
        );
      } else {
        state = const AuthState(status: AuthStatus.unauthenticated);
      }
    } catch (_) {
      state = const AuthState(status: AuthStatus.unauthenticated);
    }
  }

  /// Sign in with email and password via the API.
  /// In production, this calls Clerk's authentication endpoint.
  Future<void> signIn(String email, String password) async {
    try {
      state = state.copyWith(status: AuthStatus.initial, error: null);

      // For demo/development: accept any non-empty credentials
      // and store a placeholder token. In production, this would
      // call Clerk's signIn API and get a real session token.
      if (email.isNotEmpty && password.isNotEmpty) {
        const demoToken = 'demo_session_token';
        await _storage.write(key: _tokenKey, value: demoToken);
        state = const AuthState(
          status: AuthStatus.authenticated,
          token: demoToken,
        );
      } else {
        state = state.copyWith(
          status: AuthStatus.unauthenticated,
          error: 'Email and password are required',
        );
      }
    } catch (e) {
      state = state.copyWith(
        status: AuthStatus.unauthenticated,
        error: e.toString(),
      );
    }
  }

  Future<void> signOut() async {
    await _storage.delete(key: _tokenKey);
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
}

final authProvider = StateNotifierProvider<AuthNotifier, AuthState>((ref) {
  return AuthNotifier();
});
