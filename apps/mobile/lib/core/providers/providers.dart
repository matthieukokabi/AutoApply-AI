import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../models/models.dart';
import '../services/api_service.dart';

/// Dashboard stats — auto-refreshes when invalidated.
final statsProvider = FutureProvider<DashboardStats>((ref) async {
  final api = ref.watch(apiServiceProvider);
  try {
    return await api.getStats();
  } catch (_) {
    return DashboardStats.empty();
  }
});

/// Master profile
final profileProvider = FutureProvider<MasterProfile?>((ref) async {
  final api = ref.watch(apiServiceProvider);
  try {
    return await api.getProfile();
  } catch (_) {
    return null;
  }
});

/// Job preferences
final preferencesProvider = FutureProvider<JobPreferences?>((ref) async {
  final api = ref.watch(apiServiceProvider);
  try {
    return await api.getPreferences();
  } catch (_) {
    return null;
  }
});

/// Applications list — optionally filtered by status
final applicationsProvider =
    FutureProvider.family<List<Application>, String?>((ref, status) async {
  final api = ref.watch(apiServiceProvider);
  try {
    return await api.getApplications(status: status);
  } catch (_) {
    return [];
  }
});

/// Single application detail
final applicationDetailProvider =
    FutureProvider.family<Application?, String>((ref, id) async {
  final api = ref.watch(apiServiceProvider);
  try {
    return await api.getApplication(id);
  } catch (_) {
    return null;
  }
});

/// Jobs feed
final jobsProvider = FutureProvider<List<Job>>((ref) async {
  final api = ref.watch(apiServiceProvider);
  try {
    return await api.getJobs(take: 50);
  } catch (_) {
    return [];
  }
});
