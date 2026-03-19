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
};

type TermsContent = {
    metadataTitle: string;
    metadataDescription: string;
    pageTitle: string;
    lastUpdated: string;
    sections: {
        acceptance: { title: string; body: string };
        description: { title: string; body: string };
        responsibilities: ListSection;
        aiContent: { title: string; body: string };
        privacy: { title: string; beforeLink: string; linkText: string; afterLink: string };
        subscription: { title: string; body: string };
        prohibited: ListSection;
        liability: { title: string; body: string };
        termination: { title: string; body: string };
        changes: { title: string; body: string };
        contact: { title: string; beforeLink: string; linkText: string; afterLink?: string };
    };
};

const termsContentByLocale: Record<Locale, TermsContent> = {
    en: {
        metadataTitle: "Terms of Service — AutoApply AI",
        metadataDescription:
            "Read the AutoApply AI terms of service covering subscriptions, responsibilities, and acceptable use.",
        pageTitle: "Terms of Service",
        lastUpdated: "Last updated: February 2026",
        sections: {
            acceptance: {
                title: "1. Acceptance of Terms",
                body: "By accessing and using AutoApply AI (the \"Service\"), you agree to be bound by these Terms of Service. If you do not agree, please do not use the Service.",
            },
            description: {
                title: "2. Description of Service",
                body: "AutoApply AI is an AI-powered career assistant that helps users discover job listings, score job-candidate compatibility, and generate tailored resumes and cover letters. The Service does not apply to jobs on your behalf and does not guarantee employment outcomes.",
            },
            responsibilities: {
                title: "3. User Responsibilities",
                intro: "You are responsible for:",
                bullets: [
                    "Providing accurate and truthful information in your CV and profile",
                    "Reviewing all AI-generated documents before submission to employers",
                    "Ensuring that all information in generated documents is factual",
                    "Maintaining the security of your account credentials",
                ],
            },
            aiContent: {
                title: "4. AI-Generated Content",
                body: "The Service uses AI to tailor documents. While we implement anti-hallucination guardrails, AI may occasionally produce inaccurate content. You must review and verify all generated documents before use. AutoApply AI is not liable for any consequences arising from unverified AI-generated content.",
            },
            privacy: {
                title: "5. Data Collection and Privacy",
                beforeLink: "Your use of the Service is also governed by our",
                linkText: "Privacy Policy",
                afterLink:
                    ". We collect and process personal data as described therein, in compliance with GDPR and applicable data protection regulations.",
            },
            subscription: {
                title: "6. Subscription and Payments",
                body: "Paid plans are billed via Stripe. Subscriptions auto-renew unless cancelled. Refunds are handled on a case-by-case basis within 14 days of purchase. Credit packs are non-refundable once used.",
            },
            prohibited: {
                title: "7. Prohibited Uses",
                intro: "You may not:",
                bullets: [
                    "Use the Service to generate fraudulent or misleading documents",
                    "Attempt to circumvent rate limits or access controls",
                    "Reverse engineer or scrape the Service",
                    "Use the Service in violation of any applicable law",
                ],
            },
            liability: {
                title: "8. Limitation of Liability",
                body: "AutoApply AI is provided \"as is\" without warranties of any kind. We are not liable for indirect, incidental, or consequential damages arising from your use of the Service. Our total liability shall not exceed the amount paid by you in the 12 months preceding the claim.",
            },
            termination: {
                title: "9. Termination",
                body: "We may suspend or terminate your account for violations of these Terms. You may delete your account at any time via Settings. Upon deletion, all your data will be permanently removed in compliance with GDPR.",
            },
            changes: {
                title: "10. Changes to Terms",
                body: "We may update these Terms from time to time. Material changes will be communicated via email or in-app notification. Continued use after changes constitutes acceptance.",
            },
            contact: {
                title: "11. Contact",
                beforeLink: "For questions about these Terms, contact us via",
                linkText: "our contact page",
                afterLink: ".",
            },
        },
    },
    fr: {
        metadataTitle: "Conditions d'utilisation — AutoApply AI",
        metadataDescription:
            "Consultez les conditions d'utilisation d'AutoApply AI concernant les abonnements, les responsabilités et l'usage acceptable.",
        pageTitle: "Conditions d'utilisation",
        lastUpdated: "Dernière mise à jour : février 2026",
        sections: {
            acceptance: {
                title: "1. Acceptation des conditions",
                body: "En accédant à AutoApply AI (« le Service ») et en l'utilisant, vous acceptez d'être lié par les présentes conditions d'utilisation. Si vous n'êtes pas d'accord, veuillez ne pas utiliser le Service.",
            },
            description: {
                title: "2. Description du service",
                body: "AutoApply AI est un assistant carrière basé sur l'IA qui aide les utilisateurs à découvrir des offres d'emploi, à évaluer la compatibilité poste-candidat et à générer des CV et lettres de motivation personnalisés. Le Service ne postule pas aux offres en votre nom et ne garantit pas de résultat d'embauche.",
            },
            responsibilities: {
                title: "3. Responsabilités de l'utilisateur",
                intro: "Vous êtes responsable de :",
                bullets: [
                    "Fournir des informations exactes et véridiques dans votre CV et profil",
                    "Relire tous les documents générés par l'IA avant envoi à un employeur",
                    "Vous assurer que toutes les informations des documents générés sont factuelles",
                    "Maintenir la sécurité de vos identifiants de compte",
                ],
            },
            aiContent: {
                title: "4. Contenu généré par l'IA",
                body: "Le Service utilise l'IA pour personnaliser les documents. Bien que nous appliquions des garde-fous anti-hallucination, l'IA peut occasionnellement produire du contenu inexact. Vous devez vérifier tous les documents avant utilisation. AutoApply AI ne peut être tenu responsable des conséquences liées à un contenu IA non vérifié.",
            },
            privacy: {
                title: "5. Collecte des données et confidentialité",
                beforeLink: "Votre utilisation du Service est également régie par notre",
                linkText: "Politique de confidentialité",
                afterLink:
                    ". Nous collectons et traitons les données personnelles comme décrit dans celle-ci, conformément au RGPD et aux réglementations applicables.",
            },
            subscription: {
                title: "6. Abonnement et paiements",
                body: "Les offres payantes sont facturées via Stripe. Les abonnements sont reconduits automatiquement sauf résiliation. Les remboursements sont étudiés au cas par cas dans les 14 jours suivant l'achat. Les packs de crédits ne sont pas remboursables après utilisation.",
            },
            prohibited: {
                title: "7. Usages interdits",
                intro: "Vous ne pouvez pas :",
                bullets: [
                    "Utiliser le Service pour générer des documents frauduleux ou trompeurs",
                    "Tenter de contourner les limites de débit ou les contrôles d'accès",
                    "Rétroconcevoir ou scraper le Service",
                    "Utiliser le Service en violation d'une loi applicable",
                ],
            },
            liability: {
                title: "8. Limitation de responsabilité",
                body: "AutoApply AI est fourni « en l'état » sans garantie d'aucune sorte. Nous ne sommes pas responsables des dommages indirects, accessoires ou consécutifs liés à votre utilisation du Service. Notre responsabilité totale ne peut excéder le montant payé par vous au cours des 12 mois précédant la réclamation.",
            },
            termination: {
                title: "9. Résiliation",
                body: "Nous pouvons suspendre ou résilier votre compte en cas de violation des présentes conditions. Vous pouvez supprimer votre compte à tout moment via Paramètres. Après suppression, toutes vos données sont retirées définitivement conformément au RGPD.",
            },
            changes: {
                title: "10. Modifications des conditions",
                body: "Nous pouvons mettre à jour ces conditions de temps en temps. Les changements importants seront communiqués par email ou notification in-app. La poursuite de l'utilisation vaut acceptation des modifications.",
            },
            contact: {
                title: "11. Contact",
                beforeLink:
                    "Pour toute question concernant ces conditions, contactez-nous via",
                linkText: "notre page de contact",
                afterLink: ".",
            },
        },
    },
    de: {
        metadataTitle: "Nutzungsbedingungen — AutoApply AI",
        metadataDescription:
            "Lesen Sie die AutoApply AI Nutzungsbedingungen zu Abonnements, Verantwortlichkeiten und zulässiger Nutzung.",
        pageTitle: "Nutzungsbedingungen",
        lastUpdated: "Zuletzt aktualisiert: Februar 2026",
        sections: {
            acceptance: {
                title: "1. Annahme der Bedingungen",
                body: "Durch den Zugriff auf AutoApply AI (den „Service“) und dessen Nutzung erklären Sie sich mit diesen Nutzungsbedingungen einverstanden. Wenn Sie nicht einverstanden sind, nutzen Sie den Service bitte nicht.",
            },
            description: {
                title: "2. Beschreibung des Services",
                body: "AutoApply AI ist ein KI-gestützter Karriereassistent, der Nutzern hilft, Stellenangebote zu finden, die Job-Kandidaten-Passung zu bewerten und personalisierte Lebensläufe sowie Anschreiben zu erstellen. Der Service bewirbt sich nicht in Ihrem Namen und garantiert keine Beschäftigungsergebnisse.",
            },
            responsibilities: {
                title: "3. Pflichten der Nutzer",
                intro: "Sie sind verantwortlich für:",
                bullets: [
                    "Bereitstellung korrekter und wahrheitsgemäßer Informationen in Lebenslauf und Profil",
                    "Prüfung aller KI-generierten Dokumente vor dem Versand an Arbeitgeber",
                    "Sicherstellung, dass alle Angaben in generierten Dokumenten sachlich korrekt sind",
                    "Wahrung der Sicherheit Ihrer Kontozugangsdaten",
                ],
            },
            aiContent: {
                title: "4. KI-generierte Inhalte",
                body: "Der Service nutzt KI zur Dokumentanpassung. Obwohl wir Anti-Halluzinations-Schutzmechanismen einsetzen, kann KI gelegentlich ungenaue Inhalte erzeugen. Sie müssen alle generierten Dokumente vor Verwendung prüfen und verifizieren. AutoApply AI haftet nicht für Folgen aus ungeprüften KI-Inhalten.",
            },
            privacy: {
                title: "5. Datenerhebung und Datenschutz",
                beforeLink: "Ihre Nutzung des Services unterliegt ebenfalls unserer",
                linkText: "Datenschutzerklärung",
                afterLink:
                    ". Wir erheben und verarbeiten personenbezogene Daten wie dort beschrieben, im Einklang mit DSGVO und anwendbaren Datenschutzvorschriften.",
            },
            subscription: {
                title: "6. Abonnement und Zahlungen",
                body: "Bezahlte Tarife werden über Stripe abgerechnet. Abonnements verlängern sich automatisch, sofern sie nicht gekündigt werden. Erstattungen werden innerhalb von 14 Tagen nach Kauf im Einzelfall geprüft. Credit-Pakete sind nach Nutzung nicht erstattungsfähig.",
            },
            prohibited: {
                title: "7. Unzulässige Nutzung",
                intro: "Sie dürfen nicht:",
                bullets: [
                    "Den Service zur Erstellung betrügerischer oder irreführender Dokumente verwenden",
                    "Versuchen, Ratenlimits oder Zugriffskontrollen zu umgehen",
                    "Den Service rückentwickeln oder scrapen",
                    "Den Service unter Verstoß gegen geltendes Recht verwenden",
                ],
            },
            liability: {
                title: "8. Haftungsbeschränkung",
                body: "AutoApply AI wird „wie besehen“ ohne Gewährleistung bereitgestellt. Wir haften nicht für indirekte, zufällige oder Folgeschäden aus Ihrer Nutzung des Services. Unsere Gesamthaftung ist auf den von Ihnen in den 12 Monaten vor dem Anspruch gezahlten Betrag begrenzt.",
            },
            termination: {
                title: "9. Kündigung",
                body: "Wir können Ihr Konto bei Verstößen gegen diese Bedingungen aussetzen oder kündigen. Sie können Ihr Konto jederzeit über Einstellungen löschen. Nach Löschung werden alle Ihre Daten DSGVO-konform dauerhaft entfernt.",
            },
            changes: {
                title: "10. Änderungen der Bedingungen",
                body: "Wir können diese Bedingungen von Zeit zu Zeit aktualisieren. Wesentliche Änderungen werden per E-Mail oder In-App-Benachrichtigung kommuniziert. Die fortgesetzte Nutzung gilt als Zustimmung zu den Änderungen.",
            },
            contact: {
                title: "11. Kontakt",
                beforeLink:
                    "Bei Fragen zu diesen Bedingungen kontaktieren Sie uns über",
                linkText: "unsere Kontaktseite",
                afterLink: ".",
            },
        },
    },
    es: {
        metadataTitle: "Términos del servicio — AutoApply AI",
        metadataDescription:
            "Consulta los términos del servicio de AutoApply AI sobre suscripciones, responsabilidades y uso permitido.",
        pageTitle: "Términos del servicio",
        lastUpdated: "Última actualización: febrero de 2026",
        sections: {
            acceptance: {
                title: "1. Aceptación de los términos",
                body: "Al acceder y usar AutoApply AI (el «Servicio»), aceptas quedar vinculado por estos Términos del servicio. Si no estás de acuerdo, no uses el Servicio.",
            },
            description: {
                title: "2. Descripción del servicio",
                body: "AutoApply AI es un asistente de carrera con IA que ayuda a descubrir ofertas, evaluar compatibilidad puesto-candidato y generar currículums y cartas de presentación personalizadas. El Servicio no postula a empleos en tu nombre ni garantiza resultados de empleo.",
            },
            responsibilities: {
                title: "3. Responsabilidades del usuario",
                intro: "Eres responsable de:",
                bullets: [
                    "Proporcionar información precisa y veraz en tu CV y perfil",
                    "Revisar todos los documentos generados por IA antes de enviarlos a empleadores",
                    "Asegurar que toda la información en los documentos generados sea factual",
                    "Mantener la seguridad de las credenciales de tu cuenta",
                ],
            },
            aiContent: {
                title: "4. Contenido generado por IA",
                body: "El Servicio utiliza IA para personalizar documentos. Aunque aplicamos salvaguardas anti-alucinación, la IA puede producir contenido inexacto ocasionalmente. Debes revisar y verificar todos los documentos antes de usarlos. AutoApply AI no es responsable de consecuencias derivadas de contenido IA no verificado.",
            },
            privacy: {
                title: "5. Recopilación de datos y privacidad",
                beforeLink: "Tu uso del Servicio también se rige por nuestra",
                linkText: "Política de privacidad",
                afterLink:
                    ". Recopilamos y procesamos datos personales como se describe allí, cumpliendo con GDPR y normativa aplicable de protección de datos.",
            },
            subscription: {
                title: "6. Suscripción y pagos",
                body: "Los planes de pago se facturan mediante Stripe. Las suscripciones se renuevan automáticamente salvo cancelación. Los reembolsos se evalúan caso por caso dentro de los 14 días posteriores a la compra. Los packs de créditos no son reembolsables una vez usados.",
            },
            prohibited: {
                title: "7. Usos prohibidos",
                intro: "No puedes:",
                bullets: [
                    "Usar el Servicio para generar documentos fraudulentos o engañosos",
                    "Intentar eludir límites de tasa o controles de acceso",
                    "Hacer ingeniería inversa o scraping del Servicio",
                    "Usar el Servicio en violación de la ley aplicable",
                ],
            },
            liability: {
                title: "8. Limitación de responsabilidad",
                body: "AutoApply AI se proporciona «tal cual», sin garantías de ningún tipo. No somos responsables por daños indirectos, incidentales o consecuentes derivados del uso del Servicio. Nuestra responsabilidad total no excederá el importe pagado por ti en los 12 meses previos a la reclamación.",
            },
            termination: {
                title: "9. Terminación",
                body: "Podemos suspender o terminar tu cuenta por incumplimiento de estos Términos. Puedes eliminar tu cuenta en cualquier momento desde Configuración. Tras la eliminación, todos tus datos se eliminarán permanentemente conforme al GDPR.",
            },
            changes: {
                title: "10. Cambios en los términos",
                body: "Podemos actualizar estos Términos periódicamente. Los cambios materiales se comunicarán por correo electrónico o notificación dentro de la app. El uso continuado implica aceptación de los cambios.",
            },
            contact: {
                title: "11. Contacto",
                beforeLink: "Para preguntas sobre estos términos, contáctanos a través de",
                linkText: "nuestra página de contacto",
                afterLink: ".",
            },
        },
    },
    it: {
        metadataTitle: "Termini di servizio — AutoApply AI",
        metadataDescription:
            "Consulta i termini di servizio di AutoApply AI su abbonamenti, responsabilità e uso consentito.",
        pageTitle: "Termini di servizio",
        lastUpdated: "Ultimo aggiornamento: febbraio 2026",
        sections: {
            acceptance: {
                title: "1. Accettazione dei termini",
                body: "Accedendo e utilizzando AutoApply AI (il «Servizio»), accetti di essere vincolato dai presenti Termini di servizio. Se non sei d'accordo, non utilizzare il Servizio.",
            },
            description: {
                title: "2. Descrizione del servizio",
                body: "AutoApply AI è un assistente carriera basato su IA che aiuta a scoprire offerte di lavoro, valutare la compatibilità candidatura-posizione e generare CV e lettere di motivazione personalizzati. Il Servizio non si candida per tuo conto e non garantisce risultati occupazionali.",
            },
            responsibilities: {
                title: "3. Responsabilità dell'utente",
                intro: "Sei responsabile di:",
                bullets: [
                    "Fornire informazioni accurate e veritiere nel CV e nel profilo",
                    "Rivedere tutti i documenti generati dall'IA prima dell'invio ai datori di lavoro",
                    "Assicurarti che tutte le informazioni nei documenti generati siano fattuali",
                    "Mantenere sicure le credenziali del tuo account",
                ],
            },
            aiContent: {
                title: "4. Contenuti generati dall'IA",
                body: "Il Servizio utilizza IA per personalizzare i documenti. Pur adottando salvaguardie anti-allucinazione, l'IA può occasionalmente produrre contenuti inesatti. Devi rivedere e verificare tutti i documenti generati prima dell'uso. AutoApply AI non è responsabile per conseguenze derivanti da contenuti IA non verificati.",
            },
            privacy: {
                title: "5. Raccolta dati e privacy",
                beforeLink: "L'uso del Servizio è regolato anche dalla nostra",
                linkText: "Informativa sulla privacy",
                afterLink:
                    ". Raccogliamo e trattiamo dati personali come descritto in essa, nel rispetto del GDPR e delle normative applicabili.",
            },
            subscription: {
                title: "6. Abbonamenti e pagamenti",
                body: "I piani a pagamento sono fatturati tramite Stripe. Gli abbonamenti si rinnovano automaticamente salvo cancellazione. I rimborsi sono valutati caso per caso entro 14 giorni dall'acquisto. I pacchetti crediti non sono rimborsabili dopo l'utilizzo.",
            },
            prohibited: {
                title: "7. Usi vietati",
                intro: "Non puoi:",
                bullets: [
                    "Usare il Servizio per generare documenti fraudolenti o fuorvianti",
                    "Tentare di aggirare limiti di frequenza o controlli di accesso",
                    "Fare reverse engineering o scraping del Servizio",
                    "Usare il Servizio in violazione della legge applicabile",
                ],
            },
            liability: {
                title: "8. Limitazione di responsabilità",
                body: "AutoApply AI è fornito «così com'è», senza garanzie di alcun tipo. Non siamo responsabili per danni indiretti, incidentali o consequenziali derivanti dall'uso del Servizio. La nostra responsabilità totale non supererà l'importo pagato da te nei 12 mesi precedenti al reclamo.",
            },
            termination: {
                title: "9. Risoluzione",
                body: "Possiamo sospendere o chiudere il tuo account in caso di violazione dei presenti Termini. Puoi eliminare il tuo account in qualsiasi momento da Impostazioni. Dopo l'eliminazione, tutti i tuoi dati saranno rimossi permanentemente in conformità al GDPR.",
            },
            changes: {
                title: "10. Modifiche ai termini",
                body: "Potremmo aggiornare periodicamente i presenti Termini. Le modifiche sostanziali saranno comunicate via email o notifica in-app. L'uso continuato dopo le modifiche costituisce accettazione.",
            },
            contact: {
                title: "11. Contatto",
                beforeLink:
                    "Per domande su questi termini, contattaci tramite",
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
    const content = termsContentByLocale[locale];
    const title = content.metadataTitle;
    const description = content.metadataDescription;
    const parity = buildCanonicalOgParity(locale, "/terms");

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

export default async function TermsPage({
    params,
}: {
    params: Promise<{ locale: string }>;
}) {
    const { locale: rawLocale } = await params;
    const locale = resolveLocale(rawLocale);
    const content = termsContentByLocale[locale];
    const jsonLd = buildTrustPageJsonLd(
        locale,
        "/terms",
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
                            {content.sections.acceptance.title}
                        </h2>
                        <p>{content.sections.acceptance.body}</p>
                    </section>

                    <section>
                        <h2 className="text-xl font-semibold mt-8 mb-3">
                            {content.sections.description.title}
                        </h2>
                        <p>{content.sections.description.body}</p>
                    </section>

                    <section>
                        <h2 className="text-xl font-semibold mt-8 mb-3">
                            {content.sections.responsibilities.title}
                        </h2>
                        {content.sections.responsibilities.intro ? (
                            <p>{content.sections.responsibilities.intro}</p>
                        ) : null}
                        <ul className="list-disc pl-6 space-y-1 mt-2">
                            {content.sections.responsibilities.bullets?.map((item) => (
                                <li key={item}>{item}</li>
                            ))}
                        </ul>
                    </section>

                    <section>
                        <h2 className="text-xl font-semibold mt-8 mb-3">
                            {content.sections.aiContent.title}
                        </h2>
                        <p>{content.sections.aiContent.body}</p>
                    </section>

                    <section>
                        <h2 className="text-xl font-semibold mt-8 mb-3">
                            {content.sections.privacy.title}
                        </h2>
                        <p>
                            {content.sections.privacy.beforeLink}{" "}
                            <Link href="/privacy" className="text-primary underline">
                                {content.sections.privacy.linkText}
                            </Link>
                            {content.sections.privacy.afterLink}
                        </p>
                    </section>

                    <section>
                        <h2 className="text-xl font-semibold mt-8 mb-3">
                            {content.sections.subscription.title}
                        </h2>
                        <p>{content.sections.subscription.body}</p>
                    </section>

                    <section>
                        <h2 className="text-xl font-semibold mt-8 mb-3">
                            {content.sections.prohibited.title}
                        </h2>
                        {content.sections.prohibited.intro ? (
                            <p>{content.sections.prohibited.intro}</p>
                        ) : null}
                        <ul className="list-disc pl-6 space-y-1 mt-2">
                            {content.sections.prohibited.bullets?.map((item) => (
                                <li key={item}>{item}</li>
                            ))}
                        </ul>
                    </section>

                    <section>
                        <h2 className="text-xl font-semibold mt-8 mb-3">
                            {content.sections.liability.title}
                        </h2>
                        <p>{content.sections.liability.body}</p>
                    </section>

                    <section>
                        <h2 className="text-xl font-semibold mt-8 mb-3">
                            {content.sections.termination.title}
                        </h2>
                        <p>{content.sections.termination.body}</p>
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
