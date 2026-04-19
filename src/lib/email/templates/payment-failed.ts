export interface PaymentFailedTemplateData {
  orgName: string;
  billingUrl: string;
  retryDate?: string;
}

export function paymentFailedTemplate(
  data: PaymentFailedTemplateData,
  locale: "en" | "fr" = "en"
): { subject: string; html: string } {
  if (locale === "fr") {
    return {
      subject: `Paiement échoué pour ${data.orgName} sur Veracrew`,
      html: `
        <p>Bonjour,</p>
        <p>Nous n'avons pas pu traiter le paiement pour <strong>${data.orgName}</strong>.</p>
        ${data.retryDate ? `<p>Une nouvelle tentative sera effectuée le <strong>${data.retryDate}</strong>.</p>` : ""}
        <p>Mettez à jour votre moyen de paiement pour éviter l'interruption de service.</p>
        <p><a href="${data.billingUrl}">Mettre à jour le paiement</a></p>
        <p>L'équipe Veracrew</p>
      `,
    };
  }

  return {
    subject: `Payment failed for ${data.orgName} on Veracrew`,
    html: `
      <p>Hi there,</p>
      <p>We were unable to process the payment for <strong>${data.orgName}</strong>.</p>
      ${data.retryDate ? `<p>We will retry on <strong>${data.retryDate}</strong>.</p>` : ""}
      <p>Please update your payment method to avoid service interruption.</p>
      <p><a href="${data.billingUrl}">Update payment</a></p>
      <p>The Veracrew team</p>
    `,
  };
}
