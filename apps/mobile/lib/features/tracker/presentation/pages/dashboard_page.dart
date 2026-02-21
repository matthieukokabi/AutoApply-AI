import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:shimmer/shimmer.dart';
import '../../../../core/providers/providers.dart';
import '../../../../core/auth/auth_provider.dart';
import '../../../../core/models/models.dart';

class DashboardPage extends ConsumerWidget {
  const DashboardPage({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final statsAsync = ref.watch(statsProvider);
    final appsAsync = ref.watch(applicationsProvider(null));

    return Scaffold(
      appBar: AppBar(
        title: const Text('Dashboard'),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh),
            onPressed: () {
              ref.invalidate(statsProvider);
              ref.invalidate(applicationsProvider(null));
            },
            tooltip: 'Refresh',
          ),
          PopupMenuButton<String>(
            onSelected: (value) {
              if (value == 'logout') {
                ref.read(authProvider.notifier).signOut();
                context.go('/login');
              }
            },
            itemBuilder: (_) => [
              const PopupMenuItem(value: 'logout', child: Text('Sign Out')),
            ],
          ),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: () async {
          ref.invalidate(statsProvider);
          ref.invalidate(applicationsProvider(null));
        },
        child: SingleChildScrollView(
          physics: const AlwaysScrollableScrollPhysics(),
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Stats
              statsAsync.when(
                loading: () => _buildStatsShimmer(context),
                error: (_, __) => _buildStatsRow(context, DashboardStats.empty()),
                data: (stats) => _buildStatsRow(context, stats),
              ),
              const SizedBox(height: 24),

              // Recent Applications header
              Text(
                'Recent Applications',
                style: Theme.of(context).textTheme.titleMedium?.copyWith(
                      fontWeight: FontWeight.bold,
                    ),
              ),
              const SizedBox(height: 12),

              // Applications list
              appsAsync.when(
                loading: () => _buildAppsShimmer(),
                error: (_, __) => _buildEmptyState(context),
                data: (apps) {
                  if (apps.isEmpty) return _buildEmptyState(context);
                  return Column(
                    children: apps.take(10).map((app) {
                      return _ApplicationCard(application: app);
                    }).toList(),
                  );
                },
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildStatsRow(BuildContext context, DashboardStats stats) {
    return Column(
      children: [
        Row(
          children: [
            _StatCard(
              label: 'Applications',
              value: '${stats.totalApplications}',
              icon: Icons.work_outline,
              color: Colors.blue,
            ),
            const SizedBox(width: 12),
            _StatCard(
              label: 'Tailored',
              value: '${stats.tailoredDocs}',
              icon: Icons.description_outlined,
              color: Colors.purple,
            ),
          ],
        ),
        const SizedBox(height: 12),
        Row(
          children: [
            _StatCard(
              label: 'Avg Score',
              value: '${stats.avgScore}%',
              icon: Icons.trending_up,
              color: Colors.green,
            ),
            const SizedBox(width: 12),
            _StatCard(
              label: 'Pending',
              value: '${stats.pendingReview}',
              icon: Icons.schedule,
              color: Colors.orange,
            ),
          ],
        ),
        const SizedBox(height: 8),
        // Subscription info
        Container(
          width: double.infinity,
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
          decoration: BoxDecoration(
            color: Theme.of(context).colorScheme.surfaceContainerHighest,
            borderRadius: BorderRadius.circular(8),
          ),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                'Plan: ${stats.subscriptionStatus.toUpperCase()}',
                style: Theme.of(context).textTheme.bodySmall?.copyWith(
                      fontWeight: FontWeight.w600,
                    ),
              ),
              Text(
                '${stats.creditsRemaining} credits • ${stats.monthlyUsage} used this month',
                style: Theme.of(context).textTheme.bodySmall,
              ),
            ],
          ),
        ),
      ],
    );
  }

  Widget _buildStatsShimmer(BuildContext context) {
    return Shimmer.fromColors(
      baseColor: Colors.grey.shade300,
      highlightColor: Colors.grey.shade100,
      child: Column(
        children: [
          Row(
            children: [
              Expanded(child: Container(height: 80, color: Colors.white)),
              const SizedBox(width: 12),
              Expanded(child: Container(height: 80, color: Colors.white)),
            ],
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              Expanded(child: Container(height: 80, color: Colors.white)),
              const SizedBox(width: 12),
              Expanded(child: Container(height: 80, color: Colors.white)),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildAppsShimmer() {
    return Shimmer.fromColors(
      baseColor: Colors.grey.shade300,
      highlightColor: Colors.grey.shade100,
      child: Column(
        children: List.generate(
          3,
          (_) => Padding(
            padding: const EdgeInsets.only(bottom: 8),
            child: Container(height: 72, color: Colors.white),
          ),
        ),
      ),
    );
  }

  Widget _buildEmptyState(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          children: [
            Icon(
              Icons.inbox_outlined,
              size: 48,
              color: Theme.of(context).colorScheme.onSurfaceVariant,
            ),
            const SizedBox(height: 8),
            Text(
              'No applications yet',
              style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                    color: Theme.of(context).colorScheme.onSurfaceVariant,
                  ),
            ),
            const SizedBox(height: 4),
            Text(
              'Paste a job or wait for automated discovery',
              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                    color: Theme.of(context).colorScheme.onSurfaceVariant,
                  ),
            ),
          ],
        ),
      ),
    );
  }
}

class _StatCard extends StatelessWidget {
  final String label;
  final String value;
  final IconData icon;
  final Color color;

