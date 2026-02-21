import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shimmer/shimmer.dart';
import '../../../../core/providers/providers.dart';
import '../../../../core/services/api_service.dart';

class ProfilePage extends ConsumerStatefulWidget {
  const ProfilePage({super.key});

  @override
  ConsumerState<ProfilePage> createState() => _ProfilePageState();
}

class _ProfilePageState extends ConsumerState<ProfilePage> {
  final _cvTextController = TextEditingController();
  final _titlesController = TextEditingController();
  final _locationsController = TextEditingController();
  final _salaryController = TextEditingController();
  String _remote = 'any';
  bool _savingCv = false;
  bool _savingPrefs = false;

  @override
  void dispose() {
    _cvTextController.dispose();
    _titlesController.dispose();
    _locationsController.dispose();
    _salaryController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final profileAsync = ref.watch(profileProvider);
    final prefsAsync = ref.watch(preferencesProvider);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Profile & CV'),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh),
            onPressed: () {
              ref.invalidate(profileProvider);
              ref.invalidate(preferencesProvider);
            },
          ),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: () async {
          ref.invalidate(profileProvider);
          ref.invalidate(preferencesProvider);
        },
        child: SingleChildScrollView(
          physics: const AlwaysScrollableScrollPhysics(),
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              // CV Section
              Text(
                'Master CV',
                style: Theme.of(context).textTheme.titleMedium?.copyWith(
                      fontWeight: FontWeight.bold,
                    ),
              ),
              const SizedBox(height: 8),
              profileAsync.when(
                loading: () => Shimmer.fromColors(
                  baseColor: Colors.grey.shade300,
                  highlightColor: Colors.grey.shade100,
                  child: Container(height: 200, color: Colors.white),
                ),
                error: (_, __) => _buildCvUploadSection(false),
                data: (profile) {
                  if (profile != null && profile.rawText.isNotEmpty) {
                    return _buildCvLoaded(profile.rawText);
                  }
                  return _buildCvUploadSection(false);
                },
              ),

              const SizedBox(height: 24),

              // Preferences Section
              Text(
                'Job Preferences',
                style: Theme.of(context).textTheme.titleMedium?.copyWith(
                      fontWeight: FontWeight.bold,
                    ),
              ),
              const SizedBox(height: 8),
              prefsAsync.when(
                loading: () => Shimmer.fromColors(
                  baseColor: Colors.grey.shade300,
                  highlightColor: Colors.grey.shade100,
                  child: Container(height: 200, color: Colors.white),
                ),
                error: (_, __) => _buildPreferencesForm(),
                data: (prefs) {
                  // Pre-fill form if prefs exist
                  if (prefs != null && _titlesController.text.isEmpty) {
                    _titlesController.text = prefs.targetTitles.join(', ');
                    _locationsController.text = prefs.locations.join(', ');
                    _remote = prefs.remotePreference;
                    if (prefs.salaryMin != null) {
                      _salaryController.text = prefs.salaryMin.toString();
                    }
                  }
                  return _buildPreferencesForm();
                },
              ),

              const SizedBox(height: 16),

              // Disclaimer
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: Theme.of(context).colorScheme.primaryContainer,
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Row(
                  children: [
                    Icon(
                      Icons.info_outline,
                      size: 18,
                      color: Theme.of(context).colorScheme.onPrimaryContainer,
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Text(
                        'AI-tailored content is based solely on your provided CV. Always verify before submitting.',
                        style: Theme.of(context).textTheme.bodySmall?.copyWith(
                              color: Theme.of(context)
                                  .colorScheme
                                  .onPrimaryContainer,
                            ),
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildCvLoaded(String rawText) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Icon(Icons.check_circle, color: Colors.green.shade600, size: 20),
                const SizedBox(width: 8),
                Text(
                  'CV uploaded',
                  style: TextStyle(
                    color: Colors.green.shade700,
                    fontWeight: FontWeight.w600,
                  ),
                ),
                const Spacer(),
                TextButton(
                  onPressed: () => _showEditCvSheet(rawText),
                  child: const Text('Edit'),
                ),
              ],
            ),
            const SizedBox(height: 8),
            Text(
              rawText.length > 200 ? '${rawText.substring(0, 200)}...' : rawText,
              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                    color: Theme.of(context).colorScheme.onSurfaceVariant,
                  ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildCvUploadSection(bool hasExisting) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          children: [
            Icon(
              Icons.upload_file,
              size: 48,
              color: Theme.of(context).colorScheme.primary,
            ),
            const SizedBox(height: 12),
            Text(
              hasExisting ? 'Update Your CV' : 'Upload Your CV',
              style: Theme.of(context).textTheme.titleMedium?.copyWith(
                    fontWeight: FontWeight.bold,
                  ),
            ),
            const SizedBox(height: 4),
            Text(
              'Paste your CV text below',
              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                    color: Theme.of(context).colorScheme.onSurfaceVariant,
                  ),
            ),
            const SizedBox(height: 16),
            TextField(
              controller: _cvTextController,
              maxLines: 6,
              decoration: const InputDecoration(
                hintText: 'Paste your full CV text here...',
                alignLabelWithHint: true,
              ),
            ),
            const SizedBox(height: 12),
            SizedBox(
              width: double.infinity,
              child: FilledButton.icon(
                onPressed: _savingCv
                    ? null
                    : () async {
                        if (_cvTextController.text.trim().length < 50) {
                          ScaffoldMessenger.of(context).showSnackBar(
                            const SnackBar(
                              content:
                                  Text('CV text must be at least 50 characters'),
                            ),
                          );
                          return;
                        }
                        setState(() => _savingCv = true);
                        try {
                          final api = ref.read(apiServiceProvider);
                          await api
                              .saveProfileText(_cvTextController.text.trim());
                          ref.invalidate(profileProvider);
                          if (mounted) {
                            ScaffoldMessenger.of(context).showSnackBar(
                              const SnackBar(content: Text('CV saved!')),
                            );
                          }
                        } catch (e) {
                          if (mounted) {
                            ScaffoldMessenger.of(context).showSnackBar(
                              SnackBar(content: Text('Error: $e')),
                            );
                          }
                        } finally {
                          if (mounted) setState(() => _savingCv = false);
                        }
                      },
                icon: _savingCv
                    ? const SizedBox(
                        height: 16,
                        width: 16,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      )
                    : const Icon(Icons.save),
                label: const Text('Save CV'),
              ),
            ),
          ],
        ),
      ),
    );
  }

  void _showEditCvSheet(String currentText) {
    _cvTextController.text = currentText;
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      builder: (ctx) {
        return Padding(
          padding: EdgeInsets.only(
            left: 24,
            right: 24,
            top: 24,
            bottom: MediaQuery.of(ctx).viewInsets.bottom + 24,
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Text('Edit CV',
                  style: Theme.of(ctx).textTheme.titleLarge?.copyWith(
                        fontWeight: FontWeight.bold,
                      ),),
              const SizedBox(height: 16),
              TextField(
                controller: _cvTextController,
                maxLines: 10,
                decoration: const InputDecoration(
                  hintText: 'Your CV text...',
                  alignLabelWithHint: true,
                ),
              ),
              const SizedBox(height: 16),
              FilledButton(
                onPressed: () async {
                  if (_cvTextController.text.trim().length < 50) return;
                  final api = ref.read(apiServiceProvider);
                  await api.saveProfileText(_cvTextController.text.trim());
                  ref.invalidate(profileProvider);
                  if (ctx.mounted) Navigator.pop(ctx);
                },
                child: const Padding(
                  padding: EdgeInsets.symmetric(vertical: 12),
                  child: Text('Save'),
                ),
              ),
            ],
          ),
        );
      },
    );
  }

  Widget _buildPreferencesForm() {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            TextField(
              controller: _titlesController,
              decoration: const InputDecoration(
                labelText: 'Target Job Titles',
                hintText: 'e.g. Frontend Engineer, React Developer',
              ),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: _locationsController,
              decoration: const InputDecoration(
                labelText: 'Locations',
                hintText: 'e.g. London, Berlin, Remote',
              ),
            ),
            const SizedBox(height: 12),
            DropdownButtonFormField<String>(
              initialValue: _remote,
              decoration: const InputDecoration(labelText: 'Remote Preference'),
              items: const [
                DropdownMenuItem(value: 'any', child: Text('Any')),
                DropdownMenuItem(value: 'remote', child: Text('Remote Only')),
                DropdownMenuItem(value: 'hybrid', child: Text('Hybrid')),
                DropdownMenuItem(value: 'onsite', child: Text('On-site')),
              ],
              onChanged: (v) => setState(() => _remote = v ?? 'any'),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: _salaryController,
              keyboardType: TextInputType.number,
              decoration: const InputDecoration(
                labelText: 'Minimum Salary (Annual, USD)',
                hintText: 'e.g. 80000',
              ),
            ),
            const SizedBox(height: 16),
            FilledButton(
              onPressed: _savingPrefs
                  ? null
                  : () async {
                      if (_titlesController.text.trim().isEmpty) {
                        ScaffoldMessenger.of(context).showSnackBar(
                          const SnackBar(
                            content: Text('At least one target title is required'),
                          ),
                        );
                        return;
                      }
                      setState(() => _savingPrefs = true);
                      try {
                        final api = ref.read(apiServiceProvider);
                        await api.savePreferences(
                          targetTitles: _titlesController.text
                              .split(',')
                              .map((s) => s.trim())
                              .where((s) => s.isNotEmpty)
                              .toList(),
                          locations: _locationsController.text
                              .split(',')
                              .map((s) => s.trim())
                              .where((s) => s.isNotEmpty)
                              .toList(),
                          remotePreference: _remote,
                          salaryMin: _salaryController.text.isNotEmpty
                              ? _salaryController.text.trim()
                              : null,
                        );
                        ref.invalidate(preferencesProvider);
                        if (mounted) {
                          ScaffoldMessenger.of(context).showSnackBar(
                            const SnackBar(
                                content: Text('Preferences saved!'),),
                          );
                        }
                      } catch (e) {
                        if (mounted) {
                          ScaffoldMessenger.of(context).showSnackBar(
                            SnackBar(content: Text('Error: $e')),
                          );
                        }
                      } finally {
                        if (mounted) setState(() => _savingPrefs = false);
                      }
                    },
              child: _savingPrefs
                  ? const SizedBox(
                      height: 20,
                      width: 20,
                      child: CircularProgressIndicator(
                          strokeWidth: 2, color: Colors.white,),
                    )
                  : const Text('Save Preferences'),
            ),
          ],
        ),
      ),
    );
  }
}
