import type { Metadata } from "next";
import { Link } from "@/i18n/routing";
import { Sparkles } from "lucide-react";
import { buildCanonicalOgParity } from "@/lib/seo";
import { buildTrustPageJsonLd } from "@/lib/structured-data";
import { defaultLocale, locales, type Locale } from "@/i18n/config";

type ListSection = {
    title: string;
    intro?: string;
    bullets?: string[];
    outro?: string;
};

type PrivacyContent = {
    metadataTitle: string;
    metadataDescription: string;
    pageTitle: string;
    lastUpdated: string;
    sections: {
        dataCollect: ListSection;
        dataUse: ListSection;
        aiProcessing: { title: string; body: string };
        dataSharing: ListSection;
        rights: ListSection;
        retention: { title: string; body: string };
        security: { title: string; body: string };
        cookies: { title: string; body: string };
        changes: { title: string; body: string };
        contact: { title: string; beforeLink: string; linkText: string; afterLink?: string };
    };
};

const privacyContentByLocale: Record<Locale, PrivacyContent> = {
    en: {
        metadataTitle: "Privacy Policy — AutoApply AI",
        metadataDescription:
            "Read how AutoApply AI handles account, CV, and payment data with GDPR-focused privacy safeguards.",
        pageTitle: "Privacy Policy",
        lastUpdated: "Last updated: February 2026",
        sections: {
            dataCollect: {
                title: "1. Data We Collect",
                intro: "We collect the following categories of personal data:",
                bullets: [
                    "Account data: Name and email address (via Clerk authentication)",
                    "CV data: Resume text and structured profile information you provide",
                    "Job preferences: Target titles, locations, and salary expectations",
                    "Usage data: Application tracking and document generation history",
                    "Payment data: Processed by Stripe; we do not store card details",
                ],
            },
            dataUse: {
                title: "2. How We Use Your Data",
                bullets: [
                    "To provide AI-powered job matching and document generation",
                    "To maintain your account and application history",
                    "To process payments and manage subscriptions",
                    "To improve the Service through aggregated, anonymized analytics",
                ],
            },
            aiProcessing: {
                title: "3. Data Processing (AI)",
                body: "Your CV and profile data is processed by AI language models (Claude by Anthropic) to generate tailored documents. This processing occurs on secure servers. Your data is not used to train AI models. Each request is processed independently and not retained by the AI provider.",
            },
            dataSharing: {
                title: "4. Data Sharing",
                intro: "We share data only with:",
                bullets: [
                    "Clerk: Authentication provider",
                    "Stripe: Payment processing",
                    "Anthropic: AI document generation (data not retained)",
                    "Job API providers: We send anonymized queries only (no personal data)",
                ],
                outro: "We do not sell your personal data to third parties.",
            },
            rights: {
                title: "5. Your Rights (GDPR)",
                intro: "Under GDPR, you have the right to:",
                bullets: [
                    "Access: Export all your data via Settings → Export My Data",
                    "Rectification: Edit your profile and preferences at any time",
                    "Erasure: Delete your account and all data via Settings → Delete Account",
                    "Portability: Download your data in JSON format",
                    "Objection: Disable automated processing via Settings → Automation toggle",
                ],
            },
            retention: {
                title: "6. Data Retention",
                body: "We retain your data for as long as your account is active. Upon account deletion, all personal data is permanently removed within 30 days. Anonymized, aggregated data may be retained for analytics.",
            },
            security: {
                title: "7. Data Security",
                body: "We implement industry-standard security measures including encrypted connections (TLS), secure database access, and regular security reviews. All data at rest is encrypted.",
            },
            cookies: {
                title: "8. Cookies",
                body: "We use essential cookies for authentication and session management. Optional third-party analytics tags are loaded only after explicit consent in our cookie banner.",
            },
            changes: {
                title: "9. Changes to This Policy",
                body: "We may update this policy periodically. Material changes will be communicated via email. The \"last updated\" date above reflects the most recent revision.",
            },
            contact: {
                title: "10. Contact",
                beforeLink:
                    "For privacy inquiries or to exercise your data rights, contact us via",
                linkText: "our contact page",
                afterLink: ".",
            },
        },
    },
    fr: {
        metadataTitle: "Politique de confidentialité — AutoApply AI",
        metadataDescription:
            "Découvrez comment AutoApply AI traite les données de compte, CV et paiement avec des garanties de confidentialité orientées RGPD.",
        pageTitle: "Politique de confidentialité",
        lastUpdated: "Dernière mise à jour : février 2026",
        sections: {
            dataCollect: {
                title: "1. Données que nous collectons",
                intro: "Nous collectons les catégories de données personnelles suivantes :",
                bullets: [
                    "Données de compte : nom et adresse email (via l'authentification Clerk)",
                    "Données CV : texte du CV et informations de profil structurées que vous fournissez",
                    "Préférences d'emploi : postes visés, localisations et attentes salariales",
                    "Données d'utilisation : suivi des candidatures et historique de génération de documents",
                    "Données de paiement : traitées par Stripe ; nous ne stockons pas les données de carte",
                ],
            },
            dataUse: {
                title: "2. Utilisation de vos données",
                bullets: [
                    "Fournir le matching d'emploi et la génération de documents par IA",
                    "Maintenir votre compte et l'historique de vos candidatures",
                    "Traiter les paiements et gérer les abonnements",
                    "Améliorer le service via des analyses agrégées et anonymisées",
                ],
            },
            aiProcessing: {
                title: "3. Traitement des données (IA)",
                body: "Votre CV et vos données de profil sont traités par des modèles d'IA (Claude par Anthropic) pour générer des documents personnalisés. Ce traitement s'effectue sur des serveurs sécurisés. Vos données ne sont pas utilisées pour entraîner les modèles IA. Chaque requête est traitée indépendamment et n'est pas conservée par le fournisseur IA.",
            },
            dataSharing: {
                title: "4. Partage des données",
                intro: "Nous partageons des données uniquement avec :",
                bullets: [
                    "Clerk : fournisseur d'authentification",
                    "Stripe : traitement des paiements",
                    "Anthropic : génération de documents IA (données non conservées)",
                    "Fournisseurs d'API d'offres d'emploi : nous envoyons uniquement des requêtes anonymisées (aucune donnée personnelle)",
                ],
                outro: "Nous ne vendons pas vos données personnelles à des tiers.",
            },
            rights: {
                title: "5. Vos droits (RGPD)",
                intro: "Conformément au RGPD, vous avez le droit de :",
                bullets: [
                    "Accès : exporter toutes vos données via Paramètres → Exporter mes données",
                    "Rectification : modifier votre profil et vos préférences à tout moment",
                    "Effacement : supprimer votre compte et toutes vos données via Paramètres → Supprimer le compte",
                    "Portabilité : télécharger vos données au format JSON",
                    "Opposition : désactiver le traitement automatisé via Paramètres → option Automatisation",
                ],
            },
            retention: {
                title: "6. Conservation des données",
                body: "Nous conservons vos données tant que votre compte est actif. En cas de suppression du compte, toutes les données personnelles sont supprimées définitivement sous 30 jours. Des données anonymisées et agrégées peuvent être conservées à des fins analytiques.",
            },
            security: {
                title: "7. Sécurité des données",
                body: "Nous appliquons des mesures de sécurité conformes aux standards du secteur, notamment des connexions chiffrées (TLS), un accès sécurisé à la base de données et des revues de sécurité régulières. Toutes les données au repos sont chiffrées.",
            },
            cookies: {
                title: "8. Cookies",
                body: "Nous utilisons des cookies essentiels pour l'authentification et la gestion de session. Les balises d'analyse tierces optionnelles sont chargées uniquement après consentement explicite dans notre bannière cookies.",
            },
            changes: {
                title: "9. Modifications de cette politique",
                body: "Nous pouvons mettre à jour cette politique périodiquement. Les changements importants seront communiqués par email. La date de « dernière mise à jour » ci-dessus reflète la révision la plus récente.",
            },
            contact: {
                title: "10. Contact",
                beforeLink:
                    "Pour toute question liée à la confidentialité ou pour exercer vos droits, contactez-nous via",
                linkText: "notre page de contact",
                afterLink: ".",
            },
        },
    },
    de: {
        metadataTitle: "Datenschutzerklärung — AutoApply AI",
        metadataDescription:
            "Erfahren Sie, wie AutoApply AI Konto-, Lebenslauf- und Zahlungsdaten mit DSGVO-orientierten Datenschutzmaßnahmen verarbeitet.",
        pageTitle: "Datenschutzerklärung",
        lastUpdated: "Zuletzt aktualisiert: Februar 2026",
        sections: {
            dataCollect: {
                title: "1. Welche Daten wir erfassen",
                intro: "Wir erfassen die folgenden Kategorien personenbezogener Daten:",
                bullets: [
                    "Kontodaten: Name und E-Mail-Adresse (über Clerk-Authentifizierung)",
                    "Lebenslaufdaten: Lebenslauftext und strukturierte Profildaten, die Sie bereitstellen",
                    "Job-Präferenzen: Zielpositionen, Standorte und Gehaltsvorstellungen",
                    "Nutzungsdaten: Bewerbungsverfolgung und Verlauf der Dokumentenerstellung",
                    "Zahlungsdaten: Werden durch Stripe verarbeitet; wir speichern keine Kartendaten",
                ],
            },
            dataUse: {
                title: "2. Wie wir Ihre Daten verwenden",
                bullets: [
                    "Um KI-gestütztes Job-Matching und Dokumentenerstellung bereitzustellen",
                    "Um Ihr Konto und Ihre Bewerbungshistorie zu verwalten",
                    "Um Zahlungen zu verarbeiten und Abonnements zu verwalten",
                    "Um den Service durch aggregierte, anonymisierte Analysen zu verbessern",
                ],
            },
            aiProcessing: {
                title: "3. Datenverarbeitung (KI)",
                body: "Ihre Lebenslauf- und Profildaten werden von KI-Sprachmodellen (Claude von Anthropic) verarbeitet, um personalisierte Dokumente zu erstellen. Diese Verarbeitung erfolgt auf sicheren Servern. Ihre Daten werden nicht zum Training von KI-Modellen verwendet. Jede Anfrage wird unabhängig verarbeitet und vom KI-Anbieter nicht gespeichert.",
            },
            dataSharing: {
                title: "4. Datenweitergabe",
                intro: "Wir teilen Daten nur mit:",
                bullets: [
                    "Clerk: Authentifizierungsanbieter",
                    "Stripe: Zahlungsabwicklung",
                    "Anthropic: KI-Dokumentenerstellung (Daten werden nicht gespeichert)",
                    "Job-API-Anbieter: Wir senden nur anonymisierte Suchanfragen (keine personenbezogenen Daten)",
                ],
                outro: "Wir verkaufen Ihre personenbezogenen Daten nicht an Dritte.",
            },
            rights: {
                title: "5. Ihre Rechte (DSGVO)",
                intro: "Nach DSGVO haben Sie folgende Rechte:",
                bullets: [
                    "Auskunft: Exportieren Sie alle Ihre Daten über Einstellungen → Meine Daten exportieren",
                    "Berichtigung: Bearbeiten Sie Ihr Profil und Ihre Präferenzen jederzeit",
                    "Löschung: Löschen Sie Ihr Konto und alle Daten über Einstellungen → Konto löschen",
                    "Datenübertragbarkeit: Laden Sie Ihre Daten im JSON-Format herunter",
                    "Widerspruch: Deaktivieren Sie automatisierte Verarbeitung über Einstellungen → Automatisierung",
                ],
            },
            retention: {
                title: "6. Speicherdauer",
                body: "Wir speichern Ihre Daten, solange Ihr Konto aktiv ist. Nach Kontolöschung werden alle personenbezogenen Daten innerhalb von 30 Tagen dauerhaft entfernt. Anonymisierte, aggregierte Daten können zu Analysezwecken aufbewahrt werden.",
            },
            security: {
                title: "7. Datensicherheit",
                body: "Wir setzen branchenübliche Sicherheitsmaßnahmen ein, darunter verschlüsselte Verbindungen (TLS), sicheren Datenbankzugriff und regelmäßige Sicherheitsprüfungen. Alle ruhenden Daten sind verschlüsselt.",
            },
            cookies: {
                title: "8. Cookies",
                body: "Wir verwenden essentielle Cookies für Authentifizierung und Sitzungsverwaltung. Optionale Drittanbieter-Analyse-Tags werden nur nach ausdrücklicher Zustimmung über unser Cookie-Banner geladen.",
            },
            changes: {
                title: "9. Änderungen dieser Richtlinie",
                body: "Wir können diese Richtlinie regelmäßig aktualisieren. Wesentliche Änderungen werden per E-Mail kommuniziert. Das Datum „zuletzt aktualisiert“ oben zeigt die aktuellste Version.",
            },
            contact: {
                title: "10. Kontakt",
                beforeLink:
                    "Für Datenschutzanfragen oder zur Ausübung Ihrer Rechte kontaktieren Sie uns über",
                linkText: "unsere Kontaktseite",
                afterLink: ".",
            },
        },
    },
    es: {
        metadataTitle: "Política de privacidad — AutoApply AI",
        metadataDescription:
            "Consulta cómo AutoApply AI gestiona datos de cuenta, CV y pago con salvaguardas de privacidad centradas en GDPR.",
        pageTitle: "Política de privacidad",
        lastUpdated: "Última actualización: febrero de 2026",
        sections: {
            dataCollect: {
                title: "1. Datos que recopilamos",
                intro: "Recopilamos las siguientes categorías de datos personales:",
                bullets: [
                    "Datos de cuenta: nombre y correo electrónico (mediante autenticación con Clerk)",
                    "Datos del CV: texto del currículum e información estructurada del perfil que aportas",
                    "Preferencias laborales: puestos objetivo, ubicaciones y expectativas salariales",
                    "Datos de uso: seguimiento de candidaturas e historial de generación de documentos",
                    "Datos de pago: procesados por Stripe; no almacenamos datos de tarjeta",
                ],
            },
            dataUse: {
                title: "2. Cómo usamos tus datos",
                bullets: [
                    "Para ofrecer emparejamiento laboral y generación de documentos con IA",
                    "Para mantener tu cuenta y tu historial de candidaturas",
                    "Para procesar pagos y gestionar suscripciones",
                    "Para mejorar el servicio mediante analítica agregada y anonimizada",
                ],
            },
            aiProcessing: {
                title: "3. Tratamiento de datos (IA)",
                body: "Tu CV y tus datos de perfil son procesados por modelos de lenguaje de IA (Claude de Anthropic) para generar documentos personalizados. Este tratamiento se realiza en servidores seguros. Tus datos no se usan para entrenar modelos de IA. Cada solicitud se procesa de forma independiente y no se conserva por el proveedor de IA.",
            },
            dataSharing: {
                title: "4. Compartición de datos",
                intro: "Compartimos datos únicamente con:",
                bullets: [
                    "Clerk: proveedor de autenticación",
                    "Stripe: procesamiento de pagos",
                    "Anthropic: generación de documentos con IA (los datos no se retienen)",
                    "Proveedores de API de empleo: solo enviamos consultas anonimizadas (sin datos personales)",
                ],
                outro: "No vendemos tus datos personales a terceros.",
            },
            rights: {
                title: "5. Tus derechos (GDPR)",
                intro: "Bajo GDPR, tienes derecho a:",
                bullets: [
                    "Acceso: exportar todos tus datos desde Configuración → Exportar mis datos",
                    "Rectificación: editar tu perfil y preferencias en cualquier momento",
                    "Supresión: eliminar tu cuenta y todos los datos desde Configuración → Eliminar cuenta",
                    "Portabilidad: descargar tus datos en formato JSON",
                    "Oposición: desactivar el procesamiento automatizado desde Configuración → Automatización",
                ],
            },
            retention: {
                title: "6. Conservación de datos",
                body: "Conservamos tus datos mientras tu cuenta permanezca activa. Al eliminar la cuenta, todos los datos personales se eliminan de forma permanente en un plazo de 30 días. Los datos anonimizados y agregados pueden conservarse para análisis.",
            },
            security: {
                title: "7. Seguridad de los datos",
                body: "Aplicamos medidas de seguridad estándar del sector, incluidas conexiones cifradas (TLS), acceso seguro a base de datos y revisiones de seguridad regulares. Todos los datos en reposo se almacenan cifrados.",
            },
            cookies: {
                title: "8. Cookies",
                body: "Usamos cookies esenciales para autenticación y gestión de sesión. Las etiquetas opcionales de analítica de terceros solo se cargan tras consentimiento explícito en nuestro banner de cookies.",
            },
            changes: {
                title: "9. Cambios en esta política",
                body: "Podemos actualizar esta política periódicamente. Los cambios relevantes se comunicarán por correo electrónico. La fecha de «última actualización» anterior refleja la revisión más reciente.",
            },
            contact: {
                title: "10. Contacto",
                beforeLink:
                    "Para consultas de privacidad o para ejercer tus derechos de datos, contáctanos a través de",
                linkText: "nuestra página de contacto",
                afterLink: ".",
            },
        },
    },
    it: {
        metadataTitle: "Informativa sulla privacy — AutoApply AI",
        metadataDescription:
            "Scopri come AutoApply AI gestisce dati account, CV e pagamenti con tutele privacy orientate al GDPR.",
        pageTitle: "Informativa sulla privacy",
        lastUpdated: "Ultimo aggiornamento: febbraio 2026",
        sections: {
            dataCollect: {
                title: "1. Dati che raccogliamo",
                intro: "Raccogliamo le seguenti categorie di dati personali:",
                bullets: [
                    "Dati account: nome e indirizzo email (tramite autenticazione Clerk)",
                    "Dati CV: testo del curriculum e informazioni profilo strutturate fornite da te",
                    "Preferenze di lavoro: ruoli target, località e aspettative salariali",
                    "Dati di utilizzo: tracciamento candidature e cronologia generazione documenti",
                    "Dati di pagamento: elaborati da Stripe; non memorizziamo i dati carta",
                ],
            },
            dataUse: {
                title: "2. Come utilizziamo i tuoi dati",
                bullets: [
                    "Per offrire matching lavoro e generazione documenti con IA",
                    "Per mantenere il tuo account e la cronologia candidature",
                    "Per elaborare pagamenti e gestire abbonamenti",
                    "Per migliorare il servizio tramite analisi aggregate e anonimizzate",
                ],
            },
            aiProcessing: {
                title: "3. Trattamento dati (IA)",
                body: "Il tuo CV e i dati profilo sono elaborati da modelli linguistici IA (Claude di Anthropic) per generare documenti personalizzati. Questo trattamento avviene su server sicuri. I tuoi dati non sono utilizzati per addestrare modelli IA. Ogni richiesta è elaborata in modo indipendente e non viene conservata dal fornitore IA.",
            },
            dataSharing: {
                title: "4. Condivisione dei dati",
                intro: "Condividiamo i dati solo con:",
                bullets: [
                    "Clerk: fornitore autenticazione",
                    "Stripe: elaborazione pagamenti",
                    "Anthropic: generazione documenti IA (dati non conservati)",
                    "Provider API offerte lavoro: inviamo solo query anonimizzate (nessun dato personale)",
                ],
                outro: "Non vendiamo i tuoi dati personali a terze parti.",
            },
            rights: {
                title: "5. I tuoi diritti (GDPR)",
                intro: "Ai sensi del GDPR, hai il diritto di:",
                bullets: [
                    "Accesso: esportare tutti i tuoi dati da Impostazioni → Esporta i miei dati",
                    "Rettifica: modificare profilo e preferenze in qualsiasi momento",
                    "Cancellazione: eliminare account e dati da Impostazioni → Elimina account",
                    "Portabilità: scaricare i tuoi dati in formato JSON",
                    "Opposizione: disattivare il trattamento automatizzato da Impostazioni → Automazione",
                ],
            },
            retention: {
                title: "6. Conservazione dei dati",
                body: "Conserviamo i tuoi dati finché il tuo account è attivo. Alla cancellazione dell'account, tutti i dati personali vengono rimossi in modo permanente entro 30 giorni. Dati anonimizzati e aggregati possono essere conservati per analisi.",
            },
            security: {
                title: "7. Sicurezza dei dati",
                body: "Adottiamo misure di sicurezza standard di settore, incluse connessioni cifrate (TLS), accesso sicuro al database e revisioni di sicurezza regolari. Tutti i dati a riposo sono cifrati.",
            },
            cookies: {
                title: "8. Cookie",
                body: "Utilizziamo cookie essenziali per autenticazione e gestione sessione. I tag analitici di terze parti opzionali vengono caricati solo dopo consenso esplicito nel banner cookie.",
            },
            changes: {
                title: "9. Modifiche a questa informativa",
                body: "Potremmo aggiornare periodicamente questa informativa. Le modifiche rilevanti saranno comunicate via email. La data di «ultimo aggiornamento» sopra indica la revisione più recente.",
            },
            contact: {
                title: "10. Contatto",
                beforeLink:
                    "Per richieste sulla privacy o per esercitare i tuoi diritti sui dati, contattaci tramite",
                linkText: "la nostra pagina contatti",
                afterLink: ".",
            },
        },
    },
};

