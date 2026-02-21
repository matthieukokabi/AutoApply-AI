// Data models matching the Next.js API responses.
// Using plain Dart classes (no code-gen) for simplicity.

class UserModel {
  final String id;
  final String email;
  final String name;
  final String subscriptionStatus;
  final int creditsRemaining;

  UserModel({
    required this.id,
    required this.email,
    required this.name,
    required this.subscriptionStatus,
    required this.creditsRemaining,
  });

  factory UserModel.fromJson(Map<String, dynamic> json) => UserModel(
        id: json['id'] as String? ?? '',
        email: json['email'] as String? ?? '',
        name: json['name'] as String? ?? '',
        subscriptionStatus: json['subscriptionStatus'] as String? ?? 'free',
        creditsRemaining: json['creditsRemaining'] as int? ?? 0,
      );
}

class DashboardStats {
  final int totalApplications;
  final int tailoredDocs;
  final int avgScore;
  final int pendingReview;
  final int monthlyUsage;
  final int creditsRemaining;
  final String subscriptionStatus;
  final Map<String, int> byStatus;

  DashboardStats({
    required this.totalApplications,
    required this.tailoredDocs,
    required this.avgScore,
    required this.pendingReview,
    required this.monthlyUsage,
    required this.creditsRemaining,
    required this.subscriptionStatus,
    required this.byStatus,
  });

  factory DashboardStats.empty() => DashboardStats(
        totalApplications: 0,
        tailoredDocs: 0,
        avgScore: 0,
        pendingReview: 0,
        monthlyUsage: 0,
        creditsRemaining: 0,
        subscriptionStatus: 'free',
        byStatus: {},
      );

  factory DashboardStats.fromJson(Map<String, dynamic> json) => DashboardStats(
        totalApplications: json['totalApplications'] as int? ?? 0,
        tailoredDocs: json['tailoredDocs'] as int? ?? 0,
        avgScore: json['avgScore'] as int? ?? 0,
        pendingReview: json['pendingReview'] as int? ?? 0,
        monthlyUsage: json['monthlyUsage'] as int? ?? 0,
        creditsRemaining: json['creditsRemaining'] as int? ?? 0,
        subscriptionStatus: json['subscriptionStatus'] as String? ?? 'free',
        byStatus: (json['byStatus'] as Map<String, dynamic>?)?.map(
              (k, v) => MapEntry(k, v as int),
            ) ??
            {},
      );
}

class MasterProfile {
  final String id;
  final String userId;
  final String rawText;
  final Map<String, dynamic>? structuredJson;

  MasterProfile({
    required this.id,
    required this.userId,
    required this.rawText,
    this.structuredJson,
  });

  factory MasterProfile.fromJson(Map<String, dynamic> json) => MasterProfile(
        id: json['id'] as String? ?? '',
        userId: json['userId'] as String? ?? '',
        rawText: json['rawText'] as String? ?? '',
        structuredJson: json['structuredJson'] as Map<String, dynamic>?,
      );
}

class JobPreferences {
  final String id;
  final String userId;
  final List<String> targetTitles;
  final List<String> locations;
  final String remotePreference;
  final int? salaryMin;
  final List<String> industries;

  JobPreferences({
    required this.id,
    required this.userId,
    required this.targetTitles,
    required this.locations,
    required this.remotePreference,
    this.salaryMin,
    required this.industries,
  });

  factory JobPreferences.fromJson(Map<String, dynamic> json) => JobPreferences(
        id: json['id'] as String? ?? '',
        userId: json['userId'] as String? ?? '',
        targetTitles: (json['targetTitles'] as List<dynamic>?)
                ?.map((e) => e as String)
                .toList() ??
            [],
        locations: (json['locations'] as List<dynamic>?)
                ?.map((e) => e as String)
                .toList() ??
            [],
        remotePreference: json['remotePreference'] as String? ?? 'any',
        salaryMin: json['salaryMin'] as int?,
        industries: (json['industries'] as List<dynamic>?)
                ?.map((e) => e as String)
                .toList() ??
            [],
      );
}

class Job {
  final String id;
  final String title;
  final String company;
  final String location;
  final String? source;
  final String? url;
  final String? salary;
  final String? description;
  final DateTime? createdAt;

  Job({
    required this.id,
    required this.title,
    required this.company,
    required this.location,
    this.source,
    this.url,
    this.salary,
    this.description,
    this.createdAt,
  });

  factory Job.fromJson(Map<String, dynamic> json) => Job(
        id: json['id'] as String? ?? '',
        title: json['title'] as String? ?? '',
        company: json['company'] as String? ?? '',
        location: json['location'] as String? ?? '',
        source: json['source'] as String?,
        url: json['url'] as String?,
        salary: json['salary'] as String?,
        description: json['description'] as String?,
        createdAt: json['createdAt'] != null
            ? DateTime.tryParse(json['createdAt'] as String)
            : null,
      );
}

class Application {
  final String id;
  final String userId;
  final String jobId;
  final String status;
  final int? compatibilityScore;
  final String? tailoredCvUrl;
  final String? coverLetterUrl;
  final String? tailoredCvMarkdown;
  final String? coverLetterMarkdown;
  final List<String>? atsKeywords;
  final List<String>? matchingStrengths;
  final List<String>? gaps;
  final DateTime? createdAt;
  final Job? job;

  Application({
    required this.id,
    required this.userId,
    required this.jobId,
    required this.status,
    this.compatibilityScore,
    this.tailoredCvUrl,
    this.coverLetterUrl,
    this.tailoredCvMarkdown,
    this.coverLetterMarkdown,
    this.atsKeywords,
    this.matchingStrengths,
    this.gaps,
    this.createdAt,
    this.job,
  });

  factory Application.fromJson(Map<String, dynamic> json) => Application(
        id: json['id'] as String? ?? '',
        userId: json['userId'] as String? ?? '',
        jobId: json['jobId'] as String? ?? '',
        status: json['status'] as String? ?? 'discovered',
        compatibilityScore: json['compatibilityScore'] as int?,
        tailoredCvUrl: json['tailoredCvUrl'] as String?,
        coverLetterUrl: json['coverLetterUrl'] as String?,
        tailoredCvMarkdown: json['tailoredCvMarkdown'] as String?,
        coverLetterMarkdown: json['coverLetterMarkdown'] as String?,
        atsKeywords: (json['atsKeywords'] as List<dynamic>?)
            ?.map((e) => e as String)
            .toList(),
        matchingStrengths: (json['matchingStrengths'] as List<dynamic>?)
            ?.map((e) => e as String)
            .toList(),
        gaps: (json['gaps'] as List<dynamic>?)
            ?.map((e) => e as String)
            .toList(),
        createdAt: json['createdAt'] != null
            ? DateTime.tryParse(json['createdAt'] as String)
            : null,
        job: json['job'] != null
            ? Job.fromJson(json['job'] as Map<String, dynamic>)
            : null,
      );

  String get statusLabel {
    switch (status) {
      case 'discovered':
        return 'Discovered';
      case 'tailored':
        return 'Tailored';
      case 'applied':
        return 'Applied';
      case 'interview':
        return 'Interview';
      case 'offer':
        return 'Offer';
      case 'rejected':
        return 'Rejected';
      default:
        return status;
    }
  }
}
