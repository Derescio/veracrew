export interface TrialWillEndTemplateData {
  orgName: string;
  daysRemaining: number;
  billingUrl: string;
}

export function trialWillEndTemplate(
  data: TrialWillEndTemplateData,
  locale: "en" | "fr" = "en"
): { subject: string; html: string } {
  if (locale === "fr") {
    return {
      subject: `Votre essai Veracrew se termine dans ${data.daysRemaining} jour(s)`,
      html: `
        <p>Bonjour,</p>
        <p>L'essai gratuit de <strong>${data.orgName}</strong> sur Veracrew se termine dans <strong>${data.daysRemaining} jour(s)</strong>.</p>
        <p>Pour continuer à utiliser toutes les fonctionnalités sans interruption, veuillez ajouter un moyen de paiement.</p>
        <p><a href="${data.billingUrl}">Gérer la facturation</a></p>
        <p>L'équipe Veracrew</p>
      `,
    };
  }

  return {
    subject: `Your Veracrew trial ends in ${data.daysRemaining} day(s)`,
    html: `
      <p>Hi there,</p>
      <p>The free trial for <strong>${data.orgName}</strong> on Veracrew ends in <strong>${data.daysRemaining} day(s)</strong>.</p>
      <p>To continue using all features without interruption, please add a payment method.</p>
      <p><a href="${data.billingUrl}">Manage billing</a></p>
      <p>The Veracrew team</p>
    `,
  };
}
