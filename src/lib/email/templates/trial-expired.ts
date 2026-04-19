export interface TrialExpiredTemplateData {
  orgName: string;
  billingUrl: string;
}

export function trialExpiredTemplate(
  data: TrialExpiredTemplateData,
  locale: "en" | "fr" = "en"
): { subject: string; html: string } {
  if (locale === "fr") {
    return {
      subject: `L'essai Veracrew de ${data.orgName} est terminé`,
      html: `
        <p>Bonjour,</p>
        <p>L'essai gratuit de <strong>${data.orgName}</strong> sur Veracrew est maintenant terminé. L'accès aux fonctionnalités premium a été suspendu.</p>
        <p>Ajoutez un moyen de paiement pour réactiver votre compte.</p>
        <p><a href="${data.billingUrl}">Réactiver maintenant</a></p>
        <p>L'équipe Veracrew</p>
      `,
    };
  }

  return {
    subject: `Your Veracrew trial for ${data.orgName} has ended`,
    html: `
      <p>Hi there,</p>
      <p>The free trial for <strong>${data.orgName}</strong> on Veracrew has ended. Access to premium features has been suspended.</p>
      <p>Add a payment method to reactivate your account.</p>
      <p><a href="${data.billingUrl}">Reactivate now</a></p>
      <p>The Veracrew team</p>
    `,
  };
}
