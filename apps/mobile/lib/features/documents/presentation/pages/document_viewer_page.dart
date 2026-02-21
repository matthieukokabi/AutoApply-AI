import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shimmer/shimmer.dart';
import '../../../../core/providers/providers.dart';
import '../../../../core/models/models.dart';

class DocumentViewerPage extends ConsumerWidget {
  final String applicationId;

  const DocumentViewerPage({super.key, required this.applicationId});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final appAsync = ref.watch(applicationDetailProvider(applicationId));

    return appAsync.when(
      loading: () => Scaffold(
        appBar: AppBar(title: const Text('Document Viewer')),
        body: Shimmer.fromColors(
          baseColor: Colors.grey.shade300,
          highlightColor: Colors.grey.shade100,
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              children: List.generate(
                8,
                (_) => Padding(
                  padding: const EdgeInsets.only(bottom: 12),
                  child: Container(height: 20, color: Colors.white),
                ),
              ),
            ),
          ),
        ),
      ),
      error: (_, __) => Scaffold(
        appBar: AppBar(title: const Text('Document Viewer')),
        body: const Center(child: Text('Failed to load document')),
      ),
      data: (app) {
        if (app == null) {
          return Scaffold(
            appBar: AppBar(title: const Text('Document Viewer')),
            body: const Center(child: Text('Application not found')),
          );
        }
        return _DocumentViewerContent(application: app);
      },
    );
  }
}

class _DocumentViewerContent extends StatelessWidget {
  final Application application;

  const _DocumentViewerContent({required this.application});

  Color _scoreColor(int? score) {
    if (score == null) return Colors.grey;
    if (score >= 80) return Colors.green;
    if (score >= 60) return Colors.orange;
    return Colors.red;
  }

  @override
  Widget build(BuildContext context) {
    return DefaultTabController(
      length: 2,
      child: Scaffold(
        appBar: AppBar(
          title: Text(application.job?.title ?? 'Document Viewer'),
          bottom: const TabBar(
            tabs: [
              Tab(text: 'Tailored CV'),
              Tab(text: 'Cover Letter'),
            ],
          ),
          actions: [
            // Score badge in app bar
            if (application.compatibilityScore != null)
              Center(
                child: Container(
                  margin: const EdgeInsets.only(right: 12),
                  padding: const EdgeInsets.symmetric(
                    horizontal: 10,
                    vertical: 4,
                  ),
                  decoration: BoxDecoration(
                    color: _scoreColor(application.compatibilityScore)
                        .withValues(alpha: 0.15),
                    borderRadius: BorderRadius.circular(20),
                  ),
                  child: Text(
                    '${application.compatibilityScore}%',
                    style: TextStyle(
                      color: _scoreColor(application.compatibilityScore),
                      fontWeight: FontWeight.bold,
                      fontSize: 13,
                    ),
                  ),
                ),
              ),
          ],
        ),
        body: Column(
          children: [
            // ATS keywords & strengths chips
            if (application.atsKeywords != null &&
                application.atsKeywords!.isNotEmpty)
              Container(
                width: double.infinity,
                padding:
                    const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                child: Wrap(
                  spacing: 6,
                  runSpacing: 4,
                  children: application.atsKeywords!.take(8).map((kw) {
                    return Chip(
                      label: Text(kw, style: const TextStyle(fontSize: 11)),
                      materialTapTargetSize: MaterialTapTargetSize.shrinkWrap,
                      padding: EdgeInsets.zero,
                      visualDensity: VisualDensity.compact,
                    );
                  }).toList(),
                ),
              ),

            // Tab content
            Expanded(
              child: TabBarView(
                children: [
                  // Tailored CV tab
                  _MarkdownTab(
                    content: application.tailoredCvMarkdown,
                    emptyMessage: 'No tailored CV generated yet.',
                  ),
                  // Cover Letter tab
                  _MarkdownTab(
                    content: application.coverLetterMarkdown,
                    emptyMessage: 'No cover letter generated yet.',
                  ),
                ],
              ),
            ),
          ],
        ),
        // Disclaimer + status
        bottomNavigationBar: Container(
          padding: const EdgeInsets.all(12),
          color: Theme.of(context).colorScheme.surfaceContainerHighest,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Chip(
                    avatar: Icon(Icons.circle,
                        size: 8, color: _statusColor(application.status),),
                    label: Text(application.statusLabel,
                        style: const TextStyle(fontSize: 12),),
                    materialTapTargetSize: MaterialTapTargetSize.shrinkWrap,
                  ),
                  if (application.job?.company != null) ...[
                    const SizedBox(width: 8),
                    Text(
                      application.job!.company,
                      style: Theme.of(context).textTheme.bodySmall,
                    ),
                  ],
                ],
              ),
              const SizedBox(height: 4),
              Text(
                '⚠️ AI-tailored content is based solely on your provided CV. Always verify before submitting.',
                style: Theme.of(context).textTheme.bodySmall,
                textAlign: TextAlign.center,
              ),
            ],
          ),
        ),
      ),
    );
  }

  Color _statusColor(String status) {
    switch (status) {
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
}

class _MarkdownTab extends StatelessWidget {
  final String? content;
  final String emptyMessage;

  const _MarkdownTab({required this.content, required this.emptyMessage});

  @override
  Widget build(BuildContext context) {
    if (content == null || content!.isEmpty) {
      return Center(
        child: Text(
          emptyMessage,
          style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                color: Theme.of(context).colorScheme.onSurfaceVariant,
              ),
        ),
      );
    }

    // Simple markdown-ish rendering (bold, headers, bullet points)
    return SingleChildScrollView(
      padding: const EdgeInsets.all(16),
      child: SelectableText.rich(
        _parseMarkdown(context, content!),
      ),
    );
  }

  TextSpan _parseMarkdown(BuildContext context, String text) {
    final lines = text.split('\n');
    final spans = <InlineSpan>[];

    for (final line in lines) {
      if (line.startsWith('# ')) {
        spans.add(TextSpan(
          text: '${line.substring(2)}\n',
          style: Theme.of(context).textTheme.titleLarge?.copyWith(
                fontWeight: FontWeight.bold,
              ),
        ),);
      } else if (line.startsWith('## ')) {
        spans.add(TextSpan(
          text: '${line.substring(3)}\n',
          style: Theme.of(context).textTheme.titleMedium?.copyWith(
                fontWeight: FontWeight.bold,
              ),
        ),);
      } else if (line.startsWith('### ')) {
        spans.add(TextSpan(
          text: '${line.substring(4)}\n',
          style: Theme.of(context).textTheme.titleSmall?.copyWith(
                fontWeight: FontWeight.bold,
              ),
        ),);
      } else if (line.startsWith('- ') || line.startsWith('* ')) {
        spans.add(TextSpan(
          text: '  • ${line.substring(2)}\n',
          style: Theme.of(context).textTheme.bodyMedium,
        ),);
      } else if (line.startsWith('**') && line.endsWith('**')) {
        spans.add(TextSpan(
          text: '${line.substring(2, line.length - 2)}\n',
          style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                fontWeight: FontWeight.bold,
              ),
        ),);
      } else {
        spans.add(TextSpan(
          text: '$line\n',
          style: Theme.of(context).textTheme.bodyMedium,
        ),);
      }
    }

    return TextSpan(children: spans);
  }
}