  const _StatCard({
    required this.label,
    required this.value,
    required this.icon,
    required this.color,
  });

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: Card(
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Icon(icon, color: color, size: 20),
              const SizedBox(height: 8),
              Text(
                value,
                style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                      fontWeight: FontWeight.bold,
                    ),
              ),
              Text(
                label,
                style: Theme.of(context).textTheme.bodySmall?.copyWith(
                      color: Theme.of(context).colorScheme.onSurfaceVariant,
                    ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _ApplicationCard extends StatelessWidget {
  final Application application;

  const _ApplicationCard({required this.application});

  Color _statusColor() {
    switch (application.status) {
      case 'discovered':
        return Colors.grey;
      case 'tailored':
        return Colors.blue;
      case 'applied':
        return Colors.purple;
      case 'interview':
        return Colors.orange;
      case 'offer':
        return Colors.green;
      case 'rejected':
        return Colors.red;
      default:
        return Colors.grey;
    }
  }

  @override
  Widget build(BuildContext context) {
    return Card(
      margin: const EdgeInsets.only(bottom: 8),
      child: ListTile(
        onTap: application.tailoredCvMarkdown != null
            ? () => context.push('/documents/${application.id}')
            : null,
        leading: CircleAvatar(
          backgroundColor: _statusColor().withValues(alpha: 0.15),
          child: Text(
            application.compatibilityScore != null
                ? '${application.compatibilityScore}'
                : '--',
            style: TextStyle(
              color: _statusColor(),
              fontWeight: FontWeight.bold,
              fontSize: 13,
            ),
          ),
        ),
        title: Text(
          application.job?.title ?? 'Job #${application.jobId.substring(0, 6)}',
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
        ),
        subtitle: Text(
          application.job?.company ?? '',
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
        ),
        trailing: Chip(
          label: Text(
            application.statusLabel,
            style: TextStyle(
              fontSize: 11,
              color: _statusColor(),
              fontWeight: FontWeight.w600,
            ),
          ),
          backgroundColor: _statusColor().withValues(alpha: 0.1),
          side: BorderSide.none,
          padding: EdgeInsets.zero,
          materialTapTargetSize: MaterialTapTargetSize.shrinkWrap,
        ),
      ),
    );
  }
}
