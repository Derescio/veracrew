export interface WelcomeToPaidTemplateData {
  orgName: string;
  planName: string;
  dashboardUrl: string;
}

export function welcomeToPaidTemplate(
  data: WelcomeToPaidTemplateData,
  locale: "en" | "fr" = "en"
): { subject: string; html: string } {
  if (locale === "fr") {
    return {
      subject: `Bienvenue sur Veracrew ${data.planName} — ${data.orgName}`,
      html: `
        <p>Bonjour,</p>
        <p>Merci ! <strong>${data.orgName}</strong> est maintenant abonné au plan <strong>${data.planName}</strong> de Veracrew.</p>
        <p>Toutes les fonctionnalités premium sont désormais disponibles.</p>
        <p><a href="${data.dashboardUrl}">Accéder au tableau de bord</a></p>
        <p>L'équipe Veracrew</p>
      `,
    };
  }

  return {
    subject: `Welcome to Veracrew ${data.planName} — ${data.orgName}`,
    html: `
      <p>Hi there,</p>
      <p>Thank you! <strong>${data.orgName}</strong> is now subscribed to the Veracrew <strong>${data.planName}</strong> plan.</p>
      <p>All premium features are now available.</p>
      <p><a href="${data.dashboardUrl}">Go to dashboard</a></p>
      <p>The Veracrew team</p>
    `,
  };
}
