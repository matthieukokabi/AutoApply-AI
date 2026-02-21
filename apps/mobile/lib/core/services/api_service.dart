import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../network/dio_client.dart';
import '../models/models.dart';

/// Centralized API service that wraps all HTTP calls.
final apiServiceProvider = Provider<ApiService>((ref) {
  return ApiService(ref.watch(dioProvider));
});

class ApiService {
  final Dio _dio;

  ApiService(this._dio);

  // ─── Stats ───
  Future<DashboardStats> getStats() async {
    final res = await _dio.get('/stats');
    return DashboardStats.fromJson(res.data as Map<String, dynamic>);
  }

  // ─── Profile ───
  Future<MasterProfile?> getProfile() async {
    final res = await _dio.get('/profile');
    final data = res.data as Map<String, dynamic>;
    if (data['profile'] == null) return null;
    return MasterProfile.fromJson(data['profile'] as Map<String, dynamic>);
  }

  Future<MasterProfile> saveProfileText(String rawText) async {
    final res = await _dio.post('/profile/upload', data: {
      'rawText': rawText,
      'fileName': 'paste',
    },);
    final data = res.data as Map<String, dynamic>;
    return MasterProfile.fromJson(data['profile'] as Map<String, dynamic>);
  }

  // ─── Preferences ───
  Future<JobPreferences?> getPreferences() async {
    final res = await _dio.get('/preferences');
    final data = res.data as Map<String, dynamic>;
    if (data['preferences'] == null) return null;
    return JobPreferences.fromJson(
        data['preferences'] as Map<String, dynamic>,);
  }

  Future<JobPreferences> savePreferences({
    required List<String> targetTitles,
    required List<String> locations,
    required String remotePreference,
    String? salaryMin,
    List<String> industries = const [],
  }) async {
    final res = await _dio.put('/preferences', data: {
      'targetTitles': targetTitles,
      'locations': locations,
      'remotePreference': remotePreference,
      'salaryMin': salaryMin,
      'industries': industries,
    },);
    final data = res.data as Map<String, dynamic>;
    return JobPreferences.fromJson(
        data['preferences'] as Map<String, dynamic>,);
  }

  // ─── Applications ───
  Future<List<Application>> getApplications({String? status}) async {
    final params = <String, dynamic>{};
    if (status != null) params['status'] = status;
    final res = await _dio.get('/applications', queryParameters: params);
    final data = res.data as Map<String, dynamic>;
    final list = data['applications'] as List<dynamic>;
    return list
        .map((e) => Application.fromJson(e as Map<String, dynamic>))
        .toList();
  }

  Future<Application> getApplication(String id) async {
    final res = await _dio.get('/applications/$id');
    final data = res.data as Map<String, dynamic>;
    return Application.fromJson(data['application'] as Map<String, dynamic>);
  }

  Future<void> updateApplicationStatus(String id, String status) async {
    await _dio.patch('/applications/$id', data: {'status': status});
  }

  // ─── Jobs ───
  Future<List<Job>> getJobs({int? skip, int? take}) async {
    final params = <String, dynamic>{};
    if (skip != null) params['skip'] = skip;
    if (take != null) params['take'] = take;
    final res = await _dio.get('/jobs', queryParameters: params);
    final data = res.data as Map<String, dynamic>;
    final list = data['jobs'] as List<dynamic>;
    return list.map((e) => Job.fromJson(e as Map<String, dynamic>)).toList();
  }

  // ─── Tailor ───
  Future<Application> tailorForJob(String jobId) async {
    final res = await _dio.post('/tailor', data: {'jobId': jobId});
    final data = res.data as Map<String, dynamic>;
    return Application.fromJson(data['application'] as Map<String, dynamic>);
  }

  // ─── Paste Job ───
  Future<Job> pasteJob({
    required String title,
    required String company,
    required String location,
    String? description,
    String? url,
  }) async {
    final res = await _dio.post('/jobs', data: {
      'title': title,
      'company': company,
      'location': location,
      'description': description,
      'url': url,
    },);
    final data = res.data as Map<String, dynamic>;
    return Job.fromJson(data['job'] as Map<String, dynamic>);
  }

  // ─── Onboarding ───
  Future<Map<String, dynamic>> checkOnboarding() async {
    final res = await _dio.get('/onboarding');
    return res.data as Map<String, dynamic>;
  }
}
