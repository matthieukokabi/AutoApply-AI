import 'package:flutter/material.dart';

class DocumentViewerPage extends StatelessWidget {
  final String applicationId;

  const DocumentViewerPage({super.key, required this.applicationId});

  @override
  Widget build(BuildContext context) {
    return DefaultTabController(
      length: 2,
      child: Scaffold(
        appBar: AppBar(
          title: const Text('Document Viewer'),
          bottom: const TabBar(
            tabs: [
              Tab(text: 'Tailored CV'),
              Tab(text: 'Cover Letter'),
            ],
          ),
          actions: [
            IconButton(
              icon: const Icon(Icons.download),
              onPressed: () {},
              tooltip: 'Download PDF',
            ),
          ],
        ),
        body: TabBarView(
          children: [
            // Tailored CV tab
            SingleChildScrollView(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // Score badge
                  Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 12,
                      vertical: 6,
                    ),
                    decoration: BoxDecoration(
                      color: Theme.of(context).colorScheme.primaryContainer,
                      borderRadius: BorderRadius.circular(20),
                    ),
                    child: Text(
                      'Match Score: --',
                      style: TextStyle(
                        color: Theme.of(context).colorScheme.onPrimaryContainer,
                        fontWeight: FontWeight.w600,
                        fontSize: 13,
                      ),
                    ),
                  ),
                  const SizedBox(height: 16),
                  Text(
                    'No tailored CV generated yet.',
                    style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                          color: Theme.of(context).colorScheme.onSurfaceVariant,
                        ),
                  ),
                ],
              ),
            ),
            // Cover Letter tab
            SingleChildScrollView(
              padding: const EdgeInsets.all(16),
              child: Text(
                'No cover letter generated yet.',
                style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                      color: Theme.of(context).colorScheme.onSurfaceVariant,
                    ),
              ),
            ),
          ],
        ),
        // Disclaimer
        bottomNavigationBar: Container(
          padding: const EdgeInsets.all(12),
          color: Theme.of(context).colorScheme.surfaceContainerHighest,
          child: Text(
            '⚠️ AI-tailored content is based solely on your provided CV. Always verify before submitting.',
            style: Theme.of(context).textTheme.bodySmall,
            textAlign: TextAlign.center,
          ),
        ),
      ),
    );
  }
}