function resolveLocale(rawLocale: string): Locale {
    return locales.includes(rawLocale as Locale) ? (rawLocale as Locale) : defaultLocale;
}

export async function generateMetadata({
    params,
}: {
    params: Promise<{ locale: string }>;
}): Promise<Metadata> {
    const { locale: rawLocale } = await params;
    const locale = resolveLocale(rawLocale);
    const content = privacyContentByLocale[locale];
    const title = content.metadataTitle;
    const description = content.metadataDescription;
    const parity = buildCanonicalOgParity(locale, "/privacy");

    return {
        title,
        description,
        alternates: parity.alternates,
        openGraph: {
            ...parity.openGraph,
            title,
            description,
        },
    };
}

export default async function PrivacyPage({
    params,
}: {
    params: Promise<{ locale: string }>;
}) {
    const { locale: rawLocale } = await params;
    const locale = resolveLocale(rawLocale);
    const content = privacyContentByLocale[locale];
    const jsonLd = buildTrustPageJsonLd(
        locale,
        "/privacy",
        content.metadataTitle
    );

    return (
        <div className="min-h-screen bg-background">
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
            />
            <header className="border-b">
                <div className="container flex h-14 items-center">
                    <Link href="/" className="flex items-center space-x-2">
                        <Sparkles className="h-6 w-6 text-primary" />
                        <span className="font-bold text-xl">AutoApply AI</span>
                    </Link>
                </div>
            </header>

            <main className="container max-w-3xl py-12">
                <h1 className="text-3xl font-bold mb-8">{content.pageTitle}</h1>
                <div className="prose prose-slate max-w-none space-y-6 text-sm leading-relaxed">
                    <p className="text-muted-foreground">{content.lastUpdated}</p>

                    <section>
                        <h2 className="text-xl font-semibold mt-8 mb-3">
                            {content.sections.dataCollect.title}
                        </h2>
                        {content.sections.dataCollect.intro ? (
                            <p>{content.sections.dataCollect.intro}</p>
                        ) : null}
                        <ul className="list-disc pl-6 space-y-1 mt-2">
                            {content.sections.dataCollect.bullets?.map((item) => (
                                <li key={item}>{item}</li>
                            ))}
                        </ul>
                    </section>

                    <section>
                        <h2 className="text-xl font-semibold mt-8 mb-3">
                            {content.sections.dataUse.title}
                        </h2>
                        <ul className="list-disc pl-6 space-y-1 mt-2">
                            {content.sections.dataUse.bullets?.map((item) => (
                                <li key={item}>{item}</li>
                            ))}
                        </ul>
                    </section>

                    <section>
                        <h2 className="text-xl font-semibold mt-8 mb-3">
                            {content.sections.aiProcessing.title}
                        </h2>
                        <p>{content.sections.aiProcessing.body}</p>
                    </section>

                    <section>
                        <h2 className="text-xl font-semibold mt-8 mb-3">
                            {content.sections.dataSharing.title}
                        </h2>
                        {content.sections.dataSharing.intro ? (
                            <p>{content.sections.dataSharing.intro}</p>
                        ) : null}
                        <ul className="list-disc pl-6 space-y-1 mt-2">
                            {content.sections.dataSharing.bullets?.map((item) => (
                                <li key={item}>{item}</li>
                            ))}
                        </ul>
                        {content.sections.dataSharing.outro ? (
                            <p className="mt-2">{content.sections.dataSharing.outro}</p>
                        ) : null}
                    </section>

                    <section>
                        <h2 className="text-xl font-semibold mt-8 mb-3">
                            {content.sections.rights.title}
                        </h2>
                        {content.sections.rights.intro ? (
                            <p>{content.sections.rights.intro}</p>
                        ) : null}
                        <ul className="list-disc pl-6 space-y-1 mt-2">
                            {content.sections.rights.bullets?.map((item) => (
                                <li key={item}>{item}</li>
                            ))}
                        </ul>
                    </section>

                    <section>
                        <h2 className="text-xl font-semibold mt-8 mb-3">
                            {content.sections.retention.title}
                        </h2>
                        <p>{content.sections.retention.body}</p>
                    </section>

                    <section>
                        <h2 className="text-xl font-semibold mt-8 mb-3">
                            {content.sections.security.title}
                        </h2>
                        <p>{content.sections.security.body}</p>
                    </section>

                    <section>
                        <h2 className="text-xl font-semibold mt-8 mb-3">
                            {content.sections.cookies.title}
                        </h2>
                        <p>{content.sections.cookies.body}</p>
                    </section>

                    <section>
                        <h2 className="text-xl font-semibold mt-8 mb-3">
                            {content.sections.changes.title}
                        </h2>
                        <p>{content.sections.changes.body}</p>
                    </section>

                    <section>
                        <h2 className="text-xl font-semibold mt-8 mb-3">
                            {content.sections.contact.title}
                        </h2>
                        <p>
                            {content.sections.contact.beforeLink}{" "}
                            <Link href="/contact" className="text-primary underline">
                                {content.sections.contact.linkText}
                            </Link>
                            {content.sections.contact.afterLink ?? ""}
                        </p>
                    </section>
                </div>
            </main>
        </div>
    );
}
