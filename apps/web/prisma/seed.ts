import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // ─── Admin User (Unlimited Plan) ──────────────────────────
  const adminUser = await prisma.user.upsert({
    where: { email: 'matthieu.kokabi@gmail.com' },
    update: {
      subscriptionStatus: 'unlimited',
      creditsRemaining: 9999,
      automationEnabled: true,
    },
    create: {
      email: 'matthieu.kokabi@gmail.com',
      clerkId: 'user_admin_test_001',
      name: 'Matthieu Kokabi',
      subscriptionStatus: 'unlimited',
      creditsRemaining: 9999,
      automationEnabled: true,
    },
  });
  console.log(`✅ Admin user created: ${adminUser.email} (${adminUser.id})`);

  // ─── Master Profile ───────────────────────────────────────
  const structuredProfile = {
    contact: {
      name: 'Matthieu Kokabi',
      email: 'matthieu.kokabi@gmail.com',
      phone: '+41 79 123 45 67',
      location: 'Zurich, Switzerland',
      linkedin: 'https://linkedin.com/in/admin-tester',
    },
    summary:
      'Senior Full-Stack Engineer with 8+ years of experience building scalable SaaS platforms. Expert in React, Next.js, Node.js, Python, and cloud infrastructure (AWS, GCP). Passionate about AI-powered products and developer tooling.',
    experience: [
      {
        title: 'Senior Software Engineer',
        company: 'TechCorp AG',
        location: 'Zurich, Switzerland',
        startDate: '2021-03',
        endDate: 'Present',
        description:
          'Lead engineer for a B2B SaaS platform serving 50K+ users. Architected microservices migration from monolith. Reduced API latency by 60% through caching and query optimization. Mentored team of 4 junior developers.',
      },
      {
        title: 'Full-Stack Developer',
        company: 'StartupHub GmbH',
        location: 'Berlin, Germany',
        startDate: '2018-06',
        endDate: '2021-02',
        description:
          'Built React/Node.js applications for fintech clients. Implemented real-time data pipelines using Kafka and PostgreSQL. Delivered 12 client projects on time and within budget.',
      },
      {
        title: 'Junior Developer',
        company: 'WebAgency SA',
        location: 'Geneva, Switzerland',
        startDate: '2016-01',
        endDate: '2018-05',
        description:
          'Developed responsive web applications using Angular and Django. Created RESTful APIs and integrated third-party payment systems. Collaborated in agile teams of 6-8 people.',
      },
    ],
    education: [
      {
        degree: 'M.Sc. Computer Science',
        institution: 'ETH Zurich',
        year: '2015',
      },
      {
        degree: 'B.Sc. Computer Science',
        institution: 'EPFL',
        year: '2013',
      },
    ],
    skills: [
      'TypeScript',
      'React',
      'Next.js',
      'Node.js',
      'Python',
      'PostgreSQL',
      'Redis',
      'Docker',
      'Kubernetes',
      'AWS',
      'GCP',
      'GraphQL',
      'REST APIs',
      'CI/CD',
      'Terraform',
      'Agile/Scrum',
    ],
    languages: ['English (Fluent)', 'French (Native)', 'German (B2)'],
  };

  const rawCvText = `ADMIN TESTER
Senior Full-Stack Engineer
matthieu.kokabi@gmail.com | +41 79 123 45 67 | Zurich, Switzerland
linkedin.com/in/admin-tester

SUMMARY
Senior Full-Stack Engineer with 8+ years of experience building scalable SaaS platforms. Expert in React, Next.js, Node.js, Python, and cloud infrastructure (AWS, GCP). Passionate about AI-powered products and developer tooling.

EXPERIENCE

Senior Software Engineer | TechCorp AG | Zurich | Mar 2021 – Present
- Lead engineer for a B2B SaaS platform serving 50K+ users
- Architected microservices migration from monolith
- Reduced API latency by 60% through caching and query optimization
- Mentored team of 4 junior developers

Full-Stack Developer | StartupHub GmbH | Berlin | Jun 2018 – Feb 2021
- Built React/Node.js applications for fintech clients
- Implemented real-time data pipelines using Kafka and PostgreSQL
- Delivered 12 client projects on time and within budget

Junior Developer | WebAgency SA | Geneva | Jan 2016 – May 2018
- Developed responsive web applications using Angular and Django
- Created RESTful APIs and integrated third-party payment systems
- Collaborated in agile teams of 6-8 people

EDUCATION
M.Sc. Computer Science — ETH Zurich (2015)
B.Sc. Computer Science — EPFL (2013)

SKILLS
TypeScript, React, Next.js, Node.js, Python, PostgreSQL, Redis, Docker, Kubernetes, AWS, GCP, GraphQL, REST APIs, CI/CD, Terraform, Agile/Scrum

LANGUAGES
English (Fluent), French (Native), German (B2)`;

  await prisma.masterProfile.upsert({
    where: { userId: adminUser.id },
    update: {
      rawText: rawCvText,
      structuredJson: structuredProfile,
    },
    create: {
      userId: adminUser.id,
      rawText: rawCvText,
      structuredJson: structuredProfile,
    },
  });
  console.log('✅ Master profile created');

  // ─── Job Preferences ──────────────────────────────────────
  await prisma.jobPreferences.upsert({
    where: { userId: adminUser.id },
    update: {
      targetTitles: ['Senior Software Engineer', 'Staff Engineer', 'Tech Lead', 'Full-Stack Developer'],
      locations: ['Zurich', 'Berlin', 'London', 'Remote'],
      remotePreference: 'hybrid',
      salaryMin: 120000,
      industries: ['SaaS', 'Fintech', 'AI/ML', 'Developer Tools'],
    },
    create: {
      userId: adminUser.id,
      targetTitles: ['Senior Software Engineer', 'Staff Engineer', 'Tech Lead', 'Full-Stack Developer'],
      locations: ['Zurich', 'Berlin', 'London', 'Remote'],
      remotePreference: 'hybrid',
      salaryMin: 120000,
      industries: ['SaaS', 'Fintech', 'AI/ML', 'Developer Tools'],
    },
  });
  console.log('✅ Job preferences created');

  // ─── Sample Jobs ──────────────────────────────────────────
  const jobs = await Promise.all([
    prisma.job.upsert({
      where: { externalId: 'demo-job-001' },
      update: {},
      create: {
        externalId: 'demo-job-001',
        title: 'Senior Full-Stack Engineer',
        company: 'Stripe',
        location: 'Zurich, Switzerland (Hybrid)',
        description:
          'We are looking for a Senior Full-Stack Engineer to join our Payments team in Zurich. You will work on building and scaling our core payment infrastructure used by millions of businesses worldwide. Requirements: 5+ years experience with React, Node.js, and distributed systems. Experience with payment systems and financial APIs is a plus.',
        source: 'manual',
        url: 'https://stripe.com/jobs/example-001',
        salary: 'CHF 140,000 – 180,000',
        postedAt: new Date('2026-02-15'),
      },
    }),
    prisma.job.upsert({
      where: { externalId: 'demo-job-002' },
      update: {},
      create: {
        externalId: 'demo-job-002',
        title: 'Staff Software Engineer – Platform',
        company: 'Vercel',
        location: 'Remote (Europe)',
        description:
          'Vercel is hiring a Staff Software Engineer for our Platform team. You will design and implement the infrastructure powering Next.js deployments at scale. Strong background in TypeScript, Node.js, Kubernetes, and edge computing required. 7+ years of experience.',
        source: 'remotive',
        url: 'https://vercel.com/careers/example-002',
        salary: 'EUR 130,000 – 170,000',
        postedAt: new Date('2026-02-18'),
      },
    }),
    prisma.job.upsert({
      where: { externalId: 'demo-job-003' },
      update: {},
      create: {
        externalId: 'demo-job-003',
        title: 'Tech Lead – AI Products',
        company: 'DeepMind',
        location: 'London, UK',
        description:
          'DeepMind is seeking a Tech Lead to drive our AI-powered product development. Lead a team of 8 engineers building production ML systems. Requirements: 6+ years in software engineering, experience with Python, PyTorch/TensorFlow, and cloud ML pipelines.',
        source: 'adzuna',
        url: 'https://deepmind.google/careers/example-003',
        salary: 'GBP 120,000 – 160,000',
        postedAt: new Date('2026-02-10'),
      },
    }),
    prisma.job.upsert({
      where: { externalId: 'demo-job-004' },
      update: {},
      create: {
        externalId: 'demo-job-004',
        title: 'Full-Stack Developer',
        company: 'N26',
        location: 'Berlin, Germany',
        description:
          'N26 is looking for a Full-Stack Developer to join our mobile banking team. Build features for millions of users across Europe. Tech stack: React Native, TypeScript, Node.js, PostgreSQL, AWS. 3+ years of experience required.',
        source: 'arbeitnow',
        url: 'https://n26.com/careers/example-004',
        salary: 'EUR 75,000 – 95,000',
        postedAt: new Date('2026-02-19'),
      },
    }),
    prisma.job.upsert({
      where: { externalId: 'demo-job-005' },
      update: {},
      create: {
        externalId: 'demo-job-005',
        title: 'Senior Backend Engineer',
        company: 'Notion',
        location: 'Remote (Worldwide)',
        description:
          'Notion is hiring a Senior Backend Engineer to work on our collaboration infrastructure. You will design APIs and data models for real-time collaborative editing. Strong skills in Rust or Go, distributed systems, and database design required.',
        source: 'themuse',
        url: 'https://notion.so/careers/example-005',
        salary: 'USD 180,000 – 220,000',
        postedAt: new Date('2026-02-20'),
      },
    }),
  ]);
  console.log(`✅ ${jobs.length} sample jobs created`);

  // ─── Sample Applications ──────────────────────────────────
  const sampleTailoredCv = `# ADMIN TESTER
## Senior Full-Stack Engineer

**Contact:** matthieu.kokabi@gmail.com | +41 79 123 45 67 | Zurich, Switzerland

---

### PROFESSIONAL SUMMARY
Results-driven Senior Full-Stack Engineer with 8+ years of experience building **scalable SaaS platforms** and **payment infrastructure**. Proven track record in React, Next.js, Node.js, and cloud architecture. Passionate about building developer tools and high-performance systems.

### EXPERIENCE

**Senior Software Engineer** | TechCorp AG | Zurich | 2021 – Present
- Led development of B2B **SaaS platform** serving 50K+ users with 99.9% uptime
- Architected **microservices migration** reducing deployment time by 75%
- Optimized API performance achieving **60% latency reduction** through Redis caching
- Mentored 4 junior engineers, establishing code review standards

**Full-Stack Developer** | StartupHub GmbH | Berlin | 2018 – 2021
- Built **React/Node.js** applications for fintech clients processing €2M+ daily
- Implemented real-time **data pipelines** using Kafka and PostgreSQL
- Delivered 12 projects on time, achieving 95% client satisfaction rate

### EDUCATION
- M.Sc. Computer Science — ETH Zurich (2015)
- B.Sc. Computer Science — EPFL (2013)

### SKILLS
TypeScript, React, Next.js, Node.js, PostgreSQL, Redis, Docker, Kubernetes, AWS, GraphQL, CI/CD, Agile`;

  const sampleCoverLetter = `Dear Hiring Manager,

I am writing to express my strong interest in the Senior Full-Stack Engineer position at Stripe. With over 8 years of experience building scalable SaaS platforms and a deep passion for payment infrastructure, I believe I would be an excellent addition to your Zurich team.

In my current role at TechCorp AG, I lead the engineering effort for a B2B platform serving over 50,000 users. I architected our microservices migration, which reduced deployment cycles by 75% and improved system reliability to 99.9% uptime. My experience with distributed systems, real-time data processing, and API design aligns closely with Stripe's technical challenges.

During my time at StartupHub GmbH, I built fintech applications that processed over €2 million in daily transactions, giving me hands-on experience with payment flows, security requirements, and regulatory compliance. I am deeply familiar with the complexities of building reliable financial infrastructure.

I am particularly excited about Stripe's mission to increase the GDP of the internet. The opportunity to work on core payment infrastructure used by millions of businesses worldwide represents exactly the kind of high-impact engineering challenge I am seeking.

I would welcome the opportunity to discuss how my experience in scalable systems, payment technology, and team leadership can contribute to Stripe's continued success.

Best regards,
Matthieu Kokabi`;

  await Promise.all([
    prisma.application.upsert({
      where: { userId_jobId: { userId: adminUser.id, jobId: jobs[0].id } },
      update: {},
      create: {
        userId: adminUser.id,
        jobId: jobs[0].id,
        compatibilityScore: 92,
        atsKeywords: ['React', 'Node.js', 'distributed systems', 'payment infrastructure', 'SaaS', 'TypeScript', 'API design'],
        matchingStrengths: ['8+ years full-stack experience', 'SaaS platform expertise', 'Microservices architecture', 'Team leadership'],
        gaps: ['No direct payment systems experience mentioned'],
        recommendation: 'apply',
        tailoredCvMarkdown: sampleTailoredCv,
        coverLetterMarkdown: sampleCoverLetter,
        status: 'tailored',
      },
    }),
    prisma.application.upsert({
      where: { userId_jobId: { userId: adminUser.id, jobId: jobs[1].id } },
      update: {},
      create: {
        userId: adminUser.id,
        jobId: jobs[1].id,
        compatibilityScore: 88,
        atsKeywords: ['TypeScript', 'Node.js', 'Kubernetes', 'edge computing', 'Next.js', 'infrastructure'],
        matchingStrengths: ['Strong TypeScript/Node.js skills', 'Kubernetes experience', 'Infrastructure background'],
        gaps: ['Edge computing experience not explicitly mentioned'],
        recommendation: 'apply',
        tailoredCvMarkdown: sampleTailoredCv,
        coverLetterMarkdown: sampleCoverLetter,
        status: 'applied',
        appliedAt: new Date('2026-02-19'),
      },
    }),
    prisma.application.upsert({
      where: { userId_jobId: { userId: adminUser.id, jobId: jobs[2].id } },
      update: {},
      create: {
        userId: adminUser.id,
        jobId: jobs[2].id,
        compatibilityScore: 71,
        atsKeywords: ['Python', 'ML', 'team leadership', 'production systems', 'cloud'],
        matchingStrengths: ['Team leadership experience', 'Cloud infrastructure skills', 'Production system experience'],
        gaps: ['No ML/AI specific experience', 'PyTorch/TensorFlow not listed'],
        recommendation: 'stretch',
        tailoredCvMarkdown: sampleTailoredCv,
        coverLetterMarkdown: sampleCoverLetter,
        status: 'interview',
        appliedAt: new Date('2026-02-12'),
      },
    }),
    prisma.application.upsert({
      where: { userId_jobId: { userId: adminUser.id, jobId: jobs[3].id } },
      update: {},
      create: {
        userId: adminUser.id,
        jobId: jobs[3].id,
        compatibilityScore: 85,
        atsKeywords: ['React', 'TypeScript', 'Node.js', 'PostgreSQL', 'AWS', 'mobile'],
        matchingStrengths: ['Full-stack expertise', 'Fintech experience', 'React/Node proficiency'],
        gaps: ['React Native not mentioned specifically'],
        recommendation: 'apply',
        tailoredCvMarkdown: sampleTailoredCv,
        coverLetterMarkdown: sampleCoverLetter,
        status: 'discovered',
      },
    }),
    prisma.application.upsert({
      where: { userId_jobId: { userId: adminUser.id, jobId: jobs[4].id } },
      update: {},
      create: {
        userId: adminUser.id,
        jobId: jobs[4].id,
        compatibilityScore: 65,
        atsKeywords: ['distributed systems', 'APIs', 'database design', 'backend'],
        matchingStrengths: ['Distributed systems background', 'API design experience', 'Database knowledge'],
        gaps: ['No Rust or Go experience', 'Real-time collaboration not mentioned'],
        recommendation: 'stretch',
        tailoredCvMarkdown: sampleTailoredCv,
        coverLetterMarkdown: sampleCoverLetter,
        status: 'rejected',
        appliedAt: new Date('2026-02-14'),
      },
    }),
  ]);
  console.log('✅ 5 sample applications created (discovered, tailored, applied, interview, rejected)');

  console.log('\n🎉 Seed complete!');
  console.log('─────────────────────────────────────────');
  console.log('Admin Account:');
  console.log('  Email:        matthieu.kokabi@gmail.com');
  console.log('  Plan:         Unlimited');
  console.log('  Credits:      9999');
  console.log('  Automation:   Enabled');
  console.log('  Clerk ID:     user_admin_test_001');
  console.log('─────────────────────────────────────────');
  console.log('\n⚠️  IMPORTANT: You need to create this user in Clerk dashboard');
  console.log('   with the email matthieu.kokabi@gmail.com so the clerkId matches.');
  console.log('   Or sign up via the app and the seed clerkId will be updated on first login.');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
